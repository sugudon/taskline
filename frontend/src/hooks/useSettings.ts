import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { settingsService } from '../services/settingsService';
import type { PasswordChange } from '../types';

export const useChangePassword = (): UseMutationResult<void, Error, PasswordChange> =>
  useMutation({
    mutationFn: settingsService.changePassword,
  });

export const useDeleteAccount = (): UseMutationResult<void, Error, void> =>
  useMutation({
    mutationFn: () => settingsService.deleteAccount(),
  });
