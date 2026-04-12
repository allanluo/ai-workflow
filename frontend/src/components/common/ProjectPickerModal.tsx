import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { fetchProjects } from '../../lib/api';
import { useAppStore } from '../../stores';
import type { Project } from '../../lib/api';

interface ProjectPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (project: Project) => void;
}

export function ProjectPickerModal({ isOpen, onClose, onSelect }: ProjectPickerModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (project: Project) => {
    onSelect(project);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open Project" size="md">
      <div className="space-y-4 w-[400px]">
        <Input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        {loading && (
          <div className="py-8 text-center text-[var(--text-muted)]">Loading projects...</div>
        )}

        {error && <div className="py-8 text-center text-[var(--error)]">{error}</div>}

        {!loading && !error && filteredProjects.length === 0 && (
          <div className="py-8 text-center text-[var(--text-muted)]">
            {search ? 'No projects found' : 'No projects yet'}
          </div>
        )}

        {!loading && !error && filteredProjects.length > 0 && (
          <div className="max-h-[300px] overflow-auto border border-[var(--border-light)] rounded-lg">
            {filteredProjects.map(project => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className="w-full p-3 text-left hover:bg-[var(--bg-hover)] border-b border-[var(--border-light)] last:border-b-0 transition-colors"
              >
                <div className="font-medium text-[var(--text-primary)] truncate">
                  {project.title}
                </div>
                {project.description && (
                  <div className="text-sm text-[var(--text-muted)] mt-1 truncate">
                    {project.description}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  <span>{project.status}</span>
                  <span>•</span>
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
