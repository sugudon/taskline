import { useState } from 'react';
import { Avatar, Badge, Box, HStack, Heading, Text, useToast } from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedList } from '../ui/AnimatedList';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MotionIconButton, buttonHover, buttonTap } from '../ui/motion';
import { useRemoveMember } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';
import { ROLE_LABELS } from '../../lib/constants';
import type { ProjectMemberResponse } from '../../types';

export interface MemberListProps {
  projectId: number;
  members: ProjectMemberResponse[];
  isOwner: boolean;
}

const displayName = (m: ProjectMemberResponse): string => m.user.full_name || m.user.email;

export function MemberList({ projectId, members, isOwner }: MemberListProps) {
  const toast = useToast();
  const removeMember = useRemoveMember(projectId);
  const [pending, setPending] = useState<ProjectMemberResponse | null>(null);

  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
    return displayName(a).localeCompare(displayName(b));
  });

  const handleConfirm = (): void => {
    if (!pending) return;
    const target = pending;
    removeMember.mutate(target.user.id, {
      onSuccess: () => {
        toast({ status: 'success', title: `${displayName(target)} removed from project` });
        setPending(null);
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Could not remove member', description: getErrorMessage(err) });
      },
    });
  };

  return (
    <GlassCard isStatic>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Members</Heading>
        <Badge colorScheme="brand">{members.length}</Badge>
      </HStack>
      <AnimatedList
        items={sorted}
        keyExtractor={(m) => m.id}
        renderItem={(m) => (
          <HStack spacing={3} p={2} borderRadius="lg" _hover={{ bg: 'blackAlpha.50', _dark: { bg: 'whiteAlpha.50' } }}>
            <Avatar size="sm" name={displayName(m)} src={m.user.avatar_url ?? undefined} />
            <Box flex={1} minW={0}>
              <Text fontWeight="medium" noOfLines={1}>
                {displayName(m)}
              </Text>
              {m.user.full_name ? (
                <Text fontSize="xs" color="text.muted" noOfLines={1}>
                  {m.user.email}
                </Text>
              ) : null}
            </Box>
            <Badge colorScheme={m.role === 'owner' ? 'purple' : 'gray'}>{ROLE_LABELS[m.role]}</Badge>
            {isOwner && m.role !== 'owner' ? (
              <MotionIconButton
                aria-label={`Remove ${displayName(m)}`}
                icon={<CloseIcon boxSize={2.5} />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                whileHover={buttonHover}
                whileTap={buttonTap}
                onClick={() => setPending(m)}
              />
            ) : null}
          </HStack>
        )}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        isLoading={removeMember.isPending}
        title="Remove member?"
        body={
          pending
            ? `${displayName(pending)} will lose access to this project and be unassigned from their open assignments.`
            : undefined
        }
        confirmLabel="Remove"
      />
    </GlassCard>
  );
}

export default MemberList;
