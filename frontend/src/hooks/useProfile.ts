import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authService } from '../services/authService';
import type { UserResponse, UserUpdate } from '../types';
import { useAuth } from './useAuth';

/** PUT /auth/me — on success, pushes the updated user into AuthContext. */
export const useUpdateProfile = (): UseMutationResult<UserResponse, Error, UserUpdate> => {
  const { setUser } = useAuth();
  return useMutation<UserResponse, Error, UserUpdate>({
    mutationFn: (payload: UserUpdate) => authService.updateMe(payload),
    onSuccess: (updated) => {
      setUser(updated);
    },
  });
};

export default useUpdateProfile;
