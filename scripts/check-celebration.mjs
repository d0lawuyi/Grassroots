// Checks the celebration rules in src/utils/celebration.js. Run: node --test scripts/check-celebration.mjs
// (CI runs it too.) Node's built-in test runner, nothing to install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sceneFor, durationFor, STILL_MS, cuesFor, SOUNDS, captionFor, playbackFor,
  flagFromStorage, cueSchedule, finishOnce,
} from '../src/utils/celebration.js';

const SCENES = ['soccer', 'basketball', 'flag_football', 'track', 'ultimate', 'confetti'];

test('each sport gets its scene, however it is written', () => {
  assert.equal(sceneFor('soccer'), 'soccer');
  assert.equal(sceneFor('Soccer'), 'soccer');
  assert.equal(sceneFor(' basketball '), 'basketball');
  assert.equal(sceneFor('flag_football'), 'flag_football');
  assert.equal(sceneFor('flag football'), 'flag_football');
  assert.equal(sceneFor('track'), 'track');
  assert.equal(sceneFor('ultimate'), 'ultimate');
});

test('unknown or missing sports get confetti', () => {
  assert.equal(sceneFor('volleyball'), 'confetti');
  assert.equal(sceneFor(null), 'confetti');
  assert.equal(sceneFor(undefined), 'confetti');
  assert.equal(sceneFor(''), 'confetti');
});

test('lengths: 2.5 s after posting, 1.2 s after joining, 1 s still frame', () => {
  assert.equal(durationFor('created'), 2500);
  assert.equal(durationFor('joined'), 1200);
  assert.equal(STILL_MS, 1000);
});

test('every scene has cues inside its timeline and exactly one vibration', () => {
  for (const scene of SCENES) {
    const cues = cuesFor(scene);
    for (const cue of cues) {
      assert.ok(cue.at >= 0 && cue.at <= 1, `${scene}: cue at ${cue.at}`);
      if (cue.sound) assert.ok(SOUNDS.includes(cue.sound), `${scene}: unknown sound ${cue.sound}`);
    }
    assert.equal(cues.filter((c) => c.haptic).length, 1, `${scene}: vibrations`);
  }
  assert.equal(cuesFor('confetti').filter((c) => c.sound).length, 0);
});

test('cue timings match the spec', () => {
  const has = (scene, cue) =>
    assert.ok(cuesFor(scene).some((c) => JSON.stringify(c) === JSON.stringify(cue)), `${scene} ${JSON.stringify(cue)}`);
  has('soccer', { at: 0.58, sound: 'whistle' });
  has('soccer', { at: 0.55, haptic: true });
  has('basketball', { at: 0.6, sound: 'swish' });
  has('basketball', { at: 0.62, haptic: true });
  has('flag_football', { at: 0.08, sound: 'cheer' });
  has('flag_football', { at: 0.75, haptic: true });
  has('track', { at: 0.02, sound: 'pistol' });
  has('track', { at: 0.88, haptic: true });
  has('ultimate', { at: 0.05, sound: 'whoosh' });
  has('ultimate', { at: 0.68, haptic: true });
  has('confetti', { at: 0.15, haptic: true });
});

test('captions', () => {
  assert.equal(captionFor('created', false), 'Game on!');
  assert.equal(captionFor('created', true), 'Weekly game on!');
  assert.equal(captionFor('joined', false), "You're in!");
});

test('settings decide what plays', () => {
  const off = { show: false, animate: false, sound: false, haptic: false };
  assert.deepEqual(playbackFor({ animations: false, sounds: true, reduceMotion: false }), off);
  assert.deepEqual(playbackFor({ animations: true, sounds: false, reduceMotion: false }),
    { show: true, animate: true, sound: false, haptic: true });
  assert.deepEqual(playbackFor({ animations: true, sounds: true, reduceMotion: true }),
    { show: true, animate: false, sound: false, haptic: true });
  assert.deepEqual(playbackFor({ animations: true, sounds: true, reduceMotion: false }),
    { show: true, animate: true, sound: true, haptic: true });
});

test('saved switches: only "false" turns one off', () => {
  assert.equal(flagFromStorage(null), true);
  assert.equal(flagFromStorage(undefined), true);
  assert.equal(flagFromStorage('true'), true);
  assert.equal(flagFromStorage('false'), false);
  assert.equal(flagFromStorage('garbage'), true);
});

test('cue schedule turns fractions into delays and drops what is switched off', () => {
  assert.deepEqual(cueSchedule(cuesFor('soccer'), 2500, { sound: true, haptic: true }),
    [{ delay: 1375, haptic: true }, { delay: 1450, sound: 'whistle' }]);
  assert.deepEqual(cueSchedule(cuesFor('soccer'), 2500, { sound: false, haptic: true }),
    [{ delay: 1375, haptic: true }]);
  assert.deepEqual(cueSchedule(cuesFor('soccer'), 2500, { sound: false, haptic: false }), []);
});

test('finishing runs once, even if the timer and a tap both fire', () => {
  let calls = 0;
  const finish = finishOnce(() => { calls += 1; });
  finish();
  finish();
  finish();
  assert.equal(calls, 1);
});
