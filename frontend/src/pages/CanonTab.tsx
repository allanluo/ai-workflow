import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjectAssets, createAsset, type Asset } from '../lib/api';
import { Button, Badge } from '../components/common';

interface CanonTabProps {
  projectId: string;
}

export function CanonTab({ projectId }: CanonTabProps) {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const canonQuery = useQuery({
    queryKey: ['project-assets', projectId, 'canon'],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
    select: assets => assets.filter(a => a.asset_type === 'canon_text'),
  });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    },
  });

  const handleCreateCanon = () => {
    createMutation.mutate({
      projectId,
      asset_type: 'canon_text',
      asset_category: 'story',
      title: 'New Canon Document',
      content: {},
      metadata: {},
      source_mode: 'manual',
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Canon</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Approved assets that define your project's canonical content
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleCreateCanon}>
          New Canon Document
        </Button>
      </div>

      {canonQuery.isLoading ? (
        <div className="flex-center py-8">
          <div className="spinner" />
        </div>
      ) : canonQuery.data && canonQuery.data.length > 0 ? (
        <div className="space-y-3">
          {canonQuery.data.map(asset => (
            <div key={asset.id} onClick={() => setSelectedAsset(asset)} className="cursor-pointer">
              <CanonCard asset={asset} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
          No approved canon yet. Approve source assets to promote them to canon.
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)] w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {selectedAsset.title || 'Canon Document'}
              </h3>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1 hover:bg-[var(--bg-hover)] rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                {JSON.stringify(
                  selectedAsset.current_version?.content ||
                    selectedAsset.current_approved_version?.content ||
                    {},
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CanonCard({ asset }: { asset: Asset }) {
  const preview = asset.current_approved_version?.content;

  return (
    <div className="card border-[var(--success)] bg-[var(--success-bg)] hover:border-[var(--success)] transition-colors cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {asset.title || 'Untitled Canon'}
            </h3>
            <Badge variant="approved">Approved</Badge>
          </div>
          <div className="flex gap-4 mt-1 text-sm text-[var(--text-muted)]">
            <span>{asset.asset_type}</span>
            <span>v{asset.current_version_number}</span>
          </div>
          {preview && typeof preview === 'object' && 'text' in preview && (
            <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-3">
              {(preview as { text: string }).text}
            </p>
          )}
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          {new Date(asset.updated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
