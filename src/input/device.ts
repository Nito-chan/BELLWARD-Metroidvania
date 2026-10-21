/**
 * Whether the current browser should offer the on-screen controls. A coarse primary
 * pointer is the strongest signal; `maxTouchPoints` covers touch laptops whose primary
 * pointer is still a mouse. Reads are guarded because privacy modes can throw.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    const coarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches === true;
    return coarse || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}
