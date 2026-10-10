import { forwardRef } from 'react';
import { MotionButton, buttonHover, buttonTap, type MotionButtonProps } from './motion';

export type GradientButtonProps = MotionButtonProps;

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  function GradientButton({ children, type = 'button', isDisabled, isLoading, ...rest }, ref) {
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
        bgGradient="linear(to-r, brand.500, accent.500)"
        color="white"
        borderRadius="full"
        px={6}
        fontWeight="semibold"
        boxShadow="md"
        _hover={{ bgGradient: 'linear(to-r, brand.600, accent.600)', boxShadow: 'lg' }}
        _active={{ bgGradient: 'linear(to-r, brand.700, accent.700)' }}
        _disabled={{ opacity: 0.6, cursor: 'not-allowed', boxShadow: 'none' }}
        {...rest}
      >
        {children}
      </MotionButton>
    );
  },
);

export default GradientButton;
