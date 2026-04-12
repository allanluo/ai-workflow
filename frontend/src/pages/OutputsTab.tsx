import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Badge } from '../components/common';

interface OutputsTabProps {
  projectId: string;
}

interface Output {
  id: string;
  title: string;
  output_type: string;
  status: string;
  created_at: string;
}

export function OutputsTab({ projectId }: OutputsTabProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const outputsQuery = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/outputs`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
  });

  const exportsQuery = useQuery({
    queryKey: ['exports', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/exports`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
  });

  const createOutputMutation = useMutation({
    mutationFn: async (input: { title: string; output_type: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/outputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create output');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outputs', projectId] });
      setShowCreate(false);
    },
  });

  const handleCreateOutput = (outputType: string) => {
    createOutputMutation.mutate({
      title: `New ${outputType} Output`,
      output_type: outputType,
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Outputs</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            View and manage your project's output deliverables
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
            Create Output
          </Button>
        </div>
      </div>

      {/* Output Type Quick Actions */}
      {showCreate && (
        <div className="mb-6 p-4 card">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Select Output Type
          </h3>
          <div className="flex gap-3">
            {['film', 'music_video', 'short_form_video', 'audio_story'].map(type => (
              <button
                key={type}
                onClick={() => handleCreateOutput(type)}
                disabled={createOutputMutation.isPending}
                className="btn btn-secondary btn-sm"
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Outputs List */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Output Definitions
        </h3>

        {outputsQuery.isLoading ? (
          <div className="flex-center py-8">
            <div className="spinner" />
          </div>
        ) : outputsQuery.data && outputsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {outputsQuery.data.map((output: Output) => (
              <div
                key={output.id}
                className="card hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-muted)"
                        strokeWidth="2"
                      >
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-[var(--text-primary)]">{output.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="draft">{output.output_type}</Badge>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(output.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
            No outputs yet. Create an output to define your deliverable.
          </div>
        )}
      </div>

      {/* Exports List */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Export Jobs
        </h3>

        {exportsQuery.isLoading ? (
          <div className="flex-center py-8">
            <div className="spinner" />
          </div>
        ) : exportsQuery.data && exportsQuery.data.length > 0 ? (
          <div className="space-y-2">
            {exportsQuery.data.map((job: any) => (
              <div key={job.id} className="card flex items-center gap-4">
                <span
                  className={`badge ${
                    job.status === 'completed'
                      ? 'badge-success'
                      : job.status === 'running'
                        ? 'badge-running'
                        : job.status === 'failed'
                          ? 'badge-error'
                          : 'badge-draft'
                  }`}
                >
                  {job.status}
                </span>
                <div className="flex-1">
                  <span className="text-sm text-[var(--text-primary)]">{job.export_format}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
            No export jobs yet. Run a workflow to generate outputs.
          </div>
        )}
      </div>
    </div>
  );
}
