import { ReactNode, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { usePanelStore } from '../../stores';
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
  const { rightPanelOpen, rightPanelWidth, setRightPanelWidth } = usePanelStore();
  const isResizingRef = useRef(false);

  const clampPanelWidth = (value: number) => Math.max(280, Math.min(900, value));
  const safeRightPanelWidth =
    typeof rightPanelWidth === 'number' && Number.isFinite(rightPanelWidth)
      ? clampPanelWidth(rightPanelWidth)
      : 360;
  const rightPanelActualWidth = rightPanelOpen ? safeRightPanelWidth : 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-base)] flex flex-col">
      {/* Menu Bar */}
      <MenuBar />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Toolbar (project context) */}
          {projectId && <TopToolbar />}

          {/* Main Canvas + Right Context Panel */}
          <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden bg-[var(--bg-input)]">
            <main className="flex-1 min-w-0 overflow-auto">{children}</main>

            {rightPanelOpen && (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize"
                  className="w-3 cursor-col-resize bg-[var(--border)] opacity-40 hover:opacity-100 active:bg-[var(--accent)] transition-opacity"
                  style={{ touchAction: 'none' }}
                  onPointerDown={e => {
                    isResizingRef.current = true;
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    document.body.style.userSelect = 'none';
                  }}
                  onPointerMove={e => {
                    if (!isResizingRef.current) return;
                    const nextWidth = clampPanelWidth(window.innerWidth - e.clientX);
                    setRightPanelWidth(nextWidth);
                  }}
                  onPointerUp={() => {
                    isResizingRef.current = false;
                    document.body.style.userSelect = '';
                  }}
                  onPointerCancel={() => {
                    isResizingRef.current = false;
                    document.body.style.userSelect = '';
                  }}
                />
                <aside
                  className="flex-shrink-0 flex flex-col h-full min-h-0 overflow-hidden transition-[width] duration-200"
                  style={{
                    width: rightPanelActualWidth,
                  }}
                >
                  <ContextPanel />
                </aside>
              </>
            )}
          </div>
        </div>
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
