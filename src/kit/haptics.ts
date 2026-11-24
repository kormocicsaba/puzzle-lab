/**
 * Haptics through the Vibration API. Android Chrome supports it; iOS Safari ignores it
 * silently, so the games never rely on it (every haptic has a sound and a visual too).
 */
function buzz(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* not allowed before a user gesture, or unsupported */
  }
}

export const haptic = {
  light: () => buzz(8),
  medium: () => buzz(16),
  heavy: () => buzz(30),
  success: () => buzz([12, 40, 12, 40, 24]),
  fail: () => buzz([40, 60, 40]),
};
