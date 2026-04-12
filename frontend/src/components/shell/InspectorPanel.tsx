import { useSelectionStore } from '../../stores';
import { WorkflowInspector } from './WorkflowInspector';

interface PropertyRow {
  label: string;
  value: string | number | null;
}

export function InspectorPanel() {
  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedSceneId = useSelectionStore(s => s.selectedSceneId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const selectedFileId = useSelectionStore(s => s.selectedFileId);

  // Workflow — render the full WorkflowInspector
  if (selectedWorkflowId) {
    return <WorkflowInspector workflowId={selectedWorkflowId} />;
  }

  if (
    !selectedAssetId &&
    !selectedShotId &&
    !selectedSceneId &&
    !selectedFileId
  ) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Inspector</h3>
        <div className="text-sm text-slate-500">
          Select an asset, shot, scene, workflow, or file to view its details and metadata.
        </div>
      </div>
    );
  }

  const getProperties = (): PropertyRow[] => {
    if (selectedAssetId) {
      return [
        { label: 'Type', value: 'Asset' },
        { label: 'ID', value: selectedAssetId.slice(0, 8) + '...' },
        { label: 'Status', value: 'Ready' },
        { label: 'Created', value: new Date().toLocaleDateString() },
      ];
    }
    if (selectedShotId) {
      return [
        { label: 'Type', value: 'Shot' },
        { label: 'ID', value: selectedShotId.slice(0, 8) + '...' },
        { label: 'Duration', value: '3s' },
        { label: 'Camera', value: 'Medium' },
      ];
    }
    if (selectedSceneId) {
      return [
        { label: 'Type', value: 'Scene' },
        { label: 'ID', value: selectedSceneId.slice(0, 8) + '...' },
        { label: 'Shots', value: 5 },
      ];
    }
    if (selectedFileId) {
      return [
        { label: 'Type', value: 'File' },
        { label: 'ID', value: selectedFileId.slice(0, 8) + '...' },
        { label: 'Size', value: '2.4 MB' },
      ];
    }
    return [];
  };

  const properties = getProperties();

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Inspector</h3>
      <div className="space-y-3">
        {properties.map(prop => (
          <div key={prop.label} className="flex justify-between text-sm">
            <span className="text-slate-500">{prop.label}</span>
            <span className="text-slate-700 font-medium">{prop.value ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
