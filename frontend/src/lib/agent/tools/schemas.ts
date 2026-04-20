import { z } from 'zod';

// Keep schemas minimal and permissive for now; tighten as tools expand.

export const ProjectSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const AssetSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    asset_type: z.string(),
    status: z.string(),
    updated_at: z.string(),
    current_asset_version_id: z.string().nullable().optional(),
    current_approved_asset_version_id: z.string().nullable().optional(),
    current_version: z.unknown().nullable().optional(),
    current_approved_version: z.unknown().nullable().optional(),
  })
  .passthrough();

export const AssetListSchema = z.array(AssetSchema);

export const AssetVersionSchema = z
  .object({
    id: z.string(),
    asset_id: z.string(),
    project_id: z.string(),
    version_number: z.number(),
    status: z.string(),
    approval_state: z.string(),
    source_mode: z.string(),
    content: z.record(z.unknown()),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const WorkflowDefinitionSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    title: z.string(),
    description: z.string(),
    mode: z.enum(['simple', 'guided', 'advanced']),
    status: z.string(),
    template_type: z.string(),
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const WorkflowDefinitionListSchema = z.array(WorkflowDefinitionSchema);

export const WorkflowVersionSchema = z
  .object({
    id: z.string(),
    workflow_definition_id: z.string(),
    project_id: z.string(),
    version_number: z.number(),
    status: z.string(),
    template_type: z.string().optional(),
    created_at: z.string(),
  })
  .passthrough();

export const WorkflowVersionListSchema = z.array(WorkflowVersionSchema);

export const WorkflowRunSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    workflow_version_id: z.string(),
    status: z.string(),
    started_at: z.string(),
    ended_at: z.string().nullable().optional(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export const WorkflowRunListSchema = z.array(WorkflowRunSchema);

export const NodeRunSchema = z
  .object({
    id: z.string(),
    workflow_run_id: z.string(),
    project_id: z.string(),
    node_id: z.string(),
    node_type: z.string().optional(),
    status: z.string(),
    started_at: z.string().optional(),
    ended_at: z.string().nullable().optional(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export const NodeRunListSchema = z.array(NodeRunSchema);

export const ProjectEventSchema = z
  .object({
    id: z.string(),
    event_type: z.string(),
    created_at: z.string(),
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const ProjectEventListSchema = z.array(ProjectEventSchema);

export const FileRecordSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    file_path: z.string(),
    file_role: z.string(),
    created_at: z.string(),
  })
  .passthrough();

export const FileRecordListSchema = z.array(FileRecordSchema);

export const JobStatusSchema = z
  .object({
    job_id: z.string(),
    type: z.string(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    artifacts: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const ImageGenerationResultSchema = z
  .object({
    job_id: z.string(),
    status: z.string(),
    image_url: z.string().optional(),
  })
  .passthrough();

export const VideoGenerationResultSchema = z
  .object({
    job_id: z.string(),
    status: z.string(),
    prompt_id: z.string().optional(),
    video_path: z.string().optional(),
    video_url: z.string().optional(),
  })
  .passthrough();

export const VoiceOverGenerationResultSchema = z
  .object({
    job_id: z.string(),
    status: z.string(),
    audio_url: z.string().optional(),
    audio_path: z.string().optional(),
    provider: z.string().optional(),
  })
  .passthrough();

export const SoundEffectGenerationResultSchema = z
  .object({
    job_id: z.string(),
    status: z.string(),
    prompt_id: z.string().optional(),
    audio_url: z.string().optional(),
    audio_path: z.string().optional(),
  })
  .passthrough();

export const CopilotPlanStepSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    project_id: z.string(),
    step_index: z.number(),
    step_id: z.string(),
    title: z.string(),
    tool: z.string(),
    status: z.enum(['pending', 'running', 'success', 'error', 'skipped']),
    params: z.record(z.unknown()),
    result: z.unknown().optional(),
    error: z.unknown().optional(),
    started_at: z.string().optional(),
    ended_at: z.string().optional(),
    updated_at: z.string(),
  })
  .passthrough();
