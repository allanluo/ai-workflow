import { ReactNode, useState, createContext, useContext } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  onChange?: (tab: string) => void;
  className?: string;
}

export function Tabs({ defaultTab, children, onChange, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={`tabs ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}

export function Tab({ value, children, disabled = false }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      className={`tab ${isActive ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && setActiveTab(value)}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = '' }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== value) return null;

  return <div className={className}>{children}</div>;
}

// Vertical Tabs Variant
interface VerticalTabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function VerticalTabs({ tabs, activeTab, onChange, className = '' }: VerticalTabsProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`list-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="list-item-icon">{tab.icon}</span>}
          <span className="list-item-title">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// Panel-style tabs (for context panels)
interface PanelTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function PanelTabs({ tabs, activeTab, onChange, className = '' }: PanelTabsProps) {
  return (
    <div className={`panel-header ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            activeTab === tab.id
              ? 'bg-bg-active text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
