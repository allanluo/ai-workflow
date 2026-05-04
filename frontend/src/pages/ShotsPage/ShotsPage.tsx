import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, createAssetVersion, fetchProjectAssets, type Asset } from '../../lib/api';
import { ensureShotIdsInPlan, parseShotPlanForEdit, writeBackShotPlan } from '../../lib/shotPlanEditing';
import { ShotListPanel } from './ShotListPanel';
import { ShotEditor } from './ShotEditor';
import { PreviewStack } from './PreviewStack';
import { ShotToolbar } from './ShotToolbar';
import { StoryboardPreviewModal } from './StoryboardPreviewModal';
import { showToast } from '../../stores';
import { useSelectionStore } from '../../stores';
import { useProjectEvents } from '../../lib/useProjectEvents';

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
  negative_prompt: string;
  shot_type: string;
  angle: string;
  motion: string;
  duration: number;
  generator_prompt?: string;
  generator_negative_prompt?: string;
  generator_prompt_structured?: string;
  // Advanced fields
  action?: string;
  narration_text?: string;
  narration?: string;
  internal_monologue?: string;
  dialogue?: string;
  characters?: string[];
  environment?: string;
  props?: string[];
  frame_prompt?: string;
  video_prompt?: string;
}

type ShotPlanItem = {
  id?: string;
  shot?: string | number;
  shotNumber?: string | number;
  shot_number?: string | number;
  action?: string;
  description?: string;
  narration_text?: string;
  narrationText?: string;
  narration?: string;
  internal_monologue?: string;
  internalMonologue?: string;
  dialogue?: string;
  characters?: string[];
  environment?: string;
  props?: string[];
  framing?: string;
  angle?: string;
  motion?: string;
  continuity_notes?: string;
  frame_prompt?: string;
  video_prompt?: string;
  sceneTitle?: string;
  image?: {
    prompt_structured?: string;
    prompt?: string;
    negative_prompt?: string;
  };
};

type ShotPlanScene = {
  scene?: number;
  title?: string;
  description?: string;
  purpose?: string;
  emotionalBeat?: string;
  emotional_beat?: string;
  setting?: string;
  shot_count?: number;
  shots?: ShotPlanItem[];
  // Allow legacy/flexible fields
  action?: string;
  narration?: string;
  framing?: string;
  angle?: string;
  motion?: string;
  frame_prompt?: string;
  video_prompt?: string;
};

function normalizeSpaceCase(value: string) {
  return value
    .trim()
    .replace(/_+/g, ' ')
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

  const tryFromObj = (obj: unknown, depth = 0): ShotPlanItem[] => {
    if (depth > 4) return [];
    if (!obj || typeof obj !== 'object') return [];
    const record = obj as Record<string, unknown>;

    const directShots = record.shots;
    if (Array.isArray(directShots)) {
      const items = (directShots.filter(s => s && typeof s === 'object') as Record<string, unknown>[]).map((s, i) => {
        const shot_number = s.shot_number ?? s.shotNumber ?? i + 1;
        const description = typeof s.description === 'string' ? s.description : '';
        const purpose = typeof s.purpose === 'string' ? s.purpose : '';
        const emotional_beat = typeof s.emotional_beat === 'string' ? s.emotional_beat : (s.emotionalBeat as string) || '';
        const continuity_notes =
          typeof s.continuity_notes === 'string'
            ? s.continuity_notes
            : typeof s.continuityNotes === 'string'
              ? s.continuityNotes
              : purpose || emotional_beat || '';
        return {
          ...s,
          shot_number,
          description,
          continuity_notes,
        } as ShotPlanItem;
      });
      return items;
    }

    const scenesRaw = record.scenes;
    if (Array.isArray(scenesRaw)) {
      const scenes = scenesRaw.filter(s => s && typeof s === 'object') as ShotPlanScene[];
      const flattened: ShotPlanItem[] = [];
      for (const scene of scenes) {
        const sceneTitle =
          typeof scene.title === 'string'
            ? scene.title
            : typeof scene.scene === 'number'
              ? `Scene ${scene.scene}`
              : '';
        const shots = Array.isArray(scene.shots)
          ? (scene.shots.filter(s => s && typeof s === 'object') as ShotPlanItem[])
          : [];

        if (shots.length > 0) {
          for (const shot of shots) {
            flattened.push({
              ...shot,
              sceneTitle,
            } as unknown as ShotPlanItem);
          }
          continue;
        }

        // Handle shot_count expansion
        const shotCount = typeof scene.shot_count === 'number' ? scene.shot_count : 0;
        if (shotCount > 0) {
          for (let i = 1; i <= shotCount; i++) {
            flattened.push({
              shot_number: i,
              action: `Placeholder for ${sceneTitle} shot ${i}`,
              description: typeof scene.description === 'string' ? scene.description : '',
              sceneTitle,
            });
          }
          continue;
        }

        // Legacy: Treat scene as single shot
        const purpose = typeof scene.purpose === 'string' ? scene.purpose : '';
        const emotional_beat = typeof scene.emotional_beat === 'string' ? scene.emotional_beat : (scene.emotionalBeat as string) || '';
        const setting = typeof scene.setting === 'string' ? scene.setting : '';
        const synthesizedDescription = [purpose, emotional_beat, setting]
          .filter(Boolean)
          .join(' | ')
          .trim();
        const action = typeof scene.action === 'string' ? scene.action : '';
        const narration = typeof scene.narration === 'string' ? scene.narration : '';
        const framing = typeof scene.framing === 'string' ? scene.framing : (scene as any).shot_type || (scene as any).shotType || '';
        const angle = typeof scene.angle === 'string' ? scene.angle : (scene as any).camera_angle || (scene as any).cameraAngle || '';
        const motion = typeof scene.motion === 'string' ? scene.motion : (scene as any).camera_motion || (scene as any).cameraMotion || '';
        const frame_prompt = typeof scene.frame_prompt === 'string' ? scene.frame_prompt : '';
        const video_prompt = typeof scene.video_prompt === 'string' ? scene.video_prompt : '';
        
        if (sceneTitle || synthesizedDescription || action) {
          flattened.push({
            ...scene,
            shot_number: flattened.length + 1,
            description: synthesizedDescription || sceneTitle,
            continuity_notes: purpose || emotional_beat || '',
            action: action || synthesizedDescription,
            narration,
            framing,
            angle,
            motion,
            frame_prompt,
            video_prompt,
            sceneTitle,
          } as unknown as ShotPlanItem);
        }
      }
      return flattened;
    }

    const nestedCandidates = [
      record.data,
      record.result,
      record.output,
      record.payload,
      record.plan,
      record.shot_plan,
      record.shotPlan,
      record.response,
      record.value,
      record.content,
    ];
    for (const candidate of nestedCandidates) {
      const nested = tryFromObj(candidate, depth + 1);
      if (nested.length > 0) return nested;
    }

    if (Array.isArray(record.items)) {
      for (const item of record.items) {
        const nested = tryFromObj(item, depth + 1);
        if (nested.length > 0) return nested;
      }
    }

    return [];
  };

  if (Array.isArray(raw)) {
    const directArrayShots = raw.filter(s => s && typeof s === 'object') as ShotPlanItem[];
    if (directArrayShots.length > 0) return directArrayShots;
  }

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

function makeNewShotId(planId: string) {
  return `${planId}:manual:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function nextShotNumber(shots: ShotPlanItem[]) {
  let max = 0;
  for (const shot of shots) {
    const raw = shot.shot_number ?? shot.shot;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectShot = useSelectionStore(s => s.selectShot);
  const selectShotPlan = useSelectionStore(s => s.selectShotPlan);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [autoAppliedNarrationKeyByPlanId, setAutoAppliedNarrationKeyByPlanId] = useState<Record<string, string>>({});

  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);

  useProjectEvents({
    projectId,
    onEvent: () => {
      queryClient.invalidateQueries({ queryKey: ['project-shot-plans', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    },
  });

  const shotsQuery = useQuery({
    // Dedicated query key to avoid cross-tab cache interference with other `project-assets` consumers
    // (this tab uses a `select` transform, which can otherwise cause other tabs to "lose" assets).
    queryKey: ['project-shot-plans', projectId, selectedWorkflowId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    select: assets =>
      assets.filter(a =>
        ['shot_plan', 'storyboard', 'scene_batch', 'generated_text', 'narration_audio'].includes(a.asset_type)
      ),
  });

  const shotPlans = useMemo(() => {
    const raw = (shotsQuery.data ?? []).filter(a => {
      const isExplicit = a.asset_type === 'shot_plan' || a.asset_type === 'storyboard';
      // Fallback for shot plans that were categorized as generated_text or scene_batch
      const content = a.current_version?.content as any;
      const isShotPlanLike = (a.asset_type === 'generated_text' || a.asset_type === 'scene_batch') && 
                            (!!content?.scenes || !!content?.shots);
      return (isExplicit || isShotPlanLike) && a.status !== 'deprecated';
    });
    
    const filteredByWorkflow = raw.filter(asset => {
      if (!selectedWorkflowId) return true;
      const meta = asset.metadata as Record<string, unknown> | null;
      return meta?.workflow_id === selectedWorkflowId;
    });

    filteredByWorkflow.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return filteredByWorkflow;
  }, [shotsQuery.data, selectedWorkflowId]);

  const selectedPlan =
    shotPlans.find(p => p.id === selectedPlanId) ?? (shotPlans.length > 0 ? shotPlans[0] : null);

  const planItems = selectedPlan ? extractShotPlanItems(selectedPlan) : [];

  const latestNarrationAsset = useMemo(() => {
    const allCandidates = (shotsQuery.data ?? [])
      .filter(a => a.asset_type === 'narration_audio' && a.status !== 'deprecated')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const planWorkflowId =
      selectedPlan && typeof (selectedPlan.metadata as any)?.workflow_id === 'string'
        ? String((selectedPlan.metadata as any).workflow_id)
        : null;

    const workflowId = planWorkflowId || selectedWorkflowId || null;
    if (!workflowId) return allCandidates[0] ?? null;

    const filtered = allCandidates.filter(a => {
      const meta = a.metadata as Record<string, unknown> | null;
      return meta?.workflow_id === workflowId;
    });

    return filtered[0] ?? allCandidates[0] ?? null;
  }, [shotsQuery.data, selectedWorkflowId, selectedPlan]);

  const normalizeCameraSetting = (val: string, type: 'framing' | 'angle' | 'motion'): string => {
    const v = val.trim().toLowerCase();
    if (!v) return '';

    if (type === 'framing') {
      if (v.includes('extreme close')) return 'Extreme Close-up';
      if (v.includes('close') || v === 'cu') return 'Close-up';
      if (v.includes('medium') || v === 'ms' || v === 'mcu') return 'Medium';
      if (v.includes('wide') || v.includes('long shot') || v === 'ws' || v === 'ls') return 'Wide';
      if (v.includes('shoulder') || v === 'ots') return 'Over the Shoulder';
      if (v.includes('pov') || v.includes('point of view')) return 'POV';
      return normalizeTitleCase(val);
    }
    if (type === 'angle') {
      if (v.includes('eye') || v.includes('neutral')) return 'Eye Level';
      if (v.includes('bird') || v.includes('top down')) return "Bird's Eye";
      if (v.includes('worm')) return "Worm's Eye";
      if (v.includes('high') || v.includes('top')) return 'High';
      if (v.includes('low') || v.includes('bottom')) return 'Low';
      if (v.includes('dutch') || v.includes('tilt') || v.includes('slanted')) return 'Dutch';
      return normalizeTitleCase(val);
    }
    if (type === 'motion') {
      if (v.includes('fixed') || v.includes('no motion') || v.includes('static')) return 'Static';
      if (v.includes('pan')) return 'Pan';
      if (v.includes('tilt')) return 'Tilt';
      if (v.includes('tracking') || v.includes('track') || v.includes('truck')) return 'Tracking';
      if (v.includes('dolly')) return 'Dolly';
      if (v.includes('zoom')) return 'Zoom';
      if (v.includes('handheld') || v.includes('hand-held') || v.includes('shaky')) return 'Handheld';
      return normalizeTitleCase(val);
    }
    return normalizeTitleCase(val);
  };

  const shots: Shot[] = selectedPlan
    ? planItems.map((item, index) => {
        const stableId =
          typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `${selectedPlan.id}:${index}`;
        
        // Polymorphic shot number
        const rawNum = item.shot_number ?? item.shot;
        const shotNumber =
          typeof rawNum === 'number'
            ? String(rawNum)
            : typeof rawNum === 'string'
              ? rawNum
              : String(index + 1);

        // Polymorphic description
        const description = (item.action || item.description || '').trim();
        const rawFraming = typeof item.framing === 'string' ? item.framing : 
                           typeof (item as any).shot_type === 'string' ? (item as any).shot_type :
                           typeof (item as any).shotType === 'string' ? (item as any).shotType :
                           typeof (item as any).size === 'string' ? (item as any).size : '';
        const rawAngle = typeof item.angle === 'string' ? item.angle : 
                         typeof (item as any).camera_angle === 'string' ? (item as any).camera_angle :
                         typeof (item as any).cameraAngle === 'string' ? (item as any).cameraAngle :
                         typeof (item as any).perspective === 'string' ? (item as any).perspective : '';
        const rawMotion = typeof item.motion === 'string' ? item.motion : 
                          typeof (item as any).camera_motion === 'string' ? (item as any).camera_motion :
                          typeof (item as any).cameraMotion === 'string' ? (item as any).cameraMotion :
                          typeof (item as any).movement === 'string' ? (item as any).movement : '';

        const framing = normalizeCameraSetting(rawFraming, 'framing');
        const angle = normalizeCameraSetting(rawAngle, 'angle');
        const motion = normalizeCameraSetting(rawMotion, 'motion');

        console.log(`[ShotsPage] Mapping shot ${shotNumber}:`, {
          rawFraming,
          normalizedFraming: framing,
          rawAngle,
          normalizedAngle: angle,
          rawMotion,
          normalizedMotion: motion
        });

        const continuity_notes =
          typeof item.continuity_notes === 'string' ? item.continuity_notes : '';
        const sceneTitle = typeof item.sceneTitle === 'string' ? item.sceneTitle : '';
        
        const imageObj =
          item.image && typeof item.image === 'object' ? (item.image as Record<string, unknown>) : null;
        
        // Polymorphic prompts
        const generatorPrompt = (item.frame_prompt || 
                                (item as any).image_prompt || 
                                (item as any).imagePrompt || 
                                (imageObj && typeof imageObj.prompt === 'string' ? imageObj.prompt : '') || '').trim();
        const videoPromptFallback = (item.video_prompt || 
                                    (item as any).videoPrompt || 
                                    (item as any).motion_prompt || 
                                    (item as any).motionPrompt || '').trim();
        const generatorNegativePrompt =
          (imageObj && typeof imageObj.negative_prompt === 'string' ? imageObj.negative_prompt : '') || '';
        const generatorPromptStructured =
          (imageObj && typeof imageObj.prompt_structured === 'string' ? imageObj.prompt_structured : '') || '';

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
          negative_prompt: continuity_notes,
          shot_type: framing,
          angle,
          motion,
          duration: 3,
          generator_prompt: generatorPrompt || undefined,
          generator_negative_prompt: generatorNegativePrompt || undefined,
          generator_prompt_structured: generatorPromptStructured || undefined,
          // Advanced fields
          action: item.action || item.description || '',
          narration_text:
            typeof item.narration_text === 'string'
              ? item.narration_text
              : typeof item.narrationText === 'string'
                ? item.narrationText
                : '',
          narration: item.narration || '',
          internal_monologue:
            typeof item.internal_monologue === 'string'
              ? item.internal_monologue
              : typeof item.internalMonologue === 'string'
                ? item.internalMonologue
                : '',
          dialogue: item.dialogue || '',
          characters: item.characters || (item as any).character_list || [],
          environment: item.environment || (item as any).setting || '',
          props: item.props || [],
          frame_prompt: generatorPrompt,
          video_prompt: videoPromptFallback,
        };
      })
    : [];

  // Track if the current selection was chosen because it matches the workflow
  // This allows us to "auto-switch" when the workflow changing, but leave it alone if the user manually picked something.
  const [autoSelectedForWorkflowId, setAutoSelectedForWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    if (shotPlans.length === 0) return;

    const topPlanId = shotPlans[0].id;
    const topPlanMatches = selectedWorkflowId && (shotPlans[0].metadata as Record<string, unknown> | undefined)?.workflow_id === selectedWorkflowId;

    // SCENARIO 1: First time selection or selection lost
    if (!selectedPlanId || !shotPlans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(topPlanId);
      setSelectedShotId(null);
      selectShotPlan(topPlanId);
      if (topPlanMatches) setAutoSelectedForWorkflowId(selectedWorkflowId);
      return;
    }

    // SCENARIO 2: Workflow changed, OR a NEW run finished for the SAME workflow
    const canAutoJump = selectedWorkflowId === autoSelectedForWorkflowId;
    if (selectedWorkflowId && topPlanMatches && selectedPlanId !== topPlanId && canAutoJump) {
      setSelectedPlanId(topPlanId);
      setSelectedShotId(null);
      selectShotPlan(topPlanId);
      setAutoSelectedForWorkflowId(selectedWorkflowId);
      return;
    }

    // SCENARIO 3: Workflow changed but no match found yet
    if (selectedWorkflowId && selectedWorkflowId !== autoSelectedForWorkflowId) {
      if (topPlanMatches) {
        setSelectedPlanId(topPlanId);
        setSelectedShotId(null);
        selectShotPlan(topPlanId);
        setAutoSelectedForWorkflowId(selectedWorkflowId);
      } else {
        setAutoSelectedForWorkflowId(selectedWorkflowId);
      }
    }
  }, [shotPlans, selectedPlanId, selectShotPlan, selectedWorkflowId, autoSelectedForWorkflowId]);

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
      negative_prompt: '',
      shot_type: '',
      angle: '',
      motion: '',
      duration: 0,
    };

  useEffect(() => {
    if (!selectedPlan) return;
    if (!selectedShot.id) return;
    selectShot(selectedShot.id, selectedPlan.id);
  }, [selectShot, selectedPlan, selectedShot.id]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    selectShotPlan(planId);
  };

  const handleSelectShot = (shotId: string) => {
    setSelectedShotId(shotId);
    const planId = selectedPlan?.id ?? selectedPlanId ?? null;
    if (planId) selectShot(shotId, planId);
  };

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
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-shot-plans', projectId] });
    },
    onError: err => {
      showToast({
        type: 'error',
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  // Quick export removed from Shots tab.


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
      shot_number: 1,
      description: '',
      framing: '',
      angle: '',
      motion: '',
      continuity_notes: '',
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

  const handleUpdateShot = (updates: Partial<Shot>) => {
    if (!selectedPlan) return;
    const shotId = selectedShot.id;
    if (!shotId) return;

    const parsed = parseShotPlanForEdit(selectedPlan);
    if (!parsed) return;

    const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
    ensureShotIdsInPlan(plan, selectedPlan.id);

    let updated = false;

    const updateInShots = (shotsList: any[]) => {
      const idx = shotsList.findIndex(s => s && s.id === shotId);
      if (idx >= 0) {
        const target = shotsList[idx];
        shotsList[idx] = {
          ...target,
          // Narrative fields
          prompt: updates.prompt ?? target.prompt,
          description: updates.prompt ?? target.description,
          continuity_notes: updates.negative_prompt ?? target.continuity_notes,
          framing: updates.shot_type ?? target.framing,
          angle: updates.angle ?? target.angle,
          motion: updates.motion ?? target.motion,
          // Advanced fields
          action: updates.action ?? target.action,
          narration_text: updates.narration_text ?? target.narration_text,
          narration: updates.narration ?? target.narration,
          internal_monologue: updates.internal_monologue ?? target.internal_monologue,
          dialogue: updates.dialogue ?? target.dialogue,
          characters: updates.characters ?? target.characters,
          environment: updates.environment ?? target.environment,
          props: updates.props ?? target.props,
          frame_prompt: updates.frame_prompt ?? target.frame_prompt,
          video_prompt: updates.video_prompt ?? target.video_prompt,
        };
        updated = true;
      }
    };

    if (Array.isArray(plan.scenes)) {
      for (const scene of plan.scenes as any[]) {
        if (Array.isArray(scene.shots)) updateInShots(scene.shots);
        if (updated) break;
      }
    } else if (Array.isArray(plan.shots)) {
      updateInShots(plan.shots);
    }

    if (!updated) return;

    const nextContent = writeBackShotPlan(parsed, plan);
    updatePlanMutation.mutate({ planAssetId: selectedPlan.id, content: nextContent });
  };

  const applyNarrationSplitsToPlan = ({
    plan,
    segments,
  }: {
    plan: Asset;
    segments: any[];
  }): { nextContent: Record<string, unknown>; applied: number; changed: number } | null => {
    const parsed = parseShotPlanForEdit(plan);
    if (!parsed) return null;

    const nextPlan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
    ensureShotIdsInPlan(nextPlan, plan.id);

    const flattenShots = () => {
      const out: Array<Record<string, any>> = [];
      const addShot = (shot: any) => {
        if (!shot || typeof shot !== 'object') return;
        out.push(shot as Record<string, any>);
      };

      if (Array.isArray((nextPlan as any).scenes)) {
        for (const scene of (nextPlan as any).scenes as any[]) {
          if (!scene || typeof scene !== 'object' || !Array.isArray(scene.shots)) continue;
          const sceneShots = (scene.shots as any[]).filter(s => s && typeof s === 'object');
          sceneShots.sort((a, b) => {
            const aNum =
              typeof a.shot_number === 'number'
                ? a.shot_number
                : typeof a.shotNumber === 'number'
                  ? a.shotNumber
                  : NaN;
            const bNum =
              typeof b.shot_number === 'number'
                ? b.shot_number
                : typeof b.shotNumber === 'number'
                  ? b.shotNumber
                  : NaN;
            if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
            if (Number.isFinite(aNum)) return -1;
            if (Number.isFinite(bNum)) return 1;
            return 0;
          });
          for (const shot of sceneShots) addShot(shot);
        }
        return out;
      }

      if (Array.isArray((nextPlan as any).shots)) {
        const topLevelShots = ((nextPlan as any).shots as any[]).filter(s => s && typeof s === 'object');
        for (const shot of topLevelShots) addShot(shot);
      }
      return out;
    };

    const shotsFlat = flattenShots();
    if (shotsFlat.length === 0) return null;

    const byId = new Map<string, Record<string, any>>();
    for (const shot of shotsFlat) {
      if (typeof shot.id === 'string' && shot.id.trim()) byId.set(shot.id.trim(), shot);
    }

    const pendingAssignments: Array<{ shot: Record<string, any>; text: string }> = [];
    const getSegmentText = (seg: any) => {
      const text =
        typeof seg.text === 'string'
          ? seg.text
          : typeof seg.text_used === 'string'
            ? seg.text_used
            : typeof seg.narration === 'string'
              ? seg.narration
              : '';
      return String(text || '').trim();
    };

    const remaining: any[] = [];
    for (const seg of segments) {
      const text = getSegmentText(seg);
      if (!text) continue;
      const shotId = typeof seg.shot_id === 'string' ? seg.shot_id.trim() : '';
      if (shotId && byId.has(shotId)) pendingAssignments.push({ shot: byId.get(shotId)!, text });
      else remaining.push(seg);
    }

    remaining.sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : 0;
      const bOrder = typeof b.order === 'number' ? b.order : 0;
      return aOrder - bOrder;
    });

    for (let i = 0; i < remaining.length && i < shotsFlat.length; i += 1) {
      const seg = remaining[i];
      const text = getSegmentText(seg);
      if (!text) continue;
      if (pendingAssignments.some(a => a.shot === shotsFlat[i])) continue;
      pendingAssignments.push({ shot: shotsFlat[i]!, text });
    }

    let applied = 0;
    let changed = 0;
    for (const { shot, text } of pendingAssignments) {
      const current =
        typeof shot.narration_text === 'string'
          ? shot.narration_text
          : typeof shot.narrationText === 'string'
            ? shot.narrationText
            : '';
      if (String(current || '').trim() !== text) changed += 1;
      shot.narration_text = text;
      applied += 1;
    }

    if (applied === 0) return null;
    return {
      nextContent: writeBackShotPlan(parsed, nextPlan) as Record<string, unknown>,
      applied,
      changed,
    };
  };

  useEffect(() => {
    if (!selectedPlan) return;
    if (updatePlanMutation.isPending) return;
    if (!latestNarrationAsset?.current_version?.content) return;

    const content = latestNarrationAsset.current_version.content as any;
    const segments = Array.isArray(content.voiceover_segments) ? (content.voiceover_segments as any[]) : null;
    if (!segments || segments.length === 0) return;

    const assetVersionKey = `${latestNarrationAsset.id}:${latestNarrationAsset.updated_at}`;
    if (autoAppliedNarrationKeyByPlanId[selectedPlan.id] === assetVersionKey) return;

    const result = applyNarrationSplitsToPlan({ plan: selectedPlan, segments });
    if (!result) {
      setAutoAppliedNarrationKeyByPlanId(prev => ({ ...prev, [selectedPlan.id]: assetVersionKey }));
      return;
    }

    if (result.changed === 0) {
      setAutoAppliedNarrationKeyByPlanId(prev => ({ ...prev, [selectedPlan.id]: assetVersionKey }));
      return;
    }

    updatePlanMutation.mutate(
      { planAssetId: selectedPlan.id, content: result.nextContent },
      {
        onSuccess: () => {
          setAutoAppliedNarrationKeyByPlanId(prev => ({ ...prev, [selectedPlan.id]: assetVersionKey }));
          showToast({
            type: 'success',
            title: 'Narration applied',
            message: `Filled Narration (Story) for ${result.applied} shot(s) from the latest narration output.`,
          });
        },
      }
    );
  }, [
    autoAppliedNarrationKeyByPlanId,
    latestNarrationAsset,
    selectedPlan,
    updatePlanMutation,
  ]);

  if (!projectId) {
    return <div className="p-4 text-[var(--text-muted)]">No project selected</div>;
  }

  if (shotsQuery.isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <>
    <div className="flex flex-col h-full comfy-bg-primary">
      <ShotToolbar
        shot={selectedShot}
        onAddShot={selectedPlan ? handleAddShot : undefined}
        onDeleteShot={selectedPlan ? handleDeleteShot : undefined}
        canDeleteShot={Boolean(selectedPlan && selectedShot.id)}
        isMutating={updatePlanMutation.isPending}
        onPreview={shots.length > 0 ? () => setShowPreview(true) : undefined}
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
            <ShotEditor 
              projectId={projectId} 
              shot={selectedShot} 
              shots={shots}
              onSave={handleUpdateShot}
              isMutating={updatePlanMutation.isPending}
            />
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PreviewStack projectId={projectId} shot={selectedShot} />
          </div>
        </div>
      </div>
    </div>

    {showPreview && (
      <StoryboardPreviewModal
        shots={shots}
        projectId={projectId}
        initialShotId={selectedShot?.id}
        onClose={() => setShowPreview(false)}
      />
    )}
    </>
  );
}

export type { Shot };
