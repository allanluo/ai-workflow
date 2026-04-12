import { usePanelStore, type RightPanelTab } from '../../stores';
import { CopilotPanel } from './CopilotPanel';
import { InspectorPanel } from './InspectorPanel';
import { VersionsPanel } from './VersionsPanel';
import { ValidationPanel } from './ValidationPanel';
import { CommentsPanel } from './CommentsPanel';

const tabs: { id: RightPanelTab; label: string; icon: string }[] = [
  { id: 'inspector', label: 'Inspector', icon: '🔍' },
  { id: 'versions', label: 'Versions', icon: '📋' },
  { id: 'copilot', label: 'Copilot', icon: '🤖' },
  { id: 'validation', label: 'Validation', icon: '✓' },
  { id: 'comments', label: 'Comments', icon: '💬' },
];

export function RightContextPanel() {
  const { rightPanelTab, setRightPanelTab, rightPanelOpen, setRightPanelOpen } = usePanelStore();

  if (!rightPanelOpen) {
    return (
      <div className="flex flex-col items-center py-2 h-full gap-2">
        <button
          onClick={() => setRightPanelOpen(true)}
          className="p-2 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mb-2"
          title="Expand right panel"
        >
          <svg className="w-5 h-5 transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        {tabs.map(tab => (
           <button
             key={tab.id}
             onClick={() => setRightPanelTab(tab.id)}
             className={`p-2 rounded transition-colors ${
               rightPanelTab === tab.id
                 ? 'bg-blue-100 text-blue-600'
                 : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
             }`}
             title={tab.label}
           >
             <span className="text-lg">{tab.icon}</span>
           </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-200 justify-between items-center pr-2">
        <div className="flex flex-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              rightPanelTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        ))}
        </div>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-2"
          title="Collapse right panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {rightPanelTab === 'inspector' && <InspectorPanel />}
        {rightPanelTab === 'versions' && <VersionsPanel />}
        {rightPanelTab === 'copilot' && <CopilotPanel />}
        {rightPanelTab === 'validation' && <ValidationPanel />}
        {rightPanelTab === 'comments' && <CommentsPanel />}
      </div>
    </div>
  );
}
