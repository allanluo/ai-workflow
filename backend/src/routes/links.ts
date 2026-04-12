import {
  createAssetLink,
  getAssetLinks,
  deleteAssetLink,
  createAssetTag,
  getAssetTags,
  deleteAssetTag,
  getAllProjectTags,
} from '@ai-workflow/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createLinkSchema = z.object({
  source_asset_version_id: z.string(),
  target_asset_version_id: z.string(),
  link_type: z.enum(['references', 'derived_from', 'continuity', 'variant']),
  metadata: z.record(z.any()).optional().default({}),
});

const createTagSchema = z.object({
  asset_id: z.string(),
  tag: z.string(),
  created_by: z.string().optional(),
});

export async function registerLinkRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/links', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = createLinkSchema.parse(request.body);
    const link = createAssetLink(params.projectId, body);
    return reply.code(201).send(link);
  });

  app.get('/projects/:projectId/links', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z.object({ assetVersionId: z.string() }).parse(request.query);
    const links = getAssetLinks(params.projectId, query.assetVersionId);
    return reply.send(links);
  });

  app.delete('/links/:linkId', async (request, reply) => {
    const params = z.object({ linkId: z.string() }).parse(request.params);
    deleteAssetLink(params.linkId);
    return reply.code(204).send();
  });

  app.post('/projects/:projectId/tags', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = createTagSchema.parse(request.body);
    const tag = createAssetTag(params.projectId, body);
    return reply.code(201).send(tag);
  });

  app.get('/projects/:projectId/tags', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z.object({ assetId: z.string().optional() }).parse(request.query);

    if (query.assetId) {
      const tags = getAssetTags(params.projectId, query.assetId);
      return reply.send(tags);
    }

    const tags = getAllProjectTags(params.projectId);
    return reply.send(tags);
  });

  app.delete('/tags/:tagId', async (request, reply) => {
    const params = z.object({ tagId: z.string() }).parse(request.params);
    deleteAssetTag(params.tagId);
    return reply.code(204).send();
  });
}
