import { Badge, Box, Flex, HStack, Heading, Stack, Text, useDisclosure } from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedButton } from '../ui/AnimatedButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { ProjectDetail } from '../../types';

export interface ProjectHeaderProps {
  project: ProjectDetail;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function ProjectHeader({ project, isOwner, onEdit, onDelete, isDeleting = false }: ProjectHeaderProps) {
  const confirm = useDisclosure();

  return (
    <GlassCard isStatic p={0} overflow="hidden">
      <Box h={2} bg={project.color} />
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ md: 'start' }} p={6} spacing={4}>
        <Flex gap={4} align="start" minW={0}>
          <Box w={12} h={12} borderRadius="xl" bg={project.color} flexShrink={0} boxShadow="md" aria-hidden />
          <Box minW={0}>
            <HStack spacing={3} wrap="wrap">
              <Heading size="lg" wordBreak="break-word">
                {project.name}
              </Heading>
              {project.is_archived ? <Badge colorScheme="gray">Archived</Badge> : null}
            </HStack>
            <Text color="text.muted" mt={2} whiteSpace="pre-wrap">
              {project.description || 'No description'}
            </Text>
            <HStack spacing={4} mt={3} fontSize="sm" color="text.muted">
              <Text>
                {project.member_count} {project.member_count === 1 ? 'member' : 'members'}
              </Text>
              <Text>{project.assignment_count} assignments</Text>
              <Text>{project.open_assignment_count} open</Text>
            </HStack>
          </Box>
        </Flex>
        {isOwner ? (
          <HStack spacing={2} flexShrink={0}>
            <AnimatedButton leftIcon={<EditIcon />} variant="outline" onClick={onEdit}>
              Edit
            </AnimatedButton>
            <AnimatedButton leftIcon={<DeleteIcon />} colorScheme="red" variant="ghost" onClick={confirm.onOpen}>
              Delete
            </AnimatedButton>
          </HStack>
        ) : null}
      </Stack>
      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={confirm.onClose}
        onConfirm={onDelete}
        isLoading={isDeleting}
        title="Delete project?"
        body={`"${project.name}" and all of its assignments and comments will be permanently deleted.`}
        confirmLabel="Delete"
      />
    </GlassCard>
  );
}

export default ProjectHeader;
