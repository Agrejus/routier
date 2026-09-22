export const MIN_DRAWER_HEIGHT = 120;
export const MAX_DRAWER_HEIGHT_RATIO = 0.9;
export const INITIAL_DRAWER_HEIGHT = 320;
export const KEYBOARD_RESIZE_STEP = 20;

export function clampDrawerHeight(height: number, viewportHeight: number): number {
  const maximum = Math.max(MIN_DRAWER_HEIGHT, viewportHeight * MAX_DRAWER_HEIGHT_RATIO);
  return Math.round(Math.min(maximum, Math.max(MIN_DRAWER_HEIGHT, height)));
}
