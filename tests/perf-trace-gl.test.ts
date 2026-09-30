import test from 'node:test';
import assert from 'node:assert/strict';
import {perfTrace} from '../src/perf-trace.ts';

test('deep tracing owns first-use diagnostic queries without suppressing or changing them', () => {
  const program = {}, shader = {};
  let programs = 0, shaders = 0;
  const gl = {
    getProgramInfoLog(value: object) {assert.equal(this, gl); assert.equal(value, program); programs++; return 'program diagnostics';},
    getShaderInfoLog(value: object) {assert.equal(this, gl); assert.equal(value, shader); shaders++; return 'shader diagnostics';},
  };
  perfTrace.instrumentGL(gl as unknown as WebGLRenderingContext);
  perfTrace.reset(); perfTrace.frameTick(1);
  assert.equal(gl.getProgramInfoLog(program), 'program diagnostics');
  assert.equal(gl.getShaderInfoLog(shader), 'shader diagnostics');
  assert.equal(gl.getShaderInfoLog(shader), 'shader diagnostics');
  perfTrace.frameTick(20);
  const report = perfTrace.report();
  assert.equal(programs, 1); assert.equal(shaders, 2);
  assert.equal(report.slotTotals.glProgLogN, 1);
  assert.equal(report.slotTotals.glShaderLogN, 2);
  assert.equal(report.deepGL, true);
});
