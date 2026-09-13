import { BOX_SPACING, NR_SECTION_COLS, NR_RUN_DEPTH, NR_LEFT_UNIT_STANDOFF, STORE_CENTER_X } from './store-layout.ts';

/** Identical complete bays, including the clearance inside both end panels. */
export const NR_BAY_WIDTH = NR_SECTION_COLS * BOX_SPACING + .16;
export interface NrRun { cols: number; length: number; x: number; z: number; yaw: number; startCol: number; wallInset: number; }
export function fitNrRun(span: number, x: number, z: number, yaw: number): NrRun {
  const bays = Math.max(0, Math.floor((span + 1e-8) / NR_BAY_WIDTH));
  return { cols: bays * NR_SECTION_COLS, length: bays * NR_BAY_WIDTH, x, z, yaw, startCol: 0, wallInset: 0 };
}
export function nrColumnX(length: number, col: number): number {
  const bay = Math.floor(col / NR_SECTION_COLS), within = col % NR_SECTION_COLS;
  return -length / 2 + (bay + .5) * NR_BAY_WIDTH + (within - (NR_SECTION_COLS - 1) / 2) * BOX_SPACING;
}
export interface NrRoom {
  width: number; backZ: number; backLeftX: number; backRightX: number;
  stepX: number; stepDepth: number; sideBackZ: number; clubhouse: boolean; wall: boolean;
}
/** Ribbon order follows the perimeter; the two side runs stop before glazing. */
export function planNrRuns(room: NrRoom): NrRun[] {
  const left = STORE_CENTER_X - room.width / 2, right = STORE_CENTER_X + room.width / 2;
  const step = room.stepDepth > 0, rightBack = room.backZ + room.stepDepth;
  const leftBack = room.backZ + (room.clubhouse ? 18 : NR_RUN_DEPTH + .08);
  const leftRun = fitNrRun(room.wall ? room.sideBackZ - leftBack : 0, left + NR_LEFT_UNIT_STANDOFF, 0, Math.PI / 2);
  leftRun.wallInset = NR_LEFT_UNIT_STANDOFF;
  leftRun.z = leftBack + leftRun.length / 2;
  const backEnd = step ? room.stepX - NR_RUN_DEPTH - .25 : room.backRightX - (room.wall ? NR_RUN_DEPTH + .08 : 0);
  const back = fitNrRun(backEnd - room.backLeftX, (room.backLeftX + backEnd) / 2, room.backZ, 0);
  const connector = fitNrRun(step ? room.stepDepth - NR_RUN_DEPTH - .08 : 0, room.stepX, 0, -Math.PI / 2);
  connector.z = room.backZ + NR_RUN_DEPTH + .08 + connector.length / 2;
  const end = room.backRightX - (room.wall ? NR_RUN_DEPTH + .08 : 0);
  const stepped = fitNrRun(step ? end - room.stepX : 0, (room.stepX + end) / 2, rightBack, 0);
  const rightRun = fitNrRun(room.wall ? room.sideBackZ - 3 - rightBack - NR_RUN_DEPTH - .08 : 0,
    right - NR_LEFT_UNIT_STANDOFF, 0, -Math.PI / 2);
  rightRun.wallInset = NR_LEFT_UNIT_STANDOFF;
  rightRun.z = rightBack + NR_RUN_DEPTH + .08 + rightRun.length / 2;
  const runs = [leftRun, back, connector, stepped, rightRun];
  let start = 0;
  for (const run of runs) { run.startCol = start; start += run.cols; }
  return runs;
}
export function nrSlotTransform(runs: NrRun[], col: number, offset: number) {
  const run = runs.find(r => col >= r.startCol && col < r.startCol + r.cols) ?? runs.find(r => r.cols > 0);
  if (!run) return { x: STORE_CENTER_X, z: 0, rotationY: 0 };
  const x = nrColumnX(run.length, Math.max(0, Math.min(run.cols - 1, col - run.startCol)));
  return { x: run.x + x * Math.cos(run.yaw) + offset * Math.sin(run.yaw),
    z: run.z - x * Math.sin(run.yaw) + offset * Math.cos(run.yaw), rotationY: run.yaw };
}
