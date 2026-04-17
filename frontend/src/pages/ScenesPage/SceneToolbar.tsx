import type { SceneListItem } from './SceneListPanel';

interface SceneToolbarProps {
  scene: SceneListItem | null;
}

const statusColors = {
  approved: 'comfy-badge-success',
  draft: 'comfy-badge-neutral',
  warning: 'comfy-badge-warning',
};

export function SceneToolbar({ scene }: SceneToolbarProps) {
  const title = scene?.title ?? 'Scenes';
  const status = scene?.status ?? 'draft';

  return (
    <div className="h-14 px-4 flex items-center justify-between border-b border-comfy-border bg-comfy-input-bg flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-comfy-muted">Project / Scenes</span>
        {scene && (
          <>
            <span className="text-comfy-border">/</span>
            <span className="text-sm text-comfy-text font-medium truncate">{title}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[status]}`}>
              {status === 'approved' ? 'Approved' : status === 'draft' ? 'Draft' : 'Needs Revision'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-comfy-muted">
          {scene?.badge ? scene.badge : ''}
        </span>
      </div>
    </div>
  );
}

