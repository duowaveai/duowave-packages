// Декорации библиотеки «Ленты». Миры «Компаса» из серии 1 теста series-feed (src/episodes/kompas-01/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W, rng } from '../../looks/scene';

// Сериал «Компас», облик «ризограф» (reference/looks.md, src/looks/Riso.tsx): три краски на тёплой бумаге —
// бирюза, оранжевый, жёлтый. Каждая краска — своя «форма» со сдвигом приводки; краски умножаются друг на друга,
// полутона — растром, контуров нет. Бумага — тоже цвет: звёзды, блики и выворотки.
// Миры: палуба ночью (Deck), рубка с компасом (Wheelhouse), карта (Chart).

export const INK = { teal: '#00838A', orange: '#FF7477', yellow: '#FFB511', paper: '#F4EEE2', dark: '#123236' };

const plate: React.CSSProperties = { mixBlendMode: 'multiply' };

/** Одна краска: всё внутри печатается ею, со своим сдвигом приводки. */
export const Plate: React.FC<{ dx?: number; dy?: number; children: React.ReactNode }> = ({ dx = 0, dy = 0, children }) => (
  <g style={plate} transform={dx || dy ? `translate(${dx} ${dy})` : undefined}>
    {children}
  </g>
);

const Dots: React.FC<{ id: string; ink: string; r: number; angle: number }> = ({ id, ink, r, angle }) => (
  <pattern id={id} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
    <circle cx={7} cy={7} r={r} fill={ink} />
  </pattern>
);

/** Растры трёх красок (30 и 60 %) и фактура печати; id с префиксом, чтобы миры не путались. */
export const Defs: React.FC<{ p: string }> = ({ p }) => (
  <defs>
    <Dots id={`${p}-t30`} ink={INK.teal} r={3.3} angle={15} />
    <Dots id={`${p}-t60`} ink={INK.teal} r={5.1} angle={15} />
    <Dots id={`${p}-o30`} ink={INK.orange} r={3.3} angle={75} />
    <Dots id={`${p}-o60`} ink={INK.orange} r={5.1} angle={75} />
    <Dots id={`${p}-y30`} ink={INK.yellow} r={3.6} angle={45} />
    <Dots id={`${p}-y60`} ink={INK.yellow} r={5.3} angle={45} />
    <filter id={`${p}-grain`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={8} />
      <feColorMatrix values="0 0 0 0 0.96  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 1.5 -0.82" />
    </filter>
    <filter id={`${p}-streak`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.002 0.09" numOctaves={2} seed={3} />
      <feColorMatrix values="0 0 0 0 0.96  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0.9 -0.42" />
    </filter>
  </defs>
);

/** Несовершенство печати поверх всего: проколы в заливках и полосы по ходу листа. */
export const Finish: React.FC<{ p: string }> = ({ p }) => (
  <>
    <rect width={W} height={H} filter={`url(#${p}-grain)`} opacity={0.5} />
    <rect width={W} height={H} filter={`url(#${p}-streak)`} opacity={0.3} />
  </>
);

const STARS = (() => {
  const r = rng(101);
  return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * 960, s: 2 + r() * 5, tw: r() * 6.28 }));
})();

/** Полярная звезда: четырёхлучевая выворотка до бумаги. */
export const Polaris: React.FC<{ x: number; y: number; k?: number }> = ({ x, y, k = 1 }) => (
  <path d={`M ${x} ${y - 46 * k} L ${x + 9 * k} ${y - 9 * k} L ${x + 46 * k} ${y} L ${x + 9 * k} ${y + 9 * k} L ${x} ${y + 46 * k} L ${x - 9 * k} ${y + 9 * k} L ${x - 46 * k} ${y} L ${x - 9 * k} ${y - 9 * k} Z`} fill={INK.paper} />
);

export type DeckState = {
  /** 0…1 — тучи разошлись: звёзды видно. */
  clear: number;
  /** Сколько бочек с водой стоит на палубе (из 7). */
  barrels?: number;
  /** 0…1 — подсветить Полярную звезду кольцом. */
  mark?: number;
  /** 0…1 — рассвет: небо светлеет, встаёт солнце, звёзды гаснут. */
  dawn?: number;
  /** Рифы на горизонте: прямо по носу или слева; `reefShow` 0…1, `reefNear` 0…1 — насколько близко. */
  reef?: 'ahead' | 'left';
  reefShow?: number;
  reefNear?: number;
  t: number;
  p?: string;
};

/** Мир «палуба»: нос шхуны ночью, море, небо; слева бочки с водой. Полярная звезда — справа от носа. */
export const Deck: React.FC<DeckState> = ({ clear, barrels = 7, mark = 0, dawn = 0, reef, reefShow = 0, reefNear = 0, t, p = 'dk' }) => {
  const horizon = 1000;
  const swell = Math.sin(t * 0.9) * 10;
  const rx = reef === 'left' ? 230 : 560;
  const rk = 1 + reefNear * 1.6;
  const rocks = [-150, -70, 10, 90, 170].map((o, i) => ({ x: rx + o * rk, h: (40 + ((i * 37) % 50)) * rk }));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      {/* бирюза: небо сплошное, море растром, обводы борта */}
      <Plate>
        <rect x={0} y={0} width={W} height={horizon + swell} fill={INK.teal} opacity={1 - dawn} />
        <rect x={0} y={0} width={W} height={horizon + swell} fill={`url(#${p}-t30)`} opacity={dawn} />
        <rect x={0} y={horizon + swell} width={W} height={H} fill={`url(#${p}-t60)`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M 0 ${horizon + 70 + i * 110 + swell} q 135 -26 270 0 t 270 0 t 270 0 t 270 0`} fill="none" stroke={INK.teal} strokeWidth={10 + i * 3} />
        ))}
        <path d="M -20 1920 L -20 1560 L 540 1150 L 1100 1560 L 1100 1920 Z" fill={INK.teal} opacity={0.35} />
        <g opacity={reefShow}>
          {rocks.map((r, i) => (
            <path key={i} d={`M ${r.x - 46 * rk} ${horizon + 14 + swell} L ${r.x - 10 * rk} ${horizon - r.h + swell} L ${r.x + 30 * rk} ${horizon - r.h * 0.6 + swell} L ${r.x + 50 * rk} ${horizon + 14 + swell} Z`} fill={INK.teal} />
          ))}
        </g>
        {/* бочки: бирюза поверх оранжевого — тёмные, читаются на палубе */}
        {Array.from({ length: Math.max(0, Math.min(7, barrels)) }, (_, i) => (
          <rect key={i} x={40 + (i % 4) * 92} y={1520 + Math.floor(i / 4) * 150} width={80} height={120} rx={20} fill={INK.teal} />
        ))}
      </Plate>
      {/* оранжевый: палуба, мачта и парус, бочки; тучи — растром поверх неба */}
      <Plate dx={5} dy={-4}>
        <rect x={0} y={horizon - 260} width={W} height={260 + swell} fill={`url(#${p}-o30)`} opacity={dawn} />
        <g opacity={reefShow}>
          {rocks.map((r, i) => (
            <path key={i} d={`M ${r.x - 46 * rk} ${horizon + 14 + swell} L ${r.x - 10 * rk} ${horizon - r.h + swell} L ${r.x + 30 * rk} ${horizon - r.h * 0.6 + swell} L ${r.x + 50 * rk} ${horizon + 14 + swell} Z`} fill={INK.orange} />
          ))}
        </g>
        <g opacity={1 - clear}>
          <path d={`M -40 ${260} Q 300 140 620 250 Q 900 330 1120 230 V 640 Q 800 720 520 610 Q 240 520 -40 650 Z`} fill={`url(#${p}-o60)`} />
        </g>
        <path d="M 0 1920 L 0 1600 L 540 1180 L 1080 1600 L 1080 1920 Z" fill={INK.orange} />
        <rect x={150} y={420} width={22} height={1300} fill={INK.orange} />
        <path d="M 172 470 Q 420 760 172 1180 Z" fill={`url(#${p}-o30)`} />
        {Array.from({ length: Math.max(0, Math.min(7, barrels)) }, (_, i) => (
          <rect key={i} x={40 + (i % 4) * 92} y={1520 + Math.floor(i / 4) * 150} width={80} height={120} rx={20} fill={INK.orange} />
        ))}
      </Plate>
      {/* жёлтый: фонарь на носу и свет вокруг него */}
      <Plate dx={-3} dy={3}>
        <circle cx={540} cy={1170} r={140} fill={`url(#${p}-y30)`} />
        <circle cx={540} cy={1170} r={26} fill={INK.yellow} />
        <circle cx={860} cy={360} r={120} fill={`url(#${p}-y30)`} opacity={clear * (1 - dawn)} />
        <circle cx={880} cy={horizon - 40 + swell} r={110} fill={INK.yellow} opacity={dawn} />
        <circle cx={880} cy={horizon - 40 + swell} r={260} fill={`url(#${p}-y30)`} opacity={dawn} />
      </Plate>
      {/* пена над рифами — выворотка до бумаги */}
      <g opacity={reefShow} fill={INK.paper}>
        {rocks.map((r, i) => (
          <ellipse key={i} cx={r.x + Math.sin(t * 3 + i) * 8} cy={horizon + 18 + swell} rx={(54 + 10 * Math.sin(t * 4 + i * 2)) * rk} ry={10 * rk} />
        ))}
      </g>
      {/* выворотки до бумаги: звёзды, доски палубы, обручи бочек */}
      <g opacity={clear * (1 - dawn)}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s * (0.75 + 0.25 * Math.sin(t * 2 + s.tw))} fill={INK.paper} />
        ))}
        <Polaris x={860} y={360} />
        <circle cx={860} cy={360} r={90} fill="none" stroke={INK.paper} strokeWidth={6} strokeDasharray="14 10" opacity={mark} />
      </g>
      <g stroke={INK.paper} strokeWidth={5} opacity={0.75}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M 540 1190 L ${80 + i * 184} 1920`} />
        ))}
      </g>
      {Array.from({ length: Math.max(0, Math.min(7, barrels)) }, (_, i) => (
        <g key={i} stroke={INK.paper} strokeWidth={5}>
          <path d={`M ${40 + (i % 4) * 92} ${1555 + Math.floor(i / 4) * 150} h 80 M ${40 + (i % 4) * 92} ${1605 + Math.floor(i / 4) * 150} h 80`} />
        </g>
      ))}
      <Finish p={p} />
    </svg>
  );
};

export type WheelhouseState = {
  /** Угол стрелки компаса, градусы: 0 — прямо по курсу, плюс — вправо. */
  needle: number;
  /** 0…1 — сундук под компасом. */
  chest: number;
  /** 0…1 — капитан в рубке. */
  captain: number;
  /** 0…1 — за окном видно звёзды. */
  clear: number;
  /** Поворот штурвала, градусы. */
  wheel?: number;
  /** 0…1 — сундук открыт: шлем и карта. */
  open?: number;
  t: number;
  p?: string;
};

/** Мир «рубка»: окно с ночным небом, компас на нактоузе, под ним сундук, штурвал, капитан справа. */
export const Wheelhouse: React.FC<WheelhouseState> = ({ needle, chest, captain, clear, wheel = 0, open = 0, t, p = 'wh' }) => {
  const win = { x: 120, y: 290, w: 840, h: 480 };
  const cx = 540;
  const cy = 1060;
  const sway = Math.sin(t * 0.9) * 1.2;
  const n = needle + Math.sin(t * 1.7) * 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <defs>
        <clipPath id={`${p}-win`}>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} />
        </clipPath>
      </defs>
      <g transform={`rotate(${sway} 540 960)`}>
        {/* бирюза: ночь за окном, нактоуз, штурвал, железо сундука, капитан */}
        <Plate>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={INK.teal} />
          <path d={`M ${cx - 90} ${cy + 120} L ${cx - 120} 1560 L ${cx + 120} 1560 L ${cx + 90} ${cy + 120} Z`} fill={INK.teal} />
          <circle cx={cx} cy={cy} r={180} fill={INK.teal} />
          <g transform={`rotate(${wheel} 170 1560)`}>
            <circle cx={170} cy={1560} r={250} fill="none" stroke={INK.teal} strokeWidth={34} />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <path key={i} d={`M 170 1560 L ${170 + 300 * Math.cos((i * Math.PI) / 4 + 0.3)} ${1560 + 300 * Math.sin((i * Math.PI) / 4 + 0.3)}`} stroke={INK.teal} strokeWidth={22} strokeLinecap="round" />
            ))}
          </g>
          <g opacity={chest}>
            {[0, 1, 2].map((i) => (
              <rect key={i} x={326} y={1600 + i * 80} width={428} height={26} fill={INK.teal} />
            ))}
          </g>
          <g opacity={captain}>
            <path d="M 760 1920 L 760 1180 Q 780 1060 880 1040 Q 1000 1050 1080 1120 L 1080 1920 Z" fill={INK.teal} />
            <circle cx={905} cy={930} r={92} fill={INK.teal} />
            <path d="M 800 880 Q 905 790 1010 880 L 1040 900 L 770 900 Z" fill={INK.teal} />
          </g>
        </Plate>
        {/* оранжевый: обшивка стен растром, рама окна, сундук, капитан (поверх бирюзы — почти чёрный) */}
        <Plate dx={5} dy={-4}>
          <path d={`M 0 0 H ${W} V ${H} H 0 Z M ${win.x} ${win.y} V ${win.y + win.h} H ${win.x + win.w} V ${win.y} Z`} fillRule="evenodd" fill={`url(#${p}-o30)`} />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={0} y={i * 160 + 40} width={W} height={10} fill={INK.orange} />
          ))}
          <rect x={win.x - 26} y={win.y - 26} width={win.w + 52} height={26} fill={INK.orange} />
          <rect x={win.x - 26} y={win.y + win.h} width={win.w + 52} height={40} fill={INK.orange} />
          <rect x={win.x + win.w / 2 - 9} y={win.y} width={18} height={win.h} fill={INK.orange} />
          <rect x={300} y={1580} width={480} height={300} rx={14} fill={INK.orange} opacity={chest} />
          <g opacity={captain}>
            <path d="M 760 1920 L 760 1180 Q 780 1060 880 1040 Q 1000 1050 1080 1120 L 1080 1920 Z" fill={INK.orange} />
            <circle cx={905} cy={930} r={92} fill={INK.orange} />
            <path d="M 800 880 Q 905 790 1010 880 L 1040 900 L 770 900 Z" fill={INK.orange} />
          </g>
        </Plate>
        {/* жёлтый: лампа над компасом, латунь, замок сундука, кокарда капитана */}
        <Plate dx={-3} dy={3}>
          <circle cx={cx} cy={cy} r={330} fill={`url(#${p}-y30)`} />
          <circle cx={cx} cy={cy} r={196} fill="none" stroke={INK.yellow} strokeWidth={22} />
          <rect x={510} y={1660} width={60} height={70} rx={10} fill={INK.yellow} opacity={chest * (1 - open)} />
          {/* открытый сундук: латунный водолазный шлем */}
          <g opacity={open}>
            <circle cx={450} cy={1560} r={92} fill={INK.yellow} />
            <rect x={380} y={1620} width={140} height={40} fill={INK.yellow} />
          </g>
          <circle cx={905} cy={866} r={14} fill={INK.yellow} opacity={captain} />
        </Plate>
        {/* выворотки: звёзды в окне, стекло компаса, стрелка, риски, заклёпки */}
        <g clipPath={`url(#${p}-win)`} opacity={clear}>
          {STARS.map((s, i) => (
            <circle key={i} cx={win.x + (s.x / W) * win.w} cy={win.y + (s.y / 960) * win.h} r={s.s * 0.7} fill={INK.paper} />
          ))}
          <Polaris x={win.x + win.w * 0.8} y={win.y + win.h * 0.32} k={0.8} />
        </g>
        <circle cx={cx} cy={cy} r={150} fill={INK.paper} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI) / 8;
          const r0 = i % 4 ? 128 : 112;
          return <path key={i} d={`M ${cx + r0 * Math.sin(a)} ${cy - r0 * Math.cos(a)} L ${cx + 144 * Math.sin(a)} ${cy - 144 * Math.cos(a)}`} stroke={INK.teal} strokeWidth={i % 4 ? 4 : 8} />;
        })}
        <text x={cx} y={cy - 74} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 34 }} fill={INK.teal}>
          С
        </text>
        <g transform={`rotate(${n} ${cx} ${cy})`}>
          <path d={`M ${cx} ${cy - 120} L ${cx + 18} ${cy} L ${cx - 18} ${cy} Z`} fill={INK.orange} style={plate} />
          <path d={`M ${cx} ${cy + 120} L ${cx + 18} ${cy} L ${cx - 18} ${cy} Z`} fill={INK.teal} style={plate} />
          <circle cx={cx} cy={cy} r={12} fill={INK.yellow} style={plate} />
        </g>
        {/* открытый сундук: крышка вверх, иллюминатор шлема и свёрнутая карта */}
        <g opacity={open}>
          <rect x={300} y={1470} width={480} height={60} rx={10} fill={INK.orange} style={plate} transform="rotate(-18 300 1530)" />
          <circle cx={450} cy={1560} r={42} fill={INK.paper} />
          <circle cx={450} cy={1560} r={42} fill="none" stroke={INK.teal} strokeWidth={10} style={plate} />
          <rect x={560} y={1510} width={180} height={64} rx={30} fill={INK.paper} transform="rotate(-8 650 1540)" />
          <path d="M 590 1530 h 120 M 590 1550 h 90" stroke={INK.teal} strokeWidth={5} style={plate} transform="rotate(-8 650 1540)" />
        </g>
        <g fill={INK.paper} opacity={chest}>
          {[0, 1, 2].flatMap((i) => [340, 420, 660, 740].map((x) => <circle key={`${i}-${x}`} cx={x} cy={1613 + i * 80} r={6} />))}
        </g>
      </g>
      <Finish p={p} />
    </svg>
  );
};

const ISLANDS = [
  'M 80 420 Q 160 330 300 380 Q 360 470 280 540 Q 170 560 80 420 Z',
  'M 760 1240 Q 880 1180 980 1260 Q 1010 1380 900 1420 Q 780 1400 760 1240 Z',
  'M 120 1300 Q 200 1250 260 1330 Q 230 1420 150 1400 Z',
];

const REEFS = (() => {
  const r = rng(113);
  return Array.from({ length: 14 }, () => ({ x: 420 + r() * 240, y: 560 + r() * 140, s: 14 + r() * 16, a: r() * 90 }));
})();

/**
 * Мир «карта»: морская карта с сеткой, островами, рифами прямо по курсу, роза ветров.
 * `route` 0…1 — пунктир курса по компасу дорисовывается; `alt` 0…1 — курс по звёздам, в обход рифов.
 */
export const Chart: React.FC<{ route: number; alt: number; reefs: number; p?: string }> = ({ route, alt, reefs, p = 'ch' }) => {
  const ship = { x: 540, y: 1500 };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect width={W} height={H} fill={`url(#${p}-t30)`} opacity={0.55} />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M ${i * 135} 0 V ${H} M 0 ${i * 240} H ${W}`} stroke={INK.teal} strokeWidth={3} />
        ))}
        {ISLANDS.map((d, i) => (
          <path key={i} d={d} fill={INK.teal} />
        ))}
        {/* роза ветров */}
        <g transform="translate(860 360)">
          <circle r={110} fill="none" stroke={INK.teal} strokeWidth={6} />
          <path d="M 0 -130 L 22 0 L 0 130 L -22 0 Z M -130 0 L 0 -22 L 130 0 L 0 22 Z" fill={INK.teal} />
        </g>
        {/* курс по звёздам: в обход рифов, правее */}
        <path d={`M ${ship.x} ${ship.y} C 620 1200 820 900 780 420`} fill="none" stroke={INK.teal} strokeWidth={10} strokeDasharray="26 18" pathLength={1} strokeDashoffset={0} opacity={alt} />
      </Plate>
      <Plate dx={5} dy={-4}>
        {ISLANDS.map((d, i) => (
          <path key={i} d={d} fill={`url(#${p}-o30)`} />
        ))}
        {/* рифы — красным, прямо по курсу */}
        <g opacity={reefs}>
          {REEFS.map((f, i) => (
            <path key={i} d={`M ${f.x} ${f.y - f.s} L ${f.x + f.s * 0.6} ${f.y} L ${f.x} ${f.y + f.s * 0.5} L ${f.x - f.s * 0.7} ${f.y} Z`} fill={INK.orange} transform={`rotate(${f.a} ${f.x} ${f.y})`} />
          ))}
          <ellipse cx={540} cy={630} rx={190} ry={120} fill="none" stroke={INK.orange} strokeWidth={8} />
        </g>
        {/* курс по компасу: прямо вверх, через рифы */}
        <path d={`M ${ship.x} ${ship.y} L ${ship.x} ${ship.y - 1100 * route}`} stroke={INK.orange} strokeWidth={12} strokeDasharray="30 20" />
        <path d={`M ${ship.x} ${ship.y - 40} L ${ship.x + 30} ${ship.y + 40} L ${ship.x - 30} ${ship.y + 40} Z`} fill={INK.orange} />
      </Plate>
      <Plate dx={-3} dy={3}>
        <circle cx={ship.x} cy={ship.y + 10} r={70} fill={`url(#${p}-y60)`} />
      </Plate>
      <g style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '0.06em' }}>
        <text x={540} y={500} textAnchor="middle" fontSize={44} fill={INK.orange} opacity={reefs} style={plate}>
          РИФЫ
        </text>
        <text x={860} y={210} textAnchor="middle" fontSize={34} fill={INK.teal} style={plate}>
          С
        </text>
        <text x={ship.x + 60} y={ship.y + 90} fontSize={30} fill={INK.teal} style={plate}>
          МЫ
        </text>
      </g>
      <Finish p={p} />
    </svg>
  );
};
