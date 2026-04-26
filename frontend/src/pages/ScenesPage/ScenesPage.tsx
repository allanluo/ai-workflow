import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAsset, fetchProjectAssets, type Asset } from '../../lib/api';
import { SceneListPanel, type SceneListItem } from './SceneListPanel';
import { SceneToolbar } from './SceneToolbar';
import { ScenePreview } from './ScenePreview';
import { SceneEditorPanel, type SceneItem } from '../../components/SceneEditorPanel';

import { useSelectionStore } from '../../stores';

interface ScenesPageProps {
  projectId: string;
}

function extractSceneList(asset: Asset) {
  const raw = asset.current_version?.content;
  if (!raw) return null;

  const tryFromObj = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return null;
    const scenes = (obj as Record<string, unknown>).scenes;
    if (!Array.isArray(scenes)) return null;
    return scenes.filter(s => s && typeof s === 'object') as Record<string, unknown>[];
  };

  const direct = tryFromObj(raw);
  if (direct) return direct;

  const rawText =
    typeof (raw as Record<string, unknown>)?._raw === 'string'
      ? ((raw as Record<string, unknown>)._raw as string)
      : typeof (raw as Record<string, unknown>)?.text === 'string'
        ? ((raw as Record<string, unknown>).text as string)
        : null;

  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText);
    return tryFromObj(parsed);
  } catch {
    return null;
  }
}

function getSceneSubtitle(asset: Asset): string {
  const batch = extractSceneList(asset);
  if (batch && batch.length > 0) {
    const firstTitle =
      typeof (batch[0] as Record<string, unknown>)?.title === 'string'
        ? ((batch[0] as Record<string, unknown>).title as string)
        : '';
    return firstTitle ? `${batch.length} scenes · ${firstTitle}` : `${batch.length} scenes`;
  }

  const content = (asset.current_version?.content ?? {}) as Record<string, unknown>;
  const purpose = typeof content.purpose === 'string' ? content.purpose : '';
  const emotional_beat =
    typeof content.emotional_beat === 'string'
      ? content.emotional_beat
      : typeof content.emotionalBeat === 'string'
        ? content.emotionalBeat
        : '';
  const setting = typeof content.setting === 'string' ? content.setting : '';
  return purpose || emotional_beat || setting || 'No description';
}

function toStatus(approvalState: string): SceneListItem['status'] {
  if (approvalState === 'approved') return 'approved';
  if (approvalState === 'pending') return 'warning';
  return 'draft';
}

function toBatchSceneItems(asset: Asset): SceneItem[] | null {
  const rawList = extractSceneList(asset);
  if (!rawList || rawList.length === 0) return null;

  const normalized = rawList
    .map(raw => {
      const title = typeof raw.title === 'string' ? raw.title : '';
      const purpose = typeof raw.purpose === 'string' ? raw.purpose : '';
      const emotional_beat =
        typeof raw.emotional_beat === 'string'
          ? raw.emotional_beat
          : typeof (raw as Record<string, unknown>).emotionalBeat === 'string'
            ? ((raw as Record<string, unknown>).emotionalBeat as string)
            : '';
      const setting = typeof raw.setting === 'string' ? raw.setting : '';
      const item: SceneItem = { title, purpose, emotional_beat, setting };
      const hasAny = Object.values(item).some(v => typeof v === 'string' && v.trim());
      return hasAny ? item : null;
    })
    .filter((v): v is SceneItem => Boolean(v));

  return normalized.length > 0 ? normalized : null;
}

export function ScenesPage({ projectId }: ScenesPageProps) {
  const queryClient = useQueryClient();
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [batchScenesDraft, setBatchScenesDraft] = useState<SceneItem[] | null>(null);
  const [batchSceneIndex, setBatchSceneIndex] = useState(0);

  const scenesQuery = useQuery({
    // Use a dedicated query key so other tabs observing `project-assets` never accidentally
    // inherit scene-only selections (and vice versa).
    queryKey: ['project-scenes', projectId, selectedWorkflowId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    // Scenes tab should only show scene outline assets. Shot plans may also contain a "scenes" array,
    // but they belong in the Shots tab and were confusing users (scenes appeared "generated" even when
    // the generate_scenes node failed).
    select: assets => assets.filter(a => a.asset_type === 'scene'),
  });

  const visibleScenes = useMemo(() => {
    const scenes = [...(scenesQuery.data ?? [])];

    const isImportedSingleScene = (asset: Asset) =>
      typeof (asset.metadata as Record<string, unknown> | undefined)?.imported_from_asset_id ===
      'string';

    const filtered = scenes.filter(asset => {
      if (isImportedSingleScene(asset)) return false;
      
      // Always show explicit scene assets (unless imported singletons)
      return asset.asset_type === 'scene' && asset.status !== 'deprecated';
    });

    const filteredByWorkflow = filtered.filter(asset => {
      if (!selectedWorkflowId) return true;
      const meta = asset.metadata as Record<string, unknown> | null;
      return meta?.workflow_id === selectedWorkflowId;
    });

    filteredByWorkflow.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return filteredByWorkflow;
  }, [scenesQuery.data, selectedWorkflowId]);

  const sceneItems: SceneListItem[] = useMemo(
    () =>
      visibleScenes.map(asset => {
        const batchCount = extractSceneList(asset)?.length ?? 0;
        const isBatch = batchCount > 0;
        return {
          assetId: asset.id,
          title: isBatch ? 'Generated Scenes' : asset.title || 'Untitled Scene',
          subtitle: getSceneSubtitle(asset),
          updatedAt: asset.updated_at,
          status: toStatus(asset.approval_state),
          badge: isBatch ? `Batch` : 'Scene',
        };
      }),
    [visibleScenes]
  );

  // Track if the current selection was chosen because it matches the workflow
  const [autoSelectedForWorkflowId, setAutoSelectedForWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    if (sceneItems.length === 0) return;

    const topAssetId = sceneItems[0].assetId;
    const topAsset = visibleScenes.find(a => a.id === topAssetId);
    const topAssetMatches = selectedWorkflowId && (topAsset?.metadata as Record<string, unknown> | undefined)?.workflow_id === selectedWorkflowId;

    // SCENARIO 1: First time selection or selection lost
    if (!selectedAssetId || !sceneItems.some(item => item.assetId === selectedAssetId)) {
      setSelectedAssetId(topAssetId);
      if (topAssetMatches) setAutoSelectedForWorkflowId(selectedWorkflowId);
      return;
    }

    // SCENARIO 2: Workflow changed, OR a NEW run finished for the SAME workflow
    const canAutoJump = selectedWorkflowId === autoSelectedForWorkflowId;
    if (selectedWorkflowId && topAssetMatches && selectedAssetId !== topAssetId && canAutoJump) {
      setSelectedAssetId(topAssetId);
      setAutoSelectedForWorkflowId(selectedWorkflowId);
      return;
    }

    // SCENARIO 3: Workflow changed but no match found yet
    if (selectedWorkflowId && selectedWorkflowId !== autoSelectedForWorkflowId) {
      if (topAssetMatches) {
        setSelectedAssetId(topAssetId);
        setAutoSelectedForWorkflowId(selectedWorkflowId);
      } else {
        setAutoSelectedForWorkflowId(selectedWorkflowId);
      }
    }
  }, [sceneItems, selectedAssetId, selectedWorkflowId, visibleScenes, autoSelectedForWorkflowId]);

  const selectedItem = sceneItems.find(s => s.assetId === selectedAssetId) ?? null;
  const selectedAsset = visibleScenes.find(a => a.id === selectedAssetId) ?? null;
  const batchScenesFromAsset = useMemo(
    () => (selectedAsset ? toBatchSceneItems(selectedAsset) : null),
    [selectedAssetId, selectedAsset?.current_asset_version_id]
  );
  const effectiveBatchScenes = batchScenesDraft ?? batchScenesFromAsset;
  const isBatchAsset = Boolean(effectiveBatchScenes && effectiveBatchScenes.length > 0);

  useEffect(() => {
    if (!selectedAsset) {
      setBatchScenesDraft(null);
      setBatchSceneIndex(0);
      return;
    }
    const next = toBatchSceneItems(selectedAsset);
    setBatchScenesDraft(next);
    setBatchSceneIndex(0);
  }, [selectedAssetId, selectedAsset?.current_asset_version_id]); // reset draft on selection/version change

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: asset => {
      // Keep both the generic assets cache and the scenes-only cache in sync.
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-scenes', projectId] });
      setSelectedAssetId(asset.id);
    },
  });

  const handleCreateScene = () => {
    createMutation.mutate({
      projectId,
      asset_type: 'scene',
      asset_category: 'story',
      title: 'New Scene',
      content: { order: (visibleScenes.length ?? 0) + 1 },
      metadata: selectedWorkflowId ? { workflow_id: selectedWorkflowId } : {},
      source_mode: 'manual',
    });
  };

  if (!projectId) {
    return <div className="p-4 text-[var(--text-muted)]">No project selected</div>;
  }

  if (scenesQuery.isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full comfy-bg-primary">
      <SceneToolbar scene={selectedItem} />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] border-r border-comfy-border flex-shrink-0 overflow-hidden">
          <SceneListPanel
            scenes={sceneItems}
            selectedAssetId={selectedAssetId}
            onSelect={setSelectedAssetId}
            onCreate={handleCreateScene}
            isCreating={createMutation.isPending}
            batchScenes={
              isBatchAsset
                ? effectiveBatchScenes!.map((s, idx) => ({
                    title: s.title || `Scene ${idx + 1}`,
                    subtitle: s.emotional_beat || s.purpose || s.setting || '',
                  }))
                : null
            }
            selectedBatchIndex={batchSceneIndex}
            onSelectBatchIndex={setBatchSceneIndex}
          />
        </div>
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-comfy-border overflow-auto p-4">
            {selectedAssetId ? (
              <SceneEditorPanel
                projectId={projectId}
                assetId={selectedAssetId}
                batchScenes={isBatchAsset ? effectiveBatchScenes : undefined}
                onBatchScenesChange={isBatchAsset ? setBatchScenesDraft : undefined}
                batchSceneIndex={isBatchAsset ? batchSceneIndex : undefined}
                onBatchSceneIndexChange={isBatchAsset ? setBatchSceneIndex : undefined}
              />
            ) : (
              <div className="text-sm text-comfy-muted">Select a scene to edit.</div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            <ScenePreview asset={selectedAsset} />
          </div>
        </div>
      </div>
    </div>
  );
}
