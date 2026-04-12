import { useState } from 'react';
import { TextDiff } from './TextDiff';
import { MediaCompare } from './MediaCompare';
import { VersionSelector } from './VersionSelector';

interface DiffViewerProps {
  type: 'text' | 'media' | 'structured';
  assetId: string;
}

export interface Version {
  id: string;
  number: number;
  createdAt: string;
  label?: string;
}

const mockVersions: Version[] = [
  { id: 'v3', number: 3, createdAt: '2 hours ago', label: 'Current' },
  { id: 'v2', number: 2, createdAt: 'Yesterday' },
  { id: 'v1', number: 1, createdAt: '2 days ago' },
];

const mockTextDiff = {
  old: `Title: City Street Scene

Description: A wide shot of a futuristic city street at sunset with neon lights reflecting on wet pavement.

Characters: John, Sarah
Location: Downtown - Main Street
Time: Evening, golden hour`,
  new: `Title: Urban Alleyway

Description: A medium shot of a dark urban alleyway at night with rain and steam rising from vents.

Characters: John, Sarah, Mike
Location: Downtown - Side Street
Time: Night, rainy`,
};

const mockMediaVersions = [
  { id: 'v3', url: 'https://picsum.photos/400/300?random=10', label: 'Current' },
  { id: 'v2', url: 'https://picsum.photos/400/300?random=11', label: 'Previous' },
];

export function DiffViewer({ type, assetId }: DiffViewerProps) {
  const [baselineVersion, setBaselineVersion] = useState(mockVersions[1]);
  const [candidateVersion, setCandidateVersion] = useState(mockVersions[0]);

  const handleSwap = () => {
    const temp = baselineVersion;
    setBaselineVersion(candidateVersion);
    setCandidateVersion(temp);
  };

  const getChangedFields = () => {
    if (type === 'text') {
      const oldLines = mockTextDiff.old.split('\n');
      const newLines = mockTextDiff.new.split('\n');
      const changes: { field: string; oldValue: string; newValue: string }[] = [];

      const fieldNames = ['Title', 'Description', 'Characters', 'Location', 'Time'];
      const oldFields: Record<string, string> = {};
      const newFields: Record<string, string> = {};

      oldLines.forEach(line => {
        const [key, ...valueParts] = line.split(': ');
        if (key && valueParts.length) oldFields[key] = valueParts.join(': ');
      });
      newLines.forEach(line => {
        const [key, ...valueParts] = line.split(': ');
        if (key && valueParts.length) newFields[key] = valueParts.join(': ');
      });

      fieldNames.forEach(field => {
        if (oldFields[field] !== newFields[field]) {
          changes.push({
            field,
            oldValue: oldFields[field] || '',
            newValue: newFields[field] || '',
          });
        }
      });
      return changes;
    }
    return [];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-700">Compare</h2>
          <span className="text-sm text-slate-500">Asset: {assetId.slice(0, 8)}...</span>
        </div>
        <button
          onClick={handleSwap}
          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
        >
          Swap
        </button>
      </div>

      {/* Version Selectors */}
      <div className="flex border-b border-slate-200">
        <div className="flex-1 p-3 border-r border-slate-200">
          <VersionSelector
            label="Baseline"
            versions={mockVersions}
            selectedVersion={baselineVersion}
            onSelect={setBaselineVersion}
          />
        </div>
        <div className="flex-1 p-3">
          <VersionSelector
            label="Compare"
            versions={mockVersions}
            selectedVersion={candidateVersion}
            onSelect={setCandidateVersion}
          />
        </div>
      </div>

      {/* Changed Fields Summary */}
      {type !== 'media' && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="text-sm font-medium text-amber-800 mb-2">
            {getChangedFields().length} changed field(s)
          </div>
          <div className="flex flex-wrap gap-2">
            {getChangedFields().map(change => (
              <span
                key={change.field}
                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded"
              >
                {change.field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diff Content */}
      <div className="flex-1 overflow-auto p-4">
        {type === 'text' && <TextDiff oldText={mockTextDiff.old} newText={mockTextDiff.new} />}
        {type === 'media' && (
          <MediaCompare
            baselineUrl={mockMediaVersions[1].url}
            candidateUrl={mockMediaVersions[0].url}
          />
        )}
        {type === 'structured' && (
          <div className="space-y-4">
            {getChangedFields().map(change => (
              <div
                key={change.field}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 border-b border-slate-200">
                  {change.field}
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="p-3">
                    <div className="text-xs text-slate-500 mb-1">Baseline</div>
                    <div className="text-sm text-red-600 line-through">
                      {change.oldValue || '(empty)'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-slate-500 mb-1">Candidate</div>
                    <div className="text-sm text-green-600">{change.newValue || '(empty)'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
