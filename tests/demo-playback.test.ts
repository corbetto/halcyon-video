// Unit tests for the demo-playback overlay card (movie playback and game rental).
//
//   npm test (or: node --experimental-strip-types --test tests/demo-playback.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDemoOverlayHtml,
  openDemoPlaybackOverlay,
  closeDemoPlaybackOverlay,
  initDemoPlayback,
  type DemoPlaybackDeps,
} from '../src/demo-playback.ts';
import { PROJECT_PAGE_URL } from '../src/counter-terminal.ts';

test('renderDemoOverlayHtml for video renders the playback-disabled card', () => {
  const html = renderDemoOverlayHtml('video');
  assert.ok(html.includes('PLAYBACK DISABLED'), 'header indicates playback disabled');
  assert.ok(html.includes('THIS PUBLIC DEMO HAS NO MEDIA SERVER'), 'explains no media server');
  assert.ok(
    html.includes('Point Halcyon at your Jellyfin or Plex server to stream your own collection.'),
    'explains pointing to Jellyfin/Plex',
  );
  assert.ok(html.includes(PROJECT_PAGE_URL), 'links to GitHub repo');
  assert.ok(html.includes('BACK TO THE STORE'), 'has back button');
  assert.ok(html.includes('OR PRESS ESC'), 'has Esc hint');
});

test('renderDemoOverlayHtml for game renders the game-play-disabled card', () => {
  const html = renderDemoOverlayHtml('game');
  assert.ok(html.includes('GAME PLAY DISABLED'), 'header indicates game play disabled');
  assert.ok(html.includes('THIS PUBLIC DEMO HAS NO GAME SERVER'), 'explains no game server');
  assert.ok(
    html.includes('Point Halcyon at your Romm server to play your retro game collection.'),
    'explains pointing to Romm server',
  );
  assert.ok(html.includes(PROJECT_PAGE_URL), 'links to GitHub repo');
  assert.ok(html.includes('BACK TO THE STORE'), 'has back button');
  assert.ok(html.includes('OR PRESS ESC'), 'has Esc hint');
});

test('openDemoPlaybackOverlay and closeDemoPlaybackOverlay manage deps lifecycle for game rentals', () => {
  const logs: Array<{ message: string; type: string }> = [];
  let closedCount = 0;
  const ui = { isPlaybackActive: false };

  const fakeDeps: DemoPlaybackDeps = {
    ui,
    scene: () => null,
    log: (message, type) => {
      logs.push({ message, type });
    },
    onClosed: () => {
      closedCount++;
    },
  };

  initDemoPlayback(fakeDeps);

  openDemoPlaybackOverlay('Chrono Trigger', false, 'game');
  assert.equal(ui.isPlaybackActive, true);
  assert.ok(logs.some((l) => l.message.includes('Chrono Trigger') && l.message.includes('no game server')));

  closeDemoPlaybackOverlay();
  assert.equal(ui.isPlaybackActive, false);
  assert.equal(closedCount, 1);
  assert.ok(logs.some((l) => l.message.includes('Demo game rental screen dismissed')));
});

function playbackFixture() {
  const events: string[] = [];
  const scene = {
    pauseAmbientTvs() { events.push('pauseAmbient'); },
    pauseRendering() { events.push('pauseRendering'); },
    resumeRendering() { events.push('resumeRendering'); },
    resumeAmbientTvs() { events.push('resumeAmbient'); },
    returnToEntrance() { events.push('entrance'); },
    endBackRoomWatching() { events.push('couch'); },
  };
  const ui = { isPlaybackActive: false };
  initDemoPlayback({ ui, scene: () => scene, log() {}, onClosed() { events.push('closed'); } });
  return { events, ui, scene };
}

test('a game opened at home returns to the couch and closes only once', () => {
  const { events, ui } = playbackFixture();
  openDemoPlaybackOverlay('Rental Quest', false, 'game', true);
  assert.equal(ui.isPlaybackActive, true);
  closeDemoPlaybackOverlay();
  closeDemoPlaybackOverlay();
  assert.equal(ui.isPlaybackActive, false);
  assert.deepEqual(events, ['pauseAmbient', 'pauseRendering', 'resumeRendering', 'couch', 'closed']);
  assert.ok(renderDemoOverlayHtml('game', true).includes('BACK TO THE COUCH'));
});

test('a normal demo launch still returns to the entrance', () => {
  const { events } = playbackFixture();
  openDemoPlaybackOverlay('Rental Quest', false, 'game');
  closeDemoPlaybackOverlay();
  assert.deepEqual(events, ['pauseAmbient', 'pauseRendering', 'resumeRendering', 'resumeAmbient', 'entrance', 'closed']);
});

test('closing a stale game overlay never navigates a replacement scene', () => {
  const { scene } = playbackFixture();
  let current = scene;
  const events: string[] = [];
  initDemoPlayback({ui:{isPlaybackActive:false}, scene:()=>current, log() {}, onClosed() {}});
  openDemoPlaybackOverlay('Rental Quest', false, 'game', true);
  current = {...scene, endBackRoomWatching() { events.push('couch'); }, returnToEntrance() {events.push('entrance');}};
  closeDemoPlaybackOverlay();
  assert.deepEqual(events, []);
});

test('reusing the overlay updates movie/game copy and the return destination', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const elements = new Map<string, any>();
  Object.defineProperty(globalThis, 'document', {configurable:true, value:{
    getElementById(id: string) { return elements.get(id) ?? null; },
    createElement() { return {id:'', dataset:{}, innerHTML:'', style:{}, addEventListener() {}}; },
    body:{appendChild(el: any) {elements.set(el.id, el);}},
  }});
  try {
    playbackFixture();
    openDemoPlaybackOverlay('Movie', false, 'video');
    assert.ok(elements.get('demo-playback-overlay').innerHTML.includes('NO MEDIA SERVER'));
    closeDemoPlaybackOverlay();
    openDemoPlaybackOverlay('Game', false, 'game', true);
    const game = elements.get('demo-playback-overlay').innerHTML;
    assert.ok(game.includes('NO GAME SERVER'));
    assert.ok(game.includes('BACK TO THE COUCH'));
    assert.ok(!game.includes('NO MEDIA SERVER'));
    closeDemoPlaybackOverlay();
    openDemoPlaybackOverlay('Movie again', false, 'video');
    const movie = elements.get('demo-playback-overlay').innerHTML;
    assert.ok(movie.includes('NO MEDIA SERVER'));
    assert.ok(movie.includes('BACK TO THE STORE'));
    assert.ok(!movie.includes('BACK TO THE COUCH'));
    closeDemoPlaybackOverlay();
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
