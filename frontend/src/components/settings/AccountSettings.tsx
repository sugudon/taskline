import { Avatar, Badge, Box, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedButton } from '../ui/AnimatedButton';
import type { UserResponse } from '../../types';

export interface AccountSettingsProps {
  user: UserResponse;
}

const providerLabel = (provider: string | null): string => {
  if (!provider) return 'Email & password';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export function AccountSettings({ user }: AccountSettingsProps) {
  const navigate = useNavigate();
  const name = user.full_name ?? user.email;
  return (
    <GlassCard isStatic>
      <Heading size="md" mb={4}>
        Account
      </Heading>
      <HStack spacing={4} align="center" flexWrap="wrap">
        <Avatar size="md" name={name} src={user.avatar_url ?? undefined} />
        <VStack align="start" spacing={1} flex={1} minW={0}>
          {user.full_name ? <Text fontWeight="semibold">{user.full_name}</Text> : null}
          <Box>
            <Text fontSize="sm" color="text.muted">
              Email
            </Text>
            <Text fontWeight="medium" wordBreak="break-all">
              {user.email}
            </Text>
          </Box>
          <HStack spacing={2}>
            <Text fontSize="sm" color="text.muted">
              Sign-in method:
            </Text>
            <Badge colorScheme={user.oauth_provider ? 'blue' : 'gray'}>{providerLabel(user.oauth_provider)}</Badge>
            {user.is_verified ? <Badge colorScheme="green">Verified</Badge> : null}
          </HStack>
        </VStack>
        <AnimatedButton variant="outline" onClick={() => navigate('/profile')}>
          Edit profile
        </AnimatedButton>
      </HStack>
    </GlassCard>
  );
}

export default AccountSettings;
