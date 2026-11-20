// Декорации библиотеки «Ленты». Мир «Сторожа» из серии 7 теста series-feed (src/episodes/storozh-07/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W, rng } from '../../looks/scene';
import { C, Defs } from './room';

// Новый мир финала — кабина вертолёта в облике «витраж»: лобовое стекло из кусков в свинце, за ним горы или город,
// внизу приборы, справа пилот в шлеме. `city` 0…1 — вместо гор под нами огни города, `turn` 0…1 — пилот обернулся.

export const hand = fonts.hand;

const GLASS = { x: 40, y: 230, w: 1000, h: 900 };

const SKY = (() => {
  const r = rng(91);
  const out: { d: string; fill: string }[] = [];
  const cw = 140;
  const ch = 170;
  const j = () => (r() - 0.5) * 14;
  for (let row = -1; row * (ch / 2) < GLASS.h + ch; row++) {
    for (let col = -1; col * cw < GLASS.w + cw; col++) {
      const cx = GLASS.x + col * cw + (row % 2 ? cw / 2 : 0);
      const cy = GLASS.y + row * (ch / 2);
      out.push({ d: `M ${cx + j()} ${cy - ch / 2 + j()} L ${cx + cw / 2 + j()} ${cy + j()} L ${cx + j()} ${cy + ch / 2 + j()} L ${cx - cw / 2 + j()} ${cy + j()} Z`, fill: `hsl(${212 + r() * 14} ${50 + r() * 20}% ${36 + r() * 14 + ((cy - GLASS.y) / GLASS.h) * 14}%)` });
    }
  }
  return out;
})();

const CITY = (() => {
  const r = rng(93);
  const out: { x: number; y: number; w: number; h: number; on: boolean }[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 16; col++) {
      out.push({ x: GLASS.x + col * 64 + r() * 10, y: 820 + row * 44 + r() * 8, w: 22 + r() * 18, h: 16 + r() * 10, on: r() > 0.35 });
    }
  }
  return out;
})();

export const Cockpit: React.FC<{ city: number; turn: number; t: number; p?: string }> = ({ city, turn, t, p = 'ck' }) => {
  const lead = { stroke: C.lead, strokeWidth: 8, strokeLinejoin: 'round' as const };
  const glass = `M ${GLASS.x} ${GLASS.y + GLASS.h} V ${GLASS.y + 160} Q ${GLASS.x + GLASS.w / 2} ${GLASS.y - 120} ${GLASS.x + GLASS.w} ${GLASS.y + 160} V ${GLASS.y + GLASS.h} Z`;
  const px = 790;
  const py = 1020;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <clipPath id={`${p}-glass`}>
          <path d={glass} />
        </clipPath>
        <radialGradient id={`${p}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.6} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#0d0c0f" />
      <g clipPath={`url(#${p}-glass)`}>
        {SKY.map((q, i) => (
          <path key={i} d={q.d} fill={q.fill} {...lead} strokeWidth={6} />
        ))}
        {/* горы: уходят, когда под нами город */}
        <g opacity={1 - city}>
          <path d="M 0 1130 L 230 760 L 470 1130 Z" fill="hsl(224 40% 22%)" {...lead} />
          <path d="M 330 1130 L 640 700 L 940 1130 Z" fill="hsl(222 42% 26%)" {...lead} />
          <path d="M 640 700 L 580 790 L 640 772 L 704 794 Z" fill="#e6eef5" {...lead} strokeWidth={5} />
          <path d="M 0 1010 H 1080 V 1140 H 0 Z" fill="hsl(206 26% 74%)" {...lead} />
        </g>
        {/* город: тёмная земля и окна */}
        <g opacity={city}>
          <rect x={0} y={780} width={W} height={400} fill="hsl(230 30% 10%)" {...lead} />
          {CITY.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.on ? `hsl(${32 + (i % 5) * 4} 92% ${54 + (i % 3) * 6}%)` : 'hsl(230 20% 18%)'} stroke={C.lead} strokeWidth={4} />
          ))}
        </g>
        <rect x={GLASS.x} y={GLASS.y - 140} width={GLASS.w} height={GLASS.h + 140} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} opacity={0.7} />
      </g>
      <path d={glass} fill="none" {...lead} strokeWidth={22} />
      <path d={`M ${GLASS.x + GLASS.w / 2} ${GLASS.y - 30} V ${GLASS.y + GLASS.h}`} {...lead} strokeWidth={16} />

      {/* пилот справа: кресло, плечи, шлем; обернувшись, смотрит визором на нас */}
      <path d={`M ${px - 150} ${H} L ${px - 150} ${py + 30} Q ${px} ${py - 60} ${px + 150} ${py + 30} L ${px + 150} ${H} Z`} fill="hsl(24 20% 14%)" {...lead} />
      <path d={`M ${px - 130} ${py + 260} Q ${px - 140} ${py + 110} ${px - 60} ${py + 96} L ${px + 60} ${py + 96} Q ${px + 140} ${py + 110} ${px + 130} ${py + 260} Z`} fill="hsl(150 18% 26%)" {...lead} />
      <circle cx={px} cy={py} r={92} fill="hsl(210 12% 34%)" {...lead} />
      <path d={`M ${px - 70 + 50 * (1 - turn)} ${py - 16} Q ${px - 10 + 50 * (1 - turn)} ${py - 44} ${px + 56 + 30 * (1 - turn)} ${py - 16} L ${px + 50 + 30 * (1 - turn)} ${py + 30} Q ${px - 10 + 50 * (1 - turn)} ${py + 46} ${px - 64 + 50 * (1 - turn)} ${py + 30} Z`} fill="hsl(200 50% 62%)" {...lead} strokeWidth={6} />

      {/* приборы */}
      <path d={`M 0 1240 L 600 1180 L 600 ${H} L 0 ${H} Z`} fill="hsl(220 10% 12%)" {...lead} />
      {[[120, 1330], [260, 1310], [400, 1300], [180, 1480], [340, 1460]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={52} fill="#141217" {...lead} strokeWidth={7} />
          <circle cx={x} cy={y} r={42} fill={C.amber} opacity={0.75 + 0.2 * Math.sin(t * 3 + i)} />
          <path d={`M ${x} ${y} l ${30 * Math.cos(t * 0.7 + i * 1.3)} ${30 * Math.sin(t * 0.7 + i * 1.3)}`} stroke={C.lead} strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx={260} cy={1400} rx={420} ry={360} fill={`url(#${p}-glow)`} opacity={0.6} style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
};
