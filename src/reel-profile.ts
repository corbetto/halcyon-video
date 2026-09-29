// Opt-in recording never changes the visitor's ordinary graphics preferences.
export const REEL_MODE_KEY = 'bb_reel_mode';
const PROFILE: Record<string, string> = {
  bb_quality: 'high', bb_reflections: 'smooth', bb_mirrors: '1',
  bb_ssao: '1', bb_fps_cap: '0', bb_px_budget: '8.2944',
  bb_motion_sharp: '0', bb_motion_ss: '0', bb_settle_ss: '0',
};
export function reelModeEnabled(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(REEL_MODE_KEY) === '1';
}
export function reelSetting(key: string): string | null {
  if (reelModeEnabled() && key in PROFILE) return PROFILE[key];
  return localStorage.getItem(key);
}
