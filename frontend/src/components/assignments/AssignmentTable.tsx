import { Link as RouterLink } from 'react-router';
import {
  Avatar,
  Box,
  HStack,
  Link,
  Stack,
  Table,
  TableContainer,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import { ChatIcon } from '@chakra-ui/icons';
import type { Variants } from 'framer-motion';
import { AnimatedList } from '../ui/AnimatedList';
import { GlassCard } from '../ui/GlassCard';
import { MotionBox } from '../ui/motion';
import { PriorityBadge } from '../ui/PriorityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import type { AssignmentResponse, UserSummary } from '../../types';
import { formatDueDate, userDisplayName } from './utils';

export interface AssignmentTableProps {
  assignments: AssignmentResponse[];
}

const tbodyVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

function AssigneeAvatar({ user }: { user: UserSummary | null }) {
  if (!user) {
    return (
      <Text fontSize="sm" color="text.muted">
        Unassigned
      </Text>
    );
  }
  const name = userDisplayName(user);
  return (
    <Tooltip label={name} hasArrow>
      <HStack spacing={2}>
        <Avatar size="xs" name={name} src={user.avatar_url ?? undefined} />
        <Text fontSize="sm" noOfLines={1} display={{ base: 'block', md: 'none', xl: 'block' }}>
          {name}
        </Text>
      </HStack>
    </Tooltip>
  );
}

function DueDate({ assignment }: { assignment: AssignmentResponse }) {
  return (
    <Text
      fontSize="sm"
      color={assignment.is_overdue ? 'red.500' : undefined}
      fontWeight={assignment.is_overdue ? 'semibold' : undefined}
    >
      {formatDueDate(assignment.due_date)}
      {assignment.is_overdue ? ' · Overdue' : ''}
    </Text>
  );
}

function CommentCount({ count }: { count: number }) {
  return (
    <HStack spacing={1} color="text.muted" fontSize="sm" aria-label={`${count} comments`}>
      <ChatIcon boxSize={3} />
      <Text>{count}</Text>
    </HStack>
  );
}

function TitleLink({ assignment }: { assignment: AssignmentResponse }) {
  return (
    <Link
      as={RouterLink}
      to={`/assignments/${assignment.id}`}
      fontWeight="semibold"
      _hover={{ color: 'brand.500', textDecoration: 'none' }}
    >
      {assignment.title}
    </Link>
  );
}

export function AssignmentTable({ assignments }: AssignmentTableProps) {
  return (
    <>
      {/* Desktop table */}
      <GlassCard isStatic p={0} overflow="hidden" display={{ base: 'none', md: 'block' }}>
        <TableContainer>
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th>Assignee</Th>
                <Th>Due</Th>
                <Th isNumeric>Comments</Th>
              </Tr>
            </Thead>
            <MotionBox as="tbody" variants={tbodyVariants} initial="hidden" animate="show">
              {assignments.map((a) => (
                <MotionBox
                  as="tr"
                  key={a.id}
                  variants={rowVariants}
                  _hover={{ bg: 'blackAlpha.50', _dark: { bg: 'whiteAlpha.50' } }}
                >
                  <Td maxW="xs" whiteSpace="normal">
                    <TitleLink assignment={a} />
                  </Td>
                  <Td>
                    <Link as={RouterLink} to={`/projects/${a.project_id}`} color="text.muted" fontSize="sm">
                      {a.project_name}
                    </Link>
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td>
                    <PriorityBadge priority={a.priority} />
                  </Td>
                  <Td>
                    <AssigneeAvatar user={a.assignee} />
                  </Td>
                  <Td>
                    <DueDate assignment={a} />
                  </Td>
                  <Td isNumeric>
                    <Box display="inline-flex">
                      <CommentCount count={a.comment_count} />
                    </Box>
                  </Td>
                </MotionBox>
              ))}
            </MotionBox>
          </Table>
        </TableContainer>
      </GlassCard>

      {/* Mobile cards */}
      <AnimatedList
        display={{ base: 'flex', md: 'none' }}
        items={assignments}
        keyExtractor={(a) => a.id}
        renderItem={(a) => (
          <GlassCard p={4}>
            <Stack spacing={3}>
              <TitleLink assignment={a} />
              <Text fontSize="sm" color="text.muted">
                {a.project_name}
              </Text>
              <HStack spacing={2} wrap="wrap">
                <StatusBadge status={a.status} />
                <PriorityBadge priority={a.priority} />
              </HStack>
              <HStack justify="space-between">
                <AssigneeAvatar user={a.assignee} />
                <CommentCount count={a.comment_count} />
              </HStack>
              <DueDate assignment={a} />
            </Stack>
          </GlassCard>
        )}
      />
    </>
  );
}

export default AssignmentTable;
