import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RunsTable } from './RunsTable';
import { RunDetailPanel } from './RunDetailPanel';
import { ExportJobsList } from './ExportJobsList';
import { useSelectionStore } from '../../stores';
import {
  fetchProjectWorkflowRuns,
  fetchNodeRuns,
  type WorkflowRun as ApiWorkflowRun,
  type NodeRun as ApiNodeRun,
} from '../../lib/api';

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
  output?: Record<string, unknown>;
}

function transformRun(apiRun: ApiWorkflowRun) {
  return {
    id: apiRun.id,
    workflowName: apiRun.workflow_version_id,
    status: apiRun.status as 'running' | 'completed' | 'failed' | 'cancelled',
    startedAt: apiRun.started_at,
    duration: apiRun.ended_at
      ? `${new Date(apiRun.ended_at).getTime() - new Date(apiRun.started_at).getTime()}ms`
      : '-',
    progress: apiRun.summary?.completed_node_count
      ? Math.round(
          ((apiRun.summary.completed_node_count as number) /
            ((apiRun.summary.node_count as number) || 1)) *
            100
        )
      : 0,
  };
}

function transformNodeRun(apiNode: ApiNodeRun) {
  return {
    id: apiNode.id,
    nodeName: apiNode.node_id,
    status: apiNode.status as 'pending' | 'running' | 'completed' | 'failed',
    startedAt: apiNode.started_at,
    duration: apiNode.ended_at
      ? `${new Date(apiNode.ended_at).getTime() - new Date(apiNode.started_at).getTime()}ms`
      : '-',
    logs: apiNode.logs || [],
    output: apiNode.output_snapshot as Record<string, unknown>,
    _debug: JSON.stringify(apiNode.output_snapshot).slice(0, 100),
  };
}

interface ExportJob {
  id: string;
  format: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
}

export function ActivityPage({ projectId }: ActivityPageProps) {
  const [activeTab, setActiveTab] = useState<'runs' | 'jobs'>('runs');
  const selectedRunId = useSelectionStore(s => s.selectedWorkflowRunId);

  console.log('ActivityPage projectId:', projectId);

  const {
    data: apiRuns,
    isLoading: runsLoading,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => fetchProjectWorkflowRuns(projectId),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  const runs = apiRuns?.map(transformRun) || [];

  const { data: apiNodeRuns, refetch: refetchNodeRuns } = useQuery({
    queryKey: ['node-runs', selectedRunId],
    queryFn: () => {
      const runId = selectedRunId || runs[0]?.id;
      return runId ? fetchNodeRuns(runId) : Promise.resolve([]);
    },
    enabled: !!(selectedRunId || runs[0]?.id),
  });
  const nodeRuns = apiNodeRuns?.map(transformNodeRun) || [];

  // Use first run if no selection
  const selectedRun = runs.find(r => r.id === selectedRunId) || runs[0];

  // Debug: show data state
  const showEmpty = !selectedRun || runs.length === 0;

  if (!selectedRun) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No runs found. Run a workflow first.
      </div>
    );
  }

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
              <RunsTable runs={runs || []} />
            </div>
            {/* Detail Panel */}
            <div className="flex-1 overflow-auto">
              <RunDetailPanel run={selectedRun} nodeRuns={nodeRuns || []} />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <ExportJobsList jobs={[]} />
          </div>
        )}
      </div>
    </div>
  );
}

export type { WorkflowRun, NodeRun, ExportJob };
