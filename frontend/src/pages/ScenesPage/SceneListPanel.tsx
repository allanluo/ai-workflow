export type SceneListItem = {
  assetId: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  status: 'approved' | 'draft' | 'warning';
  badge?: string;
};

interface SceneListPanelProps {
  scenes: SceneListItem[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onCreate: () => void;
  isCreating?: boolean;
  batchScenes?: { title: string; subtitle: string }[] | null;
  selectedBatchIndex?: number;
  onSelectBatchIndex?: (index: number) => void;
}

export function SceneListPanel({
  scenes,
  selectedAssetId,
  onSelect,
  onCreate,
  isCreating = false,
  batchScenes = null,
  selectedBatchIndex = 0,
  onSelectBatchIndex,
}: SceneListPanelProps) {
  const effectiveSelectedAssetId = selectedAssetId ?? scenes[0]?.assetId ?? null;
  const effectiveSelectedBatchIndex = selectedBatchIndex ?? 0;

  const getStatusBadge = (status: SceneListItem['status']) => {
    switch (status) {
      case 'approved':
        return <span className="comfy-badge-success text-xs">✓</span>;
      case 'draft':
        return <span className="comfy-badge-neutral text-xs">Draft</span>;
      case 'warning':
        return <span className="comfy-badge-warning text-xs">⚠</span>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-comfy-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-comfy-text">Scenes</h3>
          <button
            onClick={onCreate}
            disabled={isCreating}
            className="comfy-btn text-xs disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="text-xs text-comfy-muted">{scenes.length} items</div>
      </div>

      <div className="p-3">
        <div className="text-[11px] text-comfy-muted mb-2">Scene</div>
        <select
          value={effectiveSelectedAssetId || ''}
          onChange={e => onSelect(e.target.value)}
          className="comfy-input w-full text-xs"
          disabled={scenes.length === 0}
        >
          {scenes.length === 0 ? (
            <option value="">No scenes yet</option>
          ) : (
            scenes.map(scene => (
              <option key={scene.assetId} value={scene.assetId}>
                {scene.title} · {new Date(scene.updatedAt).toLocaleDateString()}
              </option>
            ))
          )}
        </select>

        {effectiveSelectedAssetId && (
          <div className="mt-3">
            {(() => {
              const selected = scenes.find(s => s.assetId === effectiveSelectedAssetId);
              if (!selected) return null;
              const isBatch = selected.badge === 'Batch';
              if (isBatch) return null;
              return (
                <div
                  className="p-3 rounded bg-comfy-selection-bg border-l-4 border-l-[var(--accent)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-comfy-text truncate">
                      {selected.title}
                    </span>
                    {getStatusBadge(selected.status)}
                  </div>
                  <div className="text-xs text-comfy-muted mt-1">{selected.subtitle}</div>
                </div>
              );
            })()}
          </div>
        )}

        {batchScenes && batchScenes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-comfy-muted">Scenes in batch</div>
              <div className="text-[11px] text-comfy-muted">{batchScenes.length}</div>
            </div>
            <div className="max-h-[45vh] overflow-auto rounded bg-comfy-input-bg">
              {batchScenes.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectBatchIndex?.(idx)}
                  className={`w-full text-left px-3 py-2 border-b border-comfy-border transition-colors ${
                    idx === effectiveSelectedBatchIndex
                      ? 'bg-comfy-selection-bg border-l-4 border-l-[var(--accent)]'
                      : 'hover:bg-comfy-input-bg'
                  }`}
                >
                  <div className="text-sm font-medium text-comfy-text truncate">
                    {s.title || `Scene ${idx + 1}`}
                  </div>
                  <div className="text-xs text-comfy-muted truncate">{s.subtitle || ''}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
