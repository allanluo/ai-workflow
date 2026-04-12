import { useSelectionStore } from '../../stores';

interface ValidationResult {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  timestamp: string;
}

const mockValidationResults: ValidationResult[] = [
  {
    id: '1',
    severity: 'warning',
    message: 'Shot missing camera angle',
    field: 'camera',
    timestamp: '5 min ago',
  },
  {
    id: '2',
    severity: 'info',
    message: 'Prompt could be more specific',
    field: 'prompt',
    timestamp: '10 min ago',
  },
];

export function ValidationPanel() {
  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedSceneId = useSelectionStore(s => s.selectedSceneId);

  const hasSelection = selectedAssetId || selectedShotId || selectedSceneId;

  if (!hasSelection) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Validation</h3>
        <div className="text-sm text-slate-500">
          Select an asset, shot, or scene to view validation results.
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Validation Results</h3>
      {mockValidationResults.length === 0 ? (
        <div className="text-sm text-slate-500">No validation issues found.</div>
      ) : (
        <div className="space-y-2">
          {mockValidationResults.map(result => (
            <div
              key={result.id}
              className={`p-3 rounded-lg border text-sm ${getSeverityColor(result.severity)}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium capitalize">{result.severity}</span>
                <span className="text-xs opacity-70">{result.timestamp}</span>
              </div>
              <div>{result.message}</div>
              {result.field && <div className="text-xs mt-1 opacity-70">Field: {result.field}</div>}
            </div>
          ))}
        </div>
      )}
      <button className="mt-4 w-full px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
        Run Validation
      </button>
    </div>
  );
}
