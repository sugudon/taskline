import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router';
import { Link, Text } from '@chakra-ui/react';
import { AuthShell } from '../components/auth/AuthShell';
import { AuthDivider } from '../components/auth/AuthDivider';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { LoginForm } from '../components/auth/LoginForm';
import { getRedirectPath } from '../components/auth/redirect';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = getRedirectPath(location.state);

  if (isLoading) {
    return <LoadingState fullScreen label="Checking your session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Let's see what's due.">
      <LoginForm onSuccess={() => navigate(redirectTo, { replace: true })} />
      <AuthDivider />
      <GoogleLoginButton />
      <Text mt={6} textAlign="center" fontSize="sm" color="text.muted">
        Don&apos;t have an account?{' '}
        <Link as={RouterLink} to="/register" color="brand.500" fontWeight="semibold">
          Create one
        </Link>
      </Text>
    </AuthShell>
  );
}

export default LoginPage;
