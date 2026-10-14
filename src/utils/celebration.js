/*
 * Rules for the celebration that plays after posting or joining a game:
 * which scene, how long, when each sound and vibration happens, the caption, and what
 * plays given the Profile switches and the phone's Reduce Motion setting.
 * Plain functions, no React, so scripts/check-celebration.mjs can test them with Node.
 */

export const SOUNDS = ['whistle', 'swish', 'cheer', 'pistol', 'whoosh'];

const KNOWN = ['soccer', 'basketball', 'flag_football', 'track', 'ultimate'];

/* 'Soccer', ' flag football ' -> the scene name; anything else -> confetti. */
export function sceneFor(sport) {
  const key = String(sport ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return KNOWN.includes(key) ? key : 'confetti';
}

const DURATIONS = { created: 2500, joined: 1200 };
export const durationFor = (mode) => DURATIONS[mode] ?? DURATIONS.created;

/* With Reduce Motion on, the final frame shows for this long instead. */
export const STILL_MS = 1000;

/*
 * When things happen, as fractions of the animation (0 = start, 1 = end). The scenes use
 * the same fractions, so the whistle blows as the net bulges. One vibration per scene, on
 * its big moment. Flag football's kick "thump" is the start of cheer.wav.
 */
const CUES = {
  soccer: [{ at: 0.55, haptic: true }, { at: 0.58, sound: 'whistle' }],
  basketball: [{ at: 0.6, sound: 'swish' }, { at: 0.62, haptic: true }],
  flag_football: [{ at: 0.08, sound: 'cheer' }, { at: 0.75, haptic: true }],
  track: [{ at: 0.02, sound: 'pistol' }, { at: 0.88, haptic: true }],
  ultimate: [{ at: 0.05, sound: 'whoosh' }, { at: 0.68, haptic: true }],
  confetti: [{ at: 0.15, haptic: true }],
};
export const cuesFor = (scene) => CUES[scene] ?? CUES.confetti;

export function captionFor(mode, isWeekly) {
  if (mode === 'joined') return "You're in!";
  return isWeekly ? 'Weekly game on!' : 'Game on!';
}

/*
 * animations off -> nothing at all. Reduce Motion -> a still frame, no sound, still the
 * vibration (it helps without moving anything). Sounds off -> animation and vibration only.
 */
export function playbackFor({ animations, sounds, reduceMotion }) {
  if (!animations) return { show: false, animate: false, sound: false, haptic: false };
  return { show: true, animate: !reduceMotion, sound: !!sounds && !reduceMotion, haptic: true };
}

/* Saved switches default to on: only the exact text "false" turns one off. */
export const flagFromStorage = (raw) => raw !== 'false';

/* Cues as millisecond delays, keeping only the kinds that are allowed to play. */
export function cueSchedule(cues, durationMs, { sound, haptic }) {
  return cues
    .filter((c) => (c.sound && sound) || (c.haptic && haptic))
    .map((c) => ({ delay: Math.round(c.at * durationMs), ...(c.sound ? { sound: c.sound } : { haptic: true }) }))
    .sort((a, b) => a.delay - b.delay);
}

/* Wraps `fn` so only the first call runs: the end timer and a tap can't both close a screen. */
export function finishOnce(fn) {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}
