import { useRef, useEffect } from 'react';

interface VideoPlayerProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onSeek: (time: number) => void;
}

export function VideoPlayer({
  currentTime,
  duration,
  isPlaying,
  onPlay,
  onSeek,
}: VideoPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Video Area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full aspect-video bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-400 mb-2">Video Preview</div>
            <div className="text-xs text-slate-500">No video loaded</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 p-3 space-y-2">
        {/* Progress Bar */}
        <div
          onClick={handleProgressClick}
          className="h-1.5 bg-slate-600 rounded cursor-pointer group relative"
        >
          <div
            className="h-full bg-blue-500 rounded transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onPlay}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-slate-700 rounded"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span className="text-xs text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-slate-400 hover:text-white p-1">🔊</button>
            <button className="text-slate-400 hover:text-white p-1">⛶</button>
            <button className="text-slate-400 hover:text-white p-1">⚙</button>
          </div>
        </div>
      </div>
    </div>
  );
}
