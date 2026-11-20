// Декорации библиотеки «Ленты». Мир «Компаса» из серии 3 теста series-feed (src/episodes/kompas-03/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W, rng } from '../../looks/scene';
import { Defs, Finish, INK, Plate } from './ship';

// Новый мир серии 3 — бухта днём (ризограф). Борт шхуны на переднем плане: насос с колесом, шланг и верёвка уходят
// за борт, на воде пузыри от водолаза. Справа мыс, из-за него выходит лодка «рыбаков».
// Улики развилки нарисованы, но не названы: в лодке нет сетей, а под брезентом — латунный водолазный шлем.

const BUBBLES = (() => {
  const r = rng(141);
  return Array.from({ length: 16 }, () => ({ x: 380 + r() * 160, ph: r(), s: 6 + r() * 12 }));
})();

export type BayState = {
  /** 0…1 — лодка вышла из-за мыса; 1 — у борта. */
  boat: number;
  /** 0…1 — брезент в лодке сдвинут, видно шлем. */
  tarp?: number;
  /** 0…1 — водолаз ушёл под воду (шлем тонет). */
  diver: number;
  /** Поворот колеса насоса, градусы. */
  pump: number;
  /** 0…1 — сколько воздуха идёт водолазу: пузырей меньше. */
  air?: number;
  /** 0…1 — у насоса прибиты «Правила водолаза». */
  rules?: number;
  /** 0…1 — в руке у всплывшего капитана медная табличка. */
  plate?: number;
  /** 0…1 — вечер: солнце садится, небо и вода темнеют. */
  dusk?: number;
  /** 0…1 — фонарь на мысе. */
  lantern?: number;
  /** 0…1 — на палубе окованный ящик «Северянина». */
  box?: number;
  /** 0…1 — капитан без шлема сидит на палубе. */
  sitting?: number;
  /** 0…1 — ночь: всё темнеет. */
  night?: number;
  /** Водолаза нет: ни шлема, ни пузырей. */
  noDiver?: boolean;
  t: number;
  p?: string;
};

export const Bay: React.FC<BayState> = ({ boat, tarp = 0, diver, pump, air = 1, rules = 0, plate = 0, dusk = 0, lantern = 0, box = 0, sitting = 0, night = 0, noDiver = false, t, p = 'by' }) => {
  const horizon = 760;
  const swell = Math.sin(t * 0.8) * 6;
  // лодка: из-за мыса справа к борту
  const bx = 980 - 470 * boat;
  const by = horizon + 120 + 420 * boat;
  const bk = 0.6 + 0.9 * boat;
  const helmetY = 1180 + 260 * diver;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        {/* небо светлым растром, вода — плотнее к нам */}
        <rect x={0} y={0} width={W} height={horizon} fill={`url(#${p}-t30)`} opacity={0.5} />
        <rect x={0} y={horizon + swell} width={W} height={H} fill={`url(#${p}-t60)`} />
        <rect x={0} y={0} width={W} height={H} fill={`url(#${p}-t30)`} opacity={0.7 * dusk} />
        <rect x={0} y={0} width={W} height={H} fill={`url(#${p}-t60)`} opacity={0.8 * night} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M 0 ${horizon + 80 + i * 120 + swell} q 135 -18 270 0 t 270 0 t 270 0 t 270 0`} fill="none" stroke={INK.teal} strokeWidth={8 + i * 2} />
        ))}
        {/* мыс справа */}
        <path d={`M 700 ${horizon + 4} Q 820 560 1100 600 V ${horizon + 4} Z`} fill={INK.teal} />
        {/* борт шхуны и колесо насоса */}
        <rect x={-20} y={1560} width={W + 40} height={400} fill={INK.teal} opacity={0.4} />
        <g transform={`rotate(${pump} 200 1520)`}>
          <circle cx={200} cy={1520} r={150} fill="none" stroke={INK.teal} strokeWidth={26} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M 200 1520 L ${200 + 150 * Math.cos((i * Math.PI) / 3)} ${1520 + 150 * Math.sin((i * Math.PI) / 3)}`} stroke={INK.teal} strokeWidth={16} />
          ))}
        </g>
        {/* шланг и верёвка за борт */}
        <path d={`M 260 1600 C 380 1580 430 1420 ${460} ${helmetY + 40}`} fill="none" stroke={INK.teal} strokeWidth={18} strokeLinecap="round" />
        {/* двое в лодке */}
        <g transform={`translate(${bx} ${by}) scale(${bk})`}>
          <circle cx={-60} cy={-150} r={30} fill={INK.teal} />
          <path d="M -100 -40 L -96 -116 Q -60 -132 -24 -116 L -20 -40 Z" fill={INK.teal} />
          <circle cx={60} cy={-160} r={32} fill={INK.teal} />
          <path d="M 18 -40 L 22 -126 Q 60 -144 98 -126 L 102 -40 Z" fill={INK.teal} />
        </g>
      </Plate>
      <Plate dx={5} dy={-4}>
        <path d={`M 700 ${horizon + 4} Q 820 560 1100 600 V ${horizon + 4} Z`} fill={`url(#${p}-o30)`} />
        {/* палуба и планширь */}
        <path d={`M -20 1600 H ${W + 20} V ${H + 20} H -20 Z`} fill={INK.orange} />
        <rect x={-20} y={1560} width={W + 40} height={46} fill={INK.orange} />
        <rect x={0} y={0} width={W} height={horizon} fill={`url(#${p}-o30)`} opacity={dusk} />
        {/* окованный ящик на палубе */}
        <rect x={380} y={1640} width={250} height={150} rx={10} fill={INK.orange} opacity={box} />
        {/* корпус насоса */}
        <rect x={140} y={1600} width={120} height={200} rx={14} fill={INK.orange} />
        {/* лодка: корпус, пустое дно — ни одной сети; брезент на носу */}
        <g transform={`translate(${bx} ${by}) scale(${bk})`}>
          <path d="M -200 -40 H 200 L 160 40 H -160 Z" fill={INK.orange} />
          <path d="M 110 -40 Q 150 -96 196 -40 Z" fill={`url(#${p}-o60)`} opacity={1 - tarp} />
        </g>
      </Plate>
      <Plate dx={-3} dy={3}>
        <circle cx={880 - 640 * dusk} cy={220 + 520 * dusk} r={110 + 40 * dusk} fill={INK.yellow} />
        <circle cx={880 - 640 * dusk} cy={220 + 520 * dusk} r={260} fill={`url(#${p}-y30)`} />
        <circle cx={960} cy={640} r={16} fill={INK.yellow} opacity={lantern} />
        <circle cx={960} cy={640} r={90} fill={`url(#${p}-y60)`} opacity={lantern} />
        {/* латунь: шлем капитана над водой / в воде, ось насоса, шлем в лодке под брезентом */}
        <circle cx={460} cy={helmetY} r={70} fill={INK.yellow} opacity={noDiver ? 0 : 1 - 0.6 * diver} />
        <circle cx={200} cy={1520} r={36} fill={INK.yellow} />
        <g transform={`translate(${bx} ${by}) scale(${bk})`}>
          <circle cx={150} cy={-62} r={34} fill={INK.yellow} opacity={tarp} />
        </g>
      </Plate>
      {/* выворотки до бумаги: блики, пузыри, иллюминаторы шлемов */}
      <circle cx={460} cy={helmetY} r={30} fill={INK.paper} opacity={noDiver ? 0 : 1 - 0.6 * diver} />
      <g transform={`translate(${bx} ${by}) scale(${bk})`}>
        <circle cx={150} cy={-62} r={14} fill={INK.paper} opacity={tarp} />
      </g>
      <g fill={INK.paper} opacity={noDiver ? 0 : diver}>
        {BUBBLES.slice(0, Math.round(BUBBLES.length * air)).map((b, i) => {
          const k = (t * 0.6 + b.ph) % 1;
          return <circle key={i} cx={b.x + Math.sin(t * 3 + i) * 10} cy={1300 - k * 420} r={b.s * (0.5 + k)} opacity={1 - k} />;
        })}
      </g>
      <g stroke={INK.paper} strokeWidth={4} opacity={0.6}>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${-20 + i * 300} 1700 L ${-20 + i * 300 + 220} 1920`} />
        ))}
      </g>
      {/* фонарь на мысе: бумажная точка в жёлтом кольце */}
      <circle cx={960} cy={640} r={11} fill={INK.paper} opacity={lantern} />
      <circle cx={960} cy={640} r={24} fill="none" stroke={INK.yellow} strokeWidth={6} opacity={lantern} />
      {/* ящик: железные полосы и бумажная наклейка */}
      <g opacity={box}>
        <rect x={380} y={1672} width={250} height={18} fill={INK.dark} />
        <rect x={380} y={1744} width={250} height={18} fill={INK.dark} />
        <rect x={430} y={1690} width={150} height={48} fill={INK.paper} />
        <text x={505} y={1723} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 22 }} fill={INK.dark}>
          СЕВЕРЯНИН
        </text>
      </g>
      {/* капитан сидит на палубе без шлема, шлем рядом */}
      <g opacity={sitting} fill={INK.dark}>
        <circle cx={850} cy={1500} r={46} />
        <path d="M 780 1700 L 790 1570 Q 850 1540 910 1570 L 930 1700 Z" />
        <path d="M 900 1600 L 990 1680 L 970 1700 L 890 1630 Z" />
      </g>
      <circle cx={980} cy={1720} r={40} fill={INK.yellow} opacity={sitting} style={{ mixBlendMode: 'multiply' }} />
      {/* табличка в руке всплывшего капитана */}
      <g opacity={plate} transform={`rotate(-6 ${600} ${helmetY - 10})`}>
        <rect x={530} y={helmetY - 66} width={270} height={100} rx={8} fill={INK.paper} />
        <rect x={530} y={helmetY - 66} width={270} height={100} rx={8} fill={INK.yellow} style={{ mixBlendMode: 'multiply' }} />
        <text x={665} y={helmetY + 2} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 36, letterSpacing: '0.03em' }} fill={INK.dark}>
          СЕВЕРЯНИН
        </text>
      </g>
      {/* «Правила водолаза» на стойке у насоса — бумажный лист */}
      <g opacity={rules}>
        <rect x={752} y={1370} width={26} height={230} fill={INK.dark} />
        <g transform="rotate(-3 765 1275)">
          <rect x={600} y={1180} width={330} height={190} fill={INK.paper} />
          <rect x={600} y={1180} width={330} height={190} fill="none" stroke={INK.teal} strokeWidth={5} style={{ mixBlendMode: 'multiply' }} />
          <g style={{ fontFamily: fonts.display, fontWeight: 900 }} fill={INK.dark}>
            <text x={620} y={1216} fontSize={22} letterSpacing="0.05em">ПРАВИЛА ВОДОЛАЗА</text>
            <text x={620} y={1258} fontSize={19}>1. Рывок — всё хорошо.</text>
            <text x={620} y={1296} fontSize={19}>2. Два рывка — наверх.</text>
            <text x={620} y={1340} fontSize={19} fill="#c4433f">3. Между спусками —</text>
            <text x={620} y={1364} fontSize={19} fill="#c4433f">    не меньше 6 часов.</text>
          </g>
        </g>
      </g>
      <Finish p={p} />
    </svg>
  );
};
