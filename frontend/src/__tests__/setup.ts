import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement scrolling; framer-motion and pages call it.
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });

afterEach(() => {
  localStorage.clear();
});
