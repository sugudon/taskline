import type { ReactNode } from 'react';
import { Heading, Text, VStack } from '@chakra-ui/react';
import { GlassCard } from './GlassCard';
import { GradientButton } from './GradientButton';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <GlassCard isStatic textAlign="center" py={12}>
      <VStack spacing={4}>
        {icon ? (
          <Text fontSize="4xl" color="brand.400" aria-hidden>
            {icon}
          </Text>
        ) : null}
        <Heading size="md">{title}</Heading>
        {description ? (
          <Text color="text.muted" maxW="md">
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? <GradientButton onClick={onAction}>{actionLabel}</GradientButton> : null}
      </VStack>
    </GlassCard>
  );
}

export default EmptyState;
