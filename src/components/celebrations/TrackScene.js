import React from 'react';
import Svg, { Line, Rect } from 'react-native-svg';
import { Stage, Sprite, Figure, Puff, P, W, H, FIGURE_W, FIGURE_H, segment, lerp } from './shapes';

/*
 * Track: the starting pistol at 0.02, a runner sprints across the lane (0.05-0.9) kicking
 * up dust every 0.08, and the finish tape snaps at 0.85-0.88.
 */
const GROUND = 168;
const TAPE_X = 262;
const RUN_START = 0.05;
const RUN_END = 0.9;
const PUFFS = Array.from({ length: 10 }, (_, i) => RUN_START + 0.04 + i * 0.08);

function runnerX(p) {
  'worklet';
  return lerp(-20, 340, segment(p, RUN_START, RUN_END));
}

function runnerAt(p) {
  'worklet';
  // a small bounce with every stride
  return { x: runnerX(p), y: GROUND - 22 - 4 * Math.abs(Math.sin(p * 70)) };
}

function puffAt(spawn) {
  // Makes one worklet per piece; the returned function runs on the UI thread
  return (p) => {
    'worklet';
    const t = segment(p, spawn, spawn + 0.15);
    return {
      x: runnerX(spawn) - 10 - 14 * t,
      y: GROUND - 4 - 10 * t,
      opacity: p < spawn ? 0 : 0.7 * (1 - t),
      scale: 0.4 + 1.1 * t,
    };
  };
}

function tapeLeftAt(p) {
  'worklet';
  const t = segment(p, 0.85, 0.95);
  return { x: TAPE_X - 1, y: 132 + 12 * t, rotate: -40 * t, opacity: 1 - 0.5 * t };
}

function tapeRightAt(p) {
  'worklet';
  const t = segment(p, 0.85, 0.95);
  return { x: TAPE_X + 1, y: 132 + 18 * t, rotate: 50 * t, opacity: 1 - 0.5 * t };
}

const puffWorklets = PUFFS.map(puffAt);

export default function TrackScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
        {/* the clay track with lane lines */}
        <Rect x={0} y={120} width={W} height={H - 120} fill={P.clay} />
        {[120, 168, 216].map((y) => (
          <Line key={y} x1={0} y1={y} x2={W} y2={y} stroke={P.white} strokeWidth={2} />
        ))}
        {/* finish posts */}
        <Line x1={TAPE_X} y1={110} x2={TAPE_X} y2={GROUND} stroke={P.ink} strokeWidth={3} opacity={0.2} />
      </Svg>
      {puffWorklets.map((at, i) => (
        <Sprite key={i} progress={progress} at={at} w={16} h={16}><Puff /></Sprite>
      ))}
      <Sprite progress={progress} at={tapeLeftAt} w={4} h={40}>
        <Svg width={4} height={40}><Rect x={0} y={0} width={4} height={40} fill={P.white} /></Svg>
      </Sprite>
      <Sprite progress={progress} at={tapeRightAt} w={4} h={40}>
        <Svg width={4} height={40}><Rect x={0} y={0} width={4} height={40} fill={P.white} /></Svg>
      </Sprite>
      <Sprite progress={progress} at={runnerAt} w={FIGURE_W} h={FIGURE_H}><Figure pose="run" shirt={P.forest} /></Sprite>
    </Stage>
  );
}
