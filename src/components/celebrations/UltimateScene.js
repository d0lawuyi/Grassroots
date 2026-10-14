import React from 'react';
import Svg, { Line, Rect } from 'react-native-svg';
import { Stage, Sprite, Grass, Figure, Disc, P, W, H, FIGURE_W, FIGURE_H, segment, lerp } from './shapes';

/*
 * Ultimate: a spinning disc floats in on a gentle curve (whoosh at 0.05), the player
 * leaps (0.5-0.75) and catches it in the end zone at 0.68.
 */
const ZONE = 220; // the end zone starts here
const CATCH = { x: 266, y: 80 }; // where the player's hands are at the catch (0.68)

function playerY(p) {
  'worklet';
  return 150 - 46 * Math.sin(Math.PI * segment(p, 0.5, 0.82));
}

function discAt(p) {
  'worklet';
  if (p < 0.68) {
    const t = segment(p, 0, 0.68);
    return {
      x: lerp(20, CATCH.x, t),
      y: lerp(54, CATCH.y, t) - 22 * Math.sin(Math.PI * t), // floats up, then settles
      rotate: 8 * Math.sin(t * 20),
      scaleX: 0.85 + 0.15 * Math.cos(t * 40), // the spin, seen from the side
    };
  }
  // caught: it stays in the player's hands
  return { x: CATCH.x + 4, y: playerY(p) - 26 };
}

function playerStandAt(p) {
  'worklet';
  return { x: CATCH.x, y: playerY(p), opacity: p < 0.5 ? 1 : 0 };
}

function playerLeapAt(p) {
  'worklet';
  return { x: CATCH.x, y: playerY(p), opacity: p < 0.5 ? 0 : 1 };
}

export default function UltimateScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
        <Grass top={172} />
        {/* the end zone */}
        <Rect x={ZONE} y={172} width={W - ZONE} height={H - 172} fill={P.forest} opacity={0.45} />
        <Line x1={ZONE} y1={172} x2={ZONE} y2={H} stroke={P.white} strokeWidth={3} />
      </Svg>
      <Sprite progress={progress} at={playerStandAt} w={FIGURE_W} h={FIGURE_H}><Figure pose="stand" shirt={P.forest} /></Sprite>
      <Sprite progress={progress} at={playerLeapAt} w={FIGURE_W} h={FIGURE_H}><Figure pose="leap" shirt={P.forest} /></Sprite>
      <Sprite progress={progress} at={discAt} w={26} h={12}><Disc size={26} /></Sprite>
    </Stage>
  );
}
