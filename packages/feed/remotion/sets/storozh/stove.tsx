// Декорации библиотеки «Ленты». Мир «Сторожа» из серии 2 теста series-feed (src/episodes/storozh-02/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { H, W, rng } from '../../looks/scene';
import { C, Defs, Stone } from './room';

// Новый мир серии 2 — печь. Остальные декорации (комната с окном, дверь) берутся из серии 1.
// Огонь — те же куски стекла, что в окне: светится, пока горит (`fire` 0…1), и гаснет вместе с дровами.

const FLAMES = (() => {
  const r = rng(77);
  const out: { d: string; hue: number; l: number }[] = [];
  const x0 = 380;
  const y0 = 1180;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = x0 + col * 64 + (row % 2 ? 32 : 0);
      const y = y0 - row * 70;
      const j = () => (r() - 0.5) * 14;
      out.push({ d: `M ${x + j()} ${y + j()} L ${x + 34 + j()} ${y - 80 + j()} L ${x + 66 + j()} ${y + j()} Z`, hue: 18 + r() * 28, l: 42 + r() * 22 - row * 6 });
    }
  }
  return out;
})();

export const StoveRoom: React.FC<{ fire: number; t: number; p?: string }> = ({ fire, t, p = 'sr' }) => {
  const flick = fire * (0.82 + 0.18 * Math.sin(t * 11) * Math.sin(t * 3.7));
  const floor = 1500;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs p={p} />
      <defs>
        <radialGradient id={`${p}-fire`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff9a3c" stopOpacity={0.7} />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${p}-mouth`}>
          <path d="M 360 1210 V 1010 Q 540 900 720 1010 V 1210 Z" />
        </clipPath>
      </defs>
      <Stone p={p} />
      <rect x={0} y={floor} width={W} height={H - floor} fill="#141210" />
      <rect x={0} y={floor} width={W} height={8} fill={C.stoneL} />

      {/* труба и корпус печи: тёмное железо в свинце */}
      <rect x={470} y={0} width={140} height={720} fill="#1d1b19" stroke={C.lead} strokeWidth={9} />
      <rect x={452} y={640} width={176} height={46} fill="#2b2927" stroke={C.lead} strokeWidth={8} />
      <path d={`M 250 ${floor} V 800 Q 540 660 830 800 V ${floor} Z`} fill="#1a1816" stroke={C.lead} strokeWidth={12} />
      {[860, 1290].map((y) => (
        <rect key={y} x={256} y={y} width={568} height={38} fill="#2b2927" stroke={C.lead} strokeWidth={7} />
      ))}
      <rect x={300} y={1340} width={480} height={90} rx={8} fill="#100f0e" stroke={C.lead} strokeWidth={8} />

      {/* топка: огонь из кусков стекла; гаснет — остаётся тёмное стекло и одно тлеющее полено */}
      <path d="M 360 1210 V 1010 Q 540 900 720 1010 V 1210 Z" fill="#0a0806" />
      <g clipPath={`url(#${p}-mouth)`}>
        <g opacity={0.12 + 0.88 * flick}>
          {FLAMES.map((f, i) => (
            <path key={i} d={f.d} fill={`hsl(${f.hue} 92% ${f.l}%)`} stroke={C.lead} strokeWidth={6} strokeLinejoin="round" />
          ))}
        </g>
        <rect x={400} y={1168} width={280} height={40} rx={18} fill={`hsl(14 70% ${10 + 22 * fire}%)`} stroke={C.lead} strokeWidth={7} />
      </g>
      <g filter={`url(#${p}-bloom)`} opacity={0.75 * flick} style={{ mixBlendMode: 'screen' }}>
        {FLAMES.map((f, i) => (
          <path key={i} d={f.d} fill={`hsl(${f.hue} 92% ${f.l}%)`} />
        ))}
      </g>
      <path d="M 360 1210 V 1010 Q 540 900 720 1010 V 1210 Z" fill="none" stroke={C.lead} strokeWidth={16} />
      <ellipse cx={540} cy={1120} rx={640} ry={700} fill={`url(#${p}-fire)`} opacity={flick} style={{ mixBlendMode: 'screen' }} />

      {/* у печи пусто: от поленницы остались щепки */}
      <g stroke={C.lead} strokeWidth={5} fill="#3a2a1c">
        <path d="M 868 1492 l 70 -14 l 6 12 l -70 14 Z" />
        <path d="M 930 1500 l 44 -6 l 3 9 l -44 6 Z" />
      </g>
    </svg>
  );
};
