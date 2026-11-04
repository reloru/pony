import { useEffect, useState } from 'preact/hooks';

/**
 * Chrome (including Chrome on Fire tablets) fires `beforeinstallprompt` when the app can be
 * installed. We let Chrome show its own install prompt as usual, and also keep the event so an
 * Install button on the home screen and the Grown-ups screen can open the same prompt.
 * iPhones never fire it; they install from Safari's Share menu.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** True while Chrome says the app can be installed and it isn't already running installed. */
export function useCanInstall(): boolean {
  const [, force] = useState(0);
  const seen = deferred;
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (deferred !== seen) f();
    return () => void subs.delete(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return !!deferred && !isStandalone();
}

/** Open Chrome's install prompt. Returns false if Chrome wouldn't show it (then use the ⋮ menu). */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === 'accepted') {
      deferred = null;
      notify();
    }
    return true;
  } catch {
    deferred = null;
    notify();
    return false;
  }
}
