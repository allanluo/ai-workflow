import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from './client.js';
import { assetLinks, assetTags } from './schema.js';

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type LinkType = 'references' | 'derived_from' | 'continuity' | 'variant';

interface CreateAssetLinkInput {
  source_asset_version_id: string;
  target_asset_version_id: string;
  link_type: LinkType;
  metadata?: Record<string, unknown>;
}

interface CreateAssetTagInput {
  asset_id: string;
  tag: string;
  created_by?: string;
}

export async function createAssetLink(projectId: string, input: CreateAssetLinkInput) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(assetLinks).values({
    id,
    projectId,
    sourceAssetVersionId: input.source_asset_version_id,
    targetAssetVersionId: input.target_asset_version_id,
    linkType: input.link_type,
    metadataJson: JSON.stringify(input.metadata ?? {}),
    createdAt: now,
  });

  return { id, ...input, created_at: now };
}

export async function getAssetLinks(projectId: string, assetVersionId: string) {
  const links = await db
    .select()
    .from(assetLinks)
    .where(
      and(eq(assetLinks.projectId, projectId), eq(assetLinks.sourceAssetVersionId, assetVersionId))
    );

  return links.map(link => ({
    id: link.id,
    source_asset_version_id: link.sourceAssetVersionId,
    target_asset_version_id: link.targetAssetVersionId,
    link_type: link.linkType,
    metadata: safeParseJson(link.metadataJson, {}),
    created_at: link.createdAt,
  }));
}

export async function deleteAssetLink(id: string) {
  await db.delete(assetLinks).where(eq(assetLinks.id, id));
}

export async function createAssetTag(projectId: string, input: CreateAssetTagInput) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(assetTags).values({
    id,
    projectId,
    assetId: input.asset_id,
    tag: input.tag,
    createdBy: input.created_by ?? 'system',
    createdAt: now,
  });

  return { id, asset_id: input.asset_id, tag: input.tag, created_at: now };
}

export async function getAssetTags(projectId: string, assetId: string) {
  const tags = await db
    .select()
    .from(assetTags)
    .where(and(eq(assetTags.projectId, projectId), eq(assetTags.assetId, assetId)));

  return tags.map(tag => ({
    id: tag.id,
    asset_id: tag.assetId,
    tag: tag.tag,
    created_by: tag.createdBy,
    created_at: tag.createdAt,
  }));
}

export async function deleteAssetTag(id: string) {
  await db.delete(assetTags).where(eq(assetTags.id, id));
}

export async function getAllProjectTags(projectId: string) {
  const tags = await db.select().from(assetTags).where(eq(assetTags.projectId, projectId));

  return tags.map(tag => ({
    id: tag.id,
    asset_id: tag.assetId,
    tag: tag.tag,
    created_by: tag.createdBy,
    created_at: tag.createdAt,
  }));
}
