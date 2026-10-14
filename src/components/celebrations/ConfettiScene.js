import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { Stage, Sprite, P, W, H, segment } from './shapes';

/*
 * Fallback for any sport without its own scene: a burst of confetti at 0.15 that drifts down.
 * Angles and speeds are fixed (not random) so it looks the same every time.
 */
const COLORS = [P.forest, P.clay, P.white, '#E8B923'];
const PIECES = Array.from({ length: 18 }, (_, i) => ({
  angle: (i / 18) * Math.PI * 2 + (i % 3) * 0.2,
  speed: 70 + (i * 37) % 60,
  spin: (i % 2 ? 1 : -1) * (180 + (i * 53) % 360),
  color: COLORS[i % COLORS.length],
}));

function pieceAt(piece) {
  // Makes one worklet per piece; the returned function runs on the UI thread
  const { angle, speed, spin } = piece;
  return (p) => {
    'worklet';
    const t = segment(p, 0.15, 1);
    return {
      x: W / 2 + Math.cos(angle) * speed * t,
      y: H / 2 + Math.sin(angle) * speed * t + 60 * t * t, // a little gravity
      rotate: spin * t,
      opacity: p < 0.15 ? 0 : 1 - 0.4 * t,
    };
  };
}

const pieceWorklets = PIECES.map(pieceAt);

export default function ConfettiScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
      </Svg>
      {pieceWorklets.map((at, i) => (
        <Sprite key={i} progress={progress} at={at} w={8} h={12}>
          <Svg width={8} height={12}><Rect x={0} y={0} width={8} height={12} rx={2} fill={PIECES[i].color} /></Svg>
        </Sprite>
      ))}
    </Stage>
  );
}
