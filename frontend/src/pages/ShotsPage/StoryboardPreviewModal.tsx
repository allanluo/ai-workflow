import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Shot } from './ShotsPage';
import { API_BASE_URL } from '../../lib/api';
import { useQuickExport, type StoryboardExportSegment } from '../../lib/api/useQuickExport';

interface StoryboardPreviewModalProps {
  shots: Shot[];
  projectId: string;
  initialShotId?: string;
  onClose: () => void;
}

type MediaMap = Record<string, { imageUrl?: string; videoUrl?: string }>; // shotId -> media
type StoredAudioMap = Record<string, { audioUrl?: string }>;

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

const getStoredMap = (storageKey: string) => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && 'items' in parsed ? (parsed.items ?? {}) : parsed;
  } catch {
    return null;
  }
};

const getStoredMediaMap = (projectId: string): MediaMap => {
  try {
    let storageKey = `aiwf:shotMedia:${projectId}`;
    let raw = window.localStorage.getItem(storageKey);
    
    if (!raw) {
      const allKeys = Object.keys(localStorage);
      const altKey = allKeys.find(k => k.includes('shotMedia') && k.includes(projectId));
      if (altKey) {
        raw = localStorage.getItem(altKey);
      }
    }

    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && 'items' in parsed) ? (parsed.items ?? {}) : parsed;
  } catch {
    return {};
  }
};

const getStoredShotAudioMap = (projectId: string): StoredAudioMap => {
  const next: StoredAudioMap = {};

  const narrationItems = getStoredMap(`aiwf:shotNarrationAudio:${projectId}`);
  if (narrationItems && typeof narrationItems === 'object') {
    for (const [shotId, item] of Object.entries(narrationItems as Record<string, unknown>)) {
      if (!item || typeof item !== 'object') continue;
      const url =
        resolveMaybeRelativeUrl((item as Record<string, unknown>).audioUrl) ??
        resolveMaybeRelativeUrl((item as Record<string, unknown>).audio_url);
      if (url) next[shotId] = { audioUrl: url };
    }
  }

  const voiceOverItems = getStoredMap(`aiwf:shotVoiceover:${projectId}`);
  if (voiceOverItems && typeof voiceOverItems === 'object') {
    for (const [shotId, item] of Object.entries(voiceOverItems as Record<string, unknown>)) {
      if (!item || typeof item !== 'object') continue;
      const url =
        resolveMaybeRelativeUrl((item as Record<string, unknown>).audioUrl) ??
        resolveMaybeRelativeUrl((item as Record<string, unknown>).audio_url);
      if (url) next[shotId] = { audioUrl: url };
    }
  }

  return next;
};

export function StoryboardPreviewModal({
  shots,
  projectId,
  initialShotId,
  onClose,
}: StoryboardPreviewModalProps) {
  const { handleStoryboardExport, isExporting, activeJob } = useQuickExport(projectId);
  const mediaMap = useMemo(() => getStoredMediaMap(projectId), [projectId]);
  const audioMap = useMemo(() => getStoredShotAudioMap(projectId), [projectId]);
  const [preferredView, setPreferredView] = useState<'image' | 'video' | 'slideshow'>('image');
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);

  const initialIndex = useMemo(() => {
    if (!initialShotId) return 0;
    const idx = shots.findIndex(s => s.id === initialShotId);
    return idx >= 0 ? idx : 0;
  }, [shots, initialShotId]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const filmStripRef = useRef<HTMLDivElement>(null);
  const activeShot = shots[activeIndex];

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(shots.length - 1, index));
      setActiveIndex(clamped);
    },
    [shots.length]
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const strip = filmStripRef.current;
    if (!strip) return;
    const thumb = strip.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  const imageUrl = activeShot ? mediaMap[activeShot.id]?.imageUrl : undefined;
  const videoUrl = activeShot ? mediaMap[activeShot.id]?.videoUrl : undefined;
  const audioUrl = activeShot ? audioMap[activeShot.id]?.audioUrl : undefined;
  const audioRef = useRef<HTMLAudioElement>(null);
  const exportSegments = useMemo(() => {
    const segments: StoryboardExportSegment[] = [];
    for (const shot of shots) {
      const media = mediaMap[shot.id];
      const image = resolveMaybeRelativeUrl(media?.imageUrl);
      const video = resolveMaybeRelativeUrl(media?.videoUrl);
      const audio = resolveMaybeRelativeUrl(audioMap[shot.id]?.audioUrl);
      if (!image && !video) continue;
      segments.push({
        shot_id: shot.id,
        title: shot.title || undefined,
        image_url: image ?? undefined,
        video_url: video ?? undefined,
        audio_url: audio ?? undefined,
        duration_seconds: audio ? undefined : 3,
      });
    }
    return segments;
  }, [audioMap, mediaMap, shots]);
  const canExportNarratedPreview = exportSegments.length > 0;
  const completedExportDownloadUrl =
    activeJob?.status === 'completed' ? `${API_BASE_URL}/exports/${activeJob.id}/download` : null;

  const hasAnyAudio = useMemo(() => shots.some(shot => Boolean(audioMap[shot.id]?.audioUrl)), [audioMap, shots]);
  const currentView =
    preferredView === 'video' && videoUrl
      ? 'video'
      : preferredView === 'slideshow'
        ? 'slideshow'
        : 'image';

  useEffect(() => {
    if (preferredView !== 'slideshow') {
      setIsSlideshowPlaying(false);
      audioRef.current?.pause();
      return;
    }
    if (!isSlideshowPlaying) {
      audioRef.current?.pause();
      return;
    }
    if (!audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      setIsSlideshowPlaying(false);
    });
  }, [activeIndex, audioUrl, isSlideshowPlaying, preferredView]);

  useEffect(() => {
    if (preferredView !== 'slideshow' || !isSlideshowPlaying || audioUrl) return;
    if (activeIndex >= shots.length - 1) {
      setIsSlideshowPlaying(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex(index => Math.min(shots.length - 1, index + 1));
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, audioUrl, isSlideshowPlaying, preferredView, shots.length]);

  // Group shots by scene for display in film strip
  const sceneGroups = useMemo(() => {
    const groups: { sceneId: string; shots: { shot: Shot; index: number }[] }[] = [];
    let currentGroup: { sceneId: string; shots: { shot: Shot; index: number }[] } | null = null;
    shots.forEach((shot, index) => {
      if (!currentGroup || currentGroup.sceneId !== shot.sceneId) {
        currentGroup = { sceneId: shot.sceneId || `Scene ${index + 1}`, shots: [] };
        groups.push(currentGroup);
      }
      currentGroup.shots.push({ shot, index });
    });
    return groups;
  }, [shots]);

  const handleExportNarratedPreview = useCallback(async () => {
    await handleStoryboardExport({
      title: `Narration Preview ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      segments: exportSegments,
    });
  }, [exportSegments, handleStoryboardExport]);

  const content = (
    <div
      className="fixed inset-0 z-[2000] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.97)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(91,141,239,1)" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5" />
          </svg>
          <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>Storyboard Preview</span>
          <span style={{ color: '#555', fontSize: 13 }}>·</span>
          <span style={{ color: '#777', fontSize: 13 }}>
            Shot {activeIndex + 1} of {shots.length}
          </span>
          {(videoUrl || hasAnyAudio) && (
            <>
              <span style={{ color: '#555', fontSize: 13 }}>·</span>
              <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                <button
                  onClick={() => setPreferredView('image')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    borderRadius: 6,
                    background: preferredView === 'image' ? 'rgba(91,141,239,1)' : 'transparent',
                    color: preferredView === 'image' ? '#fff' : '#888',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Image
                </button>
                {videoUrl ? (
                  <button
                    onClick={() => setPreferredView('video')}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      background: preferredView === 'video' ? 'rgba(91,141,239,1)' : 'transparent',
                      color: preferredView === 'video' ? '#fff' : '#888',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Video
                  </button>
                ) : null}
                {hasAnyAudio ? (
                  <button
                    onClick={() => setPreferredView('slideshow')}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      background: preferredView === 'slideshow' ? 'rgba(91,141,239,1)' : 'transparent',
                      color: preferredView === 'slideshow' ? '#fff' : '#888',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Slideshow
                  </button>
                ) : null}
              </div>
              {preferredView === 'video' && videoUrl ? (
                <>
                  <span style={{ color: '#555', fontSize: 13 }}>·</span>
                  <button
                    onClick={() => setIsAutoPlay(!isAutoPlay)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      background: isAutoPlay ? 'rgba(91,141,239,1)' : 'rgba(255,255,255,0.06)',
                      color: isAutoPlay ? '#fff' : '#888',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {isAutoPlay ? 'Auto-play ON' : 'Auto-play OFF'}
                  </button>
                </>
              ) : null}
              {preferredView === 'slideshow' && hasAnyAudio ? (
                <>
                  <span style={{ color: '#555', fontSize: 13 }}>·</span>
                  <button
                    onClick={() => setIsSlideshowPlaying(playing => !playing)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      background: isSlideshowPlaying ? 'rgba(91,141,239,1)' : 'rgba(255,255,255,0.06)',
                      color: isSlideshowPlaying ? '#fff' : '#888',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      {isSlideshowPlaying ? (
                        <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                      ) : (
                        <polygon points="5 3 19 12 5 21 5 3" />
                      )}
                    </svg>
                    {isSlideshowPlaying ? 'Pause' : 'Play'}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {completedExportDownloadUrl ? (
            <a
              href={completedExportDownloadUrl}
              style={{
                background: 'rgba(34,197,94,0.16)',
                border: '1px solid rgba(34,197,94,0.35)',
                borderRadius: 8,
                color: '#86efac',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Download MP4
            </a>
          ) : null}
          <button
            onClick={() => {
              void handleExportNarratedPreview();
            }}
            disabled={!canExportNarratedPreview || isExporting}
            style={{
              background: !canExportNarratedPreview
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(91,141,239,0.18)',
              border: '1px solid rgba(91,141,239,0.35)',
              borderRadius: 8,
              color: !canExportNarratedPreview ? '#666' : '#cddcff',
              padding: '6px 12px',
              cursor: !canExportNarratedPreview || isExporting ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            {isExporting
              ? `Exporting${activeJob ? ` ${Math.max(0, Math.round(activeJob.progress || 0))}%` : '...'}`
              : 'Export Narration Preview'}
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#aaa',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Main viewer area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-16">
        {/* Prev button */}
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          style={{
            position: 'absolute',
            left: 16,
            zIndex: 10,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: activeIndex === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: activeIndex === 0 ? '#333' : '#ccc',
            cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { if (activeIndex > 0) (e.currentTarget.style.background = 'rgba(91,141,239,0.3)'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = activeIndex === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)'); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Main image card */}
        <div
          style={{
            maxWidth: 900,
            width: '100%',
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            aspectRatio: '16/9',
            background: '#0a0a0a',
          }}
        >
          {currentView === 'video' && videoUrl ? (
            <video
              key={`vid-${activeShot?.id}`}
              src={videoUrl}
              autoPlay
              controls
              onEnded={() => {
                if (isAutoPlay && activeIndex < shots.length - 1) {
                  goNext();
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
            />
          ) : imageUrl ? (
            <img
              key={`img-${activeShot?.id}`}
              src={imageUrl}
              alt={activeShot?.title || 'Shot'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                animation: 'fadeInFast 0.2s ease',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ color: '#444', fontSize: 13 }}>No preview generated yet</span>
            </div>
          )}

          {/* Caption bar at bottom of image */}
          {activeShot && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '32px 20px 16px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    background: 'rgba(91,141,239,0.9)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                  }}
                >
                  {activeShot.sceneId || 'Scene'}
                </span>
                <span style={{ color: '#ccc', fontSize: 14, fontWeight: 600 }}>{activeShot.title}</span>
              </div>
              {activeShot.subtitle && (
                <p style={{ color: '#999', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  {activeShot.subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {currentView === 'slideshow' ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 24,
              transform: 'translateX(-50%)',
              width: 'min(900px, calc(100% - 160px))',
              zIndex: 12,
            }}
          >
            <div
              style={{
                background: 'rgba(8,8,12,0.88)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ color: '#e0e0e0', fontSize: 12, fontWeight: 600 }}>Shot Audio</div>
                  <div style={{ color: '#777', fontSize: 11 }}>
                    {audioUrl ? 'Voice-over / narration loaded for this shot' : 'No shot audio found; advancing on timer'}
                  </div>
                </div>
                <div style={{ color: '#777', fontSize: 11 }}>
                  {isSlideshowPlaying ? 'Slideshow active' : 'Slideshow paused'}
                </div>
              </div>
              {audioUrl ? (
                <audio
                  ref={audioRef}
                  key={`audio-${activeShot?.id}`}
                  src={audioUrl}
                  controls
                  onEnded={() => {
                    if (!isSlideshowPlaying) return;
                    if (activeIndex < shots.length - 1) {
                      goNext();
                    } else {
                      setIsSlideshowPlaying(false);
                    }
                  }}
                  className="w-full"
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Next button */}
        <button
          onClick={goNext}
          disabled={activeIndex === shots.length - 1}
          style={{
            position: 'absolute',
            right: 16,
            zIndex: 10,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: activeIndex === shots.length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: activeIndex === shots.length - 1 ? '#333' : '#ccc',
            cursor: activeIndex === shots.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { if (activeIndex < shots.length - 1) (e.currentTarget.style.background = 'rgba(91,141,239,0.3)'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = activeIndex === shots.length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)'); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Film strip */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.7)',
          padding: '12px 16px',
        }}
      >
        <div
          ref={filmStripRef}
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'thin',
            scrollbarColor: '#333 transparent',
          }}
        >
          {sceneGroups.map(group => (
            <div key={group.sceneId} style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <span style={{ color: '#555', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 2 }}>
                {group.sceneId}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {group.shots.map(({ shot, index }) => {
                  const thumb = mediaMap[shot.id]?.imageUrl;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={shot.id}
                      data-index={index}
                      onClick={() => goTo(index)}
                      style={{
                        width: 96,
                        height: 54,
                        borderRadius: 6,
                        overflow: 'hidden',
                        border: isActive
                          ? '2px solid rgba(91,141,239,1)'
                          : '2px solid rgba(255,255,255,0.07)',
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'border-color 0.15s ease',
                        background: '#111',
                        boxShadow: isActive ? '0 0 12px rgba(91,141,239,0.5)' : 'none',
                      }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={shot.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#111',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                      )}
                      {/* Shot number badge */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 3,
                          background: 'rgba(0,0,0,0.7)',
                          color: isActive ? 'rgba(91,141,239,1)' : '#888',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: 3,
                          fontFamily: 'monospace',
                        }}
                      >
                        {index + 1}
                      </div>
                      {/* Video indicator */}
                      {mediaMap[shot.id]?.videoUrl && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 3,
                            background: 'rgba(91,141,239,0.8)',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          VIDEO
                        </div>
                      )}
                      {audioMap[shot.id]?.audioUrl ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: 3,
                            background: 'rgba(0,0,0,0.72)',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 10v4h4l5 4V6L7 10H3z" />
                          </svg>
                          AUDIO
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard hint */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          padding: '6px 0 8px',
          background: 'rgba(0,0,0,0.7)',
        }}
      >
        {[
          { key: '←', label: 'Prev' },
          { key: '→', label: 'Next' },
          { key: 'Esc', label: 'Close' },
        ].map(({ key, label }) => (
          <span key={key} style={{ color: '#444', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 10,
                color: '#666',
                fontFamily: 'monospace',
              }}
            >
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes fadeInFast {
          from { opacity: 0; transform: scale(1.01); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
