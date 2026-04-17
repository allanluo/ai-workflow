import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showToast, useAppStore, useDraftStore, useSelectionStore } from '../../stores';
import { parseIntent, executeSkill } from '../../lib/agent/intentParser';
import type { Proposal, SkillName, SkillResult } from '../../lib/agent/types';
import { createAssetVersion, fetchAsset } from '../../lib/api';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
  updateShotImageOverrideInPlan,
  writeBackShotPlan,
} from '../../lib/shotPlanEditing';
import { useQueryClient } from '@tanstack/react-query';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const suggestions = [
  { label: 'Create workflow', action: 'Create a workflow for my music video' },
  { label: 'Add scene', action: 'Add a new scene' },
  { label: 'Generate shots', action: 'Generate shots for this scene' },
];

export function CopilotPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = useAppStore(s => s.currentProjectId);
  const fallbackProjectId = (() => {
    const m = location.pathname.match(/\/projects\/([^/]+)/);
    return m?.[1] ?? null;
  })();
  const projectId = currentProjectId ?? fallbackProjectId;
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shotFeedback, setShotFeedback] = useState('');
  const [shotSuggestion, setShotSuggestion] = useState<Record<string, unknown> | null>(null);
  const [shotProposal, setShotProposal] = useState<Proposal | null>(null);
  const [shotContext, setShotContext] = useState<string>('');
  const [isApplyingShotPrompt, setIsApplyingShotPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const selectedNodeId = useSelectionStore(s => s.selectedWorkflowNodeId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedShotPlanAssetId = useSelectionStore(s => s.selectedShotPlanAssetId);
  const { draft } = useDraftStore();

  const activeNode = draft?.nodes.find(n => n.id === selectedNodeId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText: string) => {
    console.log(
      'handleSend called with:',
      messageText,
      'projectId:',
      projectId,
      'isLoading:',
      isLoading
    );
    if (!messageText.trim() || isLoading || !projectId) {
      console.log('Early return - check conditions:', !messageText.trim(), isLoading, !projectId);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('Parsing intent for:', messageText);
      const intent = parseIntent(messageText);
      console.log('Parsed intent:', intent);

      if (intent && intent.confidence > 0.5) {
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

        const { skillResult, shouldChat } = await executeSkill(
          intent.skillName as SkillName,
          context,
          messageText
        );

        const result = skillResult as SkillResult | null;

        if (intent.skillName === 'improveShotPrompt' && result?.success) {
          const data = (result.data ?? {}) as Record<string, unknown>;
          const suggestion = (data.suggestion ?? null) as Record<string, unknown> | null;
          const ctx = typeof data.context === 'string' ? data.context : '';
          if (suggestion) {
            setShotSuggestion(suggestion);
            setShotProposal(result.proposal ?? null);
            setShotContext(ctx);
          }
        }

        if (result?.success && result.action) {
          if (result.action.type === 'navigate') {
            const payload = result.action.payload as { path: string; workflowId?: string };
            if (payload.workflowId) {
              sessionStorage.setItem('pendingWorkflowId', payload.workflowId);
            }
            navigate(payload.path);
          }
        }

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result?.message || 'Done!',
        };
        setMessages(prev => [...prev, aiMessage]);

        if (!result?.success || shouldChat) {
          const response = await callLLM(messageText, userMessage.content);
          if (response) {
            setMessages(prev => [...prev, response]);
          }
        }
      } else {
        const response = await callLLM(messageText, userMessage.content);
        if (response) {
          setMessages(prev => [...prev, response]);
        }
      }
    } catch (error) {
      console.error('Copilot error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error connecting to the AI backend.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const callLLM = async (messageText: string, _userContent: string) => {
    let contextStr = '';
    if (selectedWorkflowId) contextStr += `Workflow ID: ${selectedWorkflowId}\n`;
    if (activeNode) {
      contextStr += `Selected Node: ${activeNode.label || activeNode.id} (Type: ${activeNode.type})\n`;
      contextStr += `Node Params: ${JSON.stringify(activeNode.params)}\n`;
    } else if (selectedAssetId) {
      contextStr += `Selected Asset ID: ${selectedAssetId}\n`;
    }

    const systemPrompt =
      'You are an AI Copilot assisting the user with their AI video and story workflow. Provide brief, helpful answers. When user asks to create workflows, suggest using the action buttons instead.';
    let finalPrompt = systemPrompt + '\n\n';
    if (contextStr) {
      finalPrompt += 'Current User Context:\n' + contextStr + '\n\n';
    }
    finalPrompt += 'User: ' + messageText + '\nAssistant:';

    const response = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:1b',
        prompt: finalPrompt,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);

    const data = await response.json();

    return {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: data.response || 'No response generated.',
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const hasShotFocus = Boolean(projectId && selectedShotId);
  const canUseShotPromptCopilot = Boolean(hasShotFocus && selectedShotPlanAssetId);

  const handleGenerateShotPromptSuggestion = async () => {
    if (!projectId || !selectedShotId || !selectedShotPlanAssetId) return;
    if (isLoading) return;

    setIsLoading(true);
    try {
      const context = {
        projectId,
        workflowId: selectedWorkflowId || undefined,
        assetId: selectedAssetId || undefined,
        shotId: selectedShotId,
        shotPlanAssetId: selectedShotPlanAssetId,
        selectedNode: activeNode
          ? {
              id: activeNode.id,
              type: activeNode.type,
              label: activeNode.label || activeNode.id,
              params: activeNode.params,
            }
          : undefined,
      };

      const { skillResult } = await executeSkill(
        'improveShotPrompt',
        context,
        shotFeedback.trim() || 'The last generated image does not match the intended shot. Improve the prompt.'
      );

      const result = skillResult as SkillResult | null;
      if (!result?.success) {
        showToast({ type: 'error', title: 'Suggestion failed', message: result?.message || 'Failed.' });
        return;
      }

      const data = (result.data ?? {}) as Record<string, unknown>;
      const suggestion = (data.suggestion ?? null) as Record<string, unknown> | null;
      const ctx = typeof data.context === 'string' ? data.context : '';

      if (!suggestion) {
        showToast({ type: 'error', title: 'Suggestion missing', message: 'No suggestion returned.' });
        return;
      }

      setShotSuggestion(suggestion);
      setShotProposal(result.proposal ?? null);
      setShotContext(ctx);
      showToast({ type: 'success', title: 'Suggestion ready', message: 'Review and apply if it looks good.' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Suggestion failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyShotPromptSuggestion = async () => {
    if (!projectId || !selectedShotId || !selectedShotPlanAssetId) return;
    if (!shotSuggestion) return;

    const prompt = typeof shotSuggestion.prompt === 'string' ? shotSuggestion.prompt.trim() : '';
    const negativePrompt =
      typeof shotSuggestion.negative_prompt === 'string' ? shotSuggestion.negative_prompt.trim() : '';
    const promptStructured =
      typeof shotSuggestion.prompt_structured === 'string' ? shotSuggestion.prompt_structured.trim() : '';

    if (!prompt) {
      showToast({ type: 'error', title: 'Missing prompt', message: 'No prompt to apply.' });
      return;
    }

    setIsApplyingShotPrompt(true);
    try {
      const planAsset = await fetchAsset(selectedShotPlanAssetId);
      if (
        shotProposal?.kind === 'asset_patch' &&
        shotProposal.baseAssetVersionId &&
        planAsset.current_asset_version_id !== shotProposal.baseAssetVersionId
      ) {
        showToast({
          type: 'warning',
          title: 'Shot plan changed',
          message: 'The shot plan updated since the suggestion was generated. Re-generate if results look wrong.',
        });
      }

      const parsed = parseShotPlanForEdit(planAsset);
      if (!parsed) {
        showToast({ type: 'error', title: 'Unsupported plan', message: 'This shot plan cannot be edited.' });
        return;
      }

      const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
      ensureShotIdsInPlan(plan, planAsset.id);
      const located = locateShotInPlan(plan, selectedShotId);
      if (!located) {
        showToast({ type: 'error', title: 'Shot not found', message: 'Could not find the selected shot in the plan.' });
        return;
      }

      const image = {
        prompt_structured: promptStructured || undefined,
        prompt,
        negative_prompt: negativePrompt || undefined,
        width: 1280,
        height: 720,
        last_updated_by: 'copilot',
        last_updated_at: new Date().toISOString(),
      };

      updateShotImageOverrideInPlan(plan, located, image);
      const nextContent = writeBackShotPlan(parsed, plan);

      await createAssetVersion(planAsset.id, {
        content: nextContent,
        source_mode: 'copilot',
        status: 'draft',
        make_current: true,
      });

      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'shot'] });
      showToast({ type: 'success', title: 'Applied', message: 'Saved a new shot plan version.' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Apply failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsApplyingShotPrompt(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3 shrink-0">
        AI Copilot
      </h3>

      {projectId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3 text-xs mb-3 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Shot Prompt
            </div>
            <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[180px]">
              {selectedShotId || 'No shot selected'}
            </div>
          </div>

          {!hasShotFocus && (
            <div className="text-[11px] text-[var(--text-muted)]">
              Select a shot in the Shots page, then click “Improve Prompt (Copilot)”.
            </div>
          )}

          {hasShotFocus && !canUseShotPromptCopilot && (
            <div className="text-[11px] text-[var(--text-muted)]">
              Select a shot plan/shot in the Shots page to enable prompt improvement.
            </div>
          )}

          <textarea
            value={shotFeedback}
            onChange={e => setShotFeedback(e.target.value)}
            placeholder='What’s wrong with the last image? (e.g. "Looks like a city street; should be overcast grassland")'
            rows={3}
            className="w-full px-2.5 py-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
            disabled={isLoading || !canUseShotPromptCopilot}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGenerateShotPromptSuggestion}
              disabled={isLoading || !canUseShotPromptCopilot}
              className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40"
            >
              {isLoading ? 'Generating…' : 'Generate Suggestion'}
            </button>
            <button
              type="button"
              onClick={handleApplyShotPromptSuggestion}
              disabled={!shotSuggestion || isApplyingShotPrompt || !canUseShotPromptCopilot}
              className="px-3 py-1.5 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium hover:border-[var(--accent)] disabled:opacity-40"
            >
              {isApplyingShotPrompt ? 'Applying…' : 'Apply'}
            </button>
          </div>

          {shotSuggestion && (
            <details className="pt-1">
              <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                Suggestion
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-[10px] font-medium text-[var(--text-muted)]">Prompt (structured)</div>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-[var(--text-primary)]">
                    {typeof shotSuggestion.prompt_structured === 'string'
                      ? shotSuggestion.prompt_structured
                      : ''}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-[var(--text-muted)]">Prompt (sent to generator)</div>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-[var(--text-primary)]">
                    {typeof shotSuggestion.prompt === 'string' ? shotSuggestion.prompt : ''}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-[var(--text-muted)]">Negative prompt</div>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-[var(--text-primary)]">
                    {typeof shotSuggestion.negative_prompt === 'string'
                      ? shotSuggestion.negative_prompt
                      : ''}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {shotContext && (
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                Context Used
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] text-[var(--text-muted)]">
                {shotContext}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 pr-1 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3 text-xs text-[var(--text-secondary)]">
              Hi! I can help you create workflows, add scenes, generate shots, and answer questions
              about your project. Try saying "Create a workflow for my music video" or use the
              buttons below!
              {(selectedWorkflowId || selectedAssetId) && (
                <div className="mt-2 text-[10px] font-medium text-[var(--accent)]">
                  I can see your selection context and answer questions about it!
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.action)}
                  className="px-2.5 py-1.5 text-[10px] font-medium bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] rounded transition-colors text-[var(--text-secondary)]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-br-none'
                    : 'bg-[var(--bg-input)] text-[var(--text-primary)] rounded-bl-none border border-[var(--border)]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-input)] rounded-lg rounded-bl-none p-2.5 text-xs text-[var(--text-muted)] flex items-center gap-1.5 border border-[var(--border)]">
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 mt-auto">
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isLoading ? 'AI is thinking...' : 'Ask anything...'}
            disabled={isLoading}
            rows={3}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            className="w-full pr-16 px-3 py-2.5 text-xs rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] disabled:opacity-50 disabled:bg-[var(--bg-hover)] placeholder:text-[var(--text-muted)] resize-none"
          />
          <button
            type="button"
            disabled={isLoading || !input.trim()}
            onClick={() => handleSend(input)}
            className="absolute right-2 bottom-2 px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-[9px] text-[var(--text-muted)]">Ctrl+Enter to send</p>
      </div>
    </div>
  );
}
