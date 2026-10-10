import { useNavigate, useParams } from 'react-router';
import { Alert, AlertDescription, AlertIcon, Text, useToast } from '@chakra-ui/react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProjectForm, type ProjectFormValues } from '../../components/projects/ProjectForm';
import { ProjectNotFound } from '../../components/projects/ProjectNotFound';
import { isNotFoundError, parseProjectId } from '../../components/projects/projectUtils';
import { useProject, useUpdateProject } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

export function ProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseProjectId(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: project, isLoading, isError, error } = useProject(projectId);
  const updateProject = useUpdateProject(projectId ?? 0);

  const handleSubmit = (values: ProjectFormValues): void => {
    if (!project) return;
    updateProject.mutate(
      {
        name: values.name,
        description: values.description || null,
        color: values.color,
        is_archived: values.is_archived,
      },
      {
        onSuccess: () => {
          toast({ status: 'success', title: 'Project updated' });
          navigate(`/projects/${project.id}`);
        },
        onError: (err) => {
          toast({ status: 'error', title: 'Could not update project', description: getErrorMessage(err) });
        },
      },
    );
  };

  const renderContent = () => {
    if (projectId === undefined) return <ProjectNotFound />;
    if (isLoading) return <LoadingState label="Loading project..." />;
    if (isError) {
      if (isNotFoundError(error)) return <ProjectNotFound />;
      return (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      );
    }
    if (!project) return <ProjectNotFound />;
    if (!user || project.owner_id !== user.id) {
      return (
        <EmptyState
          icon="!"
          title="Only the owner can edit this project"
          description="Ask the project owner if something needs to change."
          actionLabel="Back to project"
          onAction={() => navigate(`/projects/${project.id}`)}
        />
      );
    }
    return (
      <>
        <Text color="text.muted" mb={6}>
          Update details for {project.name}.
        </Text>
        <GlassCard isStatic>
          <ProjectForm
            key={project.id}
            initialValues={{
              name: project.name,
              description: project.description ?? '',
              color: project.color,
              is_archived: project.is_archived,
            }}
            showArchive
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/projects/${project.id}`)}
            submitLabel="Save changes"
            isSubmitting={updateProject.isPending}
          />
        </GlassCard>
      </>
    );
  };

  return (
    <PageWrapper maxW="2xl" mx="auto">
      <TextReveal text="Edit project" gradient mb={2} />
      {renderContent()}
    </PageWrapper>
  );
}

export default ProjectEditPage;
