import { create } from 'zustand';
import { getWorkflowNodeDefinition } from '../lib/workflowCatalog';

export interface EditableNode {
  id: string;
  type: string;
  catalogType: string;
  label: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  position: {
    x: number;
    y: number;
  };
}

export interface EditableEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowDraftState {
  title: string;
  description: string;
  mode: 'simple' | 'guided' | 'advanced';
  status: 'draft' | 'testing' | 'approved' | 'deprecated';
  templateType: string;
  defaultsText: string;
  metadataText: string;
  nodes: EditableNode[];
  edges: EditableEdge[];
}

interface DraftStore {
  draft: WorkflowDraftState | null;
  viewingVersionId: string | null;
  setDraft: (draft: WorkflowDraftState | ((prev: WorkflowDraftState | null) => WorkflowDraftState | null) | null) => void;
  updateDraft: (updater: (draft: WorkflowDraftState) => void) => void;
  setViewingVersionId: (id: string | null) => void;
}

export function toEditableNode(node: unknown): EditableNode {
  const value = typeof node === 'object' && node !== null ? (node as Record<string, unknown>) : {};
  const data =
    typeof value.data === 'object' && value.data !== null && !Array.isArray(value.data)
      ? (value.data as Record<string, unknown>)
      : {};
  const params =
    typeof value.params === 'object' && value.params !== null && !Array.isArray(value.params)
      ? (value.params as Record<string, unknown>)
      : {};

  const catalogType =
    typeof data.catalog_type === 'string' ? data.catalog_type : inferCatalogType(value.type);

  const definition = getWorkflowNodeDefinition(catalogType);
  const runtimeType = definition ? definition.runtimeType : (typeof value.type === 'string' ? value.type : 'input');

  return {
    id: typeof value.id === 'string' ? value.id : `node-${Math.random().toString(36).slice(2, 7)}`,
    type: runtimeType,
    catalogType,
    label:
      typeof data.label === 'string'
        ? data.label
        : (definition?.defaultLabel ?? 'Workflow Step'),
    params,
    data,
    position: getGraphPosition(data) ?? { x: 0, y: 0 },
  };
}

export function getEditableNodeDefinition(node: EditableNode) {
  return getWorkflowNodeDefinition(node.catalogType);
}

export function toEditableEdge(edge: unknown): EditableEdge {
  const value = typeof edge === 'object' && edge !== null ? (edge as Record<string, unknown>) : {};

  return {
    id: typeof value.id === 'string' ? value.id : `edge-${Math.random().toString(36).slice(2, 7)}`,
    source: typeof value.source === 'string' ? value.source : '',
    target: typeof value.target === 'string' ? value.target : '',
  };
}

export function inferCatalogType(runtimeType: unknown) {
  switch (runtimeType) {
    case 'input':
      return 'story_input';
    case 'llm_text':
      return 'generate_scenes';
    case 'image_generation':
      return 'generate_image';
    case 'video_generation':
      return 'generate_video_clip';
    case 'tts':
      return 'generate_narration';
    case 'output':
      return 'render_preview';
    default:
      return 'story_input';
  }
}

export function getGraphPosition(data: Record<string, unknown>) {
  const candidate = data.graph_position;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  if (typeof record.x !== 'number' || typeof record.y !== 'number') {
    return null;
  }

  return {
    x: record.x,
    y: record.y,
  };
}

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonRecord(text: string, label: string) {
  try {
    const parsed = JSON.parse(text || '{}') as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Invalid ${label.toLowerCase()} JSON`);
  }
}

export function toDraftState(workflow: any): WorkflowDraftState {
  return {
    title: workflow.title,
    description: workflow.description,
    mode: workflow.mode || 'advanced',
    status: workflow.status,
    templateType: workflow.template_type,
    defaultsText: formatJson(workflow.defaults),
    metadataText: formatJson(workflow.metadata),
    nodes: Array.isArray(workflow.nodes) ? workflow.nodes.map(toEditableNode) : [],
    edges: Array.isArray(workflow.edges) ? workflow.edges.map(toEditableEdge) : [],
  };
}

export function serializeDraft(draft: WorkflowDraftState) {
  return JSON.stringify({
    title: draft.title,
    description: draft.description,
    mode: draft.mode,
    status: draft.status,
    templateType: draft.templateType,
    defaultsText: draft.defaultsText,
    metadataText: draft.metadataText,
    nodes: draft.nodes,
    edges: draft.edges,
  });
}

export function buildWorkflowPayload(draft: WorkflowDraftState) {
  const defaults = parseJsonRecord(draft.defaultsText, 'Defaults');
  const metadata = parseJsonRecord(draft.metadataText, 'Metadata');
  const nodes = draft.nodes.map((node, index) => {
    const nodeId = node.id.trim();
    const nodeType = node.type.trim();

    if (!nodeId) {
      throw new Error(`Step ${index + 1} is missing an id`);
    }

    if (!nodeType) {
      throw new Error(`Step ${index + 1} is missing a runtime type`);
    }

    return {
      id: nodeId,
      type: nodeType,
      params: node.params,
      data: {
        ...node.data,
        label: node.label.trim(),
        catalog_type: node.catalogType,
        graph_position: node.position,
      },
    };
  });

  const edges = draft.edges.map((edge, index) => {
    const edgeId = edge.id.trim();
    const source = edge.source.trim();
    const target = edge.target.trim();

    if (!edgeId) {
      throw new Error(`Connection ${index + 1} is missing an id`);
    }
    if (!source || !target) {
      throw new Error(`Connection ${index + 1} is incomplete`);
    }

    return { id: edgeId, source, target };
  });

  return {
    title: draft.title,
    description: draft.description,
    mode: draft.mode,
    status: draft.status,
    template_type: draft.templateType,
    defaults,
    metadata,
    nodes,
    edges,
  };
}

export const useDraftStore = create<DraftStore>((set) => ({
  draft: null,
  viewingVersionId: null,
  setDraft: (draftOrFn) => set((state) => ({
    draft: typeof draftOrFn === 'function' ? draftOrFn(state.draft) : draftOrFn
  })),
  updateDraft: (updater) => set((state) => {
    if (!state.draft) return state;
    // Create a shallow copy before mutating to trigger React re-renders correctly
    const newDraft = { ...state.draft };
    updater(newDraft);
    return { draft: newDraft };
  }),
  setViewingVersionId: (viewingVersionId) => set({ viewingVersionId }),
}));
