import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchAsset, updateAsset } from '../lib/api';
import { Asset } from '../lib/api';
import { PanelCard } from './ui/PanelCard';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { useSelectionStore } from '../stores/selectionStore';
import { WorkflowNodeCategory } from '../lib/workflowCatalog';

interface SceneEditorPanelProps {
  assetId: string;
}

export const SceneEditorPanel: React.FC<SceneEditorPanelProps> = ({ assetId }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { selectedAssetId, selectedWorkflowId, selectedShotId, selectedSceneId, selectAsset, selectShot, selectScene, selectWorkflow, clearSelection } = useSelectionStore();

  const { data: asset, isLoading, error } = useQuery<Asset>({
    queryKey: ['asset', projectId, assetId],
    queryFn: () => fetchAsset(projectId!, assetId),
    enabled: !!projectId && !!assetId,
  });

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [emotionalBeat, setEmotionalBeat] = useState('');
  const [setting, setSetting] = useState('');
  const [contentJson, setContentJson] = useState('');

  useEffect(() => {
    if (asset) {
      setTitle(asset.title || '');
      const content = asset.current_version?.content as Record<string, unknown>;
      setPurpose((content?.purpose as string) || '');
      setEmotionalBeat((content?.emotionalBeat as string) || '');
      setSetting((content?.setting as string) || '');
      setContentJson(JSON.stringify(content, null, 2));
    }
  }, [asset]);

  const updateSceneMutation = useMutation({
    mutationFn: (updatedAsset: Partial<Asset>) =>
      updateAsset(projectId!, assetId, updatedAsset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', projectId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId, 'scene'] });
      // Clear selection to close the panel after saving
      clearSelection();
    },
  });

  const handleSave = () => {
    const updatedContent = {
      ...JSON.parse(contentJson),
      purpose,
      emotionalBeat,
      setting,
    };
    updateSceneMutation.mutate({
      title,
      current_version: {
        content: updatedContent,
      },
    });
  };

  if (isLoading) {
    return <div className="text-comfy-text">Loading scene...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading scene: {error.message}</div>;
  }

  if (!asset) {
    return <div className="text-comfy-text">No scene selected.</div>;
  }

  return (
    <PanelCard title={`Edit Scene: ${asset.title || 'Untitled Scene'}`} collapsible={false}>
      <div className="flex flex-col gap-4 p-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="purpose">Purpose</Label>
          <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="emotionalBeat">Emotional Beat</Label>
          <Input
            id="emotionalBeat"
            value={emotionalBeat}
            onChange={(e) => setEmotionalBeat(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="setting">Setting</Label>
          <Textarea id="setting" value={setting} onChange={(e) => setSetting(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contentJson">Raw Content (JSON)</Label>
          <Textarea
            id="contentJson"
            value={contentJson}
            onChange={(e) => setContentJson(e.target.value)}
            className="font-mono text-xs"
            rows={10}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={clearSelection}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </PanelCard>
  );
};
