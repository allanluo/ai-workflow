import { useState } from 'react';
import { useSelectionStore } from '../../stores';
import type { Shot } from './ShotsPage';

interface ShotListPanelProps {
  shots: Shot[];
  projectId: string;
}

export function ShotListPanel({ shots, projectId }: ShotListPanelProps) {
  const [sceneFilter, setSceneFilter] = useState<string>('all');
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectShot = useSelectionStore(s => s.selectShot);

  const filteredShots =
    sceneFilter === 'all' ? shots : shots.filter(s => s.sceneId === sceneFilter);

  const getStatusBadge = (status: Shot['status']) => {
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
          <h3 className="text-sm font-semibold text-comfy-text">Shots</h3>
          <button className="comfy-btn text-xs">+ Add</button>
        </div>
        <select
          value={sceneFilter}
          onChange={e => setSceneFilter(e.target.value)}
          className="comfy-input w-full text-xs"
        >
          <option value="all">All Scenes</option>
          <option value="sc1">Scene 1</option>
          <option value="sc2">Scene 2</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredShots.map(shot => (
          <div
            key={shot.id}
            onClick={() => selectShot(shot.id)}
            className={`flex items-center gap-3 p-3 cursor-pointer border-b border-comfy-border transition-colors ${
              selectedShotId === shot.id ? 'bg-comfy-highlight' : 'hover:bg-comfy-input-bg'
            }`}
          >
            <div className="w-14 h-14 bg-comfy-input-bg rounded flex items-center justify-center flex-shrink-0">
              {shot.thumbnail ? (
                <img
                  src={shot.thumbnail}
                  alt={shot.title}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <span className="text-xs text-comfy-muted">No img</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-comfy-text truncate">{shot.title}</span>
                {getStatusBadge(shot.status)}
              </div>
              <span className="text-xs text-comfy-muted truncate block">{shot.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
