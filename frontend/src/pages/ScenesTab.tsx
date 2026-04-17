import { ScenesPage } from './ScenesPage/ScenesPage';

interface ScenesTabProps {
  projectId: string;
}

export function ScenesTab({ projectId }: ScenesTabProps) {
  return <ScenesPage projectId={projectId} />;
}
