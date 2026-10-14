import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/*
 * Sounds and the vibration for celebrations. Nothing here ever throws: if a sound can't
 * load or play, the animation carries on silently (the problem is only logged).
 *
 * The sound files are made by scripts/make_sounds.py. Metro needs each require() written
 * out in full, so they're listed one by one.
 */
const SOURCES = {
  whistle: require('../../assets/sounds/whistle.wav'),
  swish: require('../../assets/sounds/swish.wav'),
  cheer: require('../../assets/sounds/cheer.wav'),
  pistol: require('../../assets/sounds/pistol.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
};

const players = {}; // one player per sound, made the first time it's needed
let audioReady = null;
let stopped = false; // set when a celebration ends, so a sound that's still starting stays quiet

/* Respect the silent switch: on silent, the sounds don't play (the vibration still does). */
export function prepareCelebrationAudio() {
  if (!audioReady) {
    // mixWithOthers: a whistle shouldn't pause the music someone is listening to
    audioReady = setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch((e) => {
      console.warn('Could not set the audio mode', e);
    });
  }
  return audioReady;
}

function playSound(name) {
  try {
    if (!SOURCES[name]) return;
    if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
    const player = players[name];
    // Start from the beginning each time, even if it played a moment ago
    Promise.resolve(player.seekTo(0)).catch(() => {}).finally(() => {
      if (stopped) return;
      try {
        player.play();
      } catch (e) {
        console.warn(`Could not play ${name}`, e);
      }
    });
  } catch (e) {
    console.warn(`Could not load ${name}`, e);
  }
}

/* A celebration is starting: sounds may play again. */
export function startCelebrationSounds() {
  stopped = false;
}

/* A celebration ended or was skipped: silence anything still playing or about to start. */
export function stopCelebrationSounds() {
  stopped = true;
  for (const player of Object.values(players)) {
    try {
      player.pause();
    } catch (e) {
      // already released; nothing to stop
    }
  }
}

/* One cue from cueSchedule(): { sound: 'whistle' } or { haptic: true }. */
export function playCue(cue) {
  if (cue?.haptic) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  if (cue?.sound) playSound(cue.sound);
}
