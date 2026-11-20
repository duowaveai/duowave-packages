// Декорации библиотеки «Ленты». Миры «Компаса» из серии 7 теста series-feed (src/episodes/kompas-07/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W } from '../../looks/scene';
import { Defs, Finish, INK, Plate } from './ship';

// Новые миры финала «Компаса» (ризограф): причал порта Алый с лодкой соперников, маяк на мысе и раскрытый ящик —
// золото «Северянина» и судовой журнал с последней записью и картой второго парохода.

const hand = fonts.hand;

/** Причал порта Алый вечером: дома на берегу, лодка «АЛЫЙ» у причала, двое ждут. `near` 0…1 — шхуна подходит. */
export const Pier: React.FC<{ near: number; t: number; p?: string }> = ({ near, t, p = 'pr' }) => {
  const horizon = 900;
  const k = 1 + 0.5 * near;
  const swell = Math.sin(t * 0.9) * 6;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <g transform={`translate(540 ${horizon}) scale(${k}) translate(-540 ${-horizon})`}>
        <Plate>
          <rect x={-200} y={-200} width={W + 400} height={horizon + 200} fill={`url(#${p}-t30)`} />
          <rect x={-200} y={horizon + swell} width={W + 400} height={H} fill={`url(#${p}-t60)`} />
          {/* дома на берегу */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M ${-40 + i * 200} ${horizon - 160} V ${600 - (i % 3) * 60} L ${40 + i * 200} ${540 - (i % 3) * 60} L ${120 + i * 200} ${600 - (i % 3) * 60} V ${horizon - 160} Z`} fill={INK.teal} />
          ))}
          {/* двое на причале */}
          <circle cx={430} cy={790} r={26} fill={INK.teal} />
          <path d="M 398 900 L 402 820 Q 430 806 458 820 L 462 900 Z" fill={INK.teal} />
          <circle cx={520} cy={784} r={28} fill={INK.teal} />
          <path d="M 486 900 L 490 816 Q 520 800 550 816 L 554 900 Z" fill={INK.teal} />
        </Plate>
        <Plate dx={5} dy={-4}>
          <rect x={-200} y={0} width={W + 400} height={horizon} fill={`url(#${p}-o30)`} />
          {/* причал */}
          <rect x={200} y={900} width={560} height={40} fill={INK.orange} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={220 + i * 100} y={940} width={20} height={120} fill={INK.orange} />
          ))}
          {/* лодка у причала */}
          <path d="M 560 1010 H 900 L 870 1070 H 590 Z" fill={INK.orange} />
          {/* двое на причале: оранжевый поверх бирюзы — почти чёрные силуэты */}
          <circle cx={430} cy={790} r={26} fill={INK.orange} />
          <path d="M 398 900 L 402 820 Q 430 806 458 820 L 462 900 Z" fill={INK.orange} />
          <circle cx={520} cy={784} r={28} fill={INK.orange} />
          <path d="M 486 900 L 490 816 Q 520 800 550 816 L 554 900 Z" fill={INK.orange} />
        </Plate>
        <Plate dx={-3} dy={3}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={10 + i * 200} y={640 - (i % 3) * 60} width={40} height={40} fill={INK.yellow} />
          ))}
          <circle cx={780} cy={560} r={70} fill={INK.yellow} />
        </Plate>
        <text x={730} y={1056} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 34, letterSpacing: '0.12em' }} fill={INK.paper}>
          АЛЫЙ
        </text>
      </g>
      {/* наш нос снизу */}
      <Plate dx={5} dy={-4}>
        <path d="M 0 1920 L 0 1680 L 540 1420 L 1080 1680 L 1080 1920 Z" fill={INK.orange} />
      </Plate>
      <Plate>
        <path d="M 0 1920 L 0 1680 L 540 1420 L 1080 1680 L 1080 1920 Z" fill={INK.teal} opacity={0.35} />
      </Plate>
      <Finish p={p} />
    </svg>
  );
};

/** Маяк на мысе на рассвете: башня в полоску, смотритель, бочка с водой. `beam` 0…1 — свет маяка. */
export const Lighthouse: React.FC<{ beam: number; keeper: number; t: number; p?: string }> = ({ beam, keeper, t, p = 'lh' }) => {
  const horizon = 1050;
  const swell = Math.sin(t * 0.9) * 6;
  const a = Math.sin(t * 0.8) * 18;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect x={0} y={0} width={W} height={horizon} fill={`url(#${p}-t30)`} />
        <rect x={0} y={horizon + swell} width={W} height={H} fill={`url(#${p}-t60)`} />
        {/* мыс и скалы */}
        <path d={`M 200 ${horizon + 40} Q 420 820 760 840 Q 980 860 1100 900 V ${horizon + 120} H 200 Z`} fill={INK.teal} />
        {/* смотритель и бочка */}
        <g opacity={keeper}>
          <circle cx={460} cy={760} r={26} fill={INK.teal} />
          <path d="M 428 870 L 432 790 Q 460 776 488 790 L 492 870 Z" fill={INK.teal} />
        </g>
        <rect x={520} y={800} width={60} height={74} rx={10} fill={INK.teal} />
      </Plate>
      <Plate dx={5} dy={-4}>
        <rect x={0} y={horizon - 300} width={W} height={300} fill={`url(#${p}-o30)`} />
        {/* башня маяка: полосы */}
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${700 - 4 * i} ${820 - i * 110} L ${700 - 4 * (i + 1) + 6} ${820 - (i + 1) * 110} L ${820 + 4 * (i + 1) - 6} ${820 - (i + 1) * 110} L ${820 + 4 * i} ${820 - i * 110} Z`} fill={i % 2 ? INK.paper : INK.orange} />
        ))}
        <rect x={700} y={330} width={120} height={60} fill={INK.orange} />
        <rect x={520} y={800} width={60} height={74} rx={10} fill={INK.orange} />
      </Plate>
      <Plate dx={-3} dy={3}>
        <circle cx={240} cy={horizon - 30} r={100} fill={INK.yellow} />
        <circle cx={760} cy={300} r={36} fill={INK.yellow} />
        <path d={`M 760 300 L ${80} ${200 + a * 6} L ${80} ${420 + a * 6} Z`} fill={`url(#${p}-y30)`} opacity={beam} />
      </Plate>
      <circle cx={760} cy={300} r={14} fill={INK.paper} />
      <Finish p={p} />
    </svg>
  );
};

/** Раскрытый ящик и журнал: золото сверху, страница с записью; `entry` 0…1 — запись проступает, `map` 0…1 — карта. */
export const Treasure: React.FC<{ entry: number; map: number; p?: string }> = ({ entry, map, p = 'tr' }) => {
  const page = { x: 140, y: 820, w: 800, h: 900 };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect width={W} height={H} fill={`url(#${p}-t30)`} opacity={0.6} />
        <rect x={60} y={260} width={960} height={460} rx={16} fill="none" stroke={INK.teal} strokeWidth={34} />
      </Plate>
      <Plate dx={5} dy={-4}>
        <rect x={60} y={260} width={960} height={460} rx={16} fill={`url(#${p}-o30)`} />
        <rect x={60} y={260} width={960} height={460} rx={16} fill="none" stroke={INK.orange} strokeWidth={34} />
      </Plate>
      <Plate dx={-3} dy={3}>
        {/* слитки: жёлтая краска по бумаге — золото; бумажный блик сверху */}
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M ${120 + (i % 5) * 180} ${330 + Math.floor(i / 5) * 170} h 140 l -20 110 h -100 Z`} fill={INK.yellow} />
        ))}
      </Plate>
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M ${132 + (i % 5) * 180} ${344 + Math.floor(i / 5) * 170} h 116`} stroke={INK.paper} strokeWidth={8} strokeLinecap="round" />
      ))}
      {/* журнал */}
      <g transform={`rotate(-3 ${page.x + page.w / 2} ${page.y + page.h / 2})`}>
        <rect x={page.x + 10} y={page.y + 14} width={page.w} height={page.h} fill={INK.dark} opacity={0.6} />
        <rect x={page.x} y={page.y} width={page.w} height={page.h} fill={INK.paper} />
        <rect x={page.x} y={page.y} width={page.w} height={page.h} fill="none" stroke={INK.teal} strokeWidth={6} style={{ mixBlendMode: 'multiply' }} />
        <text x={page.x + 40} y={page.y + 80} style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 36, letterSpacing: '0.06em' }} fill={INK.teal}>
          ЖУРНАЛ «СЕВЕРЯНИНА»
        </text>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path key={i} d={`M ${page.x + 40} ${page.y + 150 + i * 64} H ${page.x + page.w - 40}`} stroke="#d8cfbd" strokeWidth={2} />
        ))}
        <g style={{ fontFamily: hand, fontWeight: 600 }} fill={INK.dark} opacity={entry}>
          <text x={page.x + 44} y={page.y + 196} fontSize={50}>Компас сбит.</text>
          <text x={page.x + 44} y={page.y + 260} fontSize={50}>Звёзд не видно.</text>
          <text x={page.x + 44} y={page.y + 324} fontSize={50} fill="#c4433f">Идём на рифы.</text>
        </g>
        {/* карта второго парохода */}
        <g opacity={map}>
          <path d={`M ${page.x + 60} ${page.y + 820} Q ${page.x + 260} ${page.y + 600} ${page.x + 420} ${page.y + 700} T ${page.x + 740} ${page.y + 460}`} fill="none" stroke={INK.teal} strokeWidth={6} strokeDasharray="20 14" style={{ mixBlendMode: 'multiply' }} />
          <path d={`M ${page.x + 700} ${page.y + 420} l 60 60 m 0 -60 l -60 60`} stroke="#c4433f" strokeWidth={12} strokeLinecap="round" />
          <text x={page.x + 600} y={page.y + 540} style={{ fontFamily: hand, fontWeight: 600 }} fontSize={40} fill={INK.dark}>
            север
          </text>
        </g>
      </g>
      <Finish p={p} />
    </svg>
  );
};
