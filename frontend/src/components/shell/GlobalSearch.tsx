import { useState } from 'react';

interface SearchResult {
  id: string;
  type: 'asset' | 'workflow' | 'output' | 'shot' | 'scene';
  title: string;
  subtitle: string;
}

const mockResults: SearchResult[] = [
  { id: 'a1', type: 'asset', title: 'hero-shot.png', subtitle: 'Sources' },
  { id: 'a2', type: 'workflow', title: 'Image Generation', subtitle: 'Workflows' },
  { id: 'a3', type: 'shot', title: 'Shot 5', subtitle: 'Shots' },
  { id: 'a4', type: 'scene', title: 'City Chase', subtitle: 'Scenes' },
];

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredResults = query
    ? mockResults.filter(r => r.title.toLowerCase().includes(query.toLowerCase()))
    : [];

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'asset':
        return '📄';
      case 'workflow':
        return '⚡';
      case 'output':
        return '🎬';
      case 'shot':
        return '🎥';
      case 'scene':
        return '🎭';
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌘</span>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Search..."
            className="w-48 pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {isOpen && filteredResults.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">{filteredResults.length} results</span>
          </div>
          <div className="max-h-64 overflow-auto">
            {filteredResults.map(result => (
              <button
                key={result.id}
                onClick={() => {
                  console.log('Navigate to:', result);
                  setQuery('');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <span className="text-sm">{getTypeIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{result.title}</div>
                  <div className="text-xs text-slate-500">{result.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
