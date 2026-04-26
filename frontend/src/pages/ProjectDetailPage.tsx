import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProjectSync } from '../hooks/useProjectSync';
import {
  fetchProjectById,
  fetchProjectAssets,
  fetchProjectWorkflows,
  fetchProjectWorkflowRuns,
} from '../lib/api';

export function ProjectDetailPage() {
  const projectId = useProjectSync();

  // Fetch project data
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId,
  });

  // Fetch project assets for counts
  const assetsQuery = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => fetchProjectAssets(projectId!),
    enabled: !!projectId,
  });

  // Fetch workflows
  const workflowsQuery = useQuery({
    queryKey: ['project-workflows', projectId],
    queryFn: () => fetchProjectWorkflows(projectId!),
    enabled: !!projectId,
  });

  // Fetch recent runs
  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => fetchProjectWorkflowRuns(projectId!),
    enabled: !!projectId,
  });



  if (!projectId) {
    return (
      <div className="p-6">
        <div className="text-[var(--error)]">Project not found</div>
      </div>
    );
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex-center h-full">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <div className="p-6">
        <div className="text-[var(--error)]">Failed to load project</div>
      </div>
    );
  }

  const project = projectQuery.data;
  if (!project) return null;

  const assets = assetsQuery.data || [];
  const workflows = workflowsQuery.data || [];
  const runs = runsQuery.data || [];

  // Count assets by type
  const sourceCount = assets.filter(a => a.asset_category === 'source').length;
  const canonCount = assets.filter(
    a => a.asset_category === 'canon' || a.asset_type === 'canon_text'
  ).length;
  const sceneCount = assets.filter(a => {
    if (a.asset_type === 'scene') return true;
    const content = (a.current_version?.content || {}) as Record<string, any>;
    const hasScenes = Array.isArray(content.scenes);
    const hasRawScenes = typeof content._raw === 'string' && content._raw.includes('"scenes"');
    return hasScenes || hasRawScenes;
  }).length;
  const shotCount = assets.filter(a => a.asset_type === 'shot').length;

  // Get latest run
  const latestRun = runs[0];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Project Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            {project.title}
          </h1>
          {project.description && (
            <p className="text-[var(--text-secondary)]">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <span
              className={`badge ${project.status === 'active' ? 'badge-success' : 'badge-draft'}`}
            >
              {project.status}
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              {project.primary_output_type || 'No output type'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{sourceCount}</div>
            <div className="text-sm text-[var(--text-muted)]">Sources</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{canonCount}</div>
            <div className="text-sm text-[var(--text-muted)]">Canon Items</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{sceneCount}</div>
            <div className="text-sm text-[var(--text-muted)]">Scenes</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{shotCount}</div>
            <div className="text-sm text-[var(--text-muted)]">Shots</div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: 'Sources',
              count: sourceCount,
              icon: '📄',
              to: `/projects/${projectId}/sources`,
            },
            {
              label: 'Story & Canon',
              count: canonCount,
              icon: '📚',
              to: `/projects/${projectId}/canon`,
            },
            { label: 'Scenes', count: sceneCount, icon: '🎬', to: `/projects/${projectId}/scenes` },
            { label: 'Shots', count: shotCount, icon: '📷', to: `/projects/${projectId}/shots` },
            {
              label: 'Workflows',
              count: workflows.length,
              icon: '⚙️',
              to: `/projects/${projectId}/workflows`,
            },
            { label: 'Outputs', count: 0, icon: '🎥', to: `/projects/${projectId}/outputs` },
          ].map(item => (
            <Link
              key={item.label}
              to={item.to}
              className="card hover:border-[var(--accent)] transition-colors cursor-pointer"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.count} items</div>
            </Link>
          ))}
        </div>

        {/* Recent Run */}
        {latestRun && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Latest Workflow Run</span>
              <Link to={`/projects/${projectId}/activity`} className="text-sm text-[var(--accent)]">
                View all
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`badge ${
                  latestRun.status === 'completed'
                    ? 'badge-success'
                    : latestRun.status === 'running'
                      ? 'badge-running'
                      : 'badge-error'
                }`}
              >
                {latestRun.status}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                Started {new Date(latestRun.started_at).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Empty State for New Projects */}
        {assets.length === 0 && (
          <div className="mt-8 p-6 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-light)] text-center">
            <div className="text-lg font-medium text-[var(--text-primary)] mb-2">
              Get started with your project
            </div>
            <div className="text-[var(--text-muted)] mb-4">
              Add sources and create your first workflow to begin production
            </div>
            <div className="flex justify-center gap-3">
              <Link to={`/projects/${projectId}/sources`} className="btn btn-primary">
                Add Sources
              </Link>
              <Link to={`/projects/${projectId}/workflows`} className="btn btn-secondary">
                Create Workflow
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
