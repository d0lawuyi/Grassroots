import React from 'react';
import { Text } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { Stage, Sprite, Grass, Figure, Ref, Football, P, W, H, FIGURE_W, FIGURE_H, segment, arc, lerp, easeOut } from './shapes';
import { FONTS } from '../../theme/fonts';

/*
 * Flag football: a field goal. Kick at 0.08 (the thump at the start of cheer.wav), the ball
 * flips end over end through the uprights (0.1-0.6), a mini ref jogs on (0.55-0.75) and
 * raises both arms with "Good!" at 0.75.
 */
const POSTS = { x: 230, bar: 112, left: 206, right: 254, top: 36 };

function ballAt(p) {
  'worklet';
  if (p < 0.1) return { x: 74, y: 176 };
  const t = segment(p, 0.1, 0.62);
  const pos = arc(t, { x: 74, y: 176 }, { x: POSTS.x + 40, y: 52 }, 50);
  return { x: pos.x, y: pos.y, rotate: t * 720, scale: lerp(1, 0.7, t), opacity: 1 - segment(p, 0.6, 0.68) };
}

function kickerAt() {
  'worklet';
  return { x: 52, y: 170 };
}

function refRunAt(p) {
  'worklet';
  const t = easeOut(segment(p, 0.55, 0.75));
  return { x: lerp(350, 160, t), y: 170 - 3 * Math.abs(Math.sin(p * 60)), opacity: p < 0.75 ? 1 : 0 };
}

function refUpAt(p) {
  'worklet';
  return { x: 160, y: 170, opacity: p < 0.75 ? 0 : 1 };
}

function goodAt(p) {
  'worklet';
  const t = easeOut(segment(p, 0.75, 0.88));
  return { x: 160, y: 122, opacity: p < 0.75 ? 0 : 1, scale: 0.4 + 0.6 * t };
}

export default function FlagFootballScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
        <Grass top={160} />
        {/* the uprights: a post, the crossbar, two uprights */}
        <Line x1={POSTS.x} y1={POSTS.bar} x2={POSTS.x} y2={186} stroke="#E8B923" strokeWidth={5} />
        <Line x1={POSTS.left} y1={POSTS.bar} x2={POSTS.right} y2={POSTS.bar} stroke="#E8B923" strokeWidth={5} strokeLinecap="round" />
        <Line x1={POSTS.left} y1={POSTS.bar} x2={POSTS.left} y2={POSTS.top} stroke="#E8B923" strokeWidth={4} strokeLinecap="round" />
        <Line x1={POSTS.right} y1={POSTS.bar} x2={POSTS.right} y2={POSTS.top} stroke="#E8B923" strokeWidth={4} strokeLinecap="round" />
      </Svg>
      <Sprite progress={progress} at={kickerAt} w={FIGURE_W} h={FIGURE_H}><Figure pose="run" /></Sprite>
      <Sprite progress={progress} at={ballAt} w={24} h={14}><Football /></Sprite>
      <Sprite progress={progress} at={refRunAt} w={FIGURE_W} h={FIGURE_H}><Ref pose="run" /></Sprite>
      <Sprite progress={progress} at={refUpAt} w={FIGURE_W} h={FIGURE_H}><Ref pose="armsUp" /></Sprite>
      <Sprite progress={progress} at={goodAt} w={90} h={36}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: P.forest, textAlign: 'center' }}>Good!</Text>
      </Sprite>
    </Stage>
  );
}
