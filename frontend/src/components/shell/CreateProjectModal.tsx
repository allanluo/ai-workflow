import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject } from '../../lib/api';
import { Button, Input, Modal } from '../common';
import { useAppStore } from '../../stores';

export function CreateProjectModal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { createProjectModalOpen, closeCreateProjectModal, setCurrentProject } = useAppStore();
  
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    primary_output_type: 'film',
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async newProject => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeCreateProjectModal();
      setFormState({ title: '', description: '', primary_output_type: 'film' });
      
      // Update app store and navigate
      setCurrentProject(newProject.id, newProject.title);
      navigate(`/projects/${newProject.id}`);
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formState.title.trim()) return;
    createProjectMutation.mutate({
      title: formState.title,
      description: formState.description,
      primary_output_type: formState.primary_output_type,
    });
  };

  return (
    <Modal
      isOpen={createProjectModalOpen}
      onClose={closeCreateProjectModal}
      title="Create New Project"
      footer={
        <>
          <Button variant="secondary" onClick={closeCreateProjectModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSubmit()}
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
  );
}
