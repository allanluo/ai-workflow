import { useMemo, useState } from 'react';
import type { Shot } from './ShotsPage';
import { createAsset, createAssetVersion } from '../../lib/api';
import { ShotPlanSchema } from '../../types/shotPlan';
import { showToast } from '../../stores';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const [activeTab, setActiveTab] = useState<'shots' | 'import'>('shots');
  const [importText, setImportText] = useState('');
  const [validatedData, setValidatedData] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const queryClient = useQueryClient();

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

  const handleCopyTemplate = () => {
    const template = {
      title: "New Project",
      scenes: [
        {
          scene: 1,
          description: "Introduction",
          shots: [
            {
              shot: 1,
              action: "Subject enters the frame",
              characters: ["Lead"],
              props: ["Briefcase"],
              frame_prompt: "Cinematic medium shot of a man entering a modern office carrying a black briefcase, soft daylight.",
              video_prompt: "Slow dolly in as the character walks toward the camera."
            }
          ]
        }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    showToast({ type: 'success', title: 'Copied', message: 'Template JSON copied to clipboard.' });
  };

  const validateImport = () => {
    setValidationError(null);
    setValidatedData(null);

    const match = importText.match(/\{[\s\S]*\}/);
    if (!match) {
      setValidationError("No JSON object found in text.");
      return;
    }

    try {
      const parsed = JSON.parse(match[0]);
      const result = ShotPlanSchema.safeParse(parsed);
      if (!result.success) {
        setValidationError(result.error.errors[0].message + " at " + result.error.errors[0].path.join('.'));
        return;
      }
      setValidatedData(result.data);
      showToast({ type: 'success', title: 'Valid JSON', message: 'Schema validation passed.' });
    } catch (e) {
      setValidationError("Invalid JSON format.");
    }
  };

  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. Create the base asset
      const asset = await createAsset({
        projectId: projectId,
        asset_type: 'shot_plan',
        asset_category: 'script',
        title: data.title || 'Imported Shot Plan',
        content: {}, // Base asset content can be empty, version will have the real data
        source_mode: 'import',
        status: 'draft',
        metadata: { source: 'import' }
      });
      
      // 2. Create the first version with the content
      await createAssetVersion(asset.id, {
        content: data,
        source_mode: 'manual',
        status: 'draft',
        make_current: true
      });

      return asset;
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      onSelectPlan?.(asset.id);
      setActiveTab('shots');
      setImportText('');
      setValidatedData(null);
      showToast({ type: 'success', title: 'Import successful', message: 'Created new shot plan asset.' });
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Import failed', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-comfy-border bg-comfy-bg-secondary">
        <button
          onClick={() => setActiveTab('shots')}
          className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'shots' ? 'text-[var(--accent)] border-b-2 border-b-[var(--accent)]' : 'text-comfy-muted hover:text-comfy-text'
          }`}
        >
          Shots
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'import' ? 'text-[var(--accent)] border-b-2 border-b-[var(--accent)]' : 'text-comfy-muted hover:text-comfy-text'
          }`}
        >
          Import
        </button>
      </div>

      {activeTab === 'shots' ? (
        <>
          <div className="p-3 border-b border-comfy-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-comfy-text">Plan</h3>
              <span className="text-xs text-comfy-muted">{shots.length} shots</span>
            </div>
            <div className="space-y-2">
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

              {sceneOptions.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase text-comfy-muted mb-1 font-semibold">Filter Scene</div>
                  <select
                    value={sceneFilter}
                    onChange={e => setSceneFilter(e.target.value)}
                    className="comfy-input w-full text-xs"
                  >
                    <option value="all">All scenes</option>
                    {sceneOptions.map(scene => (
                      <option key={scene} value={scene}>
                        {scene}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {grouped
              ? grouped.order.map(scene => (
                  <div key={scene}>
                    <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-comfy-muted bg-comfy-input-bg border-b border-comfy-border flex justify-between items-center">
                      <span>{scene}</span>
                      <span>{grouped.byScene[scene].length}</span>
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
        </>
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-comfy-text">Import JSON</h3>
            <button
              onClick={handleCopyTemplate}
              className="text-[10px] text-[var(--accent)] hover:underline font-bold uppercase"
            >
              Copy Example
            </button>
          </div>
          
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your JSON here (e.g. from ChatGPT)..."
            className="comfy-input flex-1 w-full text-xs font-mono p-3 mb-4 resize-none leading-relaxed"
          />

          {validationError && (
             <div className="p-2 mb-4 bg-red-900/20 border border-red-500/30 rounded text-[11px] text-red-200">
                <strong>Error:</strong> {validationError}
             </div>
          )}

          <div className="space-y-2">
            <button
              onClick={validateImport}
              className="w-full py-2 bg-comfy-bg-secondary text-comfy-text border border-comfy-border rounded text-xs font-bold hover:bg-comfy-input-bg transition-colors"
            >
              Validate Structure
            </button>
            <button
              disabled={!validatedData || importMutation.isPending}
              onClick={() => importMutation.mutate(validatedData)}
              className="w-full py-2 bg-[var(--accent)] text-white rounded text-xs font-bold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {importMutation.isPending ? 'Importing...' : 'Create Project Asset'}
            </button>
          </div>
          
          <div className="mt-4 text-[10px] text-comfy-muted italic space-y-1">
            <p>• We'll pick out the JSON from any text you paste.</p>
            <p>• Scenes and characters will be saved automatically.</p>
          </div>
        </div>
      )}
    </div>
  );
}
