import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveWorkflowVersion, fetchWorkflowVersions, type WorkflowVersion } from '../../lib/api';
import { showToast } from '../../stores';

interface WorkflowVersionsPanelProps {
  projectId: string;
  workflowId: string;
  viewingVersionId: string | null;
  onViewVersion: (versionId: string | null) => void;
}

export function WorkflowVersionsPanel({
  projectId,
  workflowId,
  viewingVersionId,
  onViewVersion,
}: WorkflowVersionsPanelProps) {
  const queryClient = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: ['workflow-versions', workflowId],
    queryFn: () => fetchWorkflowVersions(workflowId),
    enabled: !!workflowId,
  });

  const approveMutation = useMutation({
    mutationFn: approveWorkflowVersion,
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-versions', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['project-workflows', projectId] });
      showToast({
        type: 'success',
        title: 'Version Approved',
        message: `v${version.version_number} is now the approved production version.`,
      });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Approval Failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  if (versionsQuery.isLoading) {
    return <div className="p-4 text-xs text-slate-500">Loading versions...</div>;
  }

  const versions = versionsQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-900">Version History</h3>
        <p className="text-[11px] text-slate-500 mt-1">
          Frozen snapshots of this workflow. Only approved versions should be used in production.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Draft Option */}
        <div 
          className={`group relative rounded-2xl border p-4 transition-all cursor-pointer ${
            !viewingVersionId 
              ? 'border-blue-500 bg-blue-50/30' 
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
          onClick={() => onViewVersion(null)}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Working Draft</span>
            {!viewingVersionId && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The current editable state of your workflow.
          </p>
        </div>

        <div className="h-px bg-slate-100 my-4" />

        {versions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400 italic">No frozen versions yet.</p>
          </div>
        )}

        {versions.map((version) => {
          const isViewing = viewingVersionId === version.id;
          const isApproved = version.status === 'approved';

          return (
            <div
              key={version.id}
              className={`group relative rounded-2xl border p-4 transition-all ${
                isViewing
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">v{version.version_number}</span>
                  {isApproved && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      Approved
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(version.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                {version.notes || 'No notes provided.'}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => onViewVersion(version.id)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    isViewing
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {isViewing ? 'Viewing' : 'View Snapshot'}
                </button>
                
                {!isApproved && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveMutation.mutate(version.id);
                    }}
                    disabled={approveMutation.isPending}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {approveMutation.isPending ? '...' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
