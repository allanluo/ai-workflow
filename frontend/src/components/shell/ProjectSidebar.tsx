import { NavLink, useParams } from 'react-router-dom';
import { useAppStore, useEventStore, type PageId } from '../../stores';

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'sources', label: 'Sources', icon: '📄' },
  { id: 'canon', label: 'Story & Canon', icon: '📚' },
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
  { id: 'shots', label: 'Shots', icon: '📷' },
  { id: 'workflows', label: 'Workflows', icon: '⚙️' },
  { id: 'timeline', label: 'Timeline', icon: '🕐' },
  { id: 'review', label: 'Review', icon: '✅' },
  { id: 'activity', label: 'Activity', icon: '📊' },
];

export function ProjectSidebar() {
  const { projectId } = useParams<{ projectId: string }>();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const unreadCount = useEventStore(s => s.unreadNotificationCount);

  if (!projectId) {
    return null;
  }

  return (
    <aside
      className={`fixed left-0 top-14 bottom-0 bg-slate-900 text-white flex flex-col z-20 transition-all duration-200 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        {!sidebarCollapsed && (
          <span className="text-sm font-medium text-slate-300">Navigation</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            to={`/projects/${projectId}/${item.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
            {item.id === 'activity' && unreadCount > 0 && !sidebarCollapsed && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {item.id === 'activity' && unreadCount > 0 && sidebarCollapsed && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </NavLink>
        ))}
      </nav>

      {!sidebarCollapsed && (
        <div className="p-3 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Backend Connected</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
