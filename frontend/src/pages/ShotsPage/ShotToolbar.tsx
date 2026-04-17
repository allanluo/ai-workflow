import { useState } from 'react';
import type { Shot } from './ShotsPage';

interface ShotToolbarProps {
  projectId: string;
  shot: Shot;
  onAddShot?: () => void;
  onDeleteShot?: () => void;
  canDeleteShot?: boolean;
  isMutating?: boolean;
}

const statusColors = {
  approved: 'comfy-badge-success',
  draft: 'comfy-badge-neutral',
  warning: 'comfy-badge-warning',
};

export function ShotToolbar({
  projectId,
  shot,
  onAddShot,
  onDeleteShot,
  canDeleteShot = true,
  isMutating = false,
}: ShotToolbarProps) {
  const [isLocked, setIsLocked] = useState(false);

  const hasScene = Boolean(shot.sceneId && shot.sceneId.trim());

  return (
    <div className="h-14 px-4 flex items-center justify-between border-b border-comfy-border bg-comfy-input-bg flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-comfy-muted">Project / Shots</span>
        {hasScene && (
          <>
            <span className="text-comfy-border">/</span>
            <span className="text-sm text-comfy-muted truncate max-w-[260px]">
              {shot.sceneId}
            </span>
          </>
        )}
        <span className="text-comfy-border">/</span>
        <span className="text-sm text-comfy-text font-medium">{shot.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[shot.status]}`}>
          {shot.status === 'approved'
            ? 'Approved'
            : shot.status === 'draft'
              ? 'Draft'
              : 'Needs Revision'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onAddShot && (
          <button
            type="button"
            className="comfy-btn-secondary text-xs disabled:opacity-50"
            onClick={onAddShot}
            disabled={isMutating}
          >
            + Shot
          </button>
        )}
        {onDeleteShot && (
          <button
            type="button"
            className="comfy-btn-danger text-xs disabled:opacity-50"
            onClick={onDeleteShot}
            disabled={isMutating || !canDeleteShot}
          >
            Delete Shot
          </button>
        )}
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`comfy-btn text-xs ${isLocked ? 'comfy-btn-warning' : 'comfy-btn-secondary'}`}
        >
          {isLocked ? '🔒 Locked' : 'Lock Fields'}
        </button>
      </div>
    </div>
  );
}
