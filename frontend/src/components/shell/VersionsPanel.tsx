import { useState } from 'react';
import { useSelectionStore } from '../../stores';

interface Version {
  id: string;
  number: number;
  createdAt: string;
  createdBy: string;
  description: string;
}

const mockVersions: Version[] = [
  {
    id: 'v3',
    number: 3,
    createdAt: '2 hours ago',
    createdBy: 'You',
    description: 'Adjusted prompt',
  },
  { id: 'v2', number: 2, createdAt: 'Yesterday', createdBy: 'AI', description: 'Auto-generated' },
  {
    id: 'v1',
    number: 1,
    createdAt: '2 days ago',
    createdBy: 'You',
    description: 'Initial version',
  },
];

export function VersionsPanel() {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedSceneId = useSelectionStore(s => s.selectedSceneId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);

  const hasSelection = selectedAssetId || selectedShotId || selectedSceneId || selectedWorkflowId;

  if (!hasSelection) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Version History</h3>
        <div className="text-sm text-slate-500">
          Select an asset, shot, scene, or workflow to view its version history.
        </div>
      </div>
    );
  }

  const handleRestore = (versionId: string) => {
    console.log('Restore version:', versionId);
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Version History</h3>
      <div className="space-y-2">
        {mockVersions.map(version => (
          <div
            key={version.id}
            onClick={() => setSelectedVersion(version.id)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedVersion === version.id
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">v{version.number}</span>
              <span className="text-xs text-slate-500">{version.createdAt}</span>
            </div>
            <div className="text-xs text-slate-600 mb-2">{version.description}</div>
            <div className="text-xs text-slate-400">by {version.createdBy}</div>
          </div>
        ))}
      </div>
      {selectedVersion && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleRestore(selectedVersion)}
            className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Restore
          </button>
          <button
            onClick={() => setSelectedVersion(null)}
            className="px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
