import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  showToast,
  useAppStore,
  useCopilotActionsStore,
  useCopilotSessionStore,
  useDraftStore,
  useSelectionStore,
} from '../../stores';

export function CopilotPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const currentProjectId = useAppStore(s => s.currentProjectId);
  const fallbackProjectId = (() => {
    const m = location.pathname.match(/\/projects\/([^/]+)/);
    return m?.[1] ?? null;
  })();
  const projectId = currentProjectId ?? fallbackProjectId;

  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const selectedNodeId = useSelectionStore(s => s.selectedWorkflowNodeId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedShotPlanAssetId = useSelectionStore(s => s.selectedShotPlanAssetId);
  const requestShotImageGeneration = useCopilotActionsStore(s => s.requestShotImageGeneration);
  const { draft } = useDraftStore();
  const activeNode = draft?.nodes.find(n => n.id === selectedNodeId);

  const input = useCopilotActionsStore(s => s.promptInput);
  const setInput = useCopilotActionsStore(s => s.setPromptInput);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  const {
    status,
    messages,
    shotSuggestion,
    loadSessionForProject,
    sendMessage,
    runActivePlan,
    applyPendingProposal,
    dismissProposal,
    cancelActivePlan,
    clearConversation,
    resetShotPromptState,
    appendAssistantMessage,
  } = useCopilotSessionStore();

  const stripSimpleMarkdown = (text: string) => {
    const input = String(text ?? '');
    if (!input) return '';
    // Preserve code fences, strip only simple emphasis markers elsewhere.
    const parts = input.split(/```/g);
    return parts
      .map((part, idx) => {
        // Odd indices are code blocks.
        if (idx % 2 === 1) return part;
        let t = part;
        t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
        t = t.replace(/\*([^*]+)\*/g, '$1');
        t = t.replace(/__([^_]+)__/g, '$1');
        t = t.replace(/_([^_]+)_/g, '$1');
        return t;
      })
      .join('```');
  };

  const stripLeadingFiller = (text: string) => {
    const t = String(text ?? '');
    if (!t.trim()) return t;
    // Only strip the very common repetitive lead-in phrases.
    return t.replace(/^(okay[, ]+)?i understand[.!]?\s*/i, '').replace(/^let['’]s\s+(focus|refine|tackle)[^.?!]*[.?!]\s*/i, '');
  };

  const formatProposalAsJson = (proposal: any) => {
    if (!proposal || typeof proposal !== 'object') return 'No proposal pending.';
    const kind = String(proposal.kind ?? '');
    const summary = String(proposal.summary ?? '');

    const lines: string[] = [];
    lines.push(`PROPOSAL: ${kind || '(unknown)'}`);
    if (summary) lines.push(`SUMMARY: ${summary}`);

    if (kind === 'asset_patch') {
      if (proposal.assetId) lines.push(`ASSET: ${proposal.assetId}`);
      if (proposal.baseAssetVersionId) lines.push(`BASE_VERSION: ${proposal.baseAssetVersionId}`);
      const patch = Array.isArray(proposal.patch) ? proposal.patch : [];
      lines.push(`PATCH_OPS: ${patch.length}`);
      if (patch.length) {
        lines.push('PATCH_PREVIEW:');
        for (const op of patch.slice(0, 5)) {
          const opStr = String(op?.op ?? '');
          const pathStr = String(op?.path ?? '');
          lines.push(`- ${opStr} ${pathStr}`);
        }
        if (patch.length > 5) lines.push(`(… +${patch.length - 5} more)`);
      }
    } else if (kind === 'asset_update') {
      if (proposal.assetId) lines.push(`ASSET: ${proposal.assetId}`);
      const updates = proposal.updates && typeof proposal.updates === 'object' ? proposal.updates : null;
      if (updates) lines.push(`UPDATES: ${Object.keys(updates).join(', ') || '(none)'}`);
    } else if (kind === 'create_asset') {
      if (proposal.asset_type) lines.push(`ASSET_TYPE: ${proposal.asset_type}`);
      if (proposal.title) lines.push(`TITLE: ${proposal.title}`);
    } else if (kind === 'create_workflow') {
      if (proposal.title) lines.push(`TITLE: ${proposal.title}`);
      const nodes = Array.isArray(proposal.nodes) ? proposal.nodes : [];
      const edges = Array.isArray(proposal.edges) ? proposal.edges : [];
      lines.push(`NODES: ${nodes.length} · EDGES: ${edges.length}`);
    } else if (kind === 'delete_workflow') {
      if (proposal.workflowId) lines.push(`WORKFLOW: ${proposal.workflowId}`);
    }

    // Include a truncated JSON tail for deeper inspection.
    try {
      const json = JSON.stringify(proposal, null, 2);
      const max = 2500;
      const truncated = json.length > max ? `${json.slice(0, max)}\n…(truncated)` : json;
      lines.push('');
      lines.push('JSON:');
      lines.push(truncated);
    } catch {}

    lines.push('');
    lines.push('Next: type /review to preview, /apply to apply, or /dismiss to discard.');
    return lines.join('\n');
  };

  const formatProposalForHuman = (proposal: any) => {
    if (!proposal || typeof proposal !== 'object') return 'No proposal pending.';
    const kind = String(proposal.kind ?? '');
    const summary = String(proposal.summary ?? '');
    const applyStrategy =
      proposal?.metadata && typeof proposal.metadata === 'object' ? String(proposal.metadata.applyStrategy ?? '') : '';

    const lines: string[] = [];
    lines.push(summary ? `Proposal: ${summary}` : `Proposal: ${kind || '(unknown)'}`);
    if (kind !== 'asset_patch') {
      lines.push('');
      lines.push('Preview is only available for asset patch proposals.');
      lines.push('Tip: type /show-proposal for raw JSON.');
      return lines.join('\n');
    }

    const patch = Array.isArray(proposal.patch) ? proposal.patch : [];
    if (patch.length === 0) {
      lines.push('');
      lines.push('No changes in this proposal.');
      return lines.join('\n');
    }

    const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…` : value);
    const formatValue = (value: unknown) => {
      if (typeof value === 'string') return truncate(value.replace(/\s+/g, ' ').trim(), 140);
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) return `[${value.slice(0, 6).map(v => (typeof v === 'string' ? truncate(v, 40) : '…')).join(', ')}${value.length > 6 ? ', …' : ''}]`;
      if (value && typeof value === 'object') return '{…}';
      if (value == null) return 'null';
      return String(value);
    };

    // High-level summary by top-level fields.
    const summarizeOp = (op: any) => {
      const opKind = String(op?.op ?? '');
      const path = String(op?.path ?? '');
      const value = 'value' in (op ?? {}) ? (op as any).value : undefined;
      if (!path.startsWith('/')) return `${opKind} ${path}`;
      const top = path.split('/')[1] ?? '';
      if (!top) return `${opKind} ${path}`;

      if (top === 'summary' || top === 'tone' || top === 'action') return `Set ${top}: ${formatValue(value)}`;
      if (top === 'narration') return `Update narration: ${formatValue(value)}`;
      if (top === 'internal_monologue') return `Update monologue: ${formatValue(value)}`;
      if (top === 'dialogue') return `Update dialogue: ${formatValue(value)}`;
      if (top === 'frame_prompt') return `Update Image Prompt: ${formatValue(value)}`;
      if (top === 'video_prompt') return `Update Video Prompt: ${formatValue(value)}`;
      if (top === 'environment_lock') return `Update Environment Lock: ${formatValue(value)}`;
      if (top === 'source_summary') return `Update Project Summary: ${formatValue(value)}`;
      
      if (top === 'characters' && path === '/characters' && Array.isArray(value)) {
        const names = value
          .map((c: any) => (typeof c === 'string' ? c : typeof c?.name === 'string' ? c.name.trim() : ''))
          .filter(Boolean);
        const preview = names.slice(0, 6).join(', ');
        return `Replace characters (${names.length}): ${preview}${names.length > 6 ? ', …' : ''}`;
      }

      if (top === 'props' && Array.isArray(value)) {
        const preview = value.slice(0, 6).join(', ');
        return `Update Props (${value.length}): ${preview}${value.length > 6 ? ', …' : ''}`;
      }

      if (top === 'themes') return `Set themes (${Array.isArray(value) ? value.length : 0}): ${formatValue(value)}`;
      if (top === 'color_palette' || top === 'colorPalette') return `Set color palette (${Array.isArray(value) ? value.length : 0}): ${formatValue(value)}`;
      if (top === 'world_rules' || top === 'worldRules') return `Set world rules: ${formatValue(value)}`;
      if (top === 'continuity') return `Set continuity (${Array.isArray(value) ? value.length : 0})`;

      if (top === 'character_table' && Array.isArray(value)) {
        return `Update Character Table (${value.length} entries)`;
      }

      if (top === 'characters') {
        const m = path.match(/^\/characters\/(\d+)\/appearance\/(face|hair|clothing|shoes|hat|accessories)$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          const key = m[2];
          const characterNames = (proposal?.metadata?.characterNames || []) as string[];
          const name = characterNames[idx] || '';
          const label = name ? `${name} ${key}` : `character ${idx} ${key}`;
          return `Set ${label}: ${formatValue(value)}`;
        }
        if (/^\/characters\/\d+\/appearance$/.test(path)) {
          return `Update character appearance (${path})`;
        }
      }

      return `${opKind} ${path}${'value' in (op ?? {}) ? ` = ${formatValue(value)}` : ''}`;
    };

    lines.push('');
    lines.push(`Changes (${patch.length}):`);
    for (const op of patch.slice(0, 12)) lines.push(`- ${summarizeOp(op)}`);
    if (patch.length > 12) lines.push(`- (… +${patch.length - 12} more)`);

    // Canon-specific deep preview: show characters when we replace the whole list.
    const replacesCharacters = patch.find((op: any) => String(op?.path ?? '') === '/characters');
    if (applyStrategy === 'canon_update' && replacesCharacters && Array.isArray((replacesCharacters as any).value)) {
      const chars = (replacesCharacters as any).value as any[];
      lines.push('');
      lines.push(`Characters preview (${chars.length}):`);
      for (const c of chars.slice(0, 5)) {
        const name = typeof c?.name === 'string' ? c.name.trim() : '(unnamed)';
        const role = typeof c?.role === 'string' ? c.role.trim() : '';
        const desc = typeof c?.description === 'string' ? c.description.trim() : '';
        lines.push(`- ${name}${role ? ` (${role})` : ''}`);
        if (desc) lines.push(`  - ${truncate(desc.replace(/\s+/g, ' '), 120)}`);
        const appearance = c?.appearance && typeof c.appearance === 'object' && !Array.isArray(c.appearance) ? c.appearance : null;
        if (appearance) {
          const bits = Object.entries(appearance)
            .filter(([, v]) => typeof v === 'string' && String(v).trim())
            .slice(0, 6)
            .map(([k, v]) => `${k}: ${truncate(String(v).trim(), 70)}`);
          if (bits.length) lines.push(`  - appearance: ${bits.join(' · ')}`);
        }
      }
      if (chars.length > 5) lines.push(`- (… +${chars.length - 5} more)`);
      lines.push('');
      lines.push('Tip: if you only want to change one specific character, the proposal should update that character only (not replace the entire list).');
    }

    lines.push('');
    lines.push('Next: /apply to apply, or /dismiss to discard.');
    lines.push('Tip: /show-proposal for raw JSON.');
    return lines.join('\n');
  };

  const formatPlanForChat = (state: ReturnType<typeof useCopilotSessionStore.getState>) => {
    const plan = state.activePlan;
    if (!plan) return 'No active plan.';
    const stepState = new Map((state.planSteps ?? []).map(s => [s.id, s.status]));
    const lines: string[] = [];
    lines.push(`PLAN: ${plan.intent}`);
    if (plan.questions?.length) {
      lines.push('QUESTIONS:');
      for (const q of plan.questions) lines.push(`- ${q.question}`);
      lines.push('');
      lines.push('Reply with your answers to continue.');
      return lines.join('\n');
    }
    if (plan.steps.length) {
      lines.push('STEPS:');
      for (const s of plan.steps) {
        const st = stepState.get(s.id) ?? 'pending';
        lines.push(`- ${s.title} (${s.tool}) — ${st}`);
      }
    }
    lines.push('');
    lines.push(state.status === 'executing' ? 'Plan is running. Type /cancel to stop.' : 'Type /run to execute.');
    return lines.join('\n');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (projectId) loadSessionForProject(projectId);
  }, [projectId, loadSessionForProject]);

  useEffect(() => {
    // Reset shot-prompt state when focus changes to avoid applying the wrong suggestion.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    resetShotPromptState();
  }, [selectedShotId, selectedShotPlanAssetId, resetShotPromptState]);

  const handleSend = async (messageText: string) => {
    if (!projectId) return;
    const trimmed = (messageText || '').trim();
    if (!trimmed) return;

    const context = {
      projectId,
      workflowId: selectedWorkflowId || undefined,
      assetId: selectedAssetId || undefined,
      shotId: selectedShotId || undefined,
      shotPlanAssetId: selectedShotPlanAssetId || undefined,
      selectedNode: activeNode
        ? {
            id: activeNode.id,
            type: activeNode.type,
            label: activeNode.label || activeNode.id,
            params: activeNode.params,
          }
        : undefined,
    };

    if (trimmed.startsWith('/')) {
      const cmdLine = trimmed.slice(1).trim();
      const [cmdNameRaw, ...cmdArgsRaw] = cmdLine.split(/\s+/).filter(Boolean);
      const cmd = (cmdNameRaw || '').toLowerCase();
      const cmdArgs = cmdArgsRaw.map(a => a.toLowerCase());
      if (cmd === 'clear' || cmd === 'quit') {
        clearConversation();
        setInput('');
        return;
      }
      if (
        cmd === 'show-proposal' ||
        cmd === 'proposal' ||
        cmd === 'showproposal'
      ) {
        const state = useCopilotSessionStore.getState();
        appendAssistantMessage(formatProposalAsJson(state.pendingProposal));
        setInput('');
        return;
      }
      if (cmd === 'review' || cmd === 'preview') {
        const state = useCopilotSessionStore.getState();
        const wantsJson = cmdArgs.includes('json') || cmdArgs.includes('raw');
        if (!state.pendingProposal && state.pendingCanonDraft && !wantsJson) {
          const req = state.pendingCanonDraft.rootUserRequest || state.pendingCanonDraft.lastUserRequest;
          const compileText =
            `CANON_COMPILE:\n${req}\n\nDISCUSSION_CONTEXT:\n${state.pendingCanonDraft.transcript}`;
          // Compile into a proposal first, then show the human preview.
          await sendMessage({ messageText: compileText, context, navigate: path => navigate(path), queryClient });
          const after = useCopilotSessionStore.getState();
          appendAssistantMessage(formatProposalForHuman(after.pendingProposal));
        } else {
          appendAssistantMessage(wantsJson ? formatProposalAsJson(state.pendingProposal) : formatProposalForHuman(state.pendingProposal));
        }
        setInput('');
        return;
      }
      if (cmd === 'show-plan' || cmd === 'plan' || cmd === 'showplan') {
        const state = useCopilotSessionStore.getState();
        appendAssistantMessage(formatPlanForChat(state));
        setInput('');
        return;
      }
      if (cmd === 'run') {
        if (status !== 'idle' && status !== 'confirming') return;
        await runActivePlan({ context, queryClient, navigate: path => navigate(path), confirmed: true });
        setInput('');
        return;
      }
      if (cmd === 'cancel') {
        cancelActivePlan();
        setInput('');
        return;
      }
      if (cmd === 'apply') {
        if (status !== 'idle' && status !== 'confirming') return;
        const state = useCopilotSessionStore.getState();
        if (!state.pendingProposal && state.pendingCanonDraft) {
          const req = state.pendingCanonDraft.rootUserRequest || state.pendingCanonDraft.lastUserRequest;
          const compileText =
            `CANON_COMPILE:\n${req}\n\nDISCUSSION_CONTEXT:\n${state.pendingCanonDraft.transcript}`;
          await sendMessage({ messageText: compileText, context, navigate: path => navigate(path), queryClient });
        }
        await applyPendingProposal({ queryClient, navigate: path => navigate(path) });
        setInput('');
        return;
      }
      if (cmd === 'dismiss') {
        if (status !== 'idle' && status !== 'confirming') return;
        dismissProposal();
        setInput('');
        return;
      }
      if (cmd === 'apply+generate' || cmd === 'apply-generate' || cmd === 'apply_generate') {
        if (status !== 'idle' && status !== 'confirming') return;
        if (!shotSuggestion || !selectedShotId) {
          appendAssistantMessage('No shot prompt suggestion available. Ask me to improve the shot prompt first.');
          setInput('');
          return;
        }

        await applyPendingProposal({ queryClient, navigate: path => navigate(path) });
        const { pendingProposal: after } = useCopilotSessionStore.getState();
        if (after) {
          setInput('');
          return;
        }

        const prompt = typeof shotSuggestion.prompt === 'string' ? shotSuggestion.prompt.trim() : '';
        const negative_prompt =
          typeof (shotSuggestion.negative_prompt ?? shotSuggestion.negativePrompt) === 'string'
            ? String(shotSuggestion.negative_prompt ?? shotSuggestion.negativePrompt).trim()
            : '';
        if (!prompt) {
          appendAssistantMessage('Applied, but no prompt was found to generate an image.');
          setInput('');
          return;
        }

        requestShotImageGeneration({
          projectId,
          shotId: selectedShotId,
          prompt,
          negative_prompt: negative_prompt || undefined,
          width: 1280,
          height: 720,
        });
        showToast({ type: 'success', title: 'Generating…', message: 'Generating a new image with the applied prompt.' });
        setInput('');
        return;
      }
      if (cmd === 'status') {
        const state = useCopilotSessionStore.getState();
        const parts: string[] = [];
        parts.push(`Status: ${state.status}`);
        if (state.pendingProposal) parts.push(`Pending proposal: ${state.pendingProposal.kind} · ${state.pendingProposal.summary}`);
        if (state.activePlan) parts.push(`Active plan: ${state.activePlan.intent} (type /run)`);
        if (state.remoteRunId) parts.push('Plan run: executing');
        if (state.shotSuggestion) parts.push('Shot suggestion: ready');
        appendAssistantMessage(parts.join('\n'));
        setInput('');
        return;
      }
    }

    if (status !== 'idle' && status !== 'confirming') return;

    // If a proposal is pending, allow natural-language "review/preview/show proposal" to work without
    // forcing users to remember the exact slash command.
    const proposalState = useCopilotSessionStore.getState();
    if (
      proposalState.pendingProposal &&
      (/\b(review|preview)\b/i.test(trimmed) || (/\b(show|see)\b/i.test(trimmed) && /\bproposal\b/i.test(trimmed)))
    ) {
      appendAssistantMessage(formatProposalForHuman(proposalState.pendingProposal));
      setInput('');
      return;
    }

    setInput('');
    await sendMessage({ messageText: trimmed, context, navigate: path => navigate(path), queryClient });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const isShotsPage = /\/shots(\/|$)/.test(location.pathname);
  const hasShotFocus = Boolean(projectId && selectedShotId);
  const canUseShotPromptCopilot = Boolean(isShotsPage && hasShotFocus && selectedShotPlanAssetId);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3 shrink-0">
        AI Copilot
      </h3>

      <div className="flex-1 min-h-0 overflow-y-auto mb-3 pr-1 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3 text-xs text-[var(--text-secondary)]">
              Hi! Ask me anything about your project, or use a command like <code>/help</code>.
              {canUseShotPromptCopilot && (
                <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Tip: describe what’s wrong with the last shot image, then press Send.
                </div>
              )}
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                Commands: <code>/help</code>, <code>/review</code> (<code>json</code>), <code>/run</code>, <code>/apply</code>, <code>/dismiss</code>, <code>/clear</code>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-br-none'
                      : 'bg-[var(--bg-input)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border)]'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">
                    {msg.role === 'assistant' ? stripLeadingFiller(stripSimpleMarkdown(msg.content)) : msg.content}
                  </span>
                </div>
              </div>
            ))}

            {/* Proposals are surfaced as chat messages (command-first UX). */}
          </>
        )}

        {status === 'planning' && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-input)] rounded-lg rounded-bl-none p-2.5 text-xs text-[var(--text-muted)] flex items-center gap-1.5 border border-[var(--border)]">
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 mt-auto">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={status === 'planning' ? 'AI is thinking...' : 'Ask anything...'}
              disabled={status === 'planning'}
              rows={3}
              onKeyDown={e => {
                if ((e as any).isComposing || (e.nativeEvent as any)?.isComposing) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend((e.currentTarget as HTMLTextAreaElement).value);
                }
              }}
              className="flex-1 px-3 py-2.5 text-xs rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] disabled:opacity-50 disabled:bg-[var(--bg-hover)] placeholder:text-[var(--text-muted)] resize-none"
            />
            <button
              type="submit"
              disabled={status === 'planning' || status === 'executing' || status === 'applying' || !input.trim()}
              className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <p className="mt-1 text-[9px] text-[var(--text-muted)]">Enter to send • Shift+Enter for a new line</p>
        </form>
      </div>
    </div>
  );
}
