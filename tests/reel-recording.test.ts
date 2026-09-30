import { Group } from 'three';
import { hideReelObject } from '../src/reel-visibility.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dampedStep, stickValue } from '../src/reel-motion.ts';
import { ReelCapture } from '../src/reel-capture.ts';
import { reelSetting, REEL_MODE_KEY } from '../src/reel-profile.ts';
import { isSyncedConfigKey } from '../src/store-config-keys.ts';

test('fly acceleration and stopping distance agree at 30, 60 and 144 fps', () => {
  function travel(hz: number) {
    let velocity = 0, distance = 0;
    for (let i = 0; i < hz * 3; i++) {
      const step = dampedStep(velocity, i < hz ? 7 : 0, 1 / hz);
      velocity = step.velocity; distance += step.distance;
    }
    return { velocity, distance };
  }
  const base = travel(60);
  for (const hz of [30, 144]) {
    assert.ok(Math.abs(travel(hz).distance - base.distance) < 1e-10);
    assert.ok(Math.abs(travel(hz).velocity - base.velocity) < 1e-10);
  }
  assert.ok(base.velocity < 0.001);
  assert.equal(stickValue(0.1), 0);
  assert.ok(stickValue(0.3) > 0 && stickValue(0.3) < 0.3);
  assert.equal(stickValue(-1), -1);
});

test('recording profile leaves normal preferences intact and stays device-local', () => {
  const previous = globalThis.localStorage;
  const values = new Map([['bb_quality', 'low'], ['bb_reflections', 'cubemap']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null } });
  try {
    values.set(REEL_MODE_KEY, '1');
    assert.equal(reelSetting('bb_quality'), 'high');
    assert.equal(reelSetting('bb_reflections'), 'smooth');
    assert.equal(reelSetting('bb_px_budget'), '8.2944');
    assert.equal(isSyncedConfigKey(REEL_MODE_KEY), false);
    values.set(REEL_MODE_KEY, '0');
    assert.equal(reelSetting('bb_quality'), 'low');
    assert.equal(reelSetting('bb_reflections'), 'cubemap');
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});

test('recorder drains final chunk once, closes tracks and allows another take', async () => {
  const previous = globalThis.MediaRecorder;
  let stoppedTracks = 0, count = 0;
  const results: any[] = [];
  class FakeRecorder {
    static isTypeSupported(type: string) { return type === 'video/webm;codecs=vp9'; }
    state = 'inactive'; mimeType = 'video/webm;codecs=vp9';
    ondataavailable: any; onstop: any; onerror: any;
    constructor(_stream: any, options: any) { assert.equal(options.videoBitsPerSecond, 40_000_000); count++; }
    start() { this.state = 'recording'; this.ondataavailable({ data: new Blob(['first']) }); }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => { this.ondataavailable({ data: new Blob(['last']) }); this.onstop(); });
    }
  }
  globalThis.MediaRecorder = FakeRecorder as any;
  const canvas = { width:1920,height:1080,captureStream(fps: number) { assert.equal(fps, 60); return { getTracks: () => [{ kind:'video',stop: () => stoppedTracks++ }] }; } } as any;
  try {
    const capture = new ReelCapture(result => results.push(result), message => assert.fail(message));
    capture.start(canvas); capture.start(canvas);
    assert.equal(count, 1); assert.equal(capture.recording, true);
    capture.stop(); capture.stop();
    assert.equal(capture.busy, true);
    await new Promise(resolve => queueMicrotask(resolve as any));
    assert.equal(await results[0].blob.text(), 'firstlast');
    assert.equal(results[0].extension, 'webm');
    assert.equal(results[0].capture.width,1920);assert.equal(results[0].capture.height,1080);assert.equal(results[0].capture.audioTracks,0);assert.equal(results[0].capture.requestedFps,60);
    assert.ok(Number.isFinite(Date.parse(results[0].capture.startedAt)));assert.ok(results[0].capture.wallDurationMs>=0);
    assert.equal(stoppedTracks, 1); assert.equal(capture.busy, false);
    capture.start(canvas); capture.stop('Window resized');
    await new Promise(resolve => queueMicrotask(resolve as any));
    assert.equal(results[1].reason, 'Window resized');
    assert.equal(stoppedTracks, 2);
  } finally { globalThis.MediaRecorder = previous; }
});

test('failed encoder startup releases tracks without a false recording state', () => {
  const previous = globalThis.MediaRecorder;
  let stopped = false;
  class FailingRecorder {
    static isTypeSupported() { return true; }
    constructor() { throw new Error('encoder unavailable'); }
  }
  globalThis.MediaRecorder = FailingRecorder as any;
  try {
    const capture = new ReelCapture(() => assert.fail('must not save'), () => {});
    assert.throws(() => capture.start({ captureStream: () => ({ getTracks: () => [{ stop: () => { stopped = true; } }] }) } as any), /encoder unavailable/);
    assert.equal(capture.busy, false); assert.equal(stopped, true);
  } finally { globalThis.MediaRecorder = previous; }
});

test('clean capture hides every cursor layer and restores the exact masks', () => {
  const parent = new Group(), child = new Group();
  parent.layers.set(1); child.layers.enable(4); parent.add(child);
  const original = [parent.layers.mask, child.layers.mask];
  hideReelObject(parent, true); hideReelObject(parent, true);
  assert.equal(parent.layers.mask, 0); assert.equal(child.layers.mask, 0);
  hideReelObject(parent, false);
  assert.deepEqual([parent.layers.mask, child.layers.mask], original);
});
