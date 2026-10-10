import api from './api';
import type { PasswordChange } from '../types';

export const settingsService = {
  async changePassword(payload: PasswordChange): Promise<void> {
    await api.put('/auth/password', payload);
  },
  async deleteAccount(): Promise<void> {
    await api.delete('/auth/me');
  },
};

export default settingsService;
