import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../stores';
import { fetchProjectById } from '../lib/api';

/**
 * Ensures the global appStore's currentProjectId is synchronized with the URL.
 * Vital for direct navigation to sub-routes (like /projects/123/workflows) which
 * bypass the ProjectDetailPage index route.
 */
export function useProjectSync() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setCurrentProject, currentProjectId } = useAppStore();

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectById(projectId!),
    enabled: Boolean(projectId),
  });


  useEffect(() => {
    if (projectId && projectQuery.data) {
      if (projectId !== currentProjectId || projectQuery.data.title !== useAppStore.getState().currentProjectTitle) {
        setCurrentProject(projectId, projectQuery.data.title);
      }
    }
  }, [projectId, projectQuery.data, currentProjectId, setCurrentProject]);

  return projectId;
}
