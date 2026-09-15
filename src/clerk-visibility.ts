/** The terminal dock suppresses the clerk without disturbing her sleep fade. */
export function clerkShouldRender(fade: number, suppressed: boolean): boolean {
  return fade > 0 && !suppressed;
}
