import { Text, VStack } from '@chakra-ui/react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { TextReveal } from '../components/ui/TextReveal';
import { LoadingState } from '../components/ui/LoadingState';
import { AccountSettings } from '../components/settings/AccountSettings';
import { ChangePasswordForm } from '../components/settings/ChangePasswordForm';
import { DangerZone } from '../components/settings/DangerZone';
import { useAuth } from '../hooks/useAuth';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <PageWrapper maxW="3xl" mx="auto">
      <TextReveal text="Settings" gradient mb={1} />
      <Text color="text.muted" mb={8}>
        Manage your account, security, and data.
      </Text>
      {user ? (
        <VStack spacing={6} align="stretch">
          <AccountSettings user={user} />
          <ChangePasswordForm oauthProvider={user.has_password ? null : user.oauth_provider} />
          <DangerZone />
        </VStack>
      ) : (
        <LoadingState />
      )}
    </PageWrapper>
  );
}

export default SettingsPage;
