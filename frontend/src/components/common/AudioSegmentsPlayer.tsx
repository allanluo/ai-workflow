import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';

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

type AudioSegment = {
  audio_url?: unknown;
  audioUrl?: unknown;
  audio_path?: unknown;
  audioPath?: unknown;
  text_used?: unknown;
  textUsed?: unknown;
};

export function AudioSegmentsPlayer({
  segments,
  fallbackUrl,
  className = '',
}: {
  segments: unknown;
  fallbackUrl?: string | null;
  className?: string;
}) {
  const resolvedSegments = useMemo(() => {
    if (!Array.isArray(segments)) return [];
    return (segments as AudioSegment[])
      .map((segment, index) => {
        const url =
          resolveMaybeRelativeUrl(segment.audio_url) ??
          resolveMaybeRelativeUrl(segment.audioUrl) ??
          resolveMaybeRelativeUrl(segment.audio_path) ??
          resolveMaybeRelativeUrl(segment.audioPath);
        if (!url) return null;
        const text =
          typeof segment.text_used === 'string'
            ? segment.text_used
            : typeof segment.textUsed === 'string'
              ? segment.textUsed
              : null;
        return { index, url, text };
      })
      .filter(Boolean) as Array<{ index: number; url: string; text: string | null }>;
  }, [segments]);

  const urls = resolvedSegments.map(s => s.url);
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayNextRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(0);
  }, [urls.join('|')]);

  useEffect(() => {
    if (!autoPlayNextRef.current) return;
    autoPlayNextRef.current = false;
    audioRef.current?.play().catch(() => {});
  }, [currentIndex]);

  if (urls.length === 0) {
    if (!fallbackUrl) return null;
    return (
      <div className={className}>
        <audio src={fallbackUrl} controls className="w-full" />
      </div>
    );
  }

  const onPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const onNext = () => setCurrentIndex(i => Math.min(urls.length - 1, i + 1));
  const onEnded = () => {
    if (currentIndex >= urls.length - 1) return;
    autoPlayNextRef.current = true;
    setCurrentIndex(i => Math.min(urls.length - 1, i + 1));
  };

  const currentUrl = urls[currentIndex]!;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Audio Segments ({urls.length})
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex === urls.length - 1}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <audio ref={audioRef} src={currentUrl} controls onEnded={onEnded} className="w-full" />
        <div className="mt-2 text-[11px] text-slate-500 break-all">{currentUrl}</div>
      </div>

      {urls.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {resolvedSegments.map(segment => (
            <button
              key={segment.index}
              type="button"
              onClick={() => setCurrentIndex(segment.index)}
              className={`rounded-full border px-2 py-1 text-xs ${
                segment.index === currentIndex
                  ? 'border-slate-300 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              title={segment.text ?? undefined}
              aria-current={segment.index === currentIndex ? 'true' : undefined}
            >
              {segment.index + 1}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

