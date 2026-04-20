import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  cancelCopilotPlanRun,
  createCopilotPlanRun,
  getCopilotPlanRunById,
  getCopilotPlanStepById,
  listCopilotPlanSteps,
  updateCopilotPlanStep,
} from '@ai-workflow/database';
import { broadcastRunEvent, addRunStream, removeRunStream } from '../copilot/runEvents.js';
import { canRunPlanOnBackend, executeCopilotPlanRun, planRequiresConfirmation } from '../copilot/planRunner.js';

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tool: z.string().min(1),
  params: z.record(z.any()).optional().default({}),
  on_error: z.enum(['stop', 'continue']).optional(),
});

const planSchema = z.object({
  intent: z.string().min(1),
  requires_confirmation: z.boolean(),
  questions: z
    .array(z.object({ id: z.string(), question: z.string(), default: z.string().optional() }))
    .optional(),
  steps: z.array(stepSchema),
});

export async function registerCopilotRunRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/copilot/runs', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        plan: planSchema,
        context: z.record(z.any()).optional().default({}),
        confirmed: z.boolean().optional().default(false),
      })
      .parse(request.body);

    if (!canRunPlanOnBackend(body.plan)) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: { code: 'unsupported_plan', message: 'This plan contains tools not supported by the backend runner.' },
      };
    }

    const needs = planRequiresConfirmation(body.plan);
    if (needs && !body.confirmed) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: { code: 'confirmation_required', message: 'This plan requires confirmation.' },
      };
    }

    const created = createCopilotPlanRun({
      projectId: params.projectId,
      plan: body.plan as any,
      context: { ...(body.context ?? {}), projectId: params.projectId },
    });

    setTimeout(() => {
      void executeCopilotPlanRun(created.run.id, evt => broadcastRunEvent(created.run.id, evt)).catch(() => {});
    }, 0);

    reply.code(201);
    return { ok: true, data: { run: created.run, steps: created.steps }, error: null };
  });

  app.get('/projects/:projectId/copilot/runs/:runId', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string() }).parse(request.params);
    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }
    return { ok: true, data: { run }, error: null };
  });

  app.get('/projects/:projectId/copilot/runs/:runId/steps', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string() }).parse(request.params);
    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }
    return { ok: true, data: { items: listCopilotPlanSteps(params.runId) }, error: null };
  });

  app.get('/projects/:projectId/copilot/runs/:runId/steps/:stepId', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string(), stepId: z.string() }).parse(request.params);
    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }
    const step = getCopilotPlanStepById(params.stepId);
    if (!step || step.run_id !== params.runId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Step not found' } };
    }
    return { ok: true, data: { step }, error: null };
  });

  app.post('/projects/:projectId/copilot/runs/:runId/cancel', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string() }).parse(request.params);
    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }

    const cancelled = cancelCopilotPlanRun(params.runId);
    broadcastRunEvent(params.runId, { type: 'run_update', runId: params.runId, run: cancelled } as any);
    return { ok: true, data: { run: cancelled }, error: null };
  });

  app.get('/projects/:projectId/copilot/runs/:runId/events', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string() }).parse(request.params);
    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const res = reply.raw;
    addRunStream(params.runId, res);

    // Initial snapshot
    res.write(`event: run_update\n`);
    res.write(`data: ${JSON.stringify({ type: 'run_update', runId: params.runId, run })}\n\n`);
    const steps = listCopilotPlanSteps(params.runId);
    for (const s of steps) {
      res.write(`event: step_update\n`);
      res.write(`data: ${JSON.stringify({ type: 'step_update', runId: params.runId, stepIndex: s.step_index, step: s })}\n\n`);
    }

    const keepalive = setInterval(() => {
      if (res.writableEnded) return;
      res.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(keepalive);
      removeRunStream(params.runId, res);
    });
  });

  app.post('/projects/:projectId/copilot/runs/:runId/steps/:stepId/update', async (request, reply) => {
    const params = z.object({ projectId: z.string(), runId: z.string(), stepId: z.string() }).parse(request.params);
    const body = z.object({
      status: z.enum(['pending', 'running', 'success', 'error', 'skipped']),
      result: z.any().optional(),
      error: z.string().optional(),
    }).parse(request.body);

    const run = getCopilotPlanRunById(params.runId);
    if (!run || run.project_id !== params.projectId) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Run not found' } };
    }

    const steps = listCopilotPlanSteps(params.runId);
    const step = steps.find(s => s.id === params.stepId);
    if (!step) {
      reply.code(404);
      return { ok: false, data: null, error: { code: 'not_found', message: 'Step not found' } };
    }

    const patch: any = { status: body.status };
    if (body.status === 'running') patch.started_at = new Date().toISOString();
    if (body.status === 'success' || body.status === 'error') patch.ended_at = new Date().toISOString();
    if (body.result !== undefined) patch.result = body.result;
    if (body.error !== undefined) patch.error = { message: body.error };

    updateCopilotPlanStep(params.runId, step.step_index, patch);
    broadcastRunEvent(params.runId, {
      type: 'step_update',
      runId: params.runId,
      stepId: params.stepId,
      status: body.status,
      result: body.result,
      error: body.error,
    } as any);

    return { ok: true, data: null, error: null };
  });
}

