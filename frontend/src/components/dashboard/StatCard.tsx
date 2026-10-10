import { useEffect, useState } from 'react';
import { HStack, LinkOverlay, Stat, StatHelpText, StatLabel, StatNumber, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';
import { animate } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';

export interface StatCardProps {
  label: string;
  value: number;
  to: string;
  helpText?: string;
  icon?: string;
  /** Chakra color scheme for the number (e.g. "red" for overdue). */
  colorScheme?: string;
}

const useCountUp = (target: number, duration = 0.8): number => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [target, duration]);
  return display;
};

export function StatCard({ label, value, to, helpText, icon, colorScheme = 'brand' }: StatCardProps) {
  const display = useCountUp(value);
  const isAlert = colorScheme === 'red' && value > 0;
  return (
    <GlassCard
      position="relative"
      p={5}
      borderColor={isAlert ? 'red.300' : 'border.subtle'}
      data-testid={`stat-${label}`}
    >
      <Stat>
        <HStack justify="space-between" align="start">
          <StatLabel color="text.muted" fontWeight="medium">
            <LinkOverlay as={RouterLink} to={to}>
              {label}
            </LinkOverlay>
          </StatLabel>
          {icon ? (
            <Text fontSize="xl" aria-hidden>
              {icon}
            </Text>
          ) : null}
        </HStack>
        <StatNumber fontSize="4xl" color={`${colorScheme}.500`} aria-label={String(value)}>
          {display}
        </StatNumber>
        {helpText ? <StatHelpText mb={0}>{helpText}</StatHelpText> : null}
      </Stat>
    </GlassCard>
  );
}

export default StatCard;
