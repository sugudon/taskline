import type { ReactNode } from 'react';
import { MotionBox, type MotionBoxProps } from '../ui/motion';

export interface PageWrapperProps extends MotionBoxProps {
  children?: ReactNode;
}

export function PageWrapper({ children, ...rest }: PageWrapperProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      w="full"
      {...rest}
    >
      {children}
    </MotionBox>
  );
}

export default PageWrapper;
