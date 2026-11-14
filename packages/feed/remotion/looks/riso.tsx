import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, figurePath, nearTransform, snow, type HookState } from './scene';

// Облик «ризограф»: две краски на тёплой бумаге, каждая — своя «форма» со сдвигом приводки; краски умножаются
// (синяя + красная ≈ чёрная), полутона — растром, контуров нет. Сериал «Компас» печатает тем же способом тремя
// красками (бирюза, оранжевый, жёлтый) — sets/kompas/kit.tsx.

export const RISO_PALETTE = { paper: '#F4EEE2', blue: '#3D5588', red: '#FF665E' };
const { paper: PAPER, blue: BLUE, red: RED } = RISO_PALETTE;

const Dots: React.FC<{ id: string; ink: string; r: number; angle: number }> = ({ id, ink, r, angle }) => (
  <pattern id={id} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
    <circle cx={7} cy={7} r={r} fill={ink} />
  </pattern>
);

/** Мир сцены-хука на ризографе. */
export const RisoScene: React.FC<HookState> = ({ t, there = 1, near = 0, dial: dialOn = 1, lit = 1, p = 'riso' }) => {
  const { win, radio, dial, antenna, table, fig } = G;
  const flakes = snow(70, 21, t, win);
  const pulse = 1 + 0.06 * Math.sin(t * 7);
  const plate: React.CSSProperties = { mixBlendMode: 'multiply' };
  const figT = nearTransform(near);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: PAPER }}>
      <defs>
        <Dots id={`${p}-b30`} ink={BLUE} r={3.4} angle={15} />
        <Dots id={`${p}-b60`} ink={BLUE} r={5.2} angle={15} />
        <Dots id={`${p}-r30`} ink={RED} r={3.4} angle={75} />
        <Dots id={`${p}-r60`} ink={RED} r={5.3} angle={75} />
        <filter id={`${p}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={8} />
          <feColorMatrix values="0 0 0 0 0.96  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 1.5 -0.82" />
        </filter>
        <filter id={`${p}-streak`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.002 0.09" numOctaves={2} seed={3} />
          <feColorMatrix values="0 0 0 0 0.96  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0.9 -0.42" />
        </filter>
        <clipPath id={`${p}-wall`}>
          <path clipRule="evenodd" d={`M 0 0 H ${W} V ${H} H 0 Z M ${win.x} ${win.y} V ${win.y + win.h} H ${win.x + win.w} V ${win.y} Z`} />
        </clipPath>
        <clipPath id={`${p}-win`}>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} />
        </clipPath>
      </defs>

      {/* форма 1 — синяя: стена, небо растром, фигура, рама, стол */}
      <g style={plate}>
        <path d={`M 0 0 H ${W} V ${H} H 0 Z M ${win.x} ${win.y} V ${win.y + win.h} H ${win.x + win.w} V ${win.y} Z`} fillRule="evenodd" fill={BLUE} />
        <g clipPath={`url(#${p}-win)`}>
          <rect x={win.x} y={win.y} width={win.w} height={330} fill={`url(#${p}-b60)`} />
          <rect x={win.x} y={win.y + 330} width={win.w} height={130} fill={`url(#${p}-b30)`} />
          {/* без света небо — сплошная краска */}
          <rect x={win.x} y={win.y} width={win.w} height={win.h - 96} fill={BLUE} opacity={0.75 * (1 - lit)} />
          <g opacity={there} transform={figT}>
            <circle cx={fig.cx} cy={fig.head} r={fig.r} fill={BLUE} />
            <path d={figurePath()} fill={BLUE} />
          </g>
        </g>
        <g stroke={BLUE} fill="none">
          <rect x={win.x - 9} y={win.y - 9} width={win.w + 18} height={win.h + 18} strokeWidth={22} />
          <path d={`M ${win.x + win.w / 2} ${win.y} V ${win.y + win.h} M ${win.x} ${win.y + 210} H ${win.x + win.w}`} strokeWidth={12} />
        </g>
        <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} rx={14} fill={`url(#${p}-b60)`} />
      </g>

      {/* форма 2 — красная, сдвинута: свечение шкалы растром, рация, фигура (с синей даёт почти чёрный) */}
      <g style={plate} transform="translate(6 -5) rotate(0.18 540 960)">
        <g clipPath={`url(#${p}-wall)`} opacity={dialOn}>
          <circle cx={dial.x} cy={dial.y} r={430 * pulse} fill={`url(#${p}-r30)`} />
          <circle cx={dial.x} cy={dial.y} r={230 * pulse} fill={`url(#${p}-r60)`} />
        </g>
        <rect x={radio.x} y={radio.y} width={radio.w} height={radio.h} rx={14} fill={RED} />
        <path d={`M ${antenna.x1} ${antenna.y1} L ${antenna.x2} ${antenna.y2}`} stroke={RED} strokeWidth={10} strokeLinecap="round" />
        <rect x={0} y={table} width={W} height={H - table} fill={`url(#${p}-r30)`} />
        <g clipPath={`url(#${p}-win)`}>
          <g opacity={there} transform={figT}>
            <circle cx={fig.cx} cy={fig.head} r={fig.r} fill={RED} />
            <path d={figurePath()} fill={RED} />
          </g>
        </g>
      </g>

      {/* выворотки до бумаги: снег, шкала, решётка, край стола */}
      <g clipPath={`url(#${p}-win)`} fill={PAPER}>
        {flakes.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.r} />
        ))}
        <rect x={win.x} y={win.y + win.h - 96} width={win.w} height={96} />
        <g opacity={there} transform={figT}>
          <path d={figurePath()} fill={BLUE} style={plate} />
          <path d={figurePath()} fill={RED} style={plate} transform="translate(6 -5)" />
        </g>
      </g>
      <circle cx={dial.x} cy={dial.y} r={dial.r} fill={PAPER} opacity={0.35 + 0.65 * dialOn} />
      <path d={`M ${dial.x} ${dial.y} l 20 -18`} stroke={BLUE} strokeWidth={7} strokeLinecap="round" />
      <g stroke={PAPER} strokeWidth={7} strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${radio.x + 44} ${radio.y + 48 + i * 26} H ${radio.x + 220}`} />
        ))}
      </g>
      <rect x={0} y={table} width={W} height={7} fill={PAPER} opacity={0.85} />

      {/* несовершенство печати: проколы в заливках и полосы по ходу листа */}
      <rect width={W} height={H} filter={`url(#${p}-grain)`} opacity={0.55} />
      <rect width={W} height={H} filter={`url(#${p}-streak)`} opacity={0.35} />
    </svg>
  );
};

/** Образец облика для знакомства (`look-riso`). */
export const RisoHook: React.FC = () => {
  const t = useTime();
  const zoom = interpolate(t, [0, 6], [1, 1.05]);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '55% 40%' }}>
        <RisoScene t={t} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 64, top: 244, display: 'flex', gap: 22, fontFamily: fonts.display, fontWeight: 800, fontSize: 40, letterSpacing: '0.05em', color: PAPER }}>
        {TEXT.hud.map((s, i) => (
          <span key={i}>
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
