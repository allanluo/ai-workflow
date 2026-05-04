import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, fetchProjectAssets, createAsset, type Asset } from '../lib/api';
import { Button, Badge, AudioSegmentsPlayer } from '../components/common';

interface ReviewTabProps {
  projectId: string;
}

function resolveMaybeRelativeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    try {
      return new URL(url, API_BASE_URL).toString();
    } catch {
      return url;
    }
  }
  return url;
}

function getAudioUrlFromAsset(asset: Asset): string | null {
  const content = asset.current_version?.content as Record<string, unknown> | null;
  if (!content) return null;
  return (
    resolveMaybeRelativeUrl((content as any).audio_url) ??
    resolveMaybeRelativeUrl((content as any).audioUrl) ??
    resolveMaybeRelativeUrl((content as any).url) ??
    resolveMaybeRelativeUrl((content as any).audio_path) ??
    resolveMaybeRelativeUrl((content as any).audioPath) ??
    null
  );
}

export function ReviewTab({ projectId }: ReviewTabProps) {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const assetsQuery = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
  });

  const pendingReview =
    assetsQuery.data?.filter(
      a => a.approval_state !== 'approved' && a.current_version?.status === 'ready'
    ) || [];

  const approved = assetsQuery.data?.filter(a => a.approval_state === 'approved') || [];

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Review and approve assets before they move to production
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Review */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Pending Review
          </h3>
          <div className="space-y-3">
            {pendingReview.length > 0 ? (
              pendingReview.map(asset => (
                <AssetCard key={asset.id} asset={asset} onClick={() => setSelectedAsset(asset)} />
              ))
            ) : (
              <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
                No assets pending review
              </div>
            )}
          </div>
        </div>

        {/* Recently Approved */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Recently Approved
          </h3>
          <div className="space-y-3">
            {approved.slice(0, 5).map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
                approved
              />
            ))}
            {approved.length === 0 && (
              <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
                No approved assets yet
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          projectId={projectId}
        />
      )}
    </div>
  );
}

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
  approved?: boolean;
}

function AssetCard({ asset, onClick, approved }: AssetCardProps) {
  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer transition-colors hover:border-[var(--accent)] ${
        approved ? 'border-[var(--success)] bg-[var(--success-bg)]' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-[var(--text-primary)]">{asset.title || 'Untitled'}</h3>
          <div className="flex gap-3 mt-1 text-sm text-[var(--text-muted)]">
            <span>{asset.asset_type}</span>
            <span>v{asset.current_version_number}</span>
          </div>
        </div>
        <Badge variant={approved ? 'approved' : 'warning'}>
          {approved ? 'Approved' : 'Pending'}
        </Badge>
      </div>
      {asset.current_version?.content && (
        <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">
          {typeof asset.current_version.content === 'object' &&
          'text' in asset.current_version.content
            ? (asset.current_version.content as { text: string }).text
            : 'View content...'}
        </p>
      )}
    </div>
  );
}

interface AssetDetailPanelProps {
  asset: Asset;
  onClose: () => void;
  projectId: string;
}

function AssetDetailPanel({ asset, onClose, projectId }: AssetDetailPanelProps) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const audioUrl = getAudioUrlFromAsset(asset);
  const content = asset.current_version?.content as Record<string, unknown> | null;
  const audioSegments = Array.isArray((content as any)?.audio_segments)
    ? ((content as any).audio_segments as unknown[])
    : null;
  const voiceoverSegments = Array.isArray((content as any)?.voiceover_segments)
    ? ((content as any).voiceover_segments as Array<Record<string, unknown>>)
    : null;

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/assets/${asset.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_version_id: asset.current_version?.id,
          decision: 'approved',
          notes: comment,
        }),
      });
      if (!res.ok) throw new Error('Approval failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      onClose();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/assets/${asset.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_version_id: asset.current_version?.id,
          decision: 'rejected',
          notes: comment,
        }),
      });
      if (!res.ok) throw new Error('Rejection failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="modal max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
          <h3 className="font-semibold text-[var(--text-primary)]">
            {asset.title || 'Asset Review'}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="mb-6">
            <div className="flex gap-4 mb-4">
              <span className="badge badge-draft">{asset.asset_type}</span>
              <span className="badge badge-draft">Version {asset.current_version_number}</span>
              <Badge variant={asset.approval_state === 'approved' ? 'approved' : 'warning'}>
                {asset.approval_state}
              </Badge>
            </div>

            {asset.current_version?.content && (
              <div className="p-4 bg-[var(--bg-hover)] rounded-lg border border-[var(--border-light)]">
                <h4 className="font-medium text-[var(--text-primary)] mb-2">Preview</h4>
                {audioSegments?.length || audioUrl ? (
                  <div className="mb-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">Audio</div>
                    {audioSegments?.length ? (
                      <AudioSegmentsPlayer segments={audioSegments} fallbackUrl={audioUrl} />
                    ) : (
                      <>
                        <audio controls className="w-full">
                          <source src={audioUrl!} />
                        </audio>
                        <div className="mt-2 text-[11px] text-[var(--text-muted)] break-all">
                          {audioUrl}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {voiceoverSegments?.length ? (
                  <div className="mb-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">Voice-over (Per Shot)</div>
                    <div className="space-y-3">
                      {voiceoverSegments.map((segment, idx) => {
                        const segAudioUrl =
                          resolveMaybeRelativeUrl((segment as any).audio_url) ??
                          resolveMaybeRelativeUrl((segment as any).audioUrl) ??
                          resolveMaybeRelativeUrl((segment as any).audio_path) ??
                          resolveMaybeRelativeUrl((segment as any).audioPath);
                        const segAudioSegments = Array.isArray((segment as any).audio_segments)
                          ? ((segment as any).audio_segments as unknown[])
                          : null;
                        const text =
                          typeof (segment as any).text === 'string'
                            ? String((segment as any).text)
                            : typeof (segment as any).text_used === 'string'
                              ? String((segment as any).text_used)
                              : null;
                        const sceneIndex = (segment as any).scene_index;
                        const shotNumber = (segment as any).shot_number;
                        const label = [
                          typeof sceneIndex === 'number' || typeof sceneIndex === 'string' ? `Scene ${sceneIndex}` : null,
                          typeof shotNumber === 'number' || typeof shotNumber === 'string' ? `Shot ${shotNumber}` : null,
                        ]
                          .filter(Boolean)
                          .join(' • ');

                        return (
                          <div key={`${idx}`} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg)] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-[var(--text-primary)]">
                                {label || `Shot ${idx + 1}`}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">
                                {(segment as any).status ? String((segment as any).status) : ''}
                              </div>
                            </div>
                            {text ? (
                              <pre className="mb-3 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                                {text}
                              </pre>
                            ) : null}
                            {segAudioSegments?.length ? (
                              <AudioSegmentsPlayer segments={segAudioSegments} fallbackUrl={segAudioUrl} />
                            ) : segAudioUrl ? (
                              <audio controls className="w-full">
                                <source src={segAudioUrl} />
                              </audio>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="text-xs text-[var(--text-muted)] mb-2">Content</div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                  {JSON.stringify(asset.current_version.content, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="form-label">Review Notes (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment about this asset..."
              className="input textarea"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-[var(--border-light)] bg-[var(--bg-hover)]">
          <Button
            variant="danger"
            onClick={() => rejectMutation.mutate()}
            loading={rejectMutation.isPending}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={() => approveMutation.mutate()}
            loading={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
