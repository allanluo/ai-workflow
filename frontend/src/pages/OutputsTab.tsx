import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Badge, Modal } from '../components/common';
import { API_BASE_URL, fetchProjectAssets } from '../lib/api';
import { showToast } from '../stores';

interface OutputsTabProps {
  projectId: string;
}

interface Output {
  id: string;
  title: string;
  output_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function OutputsTab({ projectId }: OutputsTabProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<Output | null>(null);
  const [showConfigure, setShowConfigure] = useState(false);

  const outputsQuery = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/outputs`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
  });

  const assetsQuery = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
  });

  const scenes = (assetsQuery.data?.filter(a => a.asset_type === 'scene' && a.status !== 'deprecated') || []).sort(
    (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
  );
  const shotPlans = (assetsQuery.data?.filter(a => {
    if (a.asset_type !== 'shot_plan' || a.status === 'deprecated') return false;
    // Filter out old legacy garbage assets
    const title = (a.title || '').toLowerCase();
    if (title.includes('llm_text') || title.includes('generate_shot_plan')) return false;
    return true;
  }) || []).sort(
    (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
  );


  const handleExport = (output: any) => {
    const formatMap: Record<string, string> = {
      film: 'mp4',
      music_video: 'mp4',
      short_form_video: 'mp4',
      audio_story: 'mp3',
    };
    
    const outputType = output.output_type || 'film';
    const format = formatMap[outputType] || 'mp4';
    
    // We need the output_version_id, not the output_id
    const outputVersionId = output.current_version_id || output.current_version?.id;
    
    if (!outputVersionId) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: 'This output has no configured versions. Click "Configure" to create one first.'
      });
      return;
    }

    createExportMutation.mutate({
      output_version_id: outputVersionId,
      export_format: format,
    });
  };

  const createExportMutation = useMutation({
    mutationFn: async (input: { output_version_id: string; export_format: string }) => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create export');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] });
      showToast({
        type: 'success',
        title: 'Export Started',
        message: 'Your sequence is now rendering in the background.',
      });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Unknown error starting export',
      });
    }
  });

  const createOutputMutation = useMutation({
    mutationFn: async (input: { title: string; output_type: string }) => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/outputs`, {
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

  const exportsQuery = useQuery({
    queryKey: ['exports', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/exports`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
    refetchInterval: 5000, // Refresh every 5s to show job status
  });

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
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedOutput(output);
                        setShowConfigure(true);
                      }}
                    >
                      Configure
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!confirm('This will start an export render. Continue?')) return;
                        handleExport(output);
                      }}
                      disabled={createExportMutation.isPending}
                    >
                      {createExportMutation.isPending ? 'Exporting...' : 'Export'}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2">
                  Last configured:{' '}
                  {output.updated_at ? new Date(output.updated_at).toLocaleString() : 'Never'}
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
          <div className="space-y-3">
            {[...exportsQuery.data]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((job: any) => (
              <div key={job.id} className="card flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <span
                    className={`badge ${
                      job.status === 'completed'
                        ? 'badge-success'
                        : job.status === 'running' || job.status === 'queued'
                          ? 'badge-running'
                          : job.status === 'failed'
                            ? 'badge-error'
                            : 'badge-draft'
                    }`}
                  >
                    {job.status === 'queued' ? 'processing' : job.status}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      Export: {job.export_format.toUpperCase()}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      Output ID: {job.output_version_id.slice(0, 8)}...
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(job.created_at).toLocaleTimeString()}
                  </span>
                  {job.status === 'completed' && job.output_path && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        // The output_path might be a full path, but we usually serve via file ID or a special route
                        // For now, let's assume we can hit a download route
                        window.open(`${API_BASE_URL}/exports/${job.id}/download`, '_blank');
                      }}
                    >
                      Download Video
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
            No export jobs yet. Run a workflow to generate outputs.
          </div>
        )}
      </div>

      {showConfigure && selectedOutput && (
        <ConfigureOutputModal
          output={selectedOutput}
          shotPlans={shotPlans}
          onClose={() => setShowConfigure(false)}
          onSave={versionIds => {
            console.log('Saved version with asset IDs:', versionIds);
            setShowConfigure(false);
          }}
        />
      )}
    </div>
  );
}

interface ConfigureOutputModalProps {
  output: Output;
  shotPlans: any[];
  onClose: () => void;
  onSave: (assetVersionIds: string[]) => void;
}

function ConfigureOutputModal({
  output,
  shotPlans,
  onClose,
  onSave,
}: ConfigureOutputModalProps) {
  const [selectedShots, setSelectedShots] = useState<string[]>([]);
  const [order, setOrder] = useState<{ type: 'shot'; id: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Auto-select the latest shot plan on initial load
  useEffect(() => {
    const initialShots = [];
    const initialOrder = [];
    
    if (shotPlans.length > 0) {
      initialShots.push(shotPlans[0].id);
      initialOrder.push({ type: 'shot' as const, id: shotPlans[0].id });
    }
    
    setSelectedShots(initialShots);
    setOrder(initialOrder);
  }, []); // Run once on mount

  const toggleShot = (shotId: string) => {
    if (selectedShots.includes(shotId)) {
      setSelectedShots(selectedShots.filter(id => id !== shotId));
      setOrder(order.filter(o => o.id !== shotId));
    } else {
      setSelectedShots([...selectedShots, shotId]);
      setOrder([...order, { type: 'shot', id: shotId }]);
    }
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...order];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setOrder(newOrder);
    }
  };

  const moveDown = (index: number) => {
    if (index < order.length - 1) {
      const newOrder = [...order];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setOrder(newOrder);
    }
  };

  const handleSave = () => {
    const assetVersionIds = order
      .map(o => {
        const shot = shotPlans.find(s => s.id === o.id);
        return shot?.current_version_id || shot?.current_approved_asset_version_id;
      })
      .filter(Boolean) as string[];
    onSave(assetVersionIds);
  };

  const displayShots = showHistory ? shotPlans : shotPlans.slice(0, 10); // Show up to 10 recent

  return (
    <Modal isOpen={true} onClose={onClose} title={`Configure Output Sequence: ${output.title}`} size="full">
      <div className="flex flex-1 h-full overflow-hidden bg-[var(--bg-base)] rounded-b-xl">
        {/* LEFT PANE: Asset Library */}
        <div className="flex-[3] flex flex-col border-r border-[var(--border)] overflow-hidden min-w-[500px]">
          <div className="p-5 border-b border-[var(--border-light)] bg-[var(--bg-elevated)] flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18" />
                </svg>
                Shot Library
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Select shots to add them to your timeline</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Showing Full History' : 'Showing Recent Only'}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {displayShots.map(shot => {
                const isSelected = selectedShots.includes(shot.id);
                return (
                  <div
                    key={shot.id}
                    onClick={() => toggleShot(shot.id)}
                    className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-1 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-[0_0_15px_rgba(91,141,239,0.2)]'
                        : 'border-[var(--border-light)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-[var(--text-primary)] truncate text-sm">
                          {shot.title || 'Untitled Shot'}
                        </span>
                        {isSelected && (
                          <span className="bg-[var(--accent)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ADDED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-3">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        {shot.updated_at ? new Date(shot.updated_at).toLocaleString() : 'Unknown date'}
                      </div>
                    </div>
                    {/* Add overlay on hover */}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'hidden' : ''}`}>
                      <span className="bg-[var(--accent)] text-white text-xs font-semibold px-3 py-1.5 rounded shadow-lg flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        Add to Sequence
                      </span>
                    </div>
                  </div>
                );
              })}
              {displayShots.length === 0 && (
                <div className="col-span-full py-12 text-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-xl">
                  No shot plans available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Timeline Builder */}
        <div className="flex-[2] flex flex-col bg-[var(--bg-elevated)] min-w-[350px]">
          <div className="p-5 border-b border-[var(--border-light)] flex-shrink-0">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              Sequence Timeline
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {order.length} {order.length === 1 ? 'shot' : 'shots'} configured
            </p>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {order.length > 0 ? (
              <div className="space-y-3">
                {order.map((item, index) => {
                  const shot = shotPlans.find(p => p.id === item.id);
                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className="group flex items-center gap-3 p-3 bg-[var(--bg-hover)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-md bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 shadow-inner">
                        <span className="text-xs font-mono font-bold text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                          {index + 1}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {shot?.title || 'Unknown Shot'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] rounded disabled:opacity-30"
                          title="Move Up"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === order.length - 1}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] rounded disabled:opacity-30"
                          title="Move Down"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                        <div className="w-px h-4 bg-[var(--border)] mx-1" />
                        <button
                          onClick={() => toggleShot(item.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-colors"
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-base)]">
                <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-[var(--text-primary)] font-medium mb-1">Timeline is empty</p>
                <p className="text-sm text-[var(--text-muted)]">Click on shot cards from the library to add them to your sequence.</p>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex justify-end gap-3 flex-shrink-0">
            <Button variant="ghost" onClick={onClose} className="px-6">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} className="px-8 shadow-[0_0_15px_rgba(91,141,239,0.3)] hover:shadow-[0_0_20px_rgba(91,141,239,0.5)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save Timeline
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
