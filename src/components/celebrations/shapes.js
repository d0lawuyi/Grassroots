import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { COLORS } from '../../theme/colors';

/*
 * Shared pieces for the celebration scenes.
 *
 * Every scene is 320 x 220. Still things (the field, the goal) are drawn once in a
 * background <Svg>. Each moving thing is a <Sprite>: a small drawing inside an
 * Animated.View that a worklet moves, turns, scales and fades from `progress` (0 to 1).
 * Moving views rather than SVG attributes is the most dependable way to animate on both
 * iPhone and Android.
 */
export const W = 320;
export const H = 220;

export const P = {
  forest: COLORS.forest, // #17442F
  clay: COLORS.clay, // #B9441B
  sage: COLORS.sage, // #D5E2D0
  cream: COLORS.ink, // #F4F0E6 (the theme calls the page color "ink")
  ink: COLORS.snow, // #172019 (and the text color "snow")
  white: COLORS.white,
  grass: '#2F6B47',
};

/* Straight-line mix from a to b. */
export function lerp(a, b, t) {
  'worklet';
  return a + (b - a) * t;
}

/* How far through [start, end] p is, clamped to 0..1. Scenes use this to time each part. */
export function segment(p, start, end) {
  'worklet';
  if (p <= start) return 0;
  if (p >= end) return 1;
  return (p - start) / (end - start);
}

/* A thrown arc from `from` to `to` that rises `height` above the straight line. */
export function arc(t, from, to, height) {
  'worklet';
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t) - height * 4 * t * (1 - t),
  };
}

/* Ease out: fast start, gentle stop. */
export function easeOut(t) {
  'worklet';
  return 1 - (1 - t) * (1 - t);
}

/*
 * A moving piece. `at(p)` is a worklet returning { x, y, rotate?, scale?, scaleX?, scaleY?,
 * opacity? }, where (x, y) is where the piece's center goes on the 320 x 220 stage.
 */
export function Sprite({ progress, at, w, h, children }) {
  const style = useAnimatedStyle(() => {
    const s = at(progress.value);
    return {
      opacity: s.opacity ?? 1,
      transform: [
        { translateX: s.x - w / 2 },
        { translateY: s.y - h / 2 },
        { rotate: `${s.rotate ?? 0}deg` },
        { scaleX: s.scaleX ?? s.scale ?? 1 },
        { scaleY: s.scaleY ?? s.scale ?? 1 },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, style]}>
      {children}
    </Animated.View>
  );
}

/* The stage every scene draws on. */
export function Stage({ children }) {
  return <View style={{ width: W, height: H, overflow: 'hidden', borderRadius: 24 }}>{children}</View>;
}

/*
 * A simple player: round head, body, arms, legs. No face, no team colors.
 * 28 x 44. pose: 'stand' | 'run' | 'armsUp' | 'leap'.
 */
export const FIGURE_W = 28;
export const FIGURE_H = 44;

export function Figure({ color = P.ink, pose = 'stand', shirt = P.clay }) {
  const arms = {
    stand: 'M6 20 L14 16 L22 20',
    run: 'M5 14 L14 16 L23 22',
    armsUp: 'M5 4 L14 16 L23 4',
    leap: 'M8 2 L14 16 L24 10',
  }[pose];
  const legs = {
    stand: 'M14 30 L9 42 M14 30 L19 42',
    run: 'M14 30 L5 38 M14 30 L22 42',
    armsUp: 'M14 30 L9 42 M14 30 L19 42',
    leap: 'M14 30 L6 36 M14 30 L20 38',
  }[pose];
  return (
    <Svg width={FIGURE_W} height={FIGURE_H}>
      <Path d={legs} stroke={color} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M14 14 L14 30" stroke={shirt} strokeWidth={7} strokeLinecap="round" />
      <Path d={arms} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={14} cy={8} r={6.5} fill={color} />
    </Svg>
  );
}

/* A ref: a figure in a striped shirt. */
export function Ref({ pose = 'stand' }) {
  return <Figure pose={pose} shirt={P.white} color={P.ink} />;
}

export function SoccerBall({ size = 18 }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill={P.white} stroke={P.ink} strokeWidth={1.5} />
      <Path d={`M${r} ${r * 0.55} l${r * 0.38} ${r * 0.28} l-${r * 0.15} ${r * 0.45} h-${r * 0.46} l-${r * 0.15} -${r * 0.45} z`} fill={P.ink} />
    </Svg>
  );
}

export function Basketball({ size = 20 }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill={P.clay} stroke={P.ink} strokeWidth={1.2} />
      <Line x1={1} y1={r} x2={size - 1} y2={r} stroke={P.ink} strokeWidth={1} />
      <Line x1={r} y1={1} x2={r} y2={size - 1} stroke={P.ink} strokeWidth={1} />
    </Svg>
  );
}

export function Football({ w = 24, h = 14 }) {
  return (
    <Svg width={w} height={h}>
      <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} fill="#7A3E1D" stroke={P.ink} strokeWidth={1} />
      <Line x1={w * 0.35} y1={h / 2} x2={w * 0.65} y2={h / 2} stroke={P.white} strokeWidth={1.4} />
    </Svg>
  );
}

export function Disc({ size = 26 }) {
  return (
    <Svg width={size} height={size * 0.45}>
      <Ellipse cx={size / 2} cy={size * 0.225} rx={size / 2 - 1} ry={size * 0.2} fill={P.clay} stroke={P.ink} strokeWidth={1} />
      <Ellipse cx={size / 2} cy={size * 0.2} rx={size * 0.3} ry={size * 0.09} fill="none" stroke={P.white} strokeWidth={1} />
    </Svg>
  );
}

export function Puff({ size = 16, color = '#B8A68A' }) {
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
    </Svg>
  );
}

/* Grass with mowing stripes, along the bottom of the stage. */
export function Grass({ top = 150 }) {
  return (
    <>
      <Rect x={0} y={top} width={W} height={H - top} fill={P.grass} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Rect key={i} x={i * 40} y={top} width={20} height={H - top} fill={P.forest} opacity={0.35} />
      ))}
    </>
  );
}
