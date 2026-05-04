import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  API_BASE_URL,
  createWorkflow,
  createWorkflowRunDirect,
  createWorkflowVersion,
  deleteWorkflow,
  fetchNodeRuns,
  fetchProjectWorkflowRuns,
  fetchProjectWorkflows,
  fetchWorkflowById,
  fetchWorkflowVersions,
  updateWorkflow,
  validateWorkflow,
  type NodeRun,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowValidation,
  type WorkflowVersion,
} from '../lib/api';
import {
  createWorkflowDraftFromTemplate,
  createWorkflowNodeFromCatalog,
  getWorkflowNodeDefinition,
  workflowNodeCatalog,
  workflowTemplateCatalog,
  type WorkflowNodeCategory,
} from '../lib/workflowCatalog';
import { useProjectEvents, useWorkflowProgress } from '../lib/useProjectEvents';
import { showToast, useSelectionStore, usePanelStore } from '../stores';
import { WorkflowVersionsPanel } from './WorkflowsPage/WorkflowVersionsPanel';
import { AudioSegmentsPlayer } from '../components/common';

interface WorkflowsTabProps {
  projectId: string;
}

import {
  useDraftStore,
  type EditableNode,
  type EditableEdge,
  type WorkflowDraftState,
  toDraftState,
  serializeDraft,
  buildWorkflowPayload,
  toEditableNode,
  toEditableEdge,
  getEditableNodeDefinition,
} from '../stores/draftStore';

const WORKFLOW_NODE_DRAG_MIME = 'application/x-ai-workflow-node';

const categoryLabels: Record<WorkflowNodeCategory, string> = {
  input: 'Inputs',
  planning: 'Planning',
  generation: 'Generation',
  validation: 'Validation',
  assembly: 'Assembly',
  export: 'Export',
};

const categoryGlyphs: Record<WorkflowNodeCategory, string> = {
  input: 'I',
  planning: 'P',
  generation: 'G',
  validation: 'V',
  assembly: 'A',
  export: 'E',
};

function workflowDocumentSelectLabel(wf: WorkflowDefinition) {
  const nodeCount = Array.isArray(wf.nodes) ? wf.nodes.length : 0;
  const dateStr = wf.updated_at ? new Date(wf.updated_at).toLocaleDateString() : '';
  return `${wf.title} · ${nodeCount} nodes · ${wf.mode} · ${dateStr}`;
}

function getWorkflowTemplateKey(wf: WorkflowDefinition): string | null {
  const meta = (wf.metadata ?? {}) as Record<string, unknown>;
  const editorTemplate = typeof meta.editor_template === 'string' ? meta.editor_template : null;
  return editorTemplate;
}

function dedupeWorkflowsForPicker(list: WorkflowDefinition[]) {
  // Collapse accidental duplicates from repeatedly clicking a template:
  // keep the newest workflow per (title + editor_template) pair.
  const byKey = new Map<string, WorkflowDefinition>();
  const passthrough: WorkflowDefinition[] = [];

  for (const wf of list) {
    const tpl = getWorkflowTemplateKey(wf);
    if (!tpl) {
      passthrough.push(wf);
      continue;
    }

    const key = `${tpl}::${wf.title ?? ''}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, wf);
      continue;
    }

    const existingTime = new Date(existing.updated_at).getTime();
    const nextTime = new Date(wf.updated_at).getTime();
    if (Number.isFinite(nextTime) && (nextTime > existingTime || !Number.isFinite(existingTime))) {
      byKey.set(key, wf);
    }
  }

  const collapsed = Array.from(byKey.values());
  const combined = [...passthrough, ...collapsed];
  combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return combined;
}

function WorkflowDocumentPicker({
  workflows,
  isLoading,
  isError,
  allowEmptySelection,
  selectedWorkflowId,
  onSelectWorkflowId,
  onAddDefault,
  onDeleteSelected,
  addPending,
  deletePending,
  className = 'p-4 border-b border-comfy-border',
  showDelete = true,
}: {
  workflows: WorkflowDefinition[] | undefined;
  isLoading: boolean;
  isError: boolean;
  allowEmptySelection: boolean;
  selectedWorkflowId: string | null;
  onSelectWorkflowId: (id: string | null) => void;
  onAddDefault: () => void;
  onDeleteSelected?: () => void;
  addPending: boolean;
  deletePending: boolean;
  className?: string;
  showDelete?: boolean;
}) {
  const list = dedupeWorkflowsForPicker(workflows ?? []);
  const hasRows = list.length > 0;
  const selectDisabled = isLoading || isError || !hasRows;
  const selectValue =
    allowEmptySelection && !selectedWorkflowId
      ? ''
      : (selectedWorkflowId ?? list[0]?.id ?? '');

  return (
    <div className={className}>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-comfy-muted mb-2">Workflow document</div>
          <select
            className="comfy-input w-full text-xs"
            disabled={selectDisabled}
            value={hasRows ? selectValue : ''}
            onChange={e => {
              const v = e.target.value;
              onSelectWorkflowId(v ? v : null);
            }}
          >
            {allowEmptySelection && hasRows && <option value="">Select a workflow…</option>}
            {!hasRows ? (
              <option value="">{isLoading ? 'Loading…' : 'No workflows yet'}</option>
            ) : (
              list.map(wf => (
                <option key={wf.id} value={wf.id}>
                  {workflowDocumentSelectLabel(wf)}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAddDefault}
            disabled={addPending}
            className="comfy-btn text-xs disabled:opacity-50"
          >
            + Add
          </button>
          {showDelete && onDeleteSelected ? (
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={!selectedWorkflowId || deletePending}
              className="comfy-btn-danger text-xs disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
      {isError ? (
        <p className="mt-2 text-xs text-rose-600">Could not load workflows.</p>
      ) : null}
    </div>
  );
}

export function WorkflowsTab({ projectId }: WorkflowsTabProps) {
  const queryClient = useQueryClient();
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const selectWorkflow = useSelectionStore(s => s.selectWorkflow);
  const selectWorkflowNode = useSelectionStore(s => s.selectWorkflowNode);
  const clearWorkflowSelection = useSelectionStore(s => s.clearWorkflowSelection);
  const { setRightPanelTab, setRightPanelOpen } = usePanelStore();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const { draft, setDraft } = useDraftStore();
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<WorkflowValidation | null>(null);
  const [pendingConnectionSource, setPendingConnectionSource] = useState<string | null>(null);
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);
  const [activeLibraryCategory, setActiveLibraryCategory] = useState<WorkflowNodeCategory>('input');

  useProjectEvents({
    projectId,
    onEvent: () => {
      queryClient.invalidateQueries({ queryKey: ['project-runs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    },
  });

  const workflowsQuery = useQuery({
    queryKey: ['project-workflows', projectId],
    queryFn: () => fetchProjectWorkflows(projectId),
    enabled: Boolean(projectId),
  });

  const workflowQuery = useQuery({
    queryKey: ['workflow', selectedWorkflowId],
    queryFn: () => fetchWorkflowById(selectedWorkflowId!),
    enabled: Boolean(selectedWorkflowId),
  });

  const versionsQuery = useQuery({
    queryKey: ['workflow-versions', selectedWorkflowId],
    queryFn: () => fetchWorkflowVersions(selectedWorkflowId!),
    enabled: Boolean(selectedWorkflowId),
  });

  // Prevent leaking workflow selection across projects:
  // if the selected workflow isn't part of this project's list (or the project has none),
  // clear selection and show an empty canvas until one is created.
  useEffect(() => {
    if (!workflowsQuery.data) {
      return;
    }

    if (!selectedWorkflowId) {
      return;
    }

    const existsInProject = workflowsQuery.data.some(w => w.id === selectedWorkflowId);
    // Don't clear while the project workflows list is being refreshed (e.g. right after creating a workflow).
    if (!existsInProject && !workflowsQuery.isFetching) {
      clearWorkflowSelection();
      selectWorkflowNode(null);
      setDraft(null);
      setDraftError(null);
      setLastValidation(null);
      setPendingConnectionSource(null);
      setIsNodeLibraryOpen(false);
      setActiveLibraryCategory('input');
      setViewingVersionId(null);
      setSelectedRun(null);
    }
  }, [
    workflowsQuery.data,
    workflowsQuery.isFetching,
    selectedWorkflowId,
    clearWorkflowSelection,
    selectWorkflowNode,
    setDraft,
    setDraftError,
    setLastValidation,
    setPendingConnectionSource,
    setIsNodeLibraryOpen,
    setActiveLibraryCategory,
    setViewingVersionId,
    setSelectedRun,
  ]);

  // Auto-select workflow from sessionStorage when navigating from modal
  useEffect(() => {
    const pendingWfId = sessionStorage.getItem('pendingWorkflowId');
    if (pendingWfId && workflowsQuery.data) {
      const exists = workflowsQuery.data.some(w => w.id === pendingWfId);
      if (exists) {
        selectWorkflow(pendingWfId);
        sessionStorage.removeItem('pendingWorkflowId');
      }
    }
  }, [workflowsQuery.data, selectedWorkflowId, selectWorkflow]);

  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => fetchProjectWorkflowRuns(projectId),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (workflowQuery.data) {
      setDraft(toDraftState(workflowQuery.data));
      setDraftError(null);
      setLastValidation(null);
      setPendingConnectionSource(null);
      setIsNodeLibraryOpen(false);
      setActiveLibraryCategory('input');
      setViewingVersionId(null);
    }
  }, [workflowQuery.data]);

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: workflow => {
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      selectWorkflow(workflow.id);
      showToast({
        type: 'success',
        title: 'Workflow created',
        message: workflow.title,
      });
    },
    onError: error => {
      showToast({
        type: 'error',
        title: 'Workflow creation failed',
        message: error instanceof Error ? error.message : 'Unable to create workflow',
      });
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: updateWorkflow,
    onSuccess: workflow => {
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workflow', workflow.id] });
      setDraft(toDraftState(workflow));
      showToast({
        type: 'success',
        title: 'Draft saved',
        message: `Updated ${workflow.title}`,
      });
    },
    onError: error => {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Unable to save workflow draft',
      });
    },
  });

  const validateWorkflowMutation = useMutation({
    mutationFn: validateWorkflow,
    onSuccess: validation => {
      setLastValidation(validation);
      showToast({
        type:
          validation.status === 'fail'
            ? 'error'
            : validation.status === 'warn'
              ? 'warning'
              : 'success',
        title: 'Validation complete',
        message:
          validation.status === 'pass'
            ? 'Workflow draft passed validation'
            : `${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`,
      });
    },
  });

  const createRunMutation = useMutation({
    mutationFn: createWorkflowRunDirect,
    onSuccess: run => {
      queryClient.invalidateQueries({ queryKey: ['project-runs', projectId] });
      setSelectedRun(run.id);
      showToast({
        type: 'success',
        title: 'Workflow started',
        message: `Run ${run.id.slice(0, 8)} queued`,
      });
    },
    onError: error => {
      showToast({
        type: 'error',
        title: 'Run failed',
        message: error instanceof Error ? error.message : 'Unable to start workflow run',
      });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      clearWorkflowSelection();
      showToast({
        type: 'success',
        title: 'Workflow deleted',
        message: 'Workflow removed successfully',
      });
    },
    onError: error => {
      showToast({
        type: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unable to delete workflow',
      });
    },
  });

  const versionIds = versionsQuery.data?.map(version => version.id) ?? [];
  const workflowRuns =
    runsQuery.data?.filter(run => versionIds.includes(run.workflow_version_id)) ?? [];
  const sortedWorkflowRuns = useMemo(() => {
    const copy = [...workflowRuns];
    copy.sort((a, b) => {
      const aTime = new Date(a.started_at || a.created_at).getTime();
      const bTime = new Date(b.started_at || b.created_at).getTime();
      return bTime - aTime;
    });
    return copy;
  }, [workflowRuns]);

  const latestRunId = sortedWorkflowRuns[0]?.id ?? null;
  const latestNodeRunsQuery = useQuery({
    queryKey: ['node-runs', latestRunId],
    queryFn: () => (latestRunId ? fetchNodeRuns(latestRunId) : Promise.resolve([])),
    enabled: Boolean(latestRunId),
  });

  const latestNodeRunByNodeId = useMemo(() => {
    const map = new Map<string, NodeRun>();
    for (const nodeRun of latestNodeRunsQuery.data ?? []) {
      const existing = map.get(nodeRun.node_id);
      if (!existing) {
        map.set(nodeRun.node_id, nodeRun);
        continue;
      }

      const existingTime = new Date(existing.started_at || existing.created_at).getTime();
      const nextTime = new Date(nodeRun.started_at || nodeRun.created_at).getTime();
      if (nextTime > existingTime) {
        map.set(nodeRun.node_id, nodeRun);
      }
    }
    return map;
  }, [latestNodeRunsQuery.data]);
  const activeRun = workflowRuns.find(run => run.status === 'running' || run.status === 'queued');

  const hasDraft =
    draft !== null &&
    workflowQuery.data !== undefined &&
    serializeDraft(draft) !== serializeDraft(toDraftState(workflowQuery.data));

  async function persistDraft() {
    if (!selectedWorkflowId || !draft) {
      console.log('persistDraft: no workflow or draft', {
        selectedWorkflowId: !!selectedWorkflowId,
        hasDraft: !!draft,
      });
      return null;
    }

    try {
      const payload = buildWorkflowPayload(draft);
      console.log(
        'Canvas Save - saving nodes:',
        payload.nodes?.length,
        'edges:',
        payload.edges?.length
      );
      setDraftError(null);
      return await updateWorkflowMutation.mutateAsync({
        workflowId: selectedWorkflowId,
        title: payload.title,
        description: payload.description,
        mode: payload.mode,
        status: payload.status,
        defaults: payload.defaults,
        nodes: payload.nodes,
        edges: payload.edges,
        metadata: payload.metadata,
      });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Unable to parse workflow draft');
      return null;
    }
  }

  async function handleValidate() {
    const workflow = hasDraft ? await persistDraft() : workflowQuery.data;

    if (!workflow) {
      return;
    }

    await validateWorkflowMutation.mutateAsync(workflow.id);
  }


  async function handleRunWorkflow() {
    if (!selectedWorkflowId) {
      return;
    }

    if (hasDraft) {
      await persistDraft();
    }

    await createRunMutation.mutateAsync({
      workflowId: selectedWorkflowId,
      trigger_source: 'manual',
    });
  }

  function handleCreateWorkflowFromTemplate(templateId: string) {
    const template = createWorkflowDraftFromTemplate(templateId);

    createWorkflowMutation.mutate({
      projectId,
      title: template.title,
      description: template.description,
      mode: 'advanced',
      template_type: template.template_type,
      defaults: template.defaults,
      nodes: template.nodes,
      edges: template.edges,
      metadata: {
        ...template.metadata,
        editor_seed: 'workflow_catalog_v1',
      },
    });
  }

  function addCatalogNode(nodeKey: string) {
    setDraft(current => {
      if (!current) {
        return current;
      }

      const newNode = toEditableNode(createWorkflowNodeFromCatalog(nodeKey));
      const previousNode = current.nodes[current.nodes.length - 1];
      const nextEdges = previousNode
        ? [
            ...current.edges,
            {
              id: `edge-${current.edges.length + 1}`,
              source: previousNode.id,
              target: newNode.id,
            },
          ]
        : current.edges;

      return {
        ...current,
        nodes: [...current.nodes, newNode],
        edges: nextEdges,
      };
    });
  }

  function addCatalogNodeAtPosition(nodeKey: string, position: { x: number; y: number }) {
    setDraft(current => {
      if (!current) {
        return current;
      }

      const newNode = toEditableNode(createWorkflowNodeFromCatalog(nodeKey));

      return {
        ...current,
        nodes: [
          ...current.nodes,
          {
            ...newNode,
            position,
          },
        ],
      };
    });
  }

  function handleGraphConnection(sourceId: string, targetId: string) {
    setDraft(current => {
      if (!current || sourceId === targetId) {
        return current;
      }

      const alreadyExists = current.edges.some(
        edge => edge.source === sourceId && edge.target === targetId
      );

      if (alreadyExists) {
        return current;
      }

      return {
        ...current,
        edges: [
          ...current.edges,
          {
            id: `edge-${current.edges.length + 1}`,
            source: sourceId,
            target: targetId,
          },
        ],
      };
    });

    setPendingConnectionSource(null);
  }

  const selectedWorkflowTitle = workflowQuery.data?.title ?? 'Workflow Editor';

  return (
    <div className="h-full">
      {!selectedWorkflowId ? (
        <div className="flex h-full min-h-0 flex-col comfy-bg-primary">
          <div className="flex shrink-0 items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-comfy-text">Workflows</div>
            </div>
          </div>
          <WorkflowDocumentPicker
            workflows={workflowsQuery.data}
            isLoading={workflowsQuery.isLoading}
            isError={workflowsQuery.isError}
            allowEmptySelection
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflowId={id => (id ? selectWorkflow(id) : clearWorkflowSelection())}
            onAddDefault={() => handleCreateWorkflowFromTemplate('storyboard_from_story')}
            addPending={createWorkflowMutation.isPending}
            deletePending={deleteWorkflowMutation.isPending}
            showDelete={false}
          />
          <div
            className="relative min-h-0 flex-1"
            style={{
              backgroundImage: `
            linear-gradient(to right, var(--border-light) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border-light) 1px, transparent 1px)
          `,
              backgroundSize: '20px 20px',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-lg border border-[var(--border-light)] bg-[var(--bg-elevated)] p-8 text-center shadow-lg">
                <p className="mb-4 text-lg font-medium text-[var(--text-primary)]">Create a Workflow</p>
                <p className="mb-6 text-sm text-[var(--text-muted)]">Choose a template to get started</p>
                <div className="grid grid-cols-1 gap-3">
                  {workflowTemplateCatalog.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleCreateWorkflowFromTemplate(template.id)}
                      className="rounded-lg border border-[var(--border)] p-4 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
                    >
                      <div className="text-sm font-medium text-[var(--text-primary)]">{template.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{template.description}</div>
                      <div className="mt-2 text-xs text-[var(--text-muted)]">{template.nodes.length} nodes</div>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  Or pick an existing workflow above, then refine it here.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : !draft ? (
        <div className="flex items-center justify-center h-full">Loading...</div>
      ) : (
        <>
          {isNodeLibraryOpen && (
            <div className="fixed right-6 top-24 z-[9999] w-[24rem] max-w-[calc(100%-3rem)] rounded-[1.75rem] border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="mt-1 text-lg font-semibold text-slate-900">Node Library</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Drag from here into the canvas or click to append a node.
                  </p>
                </div>
                <button
                  onClick={() => setIsNodeLibraryOpen(false)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {(Object.keys(categoryLabels) as WorkflowNodeCategory[]).map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveLibraryCategory(category)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                      activeLibraryCategory === category
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                      {categoryGlyphs[category]}
                    </span>
                    <span>{categoryLabels[category]}</span>
                  </button>
                ))}
              </div>

              <NodeLibraryPanel
                mode={draft.mode}
                categoryFilter={activeLibraryCategory}
                onAddNode={addCatalogNode}
                onStartLibraryDrag={(event, nodeKey) => {
                  event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, nodeKey);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
              />
            </div>
          )}
          <section className="flex h-[calc(100vh-9rem)] flex-col gap-3">
            <div className="shrink-0 overflow-hidden rounded-2xl border border-comfy-border bg-[var(--bg-elevated)] shadow-sm">
              <WorkflowDocumentPicker
                workflows={workflowsQuery.data}
                isLoading={workflowsQuery.isLoading}
                isError={workflowsQuery.isError}
                allowEmptySelection={false}
                selectedWorkflowId={selectedWorkflowId}
                onSelectWorkflowId={id => {
                  if (id && id !== selectedWorkflowId) {
                    selectWorkflow(id);
                  }
                }}
                onAddDefault={() => handleCreateWorkflowFromTemplate('storyboard_from_story')}
                onDeleteSelected={() => {
                  if (selectedWorkflowId && confirm('Delete this workflow? This cannot be undone.')) {
                    deleteWorkflowMutation.mutate(selectedWorkflowId);
                  }
                }}
                addPending={createWorkflowMutation.isPending}
                deletePending={deleteWorkflowMutation.isPending}
                className="p-4"
              />
            </div>
            <div
              className="relative z-40 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--bg-base)] shadow-sm"
              style={{
                backgroundImage: `
                linear-gradient(to right, var(--border-light) 1px, transparent 1px),
                linear-gradient(to bottom, var(--border-light) 1px, transparent 1px)
              `,
                backgroundSize: '20px 20px',
              }}
            >
              <div className="relative rounded-t-[2rem] border-b border-[var(--border-light)] bg-[var(--bg-elevated)] px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => clearWorkflowSelection()}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                      title="Back to Workflows Dashboard"
                    >
                      ←
                    </button>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Workflow Builder
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                        {selectedWorkflowTitle}
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsNodeLibraryOpen(current => !current)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                        isNodeLibraryOpen
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-white bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                      title={isNodeLibraryOpen ? 'Hide node library' : 'Open node library'}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold tracking-wider text-slate-800">
                        N
                      </span>
                      Node Library
                    </button>
                    <div className="mx-1 h-6 w-px bg-slate-300" />
                    <StatusPill label={draft.status} tone="neutral" />
                    <StatusPill label={draft.mode} tone="info" />
                    <StatusPill label={draft.templateType} tone="soft" />
                    {hasDraft && <StatusPill label="Unsaved changes" tone="warning" />}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-6 py-4">
                <button
                  onClick={() => {
                    void persistDraft();
                  }}
                  disabled={updateWorkflowMutation.isPending}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateWorkflowMutation.isPending ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => {
                    void handleValidate();
                  }}
                  disabled={validateWorkflowMutation.isPending || updateWorkflowMutation.isPending}
                  className="rounded-full border border-[var(--border-light)] bg-[var(--bg-hover)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-active)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {validateWorkflowMutation.isPending ? 'Validating...' : 'Validate Draft'}
                </button>
                <button
                  onClick={() => {
                    void handleRunWorkflow();
                  }}
                  disabled={createRunMutation.isPending || updateWorkflowMutation.isPending}
                  className="rounded-full border border-[var(--success)] bg-[var(--success)]/20 px-4 py-2 text-sm font-medium text-[var(--success)] transition hover:bg-[var(--success)]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createRunMutation.isPending ? 'Starting...' : 'Run Workflow'}
                </button>
              </div>

              {draftError && (
                <div className="mx-6 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {draftError}
                </div>
              )}

              <div className="relative z-50 flex-1 overflow-hidden bg-slate-900">
                {draft.mode === 'advanced' && (
                  <div className="relative h-full w-full">
                    <AdvancedGraphCanvas
                      nodes={draft.nodes}
                      edges={draft.edges}
                      latestRunId={latestRunId}
                      latestNodeRunByNodeId={latestNodeRunByNodeId}
                      isLoadingLatestNodeRuns={latestNodeRunsQuery.isLoading}
                      onOpenRunDetails={runId => setSelectedRun(runId)}
                      pendingConnectionSource={pendingConnectionSource}
                      onStartConnection={nodeId => setPendingConnectionSource(nodeId)}
                      onCompleteConnection={handleGraphConnection}
                      onCancelConnection={() => setPendingConnectionSource(null)}
                      onMoveNode={(nodeId, position) =>
                        setDraft(current =>
                          current
                            ? {
                                ...current,
                                nodes: current.nodes.map(node =>
                                  node.id === nodeId ? { ...node, position } : node
                                ),
                              }
                            : current
                        )
                      }
                      onDropNode={addCatalogNodeAtPosition}
                      onSelectNode={nodeId => {
                        console.log('onSelectNode called with:', nodeId);
                        selectWorkflowNode(nodeId);
                        setRightPanelOpen(true);
                        setRightPanelTab('inspector');
                      }}
                      onDeleteNode={nodeId =>
                        setDraft(current =>
                          current
                            ? {
                                ...current,
                                nodes: current.nodes.filter(n => n.id !== nodeId),
                                edges: current.edges.filter(
                                  e => e.source !== nodeId && e.target !== nodeId
                                ),
                              }
                            : current
                        )
                      }
                      onEditNode={nodeId => {
                        console.log('onEditNode called with:', nodeId);
                        selectWorkflowNode(nodeId);
                        setRightPanelOpen(true);
                        setRightPanelTab('inspector');
                      }}
                      onRemoveNode={nodeId =>
                        setDraft(current =>
                          current
                            ? {
                                ...current,
                                nodes: current.nodes.filter(n => n.id !== nodeId),
                                edges: current.edges.filter(
                                  e => e.source !== nodeId && e.target !== nodeId
                                ),
                              }
                            : current
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {selectedRun && (
        <RunDetailPanel
          projectId={projectId}
          runId={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}

function ActiveRunProgress({ projectId, run }: { projectId: string; run: WorkflowRun }) {
  const { progress, currentNode } = useWorkflowProgress(projectId, run.id);

  if (progress === null) {
    return <p className="mt-2 text-sm text-blue-700">Run status: {run.status}</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="h-2 rounded-full bg-blue-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-blue-800">
        <span>{progress}% complete</span>
        <span>{currentNode ?? 'Processing'}</span>
      </div>
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function NodeLibraryPanel({
  mode,
  onAddNode,
  onStartLibraryDrag,
  categoryFilter,
}: {
  mode: WorkflowDefinition['mode'];
  onAddNode: (nodeKey: string) => void;
  onStartLibraryDrag: (event: DragEvent<HTMLButtonElement>, nodeKey: string) => void;
  categoryFilter?: WorkflowNodeCategory;
}) {
  const categories = categoryFilter
    ? [categoryFilter]
    : (Object.keys(categoryLabels) as WorkflowNodeCategory[]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {mode === 'advanced'
          ? 'Drag a node into the canvas or click to append it to the workflow.'
          : 'Click a node to append it to the workflow.'}
      </div>

      {categories.map(category => {
        const entries = workflowNodeCatalog.filter(node => node.category === category);
        return (
          <div key={category}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {categoryLabels[category]}
            </h4>
            <div className="grid gap-3">
              {entries.map(node => (
                <button
                  key={node.key}
                  onClick={() => onAddNode(node.key)}
                  draggable={mode === 'advanced'}
                  onDragStart={event => onStartLibraryDrag(event, node.key)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{node.title}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {node.runtimeType}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{node.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>In: {node.inputSummary}</span>
                    <span>Out: {node.outputSummary}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JsonEditorCard({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <PanelCard title={`${label} JSON`} subtitle={description}>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={12}
        className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-xs outline-none transition focus:border-slate-400 focus:bg-white"
      />
    </PanelCard>
  );
}

const GRAPH_NODE_WIDTH = 260;
const GRAPH_NODE_HEIGHT = 156;
const GRAPH_COLUMN_GAP = 120;
const GRAPH_ROW_GAP = 48;
const PORT_RADIUS = 6;

const categoryStyle: Record<WorkflowNodeCategory, { header: string; dot: string }> = {
  input: { header: 'bg-violet-700', dot: '#a78bfa' },
  planning: { header: 'bg-sky-700', dot: '#38bdf8' },
  generation: { header: 'bg-emerald-700', dot: '#34d399' },
  validation: { header: 'bg-amber-700', dot: '#fbbf24' },
  assembly: { header: 'bg-indigo-700', dot: '#818cf8' },
  export: { header: 'bg-rose-700', dot: '#fb7185' },
};

function AdvancedGraphCanvas({
  nodes,
  edges,
  latestRunId,
  latestNodeRunByNodeId,
  isLoadingLatestNodeRuns,
  onOpenRunDetails,
  pendingConnectionSource,
  onStartConnection,
  onCompleteConnection,
  onCancelConnection,
  onMoveNode,
  onDropNode,
  onSelectNode,
  onDeleteNode,
  onEditNode,
  onRemoveNode,
}: {
  nodes: EditableNode[];
  edges: EditableEdge[];
  latestRunId: string | null;
  latestNodeRunByNodeId: Map<string, NodeRun>;
  isLoadingLatestNodeRuns: boolean;
  onOpenRunDetails: (runId: string) => void;
  pendingConnectionSource: string | null;
  onStartConnection: (nodeId: string) => void;
  onCompleteConnection: (sourceId: string, targetId: string) => void;
  onCancelConnection: () => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onDropNode: (nodeKey: string, position: { x: number; y: number }) => void;
  onSelectNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onEditNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [dragConnection, setDragConnection] = useState<{
    sourceId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const layout = buildGraphLayout(nodes, edges);
  const nodePositions = new Map(layout.map(item => [item.node.id, item.position]));
  const canvasWidth = Math.max(
    1400,
    ...layout.map(item => item.position.x + GRAPH_NODE_WIDTH + 140)
  );
  const canvasHeight = Math.max(
    800,
    ...layout.map(item => item.position.y + GRAPH_NODE_HEIGHT + 120)
  );

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;
    function handlePointerMove(event: PointerEvent) {
      const container = canvasRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX =
        (event.clientX - rect.left) / zoom + container.scrollLeft / zoom - activeDrag.offsetX;
      const nextY =
        (event.clientY - rect.top) / zoom + container.scrollTop / zoom - activeDrag.offsetY;
      onMoveNode(activeDrag.nodeId, { x: Math.max(24, nextX), y: Math.max(24, nextY) });
    }
    function handlePointerUp() {
      setDragState(null);
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, onMoveNode, zoom]);

  useEffect(() => {
    if (!dragConnection) return;
    function handlePointerMove(event: PointerEvent) {
      const container = canvasRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setDragConnection(current =>
        current
          ? {
              ...current,
              currentX: (event.clientX - rect.left) / zoom + container.scrollLeft / zoom,
              currentY: (event.clientY - rect.top) / zoom + container.scrollTop / zoom,
            }
          : current
      );
    }
    function handlePointerUp() {
      setDragConnection(null);
      onCancelConnection();
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragConnection, onCancelConnection, zoom]);

  const resolveApiRelativeUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      try {
        return new URL(url, API_BASE_URL).toString();
      } catch {
        return url;
      }
    }
    return url;
  };

  const inspectedNode = inspectedNodeId ? nodes.find(n => n.id === inspectedNodeId) ?? null : null;
  const inspectedNodeRun = inspectedNodeId
    ? latestNodeRunByNodeId.get(inspectedNodeId) ?? null
    : null;
  const inspectedOutput = (inspectedNodeRun?.output_snapshot ?? {}) as Record<string, unknown>;
  const inspectedInput = (inspectedNodeRun?.input_snapshot ?? {}) as Record<string, unknown>;
  const inspectedImageUrl = resolveApiRelativeUrl(
    (inspectedOutput as any).image_url ?? (inspectedOutput as any).imageUrl
  );
  const inspectedVideoUrl = resolveApiRelativeUrl(
    (inspectedOutput as any).video_url ?? (inspectedOutput as any).videoUrl
  );
  const inspectedAudioUrl = resolveApiRelativeUrl(
    (inspectedOutput as any).audio_url ?? (inspectedOutput as any).audioUrl
  );
  const inspectedText =
    typeof (inspectedOutput as any).text_used === 'string'
      ? String((inspectedOutput as any).text_used)
      : typeof (inspectedOutput as any).prompt_used === 'string'
        ? String((inspectedOutput as any).prompt_used)
        : typeof (inspectedOutput as any).narration === 'string'
          ? String((inspectedOutput as any).narration)
          : typeof (inspectedOutput as any)?._debug?.final_prompt === 'string'
            ? String((inspectedOutput as any)._debug.final_prompt)
            : null;

  return (
    <div
      ref={canvasRef}
      onDragOver={event => {
        if (event.dataTransfer.types.includes(WORKFLOW_NODE_DRAG_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        const nodeKey = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME);
        if (!nodeKey || !canvasRef.current) return;
        event.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        onDropNode(nodeKey, {
          x: Math.max(
            24,
            (event.clientX - rect.left) / zoom +
              canvasRef.current.scrollLeft / zoom -
              GRAPH_NODE_WIDTH / 2
          ),
          y: Math.max(
            24,
            (event.clientY - rect.top) / zoom +
              canvasRef.current.scrollTop / zoom -
              GRAPH_NODE_HEIGHT / 2
          ),
        });
      }}
      className="relative h-[calc(100vh-18rem)] min-h-[32rem] overflow-auto rounded-[1.75rem] border border-[#2d2d3a] bg-[#16161e]"
      style={{
        backgroundImage: 'radial-gradient(circle, #ffffff14 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Zoom controls — top right */}
      <div className="absolute right-4 top-4 z-30 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom(z => Math.min(2, parseFloat((z + 0.1).toFixed(2))))}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e1e2d]/80 text-slate-300 text-base font-bold backdrop-blur transition hover:bg-[#2d2d3a] hover:text-white"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(2))))}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e1e2d]/80 text-slate-300 text-base font-bold backdrop-blur transition hover:bg-[#2d2d3a] hover:text-white"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e1e2d]/80 text-slate-400 text-sm backdrop-blur transition hover:bg-[#2d2d3a] hover:text-white"
        >
          ⊡
        </button>
        <div className="rounded-lg bg-[#1e1e2d]/80 px-2 py-1 text-center text-[10px] font-semibold text-slate-400 backdrop-blur">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Connection hint — bottom left */}
      <div
        className={`absolute bottom-4 left-4 z-30 rounded-xl px-3 py-2 text-xs font-medium backdrop-blur transition-all ${
          pendingConnectionSource
            ? 'bg-indigo-900/80 text-indigo-200 ring-1 ring-indigo-500/40'
            : 'bg-[#1e1e2d]/70 text-slate-400'
        }`}
      >
        {pendingConnectionSource ? (
          <span>
            Connecting — click a target{' '}
            <span className="font-bold text-indigo-300">input port</span>
            <button
              onClick={onCancelConnection}
              className="ml-2 underline text-indigo-400 hover:text-indigo-200"
            >
              cancel
            </button>
          </span>
        ) : (
          <span>
            {nodes.length} nodes · {edges.length} edges · drag to connect
          </span>
        )}
      </div>

      {/* Zoomable canvas */}
      <div
        style={{
          transformOrigin: 'top left',
          transform: `scale(${zoom})`,
          width: canvasWidth,
          height: canvasHeight,
          position: 'relative',
        }}
      >
        {/* SVG edge layer */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker id="ag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
            </marker>
            <marker
              id="ag-arrow-drag"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#818cf8" opacity="0.7" />
            </marker>
          </defs>

          {edges.map(edge => {
            const source = nodePositions.get(edge.source);
            const target = nodePositions.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + GRAPH_NODE_WIDTH + PORT_RADIUS;
            const y1 = source.y + GRAPH_NODE_HEIGHT / 2;
            const x2 = target.x - PORT_RADIUS;
            const y2 = target.y + GRAPH_NODE_HEIGHT / 2;
            const cp = Math.max(60, Math.abs(x2 - x1) / 2.2);
            const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeLinecap="round"
                markerEnd="url(#ag-arrow)"
                opacity="0.85"
              />
            );
          })}

          {dragConnection &&
            (() => {
              const cp = 80;
              const d = `M ${dragConnection.startX} ${dragConnection.startY} C ${dragConnection.startX + cp} ${dragConnection.startY}, ${dragConnection.currentX - cp} ${dragConnection.currentY}, ${dragConnection.currentX} ${dragConnection.currentY}`;
              return (
                <path
                  d={d}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeDasharray="8 5"
                  strokeLinecap="round"
                  markerEnd="url(#ag-arrow-drag)"
                  opacity="0.7"
                />
              );
            })()}
        </svg>

        {/* Node cards */}
        {layout.map(({ node, position, columnIndex }) => {
          const definition = getEditableNodeDefinition(node);
          const category = (definition?.category ?? 'input') as WorkflowNodeCategory;
          const style = categoryStyle[category];
          const inbound = edges.filter(e => e.target === node.id);
          const outbound = edges.filter(e => e.source === node.id);
          const isConnecting = pendingConnectionSource !== null;
          const isSource = pendingConnectionSource === node.id;

          return (
            <div
              key={node.id}
              className="absolute"
              style={{ left: position.x, top: position.y, width: GRAPH_NODE_WIDTH }}
            >
              {/* Input port dot (left edge) */}
              <div
                className="absolute z-10"
                style={{
                  left: -(PORT_RADIUS * 2),
                  top: GRAPH_NODE_HEIGHT / 2 - PORT_RADIUS,
                  cursor: isConnecting && !isSource ? 'crosshair' : 'default',
                }}
                onPointerUp={() => {
                  if (isConnecting && !isSource && pendingConnectionSource) {
                    onCompleteConnection(pendingConnectionSource, node.id);
                    setDragConnection(null);
                  }
                }}
              >
                <div
                  className="rounded-full border-2 border-[#16161e]"
                  style={{
                    width: PORT_RADIUS * 2,
                    height: PORT_RADIUS * 2,
                    background: isConnecting && !isSource ? '#a5f3fc' : style.dot,
                    boxShadow: isConnecting && !isSource ? '0 0 8px #a5f3fc99' : 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>

              {/* Output port dot (right edge) */}
              <div
                className="absolute z-10"
                style={{
                  right: -(PORT_RADIUS * 2),
                  top: GRAPH_NODE_HEIGHT / 2 - PORT_RADIUS,
                  cursor: 'crosshair',
                }}
                onPointerDown={e => {
                  (e.target as Element).releasePointerCapture(e.pointerId);
                  const pos = nodePositions.get(node.id) ?? position;
                  const x1 = pos.x + GRAPH_NODE_WIDTH + PORT_RADIUS;
                  const y1 = pos.y + GRAPH_NODE_HEIGHT / 2;
                  if (isSource) {
                    setDragConnection(null);
                    onCancelConnection();
                    return;
                  }
                  onStartConnection(node.id);
                  setDragConnection({
                    sourceId: node.id,
                    startX: x1,
                    startY: y1,
                    currentX: x1,
                    currentY: y1,
                  });
                }}
              >
                <div
                  className="rounded-full border-2 border-[#16161e]"
                  style={{
                    width: PORT_RADIUS * 2,
                    height: PORT_RADIUS * 2,
                    background: isSource ? '#fff' : '#34d399',
                    boxShadow: isSource ? '0 0 8px #34d39988' : 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>

              {/* Card */}
              <div
                className="overflow-hidden rounded-2xl border border-[#2d2d3a] bg-[#1e1e2d] shadow-xl"
                style={{ minHeight: GRAPH_NODE_HEIGHT }}
              >
                {/* Title bar */}
                <div
                  className={`flex select-none items-center justify-between gap-2 px-3 py-2 ${style.header}`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={event => {
                    const container = canvasRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const pos = nodePositions.get(node.id) ?? position;
                    setDragState({
                      nodeId: node.id,
                      offsetX:
                        event.clientX / zoom -
                        rect.left / zoom -
                        pos.x +
                        container.scrollLeft / zoom,
                      offsetY:
                        event.clientY / zoom - rect.top / zoom - pos.y + container.scrollTop / zoom,
                    });
                  }}
                >
                  <span className="truncate text-[11px] font-semibold text-white">
                    {node.label || definition?.title || node.id}
                  </span>
                  <div
                    className="flex flex-shrink-0 items-center gap-1.5"
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-medium text-white/75">
                      {categoryLabels[category]}
                    </span>
                    <button
                      type="button"
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setInspectedNodeId(current => (current === node.id ? null : node.id));
                      }}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-sky-200 transition hover:bg-sky-500/30 cursor-pointer"
                      title="Show node input/output"
                    >
                      I/O
                    </button>
                    <button
                      type="button"
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        console.log('EDIT button clicked for node:', node.id);
                        onEditNode(node.id);
                      }}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-green-400 transition hover:bg-green-500/30 cursor-pointer"
                      title="Edit Node"
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveNode(node.id);
                      }}
                      className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400 transition hover:bg-red-500/40"
                      title="Delete Node"
                    >
                      DEL
                    </button>
                  </div>
                </div>

                {/* Body */}
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="block w-full px-3 py-2.5 text-left"
                  title="Select node"
                >
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                    {definition?.description ?? 'Custom workflow node'}
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-2 text-[10px]">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-500">IN </span>
                      <span className="text-slate-400 truncate">
                        {definition?.inputSummary ?? '—'}
                      </span>
                      {inbound.length > 0 && (
                        <div className="mt-0.5 text-[9px] text-slate-600">
                          {inbound.map(e => e.source).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 text-right">
                      <span className="font-semibold text-slate-500">OUT </span>
                      <span className="text-slate-400 truncate">
                        {definition?.outputSummary ?? '—'}
                      </span>
                      {outbound.length > 0 && (
                        <div className="mt-0.5 text-[9px] text-slate-600">
                          {outbound.map(e => e.target).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-600 font-medium">
                    Stage {columnIndex + 1} · {node.id.slice(0, 8)}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Node I/O panel (bottom right) */}
      {inspectedNodeId ? (
        <div className="absolute bottom-4 right-4 z-40 w-[28rem] max-w-[calc(100%-2rem)] rounded-2xl border border-[#2d2d3a] bg-[#0f0f16]/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-[#2d2d3a] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {inspectedNode?.label ?? inspectedNodeId}
              </div>
              <div className="text-[11px] text-slate-400">
                {isLoadingLatestNodeRuns
                  ? 'Loading latest run…'
                  : latestRunId
                    ? `Latest run: ${latestRunId.slice(0, 8)}`
                    : 'No runs yet'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {latestRunId ? (
                <button
                  type="button"
                  onClick={() => onOpenRunDetails(latestRunId)}
                  className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/15"
                >
                  Open run
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setInspectedNodeId(null)}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/15"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto px-4 py-3 space-y-4">
            {inspectedNodeRun ? (
              <div className="text-[11px] text-slate-400">
                Status: <span className="text-white/90">{inspectedNodeRun.status}</span> ·{' '}
                {inspectedNodeRun.started_at
                  ? new Date(inspectedNodeRun.started_at).toLocaleString()
                  : '-'}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#2d2d3a] p-4 text-sm text-slate-400">
                {latestRunId
                  ? 'No output found for this node in the latest run.'
                  : 'Run the workflow to see node output here.'}
              </div>
            )}

            {inspectedText ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Input / Prompt
                </div>
                <pre className="max-h-56 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                  {inspectedText}
                </pre>
              </div>
            ) : null}

            {inspectedImageUrl ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Image Output
                </div>
                <div className="rounded-xl border border-[#2d2d3a] bg-black/30 p-2">
                  <img
                    src={inspectedImageUrl}
                    alt="Node output"
                    className="w-full max-h-[320px] object-contain rounded"
                  />
                  <div className="mt-2 text-[11px] text-slate-400 break-all">
                    {inspectedImageUrl}
                  </div>
                </div>
              </div>
            ) : null}

            {inspectedVideoUrl ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Video Output
                </div>
                <div className="rounded-xl border border-[#2d2d3a] bg-black/30 p-2">
                  <video
                    src={inspectedVideoUrl}
                    controls
                    className="w-full max-h-[320px] rounded"
                  />
                  <div className="mt-2 text-[11px] text-slate-400 break-all">
                    {inspectedVideoUrl}
                  </div>
                </div>
              </div>
            ) : null}

            {inspectedAudioUrl ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Audio Output
                </div>
                <div className="rounded-xl border border-[#2d2d3a] bg-black/30 p-3">
                  <audio src={inspectedAudioUrl} controls className="w-full" />
                  <div className="mt-2 text-[11px] text-slate-400 break-all">
                    {inspectedAudioUrl}
                  </div>
                </div>
              </div>
            ) : null}

            {inspectedNodeRun ? (
              <details className="rounded-xl border border-[#2d2d3a] bg-black/30 p-3">
                <summary className="cursor-pointer text-sm font-medium text-white/80">
                  Raw snapshots
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">
                      input_snapshot
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                      {JSON.stringify(inspectedInput, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">
                      output_snapshot
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                      {JSON.stringify(inspectedOutput, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'soft';
}) {
  const classes: Record<typeof tone, string> = {
    neutral: 'bg-slate-100 text-slate-700',
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-800',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-rose-100 text-rose-700',
    soft: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>
  );
}

function ValidationList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'warning' | 'danger';
}) {
  const styles =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function VersionRow({ version }: { version: WorkflowVersion }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">v{version.version_number}</span>
        <span className="text-xs text-slate-400">
          {new Date(version.created_at).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{version.notes || 'No version notes'}</p>
      <div className="mt-2 text-xs text-slate-400">{version.graph_hash.slice(0, 12)}...</div>
    </div>
  );
}

/* Helpers moved to draftStore.ts */

/* Helpers moved to draftStore.ts */

/* Helper moved to draftStore.ts */

function buildGraphColumns(nodes: EditableNode[], edges: EditableEdge[]) {
  if (nodes.length === 0) {
    return [];
  }

  const inbound = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const levels = new Map<string, number>();

  for (const node of nodes) {
    inbound.set(node.id, 0);
    adjacency.set(node.id, []);
    levels.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target) || edge.source === edge.target) {
      continue;
    }

    adjacency.get(edge.source)?.push(edge.target);
    inbound.set(edge.target, (inbound.get(edge.target) ?? 0) + 1);
  }

  const queue = nodes.filter(node => (inbound.get(node.id) ?? 0) === 0).map(node => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.add(current);
    const currentLevel = levels.get(current) ?? 0;

    for (const next of adjacency.get(current) ?? []) {
      levels.set(next, Math.max(levels.get(next) ?? 0, currentLevel + 1));
      inbound.set(next, (inbound.get(next) ?? 1) - 1);
      if ((inbound.get(next) ?? 0) === 0) {
        queue.push(next);
      }
    }
  }

  nodes.forEach((node, index) => {
    if (!visited.has(node.id)) {
      levels.set(node.id, Math.max(levels.get(node.id) ?? 0, index));
    }
  });

  const maxLevel = Math.max(...levels.values());
  const columns = Array.from({ length: maxLevel + 1 }, () => [] as EditableNode[]);

  nodes.forEach(node => {
    const level = levels.get(node.id) ?? 0;
    columns[level].push(node);
  });

  return columns;
}

/* Helper moved to draftStore.ts */

function buildGraphLayout(nodes: EditableNode[], edges: EditableEdge[]) {
  const columns = buildGraphColumns(nodes, edges);

  return columns.flatMap((column, columnIndex) =>
    column.map((node, rowIndex) => ({
      node,
      columnIndex,
      position:
        node.position.x > 0 || node.position.y > 0
          ? node.position
          : {
              x: 24 + columnIndex * (GRAPH_NODE_WIDTH + GRAPH_COLUMN_GAP),
              y: 40 + rowIndex * (GRAPH_NODE_HEIGHT + GRAPH_ROW_GAP),
            },
    }))
  );
}

function replaceNodeCatalogType(node: EditableNode, catalogType: string): EditableNode {
  const definition = getWorkflowNodeDefinition(catalogType);

  if (!definition) {
    return node;
  }

  return {
    ...node,
    type: definition.runtimeType,
    catalogType,
    label: definition.defaultLabel,
    params: {
      ...definition.defaultParams,
    },
    data: {
      ...node.data,
      label: definition.defaultLabel,
      catalog_type: catalogType,
      category: definition.category,
      graph_position: node.data.graph_position,
    },
  };
}

function updateNode(
  nodes: EditableNode[],
  index: number,
  updater: (node: EditableNode) => EditableNode
) {
  return nodes.map((node, nodeIndex) => (nodeIndex === index ? updater(node) : node));
}

function renameNode(draft: WorkflowDraftState, index: number, nextId: string): WorkflowDraftState {
  const previousId = draft.nodes[index]?.id;
  if (!previousId) {
    return draft;
  }

  const nodes = updateNode(draft.nodes, index, node => ({ ...node, id: nextId }));
  const edges = draft.edges.map(edge => ({
    ...edge,
    source: edge.source === previousId ? nextId : edge.source,
    target: edge.target === previousId ? nextId : edge.target,
  }));

  return {
    ...draft,
    nodes,
    edges,
  };
}

function updateEdgeField<K extends keyof EditableEdge>(
  edges: EditableEdge[],
  index: number,
  key: K,
  value: EditableEdge[K]
) {
  return edges.map((edge, edgeIndex) => (edgeIndex === index ? { ...edge, [key]: value } : edge));
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : 0;
}

interface RunDetailPanelProps {
  projectId: string;
  runId: string;
  onClose: () => void;
}

function RunDetailPanel({ projectId, runId, onClose }: RunDetailPanelProps) {
  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => fetchProjectWorkflowRuns(projectId),
    enabled: Boolean(projectId),
  });

  const run = runsQuery.data?.find(candidate => candidate.id === runId);

  const nodeRunsQuery = useQuery({
    queryKey: ['node-runs', runId],
    queryFn: () => fetchNodeRuns(runId),
    enabled: Boolean(runId),
  });

  const { progress, currentNode } = useWorkflowProgress(projectId, runId);
  const [expandedNodeRunId, setExpandedNodeRunId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Run Details</h3>
          <button
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(80vh-72px)] space-y-5 overflow-auto p-5">
          {run && (
            <>
              <div className="flex items-center gap-3">
                <RunStatusBadge status={run.status} />
                <span className="text-sm text-slate-500">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>

              {run.status === 'running' && progress !== null && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {currentNode && <p className="text-sm text-slate-500">Running: {currentNode}</p>}
                </div>
              )}

              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Node Runs
                </h4>
                {nodeRunsQuery.isLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : nodeRunsQuery.data && nodeRunsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {nodeRunsQuery.data.map(nodeRun => (
                      <NodeRunRow
                        key={nodeRun.id}
                        nodeRun={nodeRun}
                        expanded={expandedNodeRunId === nodeRun.id}
                        onToggle={() =>
                          setExpandedNodeRunId(current => (current === nodeRun.id ? null : nodeRun.id))
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No node runs yet</div>
                )}
              </div>

              {run.logs && run.logs.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Logs
                  </h4>
                  <div className="max-h-48 overflow-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-100">
                    {run.logs.map((log, index) => (
                      <div key={`${log}-${index}`} className="mb-1">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function resolveApiRelativeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    try {
      return new URL(url, API_BASE_URL).toString();
    } catch {
      return url;
    }
  }
  return url;
}

function NodeRunRow({
  nodeRun,
  expanded,
  onToggle,
}: {
  nodeRun: NodeRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const params = (nodeRun.input_snapshot?.params ?? {}) as Record<string, unknown>;
  const out = (nodeRun.output_snapshot ?? {}) as Record<string, unknown>;

  const imageUrl = resolveApiRelativeUrl((out as any).image_url ?? (out as any).imageUrl);
  const videoUrl = resolveApiRelativeUrl((out as any).video_url ?? (out as any).videoUrl);
  const audioUrl = resolveApiRelativeUrl((out as any).audio_url ?? (out as any).audioUrl);
  const audioSegments = Array.isArray((out as any).audio_segments) ? ((out as any).audio_segments as unknown[]) : null;
  const voiceoverSegments = Array.isArray((out as any).voiceover_segments)
    ? ((out as any).voiceover_segments as Array<Record<string, unknown>>)
    : null;

  const promptUsed =
    typeof (out as any)?.text_used === 'string'
      ? String((out as any).text_used)
      : typeof (out as any)?.narration === 'string'
        ? String((out as any).narration)
        : typeof (out as any)?.prompt_used === 'string'
          ? String((out as any).prompt_used)
      : typeof (out as any)?._debug?.final_prompt === 'string'
        ? String((out as any)._debug.final_prompt)
        : typeof (params as any)?.prompt === 'string'
          ? String((params as any).prompt)
          : typeof (params as any)?.text === 'string'
            ? String((params as any).text)
            : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
        <NodeStatusBadge status={nodeRun.status} />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">{nodeRun.node_id}</div>
          <div className="text-xs text-slate-500">{nodeRun.node_type}</div>
        </div>
        <span className="text-xs text-slate-400">
          {nodeRun.started_at ? new Date(nodeRun.started_at).toLocaleTimeString() : '-'}
        </span>
      </div>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4">
          {promptUsed ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Prompt / Input
              </div>
              <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                {promptUsed}
              </pre>
            </div>
          ) : null}

          {imageUrl ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Image Output
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2">
                <img src={imageUrl} alt="Node output" className="w-full max-h-[420px] object-contain rounded" />
                <div className="mt-2 text-[11px] text-slate-500 break-all">{imageUrl}</div>
              </div>
            </div>
          ) : null}

          {videoUrl ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Video Output
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2">
                <video src={videoUrl} controls className="w-full max-h-[420px] rounded" />
                <div className="mt-2 text-[11px] text-slate-500 break-all">{videoUrl}</div>
              </div>
            </div>
          ) : null}

          {audioSegments?.length || audioUrl ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Audio Output
              </div>
              {audioSegments?.length ? (
                <AudioSegmentsPlayer segments={audioSegments} fallbackUrl={audioUrl} />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <audio src={audioUrl!} controls className="w-full" />
                  <div className="mt-2 text-[11px] text-slate-500 break-all">{audioUrl}</div>
                </div>
              )}
            </div>
          ) : null}

          {voiceoverSegments?.length ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Voice-over (Per Shot)
              </div>
              <div className="space-y-3">
                {voiceoverSegments.map((segment, idx) => {
                  const segAudioUrl = resolveApiRelativeUrl((segment as any).audio_url ?? (segment as any).audioUrl);
                  const segAudioSegments = Array.isArray((segment as any).audio_segments)
                    ? ((segment as any).audio_segments as unknown[])
                    : null;
                  const text =
                    typeof (segment as any).text === 'string'
                      ? String((segment as any).text)
                      : typeof (segment as any).text_used === 'string'
                        ? String((segment as any).text_used)
                        : null;
                  const sceneIndex = (segment as any).scene_index;
                  const shotNumber = (segment as any).shot_number;
                  const label = [
                    typeof sceneIndex === 'number' || typeof sceneIndex === 'string' ? `Scene ${sceneIndex}` : null,
                    typeof shotNumber === 'number' || typeof shotNumber === 'string' ? `Shot ${shotNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ');

                  return (
                    <div key={`${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-800">
                          {label || `Shot ${idx + 1}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {(segment as any).status ? String((segment as any).status) : ''}
                        </div>
                      </div>

                      {text ? (
                        <pre className="mb-3 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                          {text}
                        </pre>
                      ) : null}

                      {segAudioSegments?.length ? (
                        <AudioSegmentsPlayer segments={segAudioSegments} fallbackUrl={segAudioUrl} />
                      ) : segAudioUrl ? (
                        <audio src={segAudioUrl} controls className="w-full" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Raw snapshots
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-600">input_snapshot</div>
                <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                  {JSON.stringify(nodeRun.input_snapshot, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-600">output_snapshot</div>
                <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                  {JSON.stringify(nodeRun.output_snapshot, null, 2)}
                </pre>
              </div>
              {nodeRun.errors?.length ? (
                <div>
                  <div className="mb-2 text-xs font-semibold text-rose-700">errors</div>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-rose-950 p-3 font-mono text-xs text-rose-100 whitespace-pre-wrap">
                    {nodeRun.errors.join('\n')}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-blue-100 text-blue-700',
    running: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-slate-200 text-slate-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? colors.queued}`}
    >
      {status}
    </span>
  );
}

function NodeStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-blue-100 text-blue-700',
    running: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? colors.queued}`}
    >
      {status}
    </span>
  );
}
