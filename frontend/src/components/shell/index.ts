// Re-export from new layout components
export { Shell } from '../layout/Shell';
export { MenuBar } from '../layout/MenuBar';
export { Sidebar } from '../layout/Sidebar';
export { TopToolbar } from '../layout/TopToolbar';
export { ContextPanel } from '../layout/ContextPanel';
export { ActivityDock } from '../layout/ActivityDock';

// Keep these for backward compatibility - they now import from layout
export { CopilotPanel } from './CopilotPanel';
export { CommentsPanel } from './CommentsPanel';
export { ValidationPanel } from './ValidationPanel';
export { VersionsPanel } from './VersionsPanel';
export { InspectorPanel } from './InspectorPanel';
export { WorkflowInspector } from './WorkflowInspector';
export { ToastContainer } from './ToastContainer';
