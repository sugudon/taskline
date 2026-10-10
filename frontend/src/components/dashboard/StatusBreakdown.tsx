import { Box, Heading, HStack, Progress, Text, VStack } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import { MotionBox } from '../ui/motion';
import { ASSIGNMENT_STATUSES, STATUS_COLORS, STATUS_LABELS } from '../../lib/constants';
import type { StatusCounts } from '../../types';

export interface StatusBreakdownProps {
  byStatus: StatusCounts;
  total: number;
}

const percent = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

export function StatusBreakdown({ byStatus, total }: StatusBreakdownProps) {
  const completion = percent(byStatus.done, total);
  return (
    <GlassCard h="full">
      <HStack justify="space-between" mb={4} align="baseline">
        <Heading size="md">Status breakdown</Heading>
        <Text fontSize="sm" color="text.muted">
          <Text as="span" fontWeight="bold" color="green.500">
            {completion}%
          </Text>{' '}
          complete
        </Text>
      </HStack>
      <MotionBox
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        <VStack align="stretch" spacing={4}>
          {ASSIGNMENT_STATUSES.map((status) => {
            const count = byStatus[status];
            const pct = percent(count, total);
            return (
              <MotionBox
                key={status}
                variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}
              >
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {STATUS_LABELS[status]}
                  </Text>
                  <Text fontSize="sm" color="text.muted">
                    {count} · {pct}%
                  </Text>
                </HStack>
                <Box>
                  <Progress
                    value={pct}
                    colorScheme={STATUS_COLORS[status]}
                    size="sm"
                    borderRadius="full"
                    aria-label={`${STATUS_LABELS[status]}: ${pct}%`}
                  />
                </Box>
              </MotionBox>
            );
          })}
        </VStack>
      </MotionBox>
    </GlassCard>
  );
}

export default StatusBreakdown;
