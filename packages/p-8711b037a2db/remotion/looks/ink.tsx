import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, figurePath, nearTransform, snow, type HookState } from './scene';

// Облик «тушь»: тёплая бумага, тушь в пяти тонах умножением, пустая бумага — метель за окном, один киноварный
// акцент — шкала рации. Контуров нет: формы — размытые заливки с неровным краем.

export const INK_PALETTE = { paper: '#F2ECDE', ink: '#1b1a18', red: '#B02E22' };
const { paper: PAPER, ink: INK, red: RED } = INK_PALETTE;

/** Мир сцены-хука в туши: стена, окно, фигура за окном, стол, рация. */
export const InkScene: React.FC<HookState> = ({ t, there = 1, near = 0, dial: dialOn = 1, lit = 1, p = 'ink' }) => {
  const { win, radio, dial, antenna, table, fig } = G;
  const flakes = snow(90, 7, t, win);
  const glow = dialOn * (0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 2.3));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: PAPER }}>
      <defs>
        <filter id={`${p}-paper`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={4} seed={3} />
          <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.33  0 0 0 0 0.2  0 0 0 0.55 -0.16" />
        </filter>
        <filter id={`${p}-fibre`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.04" numOctaves={2} seed={11} />
          <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.5 -0.2" />
        </filter>
        <filter id={`${p}-wet`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={3} seed={5} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={70} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={9} />
        </filter>
        <filter id={`${p}-mass`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={9} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={26} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={3.2} />
        </filter>
        <filter id={`${p}-dry`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.25 0.9" numOctaves={2} seed={2} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={9} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.02 1.4" numOctaves={1} seed={4} result="b" />
          <feColorMatrix in="b" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -0.75" result="gaps" />
          <feComposite in="d" in2="gaps" operator="out" />
        </filter>
        <clipPath id={`${p}-win`}>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} />
        </clipPath>
      </defs>

      <rect width={W} height={H} filter={`url(#${p}-paper)`} />
      <rect width={W} height={H} filter={`url(#${p}-fibre)`} opacity={0.5} />

      <g style={{ mixBlendMode: 'multiply' }}>
        {/* стена: светлая заливка, окно остаётся бумагой */}
        <path
          d={`M -80 -80 H ${W + 80} V ${H + 80} H -80 Z M ${win.x} ${win.y} V ${win.y + win.h} H ${win.x + win.w} V ${win.y} Z`}
          fillRule="evenodd"
          fill={INK}
          opacity={0.36}
          filter={`url(#${p}-wet)`}
        />
        {/* углы темнее: свет только от окна */}
        <path d={`M -80 -80 H ${W + 80} V 330 Q 540 150 -80 330 Z`} fill={INK} opacity={0.3} filter={`url(#${p}-wet)`} />
        <path d={`M -80 700 Q 150 1000 120 ${H + 80} H -80 Z`} fill={INK} opacity={0.28} filter={`url(#${p}-wet)`} />
        <path d={`M ${W + 80} 600 Q 900 1000 960 ${H + 80} H ${W + 80} Z`} fill={INK} opacity={0.28} filter={`url(#${p}-wet)`} />

        {/* за окном: полосы метели и фигура; без света — окно залито тушью */}
        <g clipPath={`url(#${p}-win)`}>
          <rect x={win.x - 40} y={win.y - 40} width={win.w + 80} height={win.h + 80} fill={INK} opacity={0.55 * (1 - lit)} filter={`url(#${p}-wet)`} />
          <path d={`M ${win.x - 40} ${win.y + 400} Q 540 ${win.y + 330} ${win.x + win.w + 40} ${win.y + 430} V ${win.y + win.h + 40} H ${win.x - 40} Z`} fill={INK} opacity={0.16} filter={`url(#${p}-wet)`} />
          <g opacity={there} transform={nearTransform(near)}>
            <g filter={`url(#${p}-mass)`}>
              <circle cx={fig.cx} cy={fig.head} r={fig.r} fill={INK} opacity={0.9} />
              <path d={figurePath()} fill={INK} opacity={0.84} />
            </g>
            {/* тёмный край «нагруженного» мазка — контур без линии */}
            <path d={`M ${fig.cx - 118} ${win.y + win.h} Q ${fig.cx - 126} ${fig.shoulders + 30} ${fig.cx - 64} ${fig.shoulders + 4}`} stroke={INK} strokeWidth={26} strokeLinecap="round" fill="none" opacity={0.6} filter={`url(#${p}-mass)`} />
          </g>
          {flakes.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r={f.r * 0.8} fill={INK} opacity={0.22} />
          ))}
        </g>

        {/* рама: сухая кисть */}
        <g stroke={INK} fill="none" strokeLinecap="round" filter={`url(#${p}-dry)`} opacity={0.92}>
          <path d={`M ${win.x - 6} ${win.y - 4} H ${win.x + win.w + 10}`} strokeWidth={22} />
          <path d={`M ${win.x - 2} ${win.y - 8} V ${win.y + win.h + 12}`} strokeWidth={20} />
          <path d={`M ${win.x + win.w + 2} ${win.y - 6} V ${win.y + win.h + 10}`} strokeWidth={18} />
          <path d={`M ${win.x - 22} ${win.y + win.h + 6} H ${win.x + win.w + 26}`} strokeWidth={30} />
          <path d={`M ${win.x + win.w / 2} ${win.y} V ${win.y + win.h}`} strokeWidth={12} />
          <path d={`M ${win.x} ${win.y + 210} H ${win.x + win.w}`} strokeWidth={11} />
        </g>

        {/* стол и рация */}
        <path d={`M -80 ${table} Q 540 ${table - 26} ${W + 80} ${table + 6} V ${H + 80} H -80 Z`} fill={INK} opacity={0.62} filter={`url(#${p}-wet)`} />
        <path d={`M -80 ${table + 260} Q 540 ${table + 220} ${W + 80} ${table + 280} V ${H + 80} H -80 Z`} fill={INK} opacity={0.4} filter={`url(#${p}-wet)`} />
        <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} rx={18} fill={INK} opacity={0.86} filter={`url(#${p}-mass)`} />
        <path d={`M ${antenna.x1} ${antenna.y1} L ${antenna.x2} ${antenna.y2}`} stroke={INK} strokeWidth={9} strokeLinecap="round" filter={`url(#${p}-dry)`} />
      </g>

      {/* решётка динамика — процарапано до бумаги */}
      <g stroke={PAPER} strokeWidth={5} strokeLinecap="round" opacity={0.5} filter={`url(#${p}-dry)`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${radio.x + 44} ${radio.y + 50 + i * 26} H ${radio.x + 220}`} />
        ))}
      </g>
      {/* единственный цвет в кадре */}
      <circle cx={dial.x} cy={dial.y} r={dial.r + 26} fill={RED} opacity={0.16 * glow} filter={`url(#${p}-wet)`} />
      <circle cx={dial.x} cy={dial.y} r={dial.r} fill={RED} opacity={0.3 + 0.62 * dialOn} filter={`url(#${p}-mass)`} />
    </svg>
  );
};

/** Образец облика для знакомства (`look-ink`): сцена-хук с наездом, плашкой и репликой. */
export const InkHook: React.FC = () => {
  const t = useTime();
  const zoom = interpolate(t, [0, 6], [1, 1.05]);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '55% 40%' }}>
        <InkScene t={t} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 244, display: 'flex', gap: 22, fontFamily: fonts.display, fontWeight: 800, fontSize: 40, letterSpacing: '0.05em', color: INK }}>
        {TEXT.hud.map((s, i) => (
          <span key={i} style={{ opacity: i === 2 ? 1 : 0.82 }}>
            {i ? '· ' : ''}
            {s}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 60, width: 870, top: 1290, textAlign: 'center', fontFamily: fonts.display, fontWeight: 900, fontSize: 112, letterSpacing: '0.03em', lineHeight: 1, color: PAPER }}>
        {TEXT.sub}
      </div>
    </AbsoluteFill>
  );
};
