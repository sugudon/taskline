import { Link as RouterLink, Navigate, useNavigate } from 'react-router';
import { Link, Text } from '@chakra-ui/react';
import { AuthShell } from '../components/auth/AuthShell';
import { AuthDivider } from '../components/auth/AuthDivider';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { RegisterForm } from '../components/auth/RegisterForm';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingState fullScreen label="Checking your session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthShell title="Create account" subtitle="Start roasting your assignments in seconds.">
      <RegisterForm onSuccess={() => navigate('/dashboard', { replace: true })} />
      <AuthDivider />
      <GoogleLoginButton label="Sign up with Google" />
      <Text mt={6} textAlign="center" fontSize="sm" color="text.muted">
        Already have an account?{' '}
        <Link as={RouterLink} to="/login" color="brand.500" fontWeight="semibold">
          Sign in
        </Link>
      </Text>
    </AuthShell>
  );
}

export default RegisterPage;
