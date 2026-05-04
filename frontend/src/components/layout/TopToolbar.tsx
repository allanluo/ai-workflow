import { Link, useParams, useLocation } from 'react-router-dom';
import { useAppStore, usePanelStore } from '../../stores';
import { Button, Dropdown } from '../common';

// Page config for actions
const pageActions: Record<string, { primary: string[]; secondary: string[] }> = {
  sources: {
    primary: ['Upload', 'New Asset'],
    secondary: ['Filter', 'View'],
  },
  canon: {
    primary: ['New Asset', 'Save'],
    secondary: ['Approve', 'Versions'],
  },
  scenes: {
    primary: ['Add Scene', 'Generate'],
    secondary: ['Reorder', 'Approve'],
  },
  shots: {
    primary: ['Generate', 'Validate'],
    secondary: ['Compare', 'Lock'],
  },
  workflows: {
    primary: ['Validate', 'Run'],
    secondary: ['Freeze', 'Approve', 'Duplicate'],
  },
  timeline: {
    primary: ['Export Preview', 'Export'],
    secondary: ['Preview', 'Replace'],
  },
  review: {
    primary: ['Approve', 'Reject'],
    secondary: ['Compare', 'Comment'],
  },
  activity: {
    primary: ['Rerun', 'Retry'],
    secondary: ['Clear', 'Filter'],
  },
};

// Page titles
const pageTitles: Record<string, string> = {
  sources: 'Sources',
  canon: 'Story & Canon',
  scenes: 'Scenes',
  shots: 'Shots',
  workflows: 'Workflows',
  timeline: 'Timeline',
  review: 'Review',
  activity: 'Activity',
};

export function TopToolbar() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { currentProjectTitle, userMode, setUserMode } = useAppStore();
  const { rightPanelOpen } = usePanelStore();

  // Get current page from URL
  const currentPage = location.pathname.split('/').pop() || 'home';
  const actions = pageActions[currentPage] || { primary: [], secondary: [] };
  const pageTitle = pageTitles[currentPage] || currentPage;

  // Build breadcrumb
  const breadcrumb = projectId
    ? [{ label: currentProjectTitle || 'Project', to: `/projects/${projectId}` }]
    : [];

  if (currentPage !== 'home' && projectId) {
    breadcrumb.push({ label: pageTitle, to: location.pathname });
  }

  return (
    <div className="h-12 bg-[var(--bg-base)] border-b border-[var(--border-light)] flex items-center justify-between px-4">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumb.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            {index === breadcrumb.length - 1 ? (
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors truncate"
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Center: Page Actions */}
      {projectId && actions.primary.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.primary.map((action, index) => (
            <Button key={index} variant="primary" size="sm">
              {action}
            </Button>
          ))}
          {actions.secondary.length > 0 && (
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              }
              items={actions.secondary.map(action => ({
                id: action,
                label: action,
                onClick: () => {},
              }))}
            />
          )}
        </div>
      )}

      {/* Right: Mode Switcher */}
      <div className="flex items-center gap-3">
        {projectId && (
          <div className="flex items-center bg-[var(--bg-hover)] rounded-lg p-0.5">
            {(['simple', 'guided', 'advanced'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setUserMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  userMode === mode
                    ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Run/Export buttons when in project context */}
        {projectId && currentPage === 'workflows' && (
          <>
            <Button variant="secondary" size="sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run
            </Button>
            <Button variant="secondary" size="sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </Button>
          </>
        )}

        {/* Export button for timeline */}
        {projectId && currentPage === 'timeline' && (
          <Button variant="primary" size="sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
