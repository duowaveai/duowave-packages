import React from 'react';
import { fonts } from './kit';

// Сцена серии: ракурс камеры на «мир» и карточка экрана выбора. Кадр 1080×1920.

const W = 1080;
const H = 1920;

/** Ракурс: точка мира (fx, fy) встаёт в (540, cy) кадра при увеличении s; край мира в кадр не попадает. */
export const Shot: React.FC<{ fx: number; fy: number; s: number; cy?: number; children: React.ReactNode }> = ({ fx, fy, s, cy = 960, children }) => {
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - fx * s));
  const ty = Math.min(0, Math.max(H - H * s, cy - fy * s));
  return <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>{children}</div>;
};

/**
 * Карточка варианта на экране выбора: картинка варианта (children), слева — номер, название и цена.
 * `color` — цвет рамки и номера (по тому, кому веришь; не зелёный), `show` — 0…1 появление.
 */
export const Card: React.FC<{
  top: number; color: string; bg: string; ink: string; show: number;
  item: { n: string; title: string; price: string }; children: React.ReactNode;
}> = ({ top, color, bg, ink, item, show, children }) => (
  <div style={{ position: 'absolute', left: 40, top, width: 1000, height: 530, overflow: 'hidden', border: `8px solid ${color}`, opacity: show, transform: `translateY(${(1 - show) * 40}px)`, background: bg }}>
    {children}
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,7,10,.92) 0%, rgba(8,7,10,.7) 46%, rgba(8,7,10,0) 78%)' }} />
    <div style={{ position: 'absolute', left: 34, top: 150, width: 560, color: ink, fontFamily: fonts.display }}>
      <div style={{ fontWeight: 900, fontSize: 76, lineHeight: 1, color }}>{item.n}</div>
      <div style={{ fontWeight: 900, fontSize: 66, lineHeight: 1.05, letterSpacing: '0.02em', marginTop: 10 }}>{item.title}</div>
      <div style={{ fontFamily: fonts.ui, fontWeight: 600, fontSize: 34, lineHeight: 1.2, marginTop: 16, opacity: 0.9 }}>{item.price}</div>
    </div>
  </div>
);
