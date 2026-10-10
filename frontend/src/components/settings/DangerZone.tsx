import { useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Heading,
  HStack,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedButton } from '../ui/AnimatedButton';
import { AnimatedInput } from '../ui/AnimatedInput';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useDeleteAccount } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

const CONFIRM_WORD = 'DELETE';

export function DangerZone() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const mutation = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | undefined>();

  const close = () => {
    if (mutation.isPending) return;
    setTyped('');
    setTypedError(undefined);
    mutation.reset();
    onClose();
  };

  const handleConfirm = () => {
    if (typed !== CONFIRM_WORD) {
      setTypedError(`Type ${CONFIRM_WORD} to confirm`);
      return;
    }
    mutation.mutate(undefined, {
      onSuccess: async () => {
        await logout();
        toast({ status: 'success', title: 'Account deleted', description: 'Sorry to see you go.' });
        navigate('/login', { replace: true });
      },
      // e.g. 409 when the user still owns projects shared with others: stay signed in.
      onError: (err) => {
        toast({ status: 'error', title: 'Could not delete account', description: getErrorMessage(err) });
      },
    });
  };

  return (
    <GlassCard isStatic borderColor="red.300">
      <Heading size="md" mb={2} color="red.500">
        Danger zone
      </Heading>
      <HStack justify="space-between" align="center" spacing={4} flexWrap="wrap">
        <Text color="text.muted" fontSize="sm" flex={1} minW="200px">
          Permanently delete your account and all associated data. This cannot be undone.
        </Text>
        <AnimatedButton colorScheme="red" variant="outline" onClick={onOpen}>
          Delete account
        </AnimatedButton>
      </HStack>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={close}
        onConfirm={handleConfirm}
        title="Delete your account?"
        confirmLabel="Delete account"
        isLoading={mutation.isPending}
        body={
          <VStack align="stretch" spacing={4}>
            {mutation.isError ? (
              <Alert status="error" borderRadius="xl" role="alert">
                <AlertIcon />
                <AlertDescription>{getErrorMessage(mutation.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Text>
              This permanently deletes your account. Projects you own and their assignments will be removed.
            </Text>
            <AnimatedInput
              label={`Type ${CONFIRM_WORD} to confirm`}
              name="confirm_delete"
              value={typed}
              autoComplete="off"
              onChange={(e) => {
                setTyped(e.target.value);
                setTypedError(undefined);
              }}
              error={typedError}
            />
          </VStack>
        }
      />
    </GlassCard>
  );
}

export default DangerZone;
