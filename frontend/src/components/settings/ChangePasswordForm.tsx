import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, AlertDescription, AlertIcon, Heading, Text, useToast, VStack } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { useChangePassword } from '../../hooks/useSettings';
import { getErrorMessage } from '../../services/api';

export interface ChangePasswordFormProps {
  oauthProvider: string | null;
}

interface PasswordFields {
  current: string;
  next: string;
  confirm: string;
}

type FieldErrors = Partial<Record<keyof PasswordFields, string>>;

const EMPTY: PasswordFields = { current: '', next: '', confirm: '' };
const MIN_LENGTH = 8;

const validate = (f: PasswordFields): FieldErrors => {
  const errors: FieldErrors = {};
  if (!f.current) errors.current = 'Current password is required';
  if (f.next.length < MIN_LENGTH) errors.next = `Password must be at least ${MIN_LENGTH} characters`;
  else if (f.next === f.current) errors.next = 'New password must differ from the current one';
  if (f.confirm !== f.next) errors.confirm = 'Passwords do not match';
  return errors;
};

export function ChangePasswordForm({ oauthProvider }: ChangePasswordFormProps) {
  const toast = useToast();
  const mutation = useChangePassword();
  const [fields, setFields] = useState<PasswordFields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (key: keyof PasswordFields) => (e: ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    mutation.mutate(
      { current_password: fields.current, new_password: fields.next },
      {
        onSuccess: () => {
          setFields(EMPTY);
          toast({ status: 'success', title: 'Password updated' });
        },
        onError: (err) => {
          toast({ status: 'error', title: 'Could not change password', description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <GlassCard isStatic>
      <Heading size="md" mb={2}>
        Change password
      </Heading>
      {oauthProvider ? (
        <Alert status="info" borderRadius="xl" mt={2}>
          <AlertIcon />
          <AlertDescription>
            You sign in with {oauthProvider.charAt(0).toUpperCase() + oauthProvider.slice(1)}, so there&apos;s no
            password to change. Manage your credentials with your {oauthProvider} account.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Text color="text.muted" fontSize="sm" mb={4}>
            Use at least {MIN_LENGTH} characters.
          </Text>
          <VStack as="form" spacing={4} align="stretch" onSubmit={handleSubmit} noValidate>
            <AnimatedInput
              label="Current password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              value={fields.current}
              onChange={update('current')}
              error={errors.current}
              isRequired
            />
            <AnimatedInput
              label="New password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              value={fields.next}
              onChange={update('next')}
              error={errors.next}
              isRequired
            />
            <AnimatedInput
              label="Confirm new password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              value={fields.confirm}
              onChange={update('confirm')}
              error={errors.confirm}
              isRequired
            />
            <GradientButton type="submit" alignSelf="start" isLoading={mutation.isPending}>
              Update password
            </GradientButton>
          </VStack>
        </>
      )}
    </GlassCard>
  );
}

export default ChangePasswordForm;
