import {
  filtersFromSearchParams,
  filtersToSearchParams,
  formatDueDate,
  formatRelativeTime,
  userDisplayName,
  validateAssignmentForm,
  type AssignmentFormValues,
} from '../components/assignments/utils';
import { getRedirectPath, isSafeRedirectPath } from '../components/auth/redirect';
import { validateEmail, validateOptionalUrl, validatePassword } from '../components/auth/validation';
import { makeSummary } from './utils/fixtures';

describe('filters <-> search params', () => {
  it('round-trips every filter', () => {
    const params = filtersToSearchParams({
      project_id: 3,
      status: 'done',
      priority: 'low',
      mine: true,
      overdue: true,
      q: 'essay',
      sort: 'priority',
      page: 4,
    });
    expect(params.toString()).toBe('project_id=3&status=done&priority=low&mine=true&overdue=true&q=essay&sort=priority&page=4');
    expect(filtersFromSearchParams(params)).toEqual({
      project_id: 3,
      status: 'done',
      priority: 'low',
      mine: true,
      overdue: true,
      q: 'essay',
      sort: 'priority',
      page: 4,
    });
  });

  it('omits defaults from the URL', () => {
    expect(filtersToSearchParams({ sort: '-created_at', page: 1, mine: undefined }).toString()).toBe('');
  });

  it('drops invalid values when parsing', () => {
    const parsed = filtersFromSearchParams(
      new URLSearchParams('project_id=0&status=x&priority=y&sort=z&page=1.5&mine=1&q=%20%20'),
    );
    expect(parsed).toEqual({
      project_id: undefined,
      status: undefined,
      priority: undefined,
      mine: undefined,
      overdue: undefined,
      q: undefined,
      sort: '-created_at',
      page: 1,
    });
  });
});

describe('assignment form validation', () => {
  const base: AssignmentFormValues = {
    project_id: '1',
    title: 'ok',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    assignee_id: '',
  };

  it('accepts valid values', () => {
    expect(validateAssignmentForm(base)).toEqual({});
  });

  it('flags long titles and bad dates', () => {
    const errors = validateAssignmentForm({ ...base, title: 'x'.repeat(201), due_date: '01/02/2030' });
    expect(errors.title).toBe('Title must be at most 200 characters');
    expect(errors.due_date).toBe('Enter a valid date');
  });
});

describe('formatting helpers', () => {
  it('displays names with an email fallback', () => {
    expect(userDisplayName(makeSummary({ full_name: '  Ada ' }))).toBe('Ada');
    expect(userDisplayName(makeSummary({ full_name: '   ', email: 'x@y.z' }))).toBe('x@y.z');
  });

  it('formats due dates', () => {
    expect(formatDueDate(null)).toBe('—');
    expect(formatDueDate('garbage')).toBe('garbage');
    expect(formatDueDate('2030-01-15')).toContain('2030');
  });

  it('formats relative times', () => {
    const now = Date.parse('2030-01-01T12:00:00Z');
    expect(formatRelativeTime('2030-01-01T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2030-01-01T10:00:00Z', now)).toMatch(/2 hours ago/);
    expect(formatRelativeTime('2029-12-29T12:00:00Z', now)).toMatch(/3 days ago/);
  });
});

describe('getRedirectPath', () => {
  it.each<[unknown, string]>([
    [null, '/dashboard'],
    [{}, '/dashboard'],
    [{ from: '/projects/1' }, '/projects/1'],
    [{ from: '//evil.com' }, '/dashboard'],
    [{ from: 'https://evil.com' }, '/dashboard'],
    [{ from: { pathname: '/assignments', search: '?mine=true', hash: '#x' } }, '/assignments?mine=true#x'],
    [{ from: { pathname: '/login' } }, '/dashboard'],
    [{ from: { pathname: '/register' } }, '/dashboard'],
    [{ from: { pathname: 'relative' } }, '/dashboard'],
    [{ from: 42 }, '/dashboard'],
    // Open-redirect hardening (GHSA-wrjc-x8rr-h8h6 style payloads)
    [{ from: '/\\evil.com' }, '/dashboard'],
    [{ from: '/\\/evil.com' }, '/dashboard'],
    [{ from: '/projects\\..\\evil' }, '/dashboard'],
    [{ from: { pathname: '//evil.com' } }, '/dashboard'],
    [{ from: { pathname: '/\\evil.com' } }, '/dashboard'],
    [{ from: { pathname: '/x', search: '?next=\\evil' } }, '/dashboard'],
    [{ from: '/javascript:alert(1)' }, '/dashboard'],
    [{ from: 'javascript:alert(1)' }, '/dashboard'],
    [{ from: '/\t/evil.com' }, '/dashboard'],
    [{ from: '/login?x=1' }, '/dashboard'],
    [{ from: '/projects/1?tab=members#top' }, '/projects/1?tab=members#top'],
  ])('resolves %j to %s', (state, expected) => {
    expect(getRedirectPath(state)).toBe(expected);
  });

  it('honours a custom fallback', () => {
    expect(getRedirectPath({ from: '//evil.com' }, '/projects')).toBe('/projects');
  });
});

describe('isSafeRedirectPath', () => {
  it.each<[string, boolean]>([
    ['/', true],
    ['/assignments?q=a:b', true],
    ['', false],
    ['relative/path', false],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['/a\\b', false],
    ['/https://evil.com', false],
    ['/\n/evil.com', false],
  ])('%j -> %s', (path, expected) => {
    expect(isSafeRedirectPath(path)).toBe(expected);
  });
});

describe('auth validation', () => {
  it('validates emails', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('a@b')).toBe('Enter a valid email address');
    expect(validateEmail(' a@b.co ')).toBeUndefined();
  });

  it('validates passwords', () => {
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('abc', 8)).toBe('Password must be at least 8 characters');
    expect(validatePassword('abc')).toBeUndefined();
  });

  it('validates optional URLs', () => {
    expect(validateOptionalUrl('')).toBeUndefined();
    expect(validateOptionalUrl('https://x.y/a.png')).toBeUndefined();
    expect(validateOptionalUrl('ftp://x.y')).toBe('URL must start with http:// or https://');
    expect(validateOptionalUrl('not a url')).toBe('Enter a valid URL');
  });
});
