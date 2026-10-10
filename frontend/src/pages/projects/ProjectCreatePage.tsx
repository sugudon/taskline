import { useNavigate } from 'react-router';
import { Text, useToast } from '@chakra-ui/react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { GlassCard } from '../../components/ui/GlassCard';
import { ProjectForm, type ProjectFormValues } from '../../components/projects/ProjectForm';
import { useCreateProject } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createProject = useCreateProject();

  const handleSubmit = (values: ProjectFormValues): void => {
    createProject.mutate(
      { name: values.name, description: values.description || null, color: values.color },
      {
        onSuccess: (project) => {
          toast({ status: 'success', title: 'Project created' });
          navigate(`/projects/${project.id}`);
        },
        onError: (err) => {
          toast({ status: 'error', title: 'Could not create project', description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <PageWrapper maxW="2xl" mx="auto">
      <TextReveal text="New project" gradient mb={1} />
      <Text color="text.muted" mb={6}>
        You will be the owner and can invite members afterwards.
      </Text>
      <GlassCard isStatic>
        <ProjectForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/projects')}
          submitLabel="Create project"
          isSubmitting={createProject.isPending}
        />
      </GlassCard>
    </PageWrapper>
  );
}

export default ProjectCreatePage;
