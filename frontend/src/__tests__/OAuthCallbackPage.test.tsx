import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage';
import type { AuthContextValue } from '../context/authContextValue';
import { OAUTH_NONCE_KEY } from '../services/oauthNonce';
import { makeUser } from './utils/fixtures';
import { renderWithProviders } from './utils/render';

const NONCE = 'n0nce-abcdefghijklmnopqrstuvwxyz1';

const setHash = (hash: string): void => {
  window.history.replaceState(null, '', `/auth/callback${hash}`);
};

const renderPage = (setTokens: AuthContextValue['setTokens']) =>
  renderWithProviders(<OAuthCallbackPage />, {
    route: '/auth/callback',
    path: '/auth/callback',
    auth: { setTokens },
    routes: { '/dashboard': <div>dashboard page</div>, '/login': <div>login page</div> },
  });

describe('OAuthCallbackPage', () => {
  beforeEach(() => sessionStorage.setItem(OAUTH_NONCE_KEY, NONCE));
  afterEach(() => {
    setHash('');
    sessionStorage.clear();
  });

  it('stores tokens when the nonce matches, strips them from the URL and goes to the dashboard', async () => {
    setHash(`#access_token=acc123&refresh_token=ref456&nonce=${NONCE}`);
    const setTokens = vi.fn<AuthContextValue['setTokens']>().mockResolvedValue(makeUser());
    renderPage(setTokens);
    expect(await screen.findByText('dashboard page')).toBeInTheDocument();
    expect(setTokens).toHaveBeenCalledTimes(1);
    expect(setTokens).toHaveBeenCalledWith('acc123', 'ref456');
    expect(window.location.hash).toBe('');
    expect(sessionStorage.getItem(OAUTH_NONCE_KEY)).toBeNull();
  });

  it.each([
    ['missing from the callback', '#access_token=acc&refresh_token=ref', NONCE],
    ['different from the stored one', '#access_token=acc&refresh_token=ref&nonce=other', NONCE],
    ['not stored in this tab', `#access_token=acc&refresh_token=ref&nonce=${NONCE}`, null],
  ])('rejects tokens when the nonce is %s', async (_label, hash, stored) => {
    if (stored === null) sessionStorage.removeItem(OAUTH_NONCE_KEY);
    setHash(hash);
    const setTokens = vi.fn<AuthContextValue['setTokens']>();
    renderPage(setTokens);
    expect(await screen.findByRole('alert')).toHaveTextContent('did not start in this browser tab');
    expect(setTokens).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(sessionStorage.getItem(OAUTH_NONCE_KEY)).toBeNull();
  });

  it('shows a failure when the user cannot be loaded with the tokens', async () => {
    setHash(`#access_token=acc&refresh_token=ref&nonce=${NONCE}`);
    const setTokens = vi.fn<AuthContextValue['setTokens']>().mockResolvedValue(null);
    renderPage(setTokens);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your account');
  });

  it.each([
    ['access_denied', 'Google sign-in was cancelled.'],
    ['invalid_state', 'Your sign-in session expired. Please try again.'],
    ['email_not_verified', 'Your Google email address is not verified.'],
    ['account_disabled', 'This account has been disabled.'],
    ['oauth_not_configured', 'Google sign-in is not available right now.'],
    ['nonce_mismatch', 'did not start in this browser tab'],
    ['<script>alert(1)</script>', 'Google sign-in failed. Please try again.'],
    ['constructor', 'Google sign-in failed. Please try again.'],
  ])('maps error=%s to a known message', async (code, message) => {
    setHash(`#error=${encodeURIComponent(code)}&nonce=${NONCE}`);
    const setTokens = vi.fn<AuthContextValue['setTokens']>();
    renderPage(setTokens);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('script');
    expect(setTokens).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('reports missing credentials when the hash is partial', async () => {
    setHash(`#access_token=only-access&nonce=${NONCE}`);
    const setTokens = vi.fn<AuthContextValue['setTokens']>();
    renderPage(setTokens);
    expect(await screen.findByRole('alert')).toHaveTextContent('No sign-in credentials were returned');
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('navigates back to the login page from the error screen', async () => {
    setHash(`#error=access_denied&nonce=${NONCE}`);
    renderPage(vi.fn<AuthContextValue['setTokens']>());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to sign in' }));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });
});
