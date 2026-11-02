/**
 * Chrome may fire `beforeinstallprompt`; if it does we offer an Install button, but nothing
 * depends on it (Fire tablets and iPhones install from the browser menu instead).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const installPrompt: { value: BeforeInstallPromptEvent | null } = { value: null };

export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt.value = null;
  });
}

export async function promptInstall() {
  const e = installPrompt.value;
  if (!e) return;
  installPrompt.value = null;
  await e.prompt();
}
