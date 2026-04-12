import type { Version } from './DiffViewer';

interface VersionSelectorProps {
  label: string;
  versions: Version[];
  selectedVersion: Version;
  onSelect: (version: Version) => void;
}

export function VersionSelector({
  label,
  versions,
  selectedVersion,
  onSelect,
}: VersionSelectorProps) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-2">{label}</div>
      <select
        value={selectedVersion.id}
        onChange={e => {
          const version = versions.find(v => v.id === e.target.value);
          if (version) onSelect(version);
        }}
        className="w-full text-sm border border-slate-200 rounded px-3 py-2 bg-white"
      >
        {versions.map(version => (
          <option key={version.id} value={version.id}>
            v{version.number} {version.label ? `(${version.label})` : ''} - {version.createdAt}
          </option>
        ))}
      </select>
    </div>
  );
}
