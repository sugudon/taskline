import { Link as RouterLink } from 'react-router';
import { Badge, Box, Flex, HStack, Heading, LinkBox, LinkOverlay, Text } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import type { ProjectResponse } from '../../types';

export interface ProjectCardProps {
  project: ProjectResponse;
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" lineHeight="short">
        {value}
      </Text>
      <Text fontSize="xs" color="text.muted">
        {label}
      </Text>
    </Box>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <LinkBox h="full">
      <GlassCard
        p={0}
        h="full"
        overflow="hidden"
        cursor="pointer"
        opacity={project.is_archived ? 0.75 : 1}
        data-testid={`project-card-${project.id}`}
      >
        <Box h={2} bg={project.color} />
        <Flex direction="column" p={5} gap={3} h="full">
          <HStack justify="space-between" align="start">
            <Heading size="sm" noOfLines={1}>
              <LinkOverlay as={RouterLink} to={`/projects/${project.id}`}>
                {project.name}
              </LinkOverlay>
            </Heading>
            {project.is_archived ? (
              <Badge colorScheme="gray" variant="subtle">
                Archived
              </Badge>
            ) : null}
          </HStack>
          <Text color="text.muted" fontSize="sm" noOfLines={2} minH="2.5em">
            {project.description || 'No description'}
          </Text>
          <HStack spacing={6} pt={1}>
            <Stat label={project.member_count === 1 ? 'member' : 'members'} value={project.member_count} />
            <Stat label="assignments" value={project.assignment_count} />
            <Stat label="open" value={project.open_assignment_count} />
          </HStack>
        </Flex>
      </GlassCard>
    </LinkBox>
  );
}

export default ProjectCard;
