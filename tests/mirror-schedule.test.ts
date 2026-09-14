import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markMirrorVisibility, pickMirror, type MirrorScheduleEntry } from '../src/mirror-schedule.ts';
const panel = (overrides: Partial<MirrorScheduleEntry> = {}): MirrorScheduleEntry => ({
 dirty: true, visible: false, near: false, wasVisible: false, urgent: false, lastRefresh: -Infinity, ...overrides,
});
test('a panel entering the viewport bypasses cadence until rendered', () => {
 const m = panel(); markMirrorVisibility(m, true, true);
 assert.equal(pickMirror([m], 0, 1, false), 0);
 markMirrorVisibility(m, true, true);
 assert.equal(pickMirror([m], 0, 2, false), 0);
 m.dirty=false;m.urgent=false;
 assert.equal(pickMirror([m], 0, 3, true), -1);
});
test('guard-band preparation does not starve continuously dirty visible panels', () => {
 const entries=[panel({visible:true}),panel({near:true})];
 assert.equal(pickMirror(entries,0,4,true),1);
 entries[1].lastRefresh=4;
 assert.equal(pickMirror(entries,0,8,true),0);
 assert.equal(pickMirror(entries,0,12,true),1);
 assert.equal(pickMirror(entries,0,13,true),0);
});
test('round robin serves all visible panels and excludes facing-away panels', () => {
 const entries=[panel({visible:true}),panel(),panel({visible:true})];
 assert.equal(pickMirror(entries,0,1,true),0);
 assert.equal(pickMirror(entries,1,2,true),2);
 assert.equal(pickMirror(entries,0,3,false),-1);
});
test('arrival takes priority over offscreen preparation; returning panels are urgent again', () => {
 const entries=[panel({near:true}),panel()];
 markMirrorVisibility(entries[1],true,true);
 assert.equal(pickMirror(entries,0,4,true),1);
 entries[1].urgent=false;markMirrorVisibility(entries[1],false,false);
 markMirrorVisibility(entries[1],true,true);
 assert.ok(entries[1].urgent);
});
