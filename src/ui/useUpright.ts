import { useEffect, useState } from 'preact/hooks';

const QUERY = '(min-width: 700px)';

/**
 * Cuffs are long. On a phone held upright they only fit drawn sideways; on wider screens
 * (tablets, or a phone turned sideways) they're drawn the right way up, like the thumbnails.
 */
export function useUpright(): boolean {
  const [up, setUp] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const m = window.matchMedia(QUERY);
    const on = () => setUp(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return up;
}
