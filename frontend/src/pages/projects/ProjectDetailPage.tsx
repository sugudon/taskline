import { useNavigate, useParams } from 'react-router';
import { Alert, AlertDescription, AlertIcon, Grid, GridItem, VStack, useToast } from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { LoadingState } from '../../components/ui/LoadingState';
import { ProjectHeader } from '../../components/projects/ProjectHeader';
import { MemberList } from '../../components/projects/MemberList';
import { AddMemberForm } from '../../components/projects/AddMemberForm';
import { AssignmentBoard } from '../../components/projects/AssignmentBoard';
import { ProjectNotFound } from '../../components/projects/ProjectNotFound';
import { isNotFoundError, parseProjectId } from '../../components/projects/projectUtils';
import { useDeleteProject, useProject } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseProjectId(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: project, isLoading, isError, error } = useProject(projectId);
  const deleteProject = useDeleteProject();

  const handleDelete = (): void => {
    if (!project) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast({ status: 'success', title: 'Project deleted' });
        navigate('/projects', { replace: true });
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Could not delete project', description: getErrorMessage(err) });
      },
    });
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

    const isOwner = Boolean(user && project.owner_id === user.id);
    const isArchived = project.is_archived;

    return (
      <VStack align="stretch" spacing={6}>
        <ProjectHeader
          project={project}
          isOwner={isOwner}
          onEdit={() => navigate(`/projects/${project.id}/edit`)}
          onDelete={handleDelete}
          isDeleting={deleteProject.isPending}
        />
        {isArchived ? (
          <Alert status="warning" borderRadius="xl" data-testid="archived-banner">
            <AlertIcon />
            <AlertDescription>
              Archived — this project is read-only.
              {isOwner ? ' Unarchive it from Edit to add assignments or members.' : ''}
            </AlertDescription>
          </Alert>
        ) : null}
        <Grid templateColumns={{ base: '1fr', lg: '1fr 320px' }} gap={6} alignItems="start">
          <GridItem minW={0}>
            <AssignmentBoard
              projectId={project.id}
              canCreate={!isArchived}
              onNewAssignment={() => navigate(`/assignments/new?project_id=${project.id}`)}
            />
          </GridItem>
          <GridItem>
            <VStack align="stretch" spacing={6}>
              <MemberList projectId={project.id} members={project.members} isOwner={isOwner} />
              {isOwner && !isArchived ? <AddMemberForm projectId={project.id} /> : null}
            </VStack>
          </GridItem>
        </Grid>
      </VStack>
    );
  };

  return (
    <PageWrapper>
      <AnimatedButton
        leftIcon={<ArrowBackIcon />}
        variant="ghost"
        size="sm"
        mb={4}
        onClick={() => navigate('/projects')}
      >
        All projects
      </AnimatedButton>
      {renderContent()}
    </PageWrapper>
  );
}

export default ProjectDetailPage;
