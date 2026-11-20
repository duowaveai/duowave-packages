// Декорации библиотеки «Ленты». Миры «Сторожа» из серии 4 теста series-feed (src/episodes/storozh-04/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { H, W, rng } from '../../looks/scene';
import { C, Defs } from './room';

// Новые миры серии 4: дверной проём сарая (плохая ветка — в нём встаёт второй сторож) и крыльцо дома снаружи
// (верная ветка — следы обрываются у порога). Облик «витраж»: куски в свинце, свет — фонарь и луна.

const lead = { stroke: C.lead, strokeWidth: 8, strokeLinejoin: 'round' as const };

/** Мир «проём»: взгляд из сарая на дверь. `near` — 0…1.4, насколько второй сторож подошёл; `eyes` — глаза. */
export const ShedDoor: React.FC<{ near: number; eyes: number; p?: string }> = ({ near, eyes, p = 'sd' }) => {
  const door = { x: 300, y: 380, w: 480, h: 1180 };
  const k = 0.8 + near;
  const fx = 540;
  const feet = door.y + door.h - 30;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <clipPath id={`${p}-door`}>
          <rect x={door.x} y={door.y} width={door.w} height={door.h} />
        </clipPath>
        <radialGradient id={`${p}-lantern`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.55} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 122 - 8} y={-10} width={122} height={H + 20} fill={`hsl(24 ${26 + (i % 3) * 5}% ${11 + ((i * 7) % 5)}%)`} {...lead} strokeWidth={6} />
      ))}
      <rect width={W} height={H} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />

      {/* за дверью: ночь и снег */}
      <g clipPath={`url(#${p}-door)`}>
        <rect x={door.x} y={door.y} width={door.w} height={door.h} fill="hsl(224 60% 20%)" />
        <path d={`M ${door.x} ${door.y + 300} L ${door.x + 240} ${door.y + 190} L ${door.x + door.w} ${door.y + 320} V ${door.y + 700} H ${door.x} Z`} fill="hsl(226 50% 26%)" {...lead} strokeWidth={6} />
        <path d={`M ${door.x} ${door.y + 700} H ${door.x + door.w} V ${door.y + door.h} H ${door.x} Z`} fill="hsl(204 26% 76%)" {...lead} strokeWidth={6} />
        <path d={`M ${door.x} ${door.y + 930} L ${door.x + door.w} ${door.y + 900} V ${door.y + door.h} H ${door.x} Z`} fill="hsl(206 24% 64%)" {...lead} strokeWidth={6} />
        {/* второй сторож: та же куртка, рубиновая голова */}
        <g transform={`translate(${fx} ${feet}) scale(${k}) translate(${-fx} ${-feet})`}>
          <path d={`M ${fx - 50} ${feet} L ${fx - 40} ${feet - 150} L ${fx + 40} ${feet - 150} L ${fx + 50} ${feet} Z`} fill="hsl(350 60% 20%)" {...lead} />
          <path d={`M ${fx - 100} ${feet - 140} Q ${fx - 110} ${feet - 330} ${fx - 54} ${feet - 348} L ${fx + 54} ${feet - 348} Q ${fx + 110} ${feet - 330} ${fx + 100} ${feet - 140} Z`} fill="hsl(28 82% 44%)" {...lead} />
          <path d={`M ${fx} ${feet - 348} V ${feet - 140}`} {...lead} strokeWidth={6} fill="none" />
          <rect x={fx + 8} y={feet - 300} width={84} height={30} fill="#efe6cf" {...lead} strokeWidth={4} />
          <circle cx={fx} cy={feet - 410} r={52} fill="hsl(352 78% 32%)" {...lead} />
          <g fill="hsl(40 80% 88%)" opacity={eyes}>
            <ellipse cx={fx - 20} cy={feet - 408} rx={10} ry={6} />
            <ellipse cx={fx + 20} cy={feet - 408} rx={10} ry={6} />
          </g>
        </g>
      </g>
      <rect x={door.x} y={door.y} width={door.w} height={door.h} fill="none" {...lead} strokeWidth={22} />
      <ellipse cx={540} cy={1700} rx={760} ry={640} fill={`url(#${p}-lantern)`} opacity={0.7} style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
};

const STEPS = (() => {
  const r = rng(61);
  return Array.from({ length: 9 }, (_, i) => ({ x: 540 + (i % 2 ? 34 : -34) + (r() - 0.5) * 16, y: 1880 - i * 52, s: 1 - i * 0.03 }));
})();

/** Мир «крыльцо»: дом снаружи. Следы поднимаются от зрителя и обрываются перед первой ступенью. */
export const Porch: React.FC<{ steps: number; p?: string }> = ({ steps, p = 'pr' }) => {
  const door = { x: 380, y: 520, w: 320, h: 700 };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <radialGradient id={`${p}-warm`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.6} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* бревенчатая стена */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-10} y={i * 108 - 10} width={W + 20} height={108} fill={`hsl(22 ${28 + (i % 3) * 5}% ${13 + ((i * 5) % 5)}%)`} {...lead} strokeWidth={6} />
      ))}
      <rect width={W} height={H} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />
      <path d="M -20 300 L 540 120 L 1100 300 L 1100 380 L 540 210 L -20 380 Z" fill="#dfe8ee" {...lead} />

      {/* дверь: изнутри свет печи — щель под дверью и окошко */}
      <rect x={door.x} y={door.y} width={door.w} height={door.h} fill="hsl(24 34% 20%)" {...lead} strokeWidth={14} />
      <path d={`M ${door.x + door.w / 2} ${door.y} V ${door.y + door.h}`} {...lead} strokeWidth={6} />
      <rect x={door.x + 96} y={door.y + 90} width={128} height={128} fill="hsl(34 92% 58%)" {...lead} />
      <rect x={door.x + 8} y={door.y + door.h - 16} width={door.w - 16} height={12} fill="hsl(34 92% 62%)" />
      <circle cx={door.x + door.w / 2} cy={door.y + 300} r={420} fill={`url(#${p}-warm)`} opacity={0.75} style={{ mixBlendMode: 'screen' }} />

      {/* ступени в снегу и двор */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={300 - i * 50} y={1220 + i * 70} width={480 + i * 100} height={70} fill={`hsl(204 ${24 + i * 3}% ${84 - i * 6}%)`} {...lead} />
      ))}
      <path d={`M -20 1430 H ${W + 20} V ${H + 20} H -20 Z`} fill="hsl(206 26% 70%)" {...lead} />
      <path d={`M -20 1640 L 400 1600 L 760 1650 L ${W + 20} 1610 V ${H + 20} H -20 Z`} fill="hsl(208 26% 60%)" {...lead} strokeWidth={6} />

      {/* следы: идут от зрителя и встают парой перед первой ступенью */}
      <g opacity={steps} fill="hsl(214 34% 30%)" stroke={C.lead} strokeWidth={4}>
        {STEPS.map((f, i) => (
          <ellipse key={i} cx={f.x} cy={f.y} rx={26 * f.s} ry={15 * f.s} />
        ))}
        <ellipse cx={506} cy={1452} rx={20} ry={12} />
        <ellipse cx={574} cy={1452} rx={20} ry={12} />
      </g>
    </svg>
  );
};
