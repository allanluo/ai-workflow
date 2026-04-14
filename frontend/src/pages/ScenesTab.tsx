import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjectAssets, createAsset, type Asset } from '../lib/api';
import { Button, Badge, Modal } from '../components/common';

interface ScenesTabProps {
  projectId: string;
}

export function ScenesTab({ projectId }: ScenesTabProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const scenesQuery = useQuery({
    queryKey: ['project-assets', projectId, 'scene'],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    select: assets => assets.filter(a => a.asset_type === 'scene'),
  });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    },
  });

  const handleCreateScene = () => {
    createMutation.mutate({
      projectId,
      asset_type: 'scene',
      asset_category: 'story',
      title: 'New Scene',
      content: { order: (scenesQuery.data?.length ?? 0) + 1 },
      metadata: {},
      source_mode: 'manual',
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Scenes</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Organize your content into scenes for production
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-[var(--bg-hover)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              List
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={handleCreateScene}>
            New Scene
          </Button>
        </div>
      </div>

      {scenesQuery.isLoading ? (
        <div className="flex-center py-8">
          <div className="spinner" />
        </div>
      ) : scenesQuery.data && scenesQuery.data.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {scenesQuery.data.map((asset, index) => (
              <SceneCard
                key={asset.id}
                asset={asset}
                index={index + 1}
                onClick={() => setSelectedAsset(asset)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {scenesQuery.data.map((asset, index) => (
              <SceneRow
                key={asset.id}
                asset={asset}
                index={index + 1}
                onClick={() => setSelectedAsset(asset)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
          No scenes yet. Create a scene to organize your content.
        </div>
      )}

      {selectedAsset && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAsset(null)}
          title={selectedAsset.title || 'Scene'}
        >
          <div className="p-4">
            <div className="mb-4">
              <span className="text-sm text-[var(--text-muted)]">Status: </span>
              <Badge variant={selectedAsset.approval_state === 'approved' ? 'approved' : 'draft'}>
                {selectedAsset.approval_state}
              </Badge>
            </div>
            <div className="bg-[var(--bg-hover)] rounded p-4 max-h-96 overflow-auto">
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                {String(
                  selectedAsset.current_approved_version?.content?.text ||
                    selectedAsset.current_version?.content?.text ||
                    JSON.stringify(
                      selectedAsset.current_version?.content ||
                        selectedAsset.current_approved_version?.content || { error: 'No content' },
                      null,
                      2
                    )
                )}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SceneCard({
  asset,
  index,
  onClick,
}: {
  asset: Asset;
  index: number;
  onClick: () => void;
}) {
  const statusVariant =
    asset.approval_state === 'approved'
      ? 'approved'
      : asset.approval_state === 'pending'
        ? 'warning'
        : 'draft';

  const handleClick = () => onClick();

  return (
    <div
      className="card hover:border-[var(--accent)] transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="aspect-video bg-[var(--bg-hover)] rounded mb-3 flex items-center justify-center">
        <span className="text-3xl font-bold text-[var(--text-muted)]">{index}</span>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[var(--text-primary)] truncate">
          {asset.title || `Scene ${index}`}
        </h3>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Badge variant={statusVariant}>{asset.approval_state}</Badge>
        <span className="text-xs text-[var(--text-muted)]">v{asset.current_version_number}</span>
      </div>
    </div>
  );
}

function SceneRow({ asset, index, onClick }: { asset: Asset; index: number; onClick: () => void }) {
  const statusVariant =
    asset.approval_state === 'approved'
      ? 'approved'
      : asset.approval_state === 'pending'
        ? 'warning'
        : 'draft';

  const handleClick = () => onClick();

  return (
    <div
      className="flex items-center gap-4 card hover:border-[var(--accent)] transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="w-12 h-12 bg-[var(--bg-hover)] rounded flex items-center justify-center flex-shrink-0">
        <span className="font-bold text-[var(--text-muted)]">{index}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-[var(--text-primary)] truncate">
          {asset.title || `Scene ${index}`}
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          Updated {new Date(asset.updated_at).toLocaleDateString()}
        </p>
      </div>
      <Badge variant={statusVariant}>{asset.approval_state}</Badge>
      <span className="text-sm text-[var(--text-muted)]">v{asset.current_version_number}</span>
    </div>
  );
}
