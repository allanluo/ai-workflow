import { ReactNode } from 'react';
import { useAppStore, usePanelStore } from '../../stores';
import { ProjectSidebar } from './ProjectSidebar';
import { TopToolbar } from './TopToolbar';
import { RightContextPanel } from './RightContextPanel';
import { BottomActivityDock } from './BottomActivityDock';
import { ToastContainer } from './ToastContainer';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarCollapsed = useAppStore(s => s.sidebarCollapsed);
  const { rightPanelOpen, rightPanelWidth, bottomDockExpanded, bottomDockHeight } = usePanelStore();

  const sidebarWidth = sidebarCollapsed ? 64 : 240;
  const rightPanelActualWidth = rightPanelOpen ? rightPanelWidth : 48;
  const bottomDockActualHeight = bottomDockExpanded ? bottomDockHeight : 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col">
      <TopToolbar />

      <div className="flex-1 flex overflow-hidden">
        <ProjectSidebar />

        <main
          className="flex-1 overflow-auto bg-slate-50 transition-all duration-200"
          style={{
            marginLeft: sidebarWidth,
            marginRight: rightPanelActualWidth,
            marginBottom: bottomDockActualHeight,
          }}
        >
          {children}
        </main>

        <aside
          className="fixed right-0 top-14 bottom-0 bg-white border-l border-slate-200 flex flex-col z-20 transition-all duration-200"
          style={{ width: rightPanelActualWidth }}
        >
          <RightContextPanel />
        </aside>
      </div>

      <BottomActivityDock />
      <ToastContainer />
    </div>
  );
}
