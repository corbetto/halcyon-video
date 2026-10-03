import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retailAudio } from '../src/audio.ts';

test('retailAudio: getMedium and setMedium work without errors', () => {
  retailAudio.setMedium('vhs');
  assert.equal(retailAudio.getMedium(), 'vhs');
  assert.equal(retailAudio.getMedium('dvd'), 'dvd');

  retailAudio.setMedium('dvd');
  assert.equal(retailAudio.getMedium(), 'dvd');
  assert.equal(retailAudio.getMedium('vhs'), 'vhs');
});

test('retailAudio: playBoxFlip and playBoxPickup fail silent when AudioContext is unavailable', () => {
  // In Node.js environment without WebAudio, these methods must never throw
  assert.doesNotThrow(() => {
    retailAudio.playBoxFlip();
    retailAudio.playBoxFlip('vhs');
    retailAudio.playBoxFlip('dvd');
    retailAudio.playBoxPickup();
    retailAudio.playBoxPickup('vhs');
    retailAudio.playBoxPickup('dvd');
  });
});

test('retailAudio: prewarm fails silent when AudioContext is unavailable', () => {
  assert.doesNotThrow(() => {
    retailAudio.prewarm();
  });
});
