import { Box, Heading, HStack, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import { AnimatedList } from '../ui/AnimatedList';
import { GlassCard } from '../ui/GlassCard';
import { UserAvatar } from '../ui/UserAvatar';
import { MotionBox, cardHover } from '../ui/motion';
import type { RecentComment } from '../../types';
import { formatRelativeTime } from './format';

export interface RecentActivityProps {
  comments: RecentComment[];
}

export function RecentActivity({ comments }: RecentActivityProps) {
  return (
    <GlassCard isStatic>
      <Heading size="md" mb={4}>
        Recent activity
      </Heading>
      {comments.length === 0 ? (
        <Text color="text.muted" fontSize="sm">
          No comments yet. Activity on your assignments will show up here.
        </Text>
      ) : (
        <AnimatedList
          items={comments}
          gap={2}
          keyExtractor={(c) => c.id}
          renderItem={(c) => {
            const name = c.author ? c.author.full_name?.trim() || c.author.email : 'Deleted user';
            return (
              <MotionBox whileHover={cardHover} borderRadius="xl">
                <LinkBox as="article" p={3} borderRadius="xl" borderWidth="1px" borderColor="border.subtle" bg="bg.surface">
                  <HStack align="start" spacing={3}>
                    <UserAvatar size="sm" user={c.author} />
                    <Box minW={0} flex={1}>
                      <HStack justify="space-between" spacing={2}>
                        <Text fontSize="sm" noOfLines={1}>
                          <Text as="span" fontWeight="semibold">
                            {name}
                          </Text>{' '}
                          on{' '}
                          <LinkOverlay as={RouterLink} to={`/assignments/${c.assignment_id}`} fontWeight="semibold" color="brand.500">
                            {c.assignment_title}
                          </LinkOverlay>
                        </Text>
                        <Text fontSize="xs" color="text.muted" flexShrink={0} title={new Date(c.created_at).toLocaleString()}>
                          {formatRelativeTime(c.created_at)}
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="text.muted" noOfLines={2}>
                        {c.body}
                      </Text>
                    </Box>
                  </HStack>
                </LinkBox>
              </MotionBox>
            );
          }}
        />
      )}
    </GlassCard>
  );
}

export default RecentActivity;
