import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Heading, HStack, Link, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { CalendarIcon, CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { PriorityBadge } from '../ui/PriorityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { UserAvatar } from '../ui/UserAvatar';
import type { AssignmentResponse } from '../../types';
import { formatDateTime, formatDueDate, formatRelativeTime, userDisplayName } from './utils';

export interface AssignmentHeaderProps {
  assignment: AssignmentResponse;
  /** Action buttons (edit / delete) rendered next to the title. */
  actions?: ReactNode;
}

export function AssignmentHeader({ assignment, actions }: AssignmentHeaderProps) {
  const creatorName = userDisplayName(assignment.created_by);
  return (
    <Stack spacing={4}>
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ md: 'flex-start' }} spacing={4}>
        <Box minW={0}>
          <Link
            as={RouterLink}
            to={`/projects/${assignment.project_id}`}
            fontSize="sm"
            fontWeight="semibold"
            color="brand.500"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            {assignment.project_name}
          </Link>
          <Heading size="lg" mt={1} wordBreak="break-word">
            {assignment.title}
          </Heading>
        </Box>
        {actions ? (
          <HStack spacing={3} flexShrink={0}>
            {actions}
          </HStack>
        ) : null}
      </Stack>

      <Wrap spacing={3} align="center">
        <WrapItem>
          <StatusBadge status={assignment.status} fontSize="sm" />
        </WrapItem>
        <WrapItem>
          <PriorityBadge priority={assignment.priority} fontSize="sm" />
        </WrapItem>
        <WrapItem>
          <HStack
            spacing={1}
            fontSize="sm"
            color={assignment.is_overdue ? 'red.500' : 'text.muted'}
            fontWeight={assignment.is_overdue ? 'semibold' : undefined}
          >
            {assignment.is_overdue ? <WarningIcon /> : <CalendarIcon />}
            <Text>
              {assignment.due_date ? `Due ${formatDueDate(assignment.due_date)}` : 'No due date'}
              {assignment.is_overdue ? ' · Overdue' : ''}
            </Text>
          </HStack>
        </WrapItem>
        {assignment.completed_at ? (
          <WrapItem>
            <HStack spacing={1} fontSize="sm" color="green.500">
              <CheckCircleIcon />
              <Text title={formatDateTime(assignment.completed_at)}>
                Completed {formatRelativeTime(assignment.completed_at)}
              </Text>
            </HStack>
          </WrapItem>
        ) : null}
      </Wrap>

      <HStack spacing={2} fontSize="sm" color="text.muted">
        <UserAvatar size="xs" user={assignment.created_by} />
        <Text>
          Created by <Text as="span" fontWeight="semibold">{creatorName}</Text>{' '}
          <Text as="span" title={formatDateTime(assignment.created_at)}>
            {formatRelativeTime(assignment.created_at)}
          </Text>
        </Text>
      </HStack>

      {assignment.description ? (
        <Text whiteSpace="pre-wrap" lineHeight="tall">
          {assignment.description}
        </Text>
      ) : (
        <Text color="text.muted" fontStyle="italic">
          No description
        </Text>
      )}
    </Stack>
  );
}

export default AssignmentHeader;
