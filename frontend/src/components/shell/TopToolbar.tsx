import { Link, useParams } from 'react-router-dom';
import { useAppStore, usePanelStore } from '../../stores';
import { GlobalSearch } from './GlobalSearch';
import { GlobalCreateMenu } from './GlobalCreateMenu';

export function TopToolbar() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProjectTitle } = useAppStore();
  const { rightPanelOpen, toggleRightPanel } = usePanelStore();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-slate-700 hover:text-slate-900">
          <span className="text-xl">🎬</span>
          <span className="font-semibold">AI Workflow</span>
        </Link>

        {projectId && (
          <>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">{currentProjectTitle || 'Project'}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <GlobalSearch />

        {projectId && (
          <>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              Advanced
            </div>

            <button
              onClick={toggleRightPanel}
              className={`p-2 rounded-lg transition-colors ${
                rightPanelOpen
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
            </button>
          </>
        )}

        <div className="flex items-center gap-2">
          <GlobalCreateMenu />

          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>

          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
