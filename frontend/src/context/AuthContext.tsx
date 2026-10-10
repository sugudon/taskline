import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { tokenStorage } from '../services/api';
import type { RegisterRequest, Token, UserResponse } from '../types';
import { AuthContext, type AuthContextValue } from './authContextValue';

interface AuthProviderProps {
  children: ReactNode;
}

const fetchMe = async (): Promise<UserResponse> => {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async (): Promise<UserResponse | null> => {
    if (!tokenStorage.getAccess()) {
      setUser(null);
      return null;
    }
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      tokenStorage.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async (): Promise<void> => {
      await refreshUser();
      if (active) setIsLoading(false);
    };
    void init();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const storeTokensAndLoad = useCallback(async (token: Token): Promise<UserResponse> => {
    tokenStorage.set(token.access_token, token.refresh_token);
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<UserResponse> => {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);
      const { data } = await api.post<Token>('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return storeTokensAndLoad(data);
    },
    [storeTokensAndLoad],
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<UserResponse> => {
      const { data } = await api.post<Token>('/auth/register', payload);
      return storeTokensAndLoad(data);
    },
    [storeTokensAndLoad],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) await api.post('/auth/logout', { refresh_token: refresh });
    } catch {
      // Ignore — tokens are cleared locally regardless.
    } finally {
      tokenStorage.clear();
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const setTokens = useCallback(
    async (access: string, refresh: string): Promise<UserResponse | null> => {
      tokenStorage.set(access, refresh);
      return refreshUser();
    },
    [refreshUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refreshUser,
      setTokens,
      setUser,
    }),
    [user, isLoading, login, register, logout, refreshUser, setTokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
