import { useState, type FormEvent } from 'react';
import { Box, HStack, Heading, Text, useToast } from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { useAddMember } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';

export interface AddMemberFormProps {
  projectId: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddMemberForm({ projectId }: AddMemberFormProps) {
  const toast = useToast();
  const addMember = useAddMember(projectId);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address');
      return;
    }
    setError(undefined);
    addMember.mutate(
      { email: value },
      {
        onSuccess: (member) => {
          toast({ status: 'success', title: `${member.user.full_name || member.user.email} added` });
          setEmail('');
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <GlassCard isStatic>
      <Heading size="md" mb={1}>
        Add member
      </Heading>
      <Text fontSize="sm" color="text.muted" mb={4}>
        Invite an existing user by their email address.
      </Text>
      <Box as="form" onSubmit={handleSubmit} noValidate>
        <HStack align="start" spacing={3}>
          <AnimatedInput
            label="Email"
            name="member-email"
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(undefined);
            }}
            error={error}
          />
          <GradientButton type="submit" isLoading={addMember.isPending} mt={8} flexShrink={0}>
            Add
          </GradientButton>
        </HStack>
      </Box>
    </GlassCard>
  );
}

export default AddMemberForm;
