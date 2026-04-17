export type CanonListItem = {
  assetId: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

interface CanonListPanelProps {
  items: CanonListItem[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onCreate: () => void;
  isCreating?: boolean;
}

export function CanonListPanel({
  items,
  selectedAssetId,
  onSelect,
  onCreate,
  isCreating = false,
}: CanonListPanelProps) {
  const effectiveSelectedId = selectedAssetId || items[0]?.assetId || '';
  const selected = items.find(i => i.assetId === effectiveSelectedId) ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-comfy-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-comfy-text">Canon</h3>
          <button
            type="button"
            onClick={onCreate}
            disabled={isCreating}
            className="comfy-btn text-xs disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="text-xs text-comfy-muted">{items.length} items</div>
      </div>

      <div className="p-3">
        <div className="text-[11px] text-comfy-muted mb-2">Canon document</div>
        <select
          value={effectiveSelectedId}
          onChange={e => onSelect(e.target.value)}
          className="comfy-input w-full text-xs"
          disabled={items.length === 0}
        >
          {items.length === 0 ? (
            <option value="">No canon yet</option>
          ) : (
            items.map(item => (
              <option key={item.assetId} value={item.assetId}>
                {item.title} · {new Date(item.updatedAt).toLocaleDateString()}
              </option>
            ))
          )}
        </select>

        {selected && (
          <div className="mt-3 p-3 rounded bg-comfy-input-bg">
            <div className="text-sm font-medium text-comfy-text truncate">{selected.title}</div>
            <div className="text-xs text-comfy-muted mt-1 line-clamp-3">{selected.subtitle}</div>
          </div>
        )}
      </div>
    </div>
  );
}

