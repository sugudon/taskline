import { Avatar, Badge, Divider, Heading, HStack, SimpleGrid, Stack, Text, VStack } from '@chakra-ui/react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { TextReveal } from '../components/ui/TextReveal';
import { LoadingState } from '../components/ui/LoadingState';
import { ProfileForm } from '../components/auth/ProfileForm';
import { useAuth } from '../hooks/useAuth';

const formatMemberSince = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const providerLabel = (provider: string | null): string =>
  provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Email';

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return <LoadingState label="Loading profile..." />;
  }

  const displayName = user.full_name ?? user.email;

  return (
    <PageWrapper>
      <VStack align="stretch" spacing={2} mb={8}>
        <TextReveal text="Your profile" gradient />
        <Text color="text.muted">Manage how you appear to teammates.</Text>
      </VStack>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} alignItems="start">
        <GlassCard>
          <VStack spacing={4} textAlign="center">
            <Avatar size="2xl" name={displayName} src={user.avatar_url ?? undefined} />
            <VStack spacing={1}>
              <Heading size="md" noOfLines={1} wordBreak="break-all">
                {displayName}
              </Heading>
              <Text color="text.muted" fontSize="sm" wordBreak="break-all">
                {user.email}
              </Text>
            </VStack>
            <HStack spacing={2} wrap="wrap" justify="center">
              <Badge colorScheme={user.oauth_provider ? 'blue' : 'purple'} data-testid="provider-badge">
                {providerLabel(user.oauth_provider)}
              </Badge>
              {user.is_verified ? <Badge colorScheme="green">Verified</Badge> : null}
            </HStack>
            <Divider borderColor="border.subtle" />
            <Stack spacing={0}>
              <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wider">
                Member since
              </Text>
              <Text fontWeight="medium">{formatMemberSince(user.created_at)}</Text>
            </Stack>
          </VStack>
        </GlassCard>

        <GlassCard isStatic gridColumn={{ lg: 'span 2' }}>
          <Heading size="md" mb={1}>
            Edit profile
          </Heading>
          <Text color="text.muted" fontSize="sm" mb={6}>
            Update your display name and avatar.
          </Text>
          <ProfileForm key={user.id} user={user} />
        </GlassCard>
      </SimpleGrid>
    </PageWrapper>
  );
}

export default ProfilePage;
