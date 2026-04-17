import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Shot } from './ShotsPage';
import {
  fetchJobStatus,
  fetchProjectAssets,
  generateCharacterImage,
  generateProjectVideo,
  generateVideoFromImage,
  type Asset,
  type JobStatus,
} from '../../lib/api';
import { showToast } from '../../stores';

interface PreviewStackProps {
  projectId: string;
  shot: Shot;
}

type PreviewTab = 'image' | 'video';

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
  const videoWorkflow =
    (import.meta.env.VITE_VIDEO_WORKFLOW as string | undefined) || 'fast_txt2video';
  const image2VideoWorkflow =
    (import.meta.env.VITE_IMAGE2VIDEO_WORKFLOW as string | undefined) || 'image2video';
  const image2VideoLengthRaw = import.meta.env.VITE_IMAGE2VIDEO_LENGTH as string | undefined;
  const image2VideoLength = image2VideoLengthRaw ? Number(image2VideoLengthRaw) : 81;
  const [activeTab, setActiveTab] = useState<PreviewTab>('image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageByShotId, setImageByShotId] = useState<Record<string, string>>({});
  const [videoByShotId, setVideoByShotId] = useState<Record<string, string>>({});
  const [videoJobByShotId, setVideoJobByShotId] = useState<Record<string, string>>({});
  const [videoJobStatusByShotId, setVideoJobStatusByShotId] = useState<Record<string, string>>({});
  const [hydratedForProjectId, setHydratedForProjectId] = useState<string | null>(null);

  const imageUrl = imageByShotId[shot.id] || '';
  const videoUrl = videoByShotId[shot.id] || '';
  const videoJobId = videoJobByShotId[shot.id] || '';
  const videoJobStatus = videoJobStatusByShotId[shot.id] || '';

  const canGenerate = Boolean(projectId) && Boolean(shot?.id);

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
    queryKey: ['project-assets', projectId, 'canon_text'],
    queryFn: () => fetchProjectAssets(projectId, 'canon_text'),
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
        .filter(a => a.status !== 'deprecated')
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
      shot.shotType ? `Framing: ${shot.shotType}.` : null,
      shot.angle ? `Angle: ${shot.angle}.` : null,
      shot.motion ? `Motion: ${shot.motion}.` : null,
      shot.prompt ? shot.prompt : null,
    ].filter(Boolean);

    return parts.join(' ').trim();
  }, [shot.angle, shot.motion, shot.prompt, shot.sceneId, shot.shotType]);

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
    const emotionalBeat =
      typeof match.emotionalBeat === 'string'
        ? match.emotionalBeat.trim()
        : typeof match.emotional_beat === 'string'
          ? String(match.emotional_beat).trim()
          : '';

    if (!title && !setting && !emotionalBeat) return null;
    return { title, setting, emotionalBeat };
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
    const worldRules = (getStringArray('worldRules').length ? getStringArray('worldRules') : getStringArray('world_rules')).slice(0, 6);
    const colorPalette = (getStringArray('colorPalette').length ? getStringArray('colorPalette') : getStringArray('color_palette')).slice(0, 6);

    const shotText = `${effectivePrompt}`.toLowerCase();

    const charactersRaw = Array.isArray(content.characters)
      ? (content.characters.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
      : [];
    const matchedCharacters = charactersRaw
      .filter(c => {
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        return name && shotText.includes(name.toLowerCase());
      })
      .slice(0, 3);
    const characters = matchedCharacters
      .map(c => {
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        const description = typeof c.description === 'string' ? c.description.trim() : '';
        const appearance =
          c.appearance && typeof c.appearance === 'object'
            ? (c.appearance as Record<string, unknown>)
            : null;
        const appearanceBits = appearance
          ? (['face', 'hair', 'clothing', 'shoes', 'hat', 'accessories'] as const)
              .map(k =>
                typeof appearance[k] === 'string' ? `${k}: ${String(appearance[k]).trim()}` : null
              )
              .filter(Boolean)
          : [];
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
      worldRules.length === 0 &&
      colorPalette.length === 0 &&
      characters.length === 0 &&
      locationNames.length === 0 &&
      equipmentNames.length === 0
    ) {
      return null;
    }

    return {
      tone,
      themes,
      worldRules,
      colorPalette,
      characters,
      locations: locationNames.slice(0, 8),
      equipment: equipmentNames.slice(0, 8),
    };
  }, [effectivePrompt, latestCanonAsset]);

  const generationPrompt = useMemo(() => {
    const lines: string[] = [];
    lines.push('CANON:');
    if (canonInfo) {
      if (canonInfo.tone) lines.push(`  tone: ${canonInfo.tone}`);
      if (canonInfo.themes.length) lines.push(`  themes: [${canonInfo.themes.join(', ')}]`);
      if (canonInfo.colorPalette.length)
        lines.push(`  color_palette: [${canonInfo.colorPalette.join(', ')}]`);
      if (canonInfo.worldRules.length) {
        lines.push('  world_rules:');
        for (const rule of canonInfo.worldRules) lines.push(`    - ${rule}`);
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
      if (sceneInfo.emotionalBeat) lines.push(`  emotional_beat: ${sceneInfo.emotionalBeat}`);
    } else {
      lines.push('  (none)');
    }

    lines.push('');
    lines.push('SHOT:');
    if (shot.sceneId) lines.push(`  scene: ${shot.sceneId}`);
    if (shot.shotType) lines.push(`  framing: ${shot.shotType}`);
    if (shot.angle) lines.push(`  angle: ${shot.angle}`);
    if (shot.motion) lines.push(`  motion: ${shot.motion}`);
    if (shot.prompt) lines.push(`  description: ${shot.prompt}`);
    if (shot.negativePrompt) lines.push(`  negative: ${shot.negativePrompt}`);

    lines.push('');
    lines.push('INSTRUCTIONS:');
    lines.push('  - Generate a cinematic frame consistent with CANON + SCENE + SHOT.');
    lines.push('  - No text, no watermark, no UI, no logos.');
    lines.push('  - Keep characters, wardrobe, props, and locations consistent.');

    return lines.join('\n').trim();
  }, [canonInfo, sceneInfo, shot]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!generationPrompt) {
      showToast({ type: 'error', title: 'Missing prompt', message: 'No prompt for this shot.' });
      return;
    }
    setIsGenerating(true);
    try {
      if (activeTab === 'image') {
        const result = await generateCharacterImage({
          projectId,
          prompt: generationPrompt,
          width: 1280,
          height: 720,
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
      } else {
        const result = await generateProjectVideo({
          projectId,
          prompt: generationPrompt,
          workflow: videoWorkflow,
          width: 1024,
          height: 576,
        });
        setVideoJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
        setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));
        if (!result.video_url) {
          showToast({
            type: 'warning',
            title: 'Video queued',
            message: `Job ${result.job_id} started (no video URL yet).`,
          });
          return;
        }
        setVideoByShotId(prev => ({ ...prev, [shot.id]: result.video_url! }));
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
      const result = await generateVideoFromImage({
        projectId,
        prompt: generationPrompt,
        workflow: image2VideoWorkflow,
        width: 640,
        height: 480,
        length: Number.isFinite(image2VideoLength) ? image2VideoLength : 81,
        reference_image_url: imageUrl,
      });
      setVideoJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
      setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));

      if (!result.video_url) {
        showToast({
          type: 'warning',
          title: 'Video queued',
          message: `Job ${result.job_id} started (no video URL yet).`,
        });
        return;
      }
      setVideoByShotId(prev => ({ ...prev, [shot.id]: result.video_url! }));
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

    return null;
  };

  useEffect(() => {
    if (!videoJobId) return;
    if (videoUrl) return;
    if (activeTab !== 'video') return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      try {
        const job = await fetchJobStatus(videoJobId);
        if (cancelled) return;
        setVideoJobStatusByShotId(prev => ({ ...prev, [shot.id]: job.status }));

        if (job.status === 'completed') {
          const url = extractVideoUrlFromJob(job);
          if (url) {
            setVideoByShotId(prev => ({ ...prev, [shot.id]: url }));
            showToast({ type: 'success', title: 'Video ready', message: 'Video generated.' });
          } else {
            showToast({
              type: 'warning',
              title: 'Video completed',
              message: 'Job completed but no video URL was returned.',
            });
            setVideoJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
          }
        }

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'error') {
          if (interval) window.clearInterval(interval);
          interval = undefined;
          if (job.status === 'failed' || job.status === 'error') {
            setVideoJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
            showToast({
              type: 'error',
              title: 'Video failed',
              message:
                typeof job.artifacts === 'object' && job.artifacts
                  ? JSON.stringify(job.artifacts).slice(0, 500)
                  : 'Video job failed',
            });
          }
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

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
        <span className="text-comfy-muted text-sm">No preview available</span>
      </div>
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !canGenerate}
        className="comfy-btn disabled:opacity-50"
      >
        {isGenerating
          ? activeTab === 'image'
            ? 'Generating image...'
            : 'Generating video...'
          : activeTab === 'image'
            ? 'Generate Image'
            : 'Generate Video'}
      </button>
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

  const renderVideoPreview = () => {
    if (!videoUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
            <span className="text-comfy-muted text-sm">
              {videoJobId
                ? `Video job ${videoJobId.slice(0, 8)}… ${videoJobStatus || ''}`.trim()
                : 'No video generated'}
            </span>
          </div>
	          <div className="flex items-center gap-2">
	            <button
	              onClick={handleGenerate}
	              disabled={isGenerating || !canGenerate || Boolean(videoJobId)}
	              className="comfy-btn disabled:opacity-50"
	            >
	              {videoJobId ? 'Generating…' : isGenerating ? 'Generating video...' : 'Generate Video'}
	            </button>
	          </div>
	        </div>
	      );
	    }

    return (
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video src={videoUrl} controls className="w-full h-full object-contain" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleRegenerate} disabled={isGenerating} className="comfy-btn flex-1">
            {isGenerating ? 'Regenerating video...' : 'Regenerate Video'}
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
		          type="button"
		          onClick={async () => {
		            setActiveTab('video');
	            await handleImageToVideo();
	          }}
	          disabled={!imageUrl || isGenerating || !canGenerate || Boolean(videoJobId)}
	          className="comfy-segment-btn disabled:opacity-50"
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
        <pre className="mt-2 whitespace-pre-wrap text-xs text-comfy-text">{generationPrompt}</pre>
      </details>

      {/* Preview Content */}
      <div className="flex-1">
        {activeTab === 'image' ? renderImagePreview() : renderVideoPreview()}
      </div>
    </div>
  );
}
