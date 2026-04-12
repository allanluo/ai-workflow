export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  primary_output_type?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export type ProjectStatus = 'active' | 'archived' | 'completed';

export interface Asset {
  id: string;
  project_id: string;
  asset_type: string;
  asset_category: AssetCategory;
  title?: string;
  current_version_number: number;
  current_version_id?: string;
  current_approved_version_id?: string;
  status: AssetStatus;
  approval_state: ApprovalState;
  created_by?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export type AssetCategory = 'story' | 'visual' | 'audio' | 'video' | 'script';
export type AssetStatus = 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
export type ApprovalState = 'unapproved' | 'approved' | 'rejected';

export interface AssetVersion {
  id: string;
  asset_id: string;
  project_id: string;
  version_number: number;
  previous_version_id?: string;
  parent_asset_id?: string;
  status: AssetStatus;
  approval_state: ApprovalState;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDefinition {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  mode: WorkflowMode;
  status: WorkflowStatus;
  template_type: string;
  current_version_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type WorkflowMode = 'guided' | 'code' | 'hybrid';
export type WorkflowStatus = 'draft' | 'published' | 'archived';

export interface WorkflowVersion {
  id: string;
  workflow_definition_id: string;
  project_id: string;
  version_number: number;
  frozen_workflow: WorkflowGraph;
  input_asset_versions?: Record<string, string>;
  runtime_environment?: Record<string, unknown>;
  validation?: WorkflowValidation;
  created_by?: string;
  created_at: string;
}

export interface WorkflowValidation {
  status: ValidationStatus;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationError {
  node_id: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  node_id: string;
  message: string;
}

export interface WorkflowRun {
  id: string;
  workflow_version_id: string;
  project_id: string;
  status: WorkflowRunStatus;
  triggered_by?: string;
  trigger_source?: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
}

export type WorkflowRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NodeRun {
  id: string;
  workflow_run_id: string;
  node_id: string;
  node_type: string;
  status: NodeRunStatus;
  position: number;
  started_at: string;
  ended_at?: string;
  input_snapshot?: Record<string, unknown>;
  output_snapshot?: Record<string, unknown>;
  created_at: string;
}

export type NodeRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ProjectEvent {
  id: string;
  project_id: string;
  event_type: ProjectEventType;
  target_type?: string;
  target_id?: string;
  workflow_run_id?: string;
  node_run_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export type ProjectEventType =
  | 'project_created'
  | 'asset_created'
  | 'asset_created_from_workflow'
  | 'workflow_run_created'
  | 'workflow_run_started'
  | 'workflow_run_progress'
  | 'workflow_run_completed'
  | 'workflow_run_failed'
  | 'node_run_started'
  | 'node_run_completed';

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  primary_output_type?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAssetInput {
  asset_type: string;
  asset_category: AssetCategory;
  title?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateAssetVersionInput {
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: AssetStatus;
  make_current?: boolean;
}

export interface CreateWorkflowInput {
  title: string;
  description?: string;
  mode: WorkflowMode;
  template_type: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface CreateWorkflowVersionInput {
  notes?: string;
  input_asset_versions?: Record<string, string>;
  runtime_environment?: Record<string, unknown>;
}

export interface Comment {
  id: string;
  project_id: string;
  asset_version_id?: string;
  node_run_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  resolved: boolean;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  project_id: string;
  asset_id: string;
  asset_version_id: string;
  approved_by: string;
  approver_name: string;
  decision: 'approved' | 'rejected';
  notes?: string;
  created_at: string;
}

export interface Output {
  id: string;
  project_id: string;
  title: string;
  output_type: string;
  status: OutputStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type OutputStatus = 'draft' | 'assembling' | 'ready' | 'exporting' | 'completed' | 'failed';

export interface OutputVersion {
  id: string;
  output_id: string;
  version_number: number;
  status: string;
  assembled_from_asset_version_ids: string[];
  metadata: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

export interface ExportJob {
  id: string;
  project_id: string;
  output_version_id: string;
  export_format: string;
  status: ExportJobStatus;
  progress: number;
  output_path?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CreateCommentInput {
  asset_version_id?: string;
  node_run_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  parent_comment_id?: string;
}

export interface CreateApprovalInput {
  asset_version_id: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}

export interface CreateOutputInput {
  title: string;
  output_type: string;
}

export interface CreateOutputVersionInput {
  assembled_from_asset_version_ids: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateExportJobInput {
  output_version_id: string;
  export_format: string;
}
