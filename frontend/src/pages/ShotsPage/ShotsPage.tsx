import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAssetVersion, fetchProjectAssets, type Asset } from '../../lib/api';
import { ShotListPanel } from './ShotListPanel';
import { ShotEditor } from './ShotEditor';
import { PreviewStack } from './PreviewStack';
import { ShotToolbar } from './ShotToolbar';
import { showToast } from '../../stores';

interface ShotsPageProps {
  projectId: string;
}

interface Shot {
  id: string;
  planId: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  status: 'approved' | 'draft' | 'warning';
  sceneId: string;
  prompt: string;
  negativePrompt: string;
  shotType: string;
  angle: string;
  motion: string;
  duration: number;
}

type ShotPlanItem = {
  id?: string;
  shotNumber?: string | number;
  description?: string;
  framing?: string;
  angle?: string;
  motion?: string;
  continuityNotes?: string;
  sceneTitle?: string;
};

type ShotPlanScene = {
  title?: string;
  shots?: ShotPlanItem[];
};

type ParsedShotPlanForEdit =
  | {
      mode: 'direct';
      wrapper: Record<string, unknown>;
      plan: Record<string, unknown>;
    }
  | {
      mode: 'wrapped';
      wrapper: Record<string, unknown>;
      wrapperKey: '_raw' | 'text';
      plan: Record<string, unknown>;
    };

function normalizeSpaceCase(value: string) {
  return value
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeTitleCase(value: string) {
  const cleaned = normalizeSpaceCase(value);
  return cleaned
    .split(' ')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(' ');
}

function extractShotPlanItems(asset: Asset): ShotPlanItem[] {
  const raw = asset.current_version?.content;
  if (!raw) return [];

  const tryFromObj = (obj: unknown): ShotPlanItem[] => {
    if (!obj || typeof obj !== 'object') return [];
    const record = obj as Record<string, unknown>;

    const directShots = record.shots;
    if (Array.isArray(directShots)) {
      return directShots.filter(s => s && typeof s === 'object') as ShotPlanItem[];
    }

    const scenesRaw = record.scenes;
    if (Array.isArray(scenesRaw)) {
      const scenes = scenesRaw.filter(s => s && typeof s === 'object') as ShotPlanScene[];
      const flattened: ShotPlanItem[] = [];
      for (const scene of scenes) {
        const sceneTitle = typeof scene.title === 'string' ? scene.title : '';
        const shots = Array.isArray(scene.shots)
          ? (scene.shots.filter(s => s && typeof s === 'object') as ShotPlanItem[])
          : [];
        for (const shot of shots) {
          flattened.push({
            ...shot,
            // carry scene info forward for UI grouping/filtering
            sceneTitle,
          } as unknown as ShotPlanItem);
        }
      }
      return flattened;
    }

    return [];
  };

  const direct = tryFromObj(raw);
  if (direct.length > 0) return direct;

  const rawText =
    typeof (raw as Record<string, unknown>)?._raw === 'string'
      ? ((raw as Record<string, unknown>)._raw as string)
      : typeof (raw as Record<string, unknown>)?.text === 'string'
        ? ((raw as Record<string, unknown>).text as string)
        : null;

  if (!rawText) return [];

  try {
    const parsed = JSON.parse(rawText);
    return tryFromObj(parsed);
  } catch {
    return [];
  }
}

function parseShotPlanForEdit(asset: Asset): ParsedShotPlanForEdit | null {
  const raw = (asset.current_version?.content ?? {}) as Record<string, unknown>;

  const hasDirectPlan = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return false;
    const record = obj as Record<string, unknown>;
    return Array.isArray(record.scenes) || Array.isArray(record.shots);
  };

  if (hasDirectPlan(raw)) {
    return { mode: 'direct', wrapper: raw, plan: raw };
  }

  const wrapperKey: '_raw' | 'text' | undefined =
    typeof raw._raw === 'string' ? '_raw' : typeof raw.text === 'string' ? 'text' : undefined;
  if (!wrapperKey) return null;
  const rawText = raw[wrapperKey];
  if (typeof rawText !== 'string' || !rawText) return null;

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!hasDirectPlan(parsed)) return null;
    return { mode: 'wrapped', wrapper: raw, wrapperKey, plan: parsed as Record<string, unknown> };
  } catch {
    return null;
  }
}

function writeBackShotPlan(parsed: ParsedShotPlanForEdit, nextPlan: Record<string, unknown>) {
  if (parsed.mode === 'direct') {
    return {
      ...(parsed.wrapper ?? {}),
      ...(nextPlan ?? {}),
    } as Record<string, unknown>;
  }

  return {
    ...(parsed.wrapper ?? {}),
    [parsed.wrapperKey]: JSON.stringify(nextPlan ?? {}, null, 2),
  } as Record<string, unknown>;
}

function ensureShotIdsInPlan(plan: Record<string, unknown>, planId: string) {
  let flatIndex = 0;

  const ensureShotId = (shot: ShotPlanItem) => {
    if (!shot || typeof shot !== 'object') return;
    if (typeof shot.id === 'string' && shot.id.trim()) return;
    shot.id = `${planId}:${flatIndex}`;
  };

  const scenesRaw = plan.scenes;
  if (Array.isArray(scenesRaw)) {
    for (const scene of scenesRaw) {
      if (!scene || typeof scene !== 'object') continue;
      const shots = (scene as Record<string, unknown>).shots;
      if (!Array.isArray(shots)) continue;
      for (const shot of shots) {
        if (!shot || typeof shot !== 'object') continue;
        ensureShotId(shot as ShotPlanItem);
        flatIndex += 1;
      }
    }
    return;
  }

  const shotsRaw = plan.shots;
  if (Array.isArray(shotsRaw)) {
    for (const shot of shotsRaw) {
      if (!shot || typeof shot !== 'object') continue;
      ensureShotId(shot as ShotPlanItem);
      flatIndex += 1;
    }
  }
}

function makeNewShotId(planId: string) {
  return `${planId}:manual:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function nextShotNumber(shots: ShotPlanItem[]) {
  let max = 0;
  for (const shot of shots) {
    const raw = shot.shotNumber;
    const asNumber =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))
          ? Number(raw)
          : null;
    if (typeof asNumber === 'number' && Number.isFinite(asNumber)) {
      max = Math.max(max, asNumber);
    }
  }
  return max + 1;
}

export function ShotsPage({ projectId }: ShotsPageProps) {
  const queryClient = useQueryClient();
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const shotsQuery = useQuery({
    queryKey: ['project-assets', projectId, 'shot'],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    select: assets => assets.filter(a => a.asset_type === 'shot_plan'),
  });

  const shotPlans = useMemo(
    () =>
      [...(shotsQuery.data ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [shotsQuery.data]
  );

  const selectedPlan =
    shotPlans.find(p => p.id === selectedPlanId) ?? (shotPlans.length > 0 ? shotPlans[0] : null);

  const planItems = selectedPlan ? extractShotPlanItems(selectedPlan) : [];

  const shots: Shot[] = selectedPlan
    ? planItems.map((item, index) => {
        const stableId =
          typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `${selectedPlan.id}:${index}`;
        const shotNumber =
          typeof item.shotNumber === 'number'
            ? String(item.shotNumber)
            : typeof item.shotNumber === 'string'
              ? item.shotNumber
              : String(index + 1);

        const description = typeof item.description === 'string' ? item.description : '';
        const framing = typeof item.framing === 'string' ? normalizeTitleCase(item.framing) : '';
        const angle = typeof item.angle === 'string' ? normalizeTitleCase(item.angle) : '';
        const motion = typeof item.motion === 'string' ? normalizeTitleCase(item.motion) : '';
        const continuityNotes =
          typeof item.continuityNotes === 'string' ? item.continuityNotes : '';
        const sceneTitle = typeof item.sceneTitle === 'string' ? item.sceneTitle : '';

        return {
          id: stableId,
          planId: selectedPlan.id,
          title: `Shot ${normalizeSpaceCase(shotNumber)}`,
          subtitle: description.slice(0, 120) || 'No description',
          thumbnail: '',
          status:
            selectedPlan.approval_state === 'approved'
              ? 'approved'
              : selectedPlan.approval_state === 'pending'
                ? 'warning'
                : 'draft',
          sceneId: sceneTitle || '',
          prompt: description,
          negativePrompt: continuityNotes,
          shotType: framing,
          angle,
          motion,
          duration: 0,
        };
      })
    : [];

  useEffect(() => {
    if (shotPlans.length === 0) return;
    if (!selectedPlanId || !shotPlans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(shotPlans[0].id);
      setSelectedShotId(null);
    }
  }, [shotPlans, selectedPlanId]);

  useEffect(() => {
    // When plan changes, reset shot selection so the first shot is shown.
    setSelectedShotId(null);
  }, [selectedPlanId]);

  const selectedShot =
    shots.find(s => s.id === selectedShotId) ||
    shots[0] || {
      id: '',
      planId: '',
      title: 'No Shots',
      subtitle: shotPlans.length === 0 ? 'Run a workflow to generate shot plans' : 'No shots found',
      thumbnail: '',
      status: 'draft' as const,
      sceneId: '',
      prompt: '',
      negativePrompt: '',
      shotType: '',
      angle: '',
      motion: '',
      duration: 0,
    };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleSelectShot = (shotId: string) => setSelectedShotId(shotId);

  const updatePlanMutation = useMutation({
    mutationFn: async (input: { planAssetId: string; content: Record<string, unknown> }) => {
      await createAssetVersion(input.planAssetId, {
        content: input.content,
        source_mode: 'manual',
        status: 'draft',
        make_current: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'shot'] });
    },
    onError: err => {
      showToast({
        type: 'error',
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  const handleAddShot = () => {
    if (!selectedPlan) return;

    const parsed = parseShotPlanForEdit(selectedPlan);
    if (!parsed) {
      showToast({
        type: 'error',
        title: 'Unsupported shot plan',
        message: 'This shot plan format cannot be edited.',
      });
      return;
    }

    const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
    ensureShotIdsInPlan(plan, selectedPlan.id);

    const desiredSceneTitle = (selectedShot.sceneId || '').trim();
    const afterShotId = (selectedShot.id || '').trim();
    const newShotId = makeNewShotId(selectedPlan.id);

    const blankShot: ShotPlanItem = {
      id: newShotId,
      shotNumber: 1,
      description: '',
      framing: '',
      angle: '',
      motion: '',
      continuityNotes: '',
    };

    const scenesRaw = plan.scenes;
    if (Array.isArray(scenesRaw) && scenesRaw.length > 0) {
      const scenes = scenesRaw as Record<string, unknown>[];
      const findSceneIndex = () => {
        if (!desiredSceneTitle) return 0;
        const wanted = desiredSceneTitle.toLowerCase();
        const idx = scenes.findIndex(s => {
          const title = typeof s.title === 'string' ? s.title.trim() : '';
          return title.toLowerCase() === wanted;
        });
        return idx >= 0 ? idx : 0;
      };
      const sceneIndex = findSceneIndex();
      const scene = scenes[sceneIndex] ?? {};
      const shotsRaw = Array.isArray(scene.shots) ? (scene.shots as ShotPlanItem[]) : [];
      const shotsList = shotsRaw.filter(s => s && typeof s === 'object') as ShotPlanItem[];

      blankShot.shotNumber = nextShotNumber(shotsList);

      const insertAfterIndex = afterShotId ? shotsList.findIndex(s => s.id === afterShotId) : -1;
      const insertAt = insertAfterIndex >= 0 ? insertAfterIndex + 1 : shotsList.length;
      const nextShots = [...shotsList.slice(0, insertAt), blankShot, ...shotsList.slice(insertAt)];

      scenes[sceneIndex] = { ...scene, shots: nextShots };
      plan.scenes = scenes;
    } else {
      const shotsRaw = Array.isArray(plan.shots) ? (plan.shots as ShotPlanItem[]) : [];
      const shotsList = shotsRaw.filter(s => s && typeof s === 'object') as ShotPlanItem[];
      blankShot.shotNumber = nextShotNumber(shotsList);
      const insertAfterIndex = afterShotId ? shotsList.findIndex(s => s.id === afterShotId) : -1;
      const insertAt = insertAfterIndex >= 0 ? insertAfterIndex + 1 : shotsList.length;
      plan.shots = [...shotsList.slice(0, insertAt), blankShot, ...shotsList.slice(insertAt)];
    }

    const nextContent = writeBackShotPlan(parsed, plan);
    updatePlanMutation.mutate({ planAssetId: selectedPlan.id, content: nextContent });
    setSelectedShotId(newShotId);
  };

  const handleDeleteShot = () => {
    if (!selectedPlan) return;
    const shotId = (selectedShot.id || '').trim();
    if (!shotId) return;

    const parsed = parseShotPlanForEdit(selectedPlan);
    if (!parsed) {
      showToast({
        type: 'error',
        title: 'Unsupported shot plan',
        message: 'This shot plan format cannot be edited.',
      });
      return;
    }

    const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
    ensureShotIdsInPlan(plan, selectedPlan.id);

    const currentIndex = shots.findIndex(s => s.id === shotId);
    const remainingIds = shots.filter(s => s.id !== shotId).map(s => s.id);
    const nextSelectedId =
      remainingIds[currentIndex] ?? remainingIds[Math.max(0, currentIndex - 1)] ?? null;

    let removed = false;

    const scenesRaw = plan.scenes;
    if (Array.isArray(scenesRaw)) {
      const scenes = scenesRaw as Record<string, unknown>[];
      for (let i = 0; i < scenes.length; i += 1) {
        const scene = scenes[i];
        const shotsRaw = Array.isArray(scene.shots) ? (scene.shots as ShotPlanItem[]) : [];
        const nextShots = shotsRaw.filter(s => (s as ShotPlanItem | null)?.id !== shotId);
        if (nextShots.length !== shotsRaw.length) {
          scenes[i] = { ...scene, shots: nextShots };
          removed = true;
          break;
        }
      }
      plan.scenes = scenes;
    } else if (Array.isArray(plan.shots)) {
      const shotsRaw = plan.shots as ShotPlanItem[];
      const nextShots = shotsRaw.filter(s => (s as ShotPlanItem | null)?.id !== shotId);
      removed = nextShots.length !== shotsRaw.length;
      plan.shots = nextShots;
    }

    if (!removed) return;
    const nextContent = writeBackShotPlan(parsed, plan);
    updatePlanMutation.mutate({ planAssetId: selectedPlan.id, content: nextContent });
    setSelectedShotId(nextSelectedId);
  };

  if (!projectId) {
    return <div className="p-4 text-[var(--text-muted)]">No project selected</div>;
  }

  if (shotsQuery.isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full comfy-bg-primary">
      <ShotToolbar
        projectId={projectId}
        shot={selectedShot}
        onAddShot={selectedPlan ? handleAddShot : undefined}
        onDeleteShot={selectedPlan ? handleDeleteShot : undefined}
        canDeleteShot={Boolean(selectedPlan && selectedShot.id)}
        isMutating={updatePlanMutation.isPending}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] border-r border-comfy-border flex-shrink-0 overflow-hidden">
          <ShotListPanel
            shots={shots}
            projectId={projectId}
            plans={shotPlans.map(p => ({
              id: p.id,
              title: p.title || 'Untitled Shot Plan',
              updatedAt: p.updated_at,
            }))}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
            selectedShotId={selectedShotId}
            onSelectShot={handleSelectShot}
          />
        </div>
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-comfy-border overflow-auto p-4">
            <ShotEditor projectId={projectId} shot={selectedShot} />
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PreviewStack projectId={projectId} shot={selectedShot} />
          </div>
        </div>
      </div>
    </div>
  );
}

export type { Shot };
