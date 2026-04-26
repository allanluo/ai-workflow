import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
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
import fs from 'node:fs';
import path from 'node:path';
import { db, exportJobs, outputVersions, eq } from '@ai-workflow/database';
import { completeExportJob } from '@ai-workflow/database';

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
  metadata: z.record(z.any()).optional().default({}),
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

      const existing = db.select().from(outputVersions).where(eq(outputVersions.outputId, params.outputId)).all();
      const latest = existing.sort((a, b) => b.versionNumber - a.versionNumber)[0];

      const [version] = await db.insert(outputVersions).values({
        id: randomUUID(),
        outputId: params.outputId,
        versionNumber: (latest?.versionNumber || 0) + 1,
        status: 'draft',
        assembledFromAssetVersionIdsJson: JSON.stringify(body.assembled_from_asset_version_ids || []),
        metadataJson: JSON.stringify(body.metadata || {}),
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
      }).returning();

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

  app.get<{ Params: { exportJobId: string } }>('/exports/:exportJobId/download', async (request, reply) => {
    const params = exportJobIdParamsSchema.parse(request.params);
    const job = getExportJobById(params.exportJobId);

    if (!job || !job.output_path) {
      reply.code(404);
      return { ok: false, error: { code: 'not_found', message: 'Export file not found' } };
    }

    const workspaceRoot = path.join(process.cwd(), '..');
    const resolvedPath = path.isAbsolute(job.output_path) 
      ? job.output_path 
      : path.resolve(workspaceRoot, job.output_path);

    if (!fs.existsSync(resolvedPath)) {
      // Try resolving relative to current process too
      const currentResolved = path.resolve(process.cwd(), job.output_path);
      if (!fs.existsSync(currentResolved)) {
        reply.code(404);
        return { ok: false, error: { code: 'not_found', message: 'Physical file not found on server' } };
      }
      job.output_path = currentResolved;
    } else {
      job.output_path = resolvedPath;
    }

    const filename = path.basename(job.output_path);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.type('video/mp4');
    return reply.send(fs.createReadStream(job.output_path));
  });
  // Simple background worker to "process" queued jobs
  setInterval(async () => {
    const allJobs = db.select().from(exportJobs).where(eq(exportJobs.status, 'queued')).all();
    for (const job of allJobs) {
      try {
        console.log(`[Worker] Processing export job ${job.id}...`);
        updateExportJobProgress(job.id, 5, 'running');
        
      // 1. Get the Output Version and its metadata
      const outputVersion = db.select().from(outputVersions).where(eq(outputVersions.id, job.outputVersionId)).get();
      if (!outputVersion) {
        throw new Error('Output version not found');
      }

      const metadataRaw = (outputVersion as any).metadataJson || (outputVersion as any).metadata || '{}';
      const metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
        
      console.log(`[Worker] Job ${job.id} Metadata:`, JSON.stringify(metadata));
      const videoUrls = metadata.video_urls || [];
      
      if (videoUrls.length === 0) {
        completeExportJob(job.id, '', false, 'No video segments found for this project. Please generate videos for your shots first.');
        return;
      }

      // 2. Download videos to temp directory
      const exportDir = path.join(process.cwd(), 'storage', 'projects', job.projectId, 'exports');
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      
      const tempDir = path.join(exportDir, `temp_${job.id}`);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const localPaths: string[] = [];
      for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
        const localPath = path.join(tempDir, `shot_${i}.mp4`);
        
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(localPath, Buffer.from(buffer));
          localPaths.push(localPath);
            updateExportJobProgress(job.id, 10 + Math.floor((i / videoUrls.length) * 40), 'running');
        } catch (err) {
          console.error(`Failed to download video ${url}:`, err);
        }
      }

      if (localPaths.length === 0) {
        throw new Error('Failed to download any videos for stitching');
      }

      // 3. Stitch videos using FFmpeg
      const inputsFile = path.join(tempDir, 'inputs.txt');
      const inputsContent = localPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(inputsFile, inputsContent);

      const finalExportPath = path.join(exportDir, `${job.id}.mp4`);
      const { execSync } = await import('node:child_process');
      
      try {
        updateExportJobProgress(job.id, 60, 'running');
        // Simple concatenation. For more robust results, use filter_complex if codecs differ.
        execSync(`ffmpeg -f concat -safe 0 -i "${inputsFile}" -c copy "${finalExportPath}" -y`);
        updateExportJobProgress(job.id, 100, 'completed');
        completeExportJob(job.id, finalExportPath, true);
      } catch (err) {
        console.error('FFmpeg stitching failed:', err);
        // Fallback to first video if stitching fails
        fs.copyFileSync(localPaths[0], finalExportPath);
          completeExportJob(job.id, finalExportPath, true);
      }

      // Cleanup
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Failed to cleanup temp dir:', err);
      }
    } catch (err) {
      console.error(`[Worker] Critical error processing job ${job.id}:`, err);
      try {
        completeExportJob(job.id, '', false, err instanceof Error ? err.message : 'Internal worker error');
      } catch (e) {
        console.error('[Worker] Failed to fail the job:', e);
      }
    }
  }
}, 2000);
}
