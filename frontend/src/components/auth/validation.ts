const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export const validateEmail = (value: string): string | undefined => {
  const v = value.trim();
  if (!v) return 'Email is required';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return undefined;
};

export const validatePassword = (value: string, minLength = 0): string | undefined => {
  if (!value) return 'Password is required';
  if (minLength > 0 && value.length < minLength) return `Password must be at least ${minLength} characters`;
  return undefined;
};

export const validateOptionalUrl = (value: string): string | undefined => {
  const v = value.trim();
  if (!v) return undefined;
  try {
    const url = new URL(v);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'URL must start with http:// or https://';
    return undefined;
  } catch {
    return 'Enter a valid URL';
  }
};
