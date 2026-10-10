import { useNavigate } from 'react-router';
import { EmptyState } from '../ui/EmptyState';

export interface ProjectNotFoundProps {
  description?: string;
}

export function ProjectNotFound({
  description = "This project doesn't exist or you don't have access to it.",
}: ProjectNotFoundProps) {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon="?"
      title="Project not found"
      description={description}
      actionLabel="Back to projects"
      onAction={() => navigate('/projects')}
    />
  );
}

export default ProjectNotFound;
