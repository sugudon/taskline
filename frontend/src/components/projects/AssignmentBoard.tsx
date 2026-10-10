import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
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
  useToast,
} from '@chakra-ui/react';
import { AddIcon, CalendarIcon } from '@chakra-ui/icons';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { AnimatedList } from '../ui/AnimatedList';
import { LoadingState } from '../ui/LoadingState';
import { StatusBadge } from '../ui/StatusBadge';
import { PriorityBadge } from '../ui/PriorityBadge';
import { useMoveAssignment, useProjectAssignments } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';
import { ASSIGNMENT_STATUSES, PRIORITY_ORDER, STATUS_LABELS } from '../../lib/constants';
import type { AssignmentResponse, AssignmentStatus } from '../../types';

export interface AssignmentBoardProps {
  projectId: number;
  onNewAssignment: () => void;
  canCreate?: boolean;
  /** Allow drag-and-drop between status columns (false for archived projects). */
  canDrag?: boolean;
}

const isStatus = (value: unknown): value is AssignmentStatus =>
  typeof value === 'string' && (ASSIGNMENT_STATUSES as string[]).includes(value);

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

interface DraggableCardProps {
  assignment: AssignmentResponse;
  isDisabled: boolean;
}

function DraggableCard({ assignment, isDisabled }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.id,
    disabled: isDisabled,
  });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={isDisabled ? undefined : `${assignment.title}. Press space to move it to another status.`}
      opacity={isDragging ? 0.4 : 1}
      cursor={isDisabled ? undefined : 'grab'}
      borderRadius="xl"
      _focusVisible={{ outline: '2px solid', outlineColor: 'brand.400', outlineOffset: '2px' }}
      data-testid={`board-card-${assignment.id}`}
    >
      <BoardCard assignment={assignment} />
    </Box>
  );
}

interface DroppableColumnProps {
  status: AssignmentStatus;
  items: AssignmentResponse[];
  canDrag: boolean;
  isDragActive: boolean;
}

function DroppableColumn({ status, items, canDrag, isDragActive }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDrag });
  return (
    <Box ref={setNodeRef} borderRadius="2xl" h="full">
      <GlassCard
        isStatic
        p={4}
        minH="200px"
        h="full"
        borderWidth="2px"
        borderStyle={isDragActive ? 'dashed' : 'solid'}
        borderColor={isOver ? 'brand.400' : isDragActive ? 'border.subtle' : 'transparent'}
        bg={isOver ? 'brand.50' : undefined}
        _dark={isOver ? { bg: 'whiteAlpha.100' } : undefined}
        data-testid={`board-column-${status}`}
      >
        <HStack justify="space-between" mb={3}>
          <StatusBadge status={status} fontSize="sm" />
          <Badge variant="outline" colorScheme="gray">
            {items.length}
          </Badge>
        </HStack>
        {items.length === 0 ? (
          <Text fontSize="sm" color="text.muted" textAlign="center" py={6}>
            {isDragActive ? 'Drop here' : 'Nothing here'}
          </Text>
        ) : (
          <AnimatedList
            items={items}
            keyExtractor={(a) => a.id}
            renderItem={(a) => <DraggableCard assignment={a} isDisabled={!canDrag} />}
            gap={2}
          />
        )}
      </GlassCard>
    </Box>
  );
}

export function AssignmentBoard({
  projectId,
  onNewAssignment,
  canCreate = true,
  canDrag = true,
}: AssignmentBoardProps) {
  const { data, isLoading, isError, error } = useProjectAssignments(projectId);
  const moveAssignment = useMoveAssignment(projectId);
  const toast = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(
    // A plain click still opens the card; dragging starts after a small movement.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch screens, press and hold to pick a card up (so scrolling still works).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = ASSIGNMENT_STATUSES.reduce<Record<AssignmentStatus, AssignmentResponse[]>>(
    (acc, status) => {
      acc[status] = (data?.items ?? []).filter((a) => a.status === status).sort(sortAssignments);
      return acc;
    },
    { todo: [], in_progress: [], in_review: [], done: [] },
  );

  const items = data?.items ?? [];
  const findAssignment = (id: unknown): AssignmentResponse | undefined =>
    items.find((a) => a.id === id);
  const activeAssignment = activeId === null ? undefined : findAssignment(activeId);

  const titleOf = (id: unknown): string => findAssignment(id)?.title ?? 'Assignment';
  const statusLabelOf = (id: unknown): string => (isStatus(id) ? STATUS_LABELS[id] : 'nowhere');
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over ${statusLabelOf(over.id)}.` : `${titleOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over ? `Moved ${titleOf(active.id)} to ${statusLabelOf(over.id)}.` : `${titleOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const handleDragStart = ({ active }: DragStartEvent): void => {
    setActiveId(typeof active.id === 'number' ? active.id : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveId(null);
    const assignment = findAssignment(active.id);
    if (!assignment || !over || !isStatus(over.id) || over.id === assignment.status) return;
    const target = over.id;
    moveAssignment.mutate(
      { assignmentId: assignment.id, status: target },
      {
        onError: (err) => {
          toast({
            status: 'error',
            title: `Couldn't move “${assignment.title}”`,
            description: getErrorMessage(err),
          });
        },
      },
    );
  };

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
          {canDrag && items.length > 0 ? (
            <Text fontSize="xs" color="text.muted" mb={2}>
              Drag a card to another column to change its status.
            </Text>
          ) : null}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{ announcements }}
          >
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} alignItems="stretch">
              {ASSIGNMENT_STATUSES.map((status) => (
                <DroppableColumn
                  key={status}
                  status={status}
                  items={grouped[status]}
                  canDrag={canDrag}
                  isDragActive={activeId !== null}
                />
              ))}
            </SimpleGrid>
            <DragOverlay>
              {activeAssignment ? (
                <Box cursor="grabbing" transform="rotate(2deg)" boxShadow="xl" borderRadius="xl">
                  <BoardCard assignment={activeAssignment} />
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </Box>
  );
}

export default AssignmentBoard;
