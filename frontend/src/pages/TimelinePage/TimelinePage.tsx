import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from './VideoPlayer';
import { TimelineTrack } from './TimelineTrack';
import { API_BASE_URL, fetchProjectAssets } from '../../lib/api';

interface TimelinePageProps {
  projectId: string;
}

export interface Clip {
  id: string;
  name: string;
  duration: number;
  thumbnail: string;
  type: 'video' | 'audio' | 'image';
  assetType: string;
}

export function TimelinePage({ projectId }: TimelinePageProps) {
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const outputsQuery = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/outputs`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
  });

  const assetsQuery = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
  });

  const outputs = outputsQuery.data || [];
  const scenes = assetsQuery.data?.filter((a: any) => a.asset_type === 'scene') || [];
  const shotPlans = assetsQuery.data?.filter((a: any) => a.asset_type === 'shot_plan') || [];

  const clips: Clip[] = [
    ...scenes.map((s: any) => ({
      id: s.id,
      name: s.title || 'Untitled Scene',
      duration: 5,
      thumbnail: '',
      type: 'video' as const,
      assetType: 'scene',
    })),
    ...shotPlans.map((p: any) => ({
      id: p.id,
      name: p.title || 'Untitled Shot',
      duration: 3,
      thumbnail: '',
      type: 'video' as const,
      assetType: 'shot_plan',
    })),
  ];

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
  const selectedOutput = outputs.find((o: any) => o.id === selectedOutputId) || outputs[0];

  const handlePlay = () => setIsPlaying(!isPlaying);
  const handleSeek = (time: number) => setCurrentTime(time);
  const handleExport = () => console.log('Export:', selectedOutputId);

  if (!projectId) {
    return <div className="p-4 text-[var(--text-muted)]">No project selected</div>;
  }

  if (outputsQuery.isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  if (outputs.length === 0) {
    return (
      <div className="flex flex-col h-full comfy-bg-primary items-center justify-center">
        <p className="text-[var(--text-muted)]">No outputs yet.</p>
        <p className="text-sm text-[var(--text-muted)]">
          Create an output in the Outputs tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full comfy-bg-primary overflow-hidden">
      <div className="h-14 px-4 flex items-center justify-between border-b border-comfy-border bg-comfy-input-bg flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-comfy-text">Timeline & Preview</h2>
          <select
            value={selectedOutputId || outputs[0]?.id || ''}
            onChange={e => setSelectedOutputId(e.target.value)}
            className="comfy-input text-sm"
          >
            {outputs.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.title} ({o.output_type})
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
          <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {selectedClipId ? (
              <div className="text-center">
                <p className="text-lg mb-2 text-white">
                  {clips.find(c => c.id === selectedClipId)?.name}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Type: {clips.find(c => c.id === selectedClipId)?.assetType}
                </p>
              </div>
            ) : (
              <div className="text-center text-[var(--text-muted)]">
                <p className="text-lg mb-2">Preview Area</p>
                <p className="text-sm">Select a clip to preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-[2] border-l border-comfy-border p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-comfy-text mb-3">Timeline</h3>
          <div className="flex-1 overflow-auto">
            <TimelineTrack
              clips={clips}
              currentTime={currentTime}
              duration={totalDuration}
              onSeek={handleSeek}
            />
          </div>

          <div className="mt-4 overflow-auto flex-1">
            <h4 className="text-xs font-medium text-comfy-muted uppercase mb-2">
              Clips ({clips.length})
            </h4>
            <div className="space-y-2 pb-4">
              {clips.map(clip => (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClipId(clip.id)}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    selectedClipId === clip.id
                      ? 'bg-comfy-selection-bg'
                      : 'bg-comfy-input-bg hover:bg-comfy-highlight'
                  }`}
                >
                  <div className="w-12 h-8 bg-comfy-border rounded flex items-center justify-center">
                    <span className="text-xs text-comfy-muted">
                      {clip.assetType === 'scene' ? 'S' : 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-comfy-text truncate">{clip.name}</div>
                    <div className="text-xs text-comfy-muted">{clip.duration}s</div>
                  </div>
                </div>
              ))}
              {clips.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">No clips. Run a workflow.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-comfy-border">
            <div className="text-sm text-[var(--text-muted)]">
              <div>Clips: {clips.length}</div>
              <div>Duration: {totalDuration}s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
