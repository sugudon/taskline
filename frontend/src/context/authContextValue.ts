import { createContext } from 'react';
import type { RegisterRequest, UserResponse } from '../types';

export interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserResponse>;
  register: (data: RegisterRequest) => Promise<UserResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserResponse | null>;
  setTokens: (access: string, refresh: string) => Promise<UserResponse | null>;
  setUser: (user: UserResponse | null) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
