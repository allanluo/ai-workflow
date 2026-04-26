import { useState } from 'react';
import type { Shot } from './ShotsPage';

interface ShotToolbarProps {
  projectId: string;
  shot: Shot;
  onAddShot?: () => void;
  onDeleteShot?: () => void;
  canDeleteShot?: boolean;
  isMutating?: boolean;
  onPreview?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
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
  onPreview,
  onExport,
  isExporting = false,
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
            disabled={isMutating || isExporting}
          >
            + Shot
          </button>
        )}
        {onDeleteShot && (
          <button
            type="button"
            className="comfy-btn-danger text-xs disabled:opacity-50"
            onClick={onDeleteShot}
            disabled={isMutating || !canDeleteShot || isExporting}
          >
            Delete Shot
          </button>
        )}
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`comfy-btn text-xs ${isLocked ? 'comfy-btn-warning' : 'comfy-btn-secondary'}`}
          disabled={isExporting}
        >
          {isLocked ? '🔒 Locked' : 'Lock Fields'}
        </button>
        {onPreview && (
          <>
            <div className="w-px h-6 bg-comfy-border mx-1" />
            <button
              onClick={onPreview}
              className="comfy-btn-secondary text-xs flex items-center gap-1.5 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Preview
            </button>
          </>
        )}
        {onExport && (
          <>
            <div className="w-px h-6 bg-comfy-border mx-1" />
            <button
              onClick={onExport}
              disabled={isExporting}
              className="comfy-btn-primary text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(91,141,239,0.2)] disabled:opacity-50 transition-all"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Quick Export
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
