import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, figurePath, nearTransform, snow, type HookState } from './scene';

// Облик «вырезанная бумага»: всё в кадре — листы бумаги, вырезанные ножницами и положенные друг на друга. Ночь —
// семейство синих бумаг, красная только фигура; золото — один акцент (шкала рации). Объём — только тенью листа на
// нижнем слое, без контуров и градиентов; движение — шагами по 12 кадров в секунду.

export const PAPERCUT_PALETTE = {
  far: '#3b4f86', sky: '#2c3b6b', wall: '#1d2748', near: '#141b36', table: '#0f142b',
  snow: '#e9e3d3', red: '#d2201f', redD: '#a51718', gold: '#e2b23a', cream: '#f3ead6',
};
const C = PAPERCUT_PALETTE;

/** Мир сцены-хука из бумаги (без ленты с репликой — это рамка). */
export const PapercutScene: React.FC<HookState> = ({ t: tIn, there = 1, near = 0, dial: dialOn = 1, lit = 1, eyes = 1, p = 'pc' }) => {
  const t = Math.floor(tIn * 12) / 12;
  const { win, radio, dial, antenna, table, fig } = G;
  const flakes = snow(46, 13, t, win);
  const sway = Math.sin(t * 1.2) * 4;
  const paper = (extra?: React.CSSProperties): React.CSSProperties => ({ filter: `url(#${p}-cut) url(#${p}-shadow)`, ...extra });
  const figT = `translate(${sway} 0) ${nearTransform(near) ?? ''}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: C.sky }}>
      <defs>
        {/* край, вырезанный рукой: лёгкая неровность */}
        <filter id={`${p}-cut`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={10} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* толщина бумаги: плотная тень на слое ниже и светлая кромка сверху слева */}
        <filter id={`${p}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx={-1.5} dy={-1.5} stdDeviation={0.4} floodColor="#fff" floodOpacity={0.22} />
          <feDropShadow dx={7} dy={10} stdDeviation={7} floodColor="#03040c" floodOpacity={0.6} />
        </filter>
        <filter id={`${p}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={3} seed={6} />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.1 -0.3" />
        </filter>
        <filter id={`${p}-fibre`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.3" numOctaves={2} seed={12} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 -0.24" />
        </filter>
        <clipPath id={`${p}-win`}>
          <rect x={win.x - 30} y={win.y - 30} width={win.w + 60} height={win.h + 60} />
        </clipPath>
      </defs>

      {/* за окном: дальние слои светлее, холмы снега, снежинки-ромбы */}
      <g clipPath={`url(#${p}-win)`}>
        <path d={`M 0 ${win.y + 300} L 260 ${win.y + 250} L 420 ${win.y + 290} L 640 ${win.y + 230} L 860 ${win.y + 280} L ${W} ${win.y + 250} V ${H} H 0 Z`} fill={C.far} style={paper()} />
        <path d={`M 0 ${win.y + 470} L 300 ${win.y + 440} L 520 ${win.y + 468} L 760 ${win.y + 432} L ${W} ${win.y + 462} V ${H} H 0 Z`} fill={C.snow} style={paper()} />
        {/* без света — тёмный лист поверх дальних слоёв */}
        <rect x={win.x - 30} y={win.y - 30} width={win.w + 60} height={win.h + 60} fill={C.near} opacity={0.6 * (1 - lit)} />
        {flakes.map((f, i) => (
          <rect key={i} x={f.x - f.r} y={f.y - f.r} width={f.r * 2} height={f.r * 2} fill={C.snow} transform={`rotate(45 ${f.x} ${f.y})`} />
        ))}
        {/* фигура: красный лист с прорезью-контуром внутри */}
        <g opacity={there}>
          <g transform={figT} style={paper()}>
            <circle cx={fig.cx} cy={fig.head} r={fig.r} fill={C.red} />
            <path d={figurePath()} fill={C.red} />
          </g>
          <g transform={figT} fill="none" stroke={C.redD} strokeWidth={5} strokeLinejoin="round">
            <circle cx={fig.cx} cy={fig.head} r={fig.r - 15} />
            <path d={`M ${fig.cx - 100} ${win.y + win.h} Q ${fig.cx - 100} ${fig.shoulders + 34} ${fig.cx - 52} ${fig.shoulders + 22} L ${fig.cx + 52} ${fig.shoulders + 22} Q ${fig.cx + 100} ${fig.shoulders + 34} ${fig.cx + 100} ${win.y + win.h}`} />
            {/* глаза — два серпа, без «островов» */}
            <path d={`M ${fig.cx - 30} ${fig.head} q 11 -11 22 0 M ${fig.cx + 8} ${fig.head} q 11 -11 22 0`} stroke={C.sky} strokeWidth={6} strokeLinecap="round" opacity={eyes} />
          </g>
        </g>
      </g>

      {/* стена: тёмный лист с вырезанным окном; переплёт — тот же лист */}
      <path
        d={`M -40 -40 H ${W + 40} V ${H + 40} H -40 Z
            M ${win.x} ${win.y} V ${win.y + 204} H ${win.x + win.w / 2 - 7} V ${win.y} Z
            M ${win.x + win.w / 2 + 7} ${win.y} V ${win.y + 204} H ${win.x + win.w} V ${win.y} Z
            M ${win.x} ${win.y + 218} V ${win.y + win.h} H ${win.x + win.w / 2 - 7} V ${win.y + 218} Z
            M ${win.x + win.w / 2 + 7} ${win.y + 218} V ${win.y + win.h} H ${win.x + win.w} V ${win.y + 218} Z`}
        fillRule="evenodd"
        fill={C.wall}
        style={paper()}
      />
      {/* зубчатый бордюр под потолком — язык народной вырезки */}
      <path d={`M -40 -40 H ${W + 40} V 200 ${Array.from({ length: 28 }, (_, i) => `L ${W + 40 - i * 42 - 21} 232 L ${W + 40 - (i + 1) * 42} 200`).join(' ')} Z`} fill={C.near} style={paper()} />
      <path d={`M ${win.x - 34} ${win.y + win.h + 6} H ${win.x + win.w + 34} V ${win.y + win.h + 40} H ${win.x - 34} Z`} fill={C.near} style={paper()} />

      {/* стол и рация */}
      <path d={`M -40 ${table} H ${W + 40} V ${H + 40} H -40 Z`} fill={C.table} style={paper()} />
      <path d={`M ${antenna.x1 - 5} ${antenna.y1} L ${antenna.x2 - 5} ${antenna.y2} L ${antenna.x2 + 7} ${antenna.y2 + 4} L ${antenna.x1 + 9} ${antenna.y1} Z`} fill={C.far} style={paper()} />
      <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} fill={C.far} style={paper()} />
      <g fill={C.near}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${radio.x + 40} ${radio.y + 46 + i * 26} l 180 0 l -8 9 l -164 0 Z`} />
        ))}
      </g>
      <circle cx={dial.x} cy={dial.y} r={dial.r + 12} fill={C.near} />
      <circle cx={dial.x} cy={dial.y} r={dial.r} fill={dialOn >= 0.5 ? C.gold : C.far} style={paper()} />

      {/* фактура бумаги поверх всего */}
      <rect width={W} height={H} filter={`url(#${p}-grain)`} opacity={0.16} style={{ mixBlendMode: 'soft-light' }} />
      <rect width={W} height={H} filter={`url(#${p}-fibre)`} opacity={0.2} style={{ mixBlendMode: 'soft-light' }} />
    </svg>
  );
};

/** Лента с «ласточкиным хвостом» — где живёт реплика в бумаге. */
export const PaperRibbon: React.FC<{ top?: number; color?: string; p?: string }> = ({ top = 1262, color = C.redD, p = 'pcr' }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
    <defs>
      <filter id={`${p}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx={7} dy={10} stdDeviation={7} floodColor="#03040c" floodOpacity={0.6} />
      </filter>
    </defs>
    <path d={`M 70 ${top} H 920 L 890 ${top + 83} L 920 ${top + 166} H 70 L 100 ${top + 83} Z`} fill={color} filter={`url(#${p}-shadow)`} />
  </svg>
);

/** Образец облика для знакомства (`look-papercut`). */
export const PapercutHook: React.FC = () => {
  const tRaw = useTime();
  const t = Math.floor(tRaw * 12) / 12;
  const zoom = interpolate(t, [0, 6], [1, 1.05]);
  return (
    <AbsoluteFill style={{ background: C.sky }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '55% 40%' }}>
        <PapercutScene t={tRaw} />
        <PaperRibbon />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 246, display: 'flex', gap: 22, fontFamily: fonts.display, fontWeight: 800, fontSize: 40, letterSpacing: '0.05em', color: C.cream }}>
        {TEXT.hud.map((s, i) => (
          <span key={i} style={{ color: i === 2 ? C.gold : C.cream }}>
            {i ? '· ' : ''}
            {s}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 70, width: 850, top: 1296, textAlign: 'center', fontFamily: fonts.serif, fontWeight: 700, fontSize: 92, lineHeight: 1, letterSpacing: '0.02em', color: C.cream }}>
        {TEXT.sub}
      </div>
    </AbsoluteFill>
  );
};
