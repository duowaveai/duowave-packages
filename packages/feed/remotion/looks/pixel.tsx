import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fonts, useTime } from '../lib/kit';
import { G, H, TEXT, W, snow, type HookState } from './scene';

// Облик «пиксельная RPG»: кадр 180×320 «родных» пикселей, увеличенный в 6 раз без сглаживания; ограниченная
// палитра, градиенты — шахматным дизерингом, реплика — в диалоговом окне, плашка — строка статуса.

const S = 6;
export const PIXEL_PALETTE = {
  black: '#0b0a14', night: '#1b1f3b', sky: '#2b3a67', haze: '#4f6fa8', snow: '#cfe3f2',
  wallD: '#24161d', wall: '#3b2231', wallL: '#52303c', wood: '#6b3d2e', woodL: '#8f563b',
  amber: '#df7126', gold: '#fbf236', white: '#f4f4f4',
};
const C = PIXEL_PALETTE;
const px = (v: number) => Math.round(v / S);

const R: React.FC<{ x: number; y: number; w: number; h: number; c: string }> = ({ x, y, w, h, c }) => <rect x={x} y={y} width={w} height={h} fill={c} />;

/** Мир сцены-хука в пикселях (без строки статуса и окна диалога — это рамка серии). */
export const PixelScene: React.FC<HookState> = ({ t, there = 1, near = 0, dial: dialOn = 1, lit = 1, eyes = 1, p = 'px' }) => {
  const win = { x: px(G.win.x), y: px(G.win.y), w: px(G.win.w), h: px(G.win.h) };
  const radio = { x: px(G.radio.x), y: px(G.radio.y), w: px(G.radio.w), h: px(G.radio.h) };
  const table = px(G.table);
  const fx = px(G.fig.cx);
  const fy = px(G.fig.head);
  const flakes = snow(46, 5, t, G.win);
  const blink = Math.floor(t * 4) % 5 !== 0;
  const step = Math.floor(t * 3) % 2;
  const on = dialOn >= 0.5;
  const k = 1 + 0.45 * near;
  const b = win.y + win.h;

  return (
    <svg width={W} height={H} viewBox="0 0 180 320" shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, top: 0, background: C.black }}>
      <defs>
        <pattern id={`${p}-d50`} width={2} height={2} patternUnits="userSpaceOnUse">
          <rect x={0} y={0} width={1} height={1} fill="#000" />
          <rect x={1} y={1} width={1} height={1} fill="#000" />
        </pattern>
        <mask id={`${p}-m50`}>
          <rect width={180} height={320} fill="#fff" />
          <rect width={180} height={320} fill={`url(#${p}-d50)`} />
        </mask>
        <clipPath id={`${p}-win`}>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} />
        </clipPath>
      </defs>

      {/* стена из досок */}
      <R x={0} y={0} w={180} h={320} c={C.wall} />
      {Array.from({ length: 17 }, (_, i) => (
        <R key={i} x={0} y={i * 12 + 4} w={180} h={1} c={C.wallD} />
      ))}
      {Array.from({ length: 34 }, (_, i) => (
        <R key={i} x={(i * 53) % 180} y={Math.floor(i / 2) * 12 + 5} w={1} h={11} c={C.wallD} />
      ))}
      <R x={0} y={0} w={180} h={40} c={C.wallD} />
      <g mask={`url(#${p}-m50)`}>
        <R x={0} y={40} w={180} h={8} c={C.wallD} />
        <R x={0} y={150} w={24} h={170} c={C.wallD} />
        <R x={158} y={150} w={22} h={170} c={C.wallD} />
      </g>

      {/* окно: ночь, дымка дизерингом, сугроб */}
      <g clipPath={`url(#${p}-win)`}>
        <R x={win.x} y={win.y} w={win.w} h={win.h} c={C.night} />
        <g mask={`url(#${p}-m50)`}>
          <R x={win.x} y={win.y + 40} w={win.w} h={16} c={lit >= 0.5 ? C.sky : C.night} />
        </g>
        <R x={win.x} y={win.y + 56} w={win.w} h={win.h} c={lit >= 0.5 ? C.sky : C.night} />
        {lit >= 0.5 && (
          <g mask={`url(#${p}-m50)`}>
            <R x={win.x} y={win.y + 68} w={win.w} h={10} c={C.haze} />
          </g>
        )}
        <R x={win.x} y={win.y + win.h - 14} w={win.w} h={14} c={C.snow} />
        <R x={win.x + 8} y={win.y + win.h - 16} w={30} h={2} c={C.snow} />
        <R x={win.x + 62} y={win.y + win.h - 17} w={36} h={3} c={C.snow} />

        {/* фигура: голова, плечи, два пикселя глаз */}
        {there >= 0.5 && (
          <g transform={near ? `translate(${fx} ${b}) scale(${k}) translate(${-fx} ${-b})` : undefined}>
            <R x={fx - 8} y={fy - 9} w={16} h={18} c={C.black} />
            <R x={fx - 6} y={fy - 11} w={12} h={2} c={C.black} />
            <R x={fx - 4} y={fy + 9} w={8} h={4} c={C.black} />
            {[0, 1, 2, 3, 4].map((i) => (
              <R key={i} x={fx - 12 - i * 2} y={fy + 13 + i * 3} w={24 + i * 4} h={3} c={C.black} />
            ))}
            <R x={fx - 21} y={fy + 28} w={42} h={60} c={C.black} />
            {blink && eyes >= 0.5 && (
              <>
                <R x={fx - 5} y={fy - 2} w={2} h={2} c={C.white} />
                <R x={fx + 3} y={fy - 2} w={2} h={2} c={C.white} />
              </>
            )}
          </g>
        )}
        {flakes.map((f, i) => (
          <R key={i} x={Math.floor(f.x / S)} y={Math.floor(f.y / S)} w={1} h={1} c={i % 3 ? C.white : C.snow} />
        ))}
      </g>

      {/* рама */}
      <R x={win.x - 3} y={win.y - 3} w={win.w + 6} h={3} c={C.woodL} />
      <R x={win.x - 3} y={win.y} w={3} h={win.h} c={C.wood} />
      <R x={win.x + win.w} y={win.y} w={3} h={win.h} c={C.wood} />
      <R x={win.x - 6} y={win.y + win.h} w={win.w + 12} h={5} c={C.woodL} />
      <R x={win.x - 6} y={win.y + win.h + 5} w={win.w + 12} h={1} c={C.wallD} />
      <R x={win.x + win.w / 2 - 1} y={win.y} w={2} h={win.h} c={C.wood} />
      <R x={win.x} y={win.y + 35} w={win.w} h={2} c={C.wood} />

      {/* стол */}
      <R x={0} y={table} w={180} h={320 - table} c={C.wallD} />
      <R x={0} y={table} w={180} h={2} c={C.wood} />
      <R x={0} y={table + 2} w={180} h={1} c={C.black} />

      {/* свечение шкалы — кольца дизерингом */}
      {on && (
        <g mask={`url(#${p}-m50)`}>
          <R x={radio.x + 38} y={radio.y - 8} w={36} h={8} c={C.amber} />
          <R x={radio.x + 30} y={table + 3} w={48} h={5} c={C.amber} />
        </g>
      )}

      {/* рация */}
      <R x={radio.x - 1} y={radio.y - 1} w={radio.w + 2} h={radio.h + 2} c={C.black} />
      <R x={radio.x} y={radio.y} w={radio.w} h={radio.h} c={C.wood} />
      <R x={radio.x} y={radio.y} w={radio.w} h={2} c={C.woodL} />
      <R x={radio.x} y={radio.y + radio.h - 3} w={radio.w} h={3} c={C.wallL} />
      <R x={radio.x + 5} y={radio.y + 7} w={30} h={20} c={C.wallD} />
      <g mask={`url(#${p}-m50)`}>
        <R x={radio.x + 6} y={radio.y + 8} w={28} h={18} c={C.woodL} />
      </g>
      <R x={radio.x + 44} y={radio.y + 8} w={20} h={14} c={C.black} />
      <R x={radio.x + 45} y={radio.y + 9} w={18} h={12} c={on ? (step ? C.gold : C.amber) : C.wallD} />
      {on && <R x={radio.x + 52 + step * 2} y={radio.y + 9} w={1} h={12} c={C.black} />}
      <R x={radio.x + 45} y={radio.y + 25} w={4} h={4} c={C.black} />
      <R x={radio.x + 59} y={radio.y + 25} w={4} h={4} c={C.black} />
      {Array.from({ length: 12 }, (_, i) => (
        <R key={i} x={radio.x + 60 + i * 2} y={radio.y - 2 - i * 3} w={1} h={3} c={C.snow} />
      ))}
    </svg>
  );
};

/** Строка статуса и диалоговое окно — рамка облика (в образце и в субтитрах серии данными). */
export const PixelChrome: React.FC<{ t: number; dialog?: boolean; status?: boolean }> = ({ t, dialog = true, status = true }) => {
  const step = Math.floor(t * 3) % 2;
  return (
    <svg width={W} height={H} viewBox="0 0 180 320" shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, top: 0 }}>
      {status && (
        <>
          <R x={10} y={40} w={146} h={13} c={C.black} />
          <R x={10} y={40} w={146} h={1} c={C.white} />
          <R x={10} y={52} w={146} h={1} c={C.white} />
          <R x={10} y={40} w={1} h={13} c={C.white} />
          <R x={155} y={40} w={1} h={13} c={C.white} />
          <R x={111} y={45} w={24} h={3} c={C.wallL} />
          <R x={111} y={45} w={14} h={3} c={C.amber} />
        </>
      )}
      {dialog && (
        <>
          <R x={10} y={207} w={146} h={30} c={C.black} />
          <R x={11} y={208} w={144} h={1} c={C.white} />
          <R x={11} y={235} w={144} h={1} c={C.white} />
          <R x={11} y={208} w={1} h={28} c={C.white} />
          <R x={154} y={208} w={1} h={28} c={C.white} />
          {step === 0 && (
            <>
              <R x={145} y={229} w={5} h={1} c={C.gold} />
              <R x={146} y={230} w={3} h={1} c={C.gold} />
              <R x={147} y={231} w={1} h={1} c={C.gold} />
            </>
          )}
        </>
      )}
    </svg>
  );
};

/** Образец облика для знакомства (`look-pixel`). */
export const PixelHook: React.FC = () => {
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <PixelScene t={t} />
      <PixelChrome t={t} />
      <div style={{ position: 'absolute', left: 14 * S, top: 44 * S, fontFamily: fonts.pixel, fontSize: 5 * S, lineHeight: 1, color: C.white, whiteSpace: 'pre' }}>
        {TEXT.hud[0]}  {TEXT.hud[1]}
      </div>
      <div style={{ position: 'absolute', left: 138 * S, top: 44 * S, fontFamily: fonts.pixel, fontSize: 5 * S, lineHeight: 1, color: C.amber }}>60</div>
      <div style={{ position: 'absolute', left: 16 * S, top: 212 * S, fontFamily: fonts.pixel, fontSize: 5 * S, lineHeight: 1, color: C.haze }}>РАЦИЯ</div>
      <div style={{ position: 'absolute', left: 16 * S, top: 222 * S, fontFamily: fonts.pixel, fontSize: 8 * S, lineHeight: 1, color: C.white }}>{TEXT.sub}</div>
    </AbsoluteFill>
  );
};
