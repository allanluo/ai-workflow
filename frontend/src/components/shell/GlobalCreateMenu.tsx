import { useState } from 'react';

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

  const handleCreate = (optionId: string) => {
    console.log('Create:', optionId);
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
