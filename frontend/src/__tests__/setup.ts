import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { configure } from '@testing-library/react';

// findBy*/waitFor default to 1s, which flakes on loaded machines (e.g. CI running tsc in parallel).
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement scrolling; framer-motion and pages call it.
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });

afterEach(() => {
  localStorage.clear();
});
