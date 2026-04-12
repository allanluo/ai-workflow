import { useState } from 'react';
import type { Shot } from './ShotsPage';

interface PreviewStackProps {
  shot: Shot;
}

type PreviewTab = 'image' | 'video';

const mockImageUrl = 'https://picsum.photos/800/450?random=1';
const mockVideoUrl = '';

export function PreviewStack({ shot }: PreviewStackProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setHasImage(true);
    }, 2000);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setHasImage(true);
    }, 2000);
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
        <span className="text-comfy-muted text-sm">No preview available</span>
      </div>
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="comfy-btn disabled:opacity-50"
      >
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>
    </div>
  );

  const renderImagePreview = () => {
    if (!hasImage) return renderEmptyState();

    return (
      <div className="space-y-4">
        <div className="aspect-video bg-comfy-input-bg rounded-lg overflow-hidden">
          <img src={mockImageUrl} alt="Shot preview" className="w-full h-full object-contain" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleRegenerate} disabled={isGenerating} className="comfy-btn flex-1">
            {isGenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button className="comfy-btn-secondary">Download</button>
        </div>
      </div>
    );
  };

  const renderVideoPreview = () => {
    if (!hasVideo) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-full aspect-video bg-comfy-input-bg rounded-lg flex items-center justify-center mb-4">
            <span className="text-comfy-muted text-sm">No video generated</span>
          </div>
          <button className="comfy-btn">Generate Video</button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
          <span className="text-comfy-muted">Video player placeholder</span>
        </div>
        <div className="flex gap-2">
          <button className="comfy-btn flex-1">Regenerate</button>
          <button className="comfy-btn-secondary">Download</button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-comfy-border mb-4">
        <button
          onClick={() => setActiveTab('image')}
          className={`comfy-tab ${activeTab === 'image' ? 'comfy-tab-active' : ''}`}
        >
          Image
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`comfy-tab ${activeTab === 'video' ? 'comfy-tab-active' : ''}`}
        >
          Video
        </button>
      </div>

      {/* Preview Content */}
      <div className="flex-1">
        {activeTab === 'image' ? renderImagePreview() : renderVideoPreview()}
      </div>
    </div>
  );
}
