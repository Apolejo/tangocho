import { useMemo, useSyncExternalStore } from 'react';
import { parseRoute, type Route } from './routes.ts';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

const getHash = () => window.location.hash;
const getServerHash = () => '';

/** The current route, re-rendered on every hash change (so the back button works). */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return useMemo(() => parseRoute(hash), [hash]);
}
