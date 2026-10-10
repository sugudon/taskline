import { useLocation } from 'react-router';

/** Renders the current location so tests can assert on navigation / search params. */
export function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}
