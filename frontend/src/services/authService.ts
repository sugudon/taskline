import api, { API_BASE_URL } from './api';
import { createOAuthNonce } from './oauthNonce';
import type { PasswordChange, UserResponse, UserUpdate } from '../types';

/** Full URL of the backend endpoint that starts the Google OAuth flow. */
export const GOOGLE_LOGIN_URL = `${API_BASE_URL}/auth/google`;

export const authService = {
  async getMe(): Promise<UserResponse> {
    const { data } = await api.get<UserResponse>('/auth/me');
    return data;
  },

  async updateMe(payload: UserUpdate): Promise<UserResponse> {
    const { data } = await api.put<UserResponse>('/auth/me', payload);
    return data;
  },

  async changePassword(payload: PasswordChange): Promise<void> {
    await api.put('/auth/password', payload);
  },

  async deleteAccount(): Promise<void> {
    await api.delete('/auth/me');
  },

  /** Redirect to Google via the backend, binding the flow to a per-tab nonce. */
  startGoogleLogin(): void {
    const nonce = createOAuthNonce();
    window.location.assign(`${GOOGLE_LOGIN_URL}?nonce=${encodeURIComponent(nonce)}`);
  },
};

export default authService;
