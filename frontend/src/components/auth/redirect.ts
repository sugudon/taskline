const AUTH_PAGES = new Set(['/login', '/register']);
// e.g. "javascript:", "https:", "data:" — anything that looks like a URL scheme.
const SCHEME_RE = /^[a-z][a-z\d+.-]*:/i;

/**
 * True only for same-origin, app-relative paths. Rejects protocol-relative (`//evil.com`),
 * backslash tricks (`/\evil.com`, browsers normalise `\` to `/`), control characters and schemes.
 */
export const isSafeRedirectPath = (path: string): boolean => {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('\\')) return false;
  // eslint-disable-next-line no-control-regex -- intentionally reject control characters (tabs/newlines are stripped by URL parsers)
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  if (SCHEME_RE.test(path.slice(1))) return false;
  return true;
};

const pathnameOf = (path: string): string => path.split(/[?#]/, 1)[0];

/** Resolve the post-login destination from react-router `location.state.from`. */
export const getRedirectPath = (state: unknown, fallback = '/dashboard'): string => {
  if (typeof state !== 'object' || state === null || !('from' in state)) return fallback;
  const from: unknown = (state as { from: unknown }).from;
  let candidate: string | null = null;
  if (typeof from === 'string') {
    candidate = from;
  } else if (typeof from === 'object' && from !== null && 'pathname' in from) {
    const loc = from as { pathname: unknown; search?: unknown; hash?: unknown };
    if (typeof loc.pathname !== 'string') return fallback;
    const search = typeof loc.search === 'string' ? loc.search : '';
    const hash = typeof loc.hash === 'string' ? loc.hash : '';
    candidate = `${loc.pathname}${search}${hash}`;
  }
  if (candidate === null || !isSafeRedirectPath(candidate)) return fallback;
  if (AUTH_PAGES.has(pathnameOf(candidate))) return fallback;
  return candidate;
};
