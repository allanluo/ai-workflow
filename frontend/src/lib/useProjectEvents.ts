import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectEvent {
  id: string;
  project_id: string;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  workflow_run_id: string | null;
  node_run_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface UseProjectEventsOptions {
  projectId: string;
  onEvent?: (event: ProjectEvent) => void;
}

export function useProjectEvents({ projectId, onEvent }: UseProjectEventsOptions) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!projectId) return;

    const url = `${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787/api/v1'}/projects/${projectId}/events/stream`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected to project events stream');
    };

    eventSource.addEventListener('ready', () => {
      console.log('[SSE] Stream ready');
    });

    eventSource.addEventListener('project_event', event => {
      try {
        const projectEvent = JSON.parse(event.data) as ProjectEvent;
        console.log('[SSE] Event received:', projectEvent.event_type);

        onEvent?.(projectEvent);

        if (projectEvent.target_type === 'workflow_run') {
          queryClient.invalidateQueries({ queryKey: ['project-runs', projectId] });
          if (projectEvent.event_type === 'workflow_run_completed') {
            queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
          }
        }

        if (projectEvent.target_type === 'node_run') {
          queryClient.invalidateQueries({ queryKey: ['node-runs'] });
        }

        queryClient.invalidateQueries({ queryKey: ['project-events', projectId] });
      } catch (error) {
        console.error('[SSE] Failed to parse event:', error);
      }
    });

    eventSource.addEventListener('heartbeat', () => {
      console.log('[SSE] Heartbeat');
    });

    eventSource.onerror = error => {
      console.error('[SSE] Error:', error);
      eventSource.close();
      eventSourceRef.current = null;

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[SSE] Reconnecting...');
        connect();
      }, 5000);
    };
  }, [projectId, onEvent, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    disconnect: () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    },
  };
}

export function useWorkflowProgress(projectId: string, workflowRunId: string | null) {
  const [progress, setProgress] = useState<number | null>(null);
  const [currentNode, setCurrentNode] = useState<string | null>(null);

  useProjectEvents({
    projectId,
    onEvent: event => {
      if (event.workflow_run_id === workflowRunId) {
        if (event.event_type === 'workflow_run_progress') {
          setProgress(event.payload.progress as number);
          setCurrentNode(event.payload.current_node_id as string | null);
        }
        if (event.event_type === 'workflow_run_completed') {
          setProgress(100);
          setCurrentNode(null);
        }
        if (event.event_type === 'workflow_run_failed') {
          setProgress(null);
          setCurrentNode(null);
        }
      }
    },
  });

  return { progress, currentNode };
}
