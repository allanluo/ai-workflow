import { useState } from 'react';
import { useSelectionStore } from '../../stores';

const suggestions = [
  { label: 'Generate shots', action: () => console.log('Generate shots') },
  { label: 'Create workflow', action: () => console.log('Create workflow') },
  { label: 'Review assets', action: () => console.log('Review assets') },
  { label: 'Add scene', action: () => console.log('Add scene') },
  { label: 'Run workflow', action: () => console.log('Run workflow') },
];

export function CopilotPanel() {
  const [input, setInput] = useState('');
  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    console.log('Copilot query:', input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">AI Copilot</h3>

      {selectedAssetId || selectedShotId ? (
        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700 mb-3">
          I can see you have something selected. Ask me to help with it!
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 mb-3">
          Hi! I can help you create workflows, generate content, and review your project.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {suggestions.map(s => (
          <button
            key={s.label}
            onClick={s.action}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-auto">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </form>
    </div>
  );
}
