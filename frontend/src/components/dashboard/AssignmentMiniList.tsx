import { Box, Heading, HStack, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import { AnimatedList } from '../ui/AnimatedList';
import { GlassCard } from '../ui/GlassCard';
import { MotionBox, cardHover } from '../ui/motion';
import { PriorityBadge } from '../ui/PriorityBadge';
import type { AssignmentResponse } from '../../types';
import { formatDueDate } from './format';

export interface AssignmentMiniListProps {
  title: string;
  items: AssignmentResponse[];
  emptyText: string;
  viewAllTo: string;
  /** Highlight due dates in red. */
  isOverdue?: boolean;
}

export function AssignmentMiniList({ title, items, emptyText, viewAllTo, isOverdue = false }: AssignmentMiniListProps) {
  return (
    <GlassCard isStatic h="full">
      <HStack justify="space-between" mb={4} align="baseline">
        <Heading size="md">
          {title}{' '}
          <Text as="span" color={isOverdue ? 'red.500' : 'text.muted'} fontSize="md">
            ({items.length})
          </Text>
        </Heading>
        <Text as={RouterLink} to={viewAllTo} fontSize="sm" color="brand.500" fontWeight="medium">
          View all
        </Text>
      </HStack>
      {items.length === 0 ? (
        <Text color="text.muted" fontSize="sm">
          {emptyText}
        </Text>
      ) : (
        <AnimatedList
          items={items}
          gap={2}
          keyExtractor={(a) => a.id}
          renderItem={(a) => (
            <MotionBox whileHover={cardHover} borderRadius="xl">
              <LinkBox
                as="article"
                p={3}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={isOverdue ? 'red.200' : 'border.subtle'}
                bg="bg.surface"
              >
                <HStack justify="space-between" align="start" spacing={3}>
                  <Box minW={0}>
                    <LinkOverlay as={RouterLink} to={`/assignments/${a.id}`}>
                      <Text fontWeight="semibold" noOfLines={1}>
                        {a.title}
                      </Text>
                    </LinkOverlay>
                    <Text fontSize="xs" color="text.muted" noOfLines={1}>
                      {a.project_name}
                    </Text>
                  </Box>
                  <PriorityBadge priority={a.priority} flexShrink={0} />
                </HStack>
                <Text
                  mt={1}
                  fontSize="xs"
                  fontWeight="medium"
                  color={isOverdue || a.is_overdue ? 'red.500' : 'text.muted'}
                >
                  {formatDueDate(a.due_date)}
                </Text>
              </LinkBox>
            </MotionBox>
          )}
        />
      )}
    </GlassCard>
  );
}

export function MyAssignmentsList({ items }: { items: AssignmentResponse[] }) {
  return (
    <AssignmentMiniList
      title="My assignments"
      items={items}
      emptyText="Nothing is assigned to you right now."
      viewAllTo="/assignments?mine=true"
    />
  );
}

export function DueSoonList({ items }: { items: AssignmentResponse[] }) {
  return (
    <AssignmentMiniList
      title="Due this week"
      items={items}
      emptyText="Nothing due in the next 7 days."
      viewAllTo="/assignments?sort=due_date"
    />
  );
}

export function OverdueList({ items }: { items: AssignmentResponse[] }) {
  return (
    <AssignmentMiniList
      title="Overdue"
      items={items}
      emptyText="No overdue assignments — nice work!"
      viewAllTo="/assignments?overdue=true"
      isOverdue
    />
  );
}

export default AssignmentMiniList;
