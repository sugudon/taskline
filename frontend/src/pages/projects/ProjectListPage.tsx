import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertIcon, FormControl, FormLabel, Stack, Switch, Text, Box } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { GradientButton } from '../../components/ui/GradientButton';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ProjectCard } from '../../components/projects/ProjectCard';
import { useProjects } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';

export function ProjectListPage() {
  const navigate = useNavigate();
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: projects, isLoading, isError, error } = useProjects(includeArchived);

  const goToCreate = (): void => {
    void navigate('/projects/new');
  };

  return (
    <PageWrapper>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        mb={6}
        spacing={4}
      >
        <Box>
          <TextReveal text="Projects" gradient mb={1} />
          <Text color="text.muted">Group assignments and collaborate with your team.</Text>
        </Box>
        <Stack direction="row" align="center" spacing={6}>
          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="show-archived" mb={0} fontSize="sm" color="text.muted">
              Show archived
            </FormLabel>
            <Switch
              id="show-archived"
              colorScheme="brand"
              isChecked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
          </FormControl>
          <GradientButton leftIcon={<AddIcon boxSize={3} />} onClick={goToCreate}>
            New project
          </GradientButton>
        </Stack>
      </Stack>

      {isLoading ? (
        <LoadingState label="Loading projects..." />
      ) : isError ? (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon="+"
          title={includeArchived ? 'No projects yet' : 'No active projects'}
          description="Create a project to start organizing assignments and inviting teammates."
          actionLabel="Create your first project"
          onAction={goToCreate}
        />
      ) : (
        <AnimatedList
          items={projects}
          keyExtractor={(p) => p.id}
          renderItem={(p) => <ProjectCard project={p} />}
          display="grid"
          gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }}
          gap={5}
        />
      )}
    </PageWrapper>
  );
}

export default ProjectListPage;
