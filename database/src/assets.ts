import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./client.js";
import { assetVersions, assets, projectEvents } from "./schema.js";

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type AssetStatus = "draft" | "needs_revision" | "ready" | "locked" | "deprecated" | "failed";
type SourceMode = "manual" | "copilot" | "workflow" | "import" | "system";

interface CreateAssetInput {
  asset_type: string;
  asset_category: string;
  title?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source_mode: SourceMode;
  status?: AssetStatus;
}

interface CreateAssetVersionInput {
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: AssetStatus;
  source_mode: SourceMode;
  locked_fields?: string[];
  make_current?: boolean;
}

interface AssetFilterInput {
  asset_type?: string;
  asset_category?: string;
  status?: string;
  approval_state?: string;
}

interface UpdateAssetInput {
  title?: string;
  asset_type?: string;
  asset_category?: string;
  status?: AssetStatus;
  metadata?: Record<string, unknown>;
}

function mapAssetVersion(row: typeof assetVersions.$inferSelect) {
  return {
    id: row.id,
    asset_id: row.assetId,
    project_id: row.projectId,
    version_number: row.versionNumber,
    previous_version_id: row.previousVersionId,
    parent_asset_id: row.parentAssetId,
    status: row.status,
    approval_state: row.approvalState,
    source_mode: row.sourceMode,
    created_by: row.createdBy,
    edited_by_last: row.editedByLast,
    workflow_version_id: row.workflowVersionId,
    workflow_run_id: row.workflowRunId,
    node_run_id: row.nodeRunId,
    content: safeParseJson(row.contentJson, {}),
    metadata: safeParseJson(row.metadataJson, {}),
    locked_fields: safeParseJson(row.lockedFieldsJson, []),
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function mapAsset(row: typeof assets.$inferSelect) {
  const currentVersion = row.currentAssetVersionId ? getAssetVersionById(row.currentAssetVersionId) : null;
  const currentApprovedVersion = row.currentApprovedAssetVersionId
    ? getAssetVersionById(row.currentApprovedAssetVersionId)
    : null;
  const versions = listAssetVersions(row.id);

  return {
    id: row.id,
    project_id: row.projectId,
    asset_type: row.assetType,
    asset_category: row.assetCategory,
    title: row.title,
    current_version_number: row.currentVersionNumber,
    current_version_id: row.currentAssetVersionId,
    current_approved_version_id: row.currentApprovedAssetVersionId,
    status: row.status,
    approval_state: row.approvalState,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    metadata: safeParseJson(row.metadataJson, {}),
    current_version: currentVersion,
    current_approved_version: currentApprovedVersion,
    versions
  };
}

function insertAssetEvent(projectId: string, targetId: string, eventType: string, payload: Record<string, unknown>) {
  db.insert(projectEvents)
    .values({
      id: randomUUID(),
      projectId,
      eventType,
      targetType: "asset",
      targetId,
      payloadJson: JSON.stringify(payload),
      createdAt: new Date().toISOString()
    })
    .run();
}

export function createAsset(projectId: string, input: CreateAssetInput) {
  const timestamp = new Date().toISOString();
  const assetId = randomUUID();
  const assetVersionId = randomUUID();
  const status = input.status ?? "draft";

  db.insert(assets)
    .values({
      id: assetId,
      projectId,
      assetType: input.asset_type,
      assetCategory: input.asset_category,
      title: input.title ?? "",
      currentVersionNumber: 1,
      currentAssetVersionId: assetVersionId,
      currentApprovedAssetVersionId: null,
      status,
      approvalState: "unapproved",
      createdBy: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
      metadataJson: JSON.stringify(input.metadata ?? {})
    })
    .run();

  db.insert(assetVersions)
    .values({
      id: assetVersionId,
      assetId,
      projectId,
      versionNumber: 1,
      previousVersionId: null,
      parentAssetId: assetId,
      status,
      approvalState: "unapproved",
      sourceMode: input.source_mode,
      createdBy: "user",
      editedByLast: "user",
      workflowVersionId: null,
      workflowRunId: null,
      nodeRunId: null,
      contentJson: JSON.stringify(input.content ?? {}),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      lockedFieldsJson: JSON.stringify([]),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  insertAssetEvent(projectId, assetId, "asset_created", {
    asset_type: input.asset_type,
    asset_category: input.asset_category
  });

  return getAssetById(assetId)!;
}

export function listAssets(projectId: string, filters: AssetFilterInput = {}) {
  const conditions = [eq(assets.projectId, projectId)];

  if (filters.asset_type) {
    conditions.push(eq(assets.assetType, filters.asset_type));
  }

  if (filters.asset_category) {
    conditions.push(eq(assets.assetCategory, filters.asset_category));
  }

  if (filters.status) {
    conditions.push(eq(assets.status, filters.status));
  }

  if (filters.approval_state) {
    conditions.push(eq(assets.approvalState, filters.approval_state));
  }

  return db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.updatedAt))
    .all()
    .map(mapAsset);
}

export function getAssetById(assetId: string) {
  const row = db.select().from(assets).where(eq(assets.id, assetId)).get();
  return row ? mapAsset(row) : null;
}

export function listAssetVersions(assetId: string) {
  return db
    .select()
    .from(assetVersions)
    .where(eq(assetVersions.assetId, assetId))
    .orderBy(desc(assetVersions.versionNumber))
    .all()
    .map(mapAssetVersion);
}

export function getAssetVersionById(assetVersionId: string) {
  const row = db.select().from(assetVersions).where(eq(assetVersions.id, assetVersionId)).get();
  return row ? mapAssetVersion(row) : null;
}

export function createAssetVersion(assetId: string, input: CreateAssetVersionInput) {
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();

  if (!asset) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const versionNumber = asset.currentVersionNumber + 1;
  const versionId = randomUUID();

  db.insert(assetVersions)
    .values({
      id: versionId,
      assetId,
      projectId: asset.projectId,
      versionNumber,
      previousVersionId: asset.currentAssetVersionId,
      parentAssetId: assetId,
      status: input.status ?? "draft",
      approvalState: "unapproved",
      sourceMode: input.source_mode,
      createdBy: "user",
      editedByLast: "user",
      workflowVersionId: null,
      workflowRunId: null,
      nodeRunId: null,
      contentJson: JSON.stringify(input.content ?? {}),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      lockedFieldsJson: JSON.stringify(input.locked_fields ?? []),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  db.update(assets)
    .set({
      currentVersionNumber: input.make_current === false ? asset.currentVersionNumber : versionNumber,
      currentAssetVersionId: input.make_current === false ? asset.currentAssetVersionId : versionId,
      status: input.make_current === false ? asset.status : input.status ?? "draft",
      updatedAt: timestamp
    })
    .where(eq(assets.id, assetId))
    .run();

  insertAssetEvent(asset.projectId, assetId, "asset_version_created", {
    asset_version_id: versionId,
    version_number: versionNumber
  });

  return getAssetVersionById(versionId);
}

export function updateAsset(assetId: string, input: UpdateAssetInput) {
  const existing = db.select().from(assets).where(eq(assets.id, assetId)).get();

  if (!existing) {
    return null;
  }

  db.update(assets)
    .set({
      title: input.title ?? existing.title,
      assetType: input.asset_type ?? existing.assetType,
      assetCategory: input.asset_category ?? existing.assetCategory,
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
      metadataJson:
        input.metadata === undefined ? existing.metadataJson : JSON.stringify(input.metadata)
    })
    .where(eq(assets.id, assetId))
    .run();

  insertAssetEvent(existing.projectId, assetId, "asset_updated", {
    title: input.title ?? existing.title,
    status: input.status ?? existing.status
  });

  return getAssetById(assetId);
}

export function approveAssetVersion(assetId: string, assetVersionId?: string, notes?: string) {
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();

  if (!asset) {
    return null;
  }

  const targetVersionId = assetVersionId ?? asset.currentAssetVersionId;

  if (!targetVersionId) {
    return null;
  }

  db.update(assetVersions)
    .set({
      approvalState: "approved",
      updatedAt: new Date().toISOString()
    })
    .where(eq(assetVersions.id, targetVersionId))
    .run();

  db.update(assets)
    .set({
      approvalState: "approved",
      currentApprovedAssetVersionId: targetVersionId,
      updatedAt: new Date().toISOString()
    })
    .where(eq(assets.id, assetId))
    .run();

  insertAssetEvent(asset.projectId, assetId, "asset_approved", {
    asset_version_id: targetVersionId,
    notes: notes ?? ""
  });

  return getAssetById(assetId);
}

export function lockAssetVersion(
  assetId: string,
  assetVersionId?: string,
  lockedFields: string[] = [],
  notes?: string
) {
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();

  if (!asset) {
    return null;
  }

  const targetVersionId = assetVersionId ?? asset.currentAssetVersionId;

  if (!targetVersionId) {
    return null;
  }

  const timestamp = new Date().toISOString();

  db.update(assetVersions)
    .set({
      status: "locked",
      lockedFieldsJson: JSON.stringify(lockedFields),
      updatedAt: timestamp
    })
    .where(eq(assetVersions.id, targetVersionId))
    .run();

  if (asset.currentAssetVersionId === targetVersionId) {
    db.update(assets)
      .set({
        status: "locked",
        updatedAt: timestamp
      })
      .where(eq(assets.id, assetId))
      .run();
  }

  insertAssetEvent(asset.projectId, assetId, "asset_locked", {
    asset_version_id: targetVersionId,
    locked_fields: lockedFields,
    notes: notes ?? ""
  });

  return getAssetById(assetId);
}

export function unlockAssetVersion(
  assetId: string,
  assetVersionId?: string,
  nextStatus: AssetStatus = "draft",
  notes?: string
) {
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();

  if (!asset) {
    return null;
  }

  const targetVersionId = assetVersionId ?? asset.currentAssetVersionId;

  if (!targetVersionId) {
    return null;
  }

  const timestamp = new Date().toISOString();

  db.update(assetVersions)
    .set({
      status: nextStatus,
      lockedFieldsJson: JSON.stringify([]),
      updatedAt: timestamp
    })
    .where(eq(assetVersions.id, targetVersionId))
    .run();

  if (asset.currentAssetVersionId === targetVersionId) {
    db.update(assets)
      .set({
        status: nextStatus,
        updatedAt: timestamp
      })
      .where(eq(assets.id, assetId))
      .run();
  }

  insertAssetEvent(asset.projectId, assetId, "asset_unlocked", {
    asset_version_id: targetVersionId,
    next_status: nextStatus,
    notes: notes ?? ""
  });

  return getAssetById(assetId);
}
