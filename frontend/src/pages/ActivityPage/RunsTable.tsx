import { useSelectionStore } from '../../stores';
import type { WorkflowRun } from './ActivityPage';

interface RunsTableProps {
  runs: WorkflowRun[];
}

const statusConfig = {
  running: { label: 'Running', color: 'bg-blue-100 text-blue-700', icon: '⟳' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: '✓' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: '✕' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600', icon: '—' },
};

export function RunsTable({ runs }: RunsTableProps) {
  const selectedRunId = useSelectionStore(s => s.selectedWorkflowRunId);
  const selectWorkflowRun = useSelectionStore(s => s.selectWorkflowRun);

  return (
    <table className="w-full">
      <thead className="bg-slate-50 sticky top-0">
        <tr className="text-left text-xs font-medium text-slate-500 uppercase">
          <th className="px-4 py-3">Workflow</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Started</th>
          <th className="px-4 py-3">Duration</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {runs.map(run => {
          const status = statusConfig[run.status];
          return (
            <tr
              key={run.id}
              onClick={() => selectWorkflowRun(run.id)}
              className={`cursor-pointer hover:bg-slate-50 ${
                selectedRunId === run.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-slate-700">{run.workflowName}</div>
                <div className="text-xs text-slate-400">ID: {run.id}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${status.color}`}
                >
                  <span>{status.icon}</span>
                  {status.label}
                  {run.status === 'running' && ` ${run.progress}%`}
                </span>
                {run.status === 'running' && (
                  <div className="w-20 h-1 bg-slate-200 rounded mt-1">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{ width: `${run.progress}%` }}
                    />
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{run.startedAt}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{run.duration}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
