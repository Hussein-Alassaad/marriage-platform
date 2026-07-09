import { useEffect, useState } from 'react';

/**
 * True when the primary pointer is "fine" (mouse / trackpad), via the
 * `(pointer: fine)` media query. Gating on this — rather than touch detection —
 * lets hybrid touch+trackpad laptops keep pointer-driven effects (magnetic CTAs)
 * while pure-touch devices opt out.
 */
export function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: fine)');
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return fine;
}
