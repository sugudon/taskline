import { forwardRef, type ReactNode } from 'react';
import { MotionBox, cardHover, type MotionBoxProps } from './motion';

export interface GlassCardProps extends MotionBoxProps {
  children?: ReactNode;
  /** Disable hover elevation (e.g. for static form containers). */
  isStatic?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { children, isStatic = false, ...rest },
  ref,
) {
  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isStatic ? undefined : cardHover}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      p={6}
      borderRadius="2xl"
      bg="bg.surface"
      backdropFilter="blur(16px)"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="lg"
      {...rest}
    >
      {children}
    </MotionBox>
  );
});

export default GlassCard;
