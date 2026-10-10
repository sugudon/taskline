import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Flex, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { PageWrapper } from '../components/layout/PageWrapper';
import { TextReveal } from '../components/ui/TextReveal';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/dashboard/StatCard';
import { StatusBreakdown } from '../components/dashboard/StatusBreakdown';
import { DueSoonList, MyAssignmentsList, OverdueList } from '../components/dashboard/AssignmentMiniList';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { useDashboardSummary } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';

const firstName = (fullName: string | null | undefined, email: string | undefined): string => {
  const fromName = fullName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  return email?.split('@')[0] ?? 'there';
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardSummary();

  const greeting = `Welcome back, ${firstName(user?.full_name, user?.email)}`;

  return (
    <PageWrapper>
      <Flex
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={4}
        mb={8}
      >
        <Box>
          <TextReveal text={greeting} gradient mb={1} />
          <Text color="text.muted">Here&apos;s what&apos;s happening across your projects.</Text>
        </Box>
        <HStack spacing={3}>
          <GradientButton onClick={() => navigate('/assignments/new')}>New assignment</GradientButton>
          <GradientButton onClick={() => navigate('/projects/new')}>New project</GradientButton>
        </HStack>
      </Flex>

      {isLoading ? (
        <LoadingState label="Loading your dashboard..." />
      ) : isError || !data ? (
        <Alert status="error" borderRadius="xl" flexWrap="wrap" gap={2}>
          <AlertIcon />
          <AlertTitle>Couldn&apos;t load dashboard.</AlertTitle>
          <AlertDescription flex={1}>{getErrorMessage(error)}</AlertDescription>
          <AnimatedButton size="sm" variant="outline" colorScheme="red" onClick={() => refetch()} isLoading={isFetching}>
            Retry
          </AnimatedButton>
        </Alert>
      ) : data.total === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No assignments yet"
          description="Create a project, invite your team, and start adding assignments to see your stats here."
          actionLabel="Create a project"
          onAction={() => navigate('/projects/new')}
        />
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5} mb={6}>
            <StatCard label="Total" value={data.total} to="/assignments" icon="📋" helpText="Visible to you" />
            <StatCard
              label="In progress"
              value={data.by_status.in_progress}
              to="/assignments?status=in_progress"
              icon="⚡"
              colorScheme="blue"
            />
            <StatCard
              label="Overdue"
              value={data.overdue_count}
              to="/assignments?overdue=true"
              icon="⏰"
              colorScheme="red"
              helpText={data.overdue_count > 0 ? 'Needs attention' : 'All caught up'}
            />
            <StatCard
              label="Assigned to me"
              value={data.assigned_to_me_count}
              to="/assignments?mine=true"
              icon="🙋"
              colorScheme="purple"
            />
          </SimpleGrid>

          <Box mb={6}>
            <MyAssignmentsList items={data.my_assignments} />
          </Box>

          <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5} mb={6}>
            <StatusBreakdown byStatus={data.by_status} total={data.total} />
            <DueSoonList items={data.due_this_week} />
            <OverdueList items={data.overdue} />
          </SimpleGrid>

          <RecentActivity comments={data.recent_comments} />
        </>
      )}
    </PageWrapper>
  );
}

export default DashboardPage;
