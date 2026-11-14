// Декорации библиотеки «Ленты». Миры «Сторожа» из серии 1 теста series-feed (src/episodes/storozh-01/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { G, H, W, figurePath, rng } from '../../looks/scene';

// Декорации серии в облике «витраж» (styles/stained-glass.md). Два «мира» по 1080×1920: комната с окном и рацией и
// дверь с инструкцией. Планы серии — это ракурсы камеры на эти миры (Episode.tsx), а не отдельные рисунки.

export const C = { lead: '#0b0a0d', stone: '#23211f', stoneL: '#34312d', cream: '#efe6cf', amber: '#ffb347', cobalt: '#3f6fe0', ruby: '#c22b3a' };

const ARCH = (() => {
  const { win } = G;
  return `M ${win.x} ${win.y + win.h} V ${win.y + 150} Q ${win.x + win.w / 2} ${win.y - 120} ${win.x + win.w} ${win.y + 150} V ${win.y + win.h} Z`;
})();

/** Ромбы-«кварели»: неровная решётка, свой оттенок кобальта у каждого куска, внизу — зеленовато-белый снег. */
const QUARRIES = (() => {
  const { win } = G;
  const r = rng(31);
  const cw = 104;
  const ch = 132;
  const out: { d: string; fill: string }[] = [];
  const j = () => (r() - 0.5) * 12;
  for (let row = -1; row * (ch / 2) < win.h + ch; row++) {
    for (let col = -1; col * cw < win.w + cw; col++) {
      const cx = win.x + col * cw + (row % 2 ? cw / 2 : 0);
      const cy = win.y + row * (ch / 2);
      const snowy = cy > win.y + win.h - 120;
      const l = snowy ? 74 + r() * 12 : 26 + r() * 22;
      const fill = snowy ? `hsl(${150 + r() * 30} 22% ${l}%)` : `hsl(${218 + r() * 16} ${70 + r() * 20}% ${l}%)`;
      out.push({ d: `M ${cx + j()} ${cy - ch / 2 + j()} L ${cx + cw / 2 + j()} ${cy + j()} L ${cx + j()} ${cy + ch / 2 + j()} L ${cx - cw / 2 + j()} ${cy + j()} Z`, fill });
    }
  }
  return out;
})();

/** Общие фильтры и обрезки; id с префиксом, чтобы миры не путались между собой. */
export const Defs: React.FC<{ p: string }> = ({ p }) => (
  <defs>
    <filter id={`${p}-stone`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.035" numOctaves={4} seed={7} />
      <feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.76  0 0 0 0 0.7  0 0 0 0.7 -0.28" />
    </filter>
    <filter id={`${p}-streak`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05 0.004" numOctaves={3} seed={15} />
      <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.25  0 0 0 1.3 -0.5" />
    </filter>
    <filter id={`${p}-bloom`} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={34} />
    </filter>
    <filter id={`${p}-floor`} x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation={30} />
      <feColorMatrix type="saturate" values="0.8" />
    </filter>
    <radialGradient id={`${p}-lamp`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor={C.amber} stopOpacity={0.55} />
      <stop offset="1" stopColor={C.amber} stopOpacity={0} />
    </radialGradient>
    <clipPath id={`${p}-win`}>
      <path d={ARCH} />
    </clipPath>
    <clipPath id={`${p}-table`}>
      <rect x={0} y={G.table} width={W} height={H - G.table} />
    </clipPath>
  </defs>
);

/** Каменная кладка на весь мир. */
export const Stone: React.FC<{ p: string }> = ({ p }) => (
  <>
    <rect width={W} height={H} fill={C.stone} />
    <rect width={W} height={H} filter={`url(#${p}-stone)`} opacity={0.5} />
    <g stroke="#131210" strokeWidth={5} opacity={0.8}>
      {Array.from({ length: 17 }, (_, i) => (
        <path key={i} d={`M 0 ${i * 118 + 40} H ${W}`} />
      ))}
      {Array.from({ length: 68 }, (_, i) => (
        <path key={i} d={`M ${((i % 4) * 300 + (Math.floor(i / 4) % 2) * 150 + 40) % W} ${Math.floor(i / 4) * 118 + 40} v 118`} />
      ))}
    </g>
  </>
);

/** Стекло: фон, фигура из рубиновых кусков, свинец. `lit` — сколько света за стеклом, `near` — насколько фигура подошла. */
const Panes: React.FC<{ p: string; lit: number; near: number; eyes: number; there: number }> = ({ p, lit, near, eyes, there }) => {
  const { win, fig } = G;
  const b = win.y + win.h;
  const k = 1 + 0.42 * near;
  return (
    <g clipPath={`url(#${p}-win)`}>
      <rect x={win.x} y={win.y - 140} width={win.w} height={win.h + 140} fill="#060a18" />
      <g opacity={0.3 + 0.7 * lit}>
        {QUARRIES.map((q, i) => (
          <path key={i} d={q.d} fill={q.fill} stroke={C.lead} strokeWidth={7} strokeLinejoin="round" />
        ))}
        <g transform={`translate(${fig.cx} ${b}) scale(${k}) translate(${-fig.cx} ${-b})`} opacity={there}>
          <g stroke={C.lead} strokeWidth={9 / k} strokeLinejoin="round">
            <circle cx={fig.cx} cy={fig.head} r={fig.r} fill="hsl(352 78% 34%)" />
            <path d={figurePath()} fill="hsl(356 80% 30%)" />
            <path d={`M ${fig.cx - 125} ${fig.shoulders + 110} H ${fig.cx + 125} V ${b} H ${fig.cx - 125} Z`} fill="hsl(348 74% 24%)" />
            <path d={`M ${fig.cx} ${fig.shoulders} V ${b}`} fill="none" strokeWidth={7 / k} />
          </g>
          <g fill="hsl(40 70% 86%)" opacity={eyes}>
            <ellipse cx={fig.cx - 20} cy={fig.head + 2} rx={9} ry={5} />
            <ellipse cx={fig.cx + 20} cy={fig.head + 2} rx={9} ry={5} />
          </g>
        </g>
      </g>
      <rect x={win.x} y={win.y - 140} width={win.w} height={win.h + 140} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />
    </g>
  );
};

export type RoomState = {
  /** 0…1 — сколько света за стеклом (луна из-за туч). */
  lit: number;
  /** 0…1 — фигура подошла к стеклу. */
  near?: number;
  /** 0…1 — глаза фигуры. */
  eyes?: number;
  /** 0…1 — фигура за стеклом есть (по умолчанию есть). */
  there?: number;
  /** 0…1 — шкала рации горит. */
  dial: number;
};

/** Мир «комната»: стена, витражное окно, стол, рация, розетка и вилка, которая в неё не вставлена. */
export const GlassRoom: React.FC<RoomState & { p?: string }> = ({ lit, near = 0, eyes = 1, there = 1, dial: dialOn, p = 'gr' }) => {
  const { win, radio, dial, antenna, table } = G;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <Stone p={p} />
      {/* откос окна светлее стены */}
      <path d={`M ${win.x - 34} ${win.y + win.h + 30} V ${win.y + 140} Q ${win.x + win.w / 2} ${win.y - 170} ${win.x + win.w + 34} ${win.y + 140} V ${win.y + win.h + 30} Z`} fill={C.stoneL} />

      <Panes p={p} lit={lit} near={near} eyes={eyes} there={there} />
      <g filter={`url(#${p}-bloom)`} opacity={0.6 * lit} style={{ mixBlendMode: 'screen' }}>
        <Panes p={p} lit={lit} near={near} eyes={eyes} there={there} />
      </g>
      <path d={ARCH} fill="none" stroke={C.lead} strokeWidth={20} />
      <path d={`M ${win.x} ${win.y + 210} H ${win.x + win.w} M ${win.x} ${win.y + 400} H ${win.x + win.w} M ${win.x + win.w / 2} ${win.y - 6} V ${win.y + win.h}`} stroke={C.lead} strokeWidth={11} />

      {/* розетка на стене */}
      <rect x={846} y={1010} width={84} height={104} rx={8} fill="#3d3934" stroke={C.lead} strokeWidth={7} />
      <circle cx={872} cy={1062} r={8} fill={C.lead} />
      <circle cx={904} cy={1062} r={8} fill={C.lead} />

      {/* стол; на нём — цветное пятно от окна, зеркально и размыто */}
      <rect x={0} y={table} width={W} height={H - table} fill="#191715" />
      <rect x={0} y={table} width={W} height={H - table} filter={`url(#${p}-stone)`} opacity={0.35} />
      <g clipPath={`url(#${p}-table)`}>
        <g filter={`url(#${p}-floor)`} opacity={0.75 * lit} style={{ mixBlendMode: 'screen' }} transform={`translate(-60 ${table + 620}) scale(1.1 -0.62) translate(0 ${-win.y})`}>
          <Panes p={p} lit={1} near={near} eyes={0} there={there} />
        </g>
      </g>
      <rect x={0} y={table} width={W} height={8} fill={C.stoneL} />

      {/* шнур рации: вилка лежит на столе, до розетки не достаёт */}
      <path d={`M ${radio.x + radio.w - 6} ${radio.y + 150} C 780 ${radio.y + 170} 730 ${table + 96} 812 ${table + 84} S 858 ${table + 50} 866 ${table + 44}`} fill="none" stroke={C.lead} strokeWidth={15} strokeLinecap="round" />
      <path d={`M ${radio.x + radio.w - 6} ${radio.y + 150} C 780 ${radio.y + 170} 730 ${table + 96} 812 ${table + 84} S 858 ${table + 50} 866 ${table + 44}`} fill="none" stroke="#4a4540" strokeWidth={7} strokeLinecap="round" />
      <g transform={`translate(866 ${table + 44}) rotate(-52)`}>
        <rect x={-4} y={-24} width={56} height={48} rx={10} fill="#4a4540" stroke={C.lead} strokeWidth={7} />
        <rect x={52} y={-15} width={26} height={7} fill="#b8b0a2" stroke={C.lead} strokeWidth={3} />
        <rect x={52} y={8} width={26} height={7} fill="#b8b0a2" stroke={C.lead} strokeWidth={3} />
      </g>

      {/* рация: тёмный предмет; янтарь шкалы — свет, которого нет в стекле */}
      <circle cx={dial.x} cy={dial.y} r={330} fill={`url(#${p}-lamp)`} opacity={dialOn} style={{ mixBlendMode: 'screen' }} />
      <path d={`M ${antenna.x1} ${antenna.y1} L ${antenna.x2} ${antenna.y2}`} stroke="#3a3632" strokeWidth={8} strokeLinecap="round" />
      <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} rx={10} fill="#15130f" stroke={C.lead} strokeWidth={8} />
      <g stroke="#3a3632" strokeWidth={6} strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${radio.x + 44} ${radio.y + 50 + i * 26} H ${radio.x + 220}`} />
        ))}
      </g>
      <circle cx={dial.x} cy={dial.y} r={dial.r} fill="#3b2a18" stroke={C.lead} strokeWidth={7} />
      <circle cx={dial.x} cy={dial.y} r={dial.r - 4} fill={C.amber} opacity={dialOn} />
      <circle cx={dial.x} cy={dial.y} r={dial.r * 0.5} fill="#fff3d6" opacity={dialOn} />
    </svg>
  );
};

const RULES = ['1. Печь топить до утра.', '2. Генератор — раз в сутки.', '3. Журнал — каждый час.', '', '5. После полуночи', '    дверь не открывать.'];

/** Мир «дверь»: тяжёлая дверь в каменной стене, на ней — инструкция сторожа; четвёртый пункт стёрт. */
export const DoorRoom: React.FC<{ lamp: number; p?: string; rule4?: string; rule4Show?: number; rule4Font?: string }> = ({ lamp, p = 'dr', rule4, rule4Show = 0, rule4Font }) => {
  const d = { x: 250, y: 380, w: 580, h: 1160 };
  const arch = `M ${d.x} ${d.y + d.h} V ${d.y + 180} Q ${d.x + d.w / 2} ${d.y - 130} ${d.x + d.w} ${d.y + 180} V ${d.y + d.h} Z`;
  const note = { x: 372, y: 640, w: 336, h: 392 };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <clipPath id={`${p}-door`}>
          <path d={arch} />
        </clipPath>
        <radialGradient id={`${p}-pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.amber} stopOpacity={0.5} />
          <stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      <Stone p={p} />
      <rect x={0} y={d.y + d.h} width={W} height={H} fill="#141210" />
      <path d={`M ${d.x - 36} ${d.y + d.h} V ${d.y + 170} Q ${d.x + d.w / 2} ${d.y - 180} ${d.x + d.w + 36} ${d.y + 170} V ${d.y + d.h} Z`} fill={C.stoneL} />

      {/* доски двери — куски тёмного дерева в свинце, как стекло без света */}
      <g clipPath={`url(#${p}-door)`}>
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={d.x + (i * d.w) / 6} y={d.y - 140} width={d.w / 6} height={d.h + 140} fill={`hsl(24 ${26 + (i % 3) * 5}% ${13 + ((i * 7) % 5)}%)`} stroke={C.lead} strokeWidth={7} />
        ))}
        <rect x={d.x} y={d.y - 140} width={d.w} height={d.h + 140} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />
      </g>
      <path d={arch} fill="none" stroke={C.lead} strokeWidth={22} />
      {/* железные полосы, кольцо, засов */}
      {[d.y + 250, d.y + 760, d.y + 1040].map((y) => (
        <rect key={y} x={d.x + 4} y={y} width={d.w - 8} height={44} fill="#2b2927" stroke={C.lead} strokeWidth={7} />
      ))}
      <circle cx={d.x + d.w - 92} cy={d.y + 860} r={36} fill="none" stroke="#6a655d" strokeWidth={12} />
      <rect x={d.x + 150} y={d.y + 912} width={300} height={34} rx={8} fill="#4a4641" stroke={C.lead} strokeWidth={7} />

      {/* свет лампы над дверью */}
      <ellipse cx={540} cy={760} rx={520} ry={620} fill={`url(#${p}-pool)`} opacity={lamp} style={{ mixBlendMode: 'screen' }} />

      {/* инструкция сторожа */}
      <g transform={`rotate(-2 ${note.x + note.w / 2} ${note.y + note.h / 2})`}>
        <rect x={note.x + 6} y={note.y + 8} width={note.w} height={note.h} fill="#000" opacity={0.45} />
        <rect x={note.x} y={note.y} width={note.w} height={note.h} fill="#e9dfc4" />
        <rect x={note.x} y={note.y} width={note.w} height={note.h} filter={`url(#${p}-stone)`} opacity={0.18} />
        <circle cx={note.x + note.w / 2} cy={note.y + 16} r={8} fill="#7a2a22" />
        <text x={note.x + 26} y={note.y + 70} style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 22, letterSpacing: '0.02em' }} fill="#2a241c">
          ИНСТРУКЦИЯ СТОРОЖА
        </text>
        <path d={`M ${note.x + 26} ${note.y + 86} H ${note.x + note.w - 26}`} stroke="#2a241c" strokeWidth={3} />
        {RULES.map((s, i) => (
          <text key={i} x={note.x + 26} y={note.y + 136 + i * 44} style={{ fontFamily: fonts.ui, fontWeight: i >= 4 ? 800 : 600, fontSize: 22, whiteSpace: 'pre' }} fill={i >= 4 ? '#8a1f1a' : '#2a241c'}>
            {s}
          </text>
        ))}
        {/* пункт 4 стёрт: серая размазня и обрывок цифры; `rule4` проступает сквозь неё по `rule4Show` */}
        <text x={note.x + 26} y={note.y + 136 + 3 * 44} style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 24 }} fill="#2a241c" opacity={0.55}>
          4.
        </text>
        <g opacity={1 - 0.7 * rule4Show}>
          <path d={`M ${note.x + 58} ${note.y + 126 + 3 * 44} q 60 -16 120 -2 t 110 -4`} fill="none" stroke="#8d8676" strokeWidth={26} strokeLinecap="round" opacity={0.75} filter={`url(#${p}-floor)`} />
          <path d={`M ${note.x + 62} ${note.y + 130 + 3 * 44} q 70 -10 130 2 t 96 -6`} fill="none" stroke="#a39b88" strokeWidth={10} strokeLinecap="round" opacity={0.7} />
        </g>
        {rule4 && (
          <text x={note.x + 56} y={note.y + 138 + 3 * 44} style={{ fontFamily: rule4Font ?? fonts.ui, fontWeight: 700, fontSize: rule4Font ? 30 : 19 }} fill={rule4Font ? '#1f2a44' : '#3a2f22'} opacity={0.85 * rule4Show}>
            {rule4}
          </text>
        )}
      </g>
    </svg>
  );
};
