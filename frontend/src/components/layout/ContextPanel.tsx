import { useLocation } from 'react-router-dom';
import { usePanelStore } from '../../stores';
import { PanelTabs } from '../common';

import { InspectorPanel } from '../shell/InspectorPanel';
import { VersionsPanel } from '../shell/VersionsPanel';
import { ValidationPanel } from '../shell/ValidationPanel';
import { CommentsPanel } from '../shell/CommentsPanel';
import { CopilotPanel } from '../shell/CopilotPanel';

// Default tab by page
const defaultTabsByPage: Record<string, string> = {
  sources: 'copilot',
  canon: 'copilot',
  scenes: 'copilot',
  shots: 'copilot',
  workflows: 'inspector',
  outputs: 'copilot',
  timeline: 'copilot',
  review: 'copilot',
  activity: 'copilot',
};

const tabs = [
  { id: 'copilot', label: 'Copilot' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'versions', label: 'Versions' },
  { id: 'validation', label: 'Validation' },
  { id: 'comments', label: 'Comments' },
];

const tabContent: Record<string, React.FC> = {
  inspector: InspectorPanel,
  versions: VersionsPanel,
  validation: ValidationPanel,
  comments: CommentsPanel,
  copilot: CopilotPanel,
};

export function ContextPanel() {
  const location = useLocation();
  const { rightPanelOpen, rightPanelTab, setRightPanelTab } = usePanelStore();

  // Get current page to determine default tab
  const currentPage = location.pathname.split('/').pop() || 'home';
  const defaultTab = defaultTabsByPage[currentPage] || 'inspector';

  // Set default tab when page changes
  const activeTab = rightPanelTab || defaultTab;

  const ActiveContent = tabContent[activeTab] || InspectorPanel;

  if (!rightPanelOpen) {
    return null;
  }

  return (
    <aside className="bg-[var(--bg-base)] border-l border-[var(--border-light)] flex flex-col z-20 h-full min-h-0 overflow-hidden">
      {/* Tab Bar */}
      <PanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={tab => setRightPanelTab(tab as typeof rightPanelTab)}
        className="flex-shrink-0"
      />

      {/* Tab Content */}
      <div className={`flex-1 min-h-0 ${activeTab === 'copilot' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <ActiveContent />
      </div>
    </aside>
  );
}
