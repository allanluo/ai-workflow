import { useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { TimelineTrack } from './TimelineTrack';

interface TimelinePageProps {
  projectId: string;
}

export interface Clip {
  id: string;
  name: string;
  duration: number;
  thumbnail: string;
  type: 'video' | 'audio' | 'image';
}

const mockClips: Clip[] = [
  { id: 'c1', name: 'Opening Scene', duration: 5, thumbnail: '', type: 'video' },
  { id: 'c2', name: 'Dialogue A', duration: 8, thumbnail: '', type: 'video' },
  { id: 'c3', name: 'B-Roll City', duration: 4, thumbnail: '', type: 'video' },
  { id: 'c4', name: 'Closing Shot', duration: 3, thumbnail: '', type: 'video' },
];

const mockOutputs = [
  { id: 'o1', name: 'Main Export', duration: 20, createdAt: '2 hours ago' },
  { id: 'o2', name: 'Preview Draft', duration: 20, createdAt: 'Yesterday' },
];

export function TimelinePage({ projectId }: TimelinePageProps) {
  const [selectedOutputId, setSelectedOutputId] = useState(mockOutputs[0].id);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const selectedOutput = mockOutputs.find(o => o.id === selectedOutputId)!;

  const handlePlay = () => setIsPlaying(!isPlaying);
  const handleSeek = (time: number) => setCurrentTime(time);
  const handleExport = () => console.log('Export:', selectedOutputId);

  return (
    <div className="flex flex-col h-full comfy-bg-primary">
      <div className="h-14 px-4 flex items-center justify-between border-b border-comfy-border bg-comfy-input-bg flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-comfy-text">Timeline & Preview</h2>
          <select
            value={selectedOutputId}
            onChange={e => setSelectedOutputId(e.target.value)}
            className="comfy-input text-sm"
          >
            {mockOutputs.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="comfy-btn-secondary">Preview</button>
          <button onClick={handleExport} className="comfy-btn">
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-[3] p-4 flex flex-col">
          <div className="flex-1 bg-black rounded-lg overflow-hidden">
            <VideoPlayer
              currentTime={currentTime}
              duration={selectedOutput.duration}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onSeek={handleSeek}
            />
          </div>
        </div>

        <div className="flex-[2] border-l border-comfy-border p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-comfy-text mb-3">Timeline</h3>
          <div className="flex-1 overflow-auto">
            <TimelineTrack
              clips={mockClips}
              currentTime={currentTime}
              duration={selectedOutput.duration}
              onSeek={handleSeek}
            />
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-medium text-comfy-muted uppercase mb-2">Clips</h4>
            <div className="space-y-2">
              {mockClips.map(clip => (
                <div
                  key={clip.id}
                  className="flex items-center gap-3 p-2 rounded bg-comfy-input-bg hover:bg-comfy-highlight cursor-pointer"
                >
                  <div className="w-12 h-8 bg-comfy-border rounded flex items-center justify-center">
                    <span className="text-xs text-comfy-muted">▶</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-comfy-text truncate">{clip.name}</div>
                    <div className="text-xs text-comfy-muted">{clip.duration}s</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
