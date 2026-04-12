import { z } from 'zod';

export const projectEventTypes = [
  'project_created',
  'asset_created',
  'asset_created_from_workflow',
  'workflow_run_created',
  'workflow_run_started',
  'workflow_run_progress',
  'workflow_run_completed',
  'workflow_run_failed',
  'node_run_started',
  'node_run_completed',
] as const;

export const assetCategories = ['story', 'visual', 'audio', 'video', 'script'] as const;
export const assetStatuses = [
  'draft',
  'needs_revision',
  'ready',
  'locked',
  'deprecated',
  'failed',
] as const;
export const approvalStates = ['unapproved', 'approved', 'rejected'] as const;
export const workflowModes = ['guided', 'code', 'hybrid'] as const;
export const workflowStatuses = ['draft', 'published', 'archived'] as const;
export const workflowRunStatuses = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export const nodeRunStatuses = ['queued', 'running', 'completed', 'failed', 'skipped'] as const;
export const validationStatuses = ['pass', 'warn', 'fail'] as const;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  primary_output_type: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createAssetSchema = z.object({
  asset_type: z.string().min(1),
  asset_category: z.enum(assetCategories),
  title: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createWorkflowSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  mode: z.enum(workflowModes),
  template_type: z.string().min(1),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      data: z.record(z.unknown()).optional(),
      params: z.record(z.unknown()).optional(),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().optional(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    })
  ),
});

export const createAssetVersionSchema = z.object({
  content: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(assetStatuses).optional(),
  make_current: z.boolean().optional(),
});

export const createWorkflowVersionSchema = z.object({
  notes: z.string().optional(),
  input_asset_versions: z.record(z.string()).optional(),
  runtime_environment: z.record(z.unknown()).optional(),
});

export const approveAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  notes: z.string().optional(),
});

export const validateWorkflowSchema = z.object({
  workflow_version_id: z.string().optional(),
});

export type IpcInputSchemas = {
  createProject: z.infer<typeof createProjectSchema>;
  createAsset: z.infer<typeof createAssetSchema>;
  createWorkflow: z.infer<typeof createWorkflowSchema>;
  createAssetVersion: z.infer<typeof createAssetVersionSchema>;
  createWorkflowVersion: z.infer<typeof createWorkflowVersionSchema>;
  approveAsset: z.infer<typeof approveAssetSchema>;
  validateWorkflow: z.infer<typeof validateWorkflowSchema>;
};

export function validateIpcInput<T extends keyof IpcInputSchemas>(
  schema: T,
  input: unknown
): IpcInputSchemas[T] {
  switch (schema) {
    case 'createProject':
      return createProjectSchema.parse(input) as IpcInputSchemas[T];
    case 'createAsset':
      return createAssetSchema.parse(input) as IpcInputSchemas[T];
    case 'createWorkflow':
      return createWorkflowSchema.parse(input) as IpcInputSchemas[T];
    case 'createAssetVersion':
      return createAssetVersionSchema.parse(input) as IpcInputSchemas[T];
    case 'createWorkflowVersion':
      return createWorkflowVersionSchema.parse(input) as IpcInputSchemas[T];
    case 'approveAsset':
      return approveAssetSchema.parse(input) as IpcInputSchemas[T];
    case 'validateWorkflow':
      return validateWorkflowSchema.parse(input) as IpcInputSchemas[T];
  }
}
