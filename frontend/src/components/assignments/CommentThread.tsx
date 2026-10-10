import { Box, HStack, Text, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { AnimatedList } from '../ui/AnimatedList';
import { GlassCard } from '../ui/GlassCard';
import { UserAvatar } from '../ui/UserAvatar';
import { MotionIconButton, buttonHover, buttonTap } from '../ui/motion';
import { useDeleteComment } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import type { CommentResponse } from '../../types';
import { formatDateTime, formatRelativeTime, userDisplayName } from './utils';

export interface CommentThreadProps {
  assignmentId: number;
  comments: CommentResponse[];
  currentUserId: number | undefined;
}

export function CommentThread({ assignmentId, comments, currentUserId }: CommentThreadProps) {
  const toast = useToast();
  const deleteComment = useDeleteComment(assignmentId);

  const handleDelete = (commentId: number) => {
    deleteComment.mutate(commentId, {
      onSuccess: () => toast({ status: 'success', title: 'Comment deleted', duration: 2000 }),
      onError: (err) =>
        toast({ status: 'error', title: 'Could not delete comment', description: getErrorMessage(err) }),
    });
  };

  if (comments.length === 0) {
    return (
      <Text color="text.muted" fontSize="sm" py={4} textAlign="center">
        No comments yet — start the conversation.
      </Text>
    );
  }

  return (
    <AnimatedList
      items={comments}
      keyExtractor={(c) => c.id}
      renderItem={(comment) => {
        const name = userDisplayName(comment.author);
        const isOwn = comment.author !== null && currentUserId !== undefined && comment.author.id === currentUserId;
        const isDeleting = deleteComment.isPending && deleteComment.variables === comment.id;
        return (
          <GlassCard p={4} boxShadow="sm">
            <HStack align="flex-start" spacing={3}>
              <UserAvatar size="sm" user={comment.author} />
              <Box flex="1" minW={0}>
                <HStack justify="space-between" align="center" spacing={2}>
                  <HStack spacing={2} minW={0}>
                    <Text
                      fontWeight="semibold"
                      fontSize="sm"
                      noOfLines={1}
                      color={comment.author ? undefined : 'text.muted'}
                    >
                      {name}
                    </Text>
                    <Text fontSize="xs" color="text.muted" title={formatDateTime(comment.created_at)}>
                      {formatRelativeTime(comment.created_at)}
                    </Text>
                  </HStack>
                  {isOwn ? (
                    <MotionIconButton
                      aria-label="Delete comment"
                      icon={<DeleteIcon />}
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      whileHover={buttonHover}
                      whileTap={buttonTap}
                      isLoading={isDeleting}
                      onClick={() => handleDelete(comment.id)}
                    />
                  ) : null}
                </HStack>
                <Text mt={1} whiteSpace="pre-wrap" wordBreak="break-word" fontSize="sm">
                  {comment.body}
                </Text>
              </Box>
            </HStack>
          </GlassCard>
        );
      }}
    />
  );
}

export default CommentThread;
