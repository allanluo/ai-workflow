import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { usePanelStore, useAppStore } from '../../stores';
import { useEventStream } from '../../hooks/useEventStream';
import { MenuBar } from './MenuBar';
import { Sidebar } from './Sidebar';
import { TopToolbar } from './TopToolbar';
import { ContextPanel } from './ContextPanel';
import { ActivityDock } from './ActivityDock';

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { projectId } = useParams<{ projectId: string }>();
  useEventStream(projectId);
  const { rightPanelOpen, rightPanelWidth, bottomDockExpanded = false } = usePanelStore();
  const { sidebarCollapsed } = useAppStore();

  const sidebarWidth = projectId ? (sidebarCollapsed ? 56 : 240) : sidebarCollapsed ? 56 : 240;
  const rightPanelActualWidth = rightPanelOpen ? rightPanelWidth : 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-base)] flex flex-col">
      {/* Menu Bar */}
      <MenuBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Toolbar (project context) */}
          {projectId && <TopToolbar />}

          {/* Main Canvas */}
          <main
            className="flex-1 overflow-auto bg-[var(--bg-input)]"
            style={{
              marginLeft: 0,
              marginRight: rightPanelActualWidth,
            }}
          >
            {children}
          </main>
        </div>

        {/* Right Context Panel */}
        <aside
          className="fixed right-0 top-12 flex flex-col z-20 transition-all duration-200"
          style={{
            width: rightPanelActualWidth,
            top: '3rem',
            bottom: bottomDockExpanded ? '12rem' : '0rem',
          }}
        >
          <ContextPanel />
        </aside>
      </div>

      {/* Bottom Activity Dock */}
      <ActivityDock />
    </div>
  );
}

// Export individual components for easier imports
export { MenuBar } from './MenuBar';
export { Sidebar } from './Sidebar';
export { TopToolbar } from './TopToolbar';
export { ContextPanel } from './ContextPanel';
export { ActivityDock } from './ActivityDock';
