import { useEffect, useState } from 'preact/hooks';

/**
 * Service worker registration and offline status.
 * The app never fetches anything itself after load. The browser re-checks /sw.js when the
 * app is opened online; that is how updates arrive.
 */

export interface OfflineInfo {
  supported: boolean;
  ready: boolean;
  cached: number;
  total: number;
  version: string | null;
  updateWaiting: boolean;
}

let info: OfflineInfo = { supported: false, ready: false, cached: 0, total: 0, version: null, updateWaiting: false };
const subs = new Set<() => void>();
function set(p: Partial<OfflineInfo>) {
  info = { ...info, ...p };
  subs.forEach((f) => f());
}

export function useOffline(): OfflineInfo {
  const [, force] = useState(0);
  const seen = info;
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (info !== seen) f();
    return () => void subs.delete(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return info;
}

export function useOfflineStatus(): string {
  const o = useOffline();
  if (!o.supported) return '';
  if (o.ready) return '✓ Ready to use offline';
  if (o.total) return `Getting ready for offline… ${o.cached}/${o.total}`;
  return 'Getting ready for offline…';
}

function ask(sw: ServiceWorker | null | undefined) {
  sw?.postMessage({ type: 'status' });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  if (import.meta.env.DEV) return;
  set({ supported: true });

  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const m = e.data as { type?: string; cached?: number; total?: number; version?: string };
    if (m?.type === 'status') {
      set({ cached: m.cached ?? 0, total: m.total ?? 0, version: m.version ?? null, ready: !!m.total && m.cached === m.total });
    }
  });

  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A new version took over. Reload at a calm moment (on the home screen) so she never
    // loses an edit; until then the previous version's files stay cached.
    if (hadController) set({ updateWaiting: true });
    hadController = true;
    ask(navigator.serviceWorker.controller);
  });

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      const poll = () => ask(reg.active ?? navigator.serviceWorker.controller);
      poll();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'activated') ask(nw);
        });
      });
      // Precaching can take a moment on first visit; check a few times.
      let n = 0;
      const t = setInterval(() => {
        poll();
        if (info.ready || ++n > 30) clearInterval(t);
      }, 1000);
    })
    .catch(() => set({ supported: false }));
}

/** Called when the home screen shows: apply a waiting update there. */
export function applyUpdateIfWaiting() {
  if (info.updateWaiting) location.reload();
}
