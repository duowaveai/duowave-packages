// Декорации библиотеки «Ленты». Миры «Компаса» из серии 6 теста series-feed (src/episodes/kompas-06/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W } from '../../looks/scene';
import { Defs, Finish, INK, Plate } from './ship';

// Новые миры серии 6 (ризограф): вид с кормы ночью — кильватер и лодка, которая идёт следом; в свете её фонаря на
// борту видно название «АЛЫЙ» (улика развилки, голосом не называется). И карта берега: порт Алый близко, маяк далеко.

/** `boat` 0…1 — лодка ближе; `lamp` 0…1 — фонарь горит (и подсвечивает название). */
export const Stern: React.FC<{ boat: number; lamp: number; t: number; p?: string }> = ({ boat, lamp, t, p = 'st' }) => {
  const horizon = 760;
  const swell = Math.sin(t * 0.9) * 6;
  const k = 0.7 + 0.9 * boat;
  const bx = 560;
  const by = 900 + 260 * boat;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect x={0} y={0} width={W} height={horizon} fill={INK.teal} />
        <rect x={0} y={horizon + swell} width={W} height={H} fill={`url(#${p}-t60)`} />
        <rect x={0} y={horizon + swell} width={W} height={H} fill={`url(#${p}-t30)`} />
        {/* корма шхуны и планширь */}
        <path d={`M -20 1600 Q 540 1500 1100 1600 V ${H + 20} H -20 Z`} fill={INK.teal} />
        {/* двое в лодке */}
        <g transform={`translate(${bx} ${by}) scale(${k})`}>
          <circle cx={-60} cy={-150} r={30} fill={INK.teal} />
          <path d="M -100 -40 L -96 -116 Q -60 -132 -24 -116 L -20 -40 Z" fill={INK.teal} />
          <circle cx={60} cy={-160} r={32} fill={INK.teal} />
          <path d="M 18 -40 L 22 -126 Q 60 -144 98 -126 L 102 -40 Z" fill={INK.teal} />
        </g>
      </Plate>
      <Plate dx={5} dy={-4}>
        <path d={`M -20 1600 Q 540 1500 1100 1600 V ${H + 20} H -20 Z`} fill={INK.orange} />
        <g transform={`translate(${bx} ${by}) scale(${k})`}>
          <path d="M -200 -40 H 200 L 160 40 H -160 Z" fill={INK.orange} />
        </g>
      </Plate>
      <Plate dx={-3} dy={3}>
        <g transform={`translate(${bx} ${by}) scale(${k})`} opacity={lamp}>
          <circle cx={150} cy={-110} r={180} fill={`url(#${p}-y60)`} />
          <circle cx={150} cy={-110} r={18} fill={INK.yellow} />
        </g>
      </Plate>
      {/* выворотки: кильватер, звёзды, бумажное название на борту лодки */}
      <g fill="none" stroke={INK.paper} strokeLinecap="round" opacity={0.8}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${540 - 60 - i * 70} ${1560 - i * 140} Q ${540} ${1500 - i * 150 + Math.sin(t * 2 + i) * 6} ${540 + 60 + i * 70} ${1560 - i * 140}`} strokeWidth={6 - i} />
        ))}
      </g>
      <g fill={INK.paper}>
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 211) % W} cy={(i * 97) % horizon} r={2 + (i % 3)} opacity={0.4 + 0.6 * ((i * 7) % 3) / 2} />
        ))}
      </g>
      <g transform={`translate(${bx} ${by}) scale(${k})`} opacity={lamp}>
        <circle cx={150} cy={-110} r={8} fill={INK.paper} />
        <text x={-20} y={22} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 40, letterSpacing: '0.12em' }} fill={INK.paper}>
          АЛЫЙ
        </text>
      </g>
      <Finish p={p} />
    </svg>
  );
};

/** Карта берега: порт Алый близко слева, маяк далеко справа. `left`/`right` 0…1 — пунктиры путей. */
export const CoastChart: React.FC<{ left: number; right: number; p?: string }> = ({ left, right, p = 'cc' }) => {
  const ship = { x: 540, y: 1500 };
  const port = { x: 260, y: 700 };
  const light = { x: 860, y: 430 };
  const coast = 'M -20 -20 H 1100 V 360 Q 940 470 860 420 Q 700 520 520 600 Q 380 760 240 660 Q 120 600 -20 720 Z';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect width={W} height={H} fill={`url(#${p}-t30)`} opacity={0.55} />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M ${i * 135} 0 V ${H} M 0 ${i * 240} H ${W}`} stroke={INK.teal} strokeWidth={3} />
        ))}
        <path d={coast} fill={INK.teal} />
        {/* маяк */}
        <path d={`M ${light.x - 24} ${light.y + 60} L ${light.x - 14} ${light.y - 60} L ${light.x + 14} ${light.y - 60} L ${light.x + 24} ${light.y + 60} Z`} fill={INK.teal} />
        <path d={`M ${ship.x} ${ship.y} C 760 1300 960 900 ${light.x} ${light.y + 90}`} fill="none" stroke={INK.teal} strokeWidth={11} strokeDasharray="26 18" opacity={right} />
      </Plate>
      <Plate dx={5} dy={-4}>
        <path d={coast} fill={`url(#${p}-o30)`} />
        {/* порт: причал */}
        <rect x={port.x - 60} y={port.y + 30} width={120} height={22} fill={INK.orange} />
        <path d={`M ${ship.x} ${ship.y} C 460 1200 320 980 ${port.x} ${port.y + 70}`} fill="none" stroke={INK.orange} strokeWidth={12} strokeDasharray="30 20" opacity={left} />
        <path d={`M ${ship.x} ${ship.y - 40} L ${ship.x + 30} ${ship.y + 40} L ${ship.x - 30} ${ship.y + 40} Z`} fill={INK.orange} />
      </Plate>
      <Plate dx={-3} dy={3}>
        <circle cx={light.x} cy={light.y - 70} r={70} fill={`url(#${p}-y60)`} />
        <circle cx={light.x} cy={light.y - 70} r={18} fill={INK.yellow} />
        <circle cx={ship.x} cy={ship.y + 10} r={70} fill={`url(#${p}-y60)`} />
      </Plate>
      <g style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '0.05em', mixBlendMode: 'multiply' }}>
        <text x={port.x} y={port.y + 110} textAnchor="middle" fontSize={40} fill={INK.orange}>
          ПОРТ АЛЫЙ
        </text>
        <text x={port.x} y={port.y + 150} textAnchor="middle" fontSize={28} fill={INK.teal}>
          1 день
        </text>
        <text x={light.x} y={light.y + 130} textAnchor="middle" fontSize={40} fill={INK.teal}>
          МАЯК
        </text>
        <text x={light.x} y={light.y + 170} textAnchor="middle" fontSize={28} fill={INK.teal}>
          2 дня
        </text>
        <text x={ship.x + 54} y={ship.y + 90} fontSize={30} fill={INK.teal}>
          МЫ
        </text>
      </g>
      <Finish p={p} />
    </svg>
  );
};
