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
