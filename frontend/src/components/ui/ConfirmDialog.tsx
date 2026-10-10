import { useRef, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { AnimatedButton } from './AnimatedButton';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  colorScheme?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  colorScheme = 'red',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered motionPreset="slideInBottom">
      <AlertDialogOverlay backdropFilter="blur(4px)">
        <AlertDialogContent borderRadius="2xl">
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {title}
          </AlertDialogHeader>
          {body ? <AlertDialogBody>{body}</AlertDialogBody> : null}
          <AlertDialogFooter gap={3}>
            <AnimatedButton ref={cancelRef} variant="ghost" colorScheme="gray" onClick={onClose} isDisabled={isLoading}>
              {cancelLabel}
            </AnimatedButton>
            <AnimatedButton colorScheme={colorScheme} onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </AnimatedButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default ConfirmDialog;
