import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { API_BASE_URL, type Asset } from '../api';
import { showToast } from '../../stores';

export interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  output_path: string | null;
  created_at: string;
}

export interface StoryboardExportSegment {
  shot_id: string;
  title?: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  duration_seconds?: number;
}

export function useQuickExport(projectId: string) {
  const [isExporting, setIsExporting] = useState(false);
  const [activeJob, setActiveJob] = useState<ExportJob | null>(null);

  // Poll for active job progress if it exists
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/exports/${activeJob.id}`);
        const data = await res.json();
        const job = data.data?.job;
        if (job) {
          setActiveJob(job);
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
            setIsExporting(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll export job:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob]);

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
  });

  const createOutputVersionMutation = useMutation({
    mutationFn: async (input: { outputId: string; assembled_from_asset_version_ids: string[]; metadata?: any }) => {
      const res = await fetch(`${API_BASE_URL}/outputs/${input.outputId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assembled_from_asset_version_ids: input.assembled_from_asset_version_ids,
          metadata: input.metadata 
        }),
      });
      if (!res.ok) throw new Error('Failed to create output version');
      return res.json();
    },
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
  });

  const createExportFromMetadata = useCallback(
    async (input: {
      title: string;
      outputType?: string;
      assembledFromAssetVersionIds?: string[];
      metadata: Record<string, unknown>;
      successMessage: string;
    }) => {
      setIsExporting(true);
      setActiveJob(null);

      try {
        const outputRes = await createOutputMutation.mutateAsync({
          title: input.title,
          output_type: input.outputType ?? 'film',
        });

        const outputId = outputRes?.data?.output?.id;
        if (!outputId) throw new Error('Failed to create output: No ID returned from backend');

        const versionRes = await createOutputVersionMutation.mutateAsync({
          outputId,
          assembled_from_asset_version_ids: input.assembledFromAssetVersionIds ?? [],
          metadata: input.metadata,
        });

        const outputVersionId = versionRes.data?.version?.id;
        if (!outputVersionId) throw new Error('Failed to create output version: No ID returned');

        const exportRes = await createExportMutation.mutateAsync({
          output_version_id: outputVersionId,
          export_format: 'mp4',
        });

        const job = exportRes.data?.job;
        if (job) {
          setActiveJob(job);
        }

        showToast({
          type: 'success',
          title: 'Export Started',
          message: input.successMessage,
        });
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Export Failed',
          message: err instanceof Error ? err.message : 'Unknown error occurred during export',
        });
        setIsExporting(false);
      }
    },
    [createExportMutation, createOutputMutation, createOutputVersionMutation]
  );

  const handleQuickExport = useCallback(async (selectedPlan: Asset | null) => {
    if (!selectedPlan) {
      showToast({ type: 'error', title: 'Export', message: 'No shot plan selected.' });
      return;
    }
    
    setIsExporting(true);
    setActiveJob(null); // Reset previous job
    try {
      // 1. Get shots from the plan to preserve order
      const tryFromObj = (obj: any, depth = 0): any[] => {
        if (depth > 5 || !obj) return [];
        
        // Handle string-wrapped plans (very common in this app)
        if (typeof obj === 'string') {
          try {
            const parsed = JSON.parse(obj);
            return tryFromObj(parsed, depth + 1);
          } catch {
            return [];
          }
        }
        
        if (typeof obj !== 'object') return [];

        if (Array.isArray(obj.shots)) return obj.shots;
        if (Array.isArray(obj.scenes)) {
          let flat: any[] = [];
          for (const s of obj.scenes) {
            if (s && Array.isArray(s.shots)) flat = flat.concat(s.shots);
          }
          return flat;
        }
        
        const candidates = [obj._raw, obj.text, obj.data, obj.result, obj.plan, obj.shot_plan];
        for (const c of candidates) {
          const res = tryFromObj(c, depth + 1);
          if (res.length > 0) return res;
        }
        return [];
      };
      
      const rawContent = selectedPlan.current_version?.content || {};
      const planItems = tryFromObj(rawContent);

      // 2. Collect video URLs from LocalStorage with ROBUST key discovery
      const targetProjectId = selectedPlan.project_id || projectId;
      let storageKey = `aiwf:shotMedia:${targetProjectId}`;
      let mediaMapRaw = localStorage.getItem(storageKey);
      
      // Diagnostic: if not found, try to find ANY key that looks like a shotMedia key for this project
      if (!mediaMapRaw) {
        console.warn(`[QuickExport] Primary key ${storageKey} empty, searching for alternatives...`);
        const allKeys = Object.keys(localStorage);
        const altKey = allKeys.find(k => k.includes('shotMedia') && k.includes(targetProjectId));
        if (altKey) {
          console.log(`[QuickExport] Found alternative key: ${altKey}`);
          storageKey = altKey;
          mediaMapRaw = localStorage.getItem(altKey);
        }
      }

      let mediaMap: Record<string, any> = {};
      if (mediaMapRaw) {
        const parsed = JSON.parse(mediaMapRaw);
        mediaMap = (parsed && typeof parsed === 'object' && 'items' in parsed) ? (parsed.items ?? {}) : parsed;
      }

      const videoUrls: string[] = [];
      const debugIds: string[] = [];

      planItems.forEach((item, index) => {
        const shotId = (typeof item.id === 'string' && item.id.trim()) ? item.id.trim() : `${selectedPlan.id}:${index}`;
        debugIds.push(shotId);
        const m = mediaMap[shotId];
        if (!m) return;
        
        const url = typeof m === 'string' ? m : (m.videoUrl || m.video_url || m.url);
        if (!url) return;
        
        // Ensure URL is absolute for the backend
        const absoluteUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
        videoUrls.push(absoluteUrl);
      });

      // Fallback: if no ordered videos found, try taking all values (legacy/resilience)
      if (videoUrls.length === 0) {
        Object.values(mediaMap).forEach((m: any) => {
          if (!m) return;
          const url = typeof m === 'string' ? m : (m.videoUrl || m.video_url || m.url);
          if (url) videoUrls.push(url.startsWith('/') ? `${API_BASE_URL}${url}` : url);
        });
      }

      console.log('[QuickExport] Found video URLs:', videoUrls);
      
      if (videoUrls.length === 0) {
        const msg = `No video segments found. \nStorage Key: ${storageKey}\nMedia Map Size: ${Object.keys(mediaMap).length}\nShots in Plan: ${planItems.length}\nSample IDs: ${debugIds.slice(0, 3).join(', ')}`;
        console.error('[QuickExport] Diagnostic Failure:', msg);
        showToast({
          type: 'error',
          title: 'Export Failed',
          message:
            'No video segments found for this shot plan. Generate videos for your shots first (Shots → Preview → Video or Image→Video), then try exporting again.',
        });
        setIsExporting(false);
        return;
      }

      const assetVersionId = selectedPlan.current_asset_version_id || 
                            selectedPlan.current_version?.id || 
                            selectedPlan.current_approved_version?.id ||
                            selectedPlan.id; 

      if (!assetVersionId) {
        throw new Error("Cannot export: This shot plan has no version data.");
      }

      await createExportFromMetadata({
        title: `Quick Export: ${selectedPlan.title || 'Untitled'}`,
        assembledFromAssetVersionIds: [assetVersionId],
        metadata: { video_urls: videoUrls },
        successMessage: 'Your sequence is now rendering. You can stay here to see the progress.',
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Unknown error occurred during export',
      });
      setIsExporting(false);
    }
  }, [projectId, createExportFromMetadata]);

  const handleStoryboardExport = useCallback(
    async (input: {
      title: string;
      segments: StoryboardExportSegment[];
      assembledFromAssetVersionIds?: string[];
    }) => {
      const segments = input.segments.filter(
        segment => Boolean(segment.video_url || segment.image_url)
      );

      if (segments.length === 0) {
        showToast({
          type: 'error',
          title: 'Export',
          message: 'No preview media found. Generate shot images or videos first.',
        });
        return;
      }

      await createExportFromMetadata({
        title: input.title,
        assembledFromAssetVersionIds: input.assembledFromAssetVersionIds ?? [],
        metadata: {
          export_mode: 'narrated_preview',
          segments,
        },
        successMessage: 'Narrated preview export started. The MP4 will be ready when rendering completes.',
      });
    },
    [createExportFromMetadata]
  );

  return {
    handleQuickExport,
    handleStoryboardExport,
    isExporting,
    activeJob
  };
}
