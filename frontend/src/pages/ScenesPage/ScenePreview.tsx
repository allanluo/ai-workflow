import type { Asset } from '../../lib/api';

interface ScenePreviewProps {
  asset: Asset | null | undefined;
}

export function ScenePreview({ asset }: ScenePreviewProps) {
  if (!asset) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-comfy-muted">
        Select a scene to preview
      </div>
    );
  }

  const content = asset.current_version?.content ?? {};
  const text =
    typeof (content as any)?._raw === 'string'
      ? ((content as any)._raw as string)
      : JSON.stringify(content, null, 2);

  return (
    <div className="h-full flex flex-col">
      <div className="text-sm font-semibold text-comfy-text mb-3">Preview</div>
      <pre className="flex-1 comfy-input w-full text-xs overflow-auto whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

