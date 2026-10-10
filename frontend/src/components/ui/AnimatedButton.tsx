import { forwardRef } from 'react';
import { MotionButton, buttonHover, buttonTap, type MotionButtonProps } from './motion';

/** Secondary/outline/ghost buttons — same motion presets as GradientButton. */
export const AnimatedButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  function AnimatedButton({ type = 'button', isDisabled, isLoading, ...rest }, ref) {
    const inactive = Boolean(isDisabled || isLoading);
    return (
      <MotionButton
        ref={ref}
        type={type}
        isDisabled={isDisabled}
        isLoading={isLoading}
        whileHover={inactive ? undefined : buttonHover}
        whileTap={inactive ? undefined : buttonTap}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        {...rest}
      />
    );
  },
);

export default AnimatedButton;
