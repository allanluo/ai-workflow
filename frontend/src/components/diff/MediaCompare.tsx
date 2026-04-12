import { useState } from 'react';

interface MediaCompareProps {
  baselineUrl: string;
  candidateUrl: string;
}

type ViewMode = 'side-by-side' | 'overlay' | 'diff';

export function MediaCompare({ baselineUrl, candidateUrl }: MediaCompareProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('side-by-side')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            viewMode === 'side-by-side'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Side by Side
        </button>
        <button
          onClick={() => setViewMode('overlay')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            viewMode === 'overlay' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Overlay
        </button>
        <button
          onClick={() => setViewMode('diff')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            viewMode === 'diff' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Difference
        </button>
      </div>

      {/* Compare View */}
      {viewMode === 'side-by-side' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">Baseline</div>
            <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
              <img src={baselineUrl} alt="Baseline" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">Candidate</div>
            <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
              <img src={candidateUrl} alt="Candidate" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'overlay' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Baseline</span>
            <input
              type="range"
              min={0}
              max={100}
              value={overlayOpacity}
              onChange={e => setOverlayOpacity(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-slate-600">Candidate</span>
          </div>
          <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
            <img
              src={baselineUrl}
              alt="Baseline"
              className="absolute inset-0 w-full h-full object-contain"
            />
            <img
              src={candidateUrl}
              alt="Candidate"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: overlayOpacity / 100 }}
            />
          </div>
        </div>
      )}

      {viewMode === 'diff' && (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">Difference visualization (simplified)</div>
          <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
            <div className="text-slate-400 text-center">
              <div className="text-lg mb-2">🔬</div>
              <div className="text-sm">Difference detection</div>
              <div className="text-xs text-slate-500">Would require image processing library</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
