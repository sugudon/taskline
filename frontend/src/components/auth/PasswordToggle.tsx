import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { MotionIconButton, buttonHover, buttonTap } from '../ui/motion';

export interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <MotionIconButton
      aria-label={visible ? 'Hide password' : 'Show password'}
      icon={visible ? <ViewOffIcon /> : <ViewIcon />}
      size="sm"
      variant="ghost"
      colorScheme="gray"
      onClick={onToggle}
      whileHover={buttonHover}
      whileTap={buttonTap}
    />
  );
}

export default PasswordToggle;
