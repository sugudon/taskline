/** CSRF-style nonce binding the Google OAuth round-trip to this browser tab. */
export const OAUTH_NONCE_KEY = 'oauth_nonce';
const NONCE_BYTES = 24; // 24 bytes -> 32 base64url characters

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const generateNonce = (): string => {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

/** Generate a fresh nonce and remember it for the callback page. */
export const createOAuthNonce = (): string => {
  const nonce = generateNonce();
  sessionStorage.setItem(OAUTH_NONCE_KEY, nonce);
  return nonce;
};

