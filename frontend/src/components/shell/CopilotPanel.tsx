import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelectionStore, useDraftStore } from '../../stores';
import { parseIntent, executeSkill } from '../../lib/agent/intentParser';
import type { SkillName, SkillResult } from '../../lib/agent/types';

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
  const { projectId } = useParams<{ projectId: string }>();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const selectedNodeId = useSelectionStore(s => s.selectedWorkflowNodeId);
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3 shrink-0">
        AI Copilot
      </h3>

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
