import React from 'react';

// ДиВи — знак DuoWave (brand/DIVI.md): скруглённый квадрат 160×176 на холсте 256×256, два глаза-капсулы.
// Рисуется кодом, файлов не нужно.

export const LIME = '#B6F36A';
export const DARK = '#0B0F0A';

const BODY = 'M116 40H140A68 68 0 0 1 208 108V148A68 68 0 0 1 140 216H116A68 68 0 0 1 48 148V108A68 68 0 0 1 116 40Z';
const EYES = 'M81.2 110A16.8 16.8 0 0 1 114.8 110V138A16.8 16.8 0 0 1 81.2 138ZM141.2 110A16.8 16.8 0 0 1 174.8 110V138A16.8 16.8 0 0 1 141.2 138Z';

/**
 * `width` — ширина тела в px (тело 160 из 256 единиц холста; высота — 176/160 от ширины).
 * `mode`: `mono` — один цвет, глаза вырезаны насквозь (знак поверх видео); `lime` — лаймовое тело, тёмные глаза.
 * `blink` 0…1 — глаза закрываются (только у `lime`).
 */
export const Divi: React.FC<{ width: number; color?: string; mode?: 'mono' | 'lime'; blink?: number; style?: React.CSSProperties }> = ({ width, color = '#fff', mode = 'mono', blink = 0, style }) => {
  const k = width / 160;
  const box = { x: 48, y: 40, w: 160, h: 176 };
  const svgStyle: React.CSSProperties = { display: 'block', width, height: box.h * k, ...style };
  if (mode === 'mono') {
    return (
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={svgStyle}>
        <path d={BODY + EYES} fill={color} fillRule="evenodd" />
      </svg>
    );
  }
  const open = Math.max(0.12, 1 - blink);
  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={svgStyle}>
      <path d={BODY} fill={LIME} />
      <path d={EYES} fill={DARK} transform={`translate(0 124) scale(1 ${open}) translate(0 -124)`} />
    </svg>
  );
};
