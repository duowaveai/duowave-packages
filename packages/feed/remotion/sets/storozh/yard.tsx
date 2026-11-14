// Декорации библиотеки «Ленты». Миры «Сторожа» из серии 3 теста series-feed (src/episodes/storozh-03/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W, rng, snow } from '../../looks/scene';
import { C, Defs } from './room';

// Миры серии 3 в облике «витраж»: двор и сарай. Герой впервые снаружи, поэтому весь кадр — одно большое стекло:
// небо, снег, дом и сарай собраны из кусков в свинце. Свет — луна и фонарь в руке (янтарь снизу кадра).

const hand = fonts.hand;
const HORIZON = 1050;

/** Небо — ромбы кобальта, снег — крупные неровные плиты; чем ближе к зрителю, тем темнее. */
const SKY = (() => {
  const r = rng(41);
  const out: { d: string; fill: string }[] = [];
  const cw = 150;
  const ch = 190;
  const j = () => (r() - 0.5) * 16;
  for (let row = -1; row * (ch / 2) < HORIZON + ch; row++) {
    for (let col = -1; col * cw < W + cw; col++) {
      const cx = col * cw + (row % 2 ? cw / 2 : 0);
      const cy = row * (ch / 2);
      out.push({
        d: `M ${cx + j()} ${cy - ch / 2 + j()} L ${cx + cw / 2 + j()} ${cy + j()} L ${cx + j()} ${cy + ch / 2 + j()} L ${cx - cw / 2 + j()} ${cy + j()} Z`,
        fill: `hsl(${220 + r() * 14} ${62 + r() * 22}% ${16 + r() * 16 + (cy / HORIZON) * 12}%)`,
      });
    }
  }
  return out;
})();

const SNOW = (() => {
  const r = rng(43);
  const out: { d: string; fill: string }[] = [];
  const cols = 5;
  const rows = 5;
  const xs = (i: number, k: number) => (i === 0 ? -20 : i === cols ? W + 20 : (i * W) / cols + (r() - 0.5) * 70 + k * 0);
  const grid: [number, number][][] = [];
  for (let y = 0; y <= rows; y++) {
    grid.push([]);
    for (let x = 0; x <= cols; x++) grid[y]!.push([xs(x, y), y === 0 ? HORIZON : y === rows ? H + 20 : HORIZON + (y * (H - HORIZON)) / rows + (r() - 0.5) * 60]);
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [a, b, c, d] = [grid[y]![x]!, grid[y]![x + 1]!, grid[y + 1]![x + 1]!, grid[y + 1]![x]!];
      out.push({ d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]} L ${d[0]} ${d[1]} Z`, fill: `hsl(${196 + r() * 24} ${24 + r() * 14}% ${78 - y * 9 + r() * 8}%)` });
    }
  }
  return out;
})();

export type YardState = {
  /** 0…1 — тот, кто стоит во дворе, на месте. */
  there: number;
  /** 0…1 — следы от его места к зрителю. */
  steps?: number;
  /** 0…1 — рассвет: над двором вертолёт с прожектором, у сарая люди с фонарями. */
  heli?: number;
  /** 0…1 — рядом с ним стоит второй, в такой же куртке. */
  second?: number;
  /** 0…1 — глаза у тех, кто стоит. */
  eyes?: number;
  /** Машет рукой. */
  wave?: boolean;
  /** Сдвиг того, кто стоит, по горизонтали (по умолчанию он посреди двора). */
  dx?: number;
  t: number;
};

/** Мир «двор»: дом слева, сарай справа, между ними на снегу — фигура в куртке сторожа. */
export const Yard: React.FC<YardState & { p?: string }> = ({ there, steps = 0, heli = 0, second = 0, eyes = 0, wave = false, dx = 0, t, p = 'yd' }) => {
  const f = { x: 520, head: 880, feet: 1262 };
  const flakes = snow(110, 19, t, { x: 0, y: 0, w: W, h: H });
  const lead = { stroke: C.lead, strokeWidth: 8, strokeLinejoin: 'round' as const };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <radialGradient id={`${p}-moon`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#dfe9ff" stopOpacity={0.6} />
          <stop offset="1" stopColor="#dfe9ff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${p}-lantern`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.55} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#060a18" />
      {SKY.map((q, i) => (
        <path key={i} d={q.d} fill={q.fill} {...lead} strokeWidth={6} />
      ))}
      <circle cx={800} cy={330} r={74} fill="#eef3ff" {...lead} />
      <circle cx={800} cy={330} r={330} fill={`url(#${p}-moon)`} style={{ mixBlendMode: 'screen' }} />
      {/* горы */}
      <path d={`M -20 ${HORIZON} L 180 760 L 400 ${HORIZON} Z`} fill="hsl(226 46% 17%)" {...lead} />
      <path d={`M 330 ${HORIZON} L 600 690 L 860 ${HORIZON} Z`} fill="hsl(224 50% 21%)" {...lead} />
      <path d={`M 760 ${HORIZON} L 960 800 L ${W + 20} ${HORIZON} Z`} fill="hsl(228 44% 16%)" {...lead} />
      <path d="M 600 690 L 540 770 L 600 752 L 664 772 Z" fill="#e6eef5" {...lead} strokeWidth={5} />

      {SNOW.map((q, i) => (
        <path key={i} d={q.d} fill={q.fill} {...lead} strokeWidth={6} />
      ))}

      {/* дом: стена, снежная крыша, окно с огнём печи */}
      <path d={`M -20 620 L 300 620 L 300 ${HORIZON + 60} L -20 ${HORIZON + 60} Z`} fill="hsl(22 30% 16%)" {...lead} />
      <path d="M -20 620 L 150 470 L 340 620 Z" fill="#dfe8ee" {...lead} />
      <rect x={90} y={730} width={140} height={170} fill="hsl(34 92% 58%)" {...lead} />
      <path d="M 160 730 V 900 M 90 815 H 230" {...lead} strokeWidth={6} />
      <circle cx={160} cy={815} r={210} fill={`url(#${p}-lantern)`} opacity={0.8} style={{ mixBlendMode: 'screen' }} />

      {/* сарай: доски, крыша в снегу, тёмный проём */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={720 + i * 82} y={790} width={82} height={HORIZON - 790 + 70} fill={`hsl(24 ${28 + (i % 2) * 6}% ${15 + ((i * 5) % 4)}%)`} {...lead} />
      ))}
      <path d="M 690 790 L 884 690 L 1078 790 Z" fill="#d6e1e8" {...lead} />
      <rect x={826} y={890} width={118} height={HORIZON - 890 + 70} fill="#070608" {...lead} />

      {/* следы от его места к зрителю */}
      <g opacity={steps} fill="hsl(214 30% 38%)" stroke={C.lead} strokeWidth={3}>
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx={f.x + (i % 2 ? 26 : -26) + i * 6} cy={f.feet + 30 + i * 84} rx={20 + i * 3} ry={10 + i * 2} />
        ))}
      </g>

      {/* те, кто стоит: рубиновая голова, куртка сторожа с нашивкой */}
      {[[there, dx, wave] as const, [second, dx + 230, false] as const].map(([on, ox, wav], n) => (
        <g key={n} opacity={on} transform={`translate(${ox} 0)`}>
          <ellipse cx={f.x} cy={f.feet + 6} rx={120} ry={22} fill="hsl(214 30% 34%)" opacity={0.7} />
          <path d={`M ${f.x - 54} ${f.feet} L ${f.x - 44} 1120 L ${f.x + 44} 1120 L ${f.x + 54} ${f.feet} Z`} fill="hsl(350 60% 20%)" {...lead} />
          {wav && (
            <path d={`M ${f.x + 70} 980 L ${f.x + 150} 880 L ${f.x + 176} 902 L ${f.x + 98} 1010 Z`} fill="hsl(28 82% 40%)" {...lead} transform={`rotate(${-14 + 16 * Math.sin(t * 7)} ${f.x + 84} 995)`} />
          )}
          <path d={`M ${f.x - 96} 1130 Q ${f.x - 104} 960 ${f.x - 52} 944 L ${f.x + 52} 944 Q ${f.x + 104} 960 ${f.x + 96} 1130 Z`} fill="hsl(28 82% 44%)" {...lead} />
          <path d={`M ${f.x} 944 V 1130 M ${f.x - 96} 1050 H ${f.x + 96}`} {...lead} strokeWidth={6} fill="none" />
          <rect x={f.x + 6} y={984} width={84} height={30} fill="#efe6cf" {...lead} strokeWidth={4} />
          <text x={f.x + 48} y={1005} textAnchor="middle" style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 14, letterSpacing: '0.02em' }} fill="#2a241c">
            СТОРОЖ
          </text>
          <circle cx={f.x} cy={f.head} r={48} fill="hsl(352 78% 32%)" {...lead} />
          <g fill="hsl(40 80% 88%)" opacity={eyes}>
            <ellipse cx={f.x - 18} cy={f.head + 2} rx={9} ry={5} />
            <ellipse cx={f.x + 18} cy={f.head + 2} rx={9} ry={5} />
          </g>
        </g>
      ))}

      {heli > 0 && (
        <g opacity={heli}>
          {/* рассвет у горизонта, прожектор, вертолёт и трое с фонарями */}
          <rect x={0} y={560} width={W} height={HORIZON - 560} fill="hsl(24 90% 62%)" opacity={0.28} style={{ mixBlendMode: 'screen' }} />
          <path d={`M 520 470 L 300 ${HORIZON + 330} L 820 ${HORIZON + 330} L 600 470 Z`} fill="#f4f8ff" opacity={0.2} style={{ mixBlendMode: 'screen' }} />
          <g {...lead}>
            <path d="M 430 380 Q 440 320 560 318 Q 680 320 700 392 Q 690 452 560 456 Q 440 452 430 380 Z" fill="hsl(210 14% 20%)" />
            <path d="M 690 372 L 930 350 L 936 386 L 698 410 Z" fill="hsl(210 14% 16%)" />
            <path d="M 916 318 L 960 300 L 962 420 L 924 404 Z" fill="hsl(210 14% 24%)" />
            <path d="M 470 348 Q 500 330 560 332 L 560 388 L 462 392 Z" fill="hsl(200 60% 70%)" />
            <path d="M 470 470 H 660 M 500 456 V 470 M 630 456 V 470" fill="none" />
          </g>
          <ellipse cx={560} cy={300} rx={300 + 40 * Math.sin(t * 40)} ry={10} fill="#cfd8e6" opacity={0.75} />
          {[430, 548, 650].map((x, i) => (
            <g key={x}>
              {[0, 1, 2, 3].map((k) => (
                <ellipse key={k} cx={x + (k % 2 ? 12 : -12)} cy={1290 + i * 8 + k * 46} rx={12} ry={7} fill="hsl(214 34% 34%)" stroke={C.lead} strokeWidth={3} />
              ))}
              <path d={`M ${x - 24} ${1250 + i * 8} L ${x - 17} ${1150 + i * 8} L ${x + 17} ${1150 + i * 8} L ${x + 24} ${1250 + i * 8} Z`} fill="hsl(212 30% 18%)" {...lead} strokeWidth={5} />
              <circle cx={x} cy={1128 + i * 8} r={19} fill="hsl(212 30% 24%)" {...lead} strokeWidth={5} />
              <circle cx={x + 30} cy={1196 + i * 8} r={11} fill={C.amber} stroke={C.lead} strokeWidth={4} />
              <circle cx={x + 30} cy={1196 + i * 8} r={70} fill={`url(#${p}-lantern)`} style={{ mixBlendMode: 'screen' }} />
            </g>
          ))}
        </g>
      )}
      {flakes.map((k, i) => (
        <rect key={i} x={k.x - k.r} y={k.y - k.r} width={k.r * 1.6} height={k.r * 1.6} fill="#f4f8fb" opacity={0.85} transform={`rotate(45 ${k.x} ${k.y})`} />
      ))}
      {/* полосы в стекле и свет фонаря в руке */}
      <rect width={W} height={H} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} opacity={0.7} />
      <ellipse cx={540} cy={1840} rx={760} ry={560} fill={`url(#${p}-lantern)`} style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
};

const LOGS = (() => {
  const r = rng(53);
  const out: { x: number; y: number; rad: number; l: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 6; col++) {
      out.push({ x: 70 + col * 96 + (row % 2 ? 48 : 0), y: 1560 - row * 84, rad: 44 + r() * 6, l: 30 + r() * 20 });
    }
  }
  return out;
})();

const JOURNAL = ['Дрова принёс.', 'Во дворе теперь', 'двое.'];

/** Мир «сарай»: поленница из торцов-кругляшей, стол, вторая рация и раскрытый журнал. `ink` — 0…1, запись проступает. */
export const Shed: React.FC<{ dial: number; ink: number; p?: string }> = ({ dial, ink, p = 'sh' }) => {
  const lead = { stroke: C.lead, strokeWidth: 8, strokeLinejoin: 'round' as const };
  const r2 = { x: 640, y: 1000, w: 340, h: 180 };
  const page = { x: 610, y: 1270, w: 400, h: 330 };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <radialGradient id={`${p}-lantern`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.6} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* дощатая стена */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 122 - 8} y={-10} width={122} height={H + 20} fill={`hsl(24 ${26 + (i % 3) * 5}% ${12 + ((i * 7) % 5)}%)`} {...lead} strokeWidth={6} />
      ))}
      <rect width={W} height={H} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />

      {/* поленница: торцы поленьев */}
      {LOGS.map((g, i) => (
        <g key={i}>
          <circle cx={g.x} cy={g.y} r={g.rad} fill={`hsl(30 46% ${g.l}%)`} {...lead} strokeWidth={7} />
          <circle cx={g.x} cy={g.y} r={g.rad * 0.5} fill="none" stroke="hsl(26 40% 22%)" strokeWidth={4} />
        </g>
      ))}

      {/* стол, рация, журнал */}
      <rect x={580} y={1180} width={520} height={46} fill="hsl(22 30% 22%)" {...lead} />
      <rect x={600} y={1226} width={480} height={500} fill="hsl(22 28% 11%)" {...lead} />
      <circle cx={900} cy={1090} r={300} fill={`url(#${p}-lantern)`} opacity={dial} style={{ mixBlendMode: 'screen' }} />
      <path d={`M ${r2.x + 280} ${r2.y} L ${r2.x + 330} ${r2.y - 190}`} stroke="#3a3632" strokeWidth={8} strokeLinecap="round" />
      <rect x={r2.x} y={r2.y} width={r2.w} height={r2.h} rx={10} fill="#15130f" {...lead} />
      <g stroke="#3a3632" strokeWidth={6} strokeLinecap="round">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${r2.x + 36} ${r2.y + 46 + i * 28} H ${r2.x + 180}`} />
        ))}
      </g>
      <circle cx={r2.x + 260} cy={r2.y + 90} r={32} fill="#3b2a18" {...lead} strokeWidth={7} />
      <circle cx={r2.x + 260} cy={r2.y + 90} r={28} fill={C.amber} opacity={dial} />
      <circle cx={r2.x + 260} cy={r2.y + 90} r={15} fill="#fff3d6" opacity={dial} />

      <g transform={`rotate(-4 ${page.x + page.w / 2} ${page.y + page.h / 2})`}>
        <rect x={page.x + 8} y={page.y + 10} width={page.w} height={page.h} fill="#000" opacity={0.5} />
        <rect x={page.x} y={page.y} width={page.w} height={page.h} fill="#e9dfc4" {...lead} strokeWidth={5} />
        <path d={`M ${page.x + page.w / 2} ${page.y} V ${page.y + page.h}`} stroke="#b9ad90" strokeWidth={3} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${page.x + 20} ${page.y + 112 + i * 50} H ${page.x + page.w - 20}`} stroke="#c9bfa5" strokeWidth={2} />
        ))}
        <text x={page.x + 26} y={page.y + 56} style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 30, letterSpacing: '0.05em' }} fill="#8a1f1a">
          НОЧЬ 2
        </text>
        {JOURNAL.map((s, i) => (
          <text key={i} x={page.x + 28} y={page.y + 108 + i * 50} style={{ fontFamily: hand, fontWeight: 600, fontSize: 42 }} fill="#1f2a44" opacity={ink}>
            {s}
          </text>
        ))}
      </g>
      <ellipse cx={540} cy={1500} rx={760} ry={700} fill={`url(#${p}-lantern)`} opacity={0.75} style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
};
