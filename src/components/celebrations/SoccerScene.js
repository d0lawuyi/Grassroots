import React from 'react';
import Svg, { Line, Rect } from 'react-native-svg';
import { Stage, Sprite, Grass, Ref, SoccerBall, P, W, H, FIGURE_W, FIGURE_H, segment, arc, lerp } from './shapes';

/*
 * Soccer: the ball arcs into the goal (0-0.55), the net bulges (0.55-0.7), and the ref
 * at the side raises the whistle (0.6 on). The whistle sound is at 0.58 (celebration.js).
 */
const GOAL = { left: 236, top: 92, right: 300, bottom: 160 };

function ballAt(p) {
  'worklet';
  const t = segment(p, 0, 0.55);
  if (p < 0.55) {
    const pos = arc(t, { x: 40, y: 168 }, { x: 274, y: 120 }, 70);
    return { x: pos.x, y: pos.y, rotate: t * 540 };
  }
  // In the net: pushed back a little with the bulge, then settles
  const s = segment(p, 0.55, 0.7);
  return { x: 274 + 10 * Math.sin(Math.PI * s), y: lerp(120, 146, segment(p, 0.6, 0.85)), rotate: 540 };
}

function netAt(p) {
  'worklet';
  const s = segment(p, 0.55, 0.7);
  return { x: GOAL.left + 34, y: (GOAL.top + GOAL.bottom) / 2, scaleX: 1 + 0.22 * Math.sin(Math.PI * s) };
}

function refDownAt(p) {
  'worklet';
  return { x: 140, y: 148, opacity: p < 0.6 ? 1 : 0 };
}

function refUpAt(p) {
  'worklet';
  return { x: 140, y: 148, opacity: p < 0.6 ? 0 : 1 };
}

function whistleAt(p) {
  'worklet';
  const s = segment(p, 0.58, 0.8);
  return { x: 160, y: 120, opacity: p < 0.58 ? 0 : 1 - 0.4 * s, scale: 0.6 + 0.6 * s };
}

export default function SoccerScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
        <Grass top={156} />
        {/* goal frame */}
        <Line x1={GOAL.left} y1={GOAL.top} x2={GOAL.right} y2={GOAL.top} stroke={P.white} strokeWidth={5} strokeLinecap="round" />
        <Line x1={GOAL.left} y1={GOAL.top} x2={GOAL.left} y2={GOAL.bottom} stroke={P.white} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      <Sprite progress={progress} at={netAt} w={68} h={68}>
        <Svg width={68} height={68}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Line key={`v${i}`} x1={i * 13} y1={0} x2={i * 13} y2={68} stroke={P.white} strokeWidth={1} opacity={0.8} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Line key={`h${i}`} x1={0} y1={i * 13} x2={68} y2={i * 13} stroke={P.white} strokeWidth={1} opacity={0.8} />
          ))}
        </Svg>
      </Sprite>
      <Sprite progress={progress} at={refDownAt} w={FIGURE_W} h={FIGURE_H}><Ref pose="stand" /></Sprite>
      <Sprite progress={progress} at={refUpAt} w={FIGURE_W} h={FIGURE_H}><Ref pose="armsUp" /></Sprite>
      <Sprite progress={progress} at={whistleAt} w={30} h={20}>
        <Svg width={30} height={20}>
          <Line x1={4} y1={10} x2={12} y2={4} stroke={P.ink} strokeWidth={2} strokeLinecap="round" />
          <Line x1={4} y1={10} x2={14} y2={10} stroke={P.ink} strokeWidth={2} strokeLinecap="round" />
          <Line x1={4} y1={10} x2={12} y2={16} stroke={P.ink} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Sprite>
      <Sprite progress={progress} at={ballAt} w={18} h={18}><SoccerBall size={18} /></Sprite>
    </Stage>
  );
}
