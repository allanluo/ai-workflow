import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './components/layout';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SourcesTab } from './pages/SourcesTab';
import { CanonTab } from './pages/CanonTab';
import { ScenesTab } from './pages/ScenesTab';
import { WorkflowsTab } from './pages/WorkflowsTab';
import { ReviewTab } from './pages/ReviewTab';
import { OutputsTab } from './pages/OutputsTab';
import { ShotsPage } from './pages/ShotsPage/ShotsPage';
import { ActivityPage } from './pages/ActivityPage/ActivityPage';
import { TimelinePage } from './pages/TimelinePage/TimelinePage';
import { DiffViewer } from './components/diff/DiffViewer';
import { useProjectSync } from './hooks/useProjectSync';
import { useAppStore } from './stores';
import { fetchHealth } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export function App() {
  const { setConnectionStatus } = useAppStore();

  useEffect(() => {
    const check = async () => {
      try {
        await fetchHealth();
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    void check();
    const timer = setInterval(check, 10000);
    return () => clearInterval(timer);
  }, [setConnectionStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/sources" element={<TabWrapper Tab={SourcesTab} />} />
          <Route path="/projects/:projectId/canon" element={<TabWrapper Tab={CanonTab} />} />
          <Route path="/projects/:projectId/scenes" element={<TabWrapper Tab={ScenesTab} />} />
          <Route
            path="/projects/:projectId/workflows"
            element={<TabWrapper Tab={WorkflowsTab} />}
          />
          <Route path="/projects/:projectId/outputs" element={<TabWrapper Tab={OutputsTab} />} />
          <Route path="/projects/:projectId/review" element={<TabWrapper Tab={ReviewTab} />} />
          <Route path="/projects/:projectId/shots" element={<ShotsPageWrapper />} />
          <Route path="/projects/:projectId/timeline" element={<TimelinePageWrapper />} />
          <Route path="/projects/:projectId/activity" element={<ActivityPageWrapper />} />
          <Route path="/projects/:projectId/compare" element={<CompareWrapper />} />
        </Routes>
      </Shell>
    </QueryClientProvider>
  );
}

function TabWrapper({ Tab }: { Tab: React.ComponentType<{ projectId: string }> }) {
  const projectId = useProjectSync();
  if (!projectId) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-center">
          <p className="text-2xl text-red-500 font-bold mb-2">❌ Project Not Found</p>
          <p className="text-sm text-red-400">useProjectSync returned: {String(projectId)}</p>
        </div>
      </div>
    );
  }
  return <Tab projectId={projectId} />;
}

function ShotsPageWrapper() {
  const projectId = useProjectSync();
  if (!projectId) return <div className="p-4 text-[var(--text-muted)]">Project not found</div>;
  return <ShotsPage projectId={projectId} />;
}

function TimelinePageWrapper() {
  const projectId = useProjectSync();
  if (!projectId) return <div className="p-4 text-[var(--text-muted)]">Project not found</div>;
  return <TimelinePage projectId={projectId} />;
}

function ActivityPageWrapper() {
  const projectId = useProjectSync();
  if (!projectId) return <div className="p-4 text-[var(--text-muted)]">Project not found</div>;
  return <ActivityPage projectId={projectId} />;
}

function CompareWrapper() {
  const projectId = useProjectSync();
  if (!projectId) return <div className="p-4 text-[var(--text-muted)]">Project not found</div>;
  return <DiffViewer type="text" assetId={projectId} />;
}
