import type { Clip } from './TimelinePage';

interface TimelineTrackProps {
  clips: Clip[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function TimelineTrack({ clips, currentTime, duration, onSeek }: TimelineTrackProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  let accumulatedTime = 0;
  const clipPositions = clips.map(clip => {
    const startPercent = (accumulatedTime / duration) * 100;
    const widthPercent = (clip.duration / duration) * 100;
    accumulatedTime += clip.duration;
    return { ...clip, startPercent, widthPercent };
  });

  return (
    <div className="relative">
      <div className="flex justify-between text-xs text-comfy-muted mb-2">
        <span>0:00</span>
        <span>0:{Math.floor(duration / 4)}</span>
        <span>0:{Math.floor(duration / 2)}</span>
        <span>0:{Math.floor((duration * 3) / 4)}</span>
        <span>
          {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
        </span>
      </div>

      <div className="relative h-16 bg-comfy-input-bg rounded border border-comfy-border">
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-comfy-accent z-10"
          style={{ left: `${progress}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-comfy-accent rounded-full" />
        </div>

        <div className="absolute inset-0 flex items-center gap-1 p-2">
          {clipPositions.map(clip => (
            <div
              key={clip.id}
              onClick={() => onSeek((clip.startPercent / 100) * duration)}
              className="h-12 rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                position: 'absolute',
                left: `${clip.startPercent}%`,
                width: `${clip.widthPercent}%`,
                background:
                  clip.type === 'video' ? '#3b82f6' : clip.type === 'audio' ? '#8b5cf6' : '#10b981',
              }}
            >
              <div className="h-full flex items-center justify-center">
                <span className="text-xs text-white font-medium truncate px-2">{clip.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-xs text-comfy-muted">Video</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-500 rounded" />
          <span className="text-xs text-comfy-muted">Audio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-xs text-comfy-muted">Image</span>
        </div>
      </div>
    </div>
  );
}
