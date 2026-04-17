import { useMemo, useState } from 'react';
import type { Shot } from './ShotsPage';

interface ShotListPanelProps {
  shots: Shot[];
  projectId: string;
  plans: { id: string; title: string; updatedAt: string }[];
  selectedPlanId?: string | null;
  onSelectPlan?: (planId: string) => void;
  selectedShotId?: string | null;
  onSelectShot?: (shotId: string) => void;
}

export function ShotListPanel({
  shots,
  projectId,
  plans,
  selectedPlanId,
  onSelectPlan,
  selectedShotId,
  onSelectShot,
}: ShotListPanelProps) {
  const [sceneFilter, setSceneFilter] = useState<string>('all');
  const effectiveSelectedShotId = selectedShotId ?? shots[0]?.id ?? null;

  const sceneOptions = useMemo(() => {
    const set = new Set<string>();
    for (const shot of shots) {
      if (shot.sceneId && shot.sceneId.trim()) set.add(shot.sceneId.trim());
    }
    return Array.from(set);
  }, [shots]);

  const filteredShots =
    sceneFilter === 'all' ? shots : shots.filter(s => (s.sceneId || '').trim() === sceneFilter);

  const grouped = useMemo(() => {
    const hasScenes = sceneOptions.length > 0;
    if (!hasScenes) return null;
    const order: string[] = [];
    const byScene: Record<string, Shot[]> = {};
    for (const shot of filteredShots) {
      const key = (shot.sceneId || '').trim() || 'Unassigned';
      if (!byScene[key]) {
        byScene[key] = [];
        order.push(key);
      }
      byScene[key].push(shot);
    }
    return { order, byScene };
  }, [filteredShots, sceneOptions.length]);

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
          <span className="text-xs text-comfy-muted">{shots.length}</span>
        </div>
        <div className="space-y-2">
          <div className="text-[11px] text-comfy-muted">Shot plan</div>
          <select
            value={selectedPlanId || plans[0]?.id || ''}
            onChange={e => onSelectPlan?.(e.target.value)}
            className="comfy-input w-full text-xs"
            disabled={plans.length === 0}
          >
            {plans.length === 0 ? (
              <option value="">No shot plans yet</option>
            ) : (
              plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} · {new Date(p.updatedAt).toLocaleDateString()}
                </option>
              ))
            )}
          </select>

          <div className="text-[11px] text-comfy-muted">Scene</div>
          <select
            value={sceneFilter}
            onChange={e => setSceneFilter(e.target.value)}
            className="comfy-input w-full text-xs"
            disabled={sceneOptions.length === 0}
          >
            <option value="all">All scenes</option>
            {sceneOptions.map(scene => (
              <option key={scene} value={scene}>
                {scene}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {grouped
          ? grouped.order.map(scene => (
              <div key={scene}>
                <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-comfy-muted bg-comfy-input-bg border-b border-comfy-border">
                  {scene}
                </div>
                {grouped.byScene[scene].map(shot => (
                  <div
                    key={shot.id}
                    onClick={() => onSelectShot?.(shot.id)}
                    role="button"
                    aria-selected={effectiveSelectedShotId === shot.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer border-b border-comfy-border transition-colors ${
                      effectiveSelectedShotId === shot.id
                        ? 'bg-comfy-selection-bg border-l-4 border-l-[var(--accent)]'
                        : 'hover:bg-comfy-input-bg'
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
                        <span className="text-sm font-medium text-comfy-text truncate">
                          {shot.title}
                        </span>
                        {getStatusBadge(shot.status)}
                      </div>
                      <span className="text-xs text-comfy-muted truncate block">{shot.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          : filteredShots.map(shot => (
              <div
                key={shot.id}
                onClick={() => onSelectShot?.(shot.id)}
                role="button"
                aria-selected={effectiveSelectedShotId === shot.id}
                className={`flex items-center gap-3 p-3 cursor-pointer border-b border-comfy-border transition-colors ${
                  effectiveSelectedShotId === shot.id
                    ? 'bg-comfy-selection-bg border-l-4 border-l-[var(--accent)]'
                    : 'hover:bg-comfy-input-bg'
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
                  <span className="text-xs text-comfy-muted truncate block">
                    {shot.sceneId ? `${shot.sceneId} · ` : ''}
                    {shot.subtitle}
                  </span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
