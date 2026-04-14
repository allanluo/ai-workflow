import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEventStore } from '../stores';
import { API_BASE_URL } from '../lib/api';

export function useEventStream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { addEvent, updateRunProgress } = useEventStore();

  useEffect(() => {
    if (!projectId) return;

    const streamUrl = `${API_BASE_URL}/projects/${projectId}/events/stream`;
    console.log('[EventStream] Connecting to:', streamUrl);
    
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      // EventSource generic message handles it through specific listeners if named
    };

    eventSource.addEventListener('project_event', (e: MessageEvent) => {
      try {
        const eventData = JSON.parse(e.data);
        console.log('[EventStream] Project event received:', eventData.event_type);
        
        addEvent(eventData);

        // Handle specific event types to update store and invalidate queries
        if (eventData.event_type === 'workflow_run_progress') {
          const { workflow_run_id, progress, current_node_id, current_node_type } = eventData.payload;
          updateRunProgress(workflow_run_id, {
            status: 'running',
            progress,
            current_node_id,
            current_node_type,
          });
        }

        if (eventData.event_type === 'workflow_run_completed' || eventData.event_type === 'workflow_run_failed') {
          const { workflow_run_id } = eventData.payload;
          const status = eventData.event_type === 'workflow_run_completed' ? 'completed' : 'failed';
          
          updateRunProgress(workflow_run_id, {
            status,
            progress: 100,
          });

          // Invalidate relevant queries to fetch fresh data
          queryClient.invalidateQueries({ queryKey: ['project-runs', projectId] });
          queryClient.invalidateQueries({ queryKey: ['node-runs', workflow_run_id] });
          console.log(`[EventStream] Workflow ${workflow_run_id} ${status}, invalidated queries.`);
        }
      } catch (err) {
        console.error('[EventStream] Error parsing event data:', err);
      }
    });

    eventSource.addEventListener('ready', (e: MessageEvent) => {
      console.log('[EventStream] Stream ready');
    });

    eventSource.onerror = (err) => {
      console.error('[EventStream] EventSource error:', err);
      eventSource.close();
    };

    return () => {
      console.log('[EventStream] Closing connection');
      eventSource.close();
    };
  }, [projectId, addEvent, updateRunProgress, queryClient]);
}
