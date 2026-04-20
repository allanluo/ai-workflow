import {
  createWorkflowDefinition,
  createWorkflowVersion,
  createWorkflowRun,
  deleteWorkflowDefinition,
  getNodeRunById,
  getWorkflowDefinitionById,
  getWorkflowRunById,
  getWorkflowVersionById,
  listNodeRuns,
  listProjectWorkflowRuns,
  listWorkflowDefinitions,
  listWorkflowVersions,
  updateWorkflowDefinition,
  validateWorkflowDefinition,
  db,
  nodeRuns,
} from '@ai-workflow/database';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { startWorkflowRunInBackground } from '../runtime/execution-engine.js';
import { scheduleDeleteWorkflowIndex, scheduleIndexWorkflow } from '../copilot/vectorIndexScheduler.js';

const workflowModeSchema = z.enum(['simple', 'guided', 'advanced']);
const workflowStatusSchema = z.enum(['draft', 'testing', 'approved', 'deprecated']);

const createWorkflowSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  mode: workflowModeSchema.default('guided'),
  template_type: z.string().min(1).max(100),
  defaults: z.record(z.any()).optional().default({}),
  nodes: z.array(z.any()).optional().default([]),
  edges: z.array(z.any()).optional().default([]),
  metadata: z.record(z.any()).optional().default({}),
});

const updateWorkflowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  mode: workflowModeSchema.optional(),
  status: workflowStatusSchema.optional(),
  defaults: z.record(z.any()).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const createWorkflowVersionSchema = z.object({
  input_asset_versions: z.record(z.any()).optional().default({}),
  runtime_environment: z.record(z.any()).optional().default({}),
  notes: z.string().optional().default(''),
});

const createWorkflowRunSchema = z.object({
  trigger_source: z.string().min(1).max(100).optional().default('manual'),
  rerun_of_workflow_run_id: z.string().nullable().optional().default(null),
});

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/workflows', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = createWorkflowSchema.parse(request.body);
    const workflow = createWorkflowDefinition(params.projectId, body);
    scheduleIndexWorkflow(workflow.id);

    reply.code(201);

    return {
      ok: true,
      data: { workflow },
      error: null,
    };
  });

  app.get('/projects/:projectId/workflows', async request => {
    const params = z.object({ projectId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listWorkflowDefinitions(params.projectId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/workflows/:workflowId', async (request, reply) => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);
    const workflow = getWorkflowDefinitionById(params.workflowId);

    if (!workflow) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { workflow },
      error: null,
    };
  });

  app.patch('/workflows/:workflowId', async (request, reply) => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);
    const body = updateWorkflowSchema.parse(request.body);
    const workflow = updateWorkflowDefinition(params.workflowId, body);

    if (!workflow) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    scheduleIndexWorkflow(workflow.id);

    return {
      ok: true,
      data: { workflow },
      error: null,
    };
  });

  app.delete('/workflows/:workflowId', async (request, reply) => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);
    const existing = getWorkflowDefinitionById(params.workflowId);
    const deleted = deleteWorkflowDefinition(params.workflowId);

    if (!deleted) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    if (existing) scheduleDeleteWorkflowIndex(existing.project_id, existing.id);

    return {
      ok: true,
      data: { deleted: true },
      error: null,
    };
  });

  app.post('/workflows/:workflowId/validate', async (request, reply) => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);
    const validation = validateWorkflowDefinition(params.workflowId);

    if (!validation) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { validation },
      error: null,
    };
  });

  app.post('/workflows/:workflowId/versions', async (request, reply) => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);
    const body = createWorkflowVersionSchema.parse(request.body);
    const validation = validateWorkflowDefinition(params.workflowId);

    if (!validation) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    if (validation.status === 'fail') {
      reply.code(400);
      return {
        ok: false,
        data: {
          validation,
        },
        error: {
          code: 'invalid_workflow',
          message: 'Workflow validation failed. Fix blocking errors before freezing a version.',
        },
      };
    }

    const workflowVersion = createWorkflowVersion(params.workflowId, body);

    if (!workflowVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow ${params.workflowId} was not found`,
        },
      };
    }

    scheduleIndexWorkflow(params.workflowId);

    reply.code(201);

    return {
      ok: true,
      data: { workflow_version: workflowVersion },
      error: null,
    };
  });

  app.get('/workflows/:workflowId/versions', async request => {
    const params = z.object({ workflowId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listWorkflowVersions(params.workflowId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/workflow-versions/:workflowVersionId', async (request, reply) => {
    const params = z.object({ workflowVersionId: z.string() }).parse(request.params);
    const workflowVersion = getWorkflowVersionById(params.workflowVersionId);

    if (!workflowVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow version ${params.workflowVersionId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { workflow_version: workflowVersion },
      error: null,
    };
  });

  app.post('/workflow-versions/:workflowVersionId/runs', async (request, reply) => {
    const params = z.object({ workflowVersionId: z.string() }).parse(request.params);
    const body = createWorkflowRunSchema.parse(request.body ?? {});
    const workflowRun = createWorkflowRun(params.workflowVersionId, body);

    if (!workflowRun) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow version ${params.workflowVersionId} was not found`,
        },
      };
    }

    startWorkflowRunInBackground(workflowRun.id);

    reply.code(201);

    return {
      ok: true,
      data: { workflow_run: workflowRun },
      error: null,
    };
  });

  app.get('/projects/:projectId/workflow-runs', async request => {
    const query = z
      .object({
        workflow_version_id: z.string().optional(),
      })
      .parse(request.query);
    const params = z.object({ projectId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listProjectWorkflowRuns(params.projectId, query.workflow_version_id),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/workflow-runs/:workflowRunId', async (request, reply) => {
    const params = z.object({ workflowRunId: z.string() }).parse(request.params);
    const workflowRun = getWorkflowRunById(params.workflowRunId);

    if (!workflowRun) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow run ${params.workflowRunId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { workflow_run: workflowRun },
      error: null,
    };
  });

  app.get('/workflow-runs/:workflowRunId/node-runs', async request => {
    const params = z.object({ workflowRunId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listNodeRuns(params.workflowRunId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/node-runs/:nodeRunId', async (request, reply) => {
    const params = z.object({ nodeRunId: z.string() }).parse(request.params);
    const nodeRun = getNodeRunById(params.nodeRunId);

    if (!nodeRun) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Node run ${params.nodeRunId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { node_run: nodeRun },
      error: null,
    };
  });

  app.post('/node-runs/:nodeRunId/rerun', async (request, reply) => {
    const params = z.object({ nodeRunId: z.string() }).parse(request.params);
    const nodeRun = getNodeRunById(params.nodeRunId);

    if (!nodeRun) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Node run ${params.nodeRunId} was not found`,
        },
      };
    }

    const workflowRun = getWorkflowRunById(nodeRun.workflow_run_id);
    if (!workflowRun) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Workflow run not found for node run`,
        },
      };
    }

    const newRunId = randomUUID();
    const createdAt = new Date().toISOString();
    const inputSnapshot = nodeRun.input_snapshot;

    const newNodeRunId = randomUUID();
    db.insert(nodeRuns)
      .values({
        id: newNodeRunId,
        workflowRunId: workflowRun.id,
        workflowVersionId: nodeRun.workflow_version_id,
        projectId: nodeRun.project_id,
        nodeId: nodeRun.node_id,
        nodeType: nodeRun.node_type,
        status: 'queued',
        position: nodeRun.position,
        startedAt: createdAt,
        endedAt: null,
        inputSnapshotJson: JSON.stringify(inputSnapshot),
        outputSnapshotJson: '{}',
        logsJson: '[]',
        warningsJson: '[]',
        errorsJson: '[]',
        createdAt,
        updatedAt: createdAt,
      })
      .run();

    return {
      ok: true,
      data: { node_run: { id: newNodeRunId, status: 'queued' } },
      error: null,
    };
  });
}
