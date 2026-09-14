/** Bounded mirror scheduling, independent of rendering and display refresh. */
export type MirrorScheduleEntry = {
  dirty: boolean; visible: boolean; near: boolean; wasVisible: boolean;
  urgent: boolean; lastRefresh: number;
};

export function markMirrorVisibility(m: MirrorScheduleEntry, visible: boolean, near: boolean) {
  if (visible && !m.wasVisible && m.dirty) m.urgent = true;
  m.visible = visible; m.near = near; m.wasVisible = visible;
}

/** Arrival beats cadence; every fourth opportunity can prepare the guard band. */
export function pickMirror(
  entries: MirrorScheduleEntry[], cursor: number, frame: number, admitted: boolean,
): number {
  // Priority passes allocate nothing in the render loop.
  for (let priority = 0; priority < 4; priority++) {
    if (priority > 0 && !admitted) return -1;
    if (priority === 1 && frame % 4 !== 0) continue;
    for (let k = 0; k < entries.length; k++) {
      const i = (cursor + k) % entries.length, m = entries[i];
      if (!m.dirty) continue;
      if (priority === 0 && m.visible && m.urgent) return i;
      if (priority === 1 && !m.visible && m.near && frame - m.lastRefresh >= 8) return i;
      if (priority === 2 && m.visible) return i;
      if (priority === 3 && m.near && frame - m.lastRefresh >= 8) return i;
    }
  }
  return -1;
}
