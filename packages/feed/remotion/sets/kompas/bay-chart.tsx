// Декорации библиотеки «Ленты». Мир «Компаса» из серии 2 теста series-feed (src/episodes/kompas-02/parts.tsx) — как есть,
// чтобы старые и новые серии сериала рисовались одинаково. Единый вид для серии данными — в ./index.tsx.

import React from 'react';
import { fonts } from '../../lib/kit';
import { H, W, rng } from '../../looks/scene';
import { Defs, Finish, INK, Plate } from './ship';

// Новый мир серии 2 — карта бухты (ризограф): остров, гряда рифов с узким проходом, бухта с пароходом за рифами,
// два пути и таблица приливов в углу. Таблица — улика развилки: сейчас 06:20, отлив в 07:00 — вода уходит.

const ISLAND = 'M 640 520 Q 820 420 960 560 Q 1040 760 980 980 Q 900 1120 760 1060 Q 640 960 660 780 Q 610 640 640 520 Z';

const REEFS = (() => {
  const r = rng(131);
  const out: { x: number; y: number; s: number; a: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 60 + r() * 520;
    if (x > 300 && x < 360) continue; // проход
    out.push({ x, y: 820 + Math.sin(x / 70) * 40 + r() * 50, s: 12 + r() * 14, a: r() * 90 });
  }
  return out;
})();

/**
 * `pass` 0…1 — пунктир через проход; `around` 0…1 — пунктир вокруг острова; `table` 0…1 — подсветка таблицы приливов.
 */
export const BayChart: React.FC<{ pass: number; around: number; table: number; night?: number; p?: string }> = ({ pass, around, table, night = 0, p = 'bc' }) => {
  const ship = { x: 330, y: 1500 };
  const wreck = { x: 300, y: 590 };
  const t = { x: 70, y: 1010, w: 330, h: 190 + 56 * night };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, background: INK.paper }}>
      <Defs p={p} />
      <Plate>
        <rect width={W} height={H} fill={`url(#${p}-t30)`} opacity={0.55} />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M ${i * 135} 0 V ${H} M 0 ${i * 240} H ${W}`} stroke={INK.teal} strokeWidth={3} />
        ))}
        <path d={ISLAND} fill={INK.teal} />
        {/* берег бухты сверху */}
        <path d="M -20 -20 H 700 V 420 Q 520 490 300 460 Q 120 440 -20 500 Z" fill={INK.teal} />
        {/* путь вокруг острова */}
        <path d={`M ${ship.x} ${ship.y} C 620 1420 1060 1300 1040 820 C 1030 520 900 330 ${wreck.x + 60} ${wreck.y + 30}`} fill="none" stroke={INK.teal} strokeWidth={11} strokeDasharray="26 18" opacity={around} />
        {/* таблица приливов: рамка */}
        <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="none" stroke={INK.teal} strokeWidth={6} />
      </Plate>
      <Plate dx={5} dy={-4}>
        <path d={ISLAND} fill={`url(#${p}-o30)`} />
        <path d="M -20 -20 H 700 V 420 Q 520 490 300 460 Q 120 440 -20 500 Z" fill={`url(#${p}-o30)`} />
        {REEFS.map((f, i) => (
          <path key={i} d={`M ${f.x} ${f.y - f.s} L ${f.x + f.s * 0.6} ${f.y} L ${f.x} ${f.y + f.s * 0.5} L ${f.x - f.s * 0.7} ${f.y} Z`} fill={INK.orange} transform={`rotate(${f.a} ${f.x} ${f.y})`} />
        ))}
        {/* пароход на дне бухты — крест */}
        <path d={`M ${wreck.x - 34} ${wreck.y - 34} L ${wreck.x + 34} ${wreck.y + 34} M ${wreck.x + 34} ${wreck.y - 34} L ${wreck.x - 34} ${wreck.y + 34}`} stroke={INK.orange} strokeWidth={16} strokeLinecap="round" />
        {/* путь через проход — прямо */}
        <path d={`M ${ship.x} ${ship.y} L ${ship.x} ${ship.y - (ship.y - wreck.y - 40) * pass}`} stroke={INK.orange} strokeWidth={12} strokeDasharray="30 20" />
        <path d={`M ${ship.x} ${ship.y - 40} L ${ship.x + 30} ${ship.y + 40} L ${ship.x - 30} ${ship.y + 40} Z`} fill={INK.orange} />
        <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={`url(#${p}-o30)`} opacity={table} />
      </Plate>
      <Plate dx={-3} dy={3}>
        <circle cx={wreck.x} cy={wreck.y} r={90} fill={`url(#${p}-y60)`} />
        <circle cx={ship.x} cy={ship.y + 10} r={70} fill={`url(#${p}-y60)`} />
      </Plate>
      {/* надписи: ризограф печатает их той же краской */}
      <g style={{ fontFamily: fonts.display, fontWeight: 900, letterSpacing: '0.05em', mixBlendMode: 'multiply' }}>
        <text x={wreck.x} y={wreck.y + 90} textAnchor="middle" fontSize={34} fill={INK.orange}>
          ПАРОХОД
        </text>
        <text x={200} y={960} textAnchor="middle" fontSize={34} fill={INK.orange}>
          РИФЫ
        </text>
        <text x={820} y={800} textAnchor="middle" fontSize={34} fill={INK.paper}>
          ОСТРОВ
        </text>
        <text x={ship.x + 54} y={ship.y + 90} fontSize={30} fill={INK.teal}>
          МЫ
        </text>
        <text x={t.x + 22} y={t.y + 52} fontSize={30} fill={INK.teal}>
          ПРИЛИВЫ
        </text>
        <text x={t.x + 22} y={t.y + 112} fontSize={36} fill={INK.teal}>
          ОТЛИВ · 07:00
        </text>
        <text x={t.x + 22} y={t.y + 164} fontSize={36} fill={INK.teal}>
          ПРИЛИВ · 13:10
        </text>
        <text x={t.x + 22} y={t.y + 216} fontSize={36} fill={INK.teal} opacity={night}>
          ПРИЛИВ · 01:30
        </text>
      </g>
      <Finish p={p} />
    </svg>
  );
};
