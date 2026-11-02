import { useEffect, useState } from 'preact/hooks';

/**
 * Read-aloud uses only voices installed on the device (`localService`), so speaking never
 * sends text over the network. If the device has none, the speaker button is hidden.
 */
function localVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices().filter((v) => v.localService);
  return (
    voices.find((v) => v.lang === 'en-US' && v.default) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

export function useVoice(): SpeechSynthesisVoice | null {
  const [v, setV] = useState(localVoice);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const on = () => setV(localVoice());
    speechSynthesis.addEventListener?.('voiceschanged', on);
    const t = setTimeout(on, 500);
    return () => {
      clearTimeout(t);
      speechSynthesis.removeEventListener?.('voiceschanged', on);
    };
  }, []);
  return v;
}

export function speak(text: string, voice: SpeechSynthesisVoice) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
