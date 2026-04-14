import { createHash, randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './client.js';
import { projectEvents, workflowDefinitions, workflowVersions } from './schema.js';

type WorkflowMode = 'simple' | 'guided' | 'advanced';
type WorkflowDefinitionStatus = 'draft' | 'testing' | 'approved' | 'deprecated';

interface CreateWorkflowInput {
  title: string;
  description?: string;
  mode: WorkflowMode;
  template_type: string;
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
}

interface UpdateWorkflowInput {
  title?: string;
  description?: string;
  mode?: WorkflowMode;
  status?: WorkflowDefinitionStatus;
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
}

interface CreateWorkflowVersionInput {
  input_asset_versions?: Record<string, unknown>;
  runtime_environment?: Record<string, unknown>;
  notes?: string;
}

interface WorkflowNodeRecord {
  id?: unknown;
  type?: unknown;
  params?: unknown;
  data?: unknown;
}

interface WorkflowEdgeRecord {
  id?: unknown;
  source?: unknown;
  target?: unknown;
}

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapWorkflowDefinition(row: typeof workflowDefinitions.$inferSelect) {
  const latestVersion = db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowDefinitionId, row.id))
    .orderBy(desc(workflowVersions.versionNumber))
    .get();

  return {
    id: row.id,
    project_id: row.projectId,
    title: row.title,
    description: row.description ?? '',
    mode: row.mode,
    status: row.status,
    template_type: row.templateType,
    current_version_id: latestVersion?.id ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    defaults: safeParseJson(row.defaultsJson, {}),
    nodes: safeParseJson(row.nodesJson, []),
    edges: safeParseJson(row.edgesJson, []),
    metadata: safeParseJson(row.metadataJson, {}),
  };
}

function mapWorkflowVersion(row: typeof workflowVersions.$inferSelect) {
  return {
    id: row.id,
    workflow_definition_id: row.workflowDefinitionId,
    project_id: row.projectId,
    version_number: row.versionNumber,
    status: row.status,
    approved_by: row.approvedBy,
    approved_at: row.approvedAt,
    graph_hash: row.graphHash,
    template_type: row.templateType,
    frozen_workflow: safeParseJson(row.frozenWorkflowJson, {}),
    input_asset_versions: safeParseJson(row.inputAssetVersionsJson, {}),
    runtime_environment: safeParseJson(row.runtimeEnvironmentJson, {}),
    notes: row.notes ?? '',
    created_at: row.createdAt,
  };
}

function insertWorkflowEvent(
  projectId: string,
  targetId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  db.insert(projectEvents)
    .values({
      id: randomUUID(),
      projectId,
      eventType,
      targetType: 'workflow',
      targetId,
      payloadJson: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    })
    .run();
}

function computeGraphHash(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function asObjectRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asWorkflowNodes(nodes: unknown[]) {
  return nodes.map(node => asObjectRecord(node) as WorkflowNodeRecord);
}

function asWorkflowEdges(edges: unknown[]) {
  return edges.map(edge => asObjectRecord(edge) as WorkflowEdgeRecord);
}

function hasNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function detectCycles(nodeIds: string[], edges: Array<{ source: string; target: string }>) {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
    inDegree.set(nodeId, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = [...nodeIds.filter(nodeId => (inDegree.get(nodeId) ?? 0) === 0)];
  let visited = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }

  return visited !== nodeIds.length;
}

function validateNodeConfig(
  nodeId: string,
  nodeType: string,
  params: Record<string, unknown>,
  errors: string[],
  warnings: string[],
  invalidNodeConfigs: Array<Record<string, unknown>>
) {
  const issues: string[] = [];

  switch (nodeType) {
    case 'input':
      if (!hasNonEmptyString(params.text)) {
        warnings.push(`Input node "${nodeId}" has no text yet.`);
      }
      break;
    case 'llm_text':
    case 'llm':
      if (!hasNonEmptyString(params.prompt)) {
        issues.push('prompt is required');
      }
      break;
    case 'image_generation':
    case 'image':
    case 'generate_image':
      if (!hasNonEmptyString(params.prompt)) {
        issues.push('prompt is required');
      }
      if (params.width !== undefined && !hasPositiveNumber(params.width)) {
        issues.push('width must be a positive number');
      }
      if (params.height !== undefined && !hasPositiveNumber(params.height)) {
        issues.push('height must be a positive number');
      }
      break;
    case 'video_generation':
    case 'video':
    case 'generate_video':
      if (!hasNonEmptyString(params.prompt)) {
        issues.push('prompt is required');
      }
      if (params.width !== undefined && !hasPositiveNumber(params.width)) {
        issues.push('width must be a positive number');
      }
      if (params.height !== undefined && !hasPositiveNumber(params.height)) {
        issues.push('height must be a positive number');
      }
      break;
    case 'tts':
    case 'text_to_speech':
      if (!hasNonEmptyString(params.text)) {
        issues.push('text is required');
      }
      break;
    case 'output':
      break;
    default:
      warnings.push(`Node "${nodeId}" uses unknown node type "${nodeType}".`);
      break;
  }

  if (issues.length > 0) {
    errors.push(`Node "${nodeId}" is invalid: ${issues.join(', ')}.`);
    invalidNodeConfigs.push({
      node_id: nodeId,
      node_type: nodeType,
      issues,
    });
  }
}

export function createWorkflowDefinition(projectId: string, input: CreateWorkflowInput) {
  const id = randomUUID();
  const versionId = randomUUID();
  const timestamp = new Date().toISOString();

  db.insert(workflowDefinitions)
    .values({
      id,
      projectId,
      title: input.title,
      description: input.description ?? '',
      mode: input.mode,
      status: 'draft',
      templateType: input.template_type,
      createdBy: 'user',
      createdAt: timestamp,
      updatedAt: timestamp,
      defaultsJson: JSON.stringify(input.defaults ?? {}),
      nodesJson: JSON.stringify(input.nodes ?? []),
      edgesJson: JSON.stringify(input.edges ?? []),
      metadataJson: JSON.stringify(input.metadata ?? {}),
    })
    .run();

  // Create initial version
  const frozenWorkflow = {
    title: input.title,
    description: input.description ?? '',
    mode: input.mode,
    status: 'draft',
    template_type: input.template_type,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    defaults: input.defaults ?? {},
    metadata: input.metadata ?? {},
  };
  const graphHash = computeGraphHash(frozenWorkflow);

  db.insert(workflowVersions)
    .values({
      id: versionId,
      workflowDefinitionId: id,
      projectId,
      versionNumber: 1,
      status: 'draft',
      approvedBy: null,
      approvedAt: null,
      graphHash,
      templateType: input.template_type,
      frozenWorkflowJson: JSON.stringify(frozenWorkflow),
      inputAssetVersionsJson: JSON.stringify({}),
      runtimeEnvironmentJson: JSON.stringify({}),
      notes: 'Initial version',
      createdAt: timestamp,
    })
    .run();

  insertWorkflowEvent(projectId, id, 'workflow_created', {
    title: input.title,
    template_type: input.template_type,
  });

  const workflow = getWorkflowDefinitionById(id)!;
  // Manually set the current version id since we just created it
  return {
    ...workflow,
    current_version_id: versionId,
  };
}

export function listWorkflowDefinitions(projectId: string) {
  return db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.projectId, projectId))
    .orderBy(desc(workflowDefinitions.updatedAt))
    .all()
    .map(mapWorkflowDefinition);
}

export function getWorkflowDefinitionById(workflowId: string) {
  const row = db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, workflowId))
    .get();

  return row ? mapWorkflowDefinition(row) : null;
}

export function updateWorkflowDefinition(workflowId: string, input: UpdateWorkflowInput) {
  const existing = db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, workflowId))
    .get();

  if (!existing) {
    return null;
  }

  db.update(workflowDefinitions)
    .set({
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      mode: input.mode ?? existing.mode,
      status: input.status ?? existing.status,
      defaultsJson:
        input.defaults === undefined ? existing.defaultsJson : JSON.stringify(input.defaults),
      nodesJson: input.nodes === undefined ? existing.nodesJson : JSON.stringify(input.nodes),
      edgesJson: input.edges === undefined ? existing.edgesJson : JSON.stringify(input.edges),
      metadataJson:
        input.metadata === undefined ? existing.metadataJson : JSON.stringify(input.metadata),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workflowDefinitions.id, workflowId))
    .run();

  insertWorkflowEvent(existing.projectId, workflowId, 'workflow_updated', {
    status: input.status ?? existing.status,
  });

  return getWorkflowDefinitionById(workflowId);
}

export function deleteWorkflowDefinition(workflowId: string): boolean {
  const existing = db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, workflowId))
    .get();

  if (!existing) {
    return false;
  }

  db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, workflowId)).run();

  insertWorkflowEvent(existing.projectId, workflowId, 'workflow_deleted', {});

  return true;
}

export function validateWorkflowDefinition(workflowId: string) {
  const workflow = getWorkflowDefinitionById(workflowId);

  if (!workflow) {
    return null;
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  if (!workflow.title.trim()) {
    errors.push('Workflow title is required.');
  }

  const missingReferences: Array<Record<string, unknown>> = [];
  const missingBindings: Array<Record<string, unknown>> = [];
  const invalidNodeConfigs: Array<Record<string, unknown>> = [];

  if (!Array.isArray(workflow.nodes)) {
    errors.push('Workflow nodes must be an array.');
  }

  if (!Array.isArray(workflow.edges)) {
    errors.push('Workflow edges must be an array.');
  }

  if (Array.isArray(workflow.nodes) && workflow.nodes.length === 0) {
    warnings.push('Workflow has no nodes yet.');
  }

  if (Array.isArray(workflow.nodes)) {
    const nodes = asWorkflowNodes(workflow.nodes);
    const nodeIds = new Set<string>();
    const inboundCounts = new Map<string, number>();
    const outboundCounts = new Map<string, number>();

    nodes.forEach((node, index) => {
      const nodeId = typeof node.id === 'string' ? node.id.trim() : '';
      const nodeType = typeof node.type === 'string' ? node.type.trim() : '';
      const params = asObjectRecord(node.params);

      if (!nodeId) {
        errors.push(`Node ${index + 1} is missing an id.`);
        return;
      }

      if (nodeIds.has(nodeId)) {
        errors.push(`Node id "${nodeId}" is duplicated.`);
      }

      nodeIds.add(nodeId);
      inboundCounts.set(nodeId, 0);
      outboundCounts.set(nodeId, 0);

      if (!nodeType) {
        errors.push(`Node "${nodeId}" is missing a type.`);
      } else {
        validateNodeConfig(nodeId, nodeType, params, errors, warnings, invalidNodeConfigs);
      }
    });

    if (Array.isArray(workflow.edges)) {
      const edges = asWorkflowEdges(workflow.edges);
      const edgeIds = new Set<string>();
      const normalizedEdges: Array<{ source: string; target: string }> = [];

      edges.forEach((edge, index) => {
        const edgeId = typeof edge.id === 'string' ? edge.id.trim() : '';
        const source = typeof edge.source === 'string' ? edge.source.trim() : '';
        const target = typeof edge.target === 'string' ? edge.target.trim() : '';

        if (!edgeId) {
          errors.push(`Edge ${index + 1} is missing an id.`);
        } else if (edgeIds.has(edgeId)) {
          errors.push(`Edge id "${edgeId}" is duplicated.`);
        } else {
          edgeIds.add(edgeId);
        }

        if (!source || !target) {
          errors.push(`Edge ${edgeId || index + 1} must include source and target.`);
          return;
        }

        if (!nodeIds.has(source)) {
          errors.push(`Edge "${edgeId}" references missing source node "${source}".`);
          missingReferences.push({
            type: 'missing_source_node',
            edge_id: edgeId,
            node_id: source,
          });
        }

        if (!nodeIds.has(target)) {
          errors.push(`Edge "${edgeId}" references missing target node "${target}".`);
          missingReferences.push({
            type: 'missing_target_node',
            edge_id: edgeId,
            node_id: target,
          });
        }

        if (source === target) {
          errors.push(`Edge "${edgeId}" creates a self-loop on node "${source}".`);
        }

        if (nodeIds.has(source) && nodeIds.has(target) && source !== target) {
          normalizedEdges.push({ source, target });
          outboundCounts.set(source, (outboundCounts.get(source) ?? 0) + 1);
          inboundCounts.set(target, (inboundCounts.get(target) ?? 0) + 1);
        }
      });

      if (nodeIds.size > 0 && detectCycles([...nodeIds], normalizedEdges)) {
        errors.push('Workflow graph contains a cycle. v1 workflows must remain acyclic.');
      }
    }

    nodes.forEach(node => {
      const nodeId = typeof node.id === 'string' ? node.id.trim() : '';
      const nodeType = typeof node.type === 'string' ? node.type.trim() : '';

      if (!nodeId || !nodeType) {
        return;
      }

      const inbound = inboundCounts.get(nodeId) ?? 0;
      const outbound = outboundCounts.get(nodeId) ?? 0;

      if (nodeType === 'input' && inbound > 0) {
        warnings.push(`Input node "${nodeId}" should not have inbound edges.`);
      }

      if (nodeType !== 'input' && inbound === 0) {
        warnings.push(`Node "${nodeId}" has no inbound connection.`);
        missingBindings.push({
          type: 'missing_inbound_connection',
          node_id: nodeId,
        });
      }

      if (nodeType === 'output' && outbound > 0) {
        warnings.push(`Output node "${nodeId}" should not have outbound edges.`);
      }

      if (nodeType !== 'output' && outbound === 0) {
        warnings.push(`Node "${nodeId}" has no downstream connection.`);
        missingBindings.push({
          type: 'missing_outbound_connection',
          node_id: nodeId,
        });
      }
    });
  }

  const status = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

  insertWorkflowEvent(workflow.project_id, workflowId, 'workflow_validated', {
    status,
    warning_count: warnings.length,
    error_count: errors.length,
  });

  return {
    status,
    missing_references: missingReferences,
    missing_bindings: missingBindings,
    invalid_node_configs: invalidNodeConfigs,
    warnings,
    errors,
  };
}

export function createWorkflowVersion(workflowId: string, input: CreateWorkflowVersionInput) {
  const workflow = getWorkflowDefinitionById(workflowId);

  if (!workflow) {
    return null;
  }

  console.log('[Freeze] Creating version for workflow', workflowId);
  console.log('[Freeze] Workflow nodes:', JSON.stringify(workflow.nodes?.slice(0, 5)));

  const latestVersion = db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowDefinitionId, workflowId))
    .orderBy(desc(workflowVersions.versionNumber))
    .get();

  const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
  const id = randomUUID();
  const frozenWorkflow = {
    title: workflow.title,
    description: workflow.description,
    mode: workflow.mode,
    status: workflow.status,
    template_type: workflow.template_type,
    nodes: workflow.nodes,
    edges: workflow.edges,
    defaults: workflow.defaults,
    metadata: workflow.metadata,
  };
  const graphHash = computeGraphHash(frozenWorkflow);
  const timestamp = new Date().toISOString();

  db.insert(workflowVersions)
    .values({
      id,
      workflowDefinitionId: workflowId,
      projectId: workflow.project_id,
      versionNumber,
      status: 'approved',
      approvedBy: 'user',
      approvedAt: timestamp,
      graphHash,
      templateType: workflow.template_type,
      frozenWorkflowJson: JSON.stringify(frozenWorkflow),
      inputAssetVersionsJson: JSON.stringify(input.input_asset_versions ?? {}),
      runtimeEnvironmentJson: JSON.stringify(input.runtime_environment ?? {}),
      notes: input.notes ?? '',
      createdAt: timestamp,
    })
    .run();

  db.update(workflowDefinitions)
    .set({
      status: 'approved',
      updatedAt: timestamp,
    })
    .where(eq(workflowDefinitions.id, workflowId))
    .run();

  insertWorkflowEvent(workflow.project_id, workflowId, 'workflow_version_created', {
    workflow_version_id: id,
    version_number: versionNumber,
  });

  return getWorkflowVersionById(id);
}

export function listWorkflowVersions(workflowId: string) {
  return db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowDefinitionId, workflowId))
    .orderBy(desc(workflowVersions.versionNumber))
    .all()
    .map(mapWorkflowVersion);
}

export function getWorkflowVersionById(workflowVersionId: string) {
  const row = db
    .select()
    .from(workflowVersions)
    .where(eq(workflowVersions.id, workflowVersionId))
    .get();

  return row ? mapWorkflowVersion(row) : null;
}
