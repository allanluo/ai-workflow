import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createComment,
  createApproval,
  createOutput,
  createOutputVersion,
  createExportJob,
  listComments,
  listApprovals,
  listOutputs,
  listOutputVersions,
  listExportJobs,
  resolveComment,
  updateExportJobProgress,
  getOutputById,
  getExportJobById,
} from '@ai-workflow/database';

const createCommentSchema = z.object({
  asset_version_id: z.string().optional(),
  node_run_id: z.string().optional(),
  author_id: z.string().min(1),
  author_name: z.string().min(1),
  content: z.string().min(1),
  parent_comment_id: z.string().optional(),
});

const createApprovalSchema = z.object({
  asset_version_id: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

const createOutputSchema = z.object({
  title: z.string().min(1),
  output_type: z.string().min(1),
});

const createOutputVersionSchema = z.object({
  assembled_from_asset_version_ids: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

const createExportJobSchema = z.object({
  output_version_id: z.string().min(1),
  export_format: z.string().min(1),
});

const projectIdParamsSchema = z.object({ projectId: z.string() });
const assetIdParamsSchema = z.object({ assetId: z.string() });
const outputIdParamsSchema = z.object({ outputId: z.string() });
const commentIdParamsSchema = z.object({ commentId: z.string() });
const exportJobIdParamsSchema = z.object({ exportJobId: z.string() });

export async function registerReviewRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string } }>('/projects/:projectId/comments', async request => {
    const params = projectIdParamsSchema.parse(request.params);
    const { asset_version_id } = request.query as { asset_version_id?: string };

    return {
      ok: true,
      data: {
        items: listComments(params.projectId, asset_version_id),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.post<{ Params: { projectId: string } }>(
    '/projects/:projectId/comments',
    async (request, reply) => {
      const params = projectIdParamsSchema.parse(request.params);
      const body = createCommentSchema.parse(request.body);
      const comment = createComment({
        projectId: params.projectId,
        authorId: body.author_id,
        authorName: body.author_name,
        content: body.content,
        assetVersionId: body.asset_version_id,
        nodeRunId: body.node_run_id,
        parentCommentId: body.parent_comment_id,
      });

      reply.code(201);
      return { ok: true, data: { comment }, error: null };
    }
  );

  app.patch<{ Params: { commentId: string } }>('/comments/:commentId/resolve', async request => {
    const params = commentIdParamsSchema.parse(request.params);
    const { resolved } = request.body as { resolved: boolean };
    const comment = resolveComment(params.commentId, resolved);

    if (!comment) {
      return { ok: false, data: null, error: { code: 'not_found', message: 'Comment not found' } };
    }

    return { ok: true, data: { comment }, error: null };
  });

  app.get<{ Params: { assetId: string } }>('/assets/:assetId/approvals', async request => {
    const params = assetIdParamsSchema.parse(request.params);
    return {
      ok: true,
      data: {
        items: listApprovals(params.assetId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.post<{ Params: { projectId: string; assetId: string } }>(
    '/projects/:projectId/assets/:assetId/approve',
    async (request, reply) => {
      const params = z
        .object({
          projectId: z.string(),
          assetId: z.string(),
        })
        .parse(request.params);
      const body = createApprovalSchema.parse(request.body);

      const approval = createApproval({
        projectId: params.projectId,
        assetId: params.assetId,
        assetVersionId: body.asset_version_id,
        approvedBy: 'current-user',
        approverName: 'User',
        decision: body.decision,
        notes: body.notes,
      });

      reply.code(201);
      return { ok: true, data: { approval }, error: null };
    }
  );

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/outputs', async request => {
    const params = projectIdParamsSchema.parse(request.params);
    return {
      ok: true,
      data: {
        items: listOutputs(params.projectId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.post<{ Params: { projectId: string } }>(
    '/projects/:projectId/outputs',
    async (request, reply) => {
      const params = projectIdParamsSchema.parse(request.params);
      const body = createOutputSchema.parse(request.body);

      const output = createOutput({
        projectId: params.projectId,
        title: body.title,
        outputType: body.output_type,
        createdBy: 'current-user',
      });

      reply.code(201);
      return { ok: true, data: { output }, error: null };
    }
  );

  app.get<{ Params: { outputId: string } }>('/outputs/:outputId/versions', async request => {
    const params = outputIdParamsSchema.parse(request.params);
    return {
      ok: true,
      data: {
        items: listOutputVersions(params.outputId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.post<{ Params: { outputId: string } }>(
    '/outputs/:outputId/versions',
    async (request, reply) => {
      const params = outputIdParamsSchema.parse(request.params);
      const body = createOutputVersionSchema.parse(request.body);

      const output = getOutputById(params.outputId);
      if (!output) {
        reply.code(404);
        return { ok: false, data: null, error: { code: 'not_found', message: 'Output not found' } };
      }

      const version = createOutputVersion({
        outputId: params.outputId,
        assembledFromAssetVersionIds: body.assembled_from_asset_version_ids,
        metadata: body.metadata,
        createdBy: 'current-user',
      });

      reply.code(201);
      return { ok: true, data: { version }, error: null };
    }
  );

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/exports', async request => {
    const params = projectIdParamsSchema.parse(request.params);
    return {
      ok: true,
      data: {
        items: listExportJobs(params.projectId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.post<{ Params: { projectId: string } }>(
    '/projects/:projectId/exports',
    async (request, reply) => {
      const params = projectIdParamsSchema.parse(request.params);
      const body = createExportJobSchema.parse(request.body);

      const job = createExportJob({
        projectId: params.projectId,
        outputVersionId: body.output_version_id,
        exportFormat: body.export_format,
      });

      reply.code(201);
      return { ok: true, data: { job }, error: null };
    }
  );

  app.get<{ Params: { exportJobId: string } }>('/exports/:exportJobId', async request => {
    const params = exportJobIdParamsSchema.parse(request.params);
    const job = getExportJobById(params.exportJobId);

    if (!job) {
      return {
        ok: false,
        data: null,
        error: { code: 'not_found', message: 'Export job not found' },
      };
    }

    return { ok: true, data: { job }, error: null };
  });

  app.patch<{ Params: { exportJobId: string } }>(
    '/exports/:exportJobId/progress',
    async request => {
      const params = exportJobIdParamsSchema.parse(request.params);
      const { progress, status } = request.body as { progress?: number; status?: string };

      const job = updateExportJobProgress(params.exportJobId, progress ?? 0, status);

      if (!job) {
        return {
          ok: false,
          data: null,
          error: { code: 'not_found', message: 'Export job not found' },
        };
      }

      return { ok: true, data: { job }, error: null };
    }
  );
}
