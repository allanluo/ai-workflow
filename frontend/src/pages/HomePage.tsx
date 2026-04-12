import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject, fetchProjects, fetchHealth } from '../lib/api';
import { Button, Input, Modal } from '../components/common';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    primary_output_type: 'film',
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Queries
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30000,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async newProject => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      setFormState({ title: '', description: '', primary_output_type: 'film' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Navigate to the new project
      navigate(`/projects/${newProject.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim()) return;
    createProjectMutation.mutate({
      title: formState.title,
      description: formState.description,
      primary_output_type: formState.primary_output_type,
    });
  };

  return (
    <div className="h-full overflow-auto">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 toast toast-success animate-slideIn">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
            <span>Project created successfully!</span>
          </div>
        )}

        {/* Error if backend not available */}
        {healthQuery.isError && (
          <div className="mb-6 p-4 bg-[var(--error-bg)] border border-[var(--error)] rounded-lg">
            <div className="flex items-center gap-2 text-[var(--error)]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>Unable to connect to backend. Please ensure the server is running.</span>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            Welcome to AI Workflow Studio
          </h1>
          <p className="text-[var(--text-secondary)]">
            Create and manage story-to-media production workflows
          </p>
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Projects</span>
          </div>

          {projectsQuery.isLoading ? (
            <div className="flex-center py-8">
              <div className="spinner" />
            </div>
          ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {projectsQuery.data.slice(0, 5).map(project => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {project.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {project.primary_output_type || 'No output type'} • {project.status}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                  <svg
                    className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-[var(--text-muted)] mb-4">
                No projects yet. Create your first project to get started.
              </div>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create Project
              </Button>
            </div>
          )}
        </div>

        {/* Quick Start Guide */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  1. Add Sources
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Upload your source materials, scripts, or story outlines
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  2. Create Workflow
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Define your production pipeline with AI-powered nodes
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">3. Export</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Review content and export to your desired format
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={createProjectMutation.isPending}
              disabled={!formState.title.trim()}
            >
              Create Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Project Title"
            value={formState.title}
            onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
            placeholder="My Awesome Project"
            autoFocus
          />
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formState.description}
              onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
              className="input textarea"
              rows={3}
              placeholder="Describe your project goals..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Output Type</label>
            <select
              value={formState.primary_output_type}
              onChange={e =>
                setFormState(prev => ({ ...prev, primary_output_type: e.target.value }))
              }
              className="input select"
            >
              <option value="film">Film</option>
              <option value="music_video">Music Video</option>
              <option value="short_form_video">Short Form Video</option>
              <option value="audio_story">Audio Story</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
