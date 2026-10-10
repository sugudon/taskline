import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, AlertIcon, HStack, VStack, useToast } from '@chakra-ui/react';
import { AnimatedInput } from '../ui/AnimatedInput';
import { AnimatedButton } from '../ui/AnimatedButton';
import { GradientButton } from '../ui/GradientButton';
import { validateOptionalUrl } from './validation';
import { useUpdateProfile } from '../../hooks/useProfile';
import { getErrorMessage } from '../../services/api';
import type { UserResponse, UserUpdate } from '../../types';

interface ProfileErrors {
  fullName?: string;
  avatarUrl?: string;
}

export interface ProfileFormProps {
  user: UserResponse;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const toast = useToast();
  const mutation = useUpdateProfile();
  const [fullName, setFullName] = useState<string>(user.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatar_url ?? '');
  const [errors, setErrors] = useState<ProfileErrors>({});

  const isDirty = fullName.trim() !== (user.full_name ?? '') || avatarUrl.trim() !== (user.avatar_url ?? '');

  const handleReset = (): void => {
    setFullName(user.full_name ?? '');
    setAvatarUrl(user.avatar_url ?? '');
    setErrors({});
    mutation.reset();
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const next: ProfileErrors = {
      fullName: fullName.trim().length > 100 ? 'Name must be 100 characters or fewer' : undefined,
      avatarUrl: validateOptionalUrl(avatarUrl),
    };
    setErrors(next);
    if (next.fullName || next.avatarUrl) return;

    const trimmedAvatar = avatarUrl.trim();
    const payload: UserUpdate = {
      full_name: fullName.trim(),
      avatar_url: trimmedAvatar ? trimmedAvatar : null,
    };
    mutation.mutate(payload, {
      onSuccess: (updated) => {
        setFullName(updated.full_name ?? '');
        setAvatarUrl(updated.avatar_url ?? '');
        toast({ status: 'success', title: 'Profile updated', description: 'Your changes have been saved.' });
      },
    });
  };

  return (
    <VStack as="form" spacing={5} align="stretch" noValidate onSubmit={handleSubmit}>
      {mutation.isError ? (
        <Alert status="error" borderRadius="xl" role="alert">
          <AlertIcon />
          <AlertDescription>{getErrorMessage(mutation.error)}</AlertDescription>
        </Alert>
      ) : null}

      <AnimatedInput
        label="Full name"
        name="full_name"
        autoComplete="name"
        placeholder="Your name"
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value);
          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
        }}
        error={errors.fullName}
      />

      <AnimatedInput
        label="Avatar URL"
        name="avatar_url"
        type="url"
        placeholder="https://example.com/me.png"
        value={avatarUrl}
        onChange={(e) => {
          setAvatarUrl(e.target.value);
          if (errors.avatarUrl) setErrors((prev) => ({ ...prev, avatarUrl: undefined }));
        }}
        error={errors.avatarUrl}
        helperText="Leave empty to use your initials"
      />

      <HStack justify="flex-end" spacing={3}>
        <AnimatedButton variant="ghost" colorScheme="gray" onClick={handleReset} isDisabled={!isDirty || mutation.isPending}>
          Reset
        </AnimatedButton>
        <GradientButton type="submit" isLoading={mutation.isPending} loadingText="Saving..." isDisabled={!isDirty}>
          Save changes
        </GradientButton>
      </HStack>
    </VStack>
  );
}

export default ProfileForm;
