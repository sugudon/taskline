import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, AlertIcon, VStack } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { MotionBox } from '../ui/motion';
import { PasswordToggle } from './PasswordToggle';
import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from './validation';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;

const INITIAL_VALUES: RegisterValues = { fullName: '', email: '', password: '', confirmPassword: '' };

const validate = (v: RegisterValues): RegisterErrors => {
  const errors: RegisterErrors = {};
  if (v.fullName.trim().length > 100) errors.fullName = 'Name must be 100 characters or fewer';
  const email = validateEmail(v.email);
  if (email) errors.email = email;
  const password = validatePassword(v.password, MIN_PASSWORD_LENGTH);
  if (password) errors.password = password;
  if (!v.confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (v.confirmPassword !== v.password) errors.confirmPassword = 'Passwords do not match';
  return errors;
};

export interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register } = useAuth();
  const [values, setValues] = useState<RegisterValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const update = (field: keyof RegisterValues, value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const fullName = values.fullName.trim();
      await register({
        email: values.email.trim(),
        password: values.password,
        ...(fullName ? { full_name: fullName } : {}),
      });
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
            key="register-error"
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
        label="Full name"
        name="full_name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        value={values.fullName}
        onChange={(e) => update('fullName', e.target.value)}
        error={errors.fullName}
      />

      <AnimatedInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={values.email}
        onChange={(e) => update('email', e.target.value)}
        error={errors.email}
        isRequired
      />

      <AnimatedInput
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={values.password}
        onChange={(e) => update('password', e.target.value)}
        error={errors.password}
        helperText={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
        isRequired
        rightElement={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
      />

      <AnimatedInput
        label="Confirm password"
        name="confirm_password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Repeat your password"
        value={values.confirmPassword}
        onChange={(e) => update('confirmPassword', e.target.value)}
        error={errors.confirmPassword}
        isRequired
      />

      <GradientButton type="submit" size="lg" w="full" isLoading={isSubmitting} loadingText="Creating account...">
        Create account
      </GradientButton>
    </VStack>
  );
}

export default RegisterForm;
