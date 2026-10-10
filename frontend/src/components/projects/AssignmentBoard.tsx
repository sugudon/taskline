import { Link as RouterLink } from 'react-router';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Avatar,
  Badge,
  Box,
  HStack,
  Heading,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { AddIcon, CalendarIcon } from '@chakra-ui/icons';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { AnimatedList } from '../ui/AnimatedList';
import { LoadingState } from '../ui/LoadingState';
import { StatusBadge } from '../ui/StatusBadge';
import { PriorityBadge } from '../ui/PriorityBadge';
import { useProjectAssignments } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';
import { ASSIGNMENT_STATUSES, PRIORITY_ORDER } from '../../lib/constants';
import type { AssignmentResponse, AssignmentStatus } from '../../types';

export interface AssignmentBoardProps {
  projectId: number;
  onNewAssignment: () => void;
  canCreate?: boolean;
}

const formatDueDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const sortAssignments = (a: AssignmentResponse, b: AssignmentResponse): number => {
  const p = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
  if (p !== 0) return p;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return b.created_at.localeCompare(a.created_at);
};

interface BoardCardProps {
  assignment: AssignmentResponse;
}

function BoardCard({ assignment }: BoardCardProps) {
  const assigneeName = assignment.assignee
    ? assignment.assignee.full_name || assignment.assignee.email
    : null;
  return (
    <LinkBox>
      <GlassCard p={3} borderRadius="xl" boxShadow="sm" cursor="pointer">
        <Text fontWeight="semibold" fontSize="sm" noOfLines={2} mb={2}>
          <LinkOverlay as={RouterLink} to={`/assignments/${assignment.id}`}>
            {assignment.title}
          </LinkOverlay>
        </Text>
        <HStack justify="space-between" spacing={2}>
          <HStack spacing={2} minW={0}>
            <PriorityBadge priority={assignment.priority} fontSize="2xs" />
            {assignment.due_date ? (
              <HStack
                spacing={1}
                fontSize="xs"
                color={assignment.is_overdue ? 'red.500' : 'text.muted'}
                fontWeight={assignment.is_overdue ? 'semibold' : 'normal'}
              >
                <CalendarIcon boxSize={3} />
                <Text noOfLines={1}>{formatDueDate(assignment.due_date)}</Text>
              </HStack>
            ) : null}
          </HStack>
          {assigneeName ? (
            <Tooltip label={assigneeName} hasArrow>
              <Avatar size="xs" name={assigneeName} src={assignment.assignee?.avatar_url ?? undefined} />
            </Tooltip>
          ) : (
            <Tooltip label="Unassigned" hasArrow>
              <Avatar size="xs" bg="gray.300" />
            </Tooltip>
          )}
        </HStack>
      </GlassCard>
    </LinkBox>
  );
}

export function AssignmentBoard({ projectId, onNewAssignment, canCreate = true }: AssignmentBoardProps) {
  const { data, isLoading, isError, error } = useProjectAssignments(projectId);

  const grouped = ASSIGNMENT_STATUSES.reduce<Record<AssignmentStatus, AssignmentResponse[]>>(
    (acc, status) => {
      acc[status] = (data?.items ?? []).filter((a) => a.status === status).sort(sortAssignments);
      return acc;
    },
    { todo: [], in_progress: [], in_review: [], done: [] },
  );

  return (
    <Box>
      <Stack direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ sm: 'center' }} mb={4} spacing={3}>
        <Heading size="md">Assignments</Heading>
        {canCreate ? (
          <GradientButton leftIcon={<AddIcon boxSize={3} />} onClick={onNewAssignment} size="sm">
            New assignment
          </GradientButton>
        ) : null}
      </Stack>

      {isLoading ? (
        <LoadingState label="Loading assignments..." />
      ) : isError ? (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          {data && data.total > data.items.length ? (
            <Alert status="info" borderRadius="xl" mb={4}>
              <AlertIcon />
              <AlertDescription>
                Showing {data.items.length} of {data.total} assignments.
              </AlertDescription>
            </Alert>
          ) : null}
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} alignItems="start">
            {ASSIGNMENT_STATUSES.map((status) => (
              <GlassCard key={status} isStatic p={4} minH="200px" data-testid={`board-column-${status}`}>
                <HStack justify="space-between" mb={3}>
                  <StatusBadge status={status} fontSize="sm" />
                  <Badge variant="outline" colorScheme="gray">
                    {grouped[status].length}
                  </Badge>
                </HStack>
                {grouped[status].length === 0 ? (
                  <Text fontSize="sm" color="text.muted" textAlign="center" py={6}>
                    Nothing here
                  </Text>
                ) : (
                  <AnimatedList
                    items={grouped[status]}
                    keyExtractor={(a) => a.id}
                    renderItem={(a) => <BoardCard assignment={a} />}
                    gap={2}
                  />
                )}
              </GlassCard>
            ))}
          </SimpleGrid>
        </>
      )}
    </Box>
  );
}

export default AssignmentBoard;
