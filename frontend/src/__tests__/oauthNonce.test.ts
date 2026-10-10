import { API_BASE_URL } from '../services/api';
import { authService } from '../services/authService';
import { OAUTH_NONCE_KEY, createOAuthNonce, generateNonce } from '../services/oauthNonce';

describe('oauth nonce', () => {
  afterEach(() => sessionStorage.clear());

  it('generates distinct 32-char base64url nonces', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });

  it('stores the nonce in sessionStorage', () => {
    const nonce = createOAuthNonce();
    expect(sessionStorage.getItem(OAUTH_NONCE_KEY)).toBe(nonce);
  });

  it('starts Google login with the nonce in the query string', () => {
    const original = window.location;
    const assign = vi.fn<(url: string) => void>();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
    try {
      authService.startGoogleLogin();
      const stored = sessionStorage.getItem(OAUTH_NONCE_KEY);
      expect(stored).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(assign).toHaveBeenCalledWith(`${API_BASE_URL}/auth/google?nonce=${stored ?? ''}`);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
