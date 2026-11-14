// Декорации библиотеки «Ленты». Мир «Сторожа» из серии 6 теста series-feed (src/episodes/storozh-06/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { H, W, rng } from '../../looks/scene';
import { C, Defs } from './room';

// Новый мир серии 6 — взгляд под ноги. Снег в свете фонаря, две тени от тех, кто стоит напротив, и ни одной — от
// собственных ботинок. Облик «витраж»: плиты снега в свинце, тени — тёмные куски того же стекла.

const TILES = (() => {
  const r = rng(71);
  const cols = 4;
  const rows = 7;
  const g: [number, number][][] = [];
  for (let y = 0; y <= rows; y++) {
    g.push([]);
    for (let x = 0; x <= cols; x++) g[y]!.push([x === 0 ? -20 : x === cols ? W + 20 : (x * W) / cols + (r() - 0.5) * 90, y === 0 ? -20 : y === rows ? H + 20 : (y * H) / rows + (r() - 0.5) * 80]);
  }
  const out: { d: string; l: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [a, b, c, d] = [g[y]![x]!, g[y]![x + 1]!, g[y + 1]![x + 1]!, g[y + 1]![x]!];
      out.push({ d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]} L ${d[0]} ${d[1]} Z`, l: 66 + r() * 12 });
    }
  }
  return out;
})();

/** `light` — 0…1, фонарь спасателя наведён; `own` — 0…1, тень под собственными ногами (её нет: по умолчанию 0). */
export const Feet: React.FC<{ light: number; own?: number; p?: string }> = ({ light, own = 0, p = 'ft' }) => {
  const lead = { stroke: C.lead, strokeWidth: 7, strokeLinejoin: 'round' as const };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <radialGradient id={`${p}-beam`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1d0" stopOpacity={0.85} />
          <stop offset="0.6" stopColor={C.amber} stopOpacity={0.35} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      {TILES.map((q, i) => (
        <path key={i} d={q.d} fill={`hsl(206 24% ${q.l - 26 + 26 * light}%)`} {...lead} strokeWidth={6} />
      ))}
      {/* тени тех, кто напротив: длинные, от верха кадра */}
      <g opacity={0.25 + 0.6 * light}>
        <path d="M 150 -20 L 330 -20 L 420 760 Q 330 840 250 770 Z" fill="hsl(216 40% 20%)" {...lead} />
        <path d="M 700 -20 L 880 -20 L 800 700 Q 720 780 640 710 Z" fill="hsl(216 40% 20%)" {...lead} />
      </g>
      {/* своя тень — её нет */}
      <path d="M 400 1300 L 680 1300 L 760 1900 L 320 1900 Z" fill="hsl(216 40% 20%)" opacity={own} />
      <ellipse cx={540} cy={1180} rx={620} ry={560} fill={`url(#${p}-beam)`} opacity={light} style={{ mixBlendMode: 'screen' }} />
      {/* ботинки и край куртки */}
      <g {...lead}>
        <path d="M 330 1920 L 330 1560 Q 330 1330 420 1320 Q 510 1330 510 1560 L 510 1920 Z" fill="hsl(24 26% 13%)" />
        <path d="M 570 1920 L 570 1560 Q 570 1330 660 1320 Q 750 1330 750 1560 L 750 1920 Z" fill="hsl(24 26% 13%)" />
        <path d="M 350 1480 H 490 M 590 1480 H 730" fill="none" strokeWidth={5} />
      </g>
      <rect width={W} height={H} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} opacity={0.6} />
    </svg>
  );
};
