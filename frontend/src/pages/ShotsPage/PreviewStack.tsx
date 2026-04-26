import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Shot } from './ShotsPage';
import {
  createAssetVersion,
  fetchAsset,
  fetchJobStatus,
  fetchProjectAssets,
  generateCharacterImage,
  generateProjectVideo,
  generateVideoFromImage,
  type Asset,
  type JobStatus,
} from '../../lib/api';
import { showToast } from '../../stores';
import { useCopilotActionsStore, usePanelStore, useSelectionStore } from '../../stores';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
  updateShotImageOverrideInPlan,
  writeBackShotPlan,
} from '../../lib/shotPlanEditing';
import { isCanonLike } from '../../lib/agent/context/buildContext';

interface PreviewStackProps {
  projectId: string;
  shot: Shot;
}

type PreviewTab = 'image' | 'video' | 'image_to_video';

type StoredShotMedia = Record<
  string,
  {
    imageUrl?: string;
    videoUrl?: string;
    videoJobId?: string;
    videoJobStatus?: string;
    updatedAt: number;
  }
>;

export function PreviewStack({ projectId, shot }: PreviewStackProps) {
  const queryClient = useQueryClient();
  const videoWorkflow =
    (import.meta.env.VITE_VIDEO_WORKFLOW as string | undefined) || 'fast_txt2video';
  const image2VideoWorkflow =
    (import.meta.env.VITE_IMAGE2VIDEO_WORKFLOW as string | undefined) || 'image2video';
  const image2VideoLengthRaw = import.meta.env.VITE_IMAGE2VIDEO_LENGTH as string | undefined;
  const image2VideoLength = image2VideoLengthRaw ? Number(image2VideoLengthRaw) : 81;
  const [activeTab, setActiveTab] = useState<PreviewTab>('image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [handledCopilotRequestId, setHandledCopilotRequestId] = useState<string | null>(null);
  const [imageByShotId, setImageByShotId] = useState<Record<string, string>>({});
  const [videoByShotId, setVideoByShotId] = useState<Record<string, string>>({});
  const [videoJobByShotId, setVideoJobByShotId] = useState<Record<string, string>>({});
  const [videoJobStatusByShotId, setVideoJobStatusByShotId] = useState<Record<string, string>>({});
  const [imageJobByShotId, setImageJobByShotId] = useState<Record<string, string>>({});
  const [imageJobStatusByShotId, setImageJobStatusByShotId] = useState<Record<string, string>>({});
  const [hydratedForProjectId, setHydratedForProjectId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [negative_prompt_draft, setNegativePromptDraft] = useState('');
  const [isPromptDirty, setIsPromptDirty] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const setRightPanelTab = usePanelStore(s => s.setRightPanelTab);
  const selectShot = useSelectionStore(s => s.selectShot);
  const pendingShotImageGeneration = useCopilotActionsStore(s => s.pendingShotImageGeneration);
  const clearPendingShotImageGeneration = useCopilotActionsStore(
    s => s.clearPendingShotImageGeneration
  );

  const imageUrl = imageByShotId[shot.id] || '';
  const videoUrl = videoByShotId[shot.id] || '';
  const videoJobId = videoJobByShotId[shot.id] || '';
  const videoJobStatus = videoJobStatusByShotId[shot.id] || '';
  const imageJobId = imageJobByShotId[shot.id] || '';
  const imageJobStatus = imageJobStatusByShotId[shot.id] || '';

  const canGenerate = Boolean(projectId) && Boolean(shot?.id);
  const videoJobStatusLower = (videoJobStatus || '').toLowerCase();
  const videoJobIsTerminal =
    videoJobStatusLower === 'completed' ||
    videoJobStatusLower === 'success' ||
    videoJobStatusLower === 'succeeded' ||
    videoJobStatusLower === 'failed' ||
    videoJobStatusLower === 'error' ||
    videoJobStatusLower === 'cancelled' ||
    videoJobStatusLower === 'canceled';
  const videoJobIsActive = Boolean(videoJobId) && !videoJobIsTerminal && !videoUrl;

  const imageJobStatusLower = (imageJobStatus || '').toLowerCase();
  const imageJobIsTerminal =
    imageJobStatusLower === 'completed' ||
    imageJobStatusLower === 'success' ||
    imageJobStatusLower === 'succeeded' ||
    imageJobStatusLower === 'failed' ||
    imageJobStatusLower === 'error' ||
    imageJobStatusLower === 'cancelled' ||
    imageJobStatusLower === 'canceled';
  const imageJobIsActive = Boolean(imageJobId) && !imageJobIsTerminal && !imageUrl;

  const clearVideoJobState = () => {
    setVideoJobByShotId(prev => {
      if (!prev[shot.id]) return prev;
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
    setVideoJobStatusByShotId(prev => {
      if (!prev[shot.id]) return prev;
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
  };

  const clearImageJobState = () => {
    setImageJobByShotId(prev => {
      if (!prev[shot.id]) return prev;
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
    setImageJobStatusByShotId(prev => {
      if (!prev[shot.id]) return prev;
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
  };

  useEffect(() => {
    if (!projectId) return;
    if (hydratedForProjectId === projectId) return;

    const storageKey = `aiwf:shotMedia:${projectId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setHydratedForProjectId(projectId);
        return;
      }
      const parsed = JSON.parse(raw) as { items?: StoredShotMedia } | StoredShotMedia;
      const items: StoredShotMedia =
        parsed && typeof parsed === 'object' && 'items' in (parsed as Record<string, unknown>)
          ? (((parsed as Record<string, unknown>).items ?? {}) as StoredShotMedia)
          : (parsed as StoredShotMedia);

      const nextImages: Record<string, string> = {};
      const nextVideos: Record<string, string> = {};
      const nextVideoJobs: Record<string, string> = {};
      const nextVideoJobStatuses: Record<string, string> = {};

      for (const [shotId, media] of Object.entries(items ?? {})) {
        if (!media || typeof media !== 'object') continue;
        if (typeof media.imageUrl === 'string' && media.imageUrl) nextImages[shotId] = media.imageUrl;
        if (typeof media.videoUrl === 'string' && media.videoUrl) nextVideos[shotId] = media.videoUrl;
        if (typeof media.videoJobId === 'string' && media.videoJobId)
          nextVideoJobs[shotId] = media.videoJobId;
        if (typeof media.videoJobStatus === 'string' && media.videoJobStatus)
          nextVideoJobStatuses[shotId] = media.videoJobStatus;
      }

      setImageByShotId(nextImages);
      setVideoByShotId(nextVideos);
      setVideoJobByShotId(nextVideoJobs);
      setVideoJobStatusByShotId(nextVideoJobStatuses);
    } catch {
      // ignore invalid localStorage state
    } finally {
      setHydratedForProjectId(projectId);
    }
  }, [hydratedForProjectId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (hydratedForProjectId !== projectId) return;

    const storageKey = `aiwf:shotMedia:${projectId}`;
    const now = Date.now();
    const merged: StoredShotMedia = {};

    const shotIds = new Set<string>([
      ...Object.keys(imageByShotId),
      ...Object.keys(videoByShotId),
      ...Object.keys(videoJobByShotId),
      ...Object.keys(videoJobStatusByShotId),
    ]);

    for (const shotId of shotIds) {
      const image = imageByShotId[shotId];
      const video = videoByShotId[shotId];
      const jobId = videoJobByShotId[shotId];
      const jobStatus = videoJobStatusByShotId[shotId];

      if (!image && !video && !jobId && !jobStatus) continue;
      merged[shotId] = {
        imageUrl: image || undefined,
        videoUrl: video || undefined,
        videoJobId: jobId || undefined,
        videoJobStatus: jobStatus || undefined,
        updatedAt: now,
      };
    }

    // Keep a reasonable cap to prevent unlimited growth.
    const entries = Object.entries(merged).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    const capped = Object.fromEntries(entries.slice(0, 200));

    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ items: capped }));
    } catch {
      // ignore quota errors
    }
  }, [
    hydratedForProjectId,
    projectId,
    imageByShotId,
    videoByShotId,
    videoJobByShotId,
    videoJobStatusByShotId,
  ]);

  const canonQuery = useQuery<Asset[]>({
    queryKey: ['project-assets', projectId, 'canon-candidates'],
    queryFn: () => fetchProjectAssets(projectId), // Fetch all and filter client-side for flexibility
    enabled: Boolean(projectId),
  });

  const scenesQuery = useQuery<Asset[]>({
    queryKey: ['project-assets', projectId, 'scene'],
    queryFn: () => fetchProjectAssets(projectId, 'scene'),
    enabled: Boolean(projectId),
  });

  const latestCanonAsset = useMemo(() => {

    const items = canonQuery.data ?? [];
    return (
      [...items]
        .filter(a => a.status !== 'deprecated' && isCanonLike(a))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ??
      null
    );
  }, [canonQuery.data]);

  const latestScenesBatchAsset = useMemo(() => {
    const items = scenesQuery.data ?? [];
    const candidates = items.filter(a => {
      if (a.status === 'deprecated') return false;
      const c = a.current_version?.content as unknown;
      return Boolean(c && typeof c === 'object' && Array.isArray((c as Record<string, unknown>).scenes));
    });
    return (
      [...candidates].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ??
      null
    );
  }, [scenesQuery.data]);

  const effectivePrompt = useMemo(() => {
    const parts = [
      shot.sceneId ? `Scene: ${shot.sceneId}.` : null,
      shot.shot_type ? `Framing: ${shot.shot_type}.` : null,
      shot.angle ? `Angle: ${shot.angle}.` : null,
      shot.motion ? `Motion: ${shot.motion}.` : null,
      shot.prompt ? shot.prompt : null,
    ].filter(Boolean);

    return parts.join(' ').trim();
  }, [shot.angle, shot.motion, shot.prompt, shot.sceneId, shot.shot_type]);

  const sceneInfo = useMemo(() => {
    const asset = latestScenesBatchAsset;
    if (!asset) return null;
    const content = (asset.current_version?.content ?? {}) as Record<string, unknown>;
    const scenes = Array.isArray(content.scenes) ? content.scenes : [];
    if (!Array.isArray(scenes) || scenes.length === 0) return null;

    const wantedTitle = (shot.sceneId || '').trim().toLowerCase();
    const match = scenes.find(s => {
      if (!s || typeof s !== 'object') return false;
      const title =
        typeof (s as Record<string, unknown>).title === 'string'
          ? ((s as Record<string, unknown>).title as string)
          : '';
      const normalized = title.trim().toLowerCase();
      if (!wantedTitle) return false;
      if (normalized === wantedTitle) return true;
      return normalized.includes(wantedTitle) || wantedTitle.includes(normalized);
    }) as Record<string, unknown> | undefined;

    if (!match) return null;

    const title = typeof match.title === 'string' ? match.title.trim() : '';
    const setting = typeof match.setting === 'string' ? match.setting.trim() : '';
    const emotional_beat = typeof match.emotional_beat === 'string' ? match.emotional_beat.trim() : typeof match.emotionalBeat === 'string' ? match.emotionalBeat.trim() : '';
    if (!title && !setting && !emotional_beat) return null;
    return { title, setting, emotional_beat };
  }, [latestScenesBatchAsset, shot.sceneId]);

  const canonInfo = useMemo(() => {
    const asset = latestCanonAsset;
    if (!asset) return null;
    const content = (asset.current_version?.content ?? asset.current_approved_version?.content ?? {}) as Record<
      string,
      unknown
    >;

    const getString = (key: string) => (typeof content[key] === 'string' ? (content[key] as string).trim() : '');
    const getStringArray = (key: string) =>
      Array.isArray(content[key])
        ? (content[key] as unknown[]).filter(v => typeof v === 'string').map(v => (v as string).trim()).filter(Boolean)
        : [];

    const tone = getString('tone');
    const themes = getStringArray('themes').slice(0, 5);
    const world_rules = (getStringArray('world_rules').length ? getStringArray('world_rules') : getStringArray('worldRules')).slice(0, 6);
    const color_palette = (getStringArray('color_palette').length ? getStringArray('color_palette') : getStringArray('colorPalette')).slice(0, 6);
    const environment_lock = (getString('environment_lock') || getString('environmentLock')).slice(0, 500);

    const shotText = `${effectivePrompt}`.toLowerCase();

    const charactersRaw = Array.isArray(content.characters)
      ? (content.characters.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
      : Array.isArray(content.character_table)
        ? (content.character_table.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
        : [];
    
    const allan = charactersRaw.find(c => {
      const name = (typeof c.name === 'string' ? c.name.trim().toLowerCase() : '');
      return name === 'allan' || name === 'allan (protagonist)';
    }) ?? null;
    
    const matchedCharacters = charactersRaw
      .filter(c => {
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        if (!name) return false;
        const lowerName = name.toLowerCase();
        if (lowerName === 'allan' || lowerName === 'allan (protagonist)') return false;
        return shotText.includes(lowerName);
      })
      .slice(0, 2);
    const pickedCharacters = [allan, ...matchedCharacters].filter(Boolean).slice(0, 3) as Record<string, unknown>[];
    const characters = pickedCharacters
      .map(c => {
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        const description = typeof c.description === 'string' ? c.description.trim() : '';
        let appearanceBits: string[] = [];
        const app = c.appearance;
        if (Array.isArray(app)) {
          appearanceBits = app.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean);
        } else if (app && typeof app === 'object') {
          appearanceBits = Object.entries(app as Record<string, unknown>)
            .map(([k, v]) => (typeof v === 'string' && v.trim() ? `${k}: ${v.trim()}` : null))
            .filter(Boolean) as string[];
        } else if (typeof app === 'string' && app.trim()) {
          appearanceBits = [app.trim()];
        }

        if (appearanceBits.length === 0) {
          const legacyKeys = ['facial_features', 'face', 'hair', 'dress', 'clothing', 'shoes', 'hat', 'accessories'] as const;
          appearanceBits = legacyKeys
            .map(k => (typeof c[k] === 'string' && (c[k] as string).trim() ? `${k}: ${(c[k] as string).trim()}` : null))
            .filter(Boolean) as string[];
        }

        if (appearanceBits.length === 0 && typeof c.character_image === 'string' && c.character_image.trim()) {
          appearanceBits = [c.character_image.trim()];
        }
        return {
          name,
          description,
          appearance: appearanceBits,
        };
      })
      .filter(c => c.name || c.description || c.appearance.length > 0);

    const locationsRaw = Array.isArray(content.locations)
      ? (content.locations.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
      : [];
    const locationNames = locationsRaw
      .map(l => (typeof l.name === 'string' ? l.name.trim() : ''))
      .filter(Boolean);

    const equipmentRaw = Array.isArray(content.equipment)
      ? (content.equipment.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
      : [];
    const equipmentNames = equipmentRaw
      .map(e => (typeof e.name === 'string' ? e.name.trim() : ''))
      .filter(Boolean);

    if (
      !tone &&
      themes.length === 0 &&
      world_rules.length === 0 &&
      color_palette.length === 0 &&
      !environment_lock &&
      characters.length === 0 &&
      locationNames.length === 0 &&
      equipmentNames.length === 0
    ) {
      return null;
    }

    return {
      tone,
      themes,
      world_rules,
      color_palette,
      environment_lock,
      characters,
      locations: locationNames.slice(0, 8),
      equipment: equipmentNames.slice(0, 8),
    };
  }, [effectivePrompt, latestCanonAsset]);

  const assembledPrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push('CANON:');
    if (canonInfo) {
      if (canonInfo.tone) lines.push(`  tone: ${canonInfo.tone}`);
      if (canonInfo.themes.length) lines.push(`  themes: [${canonInfo.themes.join(', ')}]`);
      if (canonInfo.color_palette.length)
        lines.push(`  color_palette: [${canonInfo.color_palette.join(', ')}]`);
      if (canonInfo.environment_lock) lines.push(`  environment_lock: ${canonInfo.environment_lock}`);
      if (canonInfo.world_rules.length) {
        lines.push('  world_rules:');
        for (const rule of canonInfo.world_rules) lines.push(`    - ${rule}`);
      }
      if (canonInfo.locations.length) lines.push(`  locations: [${canonInfo.locations.join(', ')}]`);
      if (canonInfo.equipment.length) lines.push(`  equipment: [${canonInfo.equipment.join(', ')}]`);
      if (canonInfo.characters.length) {
        lines.push('  characters:');
        for (const c of canonInfo.characters) {
          if (!c.name && !c.description && c.appearance.length === 0) continue;
          lines.push('    -');
          if (c.name) lines.push(`      name: ${c.name}`);
          if (c.description) lines.push(`      description: ${c.description}`);
          if (c.appearance.length) lines.push(`      appearance: [${c.appearance.join(', ')}]`);
        }
      }
    } else {
      lines.push('  (none)');
    }

    lines.push('');
    lines.push('SCENE:');
    if (sceneInfo) {
      if (sceneInfo.title) lines.push(`  title: ${sceneInfo.title}`);
      if (sceneInfo.setting) lines.push(`  setting: ${sceneInfo.setting}`);
      if (sceneInfo.emotional_beat) lines.push(`  emotional_beat: ${sceneInfo.emotional_beat}`);
    } else {
      lines.push('  (none)');
    }

    lines.push('');
    lines.push('SHOT:');
    if (shot.sceneId) lines.push(`  scene: ${shot.sceneId}`);
    if (shot.shot_type) lines.push(`  framing: ${shot.shot_type}`);
    if (shot.angle) lines.push(`  angle: ${shot.angle}`);
    if (shot.motion) lines.push(`  motion: ${shot.motion}`);
    if (shot.prompt) lines.push(`  description: ${shot.prompt}`);
    if (shot.negative_prompt) lines.push(`  negative: ${shot.negative_prompt}`);

    lines.push('');
    lines.push('INSTRUCTIONS:');
    lines.push('  - Generate a cinematic frame consistent with CANON + SCENE + SHOT.');
    lines.push('  - No text, no watermark, no UI, no logos.');
    lines.push('  - Keep characters, wardrobe, props, and locations consistent.');

    return lines.join('\n').trim();
  }, [canonInfo, sceneInfo, shot]);

  const generationPrompt = useMemo(() => {
    const override = (shot.generator_prompt || '').trim();
    return override || assembledPrompt;
  }, [assembledPrompt, shot.generator_prompt]);

  useEffect(() => {
    // Re-hydrate manual draft when shot changes or generator prompt updates.
    const base = (shot.generator_prompt || '').trim() || generationPrompt;
    setPromptDraft(base);
    setNegativePromptDraft((shot.generator_negative_prompt || '').trim());
    setIsPromptDirty(false);
  }, [generationPrompt, shot.generator_negative_prompt, shot.generator_prompt, shot.id]);

  const effectivePromptForGeneration = useMemo(() => {
    const draft = promptDraft.trim();
    return draft || generationPrompt;
  }, [generationPrompt, promptDraft]);

  const generationPromptForApi = useMemo(() => {
    const negative = (negative_prompt_draft || shot.generator_negative_prompt || '').trim();
    if (!negative) return effectivePromptForGeneration;
    if (effectivePromptForGeneration.toLowerCase().includes('negative_prompt:'))
      return effectivePromptForGeneration;
    return `${effectivePromptForGeneration}\n\nNEGATIVE_PROMPT:\n${negative}`;
  }, [effectivePromptForGeneration, negative_prompt_draft, shot.generator_negative_prompt]);

  // Legacy name used by older UI paths (and can be helpful for debugging).
  const promptDisplay = (() => {
    const structured = (shot.generator_prompt_structured || '').trim();
    const negative = (negative_prompt_draft || shot.generator_negative_prompt || '').trim();
    const parts: string[] = [];
    if (structured) parts.push(structured);
    if (negative) parts.push(`NEGATIVE_PROMPT:\n${negative}`);
    parts.push(`SENT_PROMPT:\n${effectivePromptForGeneration}`);
    return parts.join('\n\n').trim();
  })();

  const savePromptOverride = async () => {
    if (!projectId) return;
    if (!shot?.id || !shot?.planId) {
      showToast({ type: 'error', title: 'Missing shot', message: 'Select a shot first.' });
      return;
    }
    const prompt = promptDraft.trim();
    if (!prompt) {
      showToast({ type: 'error', title: 'Missing prompt', message: 'Prompt cannot be empty.' });
      return;
    }

    setIsSavingPrompt(true);
    try {
      const planAsset = await fetchAsset(shot.planId);
      const parsed = parseShotPlanForEdit(planAsset);
      if (!parsed) {
        showToast({
          type: 'error',
          title: 'Unsupported plan',
          message: 'This shot plan format cannot be edited.',
        });
        return;
      }

      const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
      ensureShotIdsInPlan(plan, planAsset.id);
      const located = locateShotInPlan(plan, shot.id);
      if (!located) {
        showToast({
          type: 'error',
          title: 'Shot not found',
          message: 'Could not find this shot inside the shot plan.',
        });
        return;
      }

      updateShotImageOverrideInPlan(plan, located, {
        prompt,
        negative_prompt: negative_prompt_draft.trim() || undefined,
        prompt_structured: (shot.generator_prompt_structured || '').trim() || undefined,
        width: 1280,
        height: 720,
        last_updated_by: 'manual',
        last_updated_at: new Date().toISOString(),
      });

      const nextContent = writeBackShotPlan(parsed, plan);
      await createAssetVersion(planAsset.id, {
        content: nextContent,
        source_mode: 'manual',
        status: 'draft',
        make_current: true,
      });

      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'shot'] });
      showToast({ type: 'success', title: 'Saved', message: 'Saved prompt override to the shot plan.' });
      setIsPromptDirty(false);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  useEffect(() => {
    // If we already have a video URL, any lingering job id is stale and should not block UI actions.
    if (!videoUrl) return;
    if (!videoJobId) return;
    clearVideoJobState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoJobId, videoUrl, shot.id]);

  useEffect(() => {
    const pending = pendingShotImageGeneration;
    if (!pending) return;
    if (pending.requestId === handledCopilotRequestId) return;
    if (pending.projectId !== projectId) return;
    if (pending.shotId !== shot.id) return;

    setHandledCopilotRequestId(pending.requestId);
    setActiveTab('image');

    const run = async () => {
      if (isGenerating) return;
      setIsGenerating(true);
      try {
        const result = await generateCharacterImage({
          projectId,
          prompt: pending.prompt,
          negativePrompt: pending.negative_prompt,
          width: pending.width,
          height: pending.height,
        });
        if (!result.image_url) {
          showToast({
            type: 'warning',
            title: 'Image queued',
            message: `Job ${result.job_id} started (no image URL yet).`,
          });
          return;
        }
        setImageByShotId(prev => ({ ...prev, [shot.id]: result.image_url! }));
        showToast({ type: 'success', title: 'Image generated', message: 'Copilot regenerated the image.' });
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Copilot generation failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setIsGenerating(false);
        clearPendingShotImageGeneration();
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingShotImageGeneration,
    handledCopilotRequestId,
    projectId,
    shot.id,
    isGenerating,
    clearPendingShotImageGeneration,
  ]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!generationPrompt) {
      showToast({ type: 'error', title: 'Missing prompt', message: 'No prompt for this shot.' });
      return;
    }
    setIsGenerating(true);
    try {
      if (activeTab === 'image') {
        const negative = (negative_prompt_draft || shot.generator_negative_prompt || '').trim();
        const result = await generateCharacterImage({
          projectId,
          prompt: effectivePromptForGeneration,
          negativePrompt: negative || undefined,
          width: 1280,
          height: 720,
        });
        if (!result.image_url) {
          showToast({
            type: 'warning',
            title: 'Image queued',
            message: `Job ${result.job_id} started (no image URL yet).`,
          });
          setImageJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
          setImageJobStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));
          return;
        }
        setImageByShotId(prev => ({ ...prev, [shot.id]: result.image_url! }));
        clearImageJobState();
      } else {
        // Clear old preview so the user sees job progress for the new generation.
        setVideoByShotId(prev => ({ ...prev, [shot.id]: '' }));
        const result = await generateProjectVideo({
          projectId,
          prompt: generationPromptForApi,
          workflow: videoWorkflow,
          width: 1024,
          height: 576,
        });
        setVideoJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
        setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));

        // Check for URL in both top-level and potential nested structures in the initial result
        const initialUrl = result.video_url || (result as any).videoUrl || (result as any).url;

        if (!initialUrl) {
          showToast({
            type: 'warning',
            title: 'Video queued',
            message: `Job ${result.job_id} started (no video URL yet).`,
          });
          return;
        }
        setVideoByShotId(prev => ({ ...prev, [shot.id]: initialUrl }));
        clearVideoJobState();
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageToVideo = async () => {
    if (!canGenerate) return;
    if (!generationPrompt) {
      showToast({ type: 'error', title: 'Missing prompt', message: 'No prompt for this shot.' });
      return;
    }
    if (!imageUrl) {
      showToast({
        type: 'error',
        title: 'Missing image',
        message: 'Generate an image first, then convert it to video.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Clear old preview so the user sees job progress for the new conversion.
      setVideoByShotId(prev => ({ ...prev, [shot.id]: '' }));
      const result = await generateVideoFromImage({
        projectId,
        prompt: generationPromptForApi,
        workflow: image2VideoWorkflow,
        width: 640,
        height: 480,
        length: Number.isFinite(image2VideoLength) ? image2VideoLength : 81,
        reference_image_url: imageUrl,
      });
      setVideoJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
      setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));

      const initialUrl = result.video_url || (result as any).videoUrl || (result as any).url;

      if (!initialUrl) {
        showToast({
          type: 'warning',
          title: 'Video queued',
          message: `Job ${result.job_id} started (no video URL yet).`,
        });
        return;
      }
      setVideoByShotId(prev => ({ ...prev, [shot.id]: initialUrl }));
      clearVideoJobState();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Video generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => handleGenerate();

  const extractVideoUrlFromJob = (job: JobStatus): string | null => {
    const artifacts = job.artifacts;
    if (!artifacts || typeof artifacts !== 'object') return null;

    const direct = artifacts as Record<string, unknown>;
    const directUrl =
      typeof direct.video_url === 'string'
        ? direct.video_url
        : typeof direct.videoUrl === 'string'
          ? (direct.videoUrl as string)
          : typeof direct.url === 'string'
            ? (direct.url as string)
            : null;
    if (directUrl) return directUrl;

    const candidate = direct.video;
    if (candidate && typeof candidate === 'object') {
      const v = candidate as Record<string, unknown>;
      if (typeof v.video_url === 'string') return v.video_url;
      if (typeof v.url === 'string') return v.url;
    }

    // Check top-level properties of the job object itself
    const top = job as unknown as Record<string, unknown>;
    if (typeof top.video_url === 'string') return top.video_url;
    if (typeof top.videoUrl === 'string') return top.videoUrl;
    if (typeof top.url === 'string') return top.url;

    return null;
  };

  const extractImageUrlFromJob = (job: JobStatus): string | null => {
    const artifacts = job.artifacts;
    if (!artifacts || typeof artifacts !== 'object') return null;

    const direct = artifacts as Record<string, unknown>;
    const directUrl =
      typeof direct.image_url === 'string'
        ? direct.image_url
        : typeof direct.imageUrl === 'string'
          ? (direct.imageUrl as string)
          : typeof direct.url === 'string'
            ? (direct.url as string)
            : null;
    if (directUrl) return directUrl;

    const candidate = direct.image;
    if (candidate && typeof candidate === 'object') {
      const v = candidate as Record<string, unknown>;
      if (typeof v.image_url === 'string') return v.image_url;
      if (typeof v.url === 'string') return v.url;
    }

    // Check top-level properties of the job object itself
    const top = job as unknown as Record<string, unknown>;
    if (typeof top.image_url === 'string') return top.image_url;
    if (typeof top.imageUrl === 'string') return top.imageUrl;
    if (typeof top.url === 'string') return top.url;

    return null;
  };

  useEffect(() => {
    if (!videoJobId) return;
    if (videoUrl) return;
    if (activeTab !== 'video' && activeTab !== 'image_to_video') return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      try {
        const job = await fetchJobStatus(videoJobId);
        if (cancelled) return;
        const status = (job.status || '').toLowerCase();
        setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: status }));

        if (status === 'completed' || status === 'success' || status === 'succeeded') {
          const url = extractVideoUrlFromJob(job);
          if (url) {
            setVideoByShotId(prev => ({ ...prev, [shot.id]: url }));
            clearVideoJobState();
            showToast({ type: 'success', title: 'Video ready', message: 'Video generated.' });
            if (interval) window.clearInterval(interval);
            interval = undefined;
          } else {
            // If completed but no URL, keep polling for a few more cycles in case artifacts are lagging
            console.warn('[VideoPoll] Job completed but URL missing. Continuing to poll...');
          }
        }

        if (status === 'failed' || status === 'error') {
          if (interval) window.clearInterval(interval);
          interval = undefined;
          clearVideoJobState();
          showToast({
            type: 'error',
            title: 'Video failed',
            message:
              typeof job.artifacts === 'object' && job.artifacts
                ? JSON.stringify(job.artifacts).slice(0, 500)
                : 'Video job failed',
          });
        }
      } catch (err) {
        if (cancelled) return;
        showToast({
          type: 'error',
          title: 'Status check failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    pollOnce();
    interval = window.setInterval(pollOnce, 4000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, shot.id, videoJobId, videoUrl]);

  useEffect(() => {
    if (!imageJobId) return;
    if (imageUrl) return;
    if (activeTab !== 'image') return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      try {
        const job = await fetchJobStatus(imageJobId);
        if (cancelled) return;
        const status = (job.status || '').toLowerCase();
        setImageJobStatusByShotId(prev => ({ ...prev, [shot.id]: status }));

        if (status === 'completed' || status === 'success' || status === 'succeeded') {
          const url = extractImageUrlFromJob(job);
          if (url) {
            setImageByShotId(prev => ({ ...prev, [shot.id]: url }));
            clearImageJobState();
            showToast({ type: 'success', title: 'Image ready', message: 'Image generated.' });
            if (interval) window.clearInterval(interval);
            interval = undefined;
          } else {
            console.warn('[ImagePoll] Job completed but URL missing. Continuing to poll...');
          }
        }

        if (status === 'failed' || status === 'error') {
          if (interval) window.clearInterval(interval);
          interval = undefined;
          clearImageJobState();
          showToast({
            type: 'error',
            title: 'Image failed',
            message:
              typeof job.artifacts === 'object' && job.artifacts
                ? JSON.stringify(job.artifacts).slice(0, 500)
                : 'Image job failed',
          });
        }
      } catch (err) {
        if (cancelled) return;
        showToast({
          type: 'error',
          title: 'Status check failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    pollOnce();
    interval = window.setInterval(pollOnce, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, shot.id, imageJobId, imageUrl]);

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
        <span className="text-comfy-muted text-sm">
          {activeTab === 'image' && imageJobId
            ? `Image job ${imageJobId.slice(0, 8)}… ${imageJobStatus || ''}`.trim()
            : activeTab !== 'image' && videoJobId
              ? `Video job ${videoJobId.slice(0, 8)}… ${videoJobStatus || ''}`.trim()
              : `No ${activeTab === 'image' ? 'image' : 'video'} generated`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate || (activeTab === 'image' ? imageJobIsActive : videoJobIsActive)}
          className="comfy-btn disabled:opacity-50"
        >
          {isGenerating
            ? activeTab === 'image'
              ? 'Generating image...'
              : 'Generating video...'
            : (activeTab === 'image' ? imageJobIsActive : videoJobIsActive)
              ? 'Generating…'
              : activeTab === 'image'
                ? 'Generate Image'
                : 'Generate Video'}
        </button>
        {activeTab === 'image' && imageJobId && !imageJobIsActive && (
          <button
            type="button"
            onClick={() => {
              clearImageJobState();
              setImageByShotId(prev => ({ ...prev, [shot.id]: '' }));
            }}
            className="comfy-btn-secondary"
            title="Clear the previous job and try again"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );

  const renderImagePreview = () => {
    if (!imageUrl) return renderEmptyState();

	    return (
	      <div className="space-y-4">
	        <div className="aspect-video bg-comfy-input-bg rounded-lg overflow-hidden">
	          <img src={imageUrl} alt="Shot preview" className="w-full h-full object-contain" />
	        </div>
	        <div className="flex gap-2">
	          <button onClick={handleRegenerate} disabled={isGenerating} className="comfy-btn flex-1">
	            {isGenerating ? 'Regenerating image...' : 'Regenerate Image'}
	          </button>
	          <a
	            className="comfy-btn-secondary"
	            href={imageUrl}
	            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
        </div>
      </div>
    );
  };

  const renderVideoView = (title: string, onGenerate: () => void, isImageToVideo = false) => {
    if (!videoUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
            <span className="text-comfy-muted text-sm">
              {videoJobId
                ? `Video job ${videoJobId.slice(0, 8)}… ${videoJobStatus || ''}`.trim()
                : `No ${title.toLowerCase()} generated`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !canGenerate || videoJobIsActive || (isImageToVideo && !imageUrl)}
              className="comfy-btn disabled:opacity-50"
            >
              {videoJobIsActive ? 'Generating…' : isGenerating ? `Generating ${title.toLowerCase()}...` : `Generate ${title}`}
            </button>
            {videoJobId && !videoJobIsActive && (
              <button
                type="button"
                onClick={() => {
                  clearVideoJobState();
                  setVideoByShotId(prev => ({ ...prev, [shot.id]: '' }));
                }}
                className="comfy-btn-secondary disabled:opacity-50"
                disabled={isGenerating}
                title="Clear the previous job and try again"
              >
                Reset
              </button>
            )}
          </div>
          {isImageToVideo && !imageUrl && (
            <p className="mt-2 text-[11px] text-comfy-warning">
              Generate an image in the "Image" tab first.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video src={videoUrl} controls className="w-full h-full object-contain" />
        </div>
        <div className="flex gap-2">
          <button onClick={onGenerate} disabled={isGenerating} className="comfy-btn flex-1">
            {isGenerating ? `Regenerating ${title.toLowerCase()}...` : `Regenerate ${title}`}
          </button>
          <a
            className="comfy-btn-secondary"
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-comfy-muted uppercase tracking-wide">
          Image / Video
        </div>
	        <div className="comfy-segment">
	        <button
	          onClick={() => setActiveTab('image')}
	            className={`comfy-segment-btn ${
	              activeTab === 'image' ? 'comfy-segment-btn-active' : ''
	            }`}
	        >
	          Image
	        </button>
	        <button
	          onClick={() => setActiveTab('image_to_video')}
	            className={`comfy-segment-btn ${
	              activeTab === 'image_to_video' ? 'comfy-segment-btn-active' : ''
	            }`}
	          title={
	            imageUrl
	              ? 'Generate a video using the generated image as reference'
	              : 'Generate an image first, then convert it to video'
	          }
	        >
	          Image → Video
	        </button>
	        <button
	          onClick={() => setActiveTab('video')}
	            className={`comfy-segment-btn ${
	              activeTab === 'video' ? 'comfy-segment-btn-active' : ''
	            }`}
	        >
	          Video
	        </button>
	        </div>
		      </div>

      <details className="rounded-lg border border-comfy-border bg-comfy-input-bg p-3 mb-4">
        <summary className="cursor-pointer text-xs font-semibold text-comfy-muted uppercase">
          Prompt (sent to generator)
        </summary>
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            className="comfy-btn-secondary text-xs"
            onClick={() => {
              // Ensure Copilot has a deterministic focus target even if the user didn't explicitly click in the list.
              if (shot?.id && shot?.planId) {
                selectShot(shot.id, shot.planId);
                useCopilotActionsStore.getState().setPromptInput(`/improve-prompt Please improve the image generation prompt for shot ${shot.id.slice(0, 4)}.\n\nHere is the current assembled context:\n\n${assembledPrompt}`);
                setRightPanelTab('copilot');
              } else {
                showToast({
                  type: 'warning',
                  title: 'Select a shot',
                  message: 'Select a shot in the list first, then improve its prompt.',
                });
              }
            }}
            title="Open Copilot to improve this shot prompt"
          >
            Improve Prompt (Copilot)
          </button>
        </div>
        <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-comfy-muted">
                Generator Context
              </label>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${shot.generator_prompt ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {shot.generator_prompt ? 'Manual override saved' : 'Using assembled context prompt'}
              </span>
            </div>
          <div className="flex items-center justify-between">
            {isPromptDirty && <div className="text-[11px] text-comfy-warning">Unsaved</div>}
          </div>

          <label className="block text-[11px] text-comfy-muted">SENT_PROMPT</label>
          <textarea
            value={promptDraft}
            onChange={e => {
              setPromptDraft(e.target.value);
              setIsPromptDirty(true);
            }}
            rows={8}
            className="comfy-input w-full text-xs font-mono resize-none"
            placeholder="Prompt sent to the generator…"
          />

          <label className="block text-[11px] text-comfy-muted">NEGATIVE_PROMPT (optional)</label>
          <textarea
            value={negative_prompt_draft}
            onChange={e => {
              setNegativePromptDraft(e.target.value);
              setIsPromptDirty(true);
            }}
            rows={3}
            className="comfy-input w-full text-xs font-mono resize-none"
            placeholder="What to avoid…"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="comfy-btn-secondary text-xs disabled:opacity-50"
              disabled={isSavingPrompt}
              onClick={() => {
                const base = (shot.generator_prompt || '').trim() || generationPrompt;
                setPromptDraft(base);
                setNegativePromptDraft((shot.generator_negative_prompt || '').trim());
                setIsPromptDirty(false);
              }}
              title="Reset to the currently loaded prompt"
            >
              Reset
            </button>
            <button
              type="button"
              className="comfy-btn text-xs disabled:opacity-50"
              disabled={isSavingPrompt || !isPromptDirty}
              onClick={savePromptOverride}
              title="Save this prompt override into the shot plan"
            >
              {isSavingPrompt ? 'Saving…' : 'Save'}
            </button>
          </div>

          <details className="rounded border border-comfy-border bg-comfy-input-bg p-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-comfy-muted uppercase">
              Context (assembled)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-comfy-text">{assembledPrompt}</pre>
          </details>

          <details className="rounded border border-comfy-border bg-comfy-input-bg p-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-comfy-muted uppercase">
              Preview (sent to generator)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-comfy-text">{promptDisplay}</pre>
          </details>
        </div>
      </details>

      {/* Preview Content */}
      <div className="flex-1">
        {activeTab === 'image' && renderImagePreview()}
        {activeTab === 'image_to_video' && renderVideoView('Video', handleImageToVideo, true)}
        {activeTab === 'video' && renderVideoView('Video', handleGenerate)}
      </div>
    </div>
  );
}
