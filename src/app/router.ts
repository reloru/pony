import { useEffect, useState } from 'preact/hooks';
import type { Kind } from '../core/types';

export type Route =
  | { name: 'home' }
  | { name: 'kind'; kind: Kind }
  | { name: 'mine' }
  | { name: 'edit'; id: string }
  | { name: 'make'; id: string }
  | { name: 'beads' }
  | { name: 'grownups' }
  | { name: 'sheet' };

const KINDS: Kind[] = ['bracelet', 'flat', 'cuff', 'peyote', 'critter'];

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (parts[0]) {
    case 'k':
      return KINDS.includes(parts[1] as Kind) ? { name: 'kind', kind: parts[1] as Kind } : { name: 'home' };
    case 'mine':
      return { name: 'mine' };
    case 'e':
      return parts[1] ? { name: 'edit', id: parts[1] } : { name: 'home' };
    case 'm':
      return parts[1] ? { name: 'make', id: parts[1] } : { name: 'home' };
    case 'beads':
      return { name: 'beads' };
    case 'grownups':
      return { name: 'grownups' };
    case 'sheet':
      return { name: 'sheet' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'kind':
      return `#/k/${r.kind}`;
    case 'mine':
      return '#/mine';
    case 'edit':
      return `#/e/${encodeURIComponent(r.id)}`;
    case 'make':
      return `#/m/${encodeURIComponent(r.id)}`;
    case 'beads':
      return '#/beads';
    case 'grownups':
      return '#/grownups';
    case 'sheet':
      return '#/sheet';
  }
}

export function go(r: Route, replace = false) {
  const h = href(r);
  if (replace) history.replaceState(history.state, '', h);
  else history.pushState({ inApp: true }, '', h);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Go back inside the app if there is somewhere to go back to, otherwise to a sensible parent. */
export function back(fallback: Route) {
  if (history.state && (history.state as { inApp?: boolean }).inApp) history.back();
  else go(fallback, true);
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      setR(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return r;
}
