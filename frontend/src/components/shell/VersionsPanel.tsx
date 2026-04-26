import { useAppStore, useDraftStore, useSelectionStore } from '../../stores';
import { WorkflowVersionsPanel } from '../../pages/WorkflowsPage/WorkflowVersionsPanel';

export function VersionsPanel() {
  const projectId = useAppStore(s => s.currentProjectId);
  const selectedWorkflowId = useSelectionStore(s => s.selectedWorkflowId);
  const { viewingVersionId, setViewingVersionId } = useDraftStore();

  if (selectedWorkflowId && projectId) {
    return (
      <WorkflowVersionsPanel
        projectId={projectId}
        workflowId={selectedWorkflowId}
        viewingVersionId={viewingVersionId}
        onViewVersion={setViewingVersionId}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Version History</h3>
      <div className="text-sm text-slate-500">
        Select a workflow to view its version history and approve snapshots.
      </div>
      <p className="mt-4 text-[11px] text-slate-400 italic">
        General asset versioning coming soon.
      </p>
    </div>
  );
}
