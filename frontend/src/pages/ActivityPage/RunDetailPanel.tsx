import { useState } from 'react';
import { NodeRunCard } from './NodeRunCard';
import type { WorkflowRun, NodeRun } from './ActivityPage';

interface RunDetailPanelProps {
  run: WorkflowRun;
  nodeRuns: NodeRun[];
}

const statusConfig = {
  running: { label: 'Running', color: 'text-blue-700' },
  completed: { label: 'Completed', color: 'text-green-700' },
  failed: { label: 'Failed', color: 'text-red-700' },
  cancelled: { label: 'Cancelled', color: 'text-slate-600' },
};

export function RunDetailPanel({ run, nodeRuns }: RunDetailPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const status = statusConfig[run.status];

  const handleRetry = () => {
    console.log('Retry run:', run.id);
  };

  const handleCancel = () => {
    console.log('Cancel run:', run.id);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Run Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-700">{run.workflowName}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
            <span className="text-xs text-slate-500">Started {run.startedAt}</span>
            <span className="text-xs text-slate-500">Duration: {run.duration}</span>
          </div>
          {run.status === 'running' && (
            <div className="w-48 h-2 bg-slate-200 rounded mt-2">
              <div
                className="h-full bg-blue-500 rounded transition-all"
                style={{ width: `${run.progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {run.status === 'running' && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Cancel
            </button>
          )}
          {(run.status === 'failed' || run.status === 'cancelled') && (
            <button
              onClick={handleRetry}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Node Runs */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Node Runs</h4>
        <div className="space-y-2">
          {nodeRuns.map(nodeRun => (
            <NodeRunCard
              key={nodeRun.id}
              nodeRun={nodeRun}
              isSelected={selectedNodeId === nodeRun.id}
              onClick={() => setSelectedNodeId(selectedNodeId === nodeRun.id ? null : nodeRun.id)}
            />
          ))}
        </div>
      </div>

      {/* Run Actions */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Actions</h4>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            View Full Logs
          </button>
          <button className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            View Inputs
          </button>
          <button className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            View Outputs
          </button>
        </div>
      </div>
    </div>
  );
}
