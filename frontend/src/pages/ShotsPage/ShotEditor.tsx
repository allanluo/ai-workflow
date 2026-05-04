import { useEffect, useMemo, useState } from 'react';
import type { Shot } from './ShotsPage';
import { API_BASE_URL, fetchJobStatus, generateSoundEffect, generateVoiceOver, type JobStatus } from '../../lib/api';
import { showToast } from '../../stores';

interface ShotEditorProps {
  projectId: string;
  shot: Shot;
  shots: Shot[];
  onSave?: (updates: Partial<Shot>) => void;
  isMutating?: boolean;
}

const shotTypes = ['Wide', 'Medium', 'Close-up', 'Extreme Close-up', 'Over the Shoulder', 'POV'];
const angles = ['Eye Level', 'High', 'Low', 'Dutch', "Bird's Eye", "Worm's Eye"];
const motions = ['Static', 'Pan', 'Tilt', 'Tracking', 'Dolly', 'Zoom', 'Handheld'];

type StoredVoiceOver = Record<
  string,
  {
    text?: string;
    audioUrl?: string;
    jobId?: string;
    status?: string;
    provider?: 'piper' | 'cosyvoice';
    template?: string;
    updatedAt: number;
  }
>;

type StoredNarrationAudio = Record<
  string,
  {
    audioUrl?: string;
    jobId?: string;
    status?: string;
    updatedAt: number;
  }
>;

type DialogueLine = {
  id: string;
  speaker: string;
  text: string;
  provider: 'piper' | 'cosyvoice';
  template: string;
  audioUrl?: string;
  jobId?: string;
  status?: string;
};

type StoredDialogue = Record<
  string,
  {
    lines: DialogueLine[];
    updatedAt: number;
  }
>;

function resolveMaybeRelativeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    try {
      return new URL(url, API_BASE_URL).toString();
    } catch {
      return url;
    }
  }
  return url;
}

export function ShotEditor({ projectId, shot, shots, onSave, isMutating }: ShotEditorProps) {
  const sfxWorkflow = (import.meta.env.VITE_SFX_WORKFLOW as string | undefined) || 'sfx';
  const [prompt, setPrompt] = useState(shot.prompt);
  const [action, setAction] = useState(shot.action || '');
  const [narrationText, setNarrationText] = useState(shot.narration_text || '');
  const [narration, setNarration] = useState(shot.narration || '');
  const [internalMonologue, setInternalMonologue] = useState(shot.internal_monologue || '');
  const [dialogue, setDialogue] = useState(shot.dialogue || '');
  const [characters, setCharacters] = useState<string[]>(shot.characters || []);
  const [environment, setEnvironment] = useState(shot.environment || '');
  const [props, setProps] = useState<string[]>(shot.props || []);
  const [frame_prompt, setFramePrompt] = useState(shot.frame_prompt || '');
  const [video_prompt, setVideoPrompt] = useState(shot.video_prompt || '');

  const [negative_prompt, setNegativePrompt] = useState(shot.negative_prompt || '');
  const [shot_type, setShotType] = useState(shot.shot_type || '');
  const [angle, setAngle] = useState(shot.angle || '');
  const [motion, setMotion] = useState(shot.motion || '');
  const [duration, setDuration] = useState(shot.duration || 3);
  const [isDirty, setIsDirty] = useState(false);

  const [narrationAudioByShotId, setNarrationAudioByShotId] = useState<Record<string, string>>({});
  const [narrationJobByShotId, setNarrationJobByShotId] = useState<Record<string, string>>({});
  const [narrationStatusByShotId, setNarrationStatusByShotId] = useState<Record<string, string>>({});
  const [narrationHydratedForProjectId, setNarrationHydratedForProjectId] = useState<string | null>(null);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [isGeneratingNarrationAll, setIsGeneratingNarrationAll] = useState(false);

  const [voiceOverAudioByShotId, setVoiceOverAudioByShotId] = useState<Record<string, string>>({});
  const [voiceOverJobByShotId, setVoiceOverJobByShotId] = useState<Record<string, string>>({});
  const [voiceOverStatusByShotId, setVoiceOverStatusByShotId] = useState<Record<string, string>>({});
  const [voiceOverProviderByShotId, setVoiceOverProviderByShotId] = useState<
    Record<string, 'piper' | 'cosyvoice'>
  >({});
  const [voiceOverTemplateByShotId, setVoiceOverTemplateByShotId] = useState<Record<string, string>>({});
  const [dialogueByShotId, setDialogueByShotId] = useState<Record<string, DialogueLine[]>>({});
  const [dialogueHydratedForProjectId, setDialogueHydratedForProjectId] = useState<string | null>(
    null
  );
  const [hydratedForProjectId, setHydratedForProjectId] = useState<string | null>(null);
  const [isGeneratingVoiceOver, setIsGeneratingVoiceOver] = useState(false);
  const [generatingDialogueLineId, setGeneratingDialogueLineId] = useState<string | null>(null);

  const [sfxPromptByShotId, setSfxPromptByShotId] = useState<Record<string, string>>({});
  const [sfxAudioByShotId, setSfxAudioByShotId] = useState<Record<string, string>>({});
  const [sfxJobByShotId, setSfxJobByShotId] = useState<Record<string, string>>({});
  const [sfxStatusByShotId, setSfxStatusByShotId] = useState<Record<string, string>>({});
  const [sfxHydratedForProjectId, setSfxHydratedForProjectId] = useState<string | null>(null);
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);

  const narrationAudioUrl = narrationAudioByShotId[shot.id] ?? '';
  const narrationJobId = narrationJobByShotId[shot.id] ?? '';
  const narrationStatus = narrationStatusByShotId[shot.id] ?? '';

  const voiceOverAudioUrl = voiceOverAudioByShotId[shot.id] ?? '';
  const voiceOverJobId = voiceOverJobByShotId[shot.id] ?? '';
  const voiceOverStatus = voiceOverStatusByShotId[shot.id] ?? '';
  const voiceOverProvider = voiceOverProviderByShotId[shot.id] ?? 'piper';
  const voiceOverTemplate = voiceOverTemplateByShotId[shot.id] ?? '';
  const dialogueLines = dialogueByShotId[shot.id] ?? [];

  const sfxPrompt = sfxPromptByShotId[shot.id] ?? '';
  const sfxAudioUrl = sfxAudioByShotId[shot.id] ?? '';
  const sfxJobId = sfxJobByShotId[shot.id] ?? '';
  const sfxStatus = sfxStatusByShotId[shot.id] ?? '';

  useEffect(() => {
    setPrompt(shot.prompt);
    setAction(shot.action || '');
    setNarrationText(shot.narration_text || '');
    setNarration(shot.narration || '');
    setInternalMonologue(shot.internal_monologue || '');
    setDialogue(shot.dialogue || '');
    setCharacters(shot.characters || []);
    setEnvironment(shot.environment || '');
    setProps(shot.props || []);
    setFramePrompt(shot.frame_prompt || '');
    setVideoPrompt(shot.video_prompt || '');

    setNegativePrompt(shot.negative_prompt || '');
    setShotType(shot.shot_type || '');
    setAngle(shot.angle || '');
    setMotion(shot.motion || '');
    setDuration(shot.duration || 3);
    setIsDirty(false);
  }, [
    shot.id,
    shot.prompt,
    shot.action,
    shot.narration_text,
    shot.narration,
    shot.internal_monologue,
    shot.dialogue,
    shot.characters,
    shot.environment,
    shot.props,
    shot.frame_prompt,
    shot.video_prompt,
    shot.shot_type,
    shot.angle,
    shot.motion,
    shot.duration,
  ]);

  const makeLineId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const parseDialogueFromText = (text: string): DialogueLine[] => {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];

    const lines: DialogueLine[] = [];

    // 1) Quoted dialogue: "Hello there"
    const quotedMatches = Array.from(trimmed.matchAll(/"([^"]{2,})"/g))
      .map(m => (m[1] ?? '').trim())
      .filter(Boolean);
    if (quotedMatches.length > 0) {
      for (const q of quotedMatches.slice(0, 10)) {
        lines.push({
          id: makeLineId(),
          speaker: '',
          text: q,
          provider: 'piper',
          template: '',
        });
      }
      return lines;
    }

    // 2) Speaker: dialogue
    const rawLines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    for (const raw of rawLines.slice(0, 20)) {
      const m = raw.match(/^([A-Za-z][A-Za-z0-9 _-]{0,30})\s*:\s*(.+)$/);
      if (m) {
        lines.push({
          id: makeLineId(),
          speaker: (m[1] ?? '').trim(),
          text: (m[2] ?? '').trim(),
          provider: 'piper',
          template: '',
        });
      }
    }
    if (lines.length > 0) return lines;

    return [];
  };

  useEffect(() => {
    if (!projectId) return;
    if (narrationHydratedForProjectId === projectId) return;

    const storageKey = `aiwf:shotNarrationAudio:${projectId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setNarrationHydratedForProjectId(projectId);
        return;
      }

      const parsed = JSON.parse(raw) as { items?: StoredNarrationAudio } | StoredNarrationAudio;
      const items: StoredNarrationAudio =
        parsed && typeof parsed === 'object' && 'items' in (parsed as Record<string, unknown>)
          ? (((parsed as Record<string, unknown>).items ?? {}) as StoredNarrationAudio)
          : (parsed as StoredNarrationAudio);

      const nextAudio: Record<string, string> = {};
      const nextJobs: Record<string, string> = {};
      const nextStatus: Record<string, string> = {};

      for (const [shotId, item] of Object.entries(items ?? {})) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.audioUrl === 'string') nextAudio[shotId] = item.audioUrl;
        if (typeof item.jobId === 'string') nextJobs[shotId] = item.jobId;
        if (typeof item.status === 'string') nextStatus[shotId] = item.status;
      }

      setNarrationAudioByShotId(nextAudio);
      setNarrationJobByShotId(nextJobs);
      setNarrationStatusByShotId(nextStatus);
    } catch {
      // ignore invalid localStorage state
    } finally {
      setNarrationHydratedForProjectId(projectId);
    }
  }, [narrationHydratedForProjectId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (hydratedForProjectId === projectId) return;

    const storageKey = `aiwf:shotVoiceover:${projectId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setHydratedForProjectId(projectId);
        return;
      }

      const parsed = JSON.parse(raw) as { items?: StoredVoiceOver } | StoredVoiceOver;
      const items: StoredVoiceOver =
        parsed && typeof parsed === 'object' && 'items' in (parsed as Record<string, unknown>)
          ? (((parsed as Record<string, unknown>).items ?? {}) as StoredVoiceOver)
          : (parsed as StoredVoiceOver);

      const nextAudio: Record<string, string> = {};
      const nextJobs: Record<string, string> = {};
      const nextStatus: Record<string, string> = {};
      const nextProviders: Record<string, 'piper' | 'cosyvoice'> = {};
      const nextTemplates: Record<string, string> = {};

      for (const [shotId, item] of Object.entries(items ?? {})) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.audioUrl === 'string') nextAudio[shotId] = item.audioUrl;
        if (typeof item.jobId === 'string') nextJobs[shotId] = item.jobId;
        if (typeof item.status === 'string') nextStatus[shotId] = item.status;
        if (item.provider === 'piper' || item.provider === 'cosyvoice') nextProviders[shotId] = item.provider;
        if (typeof item.template === 'string') nextTemplates[shotId] = item.template;
      }

      setVoiceOverAudioByShotId(nextAudio);
      setVoiceOverJobByShotId(nextJobs);
      setVoiceOverStatusByShotId(nextStatus);
      setVoiceOverProviderByShotId(nextProviders);
      setVoiceOverTemplateByShotId(nextTemplates);
    } catch {
      // ignore invalid localStorage state
    } finally {
      setHydratedForProjectId(projectId);
    }
  }, [hydratedForProjectId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (sfxHydratedForProjectId === projectId) return;

    const storageKey = `aiwf:shotSfx:${projectId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSfxHydratedForProjectId(projectId);
        return;
      }
      const parsed = JSON.parse(raw) as {
        prompts?: Record<string, string>;
        audio?: Record<string, string>;
        jobs?: Record<string, string>;
        status?: Record<string, string>;
      };
      setSfxPromptByShotId(parsed.prompts ?? {});
      setSfxAudioByShotId(parsed.audio ?? {});
      setSfxJobByShotId(parsed.jobs ?? {});
      setSfxStatusByShotId(parsed.status ?? {});
    } catch {
      // ignore invalid localStorage state
    } finally {
      setSfxHydratedForProjectId(projectId);
    }
  }, [projectId, sfxHydratedForProjectId]);

  useEffect(() => {
    if (!projectId) return;
    if (sfxHydratedForProjectId !== projectId) return;

    const storageKey = `aiwf:shotSfx:${projectId}`;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          prompts: sfxPromptByShotId,
          audio: sfxAudioByShotId,
          jobs: sfxJobByShotId,
          status: sfxStatusByShotId,
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [projectId, sfxHydratedForProjectId, sfxAudioByShotId, sfxJobByShotId, sfxPromptByShotId, sfxStatusByShotId]);

  useEffect(() => {
    if (!projectId) return;
    if (dialogueHydratedForProjectId === projectId) return;

    const storageKey = `aiwf:shotDialogue:${projectId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setDialogueHydratedForProjectId(projectId);
        return;
      }

      const parsed = JSON.parse(raw) as { items?: StoredDialogue } | StoredDialogue;
      const items: StoredDialogue =
        parsed && typeof parsed === 'object' && 'items' in (parsed as Record<string, unknown>)
          ? (((parsed as Record<string, unknown>).items ?? {}) as StoredDialogue)
          : (parsed as StoredDialogue);

      const next: Record<string, DialogueLine[]> = {};
      for (const [shotId, item] of Object.entries(items ?? {})) {
        if (!item || typeof item !== 'object') continue;
        const maybeLines = (item as { lines?: unknown }).lines;
        if (!Array.isArray(maybeLines)) continue;
        next[shotId] = maybeLines
          .filter(v => v && typeof v === 'object')
          .map(v => v as DialogueLine);
      }
      setDialogueByShotId(next);
    } catch {
      // ignore invalid localStorage state
    } finally {
      setDialogueHydratedForProjectId(projectId);
    }
  }, [dialogueHydratedForProjectId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (dialogueHydratedForProjectId !== projectId) return;

    const storageKey = `aiwf:shotDialogue:${projectId}`;
    const now = Date.now();
    const merged: StoredDialogue = {};

    for (const [shotId, lines] of Object.entries(dialogueByShotId)) {
      if (!Array.isArray(lines) || lines.length === 0) continue;
      merged[shotId] = { lines, updatedAt: now };
    }

    const entries = Object.entries(merged).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    const capped = Object.fromEntries(entries.slice(0, 200));

    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ items: capped }));
    } catch {
      // ignore quota errors
    }
  }, [dialogueByShotId, dialogueHydratedForProjectId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (hydratedForProjectId !== projectId) return;
    const storageKey = `aiwf:shotVoiceover:${projectId}`;

    const now = Date.now();
    const merged: StoredVoiceOver = {};
    const shotIds = new Set<string>([
      ...Object.keys(voiceOverAudioByShotId),
      ...Object.keys(voiceOverJobByShotId),
      ...Object.keys(voiceOverStatusByShotId),
      ...Object.keys(voiceOverProviderByShotId),
      ...Object.keys(voiceOverTemplateByShotId),
    ]);

    for (const shotId of shotIds) {
      const audioUrl = voiceOverAudioByShotId[shotId];
      const jobId = voiceOverJobByShotId[shotId];
      const status = voiceOverStatusByShotId[shotId];
      const provider = voiceOverProviderByShotId[shotId];
      const template = voiceOverTemplateByShotId[shotId];
      if (!audioUrl && !jobId && !status && !provider && !template) continue;
      merged[shotId] = { audioUrl, jobId, status, provider, template, updatedAt: now };
    }

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
    voiceOverAudioByShotId,
    voiceOverJobByShotId,
    voiceOverProviderByShotId,
    voiceOverStatusByShotId,
    voiceOverTemplateByShotId,
  ]);

  useEffect(() => {
    if (!projectId) return;
    if (narrationHydratedForProjectId !== projectId) return;
    const storageKey = `aiwf:shotNarrationAudio:${projectId}`;

    const now = Date.now();
    const merged: StoredNarrationAudio = {};
    const shotIds = new Set<string>([
      ...Object.keys(narrationAudioByShotId),
      ...Object.keys(narrationJobByShotId),
      ...Object.keys(narrationStatusByShotId),
    ]);

    for (const shotId of shotIds) {
      const audioUrl = narrationAudioByShotId[shotId];
      const jobId = narrationJobByShotId[shotId];
      const status = narrationStatusByShotId[shotId];
      if (!audioUrl && !jobId && !status) continue;
      merged[shotId] = { audioUrl, jobId, status, updatedAt: now };
    }

    const entries = Object.entries(merged).sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    const capped = Object.fromEntries(entries.slice(0, 200));
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ items: capped }));
    } catch {
      // ignore quota errors
    }
  }, [
    narrationHydratedForProjectId,
    projectId,
    narrationAudioByShotId,
    narrationJobByShotId,
    narrationStatusByShotId,
  ]);

  const extractAudioUrlFromJob = (job: JobStatus): string | null => {
    const artifacts = job.artifacts;
    if (!artifacts || typeof artifacts !== 'object') return null;
    const record = artifacts as Record<string, unknown>;

    return (
      resolveMaybeRelativeUrl(record.audio_url) ??
      resolveMaybeRelativeUrl(record.audioUrl) ??
      resolveMaybeRelativeUrl(record.url) ??
      resolveMaybeRelativeUrl(record.audio_path) ??
      resolveMaybeRelativeUrl(record.audioPath) ??
      null
    );
  };

  useEffect(() => {
    if (!projectId) return;

    const pending = Object.entries(narrationJobByShotId).filter(([shotId, jobId]) => {
      if (!jobId) return false;
      return !narrationAudioByShotId[shotId];
    });
    if (pending.length === 0) return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      const slice = pending.slice(0, 5);
      for (const [shotId, jobId] of slice) {
        if (cancelled) return;
        try {
          const job = await fetchJobStatus(jobId);
          if (cancelled) return;
          setNarrationStatusByShotId(prev => ({ ...prev, [shotId]: job.status }));

          if (job.status === 'completed') {
            const url = extractAudioUrlFromJob(job);
            if (url) {
              setNarrationAudioByShotId(prev => ({ ...prev, [shotId]: url }));
              if (shotId === shot.id) {
                showToast({ type: 'success', title: 'Narration ready', message: 'Audio generated.' });
              }
            } else {
              setNarrationJobByShotId(prev => ({ ...prev, [shotId]: '' }));
              if (shotId === shot.id) {
                showToast({
                  type: 'warning',
                  title: 'Narration completed',
                  message: 'Job completed but no audio URL was returned.',
                });
              }
            }
          }

          if (job.status === 'failed' || job.status === 'error') {
            setNarrationJobByShotId(prev => ({ ...prev, [shotId]: '' }));
            if (shotId === shot.id) {
              showToast({
                type: 'error',
                title: 'Narration failed',
                message:
                  typeof job.artifacts === 'object' && job.artifacts
                    ? JSON.stringify(job.artifacts).slice(0, 500)
                    : 'Narration job failed',
              });
            }
          }
        } catch {
          // ignore individual poll errors
        }
      }
    };

    pollOnce();
    interval = window.setInterval(pollOnce, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shot.id, narrationAudioByShotId, narrationJobByShotId]);

  useEffect(() => {
    if (!voiceOverJobId) return;
    if (voiceOverAudioUrl) return;
    if (!projectId) return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      try {
        const job = await fetchJobStatus(voiceOverJobId);
        if (cancelled) return;
        setVoiceOverStatusByShotId(prev => ({ ...prev, [shot.id]: job.status }));

        if (job.status === 'completed') {
          const url = extractAudioUrlFromJob(job);
          if (url) {
            setVoiceOverAudioByShotId(prev => ({ ...prev, [shot.id]: url }));
            showToast({ type: 'success', title: 'Voice-over ready', message: 'Audio generated.' });
          } else {
            showToast({
              type: 'warning',
              title: 'Voice-over completed',
              message: 'Job completed but no audio URL was returned.',
            });
            setVoiceOverJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
          }
        }

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'error') {
          if (interval) window.clearInterval(interval);
          interval = undefined;
          if (job.status === 'failed' || job.status === 'error') {
            setVoiceOverJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
            showToast({
              type: 'error',
              title: 'Voice-over failed',
              message:
                typeof job.artifacts === 'object' && job.artifacts
                  ? JSON.stringify(job.artifacts).slice(0, 500)
                  : 'Voice-over job failed',
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
    interval = window.setInterval(pollOnce, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shot.id, voiceOverJobId, voiceOverAudioUrl]);

  useEffect(() => {
    if (!sfxJobId) return;
    if (sfxAudioUrl) return;
    if (!projectId) return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      try {
        const job = await fetchJobStatus(sfxJobId);
        if (cancelled) return;
        setSfxStatusByShotId(prev => ({ ...prev, [shot.id]: job.status }));

        if (job.status === 'completed') {
          const url = extractAudioUrlFromJob(job);
          if (url) {
            setSfxAudioByShotId(prev => ({ ...prev, [shot.id]: url }));
            showToast({ type: 'success', title: 'SFX ready', message: 'Sound effect generated.' });
          } else {
            showToast({
              type: 'warning',
              title: 'SFX completed',
              message: 'Job completed but no audio URL was returned.',
            });
            setSfxJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
          }
        }

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'error') {
          if (interval) window.clearInterval(interval);
          interval = undefined;
          if (job.status === 'failed' || job.status === 'error') {
            setSfxJobByShotId(prev => ({ ...prev, [shot.id]: '' }));
            showToast({
              type: 'error',
              title: 'SFX failed',
              message:
                typeof job.artifacts === 'object' && job.artifacts
                  ? JSON.stringify(job.artifacts).slice(0, 500)
                  : 'Sound job failed',
            });
          }
        }
      } catch {
        // ignore poll errors
      }
    };

    pollOnce();
    interval = window.setInterval(pollOnce, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shot.id, sfxAudioUrl, sfxJobId]);

  useEffect(() => {
    const pending = dialogueLines.filter(l => l.jobId && !l.audioUrl);
    if (!projectId) return;
    if (pending.length === 0) return;

    let cancelled = false;
    let interval: number | undefined;

    const pollOnce = async () => {
      for (const line of pending) {
        if (cancelled) return;
        if (!line.jobId) continue;
        try {
          const job = await fetchJobStatus(line.jobId);
          if (cancelled) return;
          setDialogueByShotId(prev => {
            const current = prev[shot.id] ?? [];
            const next = current.map(it =>
              it.id === line.id ? { ...it, status: job.status } : it
            );
            return { ...prev, [shot.id]: next };
          });

          if (job.status === 'completed') {
            const url = extractAudioUrlFromJob(job);
            if (url) {
              setDialogueByShotId(prev => {
                const current = prev[shot.id] ?? [];
                const next = current.map(it =>
                  it.id === line.id ? { ...it, audioUrl: url } : it
                );
                return { ...prev, [shot.id]: next };
              });
            } else {
              setDialogueByShotId(prev => {
                const current = prev[shot.id] ?? [];
                const next = current.map(it =>
                  it.id === line.id ? { ...it, jobId: undefined } : it
                );
                return { ...prev, [shot.id]: next };
              });
            }
          }

          if (job.status === 'failed' || job.status === 'error') {
            setDialogueByShotId(prev => {
              const current = prev[shot.id] ?? [];
              const next = current.map(it => (it.id === line.id ? { ...it, jobId: undefined } : it));
              return { ...prev, [shot.id]: next };
            });
          }
        } catch {
          // ignore individual poll errors
        }
      }
    };

    pollOnce();
    interval = window.setInterval(pollOnce, 3000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shot.id, dialogueLines]);

  const sfxSuggestedPrompt = useMemo(() => {
    const description = (shot.prompt || '').trim() || (shot.subtitle || '').trim();
    const details = [
      shot.sceneId ? `scene: ${shot.sceneId}` : null,
      shot.shot_type ? `framing: ${shot.shot_type}` : null,
      shot.motion ? `motion: ${shot.motion}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    return [
      'Generate realistic sound effects (no music, no voice).',
      details ? `Context: ${details}.` : null,
      description ? `Shot: ${description}` : null,
      'Include ambience + foley + key action sounds. Return a single cohesive clip.',
    ]
      .filter(Boolean)
      .join(' ');
  }, [shot.motion, shot.prompt, shot.sceneId, shot.shot_type, shot.subtitle]);

  const handleGenerateSfx = async () => {
    if (!projectId) return;
    const promptText = (sfxPrompt || '').trim();
    if (!promptText) {
      showToast({ type: 'error', title: 'Missing SFX prompt', message: 'Enter an SFX prompt.' });
      return;
    }
    setIsGeneratingSfx(true);
    try {
      const result = await generateSoundEffect({
        projectId,
        prompt: promptText,
        workflow: sfxWorkflow,
        duration_seconds: 4,
        batch_size: 1,
      });
      setSfxJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
      setSfxStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));
      const audioUrl = resolveMaybeRelativeUrl(result.audio_url) ?? resolveMaybeRelativeUrl(result.audio_path);
      if (audioUrl) {
        setSfxAudioByShotId(prev => ({ ...prev, [shot.id]: audioUrl }));
      } else {
        showToast({
          type: 'warning',
          title: 'SFX queued',
          message: `Job ${result.job_id} started (no audio URL yet).`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'SFX failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingSfx(false);
    }
  };

  const voiceOverPlaceholder = useMemo(() => {
    if (narrationText && narrationText.trim()) return `Narration: ${narrationText.trim()}`;
    if (shot.subtitle && shot.subtitle.trim()) return `Narration: ${shot.subtitle.trim()}`;
    if (shot.prompt && shot.prompt.trim()) return `Narration: ${shot.prompt.trim()}`;
    return 'Write the voice-over script here...';
  }, [narrationText, shot.prompt, shot.subtitle]);

  const handleGenerateNarration = async () => {
    if (!projectId) return;
    const text = (narrationText || '').trim();
    if (!text) {
      showToast({ type: 'error', title: 'Missing narration', message: 'Enter narration text.' });
      return;
    }
    setIsGeneratingNarration(true);
    setNarrationAudioByShotId(prev => ({ ...prev, [shot.id]: '' }));
    try {
      const result = await generateVoiceOver({ projectId, text });
      setNarrationJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
      setNarrationStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));
      const audioUrl = resolveMaybeRelativeUrl(result.audio_url) ?? resolveMaybeRelativeUrl(result.audio_path);
      if (audioUrl) {
        setNarrationAudioByShotId(prev => ({ ...prev, [shot.id]: audioUrl }));
      } else {
        showToast({
          type: 'warning',
          title: 'Narration queued',
          message: `Job ${result.job_id} started (no audio URL yet).`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Narration failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const handleGenerateNarrationForAllShots = async () => {
    if (!projectId) return;
    if (!Array.isArray(shots) || shots.length === 0) return;

    const candidates = shots
      .map(s => ({
        shotId: s.id,
        text: (s.id === shot.id ? narrationText : s.narration_text || '').trim(),
      }))
      .filter(c => c.text.length > 0);

    if (candidates.length === 0) {
      showToast({
        type: 'warning',
        title: 'No narration to generate',
        message: 'No shots have Narration (Story) text.',
      });
      return;
    }

    const overwriteCount = candidates.filter(c => Boolean(narrationAudioByShotId[c.shotId])).length;
    const confirmMessage = overwriteCount
      ? `Generate narration audio for ${candidates.length} shot(s)? This will overwrite existing narration audio for ${overwriteCount} shot(s).`
      : `Generate narration audio for ${candidates.length} shot(s)?`;
    if (!window.confirm(confirmMessage)) return;

    setIsGeneratingNarrationAll(true);
    let okCount = 0;
    let failCount = 0;

    for (const c of candidates) {
      try {
        setNarrationAudioByShotId(prev => ({ ...prev, [c.shotId]: '' }));
        const result = await generateVoiceOver({ projectId, text: c.text });
        okCount += 1;
        setNarrationJobByShotId(prev => ({ ...prev, [c.shotId]: result.job_id }));
        setNarrationStatusByShotId(prev => ({ ...prev, [c.shotId]: result.status }));
        const audioUrl = resolveMaybeRelativeUrl(result.audio_url) ?? resolveMaybeRelativeUrl(result.audio_path);
        if (audioUrl) {
          setNarrationAudioByShotId(prev => ({ ...prev, [c.shotId]: audioUrl }));
        }
      } catch {
        failCount += 1;
      }
    }

    showToast({
      type: failCount ? 'warning' : 'success',
      title: failCount ? 'Narration generation finished' : 'Narration generation queued',
      message: failCount ? `Queued ${okCount} shot(s); failed ${failCount}.` : `Queued ${okCount} shot(s).`,
    });

    setIsGeneratingNarrationAll(false);
  };

  const handleGenerateVoiceOver = async () => {
    if (!projectId) return;
    const text = (narration || '').trim();
    if (!text) {
      showToast({ type: 'error', title: 'Missing voice-over', message: 'Enter voice-over text.' });
      return;
    }
    setIsGeneratingVoiceOver(true);
    try {
      const result = await generateVoiceOver({
        projectId,
        text,
        provider: voiceOverProvider,
        template: voiceOverTemplate.trim() || undefined,
      });
      setVoiceOverJobByShotId(prev => ({ ...prev, [shot.id]: result.job_id }));
      setVoiceOverStatusByShotId(prev => ({ ...prev, [shot.id]: result.status }));
      const audioUrl = resolveMaybeRelativeUrl(result.audio_url) ?? resolveMaybeRelativeUrl(result.audio_path);
      if (audioUrl) {
        setVoiceOverAudioByShotId(prev => ({ ...prev, [shot.id]: audioUrl }));
      } else {
        showToast({
          type: 'warning',
          title: 'Voice-over queued',
          message: `Job ${result.job_id} started (no audio URL yet).`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Voice-over failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingVoiceOver(false);
    }
  };

  const updateDialogueLine = (lineId: string, patch: Partial<DialogueLine>) => {
    setDialogueByShotId(prev => {
      const current = prev[shot.id] ?? [];
      const next = current.map(l => (l.id === lineId ? { ...l, ...patch } : l));
      return { ...prev, [shot.id]: next };
    });
  };

  const addDialogueLine = () => {
    setDialogueByShotId(prev => {
      const current = prev[shot.id] ?? [];
      const next: DialogueLine[] = [
        ...current,
        { id: makeLineId(), speaker: '', text: '', provider: 'piper', template: '' },
      ];
      return { ...prev, [shot.id]: next };
    });
  };

  const removeDialogueLine = (lineId: string) => {
    setDialogueByShotId(prev => {
      const current = prev[shot.id] ?? [];
      const next = current.filter(l => l.id !== lineId);
      return { ...prev, [shot.id]: next };
    });
  };

  const handleParseDialogue = () => {
    const parsed = parseDialogueFromText(shot.prompt || '');
    if (parsed.length === 0) {
      showToast({
        type: 'warning',
        title: 'No dialogue found',
        message: 'No quoted dialogue or "Speaker: line" patterns found in the shot prompt.',
      });
      return;
    }
    setDialogueByShotId(prev => ({ ...prev, [shot.id]: parsed }));
    showToast({ type: 'success', title: 'Dialogue parsed', message: `Found ${parsed.length} line(s).` });
  };

  const handleGenerateDialogueVoice = async (lineId: string) => {
    const line = dialogueLines.find(l => l.id === lineId);
    if (!line) return;
    const text = (line.text || '').trim();
    if (!text) {
      showToast({ type: 'error', title: 'Missing dialogue', message: 'Enter dialogue text.' });
      return;
    }
    setGeneratingDialogueLineId(lineId);
    try {
      const result = await generateVoiceOver({
        projectId,
        text,
        provider: line.provider,
        template: line.template || undefined,
      });
      const audioUrl = resolveMaybeRelativeUrl(result.audio_url) ?? resolveMaybeRelativeUrl(result.audio_path);
      updateDialogueLine(lineId, { jobId: result.job_id, status: result.status, audioUrl: audioUrl ?? undefined });
      if (!audioUrl) {
        showToast({
          type: 'warning',
          title: 'Voice queued',
          message: `Job ${result.job_id} started (no audio URL yet).`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Voice failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGeneratingDialogueLineId(null);
    }
  };

  const handleSaveDraft = () => {
    if (!onSave) return;
    onSave({
      prompt,
      negative_prompt,
      shot_type,
      angle,
      motion,
      duration,
      action,
      narration_text: narrationText,
      narration,
      internal_monologue: internalMonologue,
      dialogue,
      characters,
      environment,
      props,
      frame_prompt,
      video_prompt,
    });
    setIsDirty(false);
  };

  const handleNewVersion = () => {
    // Same as save draft for now in this context
    handleSaveDraft();
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-2">Primary Action</label>
        <textarea
          value={action}
          onChange={e => {
            setAction(e.target.value);
            setIsDirty(true);
          }}
          rows={3}
          className="comfy-input w-full text-sm resize-none"
          placeholder="What is happening in this shot?"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-2">Legacy Prompt / Description</label>
        <textarea
          value={prompt}
          onChange={e => {
            setPrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={2}
          className="comfy-input w-full text-xs text-comfy-muted resize-none opacity-80"
          placeholder="Describe the shot..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-comfy-text mb-2">Negative Prompt (Continuity Notes)</label>
        <textarea
          value={negative_prompt}
          onChange={e => {
            setNegativePrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={3}
          className="comfy-input w-full text-sm resize-none"
          placeholder="What to avoid..."
        />
      </div>

      <div className="border-t border-comfy-border pt-4">
        <h4 className="text-sm font-semibold text-comfy-text mb-3">Camera Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Shot Type</label>
            <select
              value={shot_type}
              onChange={e => {
                setShotType(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-xs"
            >
              <option value="">Select type...</option>
              {shotTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              {shot_type && !shotTypes.includes(shot_type) && (
                <option value={shot_type}>{shot_type} (Custom)</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Angle</label>
            <select
              value={angle}
              onChange={e => {
                setAngle(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-sm"
            >
              {angles.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              {angle && !angles.includes(angle) && (
                <option value={angle}>{angle} (Custom)</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Motion</label>
            <select
              value={motion}
              onChange={e => {
                setMotion(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-sm"
            >
              {motions.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {motion && !motions.includes(motion) && (
                <option value={motion}>{motion} (Custom)</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Duration (s)</label>
            <input
              type="number"
              value={duration}
              onChange={e => {
                setDuration(Number(e.target.value));
                setIsDirty(true);
              }}
              min={1}
              max={60}
              className="comfy-input w-full text-sm"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-comfy-border pt-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-3">Production Detail</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-comfy-text mb-1.5">Characters</label>
            <div className="flex flex-wrap gap-1.5">
              {characters.map((c, i) => (
                <span key={i} className="comfy-tag">{c}</span>
              ))}
              <input 
                className="comfy-input text-[10px] py-0.5 px-2 w-24" 
                placeholder="+ Add"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setCharacters([...characters, val]);
                      e.currentTarget.value = '';
                      setIsDirty(true);
                    }
                  }
                }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-comfy-text mb-1.5">Environment</label>
            <input 
              value={environment}
              onChange={e => { setEnvironment(e.target.value); setIsDirty(true); }}
              className="comfy-input w-full text-sm"
              placeholder="e.g. Sunny Beach, Interior Studio"
            />
          </div>
          <div>
            <label className="block text-xs text-comfy-text mb-1.5">Props</label>
            <div className="flex flex-wrap gap-1.5">
              {props.map((p, i) => (
                <span key={i} className="comfy-item-badge text-[10px]">{p}</span>
              ))}
              <input 
                className="comfy-input text-[10px] py-0.5 px-2 w-24" 
                placeholder="+ Add"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setProps([...props, val]);
                      e.currentTarget.value = '';
                      setIsDirty(true);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-comfy-border pt-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-3">Generation Prompts</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-1">Frame Prompt (Stills)</label>
            <textarea
              value={frame_prompt}
              onChange={e => {
                setFramePrompt(e.target.value);
                setIsDirty(true);
              }}
              rows={3}
              className="comfy-input w-full text-xs resize-none"
              placeholder="Detailed visual prompt for image generation..."
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-comfy-muted mb-1">Video Prompt (Motion)</label>
            <textarea
              value={video_prompt}
              onChange={e => {
                setVideoPrompt(e.target.value);
                setIsDirty(true);
              }}
              rows={3}
              className="comfy-input w-full text-xs resize-none"
              placeholder="Detailed motion prompt for video generation..."
            />
          </div>
        </div>
      </div>

      <div className="border-t border-comfy-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-comfy-text">Narration (Story)</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="comfy-btn text-xs disabled:opacity-50"
              onClick={handleGenerateNarration}
              disabled={!projectId || isGeneratingNarration || !narrationText.trim()}
              title="Generate narration audio from Narration (Story)"
            >
              {isGeneratingNarration ? 'Generating…' : 'Generate Narration'}
            </button>
            <button
              type="button"
              className="comfy-btn-secondary text-xs disabled:opacity-50"
              onClick={handleGenerateNarrationForAllShots}
              disabled={!projectId || isGeneratingNarrationAll || shots.length === 0}
              title="Generate narration audio for all shots that have Narration (Story)"
            >
              {isGeneratingNarrationAll ? 'Generating…' : 'Generate for all shots'}
            </button>
            <button
              type="button"
              className="comfy-btn-secondary text-xs disabled:opacity-50"
              onClick={() => {
                if (!narrationText.trim()) return;
                setNarration(narrationText);
                setIsDirty(true);
              }}
              disabled={!narrationText.trim()}
              title="Copy narration text into the Voice-over field"
            >
              Copy → Voice-over
            </button>
          </div>
        </div>

        <textarea
          value={narrationText}
          onChange={e => {
            setNarrationText(e.target.value);
            setIsDirty(true);
          }}
          rows={4}
          className="comfy-input w-full text-sm resize-none"
          placeholder="Story-faithful narration chunk (optional)..."
        />

        <div className="mt-3 flex items-center gap-2">
          {narrationJobId ? (
            <span className="text-xs text-comfy-muted">
              Job {narrationJobId.slice(0, 8)}… {narrationStatus || ''}
            </span>
          ) : null}
        </div>

        {narrationAudioUrl ? (
          <div className="mt-3 space-y-2">
            <audio controls src={narrationAudioUrl} className="w-full" />
            <a
              href={narrationAudioUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Download audio
            </a>
          </div>
        ) : null}
      </div>

      <div className="border-t border-comfy-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-comfy-text">Voice-over</h4>
          <button
            type="button"
            className="comfy-btn-secondary text-xs disabled:opacity-50"
            onClick={() => {
              if (narration.trim()) return;
              const next =
                (narrationText || '').trim() ||
                (shot.subtitle || '').trim() ||
                (shot.prompt || '').trim() ||
                '';
              setNarration(next);
              setIsDirty(true);
            }}
            disabled={Boolean(narration.trim())}
            title="Prefill from Narration (Story) or shot text"
          >
            Prefill
          </button>
        </div>

        <textarea
          value={narration}
          onChange={e => {
            setNarration(e.target.value);
            setIsDirty(true);
          }}
          rows={3}
          className="comfy-input w-full text-sm resize-none"
          placeholder={voiceOverPlaceholder}
        />

        <div className="mt-3 grid grid-cols-[160px_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Voice Provider</label>
            <select
              value={voiceOverProvider}
              onChange={e =>
                setVoiceOverProviderByShotId(prev => ({
                  ...prev,
                  [shot.id]: e.target.value as 'piper' | 'cosyvoice',
                }))
              }
            className="comfy-input w-full text-sm"
            title="Voice-over provider"
          >
            <option value="piper">Piper</option>
            <option value="cosyvoice">CosyVoice</option>
          </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Voice Template</label>
            <input
              value={voiceOverTemplate}
              onChange={e =>
                setVoiceOverTemplateByShotId(prev => ({
                  ...prev,
                  [shot.id]: e.target.value,
                }))
              }
              className="comfy-input w-full text-sm"
              placeholder={
                voiceOverProvider === 'piper' ? 'e.g. en_US-hfc_female-medium' : 'Optional template/voice'
              }
              title="Voice template override"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="comfy-btn disabled:opacity-50"
            onClick={handleGenerateVoiceOver}
            disabled={!projectId || isGeneratingVoiceOver || !narration.trim()}
          >
            {isGeneratingVoiceOver ? 'Generating…' : 'Generate Voice-over'}
          </button>
          {voiceOverJobId ? (
            <span className="text-xs text-comfy-muted">
              Job {voiceOverJobId.slice(0, 8)}… {voiceOverStatus || ''}
            </span>
          ) : null}
        </div>

        {voiceOverAudioUrl ? (
          <div className="mt-3 space-y-2">
            <audio controls src={voiceOverAudioUrl} className="w-full" />
            <a
              href={voiceOverAudioUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Download audio
            </a>
          </div>
        ) : null}
      </div>

      <div className="border-t border-comfy-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-comfy-text">Sound Effects</h4>
          <button
            type="button"
            className="comfy-btn-secondary text-xs disabled:opacity-50"
            onClick={() =>
              setSfxPromptByShotId(prev => ({ ...prev, [shot.id]: prev[shot.id] ?? sfxSuggestedPrompt }))
            }
            disabled={Boolean(sfxPromptByShotId[shot.id])}
            title="Prefill from shot context"
          >
            Prefill
          </button>
        </div>

        <textarea
          value={sfxPrompt}
          onChange={e => setSfxPromptByShotId(prev => ({ ...prev, [shot.id]: e.target.value }))}
          rows={3}
          className="comfy-input w-full text-sm resize-none"
          placeholder={sfxSuggestedPrompt}
        />

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="comfy-btn disabled:opacity-50"
            onClick={handleGenerateSfx}
            disabled={!projectId || isGeneratingSfx}
          >
            {isGeneratingSfx ? 'Generating…' : 'Generate SFX'}
          </button>
          {sfxJobId ? (
            <span className="text-xs text-comfy-muted">
              Job {sfxJobId.slice(0, 8)}… {sfxStatus || ''}
            </span>
          ) : null}
        </div>

        {sfxAudioUrl ? (
          <div className="mt-3 space-y-2">
            <audio controls src={sfxAudioUrl} className="w-full" />
            <a
              href={sfxAudioUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Download SFX
            </a>
          </div>
        ) : null}
      </div>

      <div className="border-t border-comfy-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-comfy-text">Dialogue</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="comfy-btn-secondary text-xs"
              onClick={handleParseDialogue}
              title="Parse dialogue from the shot prompt"
            >
              Parse
            </button>
            <button
              type="button"
              className="comfy-btn-secondary text-xs"
              onClick={addDialogueLine}
            >
              + Add line
            </button>
          </div>
        </div>

        {dialogueLines.length === 0 ? (
          <div className="text-xs text-comfy-muted">
            No dialogue lines yet. Click “Parse” or “+ Add line”.
          </div>
        ) : (
          <div className="space-y-3">
            {dialogueLines.map(line => (
              <div key={line.id} className="p-3 rounded bg-comfy-input-bg">
                <div className="flex items-center gap-2">
                  <input
                    value={line.speaker}
                    onChange={e => updateDialogueLine(line.id, { speaker: e.target.value })}
                    className="comfy-input text-sm w-40"
                    placeholder="Speaker"
                  />
                  <select
                    value={line.provider}
                    onChange={e =>
                      updateDialogueLine(line.id, { provider: e.target.value as DialogueLine['provider'] })
                    }
                    className="comfy-input text-sm w-40"
                    title="Voice type"
                  >
                    <option value="piper">Piper</option>
                    <option value="cosyvoice">CosyVoice</option>
                  </select>
                  <input
                    value={line.template}
                    onChange={e => updateDialogueLine(line.id, { template: e.target.value })}
                    className="comfy-input text-sm flex-1"
                    placeholder="Voice template (optional)"
                    title="TTS template/voice"
                  />
                  <button
                    type="button"
                    className="comfy-btn-secondary text-xs"
                    onClick={() => removeDialogueLine(line.id)}
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  value={line.text}
                  onChange={e => updateDialogueLine(line.id, { text: e.target.value })}
                  rows={2}
                  className="comfy-input w-full text-sm resize-none mt-2"
                  placeholder="Dialogue line..."
                />

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="comfy-btn text-xs disabled:opacity-50"
                    onClick={() => handleGenerateDialogueVoice(line.id)}
                    disabled={!projectId || generatingDialogueLineId === line.id}
                  >
                    {generatingDialogueLineId === line.id ? 'Generating…' : 'Generate Voice'}
                  </button>
                  {line.jobId ? (
                    <span className="text-xs text-comfy-muted">
                      Job {line.jobId.slice(0, 8)}… {line.status || ''}
                    </span>
                  ) : null}
                </div>

                {line.audioUrl ? (
                  <div className="mt-2">
                    <audio controls src={line.audioUrl} className="w-full" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-comfy-border pt-4 flex gap-2">
        <button
          onClick={handleSaveDraft}
          disabled={!isDirty || isMutating}
          className="comfy-btn-secondary disabled:opacity-50"
        >
          {isMutating ? 'Saving...' : 'Save Changes'}
        </button>
        <button 
           onClick={handleNewVersion} 
           className="comfy-btn"
           disabled={isMutating}
        >
          Commit Version
        </button>
        <button
          onClick={() => {
            setPrompt(shot.prompt);
            setNegativePrompt(shot.negative_prompt);
            setShotType(shot.shot_type);
            setAngle(shot.angle);
            setMotion(shot.motion);
            setDuration(shot.duration);
            setIsDirty(false);
          }}
          className="px-3 py-2 text-sm text-comfy-muted hover:text-comfy-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
