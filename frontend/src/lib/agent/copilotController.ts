import { parseIntent, executeSkill } from './intentParser';
import type { SkillContext, SkillName, SkillResult } from './types';
import { extractFirstJsonObjectLenient, llmGenerateText } from './llmClient';
import { buildDeterministicCopilotContext, formatCopilotContext } from './context';
import type { CopilotMessage } from './context';
import { createExecutionPlan, type ExecutionPlan } from './planner';
import { getTool } from './tools/registry';
import { appendAuditEvent } from './auditLog';
import { fetchCopilotIndexStatus, reindexCopilotSemanticIndex } from '../api';
import { z } from 'zod';

export type CopilotTurnContext = SkillContext & {
  // UI/selection state can be extended here without changing every skill.
};

export type CopilotTurnOutput = {
  assistantMessages: string[];
  skillResult?: SkillResult | null;
  ui?: {
    intentConfirm?: {
      // The original user request that needs disambiguation (next user reply is treated as confirmation).
      request: string;
    };
    shotPrompt?: {
      suggestion: Record<string, unknown>;
      context: string;
      questions: { id: string; question: string; default?: string }[];
    };
    plan?: ExecutionPlan;
    planContext?: string;
    canonDraft?: {
      canonAssetId: string;
      userRequest: string;
      assistantReply: string;
      updatedAt?: string;
    };
  };
};

const IntentGateSchema = z.object({
  purpose: z.string().default(''),
  mode: z.enum(['discussion', 'plan', 'action']),
  write_intent: z.boolean(),
  target: z
    .enum(['none', 'canon', 'scene', 'shot_plan', 'workflow', 'output', 'run', 'unknown'])
    .default('unknown'),
  confidence: z.number().min(0).max(1),
  confirm_question: z.string().optional(),
});
type IntentGate = z.infer<typeof IntentGateSchema>;

function heuristicIntentGate(userText: string): IntentGate | null {
  const t = (userText || '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();

  const has = (re: RegExp) => re.test(lower);
  const looksLikeCanonFieldEdit =
    has(/\b(allan)\b/) ||
    has(/\bappearance\b/) ||
    has(/\b(face|hair|clothing|shoes|hat|accessories)\s*:/);
  const target: IntentGate['target'] =
    has(/\bcanon\b/) || looksLikeCanonFieldEdit ? 'canon'
    : has(/\b(scene|scenes)\b/) ? 'scene'
    : has(/\b(shot\s*plan|shotplan|shot|shots)\b/) ? 'shot_plan'
    : has(/\bworkflow\b/) ? 'workflow'
    : has(/\boutput\b/) ? 'output'
    : has(/\b(run|rerun)\b/) ? 'run'
    : 'unknown';

  const wantsSteps = has(/\b(plan|steps|step-by-step|roadmap|phases)\b/);
  const asksHow = has(/^(how|why|what|where|when|can you explain|explain)\b/);
  const writeVerbs = has(/\b(update|edit|change|modify|set|replace|apply|save|delete|remove|add|create|generate|redo|fix)\b/);
  const writeIntent =
    has(/\b(update|edit|change|modify|set|replace|apply|save|delete|remove|add)\b/) ||
    (target !== 'unknown' && writeVerbs) ||
    (target === 'canon' && has(/\bunspecified\b/));

  let mode: IntentGate['mode'] = 'discussion';
  let confidence = 0.0;

  if (wantsSteps) {
    mode = 'plan';
    confidence = 0.86;
  } else if (writeVerbs) {
    mode = writeIntent ? 'action' : 'discussion';
    confidence = 0.83;
  } else if (asksHow) {
    mode = 'discussion';
    confidence = 0.78;
  }

  if (confidence < 0.75) return null;
  return {
    purpose: '',
    mode,
    write_intent: Boolean(writeIntent),
    target,
    confidence,
    confirm_question: undefined,
  };
}

function buildIntentGatePrompt(input: { context: string; userText: string }) {
  return [
    'You are an intent classifier for an in-app Copilot.',
    '',
    'Task: Decide whether the user wants: (a) discussion, (b) a plan, or (c) an action.',
    'Also decide whether the user intends to WRITE/UPDATE project data (write_intent).',
    'Also provide a 1-sentence "purpose" describing what the user is trying to achieve.',
    '',
    'Return ONLY valid JSON matching:',
    '{',
    '  "purpose": string,',
    '  "mode": "discussion" | "plan" | "action",',
    '  "write_intent": boolean,',
    '  "target": "none" | "canon" | "scene" | "shot_plan" | "workflow" | "output" | "run" | "unknown",',
    '  "confidence": number,',
    '  "confirm_question": string // optional',
    '}',
    '',
    'Decision guidelines:',
    '- discussion: user wants suggestions, explanations, brainstorming, or Q&A. No project changes.',
    '- plan: user wants a multi-step procedure or workflow run (but not immediate writes).',
    '- action: user wants you to actually change something or produce a proposal/patch.',
    '- write_intent=true only when the user clearly wants to update assets/workflows/settings (or says "update/edit/change/save").',
    '- If ambiguous between discussion vs action (common when user says "should be"), set confidence < 0.7 and provide confirm_question.',
    '- If the user says INTENT_CONFIRMATION, treat it as authoritative.',
    '- If the user says "apply/confirm/go ahead", that is action.',
    '',
    'CONTEXT:',
    input.context,
    '',
    'USER_REQUEST:',
    input.userText,
    '',
    'JSON:',
  ].join('\n');
}

async function classifyIntent(input: { context: string; userText: string }): Promise<IntentGate | null> {
  const heuristic = heuristicIntentGate(input.userText);
  if (heuristic) return heuristic;
  const model =
    (import.meta.env.VITE_COPILOT_INTENT_MODEL as string | undefined) ||
    (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
    'gemma3:1b';
  const prompt = buildIntentGatePrompt(input);
  const raw = await llmGenerateText({ model, prompt, stream: false });
  let parsed: unknown;
  try {
    parsed = extractFirstJsonObjectLenient(raw);
  } catch {
    return null;
  }
  const validated = IntentGateSchema.safeParse(parsed);
  if (!validated.success) return null;
  return validated.data;
}

function splitIntentConfirmation(userText: string): { base: string; confirmation: string | null } {
  const marker = '\nINTENT_CONFIRMATION:\n';
  const idx = userText.indexOf(marker);
  if (idx < 0) return { base: userText, confirmation: null };
  const base = userText.slice(0, idx).trim();
  const confirmation = userText.slice(idx + marker.length).trim();
  return { base, confirmation: confirmation || null };
}

function looksLikeShotPromptFeedback(text: string) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return false;
  if (/\b(add|delete|remove|create)\b.*\bshot\b/.test(t)) return false;
  if (/\b(add|delete|remove|create)\b.*\bscene\b/.test(t)) return false;
  if (t.includes('workflow')) return false;
  if (/(doesn['’]?t\s+match|not\s+match|wrong\s+image|wrong\s+prompt|looks\s+like|should\s+be|instead\s+of)/.test(t))
    return true;
  const keywords = [
    'prompt',
    'image',
    'framing',
    'angle',
    'camera',
    'lighting',
    'overcast',
    'grassland',
    'street',
    'city',
    'sunrise',
    'sunset',
    'watermark',
    'text',
    'logo',
  ];
  return keywords.some(k => t.includes(k));
}

function looksLikeCanonUpdate(text: string) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return false;
  if (t.includes('workflow')) return false;
  if (/\b(generate|extract)\b.*\bcanon\b/.test(t)) return false;
  if (/\bshot\b|\bscene\b/.test(t)) return false;
  if (/\b(update|edit|change|modify)\b.*\bcanon\b/.test(t)) return true;
  // When the canon doc is focused, users often just state facts/constraints.
  if (/\b(should\s+be|is\s+now|must\s+be|age|years\s+old|university\s+student)\b/.test(t)) return true;
  if (/\b(appearance|equipment|locations?|tone|themes?|world\s+rules?)\b/.test(t)) return true;
  return false;
}

function looksLikeChatOnlyQuestion(text: string) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return false;
  // Planner-worthy actions
  if (/\b(create|add|delete|remove|run|execute|generate|extract|reindex|index-status)\b/.test(t)) return false;
  // Canon updates should remain proposal-first when explicitly requested.
  if (/\b(update|edit|change|modify)\b.*\bcanon\b/.test(t)) return false;
  // Suggestion/advice questions should be answered directly.
  if (/\b(suggest|recommend|what\s+should|how\s+should|why|explain)\b/.test(t)) return true;
  if (t.endsWith('?')) return true;
  return false;
}

async function chatFallback(context: SkillContext, userText: string): Promise<string> {
  const ctx = await buildDeterministicCopilotContext({
    skillContext: context,
    selection: {
      workflowId: context.workflowId,
      assetId: context.assetId,
      nodeId: context.selectedNode?.id,
      shotPlanAssetId: context.shotPlanAssetId,
      shotId: context.shotId,
    },
    query: userText,
  });
  const contextStr = formatCopilotContext(ctx);

  const systemPrompt =
    'You are an AI Copilot assisting the user with their AI video and story workflow. Provide brief, helpful answers in plain text (no markdown like ** or *). Do not start with filler like "Okay, I understand"—start directly. When the user asks you to create workflows, suggest using the action buttons.';
  let finalPrompt = systemPrompt + '\n\n';
  if (contextStr) finalPrompt += `Current User Context:\n${contextStr}\n\n`;
  finalPrompt += `User: ${userText}\nAssistant:`;

  const model = (import.meta.env.VITE_COPILOT_MODEL as string | undefined) || 'gemma3:1b';
  return await llmGenerateText({ model, prompt: finalPrompt, stream: false });
}

function attachDiscussionContext(userText: string, conversation: CopilotMessage[]) {
  const lastAssistant = [...(conversation ?? [])]
    .reverse()
    .find(m => m && m.role === 'assistant' && typeof m.content === 'string' && m.content.trim());
  if (!lastAssistant) return userText;
  const snippet = lastAssistant.content.trim().slice(0, 2200);
  return `${userText}\n\nDISCUSSION_CONTEXT:\n${snippet}`;
}

function extractShotPromptUi(skillResult: SkillResult | null | undefined): CopilotTurnOutput['ui'] {
  if (!skillResult?.success) return undefined;
  const data = (skillResult.data ?? {}) as Record<string, unknown>;
  const suggestion = (data.suggestion ?? null) as Record<string, unknown> | null;
  const ctx = typeof data.context === 'string' ? data.context : '';
  if (!suggestion) return undefined;

  const questionsRaw = Array.isArray((suggestion as Record<string, unknown>).questions)
    ? ((suggestion as Record<string, unknown>).questions as unknown[])
    : [];
  const questions = questionsRaw
    .filter(q => q && typeof q === 'object')
    .map(q => q as { id?: unknown; question?: unknown; default?: unknown })
    .map(q => ({
      id: typeof q.id === 'string' ? q.id : '',
      question: typeof q.question === 'string' ? q.question : '',
      default: typeof q.default === 'string' ? q.default : undefined,
    }))
    .filter(q => q.id && q.question)
    .slice(0, 3);

  return { shotPrompt: { suggestion, context: ctx, questions } };
}

function extractCanonDraftUi(skillResult: SkillResult | null | undefined): CopilotTurnOutput['ui'] {
  if (!skillResult?.success) return undefined;
  const data = (skillResult.data ?? {}) as Record<string, unknown>;
  const draft = (data.canonDraft ?? null) as Record<string, unknown> | null;
  if (!draft || typeof draft !== 'object') return undefined;
  const canonAssetId = typeof draft.canonAssetId === 'string' ? draft.canonAssetId : '';
  const userRequest = typeof draft.userRequest === 'string' ? draft.userRequest : '';
  const assistantReply = typeof draft.assistantReply === 'string' ? draft.assistantReply : '';
  const updatedAt = typeof draft.updatedAt === 'string' ? draft.updatedAt : undefined;
  if (!canonAssetId || !userRequest || !assistantReply) return undefined;
  return { canonDraft: { canonAssetId, userRequest, assistantReply, updatedAt } };
}

function formatShotPromptSuggestionForChat(input: {
  suggestion: Record<string, unknown>;
  questions: { id: string; question: string; default?: string }[];
}) {
  const s = input.suggestion as Record<string, unknown>;
  const promptStructured = typeof s.prompt_structured === 'string' ? s.prompt_structured.trim() : '';
  const prompt = typeof s.prompt === 'string' ? s.prompt.trim() : '';
  const negative = typeof s.negative_prompt === 'string' ? s.negative_prompt.trim() : '';

  const parts: string[] = [];
  if (promptStructured) parts.push(`PROMPT_STRUCTURED:\n${promptStructured}`);
  if (prompt) parts.push(`SENT_PROMPT:\n${prompt}`);
  if (negative) parts.push(`NEGATIVE_PROMPT:\n${negative}`);

  if (input.questions?.length) {
    parts.push(
      'QUESTIONS:\n' +
        input.questions
          .map(q => `- ${q.question}${q.default ? ` (default: ${q.default})` : ''}`)
          .join('\n')
    );
    parts.push('Reply with your answers and I will refine the prompt.');
  } else {
    parts.push('Next: type /apply to save this override, or /apply+generate to save + generate a new image.');
  }

  return parts.join('\n\n').trim();
}

function formatPlanForChat(plan: ExecutionPlan) {
  const parts: string[] = [];
  parts.push(`PLAN: ${plan.intent}`);
  if (plan.steps.length) {
    parts.push(
      'STEPS:\n' +
        plan.steps.map(s => `- ${s.title} (${s.tool})`).join('\n')
    );
  }
  if (plan.questions?.length) {
    parts.push('QUESTIONS:\n' + plan.questions.map(q => `- ${q.question}`).join('\n'));
    parts.push('Reply with your answers to continue, or type /show-plan to review the plan first.');
  } else if (plan.steps.length) {
    parts.push('Next: type /run to execute this plan, or /show-plan to review it first.');
  }
  return parts.join('\n\n');
}

function userExplicitlyAskedToApply(text: string) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return false;
  return (
    t === 'apply' ||
    t === 'apply proposal' ||
    /\bapply\b/.test(t) ||
    /\bconfirm\b/.test(t) ||
    /\byes\b/.test(t)
  );
}

function ensurePlanRequiresConfirmation(plan: ExecutionPlan): ExecutionPlan {
  const next = { ...plan };
  const hasNonRead = next.steps.some(step => {
    const tool = getTool(step.tool);
    const category = tool?.category ?? 'exec';
    return category !== 'read';
  });
  if (hasNonRead) next.requires_confirmation = true;
  return next;
}

function stripApplyProposalUnlessExplicit(plan: ExecutionPlan, userText: string): ExecutionPlan {
  if (userExplicitlyAskedToApply(userText)) return plan;
  const nextSteps = plan.steps.filter(s => s.tool !== 'applyProposal');
  if (nextSteps.length === plan.steps.length) return plan;
  return { ...plan, steps: nextSteps, requires_confirmation: false };
}

export async function runCopilotTurn(
  context: CopilotTurnContext,
  userText: string,
  options?: { conversation?: CopilotMessage[] }
): Promise<CopilotTurnOutput> {
  const assistantMessages: string[] = [];
  const conversation = options?.conversation ?? [];
  appendAuditEvent(context.projectId, { type: 'user_message', summary: userText });

  const trimmed = (userText || '').trim();
  if (trimmed.startsWith('/')) {
    const cmdLine = trimmed.slice(1).trim();
    const parts = cmdLine.split(/\s+/).filter(Boolean);
    const [cmdNameRaw, ...cmdArgsRaw] = parts;
    const cmd = (cmdNameRaw || '').toLowerCase();
    if (cmd === 'help' || cmd === '?' || cmd === 'commands') {
      assistantMessages.push(
        [
          'Commands:',
          '- /help',
          '- /status',
          '- /index-status (semantic index coverage)',
          '- /reindex (rebuild semantic index; try /reindex runs or /reindex all)',
          '- /show-plan (preview the current plan)',
          '- /review (or /show-proposal) (preview the pending proposal)',
          '- /review json (raw proposal JSON)',
          '- /run (execute the current plan)',
          '- /cancel (cancel a running plan)',
          '- /apply (apply the pending proposal)',
          '- /dismiss (dismiss the pending proposal)',
          '- /apply+generate (apply shot prompt + generate image)',
          '- /extract-canon',
          '- /update-canon <optional changes>',
          '- /generate-scenes',
          '- /generate-shots',
          '- /create-workflow <optional description>',
          '- /add-scene <optional description>',
          '- /clear (or /quit)',
        ].join('\n')
      );
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      return { assistantMessages, skillResult: null };
    }

    if (cmd === 'index-status') {
      try {
        const status = await fetchCopilotIndexStatus(context.projectId);
        const models = Object.entries(status.models ?? {});
        const lines: string[] = [];
        lines.push(`Semantic index: ${status.total} items indexed.`);
        for (const [model, info] of models) {
          const byType = Object.entries(info.by_context_type ?? {})
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
          lines.push(`- ${model}: ${info.total} (${byType || 'n/a'}) last=${info.last_indexed_at ?? 'n/a'}`);
        }
        assistantMessages.push(lines.join('\n'));
      } catch (err) {
        assistantMessages.push(`Index status failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      return { assistantMessages, skillResult: null };
    }

    if (cmd === 'reindex') {
      try {
        const args = cmdArgsRaw.map(a => a.trim()).filter(Boolean);
        const lowered = args.map(a => a.toLowerCase());

        const takeInt = (v: string | undefined) => {
          if (!v) return undefined;
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
        };

        let maxRuns: number | undefined;
        let maxNodeRunsPerRun: number | undefined;
        for (let i = 0; i < lowered.length; i += 1) {
          const t = lowered[i]!;
          if (t.startsWith('--max-runs=')) maxRuns = takeInt(t.split('=')[1]);
          if (t === '--max-runs') maxRuns = takeInt(lowered[i + 1]);
          if (t.startsWith('--max-node-runs=')) maxNodeRunsPerRun = takeInt(t.split('=')[1]);
          if (t === '--max-node-runs') maxNodeRunsPerRun = takeInt(lowered[i + 1]);
        }

        const hasAll = lowered.includes('all');
        const wantsRun = lowered.includes('run') || lowered.includes('runs');
        const wantsNodeRun =
          lowered.includes('node_run') || lowered.includes('node-run') || lowered.includes('node_runs') || lowered.includes('node-runs');

        const context_types =
          hasAll ? (['asset', 'workflow', 'run', 'node_run'] as const)
          : wantsRun || wantsNodeRun
            ? ([
                ...(wantsRun || lowered.includes('runs') ? (['run'] as const) : []),
                ...(wantsNodeRun || lowered.includes('runs') ? (['node_run'] as const) : []),
              ] as const)
            : undefined;

        const res = await reindexCopilotSemanticIndex({
          projectId: context.projectId,
          context_types: context_types ? [...context_types] : undefined,
          max_runs: maxRuns,
          max_node_runs_per_run: maxNodeRunsPerRun,
        });
        const picked = (res as any)?.picked_model ? ` (model: ${(res as any).picked_model})` : '';
        const types = Array.isArray((res as any)?.types) ? (res as any).types.join(',') : '';
        const limits =
          (res as any)?.max_runs || (res as any)?.max_node_runs_per_run
            ? ` (max_runs=${(res as any)?.max_runs ?? 'n/a'}, max_node_runs_per_run=${(res as any)?.max_node_runs_per_run ?? 'n/a'})`
            : '';
        assistantMessages.push(
          `Queued semantic reindex: ${res.queued} items${picked}${types ? ` (types: ${types})` : ''}${limits}.`
        );
      } catch (err) {
        assistantMessages.push(`Reindex failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      return { assistantMessages, skillResult: null };
    }
  }

  // Internal: compile a canon draft into a strict proposal (used by /review when no proposal exists yet).
  if (trimmed.startsWith('CANON_COMPILE:\n')) {
    const { skillResult } = await executeSkill('updateCanon', context, userText);
    const result = skillResult as SkillResult | null;
    assistantMessages.push(result?.message || 'Ready.');
    if (result?.proposal) appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
    for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
    return { assistantMessages, skillResult: result ?? null };
  }

  const hasShotFocus = Boolean(context.projectId && context.shotId);
  const canUseShotPromptCopilot = Boolean(hasShotFocus && context.shotPlanAssetId);

  const parsedIntent = parseIntent(userText);
  const shouldRunShotPrompt =
    canUseShotPromptCopilot &&
    (parsedIntent?.skillName === 'improveShotPrompt' || (!parsedIntent && looksLikeShotPromptFeedback(userText)));

  if (shouldRunShotPrompt) {
    const { skillResult } = await executeSkill('improveShotPrompt', context, userText);
    const result = skillResult as SkillResult | null;
    const ui = extractShotPromptUi(result);
    assistantMessages.push(result?.message || 'Done!');
    if (ui?.shotPrompt) assistantMessages.push(formatShotPromptSuggestionForChat(ui.shotPrompt));
    if (result?.proposal) {
      appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
    }
    for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
    return { assistantMessages, skillResult: result, ui };
  }

  // Explicit slash commands should run deterministically (no semantic gating).
  if (parsedIntent && trimmed.startsWith('/')) {
    const directProposalSkills = new Set(['createWorkflow', 'addScene']);
    const directPlanSkills = new Set(['generateCanon', 'updateCanon', 'generateScenes', 'generateShotPlans', 'generateShots']);
    if (directProposalSkills.has(parsedIntent.skillName) || directPlanSkills.has(parsedIntent.skillName)) {
      const effectiveInput =
        parsedIntent.skillName === 'updateCanon' ? attachDiscussionContext(userText, conversation) : userText;
      const { skillResult } = await executeSkill(parsedIntent.skillName as SkillName, context, effectiveInput);
      const result = skillResult as SkillResult | null;
      const ui = parsedIntent.skillName === 'updateCanon' ? extractCanonDraftUi(result) : undefined;
      assistantMessages.push(result?.message || 'Ready.');
      if (result?.proposal) appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      if (result?.plan) {
        assistantMessages.push(formatPlanForChat(result.plan));
        for (const msg of assistantMessages.slice(-1)) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
        appendAuditEvent(context.projectId, { type: 'planner_plan', summary: `Plan (skill): ${result.plan.intent}` });
        return { assistantMessages, skillResult: result, ui: { plan: result.plan, planContext: '' } };
      }
      return { assistantMessages, skillResult: result ?? null, ui: ui ?? undefined };
    }
  }

  // Planner-first for everything else. If the planner can't produce an actionable plan, fall back to skills/chat.
  const ctx = await buildDeterministicCopilotContext({
    skillContext: context,
    selection: {
      workflowId: context.workflowId,
      assetId: context.assetId,
      nodeId: context.selectedNode?.id,
      shotPlanAssetId: context.shotPlanAssetId,
      shotId: context.shotId,
    },
    conversation,
    query: userText,
  });
  const contextBlock = formatCopilotContext(ctx);

  // Semantic intent gate: decide discussion vs plan vs action, and whether a write is intended.
  const { base: baseUserText, confirmation } = splitIntentConfirmation(userText);
  const gate = await classifyIntent({ context: contextBlock, userText });
  if (gate && (!gate.confidence || gate.confidence < 0.7) && !confirmation) {
    const purposeLine = gate.purpose ? `Goal I inferred: ${gate.purpose}\n\n` : '';
    const question =
      gate.confirm_question ||
      'Do you want: "discussion" (suggestions only), "plan" (steps), or "action" (make changes / propose a patch)?';
    assistantMessages.push(
      `${purposeLine}${question}\n\nReply with one of: "discussion", "plan", or "action".`
    );
    for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
    return { assistantMessages, skillResult: null, ui: { intentConfirm: { request: baseUserText } } };
  }

  if (gate) {
    // Let the copilot "think first": only run direct skills when the intent gate says
    // the user wants a plan or an action (writes require write_intent=true).
    if (parsedIntent && gate.mode !== 'discussion') {
      const directProposalSkills = new Set(['createWorkflow', 'addScene']);
      const directPlanSkills = new Set(['generateCanon', 'updateCanon', 'generateScenes', 'generateShotPlans', 'generateShots']);
      const allowed =
        gate.mode === 'plan' ||
        (gate.mode === 'action' && gate.write_intent);
      if (allowed && (directProposalSkills.has(parsedIntent.skillName) || directPlanSkills.has(parsedIntent.skillName))) {
        const effectiveInput =
          parsedIntent.skillName === 'updateCanon' ? attachDiscussionContext(baseUserText, conversation) : baseUserText;
        const { skillResult } = await executeSkill(parsedIntent.skillName as SkillName, context, effectiveInput);
        const result = skillResult as SkillResult | null;
        const ui = parsedIntent.skillName === 'updateCanon' ? extractCanonDraftUi(result) : undefined;
        assistantMessages.push(result?.message || 'Ready.');
        if (result?.proposal) appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
        for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
        if (result?.plan) {
          assistantMessages.push(formatPlanForChat(result.plan));
          for (const msg of assistantMessages.slice(-1)) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
          appendAuditEvent(context.projectId, { type: 'planner_plan', summary: `Plan (skill): ${result.plan.intent}` });
          return { assistantMessages, skillResult: result, ui: { plan: result.plan, planContext: '' } };
        }
        return { assistantMessages, skillResult: result ?? null, ui: ui ?? undefined };
      }
    }

    if (gate.mode === 'discussion' || (gate.mode === 'action' && !gate.write_intent)) {
      if (gate.target === 'canon') {
        const effectiveInput = attachDiscussionContext(baseUserText, conversation);
        const { skillResult } = await executeSkill('updateCanon', context, effectiveInput);
        const result = skillResult as SkillResult | null;
        const ui = extractCanonDraftUi(result);
        assistantMessages.push(result?.message || 'Got it.');
        for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
        return { assistantMessages, skillResult: result ?? null, ui: ui ?? undefined };
      }
      const msg = await chatFallback(context, baseUserText);
      assistantMessages.push(msg);
      for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
      return { assistantMessages, skillResult: null };
    }

    if (gate.mode === 'action' && gate.write_intent && gate.target === 'canon') {
      const effectiveInput = attachDiscussionContext(baseUserText, conversation);
      const { skillResult } = await executeSkill('updateCanon', context, effectiveInput);
      const result = skillResult as SkillResult | null;
      const ui = extractCanonDraftUi(result);
      assistantMessages.push(result?.message || 'Ready.');
      if (result?.proposal) appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
      for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
      if (result?.plan) {
        assistantMessages.push(formatPlanForChat(result.plan));
        for (const m of assistantMessages.slice(-1)) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
        appendAuditEvent(context.projectId, { type: 'planner_plan', summary: `Plan (skill): ${result.plan.intent}` });
        return { assistantMessages, skillResult: result, ui: { plan: result.plan, planContext: '' } };
      }
      return { assistantMessages, skillResult: result ?? null, ui: ui ?? undefined };
    }
  } else if (looksLikeChatOnlyQuestion(userText)) {
    // Non-semantic fallback.
    const msg = await chatFallback(context, userText);
    assistantMessages.push(msg);
    for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
    return { assistantMessages, skillResult: null };
  }

  const planned = await createExecutionPlan({ userText, context: contextBlock, toolContext: context });
  if (planned.ok) {
    const sanitized = stripApplyProposalUnlessExplicit(planned.plan, userText);
    const plan = ensurePlanRequiresConfirmation(sanitized);
    const hasQuestions = Boolean(plan.questions?.length);
    const hasSteps = plan.steps.length > 0;

    // If the planner only returns a "questions-only" plan with no steps, it’s usually a sign it
    // didn’t understand the user question. Prefer a direct chat response instead of stalling.
    if (hasQuestions && !hasSteps) {
      const msg = await chatFallback(context, userText);
      assistantMessages.push(msg);
      for (const m of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: m });
      return { assistantMessages, skillResult: null };
    }

    appendAuditEvent(context.projectId, {
      type: 'planner_plan',
      summary: `Plan: ${plan.intent}`,
    });
    if (hasQuestions) {
      assistantMessages.push(formatPlanForChat(plan));
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      return {
        assistantMessages,
        skillResult: null,
        ui: { plan, planContext: contextBlock },
      };
    }

    if (hasSteps) {
      assistantMessages.push(formatPlanForChat(plan));
      for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
      return {
        assistantMessages,
        skillResult: null,
        ui: { plan, planContext: contextBlock },
      };
    }
  }

  // If planner didn't produce a plan, try skill routing as a fallback.
  if (parsedIntent && parsedIntent.confidence > 0.5) {
    const { skillResult, shouldChat } = await executeSkill(
      parsedIntent.skillName as SkillName,
      context,
      userText
    );
    const result = skillResult as SkillResult | null;
    assistantMessages.push(result?.message || 'Done!');
    const ui = parsedIntent.skillName === 'improveShotPrompt' ? extractShotPromptUi(result) : undefined;

    if (!result?.success || shouldChat) {
      const chat = await chatFallback(context, userText);
      if (chat.trim()) assistantMessages.push(chat.trim());
    }

    if (result?.proposal) {
      appendAuditEvent(context.projectId, { type: 'proposal_created', summary: result.proposal.summary });
    }
    for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
    return { assistantMessages, skillResult: result, ui };
  }

  const chat = await chatFallback(context, userText);
  assistantMessages.push(chat.trim() || 'No response generated.');
  for (const msg of assistantMessages) appendAuditEvent(context.projectId, { type: 'assistant_message', summary: msg });
  return { assistantMessages, skillResult: null };
}
