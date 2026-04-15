import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore, useEventStore, type PageId } from '../../stores';
import { fetchProjectWorkflows, createWorkflow, deleteWorkflow } from '../../lib/api';
import { createWorkflowDraftFromTemplate } from '../../lib/workflowCatalog';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    id: 'workflows',
    label: 'Workflows',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
  {
    id: 'canon',
    label: 'Story & Canon',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    id: 'scenes',
    label: 'Scenes',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
      </svg>
    ),
  },
  {
    id: 'shots',
    label: 'Shots',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: 'outputs',
    label: 'Outputs',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'review',
    label: 'Review',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
];

// Home sidebar content when no project is open
function HomeSidebarContent() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { pathname } = useLocation();
  const projectId = pathname.match(/\/projects\/([^\/]+)/)?.[1] ?? null;
  const [showWorkflowsModal, setShowWorkflowsModal] = useState(false);

  const workflowsQuery = useQuery({
    queryKey: ['project-workflows', projectId],
    queryFn: () => (projectId ? fetchProjectWorkflows(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const navigate = useNavigate();

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: workflow => {
      workflowsQuery.refetch();
      setShowWorkflowsModal(false);
      sessionStorage.setItem('pendingWorkflowId', workflow.id);
      navigate(`/projects/${projectId}/workflows`);
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => workflowsQuery.refetch(),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-light)]">
        {!sidebarCollapsed && (
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Menu
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => setShowWorkflowsModal(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          {!sidebarCollapsed && <span>Workflows</span>}
        </button>
      </nav>

      {showWorkflowsModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setShowWorkflowsModal(false)}
            />
            <div
              style={{
                position: 'relative',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '400px',
                maxHeight: '80vh',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Workflows
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {projectId && (
                    <button
                      onClick={() => {
                        const template = createWorkflowDraftFromTemplate('storyboard_from_story');
                        createWorkflowMutation.mutate({
                          projectId: projectId!,
                          title: template.title,
                          description: template.description,
                          mode: 'advanced',
                          template_type: template.template_type,
                          nodes: template.nodes,
                          edges: template.edges,
                        });
                      }}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      + Create New
                    </button>
                  )}
                  <button
                    onClick={() => setShowWorkflowsModal(false)}
                    style={{ padding: '4px', borderRadius: '4px' }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div style={{ padding: '16px', maxHeight: '60vh', overflow: 'auto' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Debug: projectId = {projectId || 'none'}
                </p>
                {!projectId ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    Open a project first, then click Workflows to view the list.
                  </p>
                ) : workflowsQuery.isLoading || !workflowsQuery.data ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    Loading workflows...
                  </p>
                ) : workflowsQuery.isError ? (
                  <p style={{ fontSize: '14px', color: 'var(--error)' }}>Error loading workflows</p>
                ) : workflowsQuery.data.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p
                      style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}
                    >
                      This project has no workflows yet.
                    </p>
                    <button
                      onClick={() => {
                        const template = createWorkflowDraftFromTemplate('storyboard_from_story');
                        createWorkflowMutation.mutate({
                          projectId,
                          title: template.title,
                          description: template.description,
                          mode: 'advanced',
                          template_type: template.template_type,
                          nodes: template.nodes,
                          edges: template.edges,
                        });
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      + Create Workflow
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workflowsQuery.data.map(workflow => (
                      <div
                        key={workflow.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                      >
                        <button
                          onClick={() => {
                            setShowWorkflowsModal(false);
                            sessionStorage.setItem('pendingWorkflowId', workflow.id);
                            window.location.href = `/projects/${projectId}/workflows`;
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            textAlign: 'left',
                            borderRadius: '4px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-elevated)',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {workflow.title}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            {workflow.nodes?.length || 0} nodes • {workflow.mode}
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${workflow.title}"?`)) {
                              deleteWorkflowMutation.mutate(workflow.id);
                            }
                          }}
                          disabled={deleteWorkflowMutation.isPending}
                          title="Delete workflow"
                          style={{
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: deleteWorkflowMutation.isPending ? 'not-allowed' : 'pointer',
                            color: 'var(--text-muted)',
                            opacity: deleteWorkflowMutation.isPending ? 0.5 : 1,
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// Project sidebar content
function ProjectSidebarContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const projectId = pathname.match(/\/projects\/([^/]+)/)?.[1];
  const { sidebarCollapsed, toggleSidebar, currentProjectTitle } = useAppStore();
  const unreadCount = useEventStore(s => s.unreadNotificationCount);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showWorkflowsModal, setShowWorkflowsModal] = useState(false);

  const workflowsQuery = useQuery({
    queryKey: ['project-workflows', projectId],
    queryFn: () => (projectId ? fetchProjectWorkflows(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: workflow => {
      workflowsQuery.refetch();
      setShowWorkflowsModal(false);
      sessionStorage.setItem('pendingWorkflowId', workflow.id);
      navigate(`/projects/${projectId}/workflows`);
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => workflowsQuery.refetch(),
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Project Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-light)]">
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide block truncate">
              Project
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
              {currentProjectTitle || 'Project'}
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(item => (
          <div key={item.id}>
            {item.children ? (
              // Group with children
              <div>
                <button
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    sidebarCollapsed ? 'justify-center' : ''
                  } text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`}
                >
                  {!sidebarCollapsed && (
                    <>
                      <span>{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedGroups.has(item.id) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </>
                  )}
                  {sidebarCollapsed && <span>{item.icon}</span>}
                </button>
                {!sidebarCollapsed && expandedGroups.has(item.id) && (
                  <div className="ml-6 border-l border-[var(--border-light)]">
                    {item.children.map(child => (
                      <NavLink
                        key={child.id}
                        to={`/projects/${projectId}/${child.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`
                        }
                      >
                        <span>{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : item.id === 'workflows' ? (
              <button
                onClick={() => setShowWorkflowsModal(true)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  sidebarCollapsed ? 'justify-center' : ''
                } text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ) : (
              // Simple nav item
              <NavLink
                to={`/projects/${projectId}/${item.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    sidebarCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`
                }
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {item.id === 'activity' && unreadCount > 0 && !sidebarCollapsed && (
                  <span className="ml-auto bg-[var(--error)] text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {item.id === 'activity' && unreadCount > 0 && sidebarCollapsed && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--error)] rounded-full" />
                )}
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-[var(--border-light)]">
          <div className="text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  useAppStore.getState().connectionStatus === 'connected'
                    ? 'bg-[var(--success)]'
                    : 'bg-[var(--warning)]'
                }`}
              />
              <span>
                {useAppStore.getState().connectionStatus === 'connected'
                  ? 'Backend Connected'
                  : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {showWorkflowsModal &&
        projectId &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setShowWorkflowsModal(false)}
            />
            <div
              style={{
                position: 'relative',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '400px',
                maxHeight: '80vh',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Workflows
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const template = createWorkflowDraftFromTemplate('storyboard_from_story');
                      createWorkflowMutation.mutate({
                        projectId: projectId!,
                        title: template.title,
                        description: template.description,
                        mode: 'advanced',
                        template_type: template.template_type,
                        nodes: template.nodes,
                        edges: template.edges,
                      });
                    }}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    + Create New
                  </button>
                  <button
                    onClick={() => setShowWorkflowsModal(false)}
                    style={{ padding: '4px', borderRadius: '4px' }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div style={{ padding: '16px', maxHeight: '60vh', overflow: 'auto' }}>
                {workflowsQuery.isLoading || !workflowsQuery.data ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    Loading workflows...
                  </p>
                ) : workflowsQuery.data.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p
                      style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}
                    >
                      No workflows yet.
                    </p>
                    <button
                      onClick={() => {
                        const template = createWorkflowDraftFromTemplate('storyboard_from_story');
                        createWorkflowMutation.mutate({
                          projectId: projectId!,
                          title: template.title,
                          description: template.description,
                          mode: 'advanced',
                          template_type: template.template_type,
                          nodes: template.nodes,
                          edges: template.edges,
                        });
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      + Create Workflow
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workflowsQuery.data.map(workflow => (
                      <div
                        key={workflow.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                      >
                        <button
                          onClick={() => {
                            setShowWorkflowsModal(false);
                            sessionStorage.setItem('pendingWorkflowId', workflow.id);
                            window.location.href = `/projects/${projectId}/workflows`;
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            textAlign: 'left',
                            borderRadius: '4px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-elevated)',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {workflow.title}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            {workflow.nodes?.length || 0} nodes • {workflow.mode}
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${workflow.title}"?`)) {
                              deleteWorkflowMutation.mutate(workflow.id);
                            }
                          }}
                          disabled={deleteWorkflowMutation.isPending}
                          title="Delete workflow"
                          style={{
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: deleteWorkflowMutation.isPending ? 'not-allowed' : 'pointer',
                            color: 'var(--text-muted)',
                            opacity: deleteWorkflowMutation.isPending ? 0.5 : 1,
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const projectId = pathname.match(/\/projects\/([^\/]+)/)?.[1];
  const { sidebarCollapsed } = useAppStore();

  return (
    <aside
      className={`bg-[var(--bg-base)] border-r border-[var(--border-light)] flex flex-col z-20 transition-all duration-200 ${
        sidebarCollapsed ? 'w-14' : 'w-60'
      }`}
      style={{ height: 'calc(100vh - 48px)' }}
    >
      {projectId ? <ProjectSidebarContent /> : <HomeSidebarContent />}
    </aside>
  );
}
