import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertIcon, VStack } from '@chakra-ui/react';
import { AuthShell } from '../components/auth/AuthShell';
import { GradientButton } from '../components/ui/GradientButton';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { OAUTH_NONCE_KEY } from '../services/oauthNonce';

type CallbackParams =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

const GENERIC_ERROR = 'Google sign-in failed. Please try again.';

/** Only known backend error codes are shown; anything else gets the generic message. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Your sign-in session expired. Please try again.',
  invalid_request: 'The sign-in request was invalid. Please try again.',
  missing_code: 'Google did not return an authorization code. Please try again.',
  access_denied: 'Google sign-in was cancelled.',
  email_not_verified: 'Your Google email address is not verified.',
  account_disabled: 'This account has been disabled.',
  token_exchange_failed: 'We could not complete sign-in with Google. Please try again.',
  userinfo_failed: 'We could not read your Google profile. Please try again.',
  oauth_not_configured: 'Google sign-in is not available right now.',
  nonce_mismatch: 'This sign-in attempt did not start in this browser tab. Please try again.',
};

const humanizeError = (code: string): string =>
  Object.prototype.hasOwnProperty.call(OAUTH_ERROR_MESSAGES, code) ? OAUTH_ERROR_MESSAGES[code] : GENERIC_ERROR;

/**
 * Parse `#access_token=..&refresh_token=..&nonce=..` or `#error=..&nonce=..` from the URL fragment.
 * The nonce must match the one stored when the flow started in this tab.
 */
const parseHash = (hash: string, expectedNonce: string | null): CallbackParams => {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const nonce = params.get('nonce');
  if (!nonce || !expectedNonce || nonce !== expectedNonce) {
    return { kind: 'error', message: OAUTH_ERROR_MESSAGES.nonce_mismatch };
  }
  const error = params.get('error');
  if (error) return { kind: 'error', message: humanizeError(error) };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  return { kind: 'error', message: 'No sign-in credentials were returned. Please try again.' };
};

export function OAuthCallbackPage() {
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const [params] = useState<CallbackParams>(() =>
    parseHash(window.location.hash, sessionStorage.getItem(OAUTH_NONCE_KEY)),
  );
  const [failure, setFailure] = useState<string | null>(null);
  const handled = useRef<boolean>(false);

  useEffect(() => {
    // The nonce is single-use whatever the outcome.
    sessionStorage.removeItem(OAUTH_NONCE_KEY);
    // Strip tokens from the address bar / history.
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    if (params.kind !== 'tokens' || handled.current) return;
    handled.current = true;

    const complete = async (): Promise<void> => {
      const user = await setTokens(params.accessToken, params.refreshToken);
      if (user) {
        navigate('/dashboard', { replace: true });
      } else {
        setFailure('We could not load your account. Please sign in again.');
      }
    };
    void complete();
  }, [params, setTokens, navigate]);

  const errorMessage = params.kind === 'error' ? params.message : failure;

  if (!errorMessage) {
    return <LoadingState fullScreen label="Signing you in..." />;
  }

  return (
    <AuthShell title="Sign-in failed">
      <VStack spacing={6} align="stretch">
        <Alert status="error" borderRadius="xl" role="alert">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <GradientButton w="full" onClick={() => navigate('/login', { replace: true })}>
          Back to sign in
        </GradientButton>
      </VStack>
    </AuthShell>
  );
}

export default OAuthCallbackPage;
