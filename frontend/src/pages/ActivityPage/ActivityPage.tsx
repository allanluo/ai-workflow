import { useState } from 'react';
import { RunsTable } from './RunsTable';
import { RunDetailPanel } from './RunDetailPanel';
import { ExportJobsList } from './ExportJobsList';
import { useSelectionStore } from '../../stores';

interface ActivityPageProps {
  projectId: string;
}

interface WorkflowRun {
  id: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  duration: string;
  progress: number;
}

interface NodeRun {
  id: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  duration: string;
  logs: string[];
}

interface ExportJob {
  id: string;
  format: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
}

const mockRuns: WorkflowRun[] = [
  {
    id: 'r1',
    workflowName: 'Image Generation',
    status: 'completed',
    startedAt: '2 hours ago',
    duration: '45s',
    progress: 100,
  },
  {
    id: 'r2',
    workflowName: 'Video Pipeline',
    status: 'running',
    startedAt: '10 min ago',
    duration: '-',
    progress: 65,
  },
  {
    id: 'r3',
    workflowName: 'Scene Render',
    status: 'failed',
    startedAt: 'Yesterday',
    duration: '2m 30s',
    progress: 0,
  },
  {
    id: 'r4',
    workflowName: 'Shot Batch Gen',
    status: 'completed',
    startedAt: 'Yesterday',
    duration: '5m 12s',
    progress: 100,
  },
];

const mockNodeRuns: NodeRun[] = [
  {
    id: 'n1',
    nodeName: 'Load Sources',
    status: 'completed',
    startedAt: '10:30:00',
    duration: '2s',
    logs: ['Loading sources...', 'Sources loaded: 5 files'],
  },
  {
    id: 'n2',
    nodeName: 'Generate Image',
    status: 'running',
    startedAt: '10:30:02',
    duration: '-',
    logs: ['Calling image service...', 'Processing prompt...'],
  },
  {
    id: 'n3',
    nodeName: 'Apply Styles',
    status: 'pending',
    startedAt: '-',
    duration: '-',
    logs: [],
  },
  { id: 'n4', nodeName: 'Save Output', status: 'pending', startedAt: '-', duration: '-', logs: [] },
];

const mockExportJobs: ExportJob[] = [
  { id: 'e1', format: 'MP4 1080p', status: 'completed', progress: 100, createdAt: '1 hour ago' },
  { id: 'e2', format: 'MOV 4K', status: 'processing', progress: 45, createdAt: '30 min ago' },
  { id: 'e3', format: 'GIF Loop', status: 'queued', progress: 0, createdAt: '5 min ago' },
];

export function ActivityPage({ projectId }: ActivityPageProps) {
  const [activeTab, setActiveTab] = useState<'runs' | 'jobs'>('runs');
  const selectedRunId = useSelectionStore(s => s.selectedWorkflowRunId);
  const selectedRun = mockRuns.find(r => r.id === selectedRunId) || mockRuns[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-base)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('runs')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeTab === 'runs'
                  ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Runs
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeTab === 'jobs'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Export Jobs
            </button>
          </div>
        </div>
        <button className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'runs' ? (
          <>
            {/* Runs Table - 400px */}
            <div className="w-[400px] border-r border-slate-200 overflow-auto">
              <RunsTable runs={mockRuns} />
            </div>
            {/* Detail Panel */}
            <div className="flex-1 overflow-auto">
              <RunDetailPanel run={selectedRun} nodeRuns={mockNodeRuns} />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <ExportJobsList jobs={mockExportJobs} />
          </div>
        )}
      </div>
    </div>
  );
}

export type { WorkflowRun, NodeRun, ExportJob };
