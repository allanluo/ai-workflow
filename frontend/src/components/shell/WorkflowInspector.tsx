import { type ReactNode, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkflowById,
  fetchWorkflowVersions,
  fetchProjectWorkflowRuns,
  fetchNodeRuns,
  updateWorkflow,
  validateWorkflow,
  createWorkflowVersion,
  type WorkflowDefinition,
  type WorkflowVersion,
  type WorkflowValidation,
  type NodeRun,
} from '../../lib/api';
import {
  getWorkflowNodeDefinition,
  workflowNodeCatalog,
  type WorkflowNodeCategory,
} from '../../lib/workflowCatalog';
import { showToast, useAppStore, useSelectionStore } from '../../stores';

import {
  useDraftStore,
  buildWorkflowPayload,
  type WorkflowDraftState,
  type EditableNode,
  type EditableEdge,
} from '../../stores/draftStore';

const categoryLabels: Record<WorkflowNodeCategory, string> = {
  input: 'Inputs',
  planning: 'Planning',
  generation: 'Generation',
  validation: 'Validation',
  assembly: 'Assembly',
  export: 'Export',
};

function updateEdgeField(
  edges: EditableEdge[],
  index: number,
  field: keyof EditableEdge,
  value: string
): EditableEdge[] {
  return edges.map((e, i) => (i === index ? { ...e, [field]: value } : e));
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNumber(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
      {children}
    </span>
  );
}

function inputCls() {
  return 'w-full rounded border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]';
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}) {
  const cls = {
    neutral: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
    info: 'bg-blue-900/50 text-blue-300',
    warning: 'bg-amber-900/50 text-amber-300',
    success: 'bg-[var(--success)]/20 text-[var(--success)]',
    danger: 'bg-red-900/50 text-red-300',
  }[tone];
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function VersionRow({ version }: { version: WorkflowVersion }) {
  return (
    <div className="rounded-xl border border-[var(--200 bg-[var(--bg-input)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          v{version.version_number}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          {new Date(version.created_at).toLocaleDateString()}
        </span>
      </div>
      {version.notes && (
        <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{version.notes}</p>
      )}
    </div>
  );
}

function NodeConfigEditor({
  node,
  latestNodeRun,
  availableIds = [],
  onChange,
}: {
  node: EditableNode;
  latestNodeRun?: NodeRun;
  availableIds?: string[];
  onChange: (node: EditableNode) => void;
}) {
  const cls = inputCls();

  if (node.type === 'asset_review') {
    // Look for 'text' in the output snapshot
    const runOutput = asString((latestNodeRun?.output_snapshot as any)?.text);
    const hasExistingEdit = Boolean(asString(node.params.edited_text));
    const queryClient = useQueryClient();

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Label>Review & Edit Content</Label>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['project-runs'] });
                queryClient.invalidateQueries({ queryKey: ['node-runs'] });
                showToast({
                  type: 'info',
                  title: 'Refreshing',
                  message: 'Checking for new run results...',
                });
              }}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200"
              title="Refresh results from server"
            >
              REFRESH DATA
            </button>
            <div className="text-[8px] text-red-500 font-mono leading-none flex flex-col items-end">
              <span>Local ID: {node.id.slice(0, 8)}...</span>
              <span>API IDs: {availableIds.map(id => id.slice(0, 8)).join(', ') || 'NONE'}</span>
            </div>
          </div>
          {runOutput && !hasExistingEdit && (
            <button
              onClick={() =>
                onChange({ ...node, params: { ...node.params, edited_text: runOutput } })
              }
              className="text-[10px] text-[var(--accent)] font-medium hover:underline"
            >
              Populate from Run
            </button>
          )}
        </div>
        <textarea
          value={asString(node.params.edited_text) || runOutput}
          onChange={e =>
            onChange({ ...node, params: { ...node.params, edited_text: e.target.value } })
          }
          rows={10}
          placeholder={
            runOutput
              ? 'Showing output from last run...'
              : 'Will be populated after the next successful run...'
          }
          className={cls}
        />
        {latestNodeRun && (
          <p className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            Connected to run {latestNodeRun.workflow_run_id.slice(0, 8)}
          </p>
        )}
        <p className="mt-2 text-[10px] text-[var(--text-muted)] italic">
          Manual edits here will override automated outputs for subsequent nodes.
        </p>
      </div>
    );
  }

  if (node.type === 'input') {
    return (
      <div>
        <Label>Input Text</Label>
        <textarea
          value={asString(node.params.text)}
          onChange={e => onChange({ ...node, params: { ...node.params, text: e.target.value } })}
          rows={4}
          className={cls}
        />
      </div>
    );
  }

  if (node.type === 'llm_text') {
    return (
      <div className="space-y-3">
        <div>
          <Label>Prompt</Label>
          <textarea
            value={asString(node.params.prompt)}
            onChange={e =>
              onChange({ ...node, params: { ...node.params, prompt: e.target.value } })
            }
            rows={5}
            className={cls}
          />
        </div>
        <div>
          <Label>Model</Label>
          <input
            value={asString(node.params.model)}
            onChange={e => onChange({ ...node, params: { ...node.params, model: e.target.value } })}
            className={cls}
          />
        </div>
      </div>
    );
  }

  if (node.type === 'image_generation' || node.type === 'video_generation') {
    return (
      <div className="space-y-3">
        <div>
          <Label>Prompt</Label>
          <textarea
            value={asString(node.params.prompt)}
            onChange={e =>
              onChange({ ...node, params: { ...node.params, prompt: e.target.value } })
            }
            rows={4}
            className={cls}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Width</Label>
            <input
              type="number"
              value={asNumber(node.params.width)}
              onChange={e =>
                onChange({ ...node, params: { ...node.params, width: Number(e.target.value) } })
              }
              className={cls}
            />
          </div>
          <div>
            <Label>Height</Label>
            <input
              type="number"
              value={asNumber(node.params.height)}
              onChange={e =>
                onChange({ ...node, params: { ...node.params, height: Number(e.target.value) } })
              }
              className={cls}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <p className="rounded-xl bg-[var(--bg-input)] px-3 py-3 text-xs text-[var(--text-muted)]">
      Uses workflow-level defaults and connection metadata.
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkflowInspector({ workflowId }: { workflowId: string }) {
  const queryClient = useQueryClient();
  const projectId = useAppStore(s => s.currentProjectId);
  const { draft, setDraft } = useDraftStore();
  const [freezeNotes, setFreezeNotes] = useState('');
  const [lastValidation, setLastValidation] = useState<WorkflowValidation | null>(null);
  const [activeSection, setActiveSection] = useState<
    'settings' | 'steps' | 'connections' | 'json' | 'versions'
  >('settings');
  const selectedNodeId = useSelectionStore(s => s.selectedWorkflowNodeId);
  const prevSelectedNodeIdRef = useRef(selectedNodeId);

  console.log('WorkflowInspector render - selectedNodeId:', selectedNodeId);

  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== prevSelectedNodeIdRef.current) {
      setActiveSection('steps');
      prevSelectedNodeIdRef.current = selectedNodeId;
      setTimeout(() => {
        const el = document.getElementById(`node-config-${selectedNodeId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.animate(
            [{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }, { backgroundColor: '#f8fafc' }],
            { duration: 1500 }
          );
        }
      }, 100);
    }
  }, [selectedNodeId]);

  const workflowQuery = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => fetchWorkflowById(workflowId),
    enabled: Boolean(workflowId),
  });

  const derivedProjectId = projectId || workflowQuery.data?.project_id;

  const versionsQuery = useQuery({
    queryKey: ['workflow-versions', workflowId],
    queryFn: () => fetchWorkflowVersions(workflowId),
    enabled: Boolean(workflowId),
  });

  const runsQuery = useQuery({
    queryKey: ['project-runs', derivedProjectId],
    queryFn: () => fetchProjectWorkflowRuns(derivedProjectId as string),
    enabled: Boolean(derivedProjectId),
  });

  // No local draft hydration needed; it's handled by WorkflowsTab and draftStore

  // Get all runs and sort by date descending to get the latest first
  const allRuns = [...(runsQuery.data ?? [])].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
  const latestRunId = allRuns[0]?.id;

  console.log(
    '[Inspector] latestRunId:',
    latestRunId,
    'allRuns:',
    allRuns.length,
    'versions:',
    versionsQuery.data?.length
  );

  const nodeRunsQuery = useQuery({
    queryKey: ['node-runs', latestRunId],
    queryFn: () => (latestRunId ? fetchNodeRuns(latestRunId) : Promise.resolve([])),
    enabled: Boolean(latestRunId),
  });

  console.log(
    '[Inspector] nodeRunsQuery.data:',
    nodeRunsQuery.data?.length,
    'isLoading:',
    nodeRunsQuery.isLoading,
    'data:',
    nodeRunsQuery.data
  );

  const updateMutation = useMutation({
    mutationFn: updateWorkflow,
    onSuccess: wf => {
      queryClient.invalidateQueries({ queryKey: ['workflow', wf.id] });
      queryClient.invalidateQueries({ queryKey: ['project-workflows', derivedProjectId] });
      // We don't need to manually setDraft here because it's handled globally, but we could update to latest if needed.
      showToast({ type: 'success', title: 'Draft saved', message: wf.title });
    },
    onError: err =>
      showToast({
        type: 'error',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      }),
  });

  const validateMutation = useMutation({
    mutationFn: validateWorkflow,
    onSuccess: v => {
      setLastValidation(v);
      showToast({
        type: v.status === 'fail' ? 'error' : v.status === 'warn' ? 'warning' : 'success',
        title: 'Validation complete',
        message:
          v.status === 'pass'
            ? 'Passed'
            : `${v.errors.length} error(s), ${v.warnings.length} warning(s)`,
      });
    },
  });

  const freezeMutation = useMutation({
    mutationFn: createWorkflowVersion,
    onSuccess: v => {
      queryClient.invalidateQueries({ queryKey: ['workflow-versions', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      setFreezeNotes('');
      showToast({ type: 'success', title: 'Version frozen', message: `v${v.version_number}` });
    },
    onError: err =>
      showToast({
        type: 'error',
        title: 'Freeze failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      }),
  });

  async function handleSave() {
    if (!draft) return;
    console.log(
      'Inspector Save - saving nodes:',
      draft.nodes?.length,
      'edges:',
      draft.edges?.length
    );
    const payload = buildWorkflowPayload(draft);
    await updateMutation.mutateAsync({ workflowId, ...payload });
  }

  async function handleValidate() {
    await handleSave();
    await validateMutation.mutateAsync(workflowId);
  }

  async function handleFreeze() {
    await handleSave();
    await freezeMutation.mutateAsync({
      workflowId,
      notes: freezeNotes.trim() || 'Frozen from inspector',
    });
  }

  if (workflowQuery.isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading workflow...</p>;
  }

  if (!draft) {
    return <p className="text-sm text-[var(--text-muted)]">No workflow data.</p>;
  }

  const sectionTabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'steps', label: 'Steps' },
    { id: 'connections', label: 'Edges' },
    { id: 'json', label: 'JSON' },
    { id: 'versions', label: 'Versions' },
  ] as const;

  return (
    <div className="flex flex-col gap-4 text-sm bg-[var(--bg-base)] p-3 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Workflow
        </p>
        <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)] leading-tight">
          {draft.title}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusPill label={draft.status} tone="neutral" />
          <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            {draft.nodes.length} nodes · {draft.edges.length} edges
          </span>
          <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            {versionsQuery.data?.length ?? 0} versions · {allRuns.length} runs
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--bg-hover)] p-1">
        {sectionTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 rounded py-1 text-[11px] font-semibold transition ${
              activeSection === tab.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Settings ── */}
      {activeSection === 'settings' && (
        <div className="space-y-4">
          <Section title="Core Settings">
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <input
                  value={draft.title}
                  onChange={e => setDraft(d => (d ? { ...d, title: e.target.value } : d))}
                  className={inputCls()}
                />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(d => (d ? { ...d, description: e.target.value } : d))}
                  rows={4}
                  className={inputCls()}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Status</Label>
                  <select
                    value={draft.status}
                    onChange={e =>
                      setDraft(d =>
                        d ? { ...d, status: e.target.value as WorkflowDraftState['status'] } : d
                      )
                    }
                    className={inputCls()}
                  >
                    <option value="draft">Draft</option>
                    <option value="testing">Testing</option>
                    <option value="approved">Approved</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>
                <div>
                  <Label>Template</Label>
                  <input
                    value={draft.templateType}
                    onChange={e => setDraft(d => (d ? { ...d, templateType: e.target.value } : d))}
                    className={inputCls()}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Freeze Notes">
            <textarea
              value={freezeNotes}
              onChange={e => setFreezeNotes(e.target.value)}
              rows={4}
              placeholder="Describe what changed and why this is ready to freeze…"
              className={inputCls()}
            />
          </Section>

          {lastValidation && (
            <Section title="Last Validation">
              <div className="space-y-2">
                <StatusPill
                  label={
                    lastValidation.status === 'pass'
                      ? 'Pass'
                      : lastValidation.status === 'warn'
                        ? 'Warn'
                        : 'Fail'
                  }
                  tone={
                    lastValidation.status === 'pass'
                      ? 'success'
                      : lastValidation.status === 'warn'
                        ? 'warning'
                        : 'danger'
                  }
                />
                {lastValidation.errors.map(e => (
                  <p
                    key={e}
                    className="rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300"
                  >
                    {e}
                  </p>
                ))}
                {lastValidation.warnings.map(w => (
                  <p
                    key={w}
                    className="rounded border border-amber-800 bg-amber-900/30 px-3 py-2 text-xs text-amber-300"
                  >
                    {w}
                  </p>
                ))}
                {lastValidation.errors.length === 0 && lastValidation.warnings.length === 0 && (
                  <p className="rounded border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300">
                    Passed without warnings.
                  </p>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Steps (nodes) ── */}
      {activeSection === 'steps' && (
        <div className="space-y-3">
          {draft.nodes.map((node, index) => {
            const definition = getWorkflowNodeDefinition(node.catalogType);
            return (
              <div
                id={`node-config-${node.id}`}
                key={node.id}
                className={`rounded-lg border p-3 space-y-3 transition-colors ${
                  selectedNodeId === node.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm ring-1 ring-[var(--accent)]/20'
                    : 'border-[var(--border)] bg-[var(--bg-input)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {definition?.title ?? node.label ?? node.type}
                    </span>
                    <span className="ml-2 text-[10px] text-[var(--text-muted)]">
                      {definition ? categoryLabels[definition.category] : node.type}
                    </span>
                    <div className="mt-1 text-[9px] text-[var(--text-muted)] font-mono opacity-50">
                      ID: {node.id} | TYPE: {node.type}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setDraft(d =>
                        d
                          ? {
                              ...d,
                              nodes: d.nodes.filter((_, i) => i !== index),
                              edges: d.edges.filter(
                                e => e.source !== node.id && e.target !== node.id
                              ),
                            }
                          : d
                      )
                    }
                    disabled={draft.nodes.length === 1}
                    className="rounded border border-[var(--error)] px-2 py-0.5 text-[10px] font-medium text-[var(--error)] hover:bg-[var(--error)]/20 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label>Step Type</Label>
                    <select
                      value={node.catalogType}
                      onChange={e => {
                        const def = getWorkflowNodeDefinition(e.target.value);
                        if (!def) return;
                        setDraft(d =>
                          d
                            ? {
                                ...d,
                                nodes: d.nodes.map((n, i) =>
                                  i === index
                                    ? {
                                        ...n,
                                        type: def.runtimeType,
                                        catalogType: e.target.value,
                                        label: def.defaultLabel,
                                      }
                                    : n
                                ),
                              }
                            : d
                        );
                      }}
                      className={inputCls()}
                    >
                      {workflowNodeCatalog.map(entry => (
                        <option key={entry.key} value={entry.key}>
                          {entry.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Label</Label>
                    <input
                      value={node.label}
                      onChange={e =>
                        setDraft(d =>
                          d
                            ? {
                                ...d,
                                nodes: d.nodes.map((n, i) =>
                                  i === index ? { ...n, label: e.target.value } : n
                                ),
                              }
                            : d
                        )
                      }
                      className={inputCls()}
                    />
                  </div>
                </div>

                <NodeConfigEditor
                  node={node}
                  latestNodeRun={nodeRunsQuery.data?.find((nr: NodeRun) => nr.node_id === node.id)}
                  availableIds={nodeRunsQuery.data?.map((nr: NodeRun) => nr.node_id) || []}
                  onChange={nextNode =>
                    setDraft(d =>
                      d ? { ...d, nodes: d.nodes.map((n, i) => (i === index ? nextNode : n)) } : d
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Connections ── */}
      {activeSection === 'connections' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              {draft.edges.length} connection{draft.edges.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() =>
                setDraft(d =>
                  d
                    ? {
                        ...d,
                        edges: [
                          ...d.edges,
                          {
                            id: `edge-${d.edges.length + 1}`,
                            source: d.nodes[0]?.id ?? '',
                            target: d.nodes[1]?.id ?? d.nodes[0]?.id ?? '',
                          },
                        ],
                      }
                    : d
                )
              }
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            ></button>
          </div>
          {draft.edges.map((edge, index) => (
            <div
              key={edge.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>From</Label>
                  <select
                    value={edge.source}
                    onChange={e =>
                      setDraft(d =>
                        d
                          ? {
                              ...d,
                              edges: updateEdgeField(d.edges, index, 'source', e.target.value),
                            }
                          : d
                      )
                    }
                    className={inputCls()}
                  >
                    {draft.nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.label || n.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>To</Label>
                  <select
                    value={edge.target}
                    onChange={e =>
                      setDraft(d =>
                        d
                          ? {
                              ...d,
                              edges: updateEdgeField(d.edges, index, 'target', e.target.value),
                            }
                          : d
                      )
                    }
                    className={inputCls()}
                  >
                    {draft.nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.label || n.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() =>
                  setDraft(d => (d ? { ...d, edges: d.edges.filter((_, i) => i !== index) } : d))
                }
                className="text-[10px] font-medium text-rose-500 hover:text-rose-700"
              >
                Remove
              </button>
            </div>
          ))}
          {draft.edges.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
              No connections defined.
            </p>
          )}
        </div>
      )}

      {/* ── JSON ── */}
      {activeSection === 'json' && (
        <div className="space-y-4">
          <Section title="Defaults JSON">
            <textarea
              value={draft.defaultsText}
              onChange={e => setDraft(d => (d ? { ...d, defaultsText: e.target.value } : d))}
              rows={10}
              className="w-full rounded-xl border border-[var(--200 bg-[var(--bg-input)] px-3 py-3 font-mono text-xs outline-none transition focus:border-[var(--400 focus:bg-white"
            />
          </Section>
          <Section title="Metadata JSON">
            <textarea
              value={draft.metadataText}
              onChange={e => setDraft(d => (d ? { ...d, metadataText: e.target.value } : d))}
              rows={10}
              className="w-full rounded-xl border border-[var(--200 bg-[var(--bg-input)] px-3 py-3 font-mono text-xs outline-none transition focus:border-[var(--400 focus:bg-white"
            />
          </Section>
        </div>
      )}

      {/* ── Versions ── */}
      {activeSection === 'versions' && (
        <div className="space-y-2">
          {versionsQuery.isLoading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading…</p>
          ) : versionsQuery.data && versionsQuery.data.length > 0 ? (
            versionsQuery.data.map(v => <VersionRow key={v.id} version={v} />)
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
              No frozen versions yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
