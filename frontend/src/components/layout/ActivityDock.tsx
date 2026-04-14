import { usePanelStore } from '../../stores';
import { Badge, Button } from '../common';

import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProjectWorkflowRuns, fetchProjectWorkflows } from '../../lib/api';

const tabs = [
  { id: 'runs', label: 'Runs' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'logs', label: 'Logs' },
  { id: 'notifications', label: 'Notifications' },
];

function RunsTab() {
  const { pathname } = useLocation();
  const projectId = pathname.match(/\/projects\/([^\/]+)/)?.[1];

  console.log('ActivityDock projectId:', projectId, 'pathname:', pathname);

  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => (projectId ? fetchProjectWorkflowRuns(projectId) : Promise.resolve([])),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const workflowsQuery = useQuery({
    queryKey: ['project-workflows', projectId],
    queryFn: () => (projectId ? fetchProjectWorkflows(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const runs = runsQuery.data ?? [];
  console.log('ActivityDock runs:', runs.length, 'first run:', runs[0]?.id);
  const workflows = workflowsQuery.data ?? [];

  // Create a quick lookup map from workflow_version_id to workflow title
  // Since runs only point to versions, we'll just try to match it if we had version data,
  // but since we only have workflows here, we'll label it by ID if cross-referencing isn't straightforward
  // Actually, let's just use the Run ID and the started_at, as we lack full version mappings in this simple component.

  return (
    <div className="p-2 space-y-1">
      {runs.length === 0 ? (
        <div className="text-center py-4 text-xs text-[var(--text-muted)]">No active runs</div>
      ) : (
        runs.slice(0, 10).map(run => (
          <div
            key={run.id}
            className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-input)] rounded border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            {/* Status indicator */}
            <div
              className={`w-2 h-2 rounded-sm ${
                run.status === 'running' || run.status === 'pending'
                  ? 'bg-blue-500 animate-pulse'
                  : run.status === 'completed' || run.status === 'success' || run.status === 'pass'
                    ? 'bg-green-500'
                    : 'bg-red-500'
              }`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate font-mono">
                {run.id.slice(0, 8)}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-[var(--text-muted)]">{run.status}</div>
                <a
                  href={`/projects/${projectId}/activity`}
                  className="text-[10px] text-[var(--accent)] hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  View Details
                </a>
              </div>
            </div>
          </div>
        ))
      )}
      {runs.length > 10 && (
        <div className="text-xs text-center text-[var(--text-muted)] py-1">
          +{runs.length - 10} more
        </div>
      )}
    </div>
  );
}

function JobsTab() {
  return (
    <div className="p-3 space-y-2">
      <div className="text-center py-8 text-sm text-[var(--text-muted)]">No active jobs</div>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="p-3">
      <div className="text-sm text-[var(--text-muted)] text-center py-8">No logs available</div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="p-3">
      <div className="text-sm text-[var(--text-muted)] text-center py-8">No notifications</div>
    </div>
  );
}

const tabContent: Record<string, React.FC> = {
  runs: RunsTab,
  jobs: JobsTab,
  logs: LogsTab,
  notifications: NotificationsTab,
};

export function ActivityDock() {
  const { bottomDockExpanded, bottomDockTab, setBottomDockTab, toggleBottomDock } = usePanelStore();

  const ActiveContent = tabContent[bottomDockTab] || RunsTab;

  return (
    <div
      className={`bg-[var(--bg-elevated)] border-t border-[var(--border-light)] transition-all duration-200 ${
        bottomDockExpanded ? 'h-48' : 'h-12'
      }`}
    >
      {/* Header / Tab Bar */}
      <div className="h-10 flex items-center justify-between px-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setBottomDockTab(tab.id as typeof bottomDockTab)}
              className={`px-2 py-1 text-xs font-medium rounded ${
                bottomDockTab === tab.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleBottomDock}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${bottomDockExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {bottomDockExpanded && (
        <div className="h-36 overflow-y-auto">
          <ActiveContent />
        </div>
      )}
    </div>
  );
}
