import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, rng, snow, type HookState } from './scene';

// Облик «терминал»: один янтарный экран, картинка — настоящие символы на сетке, выбранные по плотности; тёмное —
// пусто, яркое — плотные знаки. Один второй цвет — холодный белый у шкалы рации.
// Реплика — вывод терминала: строка LOG внизу, печатается по буквам.

export const ASCII_PALETTE = { amber: '#ffb000', ice: '#dff4ff', bg: '#0d0803' };
const { amber: AMBER, ice: ICE, bg: BG } = ASCII_PALETTE;
const COLS = 54;
const CW = W / COLS;
const CH = CW * 1.9;
const ROWS = Math.ceil(H / CH);
const RAMP = ' .\'`:-~=+*xX#%@';
const NB = ' ';

type Box = { x: number; y: number; w: number; h: number };
const inRect = (x: number, y: number, r: Box, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/** Точка внутри фигуры; `k` — фигура крупнее (подошла), масштаб от подоконника. */
function inFigure(x0: number, y0: number, grow: number, k: number): boolean {
  const { cx, head, r, shoulders, w } = G.fig;
  const b = G.win.y + G.win.h;
  const x = cx + (x0 - cx) / k;
  const y = b + (y0 - b) / k;
  const g = grow / k;
  if (Math.hypot(x - cx, y - head) < r + g) return true;
  if (y > head && y < shoulders && Math.abs(x - cx) < 24 + g) return true;
  if (y >= shoulders - g) {
    const half = Math.min(w / 2, 62 + (y - shoulders) * 1.6);
    return Math.abs(x - cx) < half + g;
  }
  return false;
}

type Look = { there: number; near: number; dial: number; lit: number };

/** Яркость точки сцены 0…1 и признак «второй цвет». */
function shade(x: number, y: number, flakes: { x: number; y: number }[], t: number, s: Look): [number, boolean] {
  const { win, radio, dial, antenna, table } = G;
  const on = s.dial >= 0.5;
  if (Math.hypot(x - dial.x, y - dial.y) < dial.r + 8) return on ? [1, true] : [0.3, false];
  if (inRect(x, y, radio)) {
    const edge = !inRect(x, y, { x: radio.x + CW, y: radio.y + CH, w: radio.w - 2 * CW, h: radio.h - 2 * CH });
    if (edge) return [0.95, false];
    if (x < radio.x + 240 && Math.floor((y - radio.y) / CH) % 2 === 1) return [0.62, false];
    return [0.22, false];
  }
  const ax = antenna.x1 + ((antenna.x2 - antenna.x1) * (antenna.y1 - y)) / (antenna.y1 - antenna.y2);
  if (y < antenna.y1 && y > antenna.y2 && Math.abs(x - ax) < CW * 0.6 && !inRect(x, y, win)) return [0.8, false];
  if (y >= table) return [y < table + CH ? 0.75 : 0.05 + 0.05 * Math.sin(x * 0.02 + y * 0.013), false];
  if (inRect(x, y, win)) {
    const k = 1 + 0.45 * s.near;
    if (Math.abs(x - (win.x + win.w / 2)) < CW * 0.55 || Math.abs(y - (win.y + 210)) < CH * 0.5) return [0.9, false];
    if (s.there >= 0.5 && inFigure(x, y, 0, k)) return [0, false];
    if (s.there >= 0.5 && inFigure(x, y, CW * 0.9, k)) return [1, false];
    if (y > win.y + win.h - 96) return [0.78, false];
    for (const f of flakes) if (Math.abs(f.x - x) < CW * 0.5 && Math.abs(f.y - y) < CH * 0.5) return [0.85, false];
    return [0.18 + 0.32 * s.lit + 0.08 * Math.sin(y * 0.02 + t * 0.6), false];
  }
  if (inRect(x, y, win, CW * 1.2)) return [0.95, false];
  // свечение шкалы на стене
  const glow = on ? Math.max(0, 1 - Math.hypot(x - dial.x, y - dial.y) / 420) : 0;
  return [0.02 + glow * glow * 0.45, false];
}

/** Мир сцены-хука символами (без строки статуса и строки LOG — это рамка). */
export const AsciiScene: React.FC<HookState & { glass?: boolean }> = ({ t, there = 1, near = 0, dial = 1, lit = 1, glass = true }) => {
  const flakes = snow(40, 3, Math.floor(t * 10) / 10, G.win);
  const hash = rng(99);
  const flick = 1 - 0.012 * Math.sin(t * 50);
  const s = { there, near, dial, lit };

  const rows: { main: string; ice: string }[] = [];
  for (let r = 0; r < ROWS; r++) {
    let main = '';
    let ice = '';
    for (let c = 0; c < COLS; c++) {
      const [b, second] = shade((c + 0.5) * CW, (r + 0.5) * CH, flakes, t, s);
      const v = Math.min(1, Math.max(0, b + (hash() - 0.5) * 0.07));
      const ch = v < 0.06 ? NB : RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))]!.replace(' ', NB);
      main += second ? NB : ch;
      ice += second ? '@' : NB;
    }
    rows.push({ main, ice });
  }
  const rowText = (str: string, i: number, fill: string, shadow: string) => (
    <text key={i} x={0} y={(i + 0.78) * CH} textLength={W} lengthAdjust="spacing" fill={fill} style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: CW * 1.62, whiteSpace: 'pre', filter: shadow }}>
      {str}
    </text>
  );

  return (
    <AbsoluteFill style={{ background: BG }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, opacity: flick }}>
        {rows.map((r, i) => rowText(r.main, i, AMBER, 'drop-shadow(0 0 5px rgba(255,150,0,.75))'))}
        {rows.map((r, i) => (r.ice.trim() ? rowText(r.ice, i, ICE, 'drop-shadow(0 0 9px rgba(190,230,255,.95))') : null))}
      </svg>
      {glass && <CrtGlass />}
    </AbsoluteFill>
  );
};

/** Стекло экрана: строки развёртки, тёмные края. */
export const CrtGlass: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 3px, rgba(0,0,0,.28) 3px 5px)', pointerEvents: 'none' }} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6) 100%)', pointerEvents: 'none' }} />
  </>
);

/** Образец облика для знакомства (`look-ascii`): реплика печатается, как вывод терминала. */
export const AsciiHook: React.FC = () => {
  const t = useTime();
  const typed = TEXT.sub.slice(0, Math.max(0, Math.floor((t - 0.6) * 12)));
  const cursor = Math.floor(t * 3) % 2 === 0 ? '█' : NB;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <AsciiScene t={t} glass={false} />
      {/* строка состояния — инверсное видео */}
      <div style={{ position: 'absolute', left: 60, top: 240, padding: '8px 18px', background: AMBER, color: BG, fontFamily: fonts.mono, fontWeight: 700, fontSize: 40, letterSpacing: '0.04em', boxShadow: '0 0 28px rgba(255,150,0,.55)' }}>
        {TEXT.hud.join('  ')}
      </div>
      {/* LOG: реплика печатается, как вывод терминала */}
      <div style={{ position: 'absolute', left: 0, top: 1236, width: W, height: 200, background: BG }} />
      <div style={{ position: 'absolute', left: 60, top: 1244, width: 870, borderTop: `3px dashed rgba(255,176,0,.45)` }} />
      <div style={{ position: 'absolute', left: 60, top: 1268, fontFamily: fonts.mono, fontWeight: 700, fontSize: 34, color: BG, background: AMBER, padding: '2px 12px' }}>РАЦИЯ</div>
      <div style={{ position: 'absolute', left: 60, top: 1330, fontFamily: fonts.mono, fontWeight: 700, fontSize: 76, lineHeight: 1, color: AMBER, whiteSpace: 'pre', textShadow: '0 0 14px rgba(255,150,0,.8)' }}>
        {'> '}
        {typed}
        {cursor}
      </div>
      <CrtGlass />
    </AbsoluteFill>
  );
};
