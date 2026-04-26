import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Button, Input, ProjectPickerModal } from '../common';
import { useAppStore, usePanelStore, useSelectionStore } from '../../stores';
import type { Project } from '../../lib/api';

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface MenuCategory {
  id: string;
  label: string;
  items: MenuItem[];
}

export function MenuBar() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    currentProjectId,
    currentProjectTitle,
    connectionStatus,
    openProjectPicker,
    closeProjectPicker,
    setCurrentProject,
    projectPickerOpen,
  } = useAppStore();
  const { toggleRightPanel, rightPanelOpen } = usePanelStore();

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project.id, project.title);
    navigate(`/projects/${project.id}`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openProjectPicker();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openProjectPicker]);

  const menuCategories: MenuCategory[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new-project', label: 'New Project', shortcut: 'Ctrl+N', onClick: () => {} },
        {
          id: 'open-project',
          label: 'Open Project',
          shortcut: 'Ctrl+O',
          onClick: () => openProjectPicker(),
        },
        { id: 'import', label: 'Import Source', shortcut: 'Ctrl+I', onClick: () => {} },
        { id: 'sep1', label: '', separator: true },
        { id: 'export', label: 'Export...', shortcut: 'Ctrl+E', onClick: () => useSelectionStore.getState().triggerExport() },
        { id: 'sep2', label: '', separator: true },
        { id: 'close', label: 'Close Project', onClick: () => {} },
        { id: 'quit', label: 'Quit', shortcut: 'Ctrl+Q', onClick: () => {} },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => {} },
        { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => {} },
        { id: 'sep1', label: '', separator: true },
        { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', onClick: () => {} },
        { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: () => {} },
        { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {} },
        { id: 'sep2', label: '', separator: true },
        { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A', onClick: () => {} },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          id: 'toggle-sidebar',
          label: 'Toggle Sidebar',
          shortcut: 'Ctrl+B',
          onClick: () => useAppStore.getState().toggleSidebar(),
        },
        {
          id: 'toggle-panel',
          label: 'Toggle Context Panel',
          shortcut: 'Ctrl+J',
          onClick: () => toggleRightPanel(),
        },
        { id: 'toggle-dock', label: 'Toggle Activity Dock', shortcut: 'Ctrl+L', onClick: () => {} },
        { id: 'sep1', label: '', separator: true },
        { id: 'zoom-in', label: 'Zoom In', shortcut: 'Ctrl++', onClick: () => {} },
        { id: 'zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-', onClick: () => {} },
        { id: 'sep2', label: '', separator: true },
        { id: 'fullscreen', label: 'Full Screen', shortcut: 'F11', onClick: () => {} },
      ],
    },
    {
      id: 'project',
      label: 'Project',
      items: [
        { id: 'settings', label: 'Project Settings', disabled: !currentProjectId },
        { id: 'workflows', label: 'Workflows', disabled: !currentProjectId },
        { id: 'outputs', label: 'Outputs', disabled: !currentProjectId },
        { id: 'runs', label: 'Runs', disabled: !currentProjectId },
        { id: 'sep1', label: '', separator: true },
        { id: 'validate', label: 'Validate All', disabled: !currentProjectId },
        { id: 'approve', label: 'Approve All', disabled: !currentProjectId },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'docs', label: 'Documentation', onClick: () => {} },
        { id: 'shortcuts', label: 'Keyboard Shortcuts', onClick: () => {} },
        { id: 'sep1', label: '', separator: true },
        { id: 'updates', label: 'Check for Updates', onClick: () => {} },
        { id: 'about', label: 'About', onClick: () => {} },
      ],
    },
  ];

  const handleMenuClick = (menuId: string) => {
    setActiveMenu(activeMenu === menuId ? null : menuId);
  };

  const handleMenuItemClick = (item: MenuItem) => {
    if (!item.disabled && item.onClick) {
      item.onClick();
    }
    setActiveMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-12 bg-[var(--bg-elevated)] border-b border-[var(--border-light)] flex items-center px-3 gap-2 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 10l-4 4 4 4" />
            <path d="M11 14H3a2 2 0 01-2-2V8a2 2 0 012-2h8" />
            <path d="M21 14a2 2 0 00-2-2h-6l-4 4" />
          </svg>
          <span className="text-sm font-semibold">AI Workflow</span>
        </button>
      </div>

      {/* Menu Items */}
      <div className="flex items-center h-full">
        {menuCategories.map(menu => (
          <div key={menu.id} className="relative h-full">
            <button
              className={`h-full px-3 text-sm transition-colors ${
                activeMenu === menu.id
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              onClick={e => {
                e.stopPropagation();
                handleMenuClick(menu.id);
              }}
            >
              {menu.label}
            </button>

            {activeMenu === menu.id && (
              <div className="menu absolute top-full left-0 mt-1 z-50 animate-fadeIn">
                {menu.items.map(item =>
                  item.separator ? (
                    <div key={item.id} className="menu-separator" />
                  ) : (
                    <button
                      key={item.id}
                      className={`menu-item w-full text-left ${
                        item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={() => handleMenuItemClick(item)}
                      disabled={item.disabled}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[var(--text-muted)] text-xs ml-4">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Search */}
        {searchOpen ? (
          <div className="flex items-center">
            <input
              autoFocus
              type="text"
              placeholder="Search... (Ctrl+K)"
              className="input input-sm w-64"
              onBlur={() => setSearchOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-xs">Search</span>
            <span className="text-xs bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">Ctrl+K</span>
          </button>
        )}

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 px-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-[var(--success)]'
                : connectionStatus === 'connecting'
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--error)]'
            }`}
          />
          <span className="text-xs text-[var(--text-muted)]">
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'connecting'
                ? 'Connecting'
                : 'Offline'}
          </span>
        </div>

        {/* Toggle Right Panel */}
        <button
          onClick={toggleRightPanel}
          className={`p-2 rounded transition-colors ${
            rightPanelOpen
              ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>

        {/* Settings */}
        <button
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
          title="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </button>
      </div>

      <ProjectPickerModal
        isOpen={projectPickerOpen}
        onClose={closeProjectPicker}
        onSelect={handleOpenProject}
      />
    </header>
  );
}
