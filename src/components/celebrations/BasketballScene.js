import React from 'react';
import { Text } from 'react-native';
import Svg, { Ellipse, Line, Path, Rect } from 'react-native-svg';
import { Stage, Sprite, Figure, Basketball, P, W, H, FIGURE_W, FIGURE_H, segment, arc, lerp, easeOut } from './shapes';
import { FONTS } from '../../theme/fonts';

/*
 * Basketball: a 3-pointer. The ball arcs from beyond the line (0-0.6), drops through the
 * hoop as the net ripples (0.6-0.75), then "+3" floats up (0.7-1). Swish sound at 0.6.
 */
const RIM = { x: 250, y: 84 };

function ballAt(p) {
  'worklet';
  if (p < 0.6) {
    const pos = arc(segment(p, 0, 0.6), { x: 58, y: 128 }, { x: RIM.x, y: RIM.y - 8 }, 110);
    return { x: pos.x, y: pos.y, rotate: p * 900 };
  }
  const t = segment(p, 0.6, 0.78);
  return { x: RIM.x, y: lerp(RIM.y - 8, RIM.y + 44, t), rotate: 540, opacity: 1 - segment(p, 0.75, 0.82) };
}

function netAt(p) {
  'worklet';
  const s = segment(p, 0.6, 0.75);
  return { x: RIM.x, y: RIM.y + 14, scaleY: 1 + 0.3 * Math.sin(Math.PI * s), scaleX: 1 - 0.12 * Math.sin(Math.PI * s) };
}

function plusAt(p) {
  'worklet';
  const t = easeOut(segment(p, 0.7, 1));
  return { x: RIM.x - 54, y: lerp(76, 44, t), opacity: p < 0.7 ? 0 : 1, scale: 0.6 + 0.4 * t };
}

function shooterAt() {
  'worklet';
  return { x: 50, y: 150 };
}

export default function BasketballScene({ progress }) {
  return (
    <Stage>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Rect x={0} y={0} width={W} height={H} fill={P.sage} />
        {/* the court floor and the 3-point line */}
        <Rect x={0} y={172} width={W} height={H - 172} fill="#C9935A" />
        <Path d="M 120 220 Q 150 172 250 172" stroke={P.white} strokeWidth={3} fill="none" />
        {/* backboard and pole */}
        <Rect x={RIM.x + 22} y={RIM.y - 44} width={6} height={56} fill={P.white} stroke={P.ink} strokeWidth={1.5} />
        <Line x1={RIM.x + 28} y1={RIM.y} x2={RIM.x + 44} y2={RIM.y} stroke={P.ink} strokeWidth={3} />
        <Line x1={RIM.x + 44} y1={RIM.y} x2={RIM.x + 44} y2={H} stroke={P.ink} strokeWidth={5} />
        {/* the rim */}
        <Ellipse cx={RIM.x} cy={RIM.y} rx={20} ry={5} fill="none" stroke={P.clay} strokeWidth={3} />
      </Svg>
      <Sprite progress={progress} at={shooterAt} w={FIGURE_W} h={FIGURE_H}><Figure pose="armsUp" /></Sprite>
      <Sprite progress={progress} at={ballAt} w={20} h={20}><Basketball size={20} /></Sprite>
      <Sprite progress={progress} at={netAt} w={36} h={26}>
        <Svg width={36} height={26}>
          <Path d="M2 0 L10 26 M12 0 L14 26 M24 0 L22 26 M34 0 L26 26 M4 9 L32 9 M7 18 L29 18" stroke={P.white} strokeWidth={1.5} />
        </Svg>
      </Sprite>
      <Sprite progress={progress} at={plusAt} w={60} h={40}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: P.clay, textAlign: 'center' }}>+3</Text>
      </Sprite>
    </Stage>
  );
}
