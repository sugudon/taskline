import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, AlertIcon, VStack } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { MotionBox } from '../ui/motion';
import { PasswordToggle } from './PasswordToggle';
import { validateEmail, validatePassword } from './validation';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

interface LoginErrors {
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const validate = (): LoginErrors => ({
    email: validateEmail(email),
    password: validatePassword(password),
  });

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <VStack as="form" spacing={5} align="stretch" noValidate onSubmit={(e: FormEvent) => void handleSubmit(e)}>
      <AnimatePresence>
        {submitError ? (
          <MotionBox
            key="login-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert status="error" borderRadius="xl" role="alert">
              <AlertIcon />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          </MotionBox>
        ) : null}
      </AnimatePresence>

      <AnimatedInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        error={errors.email}
        isRequired
      />

      <AnimatedInput
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        error={errors.password}
        isRequired
        rightElement={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
      />

      <GradientButton type="submit" size="lg" w="full" isLoading={isSubmitting} loadingText="Signing in...">
        Sign in
      </GradientButton>
    </VStack>
  );
}

export default LoginForm;
