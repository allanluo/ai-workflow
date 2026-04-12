import { ShotListPanel } from './ShotListPanel';
import { ShotEditor } from './ShotEditor';
import { PreviewStack } from './PreviewStack';
import { ShotToolbar } from './ShotToolbar';
import { useSelectionStore } from '../../stores';

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

const mockShots: Shot[] = [
  {
    id: 's1',
    title: 'Shot 1',
    subtitle: 'Establishing shot of city',
    thumbnail: '',
    status: 'approved',
    sceneId: 'sc1',
    prompt: 'A wide shot of a futuristic city at sunset',
    negativePrompt: 'blurry, low quality',
    shotType: 'Wide',
    angle: 'High',
    motion: 'Static',
    duration: 5,
  },
  {
    id: 's2',
    title: 'Shot 2',
    subtitle: 'Character walking',
    thumbnail: '',
    status: 'draft',
    sceneId: 'sc1',
    prompt: 'A character walking down a street',
    negativePrompt: '',
    shotType: 'Medium',
    angle: 'Eye Level',
    motion: 'Tracking',
    duration: 3,
  },
  {
    id: 's3',
    title: 'Shot 3',
    subtitle: 'Close-up reaction',
    thumbnail: '',
    status: 'warning',
    sceneId: 'sc2',
    prompt: 'Close-up of character reaction',
    negativePrompt: 'distorted face',
    shotType: 'Close-up',
    angle: 'Low',
    motion: 'Static',
    duration: 2,
  },
];

export function ShotsPage({ projectId }: ShotsPageProps) {
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedShot = mockShots.find(s => s.id === selectedShotId) || mockShots[0];

  return (
    <div className="flex flex-col h-full comfy-bg-primary">
      <ShotToolbar projectId={projectId} shot={selectedShot} />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] border-r border-comfy-border flex-shrink-0 overflow-hidden">
          <ShotListPanel shots={mockShots} projectId={projectId} />
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
