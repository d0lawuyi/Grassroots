import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { SCENES } from './celebrations';
import {
  playCue, prepareCelebrationAudio, startCelebrationSounds, stopCelebrationSounds,
} from '../lib/celebrationSound';
import {
  sceneFor, durationFor, STILL_MS, cuesFor, captionFor, playbackFor, cueSchedule, finishOnce,
} from '../utils/celebration';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';

/*
 * The celebration after posting or joining a game (spec:
 * docs/superpowers/specs/2026-10-14-sport-celebrations-design.md).
 *
 *   <Celebration sport="soccer" mode="created" isWeekly={false} title="Thursday 7v7"
 *                subtitle="Thursday 7v7 · Thu 6 PM" settings={{ animations, sounds }}
 *                onDone={...} />
 *
 * Plays the sport's scene with its sounds and one vibration, then calls onDone once.
 * A tap anywhere ends it early. With Reduce Motion on, it shows the final frame instead.
 * The game is already saved before this appears; nothing here writes data.
 */
const HOLD_MS = 300; // keep the last frame up a moment so "+3" or "Good!" can be read

export default function Celebration({ sport, mode = 'created', isWeekly = false, title, subtitle, settings, onDone }) {
  const [reduceMotion, setReduceMotion] = useState(null); // null until the phone tells us
  const [visible, setVisible] = useState(true);
  const progress = useSharedValue(0);
  const timers = useRef([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // One finish for the timer, a tap and the back button: whichever comes first wins.
  const finishRef = useRef(null);
  if (!finishRef.current) {
    finishRef.current = finishOnce(() => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      cancelAnimation(progress);
      stopCelebrationSounds();
      // Hide this popup first and only then tell the screen we're done. Closing the
      // Create Game sheet while this popup is still showing on top of it misbehaves on
      // iPhone, so there onDone waits for the popup's onDismiss.
      setVisible(false);
      if (Platform.OS !== 'ios') setTimeout(() => onDoneRef.current?.(), 0);
    });
  }
  const finish = finishRef.current;

  const scene = sceneFor(sport);
  const Scene = SCENES[scene];
  const caption = captionFor(mode, isWeekly);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(!!on))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
      // Leaving the screen early: no sound or vibration may fire after this.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      cancelAnimation(progress);
      stopCelebrationSounds();
    };
  }, []);

  const play = reduceMotion === null ? null : playbackFor({ ...settings, reduceMotion });

  useEffect(() => {
    if (!play) return;
    if (!play.show) {
      onDoneRef.current?.(); // nothing was shown, so there is no popup to wait for
      return;
    }
    if (play.sound) {
      startCelebrationSounds();
      prepareCelebrationAudio();
    }

    const duration = durationFor(mode);
    let total;
    if (play.animate) {
      progress.value = withTiming(1, { duration, easing: Easing.linear });
      total = duration + HOLD_MS;
    } else {
      progress.value = 1; // Reduce Motion: the final frame, still
      total = STILL_MS;
    }

    const cues = cueSchedule(cuesFor(scene), play.animate ? duration : 0, { sound: play.sound, haptic: play.haptic });
    timers.current = [
      ...cues.map((cue) => setTimeout(() => playCue(cue), cue.delay)),
      setTimeout(finish, total),
    ];
    // Runs once: reduceMotion is read once and settings don't change during a celebration.
  }, [play?.show, play?.animate]);

  if (!play || !play.show) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={finish}
      onDismiss={() => onDoneRef.current?.()} // iPhone only: the popup has finished closing
    >
      <Pressable
        style={s.backdrop}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={`${caption} ${title || ''}. Tap to continue.`}
      >
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.tint} />
        <View style={s.card}>
          <Scene progress={progress} />
        </View>
        <Text style={s.caption}>{caption}</Text>
        {subtitle ? <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244,240,230,0.92)' },
  card: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  caption: {
    fontFamily: FONTS.display, fontSize: 34, lineHeight: 40, color: COLORS.snow,
    marginTop: 22, textAlign: 'center',
  },
  subtitle: { fontSize: 15, color: COLORS.mute, marginTop: 6, textAlign: 'center' },
});
