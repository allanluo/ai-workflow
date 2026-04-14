import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProjectAssets } from '../../lib/api';
import { ShotListPanel } from './ShotListPanel';
import { ShotEditor } from './ShotEditor';
import { PreviewStack } from './PreviewStack';
import { ShotToolbar } from './ShotToolbar';

interface ShotsPageProps {
  projectId: string;
}

interface Shot {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  status: 'approved' | 'draft' | 'warning';
  sceneId: string;
  prompt: string;
  negativePrompt: string;
  shotType: string;
  angle: string;
  motion: string;
  duration: number;
}

export function ShotsPage({ projectId }: ShotsPageProps) {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const shotsQuery = useQuery({
    queryKey: ['project-assets', projectId, 'shot'],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    select: assets => assets.filter(a => a.asset_type === 'shot_plan'),
  });

  const shots: Shot[] = (shotsQuery.data || []).map((asset, index) => {
    const content = asset.current_version?.content as { text?: string } | undefined;
    return {
      id: asset.id,
      title: asset.title || `Shot ${index + 1}`,
      subtitle: content?.text?.slice(0, 100) || 'No description',
      thumbnail: '',
      status:
        asset.approval_state === 'approved'
          ? 'approved'
          : asset.approval_state === 'pending'
            ? 'warning'
            : 'draft',
      sceneId: '',
      prompt: content?.text || '',
      negativePrompt: '',
      shotType: '',
      angle: '',
      motion: '',
      duration: 0,
    };
  });

  const selectedShot = shots.find(s => s.id === selectedShotId) ||
    shots[0] || {
      id: '',
      title: 'No Shots',
      subtitle: 'Run a workflow to generate shot plans',
      thumbnail: '',
      status: 'draft' as const,
      sceneId: '',
      prompt: '',
      negativePrompt: '',
      shotType: '',
      angle: '',
      motion: '',
      duration: 0,
    };

  if (!projectId) {
    return <div className="p-4 text-[var(--text-muted)]">No project selected</div>;
  }

  if (shotsQuery.isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full comfy-bg-primary">
      <ShotToolbar projectId={projectId} shot={selectedShot} />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] border-r border-comfy-border flex-shrink-0 overflow-hidden">
          <ShotListPanel
            shots={shots}
            projectId={projectId}
            selectedShotId={selectedShotId}
            onSelectShot={setSelectedShotId}
          />
        </div>
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-comfy-border overflow-auto p-4">
            <ShotEditor shot={selectedShot} />
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PreviewStack shot={selectedShot} />
          </div>
        </div>
      </div>
    </div>
  );
}

export type { Shot };
