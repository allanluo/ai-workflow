import type { Asset } from '../../lib/api';

interface ScenePreviewProps {
  asset: Asset | null | undefined;
  scene?: Record<string, unknown> | null;
  generatedImageAssets?: Asset[];
  isLoadingGeneratedImages?: boolean;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? [s] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return [
      ...collectStrings(obj.url),
      ...collectStrings(obj.image_url),
      ...collectStrings(obj.imageUrl),
      ...collectStrings(obj.frame_url),
      ...collectStrings(obj.frameUrl),
      ...collectStrings(obj.preview_url),
      ...collectStrings(obj.previewUrl),
    ];
  }
  return [];
}

function uniqueNonEmpty(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function getSceneFrameUrls(scene: Record<string, unknown> | null | undefined): string[] {
  if (!scene) return [];

  const candidates: unknown[] = [
    scene.image_url,
    scene.imageUrl,
    scene.frame_url,
    scene.frameUrl,
    scene.preview_url,
    scene.previewUrl,
    scene.frames,
    scene.images,
  ];

  return uniqueNonEmpty(candidates.flatMap(collectStrings));
}

function getAssetFrameUrls(asset: Asset | null | undefined): string[] {
  if (!asset?.current_version?.content) return [];
  const content = asset.current_version.content as Record<string, unknown>;
  return uniqueNonEmpty(
    [
      (content as any).image_url,
      (content as any).imageUrl,
      (content as any).frame_url,
      (content as any).frameUrl,
      (content as any).preview_url,
      (content as any).previewUrl,
      (content as any).frames,
      (content as any).images,
    ].flatMap(collectStrings)
  );
}

export function ScenePreview({
  asset,
  scene,
  generatedImageAssets = [],
  isLoadingGeneratedImages = false,
}: ScenePreviewProps) {
  if (!asset) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-comfy-muted">
        Select a scene to preview
      </div>
    );
  }

  const sceneUrls = getSceneFrameUrls(scene);
  const assetUrls = getAssetFrameUrls(asset);
  const generatedFromAssets = uniqueNonEmpty(generatedImageAssets.flatMap(a => getAssetFrameUrls(a)));

  const urls =
    sceneUrls.length > 0
      ? sceneUrls
      : assetUrls.length > 0
        ? assetUrls
        : generatedFromAssets;

  return (
    <div className="h-full flex flex-col">
      <div className="text-sm font-semibold text-comfy-text mb-3">Frames</div>

      {urls.length === 0 ? (
        <div className="flex-1 rounded-lg border border-dashed border-comfy-border bg-[var(--bg-elevated)] p-6 text-center text-sm text-comfy-muted">
          {isLoadingGeneratedImages ? 'Loading generated frames…' : 'No frames found yet.'}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 gap-3">
            {urls.map((url, idx) => (
              <div
                key={`${url}:${idx}`}
                className="rounded-lg border border-comfy-border bg-[var(--bg-elevated)] p-2"
              >
                <img
                  src={url}
                  alt={`Scene frame ${idx + 1}`}
                  className="w-full max-h-[420px] object-contain rounded"
                />
                <div className="mt-2 text-[11px] text-comfy-muted break-all">{url}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
