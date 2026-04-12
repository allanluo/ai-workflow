import { usePanelStore } from '../../stores';
import { Badge, Button } from '../common';

interface Run {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
}

interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: string;
}

// Placeholder data - will be replaced with real data from API
const mockRuns: Run[] = [
  {
    id: 'run-1',
    name: 'Film Workflow v12',
    status: 'running',
    progress: 45,
    startedAt: '10:30 AM',
  },
  {
    id: 'run-2',
    name: 'Generate Shots',
    status: 'completed',
    progress: 100,
    startedAt: '10:15 AM',
  },
];

const mockJobs: Job[] = [
  { id: 'job-1', name: 'Generate Image', status: 'running', type: 'image' },
  { id: 'job-2', name: 'TTS Synthesis', status: 'pending', type: 'audio' },
];

const tabs = [
  { id: 'runs', label: 'Runs' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'logs', label: 'Logs' },
  { id: 'notifications', label: 'Notifications' },
];

function RunsTab() {
  return (
    <div className="p-3 space-y-2">
      {mockRuns.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No active runs</div>
      ) : (
        mockRuns.map(run => (
          <div
            key={run.id}
            className="flex items-center gap-3 p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-light)]"
          >
            {/* Status indicator */}
            <div
              className={`w-2 h-2 rounded-full ${
                run.status === 'running'
                  ? 'bg-[var(--accent)] animate-pulse'
                  : run.status === 'completed'
                    ? 'bg-[var(--success)]'
                    : 'bg-[var(--error)]'
              }`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                {run.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      run.status === 'completed'
                        ? 'bg-[var(--success)]'
                        : run.status === 'failed'
                          ? 'bg-[var(--error)]'
                          : 'bg-[var(--accent)]'
                    }`}
                    style={{ width: `${run.progress}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)]">{run.progress}%</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {run.status === 'running' ? (
                <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </button>
              ) : (
                <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 4v6h6" />
                    <path d="M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function JobsTab() {
  return (
    <div className="p-3 space-y-2">
      {mockJobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No active jobs</div>
      ) : (
        mockJobs.map(job => (
          <div
            key={job.id}
            className="flex items-center gap-3 p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-light)]"
          >
            <span
              className={`text-xs ${
                job.status === 'running'
                  ? 'text-[var(--accent)]'
                  : job.status === 'completed'
                    ? 'text-[var(--success)]'
                    : job.status === 'failed'
                      ? 'text-[var(--error)]'
                      : 'text-[var(--text-muted)]'
              }`}
            >
              {job.status === 'running' && '◐'}
              {job.status === 'completed' && '✓'}
              {job.status === 'failed' && '✗'}
              {job.status === 'pending' && '○'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--text-primary)] truncate">{job.name}</div>
              <div className="text-xs text-[var(--text-muted)]">{job.type}</div>
            </div>
          </div>
        ))
      )}
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
      <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setBottomDockTab(tab.id as typeof bottomDockTab)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                bottomDockTab === tab.id
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
