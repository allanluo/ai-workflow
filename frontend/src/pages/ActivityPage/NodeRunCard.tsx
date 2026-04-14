import { useState } from 'react';
import type { NodeRun } from './ActivityPage';

interface NodeRunCardProps {
  nodeRun: NodeRun;
  isSelected: boolean;
  onClick: () => void;
}

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600', icon: '○' },
  running: { label: 'Running', color: 'bg-blue-100 text-blue-700', icon: '⟳' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: '✓' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: '✕' },
};

export function NodeRunCard({ nodeRun, isSelected, onClick }: NodeRunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const status = statusConfig[nodeRun.status as keyof typeof statusConfig] || statusConfig.pending;

  const isFinished = nodeRun.status === 'completed' || nodeRun.status === 'failed';
  const hasOutput = nodeRun.output && Object.keys(nodeRun.output).length > 0;
  console.log(
    'NodeRunCard debug:',
    nodeRun.nodeName,
    'hasOutput:',
    hasOutput,
    'output:',
    JSON.stringify(nodeRun.output).slice(0, 100)
  );
  const showOutputButton = hasOutput || nodeRun.status === 'failed';

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isSelected ? 'border-blue-300' : 'border-slate-200'
      }`}
    >
      <div
        onClick={onClick}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs px-1.5 py-0.5 rounded ${status.color}`}>{status.icon}</span>
          <span className="text-sm font-medium text-slate-700">{nodeRun.nodeName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{nodeRun.startedAt}</span>
          <span className="text-xs text-slate-500">{nodeRun.duration}</span>
          {nodeRun.logs.length > 0 && (
            <button
              onClick={e => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {isExpanded ? 'Hide' : 'Logs'}
            </button>
          )}
          {showOutputButton && (
            <button
              onClick={e => {
                e.stopPropagation();
                setShowOutput(!showOutput);
              }}
              className="text-xs text-green-600 hover:underline"
            >
              {showOutput ? 'Hide' : nodeRun.status === 'failed' ? 'Error Details' : 'Output'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && nodeRun.logs.length > 0 && (
        <div className="border-t border-slate-200 p-3 bg-slate-50">
          <div className="font-mono text-xs text-slate-600 space-y-1">
            {nodeRun.logs.map((log: string, i: number) => (
              <div key={i} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {showOutput && showOutputButton && (
        <div className="border-t border-slate-200 p-3 bg-green-50">
          <div className="font-mono text-xs text-slate-700 whitespace-pre-wrap">
            {JSON.stringify(nodeRun.output, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
