import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, figurePath, rng, type HookState } from './scene';

// Облик «витраж»: окно — куски цветного стекла в тёмном свинце, светится только то, за чем свет; комната — камень,
// цвет берёт лишь от пятна, которое стекло бросает на стол. Две несущие краски — кобальт и рубин; свет рации — янтарь,
// которого нет в стекле, поэтому читается как источник. Сериал «Сторож» — в этом облике (sets/storozh/).

export const GLASS_PALETTE = { lead: '#0b0a0d', stone: '#23211f', stoneL: '#34312d', cream: '#efe6cf', amber: '#ffb347', cobalt: '#3f6fe0', ruby: '#c22b3a' };
const C = GLASS_PALETTE;

/** Ромбы-«кварели» фона: неровная решётка, у каждого куска свой оттенок кобальта, внизу — зеленовато-белый снег. */
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

/** Само стекло: фон, фигура из рубиновых кусков, свинец. */
const Panes: React.FC<{ p: string; lit: number; there: number; near: number; eyes: number }> = ({ p, lit, there, near, eyes }) => {
  const { win, fig } = G;
  const b = win.y + win.h;
  const k = 1 + 0.42 * near;
  return (
    <g clipPath={`url(#${p}-win)`}>
      <rect x={win.x} y={win.y - 140} width={win.w} height={win.h + 140} fill="#060a18" />
      <g opacity={0.35 + 0.65 * lit}>
        {QUARRIES.map((q, i) => (
          <path key={i} d={q.d} fill={q.fill} stroke={C.lead} strokeWidth={7} strokeLinejoin="round" />
        ))}
        {/* фигура: голова, плечи и корпус — отдельные куски рубина */}
        <g opacity={there} transform={`translate(${fig.cx} ${b}) scale(${k}) translate(${-fig.cx} ${-b})`}>
          <g stroke={C.lead} strokeWidth={9 / k} strokeLinejoin="round">
            <circle cx={fig.cx} cy={fig.head} r={fig.r} fill="hsl(352 78% 34%)" />
            <path d={figurePath()} fill="hsl(356 80% 30%)" />
            <path d={`M ${fig.cx - 125} ${fig.shoulders + 110} H ${fig.cx + 125} V ${b} H ${fig.cx - 125} Z`} fill="hsl(348 74% 24%)" />
            <path d={`M ${fig.cx} ${fig.shoulders} V ${b}`} fill="none" strokeWidth={7 / k} />
          </g>
          {/* гризайль: два светлых глаза — процарапано до стекла */}
          <g fill="hsl(40 60% 82%)" opacity={eyes}>
            <ellipse cx={fig.cx - 20} cy={fig.head + 2} rx={9} ry={5} />
            <ellipse cx={fig.cx + 20} cy={fig.head + 2} rx={9} ry={5} />
          </g>
        </g>
      </g>
      {/* полосы и пузырьки в стекле */}
      <rect x={win.x} y={win.y - 140} width={win.w} height={win.h + 140} filter={`url(#${p}-streak)`} style={{ mixBlendMode: 'multiply' }} />
    </g>
  );
};

/** Мир сцены-хука витражом: каменная стена, арка окна, плита стола, рация. */
export const GlassScene: React.FC<HookState> = ({ t, there = 1, near = 0, dial: dialOn = 1, lit = 1, eyes = 1, p = 'sg' }) => {
  const { win, radio, dial, antenna, table } = G;
  const lamp = dialOn * (0.8 + 0.2 * Math.sin(t * 8) * Math.sin(t * 2.1));
  const arch = `M ${win.x} ${win.y + win.h} V ${win.y + 150} Q ${win.x + win.w / 2} ${win.y - 120} ${win.x + win.w} ${win.y + 150} V ${win.y + win.h} Z`;
  const panes = { p, lit, there, near, eyes };

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: C.stone }}>
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
          <path d={arch} />
        </clipPath>
        <clipPath id={`${p}-table`}>
          <rect x={0} y={table} width={W} height={H - table} />
        </clipPath>
      </defs>

      {/* камень: тёсаные блоки */}
      <rect width={W} height={H} filter={`url(#${p}-stone)`} opacity={0.5} />
      <g stroke="#131210" strokeWidth={5} opacity={0.8}>
        {Array.from({ length: 17 }, (_, i) => (
          <path key={i} d={`M 0 ${i * 118 + 40} H ${W}`} />
        ))}
        {Array.from({ length: 68 }, (_, i) => (
          <path key={i} d={`M ${((i % 4) * 300 + (Math.floor(i / 4) % 2) * 150 + 40) % W} ${Math.floor(i / 4) * 118 + 40} v 118`} />
        ))}
      </g>
      {/* откос окна светлее стены */}
      <path d={`M ${win.x - 34} ${win.y + win.h + 30} V ${win.y + 140} Q ${win.x + win.w / 2} ${win.y - 170} ${win.x + win.w + 34} ${win.y + 140} V ${win.y + win.h + 30} Z`} fill={C.stoneL} />

      <Panes {...panes} />
      {/* свечение: яркое стекло «съедает» свинец и разливается по камню */}
      <g filter={`url(#${p}-bloom)`} opacity={0.6 * lit} style={{ mixBlendMode: 'screen' }}>
        <Panes {...panes} />
      </g>
      {/* железные перекладины и свинцовый обвод */}
      <path d={arch} fill="none" stroke={C.lead} strokeWidth={20} />
      <path d={`M ${win.x} ${win.y + 210} H ${win.x + win.w} M ${win.x} ${win.y + 400} H ${win.x + win.w} M ${win.x + win.w / 2} ${win.y - 6} V ${win.y + win.h}`} stroke={C.lead} strokeWidth={11} />

      {/* стол: плита; на ней — цветное пятно от окна, зеркально и размыто */}
      <rect x={0} y={table} width={W} height={H - table} fill="#191715" />
      <rect x={0} y={table} width={W} height={H - table} filter={`url(#${p}-stone)`} opacity={0.35} />
      <g clipPath={`url(#${p}-table)`}>
        <g filter={`url(#${p}-floor)`} opacity={0.75 * lit} style={{ mixBlendMode: 'screen' }} transform={`translate(-60 ${table + 620}) scale(1.1 -0.62) translate(0 ${-win.y})`}>
          <Panes {...panes} lit={1} eyes={0} />
        </g>
      </g>
      <rect x={0} y={table} width={W} height={8} fill={C.stoneL} />

      {/* рация: тёмный предмет, янтарная шкала — свет, которого нет в стекле */}
      <circle cx={dial.x} cy={dial.y} r={330} fill={`url(#${p}-lamp)`} opacity={lamp} style={{ mixBlendMode: 'screen' }} />
      <path d={`M ${antenna.x1} ${antenna.y1} L ${antenna.x2} ${antenna.y2}`} stroke="#3a3632" strokeWidth={8} strokeLinecap="round" />
      <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} rx={10} fill="#15130f" stroke={C.lead} strokeWidth={8} />
      <g stroke="#3a3632" strokeWidth={6} strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${radio.x + 44} ${radio.y + 50 + i * 26} H ${radio.x + 220}`} />
        ))}
      </g>
      <circle cx={dial.x} cy={dial.y} r={dial.r} fill="#3b2a18" stroke={C.lead} strokeWidth={7} />
      <circle cx={dial.x} cy={dial.y} r={dial.r - 4} fill={C.amber} opacity={dialOn} />
      <circle cx={dial.x} cy={dial.y} r={dial.r * 0.5} fill="#fff3d6" opacity={lamp} />
    </svg>
  );
};

/** Образец облика для знакомства (`look-glass`): луна выходит из-за туч — стекло разгорается. */
export const GlassHook: React.FC = () => {
  const t = useTime();
  const zoom = interpolate(t, [0, 6], [1, 1.05]);
  const lit = interpolate(t, [0, 2.2, 6], [0.25, 1, 0.9], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.stone }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '55% 40%' }}>
        <GlassScene t={t} lit={lit} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 244, display: 'flex', gap: 22, fontFamily: fonts.display, fontWeight: 800, fontSize: 40, letterSpacing: '0.05em', color: C.cream }}>
        {TEXT.hud.map((s, i) => (
          <span key={i} style={{ color: i === 2 ? C.amber : C.cream }}>
            {i ? '· ' : ''}
            {s}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 60, width: 870, top: 1290, textAlign: 'center', fontFamily: fonts.display, fontWeight: 900, fontSize: 112, letterSpacing: '0.03em', lineHeight: 1, color: C.cream, textShadow: '0 6px 30px rgba(0,0,0,.8)' }}>
        {TEXT.sub}
      </div>
    </AbsoluteFill>
  );
};
