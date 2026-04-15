import { useState, useEffect } from 'react';
import type { Shot } from './ShotsPage';

interface ShotToolbarProps {
  projectId: string;
  shot: Shot;
}

const statusColors = {
  approved: 'comfy-badge-success',
  draft: 'comfy-badge-neutral',
  warning: 'comfy-badge-warning',
};

export function ShotToolbar({ projectId, shot }: ShotToolbarProps) {
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div className="h-14 px-4 flex items-center justify-between border-b border-comfy-border bg-comfy-input-bg flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-comfy-muted">Project / Shots</span>
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
        <button className="comfy-btn">Regenerate</button>
        <button className="comfy-btn-secondary">Compare</button>
        <button className="comfy-btn-secondary">Validate</button>
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`comfy-btn text-xs ${isLocked ? 'comfy-btn-warning' : 'comfy-btn-secondary'}`}
        >
          {isLocked ? '🔒 Locked' : 'Lock Fields'}
        </button>
        <button className="comfy-btn-success">Save New Version</button>
      </div>
    </div>
  );
}
