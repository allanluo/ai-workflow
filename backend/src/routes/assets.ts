import {
  approveAssetVersion,
  createAsset,
  createAssetVersion,
  getAssetById,
  getAssetVersionById,
  lockAssetVersion,
  listAssetVersions,
  listAssets,
  unlockAssetVersion,
  updateAsset,
} from '@ai-workflow/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { scheduleIndexAsset } from '../copilot/vectorIndexScheduler.js';

const createAssetSchema = z.object({
  asset_type: z.string().min(1).max(100),
  asset_category: z.string().min(1).max(100),
  title: z.string().max(200).optional().default(''),
  content: z.record(z.any()).optional().default({}),
  metadata: z.record(z.any()).optional().default({}),
  source_mode: z.enum(['manual', 'copilot', 'workflow', 'import', 'system']).default('manual'),
  status: z
    .enum(['draft', 'needs_revision', 'ready', 'locked', 'deprecated', 'failed'])
    .optional()
    .default('draft'),
});

const createAssetVersionSchema = z.object({
  content: z.record(z.any()).optional().default({}),
  metadata: z.record(z.any()).optional().default({}),
  status: z
    .enum(['draft', 'needs_revision', 'ready', 'locked', 'deprecated', 'failed'])
    .optional()
    .default('draft'),
  source_mode: z.enum(['manual', 'copilot', 'workflow', 'import', 'system']).default('manual'),
  locked_fields: z.array(z.string()).optional().default([]),
  make_current: z.boolean().optional().default(true),
});

const approveAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  notes: z.string().optional().default(''),
});

const lockAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  locked_fields: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
});

const unlockAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  status: z
    .enum(['draft', 'needs_revision', 'ready', 'deprecated', 'failed'])
    .optional()
    .default('draft'),
  notes: z.string().optional().default(''),
});

const updateAssetSchema = z.object({
  title: z.string().max(200).optional(),
  asset_type: z.string().min(1).max(100).optional(),
  asset_category: z.string().min(1).max(100).optional(),
  status: z.enum(['draft', 'needs_revision', 'ready', 'locked', 'deprecated', 'failed']).optional(),
  metadata: z.record(z.any()).optional(),
});

export async function registerAssetRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/assets', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = createAssetSchema.parse(request.body);
    const asset = createAsset(params.projectId, body);
    scheduleIndexAsset(asset.id);

    reply.code(201);

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.get('/projects/:projectId/assets', async request => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        asset_type: z.string().optional(),
        asset_category: z.string().optional(),
        status: z.string().optional(),
        approval_state: z.string().optional(),
      })
      .parse(request.query);

    return {
      ok: true,
      data: {
        items: listAssets(params.projectId, query),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/assets/:assetId', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const asset = getAssetById(params.assetId);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.patch('/assets/:assetId', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = updateAssetSchema.parse(request.body);
    const asset = updateAsset(params.assetId, body);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    scheduleIndexAsset(asset.id);

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.get('/assets/:assetId/versions', async request => {
    const params = z.object({ assetId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listAssetVersions(params.assetId),
        next_cursor: null,
      },
      error: null,
    };
  });

  app.get('/asset-versions/:assetVersionId', async (request, reply) => {
    const params = z.object({ assetVersionId: z.string() }).parse(request.params);
    const assetVersion = getAssetVersionById(params.assetVersionId);

    if (!assetVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset version ${params.assetVersionId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { asset_version: assetVersion },
      error: null,
    };
  });

  app.post('/assets/:assetId/versions', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = createAssetVersionSchema.parse(request.body);
    const assetVersion = createAssetVersion(params.assetId, body);

    if (!assetVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    scheduleIndexAsset(params.assetId);

    reply.code(201);

    return {
      ok: true,
      data: { asset_version: assetVersion },
      error: null,
    };
  });

  app.post('/assets/:assetId/approve', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = approveAssetSchema.parse(request.body);
    const asset = approveAssetVersion(params.assetId, body.asset_version_id, body.notes);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.post('/assets/:assetId/lock', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = lockAssetSchema.parse(request.body);
    const asset = lockAssetVersion(
      params.assetId,
      body.asset_version_id,
      body.locked_fields,
      body.notes
    );

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.post('/assets/:assetId/unlock', async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = unlockAssetSchema.parse(request.body);
    const asset = unlockAssetVersion(
      params.assetId,
      body.asset_version_id,
      body.status,
      body.notes
    );

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: 'not_found',
          message: `Asset ${params.assetId} was not found`,
        },
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null,
    };
  });

  app.post('/projects/:projectId/images', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        prompt: z.string(),
        width: z.number().optional().default(1024),
        height: z.number().optional().default(1024),
      })
      .parse(request.body);

    const { generateImage } = await import('../services/adapters.js');

    try {
      const response = await generateImage({
        prompt: body.prompt,
        width: body.width,
        height: body.height,
      });

      return {
        ok: true,
        data: {
          job_id: response.job_id,
          image_url: response.image_url,
          status: response.status,
        },
        error: null,
      };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'image_generation_failed',
          message: err instanceof Error ? err.message : 'Image generation failed',
        },
      };
    }
  });

  app.post('/projects/:projectId/videos', async (request, reply) => {
    z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        prompt: z.string(),
        workflow: z.string().optional(),
        width: z.number().optional().default(1024),
        height: z.number().optional().default(576),
      })
      .parse(request.body);

    const { createVideo } = await import('../services/adapters.js');

    try {
      const response = await createVideo({
        prompt: body.prompt,
        workflow: body.workflow,
        width: body.width,
        height: body.height,
      });

      return {
        ok: true,
        data: {
          job_id: response.job_id,
          prompt_id: response.prompt_id,
          video_path: response.video_path,
          video_url: response.video_url,
          status: response.status,
        },
        error: null,
      };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'video_generation_failed',
          message: err instanceof Error ? err.message : 'Video generation failed',
        },
      };
    }
  });

  app.post('/projects/:projectId/videos/from-image', async (request, reply) => {
    z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        prompt: z.string(),
        workflow: z.string().optional().default('image2video'),
        width: z.number().optional().default(640),
        height: z.number().optional().default(480),
        length: z.number().optional().default(81),
        reference_image_url: z.string().min(1),
      })
      .parse(request.body);

    const base = new URL(config.localAIAPI.endpoint);
    const referenceUrl = body.reference_image_url.startsWith('/')
      ? new URL(body.reference_image_url, base).toString()
      : body.reference_image_url;

    let parsed: URL;
    try {
      parsed = new URL(referenceUrl);
    } catch {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: { code: 'invalid_reference_image_url', message: 'Invalid reference image URL' },
      };
    }

    // SSRF guard: only allow pulling the reference image from the configured Local AI API host.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: { code: 'invalid_reference_image_url', message: 'Invalid reference image URL' },
      };
    }

    if (parsed.host !== base.host) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: {
          code: 'reference_image_host_not_allowed',
          message: 'Reference image must be hosted by the Local AI API',
        },
      };
    }

    let bytes: ArrayBuffer;
    let contentType: string;
    try {
      const imageResponse = await fetch(parsed.toString());
      if (!imageResponse.ok) {
        reply.code(400);
        return {
          ok: false,
          data: null,
          error: {
            code: 'reference_image_fetch_failed',
            message: `Failed to fetch reference image (${imageResponse.status})`,
          },
        };
      }

      contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
      bytes = await imageResponse.arrayBuffer();
    } catch (err) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: {
          code: 'reference_image_fetch_failed',
          message: err instanceof Error ? err.message : 'Failed to fetch reference image',
        },
      };
    }

    const filename = parsed.pathname.split('/').pop() || 'reference.jpg';

    const { createVideoFromImage } = await import('../services/adapters.js');

    try {
      const response = await createVideoFromImage({
        prompt: body.prompt,
        workflow: body.workflow,
        width: body.width,
        height: body.height,
        length: body.length,
        reference_image: {
          bytes,
          contentType,
          filename,
        },
      });

      return {
        ok: true,
        data: {
          job_id: response.job_id,
          prompt_id: response.prompt_id,
          video_path: response.video_path,
          video_url: response.video_url,
          status: response.status,
        },
        error: null,
      };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'video_generation_failed',
          message: err instanceof Error ? err.message : 'Video generation failed',
        },
      };
    }
  });

  app.post('/projects/:projectId/voiceovers', async (request, reply) => {
    z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        text: z.string().min(1),
        template: z.string().optional(),
        provider: z.enum(['piper', 'cosyvoice']).optional(),
        speed: z.number().optional(),
        volume: z.number().optional(),
        prompt_text: z.string().optional(),
        prompt_wav: z.string().optional(),
        model_dir: z.string().optional(),
      })
      .parse(request.body);

    const { generateSpeech } = await import('../services/adapters.js');

    try {
      const response = await generateSpeech({
        text: body.text,
        template: body.template ?? config.defaults.tts_voice,
        provider: body.provider,
        speed: body.speed,
        volume: body.volume,
        prompt_text: body.prompt_text,
        prompt_wav: body.prompt_wav,
        model_dir: body.model_dir,
      });

      return {
        ok: true,
        data: {
          job_id: response.job_id,
          status: response.status,
          audio_url: response.audio_url,
          audio_path: response.audio_path,
          provider: response.provider,
        },
        error: null,
      };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'voiceover_generation_failed',
          message: err instanceof Error ? err.message : 'Voice-over generation failed',
        },
      };
    }
  });

  app.post('/projects/:projectId/sounds', async (request, reply) => {
    z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        prompt: z.string().min(1),
        workflow: z.string().optional(),
        duration_seconds: z.number().optional(),
        batch_size: z.number().optional(),
        negative_prompt: z.string().optional(),
      })
      .parse(request.body);

    const { generateSound } = await import('../services/adapters.js');

    try {
      const response = await generateSound({
        prompt: body.prompt,
        workflow: body.workflow,
        duration_seconds: body.duration_seconds,
        batch_size: body.batch_size,
        negative_prompt: body.negative_prompt,
      });

      return {
        ok: true,
        data: {
          job_id: response.job_id,
          status: response.status,
          prompt_id: response.prompt_id,
          audio_url: response.audio_url,
          audio_path: response.audio_path,
        },
        error: null,
      };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'sound_generation_failed',
          message: err instanceof Error ? err.message : 'Sound generation failed',
        },
      };
    }
  });

  app.get('/jobs/:jobId', async (request, reply) => {
    const params = z.object({ jobId: z.string() }).parse(request.params);
    const { getJobStatus } = await import('../services/adapters.js');

    try {
      const job = await getJobStatus(params.jobId);
      return { ok: true, data: { job }, error: null };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: {
          code: 'job_status_failed',
          message: err instanceof Error ? err.message : 'Job status failed',
        },
      };
    }
  });
}
