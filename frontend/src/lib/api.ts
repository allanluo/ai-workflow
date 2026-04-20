export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787/api/v1';

export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  primary_output_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  metadata: Record<string, unknown>;
}

export type LLMEmbedResponse = {
  model?: string;
  dim?: number;
  embedding: number[];
};

export async function embedText(input: { text: string; model?: string }): Promise<LLMEmbedResponse> {
  const response = await fetch(`${API_BASE_URL}/llm/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: input.text, model: input.model }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`Embedding request failed with ${response.status}: ${err}`);
  }

  const data = (await response.json()) as LLMEmbedResponse;
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding response missing embedding vector.');
  }
  return data;
}

export interface ProjectEvent {
  id: string;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  workflow_run_id: string | null;
  node_run_id: string | null;
  export_job_id: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface FileRecord {
  id: string;
  project_id: string;
  asset_version_id: string | null;
  file_role: string;
  storage_type: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  project_id: string;
  version_number: number;
  previous_version_id: string | null;
  parent_asset_id: string | null;
  status: string;
  approval_state: string;
  source_mode: string;
  created_by: string | null;
  edited_by_last: string | null;
  workflow_version_id: string | null;
  workflow_run_id: string | null;
  node_run_id: string | null;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  locked_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  asset_type: string;
  asset_category: string;
  title: string | null;
  current_version_number: number;
  current_asset_version_id: string | null;
  current_approved_asset_version_id: string | null;
  status: string;
  approval_state: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  current_version: AssetVersion | null;
  current_approved_version: AssetVersion | null;
}

export interface WorkflowDefinition {
  id: string;
  project_id: string;
  title: string;
  description: string;
  mode: 'simple' | 'guided' | 'advanced';
  status: 'draft' | 'testing' | 'approved' | 'deprecated';
  template_type: string;
  current_version_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  defaults: Record<string, unknown>;
  nodes: unknown[];
  edges: unknown[];
  metadata: Record<string, unknown>;
}

export interface WorkflowVersion {
  id: string;
  workflow_definition_id: string;
  project_id: string;
  version_number: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  graph_hash: string;
  template_type: string;
  frozen_workflow: Record<string, unknown>;
  input_asset_versions: Record<string, unknown>;
  runtime_environment: Record<string, unknown>;
  notes: string;
  created_at: string;
}

export interface WorkflowValidation {
  status: 'pass' | 'warn' | 'fail';
  missing_references: unknown[];
  missing_bindings: unknown[];
  invalid_node_configs: unknown[];
  warnings: string[];
  errors: string[];
}

export interface WorkflowRun {
  id: string;
  workflow_version_id: string;
  project_id: string;
  status: string;
  triggered_by: string | null;
  trigger_source: string;
  rerun_of_workflow_run_id: string | null;
  started_at: string;
  ended_at: string | null;
  resolved_input_snapshot: Record<string, unknown>;
  summary: Record<string, unknown>;
  logs: string[];
  warnings: string[];
  errors: string[];
  created_at: string;
}

export interface Output {
  id: string;
  project_id: string;
  title: string;
  output_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface NodeRun {
  id: string;
  workflow_run_id: string;
  workflow_version_id: string;
  project_id: string;
  node_id: string;
  node_type: string;
  status: string;
  position: number;
  started_at: string;
  ended_at: string | null;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  logs: string[];
  warnings: string[];
  errors: string[];
  created_at: string;
  updated_at: string;
}

export interface HealthResponse {
  ok: boolean;
  data: {
    name: string;
    version: string;
    timestamp: string;
    database: {
      status: 'connected' | 'not_configured';
      dialect: 'sqlite';
    };
  };
  error: null;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/projects`);

  if (!response.ok) {
    throw new Error(`Projects request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: Project[] };
  };

  return payload.data.items;
}

export async function fetchProjectById(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);

  if (!response.ok) {
    throw new Error(`Project request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { project: Project };
  };

  return payload.data.project;
}

export async function createProject(input: {
  title: string;
  description: string;
  primary_output_type: string | null;
}) {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Create project failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { project: Project };
  };

  return payload.data.project;
}

export async function fetchProjectEvents(projectId: string): Promise<ProjectEvent[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/events`);

  if (!response.ok) {
    throw new Error(`Project events request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: ProjectEvent[] };
  };

  return payload.data.items;
}

export async function fetchProjectFiles(projectId: string): Promise<FileRecord[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/files`);

  if (!response.ok) {
    throw new Error(`Project files request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: FileRecord[] };
  };

  return payload.data.items;
}

export async function fetchCopilotSession(projectId: string): Promise<{
  session: { id: string; project_id: string; state: Record<string, unknown>; created_at: string; updated_at: string } | null;
}> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/session`);
  if (!response.ok) {
    throw new Error(`Copilot session request failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    ok: boolean;
    data: { session: any };
  };
  return { session: payload.data.session };
}

export async function saveCopilotSession(projectId: string, state: Record<string, unknown>): Promise<{
  session: { id: string; project_id: string; state: Record<string, unknown>; created_at: string; updated_at: string };
}> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/session`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!response.ok) {
    throw new Error(`Copilot session save failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    ok: boolean;
    data: { session: any };
  };
  return { session: payload.data.session };
}

export async function appendCopilotAuditEvents(projectId: string, events: Array<Record<string, unknown>>) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  if (!response.ok) {
    throw new Error(`Copilot audit append failed with ${response.status}`);
  }
  const payload = (await response.json()) as { ok: boolean; data: { inserted: number } };
  return payload.data;
}

export async function fetchCopilotAuditEvents(
  projectId: string,
  input?: { limit?: number }
): Promise<{ items: Array<Record<string, unknown>> }> {
  const params = new URLSearchParams();
  if (input?.limit) params.set('limit', String(input.limit));
  const qs = params.toString();

  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/copilot/audit${qs ? `?${qs}` : ''}`
  );
  if (!response.ok) {
    throw new Error(`Copilot audit request failed with ${response.status}`);
  }
  const payload = (await response.json()) as { ok: boolean; data: { items: Array<Record<string, unknown>> } };
  return { items: payload.data.items };
}

export async function createCopilotPlanRun(input: {
  projectId: string;
  plan: Record<string, unknown>;
  context: Record<string, unknown>;
  confirmed: boolean;
}): Promise<{ run: Record<string, unknown>; steps: Array<Record<string, unknown>> }> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/copilot/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: input.plan, context: input.context, confirmed: input.confirmed }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Create copilot run failed (${response.status}): ${text || 'Unknown error'}`);
  }
  const payload = (await response.json()) as { ok: boolean; data: { run: any; steps: any[] } };
  return { run: payload.data.run, steps: payload.data.steps };
}

export async function fetchCopilotPlanRun(projectId: string, runId: string): Promise<{ run: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/runs/${runId}`);
  if (!response.ok) throw new Error(`Copilot run request failed with ${response.status}`);
  const payload = (await response.json()) as { ok: boolean; data: { run: any } };
  return { run: payload.data.run };
}

export async function fetchCopilotPlanRunSteps(projectId: string, runId: string): Promise<{ items: any[] }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/runs/${runId}/steps`);
  if (!response.ok) throw new Error(`Copilot run steps request failed with ${response.status}`);
  const payload = (await response.json()) as { ok: boolean; data: { items: any[] } };
  return { items: payload.data.items };
}

export async function cancelCopilotPlanRun(projectId: string, runId: string): Promise<{ run: any }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/runs/${runId}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Copilot run cancel failed with ${response.status}`);
  const payload = (await response.json()) as { ok: boolean; data: { run: any } };
  return { run: payload.data.run };
}

export async function applyCopilotProposal(input: {
  projectId: string;
  proposal: Record<string, unknown>;
  confirmed: boolean;
}): Promise<{ result: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/copilot/apply-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal: input.proposal, confirmed: input.confirmed }),
  });
  const payloadText = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const msg = payload?.error?.message || payloadText || `Apply proposal failed with ${response.status}`;
    throw new Error(msg);
  }
  return { result: payload?.data?.result ?? {} };
}

export type CopilotSemanticSearchHit = {
  id: string;
  context_type: string;
  item_id: string;
  item_version_id: string | null;
  chunk_id: string;
  chunk_index: number;
  chunk_count: number;
  model: string;
  score: number;
  content: string;
  indexed_at: string;
};

export async function semanticSearchCopilotIndex(input: {
  projectId: string;
  query: string;
  model?: string;
  context_types?: string[];
  limit?: number;
}): Promise<{ items: CopilotSemanticSearchHit[]; model: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/copilot/semantic-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      model: input.model,
      context_types: input.context_types,
      limit: input.limit,
    }),
  });
  const text = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const msg = payload?.error?.message || text || `Semantic search failed with ${response.status}`;
    throw new Error(msg);
  }
  return { items: (payload?.data?.items ?? []) as CopilotSemanticSearchHit[], model: String(payload?.data?.model ?? '') };
}

export async function reindexCopilotSemanticIndex(input: {
  projectId: string;
  model?: string;
  context_types?: Array<'asset' | 'workflow' | 'run' | 'node_run'>;
  max_runs?: number;
  max_node_runs_per_run?: number;
}): Promise<{
  queued: number;
  model: string | null;
  picked_model?: string | null;
  types: Array<'asset' | 'workflow' | 'run' | 'node_run'>;
  max_runs?: number;
  max_node_runs_per_run?: number;
}> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/copilot/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      context_types: input.context_types,
      max_runs: input.max_runs,
      max_node_runs_per_run: input.max_node_runs_per_run,
    }),
  });
  const text = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const msg = payload?.error?.message || text || `Reindex failed with ${response.status}`;
    throw new Error(msg);
  }
  return payload?.data ?? { queued: 0, model: null, picked_model: null, types: [] };
}

export async function fetchCopilotIndexStatus(projectId: string): Promise<{
  project_id: string;
  total: number;
  models: Record<
    string,
    { total: number; by_context_type: Record<string, number>; last_indexed_at: string | null }
  >;
}> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/index-status`);
  const text = await response.text().catch(() => '');
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const msg = payload?.error?.message || text || `Index status failed with ${response.status}`;
    throw new Error(msg);
  }
  return payload?.data ?? { project_id: projectId, total: 0, models: {} };
}

export async function uploadProjectFile(input: {
  projectId: string;
  file: File;
  role: string;
  assetType?: string;
}) {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('role', input.role);

  if (input.assetType) {
    formData.append('asset_type', input.assetType);
  }

  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/files`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`File upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { file: FileRecord };
  };

  return payload.data.file;
}

export async function fetchProjectAssets(projectId: string, assetType?: string): Promise<Asset[]> {
  const url = new URL(`${API_BASE_URL}/projects/${projectId}/assets`);

  if (assetType) {
    url.searchParams.set('asset_type', assetType);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Project assets request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: Asset[] };
  };

  return payload.data.items;
}

export async function createAsset(input: {
  projectId: string;
  asset_type: string;
  asset_category: string;
  title: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  source_mode: 'manual' | 'copilot' | 'workflow' | 'import' | 'system';
  status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asset_type: input.asset_type,
      asset_category: input.asset_category,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
      source_mode: input.source_mode,
      status: input.status ?? 'draft',
    }),
  });

  if (!response.ok) {
    throw new Error(`Create asset failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { asset: Asset };
  };

  return payload.data.asset;
}

export async function updateAsset(
  assetId: string,
  updates: {
    title?: string;
    content?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    status?: string;
  }
) {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Update asset failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { asset: Asset };
  };

  return payload.data.asset;
}

export async function fetchAsset(assetId: string): Promise<Asset> {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}`);

  if (!response.ok) {
    throw new Error(`Asset request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { asset: Asset };
  };

  return payload.data.asset;
}

export async function createAssetVersion(
  assetId: string,
  input: {
    content?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
    source_mode?: 'manual' | 'copilot' | 'workflow' | 'import' | 'system';
    locked_fields?: string[];
    make_current?: boolean;
  }
): Promise<AssetVersion> {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Create asset version failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { asset_version: AssetVersion };
  };

  return payload.data.asset_version;
}

export async function fetchProjectWorkflows(projectId: string): Promise<WorkflowDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/workflows`);

  if (!response.ok) {
    throw new Error(`Project workflows request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: WorkflowDefinition[] };
  };

  return payload.data.items;
}

export async function fetchWorkflowById(workflowId: string): Promise<WorkflowDefinition> {
  const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`);

  if (!response.ok) {
    throw new Error(`Workflow request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow: WorkflowDefinition };
  };

  return payload.data.workflow;
}

export async function fetchNodeRuns(workflowRunId: string): Promise<NodeRun[]> {
  const response = await fetch(`${API_BASE_URL}/workflow-runs/${workflowRunId}/node-runs`);

  if (!response.ok) {
    throw new Error(`Node runs request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: NodeRun[] };
  };

  return payload.data.items;
}

export interface ImageGenerationResult {
  job_id: string;
  image_url?: string;
  status: string;
}

export interface VideoGenerationResult {
  job_id: string;
  prompt_id?: string;
  video_path?: string;
  video_url?: string;
  status: string;
}

export interface VoiceOverGenerationResult {
  job_id: string;
  status: string;
  audio_url?: string;
  audio_path?: string;
  provider?: string;
}

export interface SoundEffectGenerationResult {
  job_id: string;
  status: string;
  prompt_id?: string;
  audio_url?: string;
  audio_path?: string;
}

export interface JobStatus {
  job_id: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  artifacts?: Record<string, unknown>;
}

export async function generateCharacterImage(input: {
  projectId: string;
  prompt: string;
  width?: number;
  height?: number;
}): Promise<ImageGenerationResult> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${input.projectId}/images`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        width: input.width ?? 1024,
        height: input.height ?? 1024,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Image generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: ImageGenerationResult;
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Image generation failed');
  }

  return payload.data;
}

export async function generateProjectVideo(input: {
  projectId: string;
  prompt: string;
  workflow?: string;
  width?: number;
  height?: number;
}): Promise<VideoGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      workflow: input.workflow,
      width: input.width ?? 1024,
      height: input.height ?? 576,
    }),
  });

  if (!response.ok) {
    throw new Error(`Video generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: VideoGenerationResult;
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Video generation failed');
  }

  return payload.data;
}

export async function generateVideoFromImage(input: {
  projectId: string;
  prompt: string;
  workflow?: string;
  width?: number;
  height?: number;
  length?: number;
  reference_image_url: string;
}): Promise<VideoGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/videos/from-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      workflow: input.workflow,
      width: input.width,
      height: input.height,
      length: input.length,
      reference_image_url: input.reference_image_url,
    }),
  });

  if (!response.ok) {
    throw new Error(`Video generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: VideoGenerationResult;
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Video generation failed');
  }

  return payload.data;
}

export async function generateVoiceOver(input: {
  projectId: string;
  text: string;
  template?: string;
  provider?: 'piper' | 'cosyvoice';
  speed?: number;
  volume?: number;
  prompt_text?: string;
  prompt_wav?: string;
  model_dir?: string;
}): Promise<VoiceOverGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/voiceovers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      template: input.template,
      provider: input.provider,
      speed: input.speed,
      volume: input.volume,
      prompt_text: input.prompt_text,
      prompt_wav: input.prompt_wav,
      model_dir: input.model_dir,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voice-over generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: VoiceOverGenerationResult;
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Voice-over generation failed');
  }

  return payload.data;
}

export async function generateSoundEffect(input: {
  projectId: string;
  prompt: string;
  workflow?: string;
  duration_seconds?: number;
  batch_size?: number;
  negative_prompt?: string;
}): Promise<SoundEffectGenerationResult> {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/sounds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      workflow: input.workflow,
      duration_seconds: input.duration_seconds,
      batch_size: input.batch_size,
      negative_prompt: input.negative_prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sound generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: SoundEffectGenerationResult;
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Sound generation failed');
  }

  return payload.data;
}

export async function fetchJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error(`Job status request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { job: JobStatus };
    error: { message: string } | null;
  };

  if (!payload.ok) {
    throw new Error(payload.error?.message ?? 'Job status request failed');
  }

  return payload.data.job;
}

export async function createWorkflow(input: {
  projectId: string;
  title: string;
  description: string;
  mode: 'simple' | 'guided' | 'advanced';
  template_type: string;
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      mode: input.mode,
      template_type: input.template_type,
      defaults: input.defaults ?? {},
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
      metadata: input.metadata ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Create workflow failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow: WorkflowDefinition };
  };

  return payload.data.workflow;
}

export async function updateWorkflow(input: {
  workflowId: string;
  title?: string;
  description?: string;
  mode?: 'simple' | 'guided' | 'advanced';
  status?: 'draft' | 'testing' | 'approved' | 'deprecated';
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${API_BASE_URL}/workflows/${input.workflowId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      mode: input.mode,
      status: input.status,
      defaults: input.defaults,
      nodes: input.nodes,
      edges: input.edges,
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`Update workflow failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow: WorkflowDefinition };
  };

  return payload.data.workflow;
}

export async function deleteWorkflow(workflowId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Delete workflow failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { deleted: boolean };
  };

  return payload.data.deleted;
}

export async function validateWorkflow(workflowId: string): Promise<WorkflowValidation> {
  const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/validate`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Validate workflow failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { validation: WorkflowValidation };
  };

  return payload.data.validation;
}

export async function fetchWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
  const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/versions`);

  if (!response.ok) {
    throw new Error(`Workflow versions request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: WorkflowVersion[] };
  };

  return payload.data.items;
}

export async function createWorkflowVersion(input: { workflowId: string; notes: string }) {
  const response = await fetch(`${API_BASE_URL}/workflows/${input.workflowId}/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_asset_versions: {},
      runtime_environment: {},
      notes: input.notes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Create workflow version failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow_version: WorkflowVersion };
  };

  return payload.data.workflow_version;
}

export async function fetchProjectWorkflowRuns(
  projectId: string,
  workflowVersionId?: string
): Promise<WorkflowRun[]> {
  const url = new URL(`${API_BASE_URL}/projects/${projectId}/workflow-runs`);

  if (workflowVersionId) {
    url.searchParams.set('workflow_version_id', workflowVersionId);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Workflow runs request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { items: WorkflowRun[] };
  };

  return payload.data.items;
}

export async function fetchWorkflowRunById(workflowRunId: string): Promise<WorkflowRun> {
  const response = await fetch(`${API_BASE_URL}/workflow-runs/${workflowRunId}`);
  if (!response.ok) {
    throw new Error(`Workflow run request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow_run: WorkflowRun };
  };

  return payload.data.workflow_run;
}

export async function createWorkflowRun(input: {
  workflowVersionId: string;
  trigger_source?: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/workflow-versions/${input.workflowVersionId}/runs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger_source: input.trigger_source ?? 'manual',
        rerun_of_workflow_run_id: null,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Create workflow run failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { workflow_run: WorkflowRun };
  };

  return payload.data.workflow_run;
}

export async function createOutput(input: { projectId: string; title: string; output_type: string }) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/outputs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      output_type: input.output_type,
    }),
  });

  if (!response.ok) {
    throw new Error(`Create output failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { output: Output };
  };

  return payload.data.output;
}

export async function emitCopilotStepUpdate(input: {
  projectId: string;
  runId: string;
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: unknown;
  error?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/copilot/runs/${input.runId}/steps/${input.stepId}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: input.status,
      result: input.result,
      error: input.error,
    }),
  });

  if (!response.ok) {
    // Don't throw, just log - progress updates are not critical
    console.warn(`Failed to emit step update: ${response.status}`);
  }
}

export async function emitProjectEvent(input: {
  projectId: string;
  event_type: string;
  target_type?: string;
  target_id?: string;
  payload?: Record<string, unknown>;
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: input.event_type,
      target_type: input.target_type,
      target_id: input.target_id,
      payload: input.payload,
    }),
  });

  if (!response.ok) {
    console.warn(`Failed to emit project event: ${response.status}`);
  }
}

export type CopilotPlanStep = {
  id: string;
  run_id: string;
  project_id: string;
  step_index: number;
  step_id: string;
  title: string;
  tool: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  params: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
  started_at?: string;
  ended_at?: string;
  updated_at: string;
} & Record<string, unknown>;

export async function fetchCopilotPlanStep(projectId: string, runId: string, stepId: string): Promise<CopilotPlanStep> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/copilot/runs/${runId}/steps/${stepId}`);

  if (!response.ok) {
    throw new Error(`Copilot plan step request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    data: { step: CopilotPlanStep };
  };

  return payload.data.step;
}
