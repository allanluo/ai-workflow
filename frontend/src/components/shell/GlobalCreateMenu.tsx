import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkflow } from '../../lib/api';
import { createWorkflowDraftFromTemplate } from '../../lib/workflowCatalog';

interface CreateOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const createOptions: CreateOption[] = [
  { id: 'project', label: 'New Project', icon: '📁', description: 'Create a new project' },
  { id: 'workflow', label: 'New Workflow', icon: '⚡', description: 'Create a new workflow' },
  { id: 'scene', label: 'New Scene', icon: '🎭', description: 'Add a new scene' },
  { id: 'shot', label: 'New Shot', icon: '🎥', description: 'Add a new shot' },
  { id: 'asset', label: 'Upload Asset', icon: '📄', description: 'Upload files' },
];

export function GlobalCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: workflow => {
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      navigate(`/projects/${projectId}/workflows?select=${workflow.id}`);
    },
  });

  const handleCreate = (optionId: string) => {
    if (optionId === 'workflow' && projectId) {
      const template = createWorkflowDraftFromTemplate('story-to-video');
      createWorkflowMutation.mutate({
        projectId,
        title: template.title,
        description: template.description,
        mode: 'advanced',
        template_type: template.template_type,
        nodes: template.nodes,
        edges: template.edges,
      });
    } else {
      console.log('Create:', optionId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        <span>+</span>
        <span>Create</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">Create new...</span>
          </div>
          <div className="p-1">
            {createOptions.map(option => (
              <button
                key={option.id}
                onClick={() => handleCreate(option.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-md text-left"
              >
                <span className="text-lg">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">{option.label}</div>
                  <div className="text-xs text-slate-500">{option.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
