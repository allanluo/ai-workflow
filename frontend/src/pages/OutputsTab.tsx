import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Badge, Modal } from '../components/common';
import { API_BASE_URL, fetchProjectAssets } from '../lib/api';

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

  const scenes = assetsQuery.data?.filter(a => a.asset_type === 'scene') || [];
  const shotPlans = assetsQuery.data?.filter(a => a.asset_type === 'shot_plan') || [];

  const exportsQuery = useQuery({
    queryKey: ['exports', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/exports`);
      const data = await res.json();
      return data.data?.items || [];
    },
    enabled: Boolean(projectId),
  });

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
    },
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

  const handleExport = (outputId: string, outputType: string) => {
    const formatMap: Record<string, string> = {
      film: 'mp4',
      music_video: 'mp4',
      short_form_video: 'mp4',
      audio_story: 'mp3',
    };
    const format = formatMap[outputType] || 'mp4';

    createExportMutation.mutate({
      output_version_id: outputId,
      export_format: format,
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
                        handleExport(output.id, output.output_type);
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

      {showConfigure && selectedOutput && (
        <ConfigureOutputModal
          output={selectedOutput}
          scenes={scenes}
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
  scenes: any[];
  shotPlans: any[];
  onClose: () => void;
  onSave: (assetVersionIds: string[]) => void;
}

function ConfigureOutputModal({
  output,
  scenes,
  shotPlans,
  onClose,
  onSave,
}: ConfigureOutputModalProps) {
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [selectedShots, setSelectedShots] = useState<string[]>([]);
  const [order, setOrder] = useState<{ type: 'scene' | 'shot'; id: string }[]>([]);

  const toggleScene = (sceneId: string) => {
    if (selectedScenes.includes(sceneId)) {
      setSelectedScenes(selectedScenes.filter(id => id !== sceneId));
      setOrder(order.filter(o => !(o.type === 'scene' && o.id === sceneId)));
    } else {
      setSelectedScenes([...selectedScenes, sceneId]);
      setOrder([...order, { type: 'scene', id: sceneId }]);
    }
  };

  const toggleShot = (shotId: string) => {
    if (selectedShots.includes(shotId)) {
      setSelectedShots(selectedShots.filter(id => id !== shotId));
      setOrder(order.filter(o => !(o.type === 'shot' && o.id !== shotId)));
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
        if (o.type === 'scene') {
          const scene = scenes.find(s => s.id === o.id);
          return scene?.current_version_id || scene?.current_approved_asset_version_id;
        } else {
          const shot = shotPlans.find(s => s.id === o.id);
          return shot?.current_version_id || shot?.current_approved_asset_version_id;
        }
      })
      .filter(Boolean) as string[];
    onSave(assetVersionIds);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Configure: ${output.title}`}>
      <div className="p-4 space-y-6 max-h-[70vh] overflow-auto">
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Scenes ({scenes.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {scenes.map(scene => (
              <div
                key={scene.id}
                onClick={() => toggleScene(scene.id)}
                className={`p-2 rounded border cursor-pointer text-sm ${
                  selectedScenes.includes(scene.id)
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--accent)]'
                }`}
              >
                {scene.title || 'Untitled Scene'}
              </div>
            ))}
            {scenes.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No scenes available</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Shot Plans ({shotPlans.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {shotPlans.map(shot => (
              <div
                key={shot.id}
                onClick={() => toggleShot(shot.id)}
                className={`p-2 rounded border cursor-pointer text-sm ${
                  selectedShots.includes(shot.id)
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] hover:border-[var(--accent)]'
                }`}
              >
                {shot.title || 'Untitled Shot'}
              </div>
            ))}
            {shotPlans.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No shot plans available</p>
            )}
          </div>
        </div>

        {order.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">Sequence Order</h4>
            <div className="space-y-2">
              {order.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center gap-2 p-2 bg-[var(--bg-hover)] rounded"
                >
                  <span className="text-xs text-[var(--text-muted)] w-6">{index + 1}</span>
                  <span className="text-sm flex-1">
                    {item.type === 'scene'
                      ? scenes.find(s => s.id === item.id)?.title || 'Scene'
                      : shotPlans.find(p => p.id === item.id)?.title || 'Shot'}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{item.type}</span>
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="text-xs p-1 hover:text-[var(--accent)]"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === order.length - 1}
                    className="text-xs p-1 hover:text-[var(--accent)]"
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Version
        </Button>
      </div>
    </Modal>
  );
}
