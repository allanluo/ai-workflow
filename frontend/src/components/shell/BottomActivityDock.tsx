import { usePanelStore, useEventStore, type BottomDockTab } from '../../stores';

const tabs: { id: BottomDockTab; label: string; icon: string }[] = [
  { id: 'runs', label: 'Runs', icon: '▶️' },
  { id: 'jobs', label: 'Jobs', icon: '⚡' },
  { id: 'logs', label: 'Logs', icon: '📝' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

export function BottomActivityDock() {
  const {
    bottomDockExpanded,
    bottomDockTab,
    setBottomDockTab,
    toggleBottomDock,
    bottomDockHeight,
  } = usePanelStore();
  const { runProgress, recentEvents, unreadNotificationCount } = useEventStore();

  const activeRuns = Object.values(runProgress).filter(
    r => r.status === 'running' || r.status === 'queued'
  );

  return (
    <div
      className={`fixed left-0 right-0 bg-white border-t border-slate-200 transition-all duration-200 z-20 ${
        bottomDockExpanded ? '' : 'bottom-0'
      }`}
      style={{ height: bottomDockExpanded ? bottomDockHeight : 40, bottom: 0 }}
    >
      <div
        className="h-10 flex items-center justify-between px-4 border-b border-slate-200 cursor-pointer hover:bg-slate-50"
        onClick={toggleBottomDock}
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700">Activity</span>
          {activeRuns.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-blue-600">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {activeRuns.length} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadNotificationCount > 0 && (
            <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
              {unreadNotificationCount}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${
              bottomDockExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>

      {bottomDockExpanded && (
        <div className="h-[calc(100%-40px)] flex">
          <div className="flex border-r border-slate-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setBottomDockTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm border-r border-slate-200 transition-colors ${
                  bottomDockTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'notifications' && unreadNotificationCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {bottomDockTab === 'runs' && <RunsContent />}
            {bottomDockTab === 'jobs' && <JobsContent />}
            {bottomDockTab === 'logs' && <LogsContent events={recentEvents} />}
            {bottomDockTab === 'notifications' && <NotificationsContent />}
          </div>
        </div>
      )}
    </div>
  );
}

function RunsContent() {
  const { runProgress } = useEventStore();
  const runs = Object.values(runProgress);

  if (runs.length === 0) {
    return <div className="text-sm text-slate-500 py-4 text-center">No active workflow runs</div>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {runs.map(run => (
        <div
          key={run.workflow_run_id}
          className="flex-shrink-0 w-64 bg-slate-50 rounded-lg p-3 border border-slate-200"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">
              Run {run.workflow_run_id.slice(0, 8)}...
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                run.status === 'running'
                  ? 'bg-blue-100 text-blue-700'
                  : run.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : run.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
              }`}
            >
              {run.status}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${run.progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">{run.progress}% complete</div>
        </div>
      ))}
    </div>
  );
}

function JobsContent() {
  return <div className="text-sm text-slate-500 py-4 text-center">No active jobs</div>;
}

function LogsContent({
  events,
}: {
  events: typeof useEventStore.getState extends () => infer S
    ? S extends { recentEvents: infer E }
      ? E
      : never
    : never;
}) {
  if (events.length === 0) {
    return <div className="text-sm text-slate-500 py-4 text-center">No logs yet</div>;
  }

  return (
    <div className="space-y-1 text-xs font-mono">
      {events.slice(0, 20).map(event => (
        <div key={event.id} className="flex gap-2 text-slate-600">
          <span className="text-slate-400">{new Date(event.created_at).toLocaleTimeString()}</span>
          <span className="text-blue-600">{event.event_type}</span>
        </div>
      ))}
    </div>
  );
}

function NotificationsContent() {
  const { recentEvents, clearUnreadNotifications } = useEventStore();

  if (recentEvents.length === 0) {
    return <div className="text-sm text-slate-500 py-4 text-center">No notifications</div>;
  }

  return (
    <div>
      <button
        onClick={clearUnreadNotifications}
        className="text-xs text-blue-600 hover:text-blue-700 mb-2"
      >
        Clear all
      </button>
      <div className="space-y-2">
        {recentEvents.slice(0, 10).map(event => (
          <div key={event.id} className="text-sm bg-slate-50 rounded p-2">
            <div className="font-medium text-slate-700">{event.event_type}</div>
            <div className="text-xs text-slate-500">
              {new Date(event.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
