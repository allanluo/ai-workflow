import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAssetVersion, fetchAsset, updateAsset, type Asset } from '../lib/api';
import { Button, Input, Label, Textarea } from '../components/common';
import { showToast } from '../stores';

interface SceneEditorPanelProps {
  projectId: string;
  assetId: string;
  batchScenes?: SceneItem[] | null;
  onBatchScenesChange?: (scenes: SceneItem[] | null) => void;
  batchSceneIndex?: number;
  onBatchSceneIndexChange?: (index: number) => void;
}

export type SceneItem = {
  title: string;
  purpose: string;
  emotional_beat: string;
  setting: string;
};

export function SceneEditorPanel({
  projectId,
  assetId,
  batchScenes: controlledBatchScenes,
  onBatchScenesChange,
  batchSceneIndex,
  onBatchSceneIndexChange,
}: SceneEditorPanelProps) {
  const queryClient = useQueryClient();

  const { data: asset, isLoading, error } = useQuery<Asset>({
    queryKey: ['asset', projectId, assetId],
    queryFn: () => fetchAsset(assetId),
    enabled: Boolean(projectId) && Boolean(assetId),
  });

  const [title, setTitle] = useState('');
  const [baseContent, setBaseContent] = useState<Record<string, unknown>>({});

  // Single-scene fields
  const [purpose, setPurpose] = useState('');
  const [emotional_beat, setEmotionalBeat] = useState('');
  const [setting, setSetting] = useState('');

  // Batch (scenes[]) fields (optionally controlled by parent)
  const [internalBatchScenes, setInternalBatchScenes] = useState<SceneItem[] | null>(null);
  const [internalBatchIndex, setInternalBatchIndex] = useState(0);

  const batchScenes = controlledBatchScenes !== undefined ? controlledBatchScenes : internalBatchScenes;
  const setBatchScenes = (next: SceneItem[] | null) => {
    if (onBatchScenesChange) onBatchScenesChange(next);
    else setInternalBatchScenes(next);
  };

  const selectedBatchIndex =
    typeof batchSceneIndex === 'number' ? batchSceneIndex : internalBatchIndex;
  const setSelectedBatchIndex = (next: number) => {
    if (onBatchSceneIndexChange) onBatchSceneIndexChange(next);
    else setInternalBatchIndex(next);
  };

  const blankScene = (): SceneItem => ({
    title: '',
    purpose: '',
    emotional_beat: '',
    setting: '',
  });

  const parseSceneItems = (raw: unknown): SceneItem[] | null => {
    const tryFromObj = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return null;
      const scenes = (obj as Record<string, unknown>).scenes;
      if (!Array.isArray(scenes)) return null;
      const normalized = scenes.flatMap(s => {
        if (!s || typeof s !== 'object') return [];
        const so = s as Record<string, unknown>;
        const scene: SceneItem = {
          title: typeof so.title === 'string' ? so.title : '',
          purpose: typeof so.purpose === 'string' ? so.purpose : '',
          emotional_beat:
            typeof so.emotional_beat === 'string'
              ? so.emotional_beat
              : typeof so.emotionalBeat === 'string'
                ? (so.emotionalBeat as string)
                : '',
          setting: typeof so.setting === 'string' ? so.setting : '',
        };
        const hasAny = Object.values(scene).some(v => typeof v === 'string' && v.trim());
        return hasAny ? [scene] : [];
      });
      return normalized;
    };

    const direct = tryFromObj(raw);
    if (direct) return direct;

    if (raw && typeof raw === 'object') {
      const rawText =
        typeof (raw as Record<string, unknown>)._raw === 'string'
          ? ((raw as Record<string, unknown>)._raw as string)
          : typeof (raw as Record<string, unknown>).text === 'string'
            ? ((raw as Record<string, unknown>).text as string)
            : null;
      if (rawText) {
        try {
          return tryFromObj(JSON.parse(rawText));
        } catch {
          return null;
        }
      }
    }

    return null;
  };

  const clampIndex = (index: number, len: number) => {
    if (len <= 0) return 0;
    return Math.min(Math.max(index, 0), len - 1);
  };

  const resetFromAsset = (nextAsset: Asset) => {
    setTitle(nextAsset.title || '');
    const content = (nextAsset.current_version?.content ?? {}) as Record<string, unknown>;
    setBaseContent(content);

    const scenes = parseSceneItems(content);
    if (scenes && scenes.length > 0) {
      setBatchScenes(scenes);
      setSelectedBatchIndex(0);
      setPurpose('');
      setEmotionalBeat('');
      setSetting('');
      return;
    }

    setBatchScenes(null);
    setPurpose((content?.purpose as string) || '');
    setEmotionalBeat((content?.emotional_beat as string) || (content?.emotionalBeat as string) || '');
    setSetting((content?.setting as string) || '');
  };

  useEffect(() => {
    if (asset) resetFromAsset(asset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, asset?.current_asset_version_id]);

  const computedContent = useMemo(() => {
    const updatedContent: Record<string, unknown> = { ...(baseContent ?? {}) };
    if (batchScenes && batchScenes.length > 0) {
      updatedContent.scenes = batchScenes;
    } else {
      updatedContent.purpose = purpose;
      updatedContent.emotional_beat = emotional_beat;
      updatedContent.setting = setting;
    }
    return updatedContent;
  }, [baseContent, batchScenes, purpose, emotional_beat, setting]);

  const updateSceneMutation = useMutation({
    mutationFn: async (input: { title: string; content: Record<string, unknown> }) => {
      await updateAsset(assetId, { title: input.title });
      await createAssetVersion(assetId, {
        content: input.content,
        source_mode: 'manual',
        status: 'draft',
        make_current: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', projectId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'scene'] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'shot'] });
      showToast({ type: 'success', title: 'Scene saved', message: 'Saved a new version.' });
    },
    onError: err => {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  const addBatchSceneAfterSelected = () => {
    const current = batchScenes && batchScenes.length > 0 ? batchScenes : [blankScene()];
    const currentIndex = clampIndex(selectedBatchIndex, current.length);
    const insertAt = Math.min(Math.max(currentIndex + 1, 0), current.length);
    const next = [...current.slice(0, insertAt), blankScene(), ...current.slice(insertAt)];
    setBatchScenes(next);
    setSelectedBatchIndex(clampIndex(insertAt, next.length));
  };

  const removeSelectedBatchScene = () => {
    const current = batchScenes && batchScenes.length > 0 ? batchScenes : [blankScene()];
    const currentLen = current.length;
    const currentIndex = clampIndex(selectedBatchIndex, currentLen);
    if (currentLen <= 1) {
      setBatchScenes([blankScene()]);
      setSelectedBatchIndex(0);
      return;
    }
    const next = current.filter((_, idx) => idx !== currentIndex);
    setBatchScenes(next.length > 0 ? next : [blankScene()]);
    setSelectedBatchIndex(clampIndex(currentIndex, next.length));
  };

  const moveSelectedBatchScene = (direction: -1 | 1) => {
    const current = batchScenes && batchScenes.length > 0 ? batchScenes : [];
    const currentLen = current.length;
    const currentIndex = clampIndex(selectedBatchIndex, currentLen);
    const nextIndex = currentIndex + direction;
    if (currentLen < 2) return;
    if (nextIndex < 0 || nextIndex >= currentLen) return;

    const target = currentIndex + direction;
    const next = [...current];
    [next[currentIndex], next[target]] = [next[target], next[currentIndex]];
    setBatchScenes(next);
    setSelectedBatchIndex(nextIndex);
  };

  const handleSave = () => updateSceneMutation.mutate({ title, content: computedContent });
  const handleReset = () => asset && resetFromAsset(asset);

  const batchCount = batchScenes?.length ?? 0;
  const isBatch = batchCount > 0;
  const safeBatchIndex = clampIndex(selectedBatchIndex, batchCount);
  const selectedScene = isBatch ? batchScenes?.[safeBatchIndex] ?? null : null;
  const canMoveUp = isBatch && safeBatchIndex > 0;
  const canMoveDown = isBatch && safeBatchIndex < batchCount - 1;

  useEffect(() => {
    if (!isBatch) return;
    const clamped = clampIndex(selectedBatchIndex, batchCount);
    if (clamped !== selectedBatchIndex) setSelectedBatchIndex(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatch, batchCount, selectedBatchIndex]);

  if (isLoading) {
    return <div className="text-sm text-comfy-muted">Loading scene…</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Error loading scene: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (!asset) {
    return <div className="text-sm text-comfy-muted">Select a scene to edit.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-comfy-text truncate">
            {asset.title || 'Untitled Scene'}
          </div>
          <div className="text-xs text-comfy-muted">v{asset.current_version_number}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={updateSceneMutation.isPending}
            className="comfy-btn-secondary text-xs disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateSceneMutation.isPending}
            className="comfy-btn text-xs disabled:opacity-50"
          >
            {updateSceneMutation.isPending ? 'Saving…' : 'Save New Version'}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="scene-asset-title">Title</Label>
        <Input
          id="scene-asset-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Scene document title"
        />
      </div>

      {isBatch ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-muted)]">
              Scene {safeBatchIndex + 1} of {batchCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addBatchSceneAfterSelected}
                disabled={updateSceneMutation.isPending}
                title="Add a new scene after the selected one"
              >
                + Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => moveSelectedBatchScene(-1)}
                disabled={updateSceneMutation.isPending || !canMoveUp}
                title={canMoveUp ? 'Move scene up' : 'Already at top'}
              >
                ↑ Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => moveSelectedBatchScene(1)}
                disabled={updateSceneMutation.isPending || !canMoveDown}
                title={canMoveDown ? 'Move scene down' : 'Already at bottom'}
              >
                ↓ Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={removeSelectedBatchScene}
                disabled={updateSceneMutation.isPending || batchCount <= 1}
                title={batchCount <= 1 ? 'At least one scene is required' : 'Remove this scene'}
              >
                Remove
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="scene-item-title">Scene Title</Label>
            <Input
              id="scene-item-title"
              value={selectedScene?.title ?? ''}
              onChange={e => {
                const value = e.target.value;
                const current = batchScenes && batchScenes.length > 0 ? batchScenes : [];
                if (current.length === 0) return;
                const next = current.map((s, i) =>
                  i === safeBatchIndex ? { ...s, title: value } : s
                );
                setBatchScenes(next);
              }}
            />
          </div>

          <div>
            <Label htmlFor="scene-item-purpose">Purpose</Label>
            <Textarea
              id="scene-item-purpose"
              value={selectedScene?.purpose ?? ''}
              onChange={e => {
                const value = e.target.value;
                const current = batchScenes && batchScenes.length > 0 ? batchScenes : [];
                if (current.length === 0) return;
                const next = current.map((s, i) =>
                  i === safeBatchIndex ? { ...s, purpose: value } : s
                );
                setBatchScenes(next);
              }}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="scene-item-emotional_beat">Emotional Beat</Label>
            <Input
              id="scene-item-emotional_beat"
              value={selectedScene?.emotional_beat ?? ''}
              onChange={e => {
                const value = e.target.value;
                const current = batchScenes && batchScenes.length > 0 ? batchScenes : [];
                if (current.length === 0) return;
                const next = current.map((s, i) =>
                  i === safeBatchIndex ? { ...s, emotional_beat: value } : s
                );
                setBatchScenes(next);
              }}
            />
          </div>

          <div>
            <Label htmlFor="scene-item-setting">Setting</Label>
            <Textarea
              id="scene-item-setting"
              value={selectedScene?.setting ?? ''}
              onChange={e => {
                const value = e.target.value;
                const current = batchScenes && batchScenes.length > 0 ? batchScenes : [];
                if (current.length === 0) return;
                const next = current.map((s, i) =>
                  i === safeBatchIndex ? { ...s, setting: value } : s
                );
                setBatchScenes(next);
              }}
              rows={3}
            />
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="scene-purpose">Purpose</Label>
            <Textarea
              id="scene-purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="scene-emotional_beat">Emotional Beat</Label>
            <Input
              id="scene-emotional_beat"
              value={emotional_beat}
              onChange={e => setEmotionalBeat(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="scene-setting">Setting</Label>
            <Textarea
              id="scene-setting"
              value={setting}
              onChange={e => setSetting(e.target.value)}
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}
