import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { showToast } from './eventStore';
import type { Proposal, SkillResult } from '../lib/agent/types';
import type { ExecutionPlan } from '../lib/agent/planner';
import type { PlanStepRunState } from '../lib/agent/executor';
import { executeExecutionPlan } from '../lib/agent/executor';
import { runCopilotTurn, type CopilotTurnContext } from '../lib/agent/copilotController';
import type { CopilotMessage } from '../lib/agent/context';
import { applyProposal } from '../lib/agent/applyProposal';
import { getTool } from '../lib/agent/tools/registry';
import {
  API_BASE_URL,
  applyCopilotProposal,
  cancelCopilotPlanRun,
  createCopilotPlanRun,
  fetchCopilotPlanRun,
  fetchCopilotPlanRunSteps,
  fetchCopilotSession,
  saveCopilotSession,
} from '../lib/api';

export type CopilotChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ShotPromptQuestion = { id: string; question: string; default?: string };
type CanonDraftState = {
  canonAssetId: string;
  rootUserRequest: string;
  lastUserRequest: string;
  transcript: string;
  updatedAt: string;
};

type CopilotStatus = 'idle' | 'planning' | 'confirming' | 'executing' | 'applying';

type CopilotSessionState = {
  status: CopilotStatus;
  messages: CopilotChatMessage[];
  lastContext: CopilotTurnContext | null;
  activeProjectId: string | null;
  pendingPlanRequest: string | null;
  pendingIntentRequest: string | null;
  pendingShotPromptRequest: string | null;
  remoteRunId: string | null;

  // Shot prompt card (specialized UI for the first shipped skill)
  shotSuggestion: Record<string, unknown> | null;
  shotProposal: Proposal | null;
  shotContext: string;
  lastShotFeedback: string;
  shotQuestions: ShotPromptQuestion[];
  shotQuestionAnswers: Record<string, string>;

  // Planner/executor
  activePlan: ExecutionPlan | null;
  activePlanContext: string;
  planAnswers: Record<string, string>;
  planSteps: PlanStepRunState[];

  // Generic proposal surface (proposal-first architecture)
  pendingProposal: Proposal | null;

  // Canon update draft (smooth chat -> compile on /review)
  pendingCanonDraft: CanonDraftState | null;
};

type CopilotSessionActions = {
  loadSessionForProject: (projectId: string) => void;
  clearConversation: () => void;
  clearPlan: () => void;
  dismissProposal: () => void;
  cancelActivePlan: () => void;
  appendAssistantMessage: (text: string) => void;
  resetShotPromptState: () => void;
  setShotPromptState: (input: {
    suggestion: Record<string, unknown> | null;
    proposal: Proposal | null;
    context: string;
    feedback: string;
    questions: ShotPromptQuestion[];
    questionDefaults?: Record<string, string>;
  }) => void;
  setShotQuestionAnswer: (id: string, value: string) => void;
  setPlanAnswer: (id: string, value: string) => void;

  sendMessage: (input: {
    messageText: string;
    context: CopilotTurnContext;
    navigate?: (path: string) => void;
    queryClient?: QueryClient;
  }) => Promise<void>;

  runActivePlan: (input: {
    context: CopilotTurnContext;
    queryClient?: QueryClient;
    navigate?: (path: string) => void;
    confirmed: boolean;
  }) => Promise<void>;

  applyPendingProposal: (input: { queryClient?: QueryClient; navigate?: (path: string) => void }) => Promise<void>;
};

function isProposalLike(value: unknown): value is Proposal {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as Record<string, unknown>).kind;
  return (
    kind === 'asset_patch' ||
    kind === 'asset_update' ||
    kind === 'create_asset' ||
    kind === 'create_workflow' ||
    kind === 'workflow_patch' ||
    kind === 'delete_workflow'
  );
}

function isMeaningfulCanonRequest(text: string) {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.length >= 40) return true;
  const lower = t.toLowerCase();
  if (/\b(allan|canon|character|appearance|location|equipment|tone|theme)\b/.test(lower)) return true;
  if (/\b(update|edit|change|modify|set|replace|remove|delete|add|redo|fix)\b/.test(lower)) return true;
  return false;
}

function mergeCanonDraft(
  prev: CanonDraftState | null,
  next: { canonAssetId: string; userRequest: string; assistantReply: string; updatedAt?: string }
): CanonDraftState {
  const updatedAt = next.updatedAt || new Date().toISOString();
  const entry = `USER:\n${next.userRequest}\n\nASSISTANT:\n${next.assistantReply}`;
  const base =
    prev && prev.canonAssetId === next.canonAssetId && typeof prev.transcript === 'string' ? prev.transcript : '';
  const combined = (base ? `${base}\n\n${entry}` : entry).slice(-8000);

  const prevRoot =
    prev && prev.canonAssetId === next.canonAssetId && typeof prev.rootUserRequest === 'string'
      ? prev.rootUserRequest
      : '';
  const rootUserRequest = prevRoot || (isMeaningfulCanonRequest(next.userRequest) ? next.userRequest : '');
  const lastUserRequest = isMeaningfulCanonRequest(next.userRequest)
    ? next.userRequest
    : prev && prev.canonAssetId === next.canonAssetId
      ? prev.lastUserRequest
      : next.userRequest;

  return {
    canonAssetId: next.canonAssetId,
    rootUserRequest,
    lastUserRequest,
    transcript: combined,
    updatedAt,
  };
}

let activePlanAbortController: AbortController | null = null;
let activeRemoteEventSource: EventSource | null = null;

const SESSION_STORAGE_PREFIX = 'copilot_session_v1:';
const MAX_MESSAGES = 50;

type PersistedCopilotSession = {
  savedAt: string;
  messages: CopilotChatMessage[];
  pendingPlanRequest?: string | null;
  pendingIntentRequest?: string | null;
  pendingShotPromptRequest?: string | null;
  remoteRunId?: string | null;
  shotSuggestion: Record<string, unknown> | null;
  shotProposal: Proposal | null;
  shotContext: string;
  lastShotFeedback: string;
  shotQuestions: ShotPromptQuestion[];
  shotQuestionAnswers: Record<string, string>;
  activePlan: ExecutionPlan | null;
  activePlanContext: string;
  planAnswers: Record<string, string>;
  planSteps: Array<Omit<PlanStepRunState, 'result'>>;
  pendingProposal: Proposal | null;
  pendingCanonDraft?: CanonDraftState | null;
};

function sessionKey(projectId: string) {
  return `${SESSION_STORAGE_PREFIX}${projectId}`;
}

function loadSession(projectId: string): PersistedCopilotSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sessionKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCopilotSession;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(projectId: string, state: CopilotSessionState) {
  if (typeof window === 'undefined') return;
  try {
    const payload = buildPersistedSession(state);
    window.localStorage.setItem(sessionKey(projectId), JSON.stringify(payload));
  } catch {
    // ignore quota / serialization errors
  }
}

function buildPersistedSession(state: CopilotSessionState): PersistedCopilotSession {
  return {
    savedAt: new Date().toISOString(),
    messages: [...state.messages].slice(-MAX_MESSAGES),
    pendingPlanRequest: state.pendingPlanRequest,
    pendingIntentRequest: state.pendingIntentRequest,
    pendingShotPromptRequest: state.pendingShotPromptRequest,
    remoteRunId: state.remoteRunId,
    shotSuggestion: state.shotSuggestion,
    shotProposal: state.shotProposal,
    shotContext: state.shotContext,
    lastShotFeedback: state.lastShotFeedback,
    shotQuestions: state.shotQuestions,
    shotQuestionAnswers: state.shotQuestionAnswers,
    activePlan: state.activePlan,
    activePlanContext: state.activePlanContext,
    planAnswers: state.planAnswers,
    planSteps: state.planSteps.map(s => ({ id: s.id, title: s.title, tool: s.tool, status: s.status, error: s.error })),
    pendingProposal: state.pendingProposal,
    pendingCanonDraft: state.pendingCanonDraft,
  };
}

export const useCopilotSessionStore = create<CopilotSessionState & CopilotSessionActions>((set, get) => ({
  status: 'idle',
  messages: [],
  lastContext: null,
  activeProjectId: null,
  pendingPlanRequest: null,
  pendingIntentRequest: null,
  pendingShotPromptRequest: null,
  remoteRunId: null,

  shotSuggestion: null,
  shotProposal: null,
  shotContext: '',
  lastShotFeedback: '',
  shotQuestions: [],
  shotQuestionAnswers: {},

  activePlan: null,
  activePlanContext: '',
  planAnswers: {},
  planSteps: [],

  pendingProposal: null,
  pendingCanonDraft: null,

  loadSessionForProject: projectId => {
    if (!projectId) return;
    // Load local immediately (fast), then attempt to hydrate from backend (source-of-truth).
    const local = loadSession(projectId);
    if (local) {
      set({
        status: 'idle',
        activeProjectId: projectId,
        pendingPlanRequest: local.pendingPlanRequest ?? null,
        pendingIntentRequest: local.pendingIntentRequest ?? null,
        pendingShotPromptRequest: local.pendingShotPromptRequest ?? null,
        remoteRunId: local.remoteRunId ?? null,
        messages: Array.isArray(local.messages) ? local.messages.slice(-MAX_MESSAGES) : [],
        shotSuggestion: local.shotSuggestion ?? null,
        shotProposal: local.shotProposal ?? null,
        shotContext: local.shotContext ?? '',
        lastShotFeedback: local.lastShotFeedback ?? '',
        shotQuestions: Array.isArray(local.shotQuestions) ? local.shotQuestions : [],
        shotQuestionAnswers: local.shotQuestionAnswers ?? {},
        activePlan: local.activePlan ?? null,
        activePlanContext: local.activePlanContext ?? '',
        planAnswers: local.planAnswers ?? {},
        planSteps: Array.isArray(local.planSteps)
          ? local.planSteps.map(s => ({
              id: s.id,
              title: s.title,
              tool: s.tool,
              status: s.status,
              error: (s as any).error,
            }))
          : [],
        pendingProposal: local.pendingProposal ?? null,
        pendingCanonDraft: (local as any).pendingCanonDraft ?? null,
      });
    } else {
      set({
        status: 'idle',
        activeProjectId: projectId,
        pendingPlanRequest: null,
        pendingIntentRequest: null,
        pendingShotPromptRequest: null,
        remoteRunId: null,
        messages: [],
        shotSuggestion: null,
        shotProposal: null,
        shotContext: '',
        lastShotFeedback: '',
        shotQuestions: [],
        shotQuestionAnswers: {},
        activePlan: null,
        activePlanContext: '',
        planAnswers: {},
        planSteps: [],
        pendingProposal: null,
        pendingCanonDraft: null,
      });
    }

    // Background hydrate from backend
    setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchCopilotSession(projectId);
          const server = res.session?.state as PersistedCopilotSession | undefined;
          if (!server) return;
          // Prefer whichever is newer by savedAt
          const localSavedAt = local?.savedAt ? new Date(local.savedAt).getTime() : 0;
          const serverSavedAt = server.savedAt ? new Date(server.savedAt).getTime() : 0;
          if (serverSavedAt < localSavedAt) return;

          set({
            status: 'idle',
            activeProjectId: projectId,
            pendingPlanRequest: server.pendingPlanRequest ?? null,
            pendingIntentRequest: server.pendingIntentRequest ?? null,
            pendingShotPromptRequest: server.pendingShotPromptRequest ?? null,
            remoteRunId: server.remoteRunId ?? null,
            messages: Array.isArray(server.messages) ? server.messages.slice(-MAX_MESSAGES) : [],
            shotSuggestion: server.shotSuggestion ?? null,
            shotProposal: server.shotProposal ?? null,
            shotContext: server.shotContext ?? '',
            lastShotFeedback: server.lastShotFeedback ?? '',
            shotQuestions: Array.isArray(server.shotQuestions) ? server.shotQuestions : [],
            shotQuestionAnswers: server.shotQuestionAnswers ?? {},
            activePlan: server.activePlan ?? null,
            activePlanContext: server.activePlanContext ?? '',
            planAnswers: server.planAnswers ?? {},
            planSteps: Array.isArray(server.planSteps)
              ? server.planSteps.map(s => ({
                  id: s.id,
                  title: s.title,
                  tool: s.tool,
                  status: s.status,
                  error: (s as any).error,
                }))
              : [],
            pendingProposal: server.pendingProposal ?? null,
            pendingCanonDraft: (server as any).pendingCanonDraft ?? null,
          });

          const runId = server.remoteRunId ?? null;
          if (runId) {
            void (async () => {
              try {
                const runRes = await fetchCopilotPlanRun(projectId, runId);
                const run = runRes.run as any;
                const status = String(run?.status ?? '');
                const stepsRes = await fetchCopilotPlanRunSteps(projectId, runId);
                const steps = stepsRes.items ?? [];
                set({
                  remoteRunId: runId,
                  status: status === 'running' || status === 'queued' ? 'executing' : 'idle',
                  planSteps: steps.map((s: any) => ({
                    id: String(s.step_id ?? ''),
                    title: String(s.title ?? ''),
                    tool: String(s.tool ?? ''),
                    status: s.status as any,
                    result: s.result,
                    error: s.error?.message ?? (typeof s.error === 'string' ? s.error : undefined),
                  })),
                });
                if (status === 'running' || status === 'queued') {
                  // Re-attach SSE stream
                  if (activeRemoteEventSource) {
                    try {
                      activeRemoteEventSource.close();
                    } catch {}
                    activeRemoteEventSource = null;
                  }
                  const es = new EventSource(`${API_BASE_URL}/projects/${projectId}/copilot/runs/${runId}/events`);
                  activeRemoteEventSource = es;
                  es.addEventListener('step_update', (evt: any) => {
                    try {
                      const payload = JSON.parse(evt.data);
                      const step = payload?.step;
                      if (!step) return;
                      set(state => {
                        const next = [...state.planSteps];
                        const idx =
                          typeof step.step_index === 'number'
                            ? step.step_index
                            : next.findIndex(s => s.id === step.step_id);
                        if (idx < 0) return { planSteps: next };
                        next[idx] = {
                          ...next[idx]!,
                          status: step.status,
                          result: step.result,
                          error: step.error?.message ?? undefined,
                        };
                        return { planSteps: next };
                      });
                    } catch {}
                  });
                  es.addEventListener('run_update', (evt: any) => {
                    try {
                      const payload = JSON.parse(evt.data);
                      const r = payload?.run;
                      if (!r) return;
                      const s = String(r.status ?? '');
                      if (s === 'completed' || s === 'failed' || s === 'cancelled') {
                        try {
                          es.close();
                        } catch {}
                        if (activeRemoteEventSource === es) activeRemoteEventSource = null;
                        set({ remoteRunId: null, status: 'idle' });
                      }
                    } catch {}
                  });
                }
              } catch {
                // ignore
              }
            })();
          }
        } catch {
          // ignore; local storage remains fallback
        }
      })();
    }, 0);
  },

  clearConversation: () => {
    if (activeRemoteEventSource) {
      try {
        activeRemoteEventSource.close();
      } catch {}
      activeRemoteEventSource = null;
    }
    if (activePlanAbortController) {
      try {
        activePlanAbortController.abort();
      } catch {}
      activePlanAbortController = null;
    }
    set({
      status: 'idle',
      messages: [],
      pendingPlanRequest: null,
      pendingIntentRequest: null,
      pendingShotPromptRequest: null,
      remoteRunId: null,
      shotSuggestion: null,
      shotProposal: null,
      shotContext: '',
      lastShotFeedback: '',
      shotQuestions: [],
      shotQuestionAnswers: {},
      activePlan: null,
      activePlanContext: '',
      planAnswers: {},
      planSteps: [],
      pendingProposal: null,
      pendingCanonDraft: null,
    });
    showToast({ type: 'success', title: 'Cleared', message: 'Copilot conversation cleared.' });
  },

  clearPlan: () =>
    (() => {
      if (activeRemoteEventSource) {
        try {
          activeRemoteEventSource.close();
        } catch {}
        activeRemoteEventSource = null;
      }
      set({
        activePlan: null,
        activePlanContext: '',
        planAnswers: {},
        planSteps: [],
        pendingIntentRequest: null,
        remoteRunId: null,
        status: 'idle',
      });
    })(),

  dismissProposal: () =>
    set(state => ({
      pendingProposal: null,
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          content: 'Dismissed.',
        },
      ],
    })),

  cancelActivePlan: () => {
    if (activePlanAbortController) {
      activePlanAbortController.abort();
    }
    const projectId = get().activeProjectId ?? get().lastContext?.projectId ?? null;
    const runId = get().remoteRunId;
    if (projectId && runId) {
      void cancelCopilotPlanRun(projectId, runId).catch(() => {});
      if (activeRemoteEventSource) {
        try {
          activeRemoteEventSource.close();
        } catch {}
        activeRemoteEventSource = null;
      }
      set({ remoteRunId: null });
    }
  },

  appendAssistantMessage: text =>
    set(state => ({
      messages: [
        ...state.messages,
        { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: text },
      ],
    })),

  resetShotPromptState: () =>
    set({
      pendingShotPromptRequest: null,
      shotSuggestion: null,
      shotProposal: null,
      shotContext: '',
      lastShotFeedback: '',
      shotQuestions: [],
      shotQuestionAnswers: {},
    }),

  setShotPromptState: input =>
    set({
      pendingShotPromptRequest: input.questions.length ? input.feedback : null,
      shotSuggestion: input.suggestion,
      shotProposal: input.proposal,
      shotContext: input.context,
      lastShotFeedback: input.feedback,
      shotQuestions: input.questions,
      shotQuestionAnswers: input.questionDefaults ?? {},
    }),

  setShotQuestionAnswer: (id, value) =>
    set(state => ({ shotQuestionAnswers: { ...state.shotQuestionAnswers, [id]: value } })),

  setPlanAnswer: (id, value) => set(state => ({ planAnswers: { ...state.planAnswers, [id]: value } })),

  sendMessage: async ({ messageText, context, navigate, queryClient }) => {
    const text = (messageText || '').trim();
    if (!text || !context?.projectId) return;

    const pendingPlanRequest = get().pendingPlanRequest;
    const pendingIntentRequest = get().pendingIntentRequest;
    const pendingShotPromptRequest = get().pendingShotPromptRequest;
    const hasShotFocus = Boolean(context.shotId && context.shotPlanAssetId);
    const isShotClarificationTurn =
      !pendingPlanRequest && hasShotFocus && Boolean(pendingShotPromptRequest && get().shotQuestions.length > 0);

    const lower = text.toLowerCase();
    const applyCommand = lower === 'apply' || lower === 'apply proposal' || lower === 'confirm' || lower === 'yes';
    const dismissCommand = lower === 'dismiss' || lower === 'cancel';
    const shortApplyLike =
      (get().pendingProposal || get().pendingCanonDraft) &&
      text.length <= 80 &&
      (/\bapply\b/i.test(text) ||
        /\b(go ahead|do it|confirm|approve)\b/i.test(text) ||
        /^(ok(ay)?|looks good|sounds good|great|yes|yep|sure)\b/i.test(text));
    const shortDismissLike =
      (get().pendingProposal || get().pendingCanonDraft) &&
      text.length <= 80 &&
      (/\b(dismiss|discard|cancel|never mind|nevermind)\b/i.test(text));

    if ((applyCommand || shortApplyLike) && (get().pendingProposal || get().pendingCanonDraft)) {
      set(state => ({
        messages: [
          ...state.messages,
          { id: `${Date.now()}`, role: 'user', content: text },
        ],
      }));
      await get().applyPendingProposal({ queryClient, navigate });
      return;
    }
    if ((dismissCommand || shortDismissLike) && get().pendingProposal) {
      set(state => ({
        pendingProposal: null,
        messages: [
          ...state.messages,
          { id: `${Date.now()}`, role: 'user', content: text },
          {
            id: `${Date.now() + 1}`,
            role: 'assistant',
            content: 'Dismissed.',
          },
        ],
      }));
      return;
    }

    const isCanonCompile = text.startsWith('CANON_COMPILE:\n');
    const displayText = isCanonCompile ? '/review' : text;

    const userMessage: CopilotChatMessage = {
      id: `${Date.now()}`,
      role: 'user',
      // Keep the chat UX natural (no "Answer:" prefix). We still pass clarification structure
      // to the agent via `effectiveUserText` below when needed.
      content: displayText,
    };
    const nowIso = new Date().toISOString();
    const conversation: CopilotMessage[] = [...get().messages, userMessage]
      .slice(-12)
      .map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: nowIso,
      }));

    set(state => ({
      status: 'planning',
      messages: [...state.messages, userMessage],
      // New turn resets generic proposal surface; shot prompt gets updated if the turn returns it.
      pendingProposal: null,
      lastContext: context,
      activeProjectId: context.projectId,
    }));

    try {
      const shotQuestionsBlock = isShotClarificationTurn
        ? get()
            .shotQuestions.map(q => `- ${q.question}`)
            .join('\n')
        : '';
      // Canon compile turns must remain intact (they are an internal marker consumed by the agent).
      const effectiveUserText = isCanonCompile
        ? text
        : pendingIntentRequest
          ? `${pendingIntentRequest}\n\nINTENT_CONFIRMATION:\n${text}`
          : pendingPlanRequest
            ? `${pendingPlanRequest}\n\nCLARIFICATIONS:\n${text}`
            : isShotClarificationTurn
              ? `${pendingShotPromptRequest}\n\nSHOT_PROMPT_QUESTIONS:\n${shotQuestionsBlock}\n\nANSWERS:\n${text}`
              : text;
      const output = await runCopilotTurn(context, effectiveUserText, { conversation });

      // Skill-driven navigation
      if (output.skillResult?.success && output.skillResult.action?.type === 'navigate') {
        const payload = output.skillResult.action.payload as { path: string; workflowId?: string };
        if (payload.workflowId) sessionStorage.setItem('pendingWorkflowId', payload.workflowId);
        navigate?.(payload.path);
      }

      // Append assistant messages
      if (output.assistantMessages.length) {
        set(state => ({
          messages: [
            ...state.messages,
            ...output.assistantMessages.map((content, idx) => ({
              id: `${Date.now() + 1 + idx}`,
              role: 'assistant' as const,
              content,
            })),
          ],
        }));
      }

      // Intent confirmation loop: stash the original request until the user replies.
      if (output.ui?.intentConfirm?.request) {
        set({ pendingIntentRequest: output.ui.intentConfirm.request });
      } else if (pendingIntentRequest) {
        // Consume the confirmation turn.
        set({ pendingIntentRequest: null });
      }

      // Shot prompt UI (specialized)
      if (output.ui?.shotPrompt) {
        const defaults: Record<string, string> = {};
        for (const q of output.ui.shotPrompt.questions ?? []) defaults[q.id] = q.default ?? '';
        const hasQuestions = (output.ui.shotPrompt.questions ?? []).length > 0;
        const proposal = (output.skillResult?.proposal ?? null) as Proposal | null;
        const lastAssistant = output.assistantMessages[output.assistantMessages.length - 1] ?? '';
        const shouldNudgeApply = Boolean(proposal) && !/\/apply\b/i.test(lastAssistant);
        set(state => ({
          shotSuggestion: output.ui!.shotPrompt!.suggestion,
          shotProposal: proposal,
          shotContext: output.ui!.shotPrompt!.context,
          lastShotFeedback: pendingShotPromptRequest ?? text,
          shotQuestions: output.ui!.shotPrompt!.questions,
          shotQuestionAnswers: defaults,
          pendingProposal: proposal,
          pendingShotPromptRequest: hasQuestions ? (pendingShotPromptRequest ?? text) : null,
          messages: shouldNudgeApply
            ? [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Proposal ready: ${proposal!.summary}\nType /review to preview (or /review json), /apply to apply, or /dismiss to discard.`,
                },
              ]
            : state.messages,
        }));
      } else if (output.skillResult?.proposal) {
        // Any other skill proposal becomes the generic proposal card
        const proposal = output.skillResult.proposal as Proposal;
        const lastAssistant = output.assistantMessages[output.assistantMessages.length - 1] ?? '';
        const shouldNudgeApply = !/\/apply\b/i.test(lastAssistant);
        set(state => ({
          pendingProposal: proposal,
          messages: shouldNudgeApply
            ? [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Proposal ready: ${proposal.summary}\nType /review to preview (or /review json), /apply to apply, or /dismiss to discard.`,
                },
              ]
            : state.messages,
        }));
      }

      // Planner UI
      if (output.ui?.plan) {
        const plan = output.ui.plan;
        const planDefaults: Record<string, string> = {};
        for (const q of plan.questions ?? []) planDefaults[q.id] = q.default ?? '';

        set({
          activePlan: plan,
          activePlanContext: output.ui.planContext ?? '',
          planAnswers: planDefaults,
          planSteps: plan.steps.map(s => ({ id: s.id, title: s.title, tool: s.tool, status: 'pending' })),
          status: plan.steps.length && !plan.questions?.length ? 'confirming' : 'idle',
          pendingPlanRequest: plan.questions?.length ? (pendingPlanRequest ?? text) : null,
        });

        // Auto-run read-only plans.
        const hasQuestions = Boolean(plan.questions?.length);
        if (!hasQuestions && !plan.requires_confirmation && plan.steps.length > 0) {
          setTimeout(() => {
            void get().runActivePlan({ context, queryClient, navigate, confirmed: false });
          }, 0);
        }
      }

      // Canon draft UI: smooth chat collects a draft until /review compiles a proposal
      if (output.ui?.canonDraft) {
        set(state => ({
          pendingCanonDraft: mergeCanonDraft(state.pendingCanonDraft, output.ui!.canonDraft!),
        }));
      }
    } catch (err) {
      set({ status: 'idle' });
      showToast({
        type: 'error',
        title: 'Copilot error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      set(state => ({
        messages: [
          ...state.messages,
          {
            id: `${Date.now() + 1}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error connecting to the AI backend.',
          },
        ],
      }));
    } finally {
      set(state => ({ status: state.status === 'planning' ? 'idle' : state.status }));
    }
  },

  runActivePlan: async ({ context, queryClient, navigate, confirmed }) => {
    const plan = get().activePlan;
    if (!plan) return;
    if (!context?.projectId) return;
    if (get().status === 'executing') return;
    if (plan.questions?.length) return;
    if (plan.steps.length === 0) return;

    set(state => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          content: `Running plan: ${plan.intent}\n(steps: ${plan.steps.length})`,
        },
      ],
    }));

    set({
      status: 'executing',
      planSteps: plan.steps.map(s => ({ id: s.id, title: s.title, tool: s.tool, status: 'pending' })),
    });

    const hasExec = plan.steps.some(s => (getTool(s.tool)?.category ?? 'exec') === 'exec');
    if (hasExec) {
      // Backend runner: survives refresh and streams progress (SSE). Fallback to local executor if unsupported.
      try {
        const lastStepStatus = new Map<string, string>();
        const created = await createCopilotPlanRun({
          projectId: context.projectId,
          plan: plan as unknown as Record<string, unknown>,
          context: { ...(context as unknown as Record<string, unknown>), _confirmed: confirmed },
          confirmed,
        });
        const run = created.run as any;
        const runId = String(run.id);
        if (activeRemoteEventSource) {
          try {
            activeRemoteEventSource.close();
          } catch {}
          activeRemoteEventSource = null;
        }
        set({
          remoteRunId: runId,
          planSteps: (created.steps ?? []).map((s: any) => ({
            id: String(s.step_id ?? s.id ?? ''),
            title: String(s.title ?? ''),
            tool: String(s.tool ?? ''),
            status: (s.status ?? 'pending') as any,
            result: s.result,
            error: s.error,
          })),
        });

        const es = new EventSource(`${API_BASE_URL}/projects/${context.projectId}/copilot/runs/${runId}/events`);
        activeRemoteEventSource = es;

        const close = () => {
          try {
            es.close();
          } catch {}
          if (activeRemoteEventSource === es) activeRemoteEventSource = null;
        };

        const handleStep = (payload: any) => {
          const step = payload?.step;
          if (!step) return;

          const stepId = String(step.step_id ?? '');
          const stepTitle = String(step.title ?? '');
          const stepTool = String(step.tool ?? '');
          const stepStatus = String(step.status ?? '');
          const prev = stepId ? lastStepStatus.get(stepId) : undefined;
          if (stepId && stepStatus && stepStatus !== prev) {
            lastStepStatus.set(stepId, stepStatus);
            if (stepStatus === 'running') {
              set(state => ({
                messages: [
                  ...state.messages,
                  {
                    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    role: 'assistant',
                    content: `Step started: ${stepTitle || stepId} (${stepTool})`,
                  },
                ],
              }));
            } else if (stepStatus === 'success') {
              set(state => ({
                messages: [
                  ...state.messages,
                  {
                    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    role: 'assistant',
                    content: `Step done: ${stepTitle || stepId}`,
                  },
                ],
              }));
            } else if (stepStatus === 'error' || stepStatus === 'failed') {
              const msg = step.error?.message ?? (typeof step.error === 'string' ? step.error : '');
              set(state => ({
                messages: [
                  ...state.messages,
                  {
                    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    role: 'assistant',
                    content: `Step failed: ${stepTitle || stepId}${msg ? `\n${msg}` : ''}`,
                  },
                ],
              }));
            }
          }

          set(state => {
            const next = [...state.planSteps];
            const idx = typeof step.step_index === 'number' ? step.step_index : next.findIndex(s => s.id === step.step_id);
            const patched: PlanStepRunState = {
              id: String(step.step_id ?? next[idx]?.id ?? ''),
              title: String(step.title ?? next[idx]?.title ?? ''),
              tool: String(step.tool ?? next[idx]?.tool ?? ''),
              status: step.status as any,
              result: step.result,
              error: step.error?.message ?? (typeof step.error === 'string' ? step.error : undefined),
            };
            if (idx >= 0) next[idx] = { ...next[idx]!, ...patched };
            return { planSteps: next };
          });
        };

        const handleRun = async (payload: any) => {
          const r = payload?.run;
          if (!r) return;
          const status = String(r.status ?? '');
          if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            close();
            if (queryClient && status === 'completed') {
              queryClient.invalidateQueries({ queryKey: ['project-assets', context.projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-workflows', context.projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-runs', context.projectId] });
            }
            const stepsRes = await fetchCopilotPlanRunSteps(context.projectId, runId).catch(() => null);
            const steps = stepsRes?.items ?? [];
            const summary = steps
              .map((s: any) => `- ${s.title} (${s.tool}): ${s.status}`)
              .join('\n');
            set(state => ({
              messages: [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Plan result:\n${summary}`,
                },
              ],
            }));

            // Surface proposals produced by propose* tools (if any)
            for (const s of steps) {
              const maybe = s?.result;
              if (maybe && typeof maybe === 'object') {
                const wrapped = (maybe as any).proposal;
                if (isProposalLike(wrapped)) {
                  set(state => ({
                    pendingProposal: wrapped,
                    messages: [
                      ...state.messages,
                      {
                        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        role: 'assistant',
                        content: `Proposal ready: ${wrapped.summary}\nType /apply to apply, or /dismiss to discard.`,
                      },
                    ],
                  }));
                  break;
                }
                if (isProposalLike(maybe)) {
                  set(state => ({
                    pendingProposal: maybe,
                    messages: [
                      ...state.messages,
                      {
                        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        role: 'assistant',
                        content: `Proposal ready: ${maybe.summary}\nType /apply to apply, or /dismiss to discard.`,
                      },
                    ],
                  }));
                  break;
                }
              }
            }

            // If the plan verified new assets were produced, jump the user to the relevant page.
            if (status === 'completed' && navigate) {
              const verified = [...steps].reverse().find((s: any) => s?.tool === 'findAssetsProducedByWorkflowRun' && s?.status === 'success');
              const items = Array.isArray(verified?.result?.items) ? verified.result.items : [];
              const assetType = String(verified?.params?.assetType ?? '');
              if (items.length > 0) {
                const target =
                  assetType === 'scene'
                    ? 'scenes'
                    : assetType === 'shot_plan'
                      ? 'shots'
                      : assetType === 'canon_text'
                        ? 'canon'
                        : '';
                if (target) navigate(`/projects/${context.projectId}/${target}`);
              }
            }

            set({ status: 'idle', remoteRunId: null });
            showToast({
              type: status === 'completed' ? 'success' : status === 'cancelled' ? 'warning' : 'error',
              title: status === 'completed' ? 'Plan completed' : status === 'cancelled' ? 'Plan cancelled' : 'Plan failed',
              message: status === 'completed' ? 'All steps completed.' : r.error_message || 'Execution finished.',
            });
          }
        };

        es.addEventListener('step_update', (evt: any) => {
          try {
            handleStep(JSON.parse(evt.data));
          } catch {}
        });
        es.addEventListener('run_update', (evt: any) => {
          try {
            void handleRun(JSON.parse(evt.data));
          } catch {}
        });
        es.addEventListener('error', () => {
          // If the stream drops, we can still rely on polling; keep local UI usable.
        });

        return;
      } catch (err) {
        // Fall back to local executor
        showToast({
          type: 'warning',
          title: 'Backend runner unavailable',
          message: err instanceof Error ? err.message : 'Falling back to local execution.',
        });
      }
    }

    const controller = new AbortController();
    activePlanAbortController = controller;

    const lastLocalStepStatus = new Map<string, string>();
    const result = await executeExecutionPlan({
      plan,
      context,
      onStepUpdate: (step, all) => {
        set({ planSteps: all });
        const prev = lastLocalStepStatus.get(step.id);
        if (step.status !== prev) {
          lastLocalStepStatus.set(step.id, step.status);
          if (step.status === 'running') {
            set(state => ({
              messages: [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Step started: ${step.title} (${step.tool})`,
                },
              ],
            }));
          } else if (step.status === 'success') {
            set(state => ({
              messages: [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Step done: ${step.title}`,
                },
              ],
            }));
          } else if (step.status === 'error') {
            set(state => ({
              messages: [
                ...state.messages,
                {
                  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                  role: 'assistant',
                  content: `Step failed: ${step.title}${step.error ? `\n${step.error}` : ''}`,
                },
              ],
            }));
          }
        }
      },
      allowWrite: confirmed,
      signal: controller.signal,
    }).finally(() => {
      if (activePlanAbortController === controller) activePlanAbortController = null;
    });

    const wasCancelled = controller.signal.aborted || result.error === 'Cancelled.';
    const summary = result.steps.map(s => `- ${s.title} (${s.tool}): ${s.status}`).join('\n');
    set(state => ({
      messages: [
        ...state.messages,
        { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, role: 'assistant', content: `Plan result:\n${summary}` },
      ],
    }));
    for (const step of result.steps) {
      const r = step.result as any;
      const wrapped = r?.proposal;
      if (isProposalLike(wrapped)) {
        set(state => ({
          pendingProposal: wrapped,
          messages: [
            ...state.messages,
            {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              role: 'assistant',
              content: `Proposal ready: ${wrapped.summary}\nType /apply to apply, or /dismiss to discard.`,
            },
          ],
        }));
        break;
      }
      if (isProposalLike(r)) {
        set(state => ({
          pendingProposal: r,
          messages: [
            ...state.messages,
            {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              role: 'assistant',
              content: `Proposal ready: ${r.summary}\nType /apply to apply, or /dismiss to discard.`,
            },
          ],
        }));
        break;
      }
    }

    // If the plan verified new assets were produced, jump the user to the relevant page.
    if (result.ok && navigate) {
      const verifiedIdx = [...result.steps]
        .map((s, idx) => ({ s, idx }))
        .reverse()
        .find(x => x.s.tool === 'findAssetsProducedByWorkflowRun' && x.s.status === 'success')?.idx;
      if (typeof verifiedIdx === 'number') {
        const stepDef = plan.steps[verifiedIdx];
        const assetType = String((stepDef?.params as any)?.assetType ?? '');
        const items = Array.isArray((result.steps[verifiedIdx] as any)?.result?.items)
          ? ((result.steps[verifiedIdx] as any).result.items as any[])
          : [];
        if (items.length > 0) {
          const target =
            assetType === 'scene'
              ? 'scenes'
              : assetType === 'shot_plan'
                ? 'shots'
                : assetType === 'canon_text'
                  ? 'canon'
                  : '';
          if (target) navigate(`/projects/${context.projectId}/${target}`);
        }
      }
    }
    set({ status: 'idle' });
    showToast({
      type: wasCancelled ? 'warning' : result.ok ? 'success' : 'error',
      title: wasCancelled ? 'Plan cancelled' : result.ok ? 'Plan completed' : 'Plan failed',
      message: wasCancelled ? 'Execution stopped.' : result.ok ? 'All steps completed.' : result.error || 'Execution failed.',
    });
    if (queryClient && result.ok) {
      queryClient.invalidateQueries({ queryKey: ['project-assets', context.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-workflows', context.projectId] });
    }
  },

  applyPendingProposal: async ({ queryClient, navigate }) => {
    let proposal = get().pendingProposal;
    if (get().status === 'applying') return;

    // Smooth canon flow: if the user has a pending canon draft but no proposal yet,
    // compile it into a strict patch proposal before applying.
    if (!proposal) {
      const draft = get().pendingCanonDraft;
      const ctx = get().lastContext;
      if (draft && ctx?.projectId) {
        set(state => ({
          messages: [
            ...state.messages,
            {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              role: 'assistant',
              content: 'Compiling canon changes into a proposal…',
            },
          ],
        }));

        const req = draft.rootUserRequest || draft.lastUserRequest;
        const compileText = `CANON_COMPILE:\n${req}\n\nDISCUSSION_CONTEXT:\n${draft.transcript}`;
        const nowIso = new Date().toISOString();
        const conversation: CopilotMessage[] = [...get().messages]
          .slice(-12)
          .map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: nowIso }));

        const output = await runCopilotTurn(ctx, compileText, { conversation });
        if (output.assistantMessages.length) {
          set(state => ({
            messages: [
              ...state.messages,
              ...output.assistantMessages.map((content, idx) => ({
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}_${idx}`,
                role: 'assistant' as const,
                content,
              })),
            ],
          }));
        }

        const compiled = (output.skillResult?.proposal ?? null) as Proposal | null;
        if (compiled) {
          set({ pendingProposal: compiled });
          proposal = compiled;
        }
      }
    }

    if (!proposal) {
      showToast({ type: 'warning', title: 'Nothing to apply', message: 'No proposal is ready yet. Type /review first.' });
      set(state => ({
        messages: [
          ...state.messages,
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            content: 'No proposal pending. Type /review to generate one, then /apply.',
          },
        ],
      }));
      return;
    }

    if (typeof window !== 'undefined' && proposal.kind === 'delete_workflow') {
      const ok = window.confirm(
        'Delete this workflow?\n\nThis cannot be undone. Click OK to delete, or Cancel to keep it.'
      );
      if (!ok) return;
    }

    set({ status: 'applying' });
    try {
      set(state => ({
        messages: [
          ...state.messages,
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            content: 'Applying proposal…',
          },
        ],
      }));

      const projectId = get().lastContext?.projectId ?? get().activeProjectId ?? null;
      if (!projectId) throw new Error('Missing projectId for apply.');

      let appliedOk = false;
      let appliedWarning: string | undefined;
      try {
        const res = await applyCopilotProposal({
          projectId,
          proposal: proposal as any,
          confirmed: true,
        });
        appliedOk = Boolean((res.result as any).ok ?? true);
        appliedWarning = typeof (res.result as any).warning === 'string' ? (res.result as any).warning : undefined;
      } catch (err) {
        // Fallback to local apply if backend apply isn't available.
        const local = await applyProposal(proposal);
        appliedOk = Boolean(local.ok);
        appliedWarning = local.warning;
        if (!appliedOk && err) throw err;
      }

      if (!appliedOk) {
        showToast({ type: 'error', title: 'Apply failed', message: appliedWarning || 'Could not apply proposal.' });
        set(state => ({
          messages: [
            ...state.messages,
            {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              role: 'assistant',
              content: `Apply failed: ${appliedWarning || 'Could not apply proposal.'}`,
            },
          ],
        }));
        return;
      }

      if (queryClient && projectId) {
        queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      }

      // Optional navigation (proposal-first UX)
      if ((proposal as any).afterApply?.type === 'navigate') {
        navigate?.((proposal as any).afterApply.path);
      }

      showToast({ type: 'success', title: 'Applied', message: 'Proposal applied successfully.' });
      if (appliedWarning) showToast({ type: 'warning', title: 'Heads up', message: appliedWarning });
      set({ pendingProposal: null, pendingCanonDraft: null });
      set(state => ({
        messages: [
          ...state.messages,
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            content: 'Applied.',
          },
        ],
      }));
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Apply failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      set(state => ({
        messages: [
          ...state.messages,
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            content: `Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          },
        ],
      }));
    } finally {
      set({ status: 'idle' });
    }
  },
}));

// Persist Copilot sessions to localStorage (per-project) so a refresh doesn't lose the conversation
// or the latest proposal/plan. We also best-effort sync this state to the backend so multi-device
// usage can converge, but localStorage remains the fallback.
const persistTimers = new Map<string, number>();
if (typeof window !== 'undefined') {
  useCopilotSessionStore.subscribe(state => {
    const projectId = state.activeProjectId ?? state.lastContext?.projectId ?? null;
    if (!projectId) return;

    const existing = persistTimers.get(projectId);
    if (existing) window.clearTimeout(existing);

    const t = window.setTimeout(() => {
      persistTimers.delete(projectId);
      persistSession(projectId, state);
      // Best-effort backend persistence (localStorage remains fallback).
      void saveCopilotSession(projectId, buildPersistedSession(state) as unknown as Record<string, unknown>).catch(
        () => {}
      );
    }, 200);
    persistTimers.set(projectId, t);
  });
}
