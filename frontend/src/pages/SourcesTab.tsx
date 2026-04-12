import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectAssets,
  fetchProjectFiles,
  createAsset,
  uploadProjectFile,
  type Asset,
  type FileRecord,
} from '../lib/api';
import { Button, Badge } from '../components/common';

interface SourcesTabProps {
  projectId: string;
}

export function SourcesTab({ projectId }: SourcesTabProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const filesQuery = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => fetchProjectFiles(projectId),
    enabled: Boolean(projectId),
  });

  const sourcesQuery = useQuery({
    queryKey: ['project-assets', projectId, 'source'],
    queryFn: () => fetchProjectAssets(projectId, 'source_story'),
    enabled: Boolean(projectId),
  });

  const createAssetMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await uploadProjectFile({
        projectId,
        file,
        role: 'source',
        assetType: 'source_story',
      });

      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateSource = () => {
    createAssetMutation.mutate({
      projectId,
      asset_type: 'source_story',
      asset_category: 'story',
      title: 'New Source',
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
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Source Intake</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Uploaded source files and authored source assets for the current project
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            accept=".txt,.md,.pdf,.doc,.docx"
          />
          <label htmlFor="file-upload" className="btn btn-secondary btn-sm cursor-pointer">
            {isUploading ? 'Uploading...' : 'Upload File'}
          </label>
          <Button variant="primary" size="sm" onClick={handleCreateSource}>
            New Source
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 p-3 bg-[var(--error-bg)] border border-[var(--error)] rounded-lg text-[var(--error)] text-sm">
          {uploadError}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Uploaded Files */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Uploaded Files
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              {filesQuery.data?.length ?? 0} file{filesQuery.data?.length === 1 ? '' : 's'}
            </span>
          </div>

          {filesQuery.isLoading ? (
            <div className="flex-center py-8">
              <div className="spinner" />
            </div>
          ) : filesQuery.data && filesQuery.data.length > 0 ? (
            <div className="space-y-2">
              {filesQuery.data.map(file => (
                <UploadedFileCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
              No uploaded files yet.
            </div>
          )}
        </section>

        {/* Source Assets */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Source Assets
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              {sourcesQuery.data?.length ?? 0} asset{sourcesQuery.data?.length === 1 ? '' : 's'}
            </span>
          </div>

          {sourcesQuery.isLoading ? (
            <div className="flex-center py-8">
              <div className="spinner" />
            </div>
          ) : sourcesQuery.data && sourcesQuery.data.length > 0 ? (
            <div className="space-y-2">
              {sourcesQuery.data.map(asset => (
                <SourceCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="card border-dashed text-center py-8 text-[var(--text-muted)]">
              No source assets yet. Upload a file or create a source draft.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function UploadedFileCard({ file }: { file: FileRecord }) {
  const originalName =
    typeof file.metadata.original_filename === 'string'
      ? file.metadata.original_filename
      : 'Uploaded file';
  const assetTypeHint =
    typeof file.metadata.asset_type_hint === 'string' ? file.metadata.asset_type_hint : null;

  return (
    <div className="card hover:border-[var(--accent)] transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-[var(--text-primary)] truncate">{originalName}</h4>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
            <span>{file.mime_type || 'unknown type'}</span>
            <span>{formatBytes(file.size_bytes)}</span>
            <span className="badge badge-draft">{file.file_role}</span>
            {assetTypeHint && <span className="text-xs">hint: {assetTypeHint}</span>}
          </div>
        </div>
        <div className="text-sm text-[var(--text-muted)] whitespace-nowrap">
          {new Date(file.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ asset }: { asset: Asset }) {
  const approvalVariant = asset.approval_state === 'approved' ? 'approved' : 'draft';

  return (
    <div className="card hover:border-[var(--accent)] transition-colors cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-[var(--text-primary)]">
            {asset.title || 'Untitled Source'}
          </h3>
          <div className="flex gap-4 mt-1 text-sm text-[var(--text-muted)]">
            <span>{asset.asset_type}</span>
            <span>v{asset.current_version_number}</span>
            <Badge variant={approvalVariant}>{asset.approval_state}</Badge>
          </div>
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          {new Date(asset.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function formatBytes(value: number | null) {
  if (value === null || value === undefined) {
    return 'size unavailable';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
