// Одна сцена-хук, общая для всех обликов: что в кадре и где. Облик решает только «как нарисовать».
// Кадр 1080×1920. Текст — внутри безопасной зоны (lib/kit.tsx, SAFE).

export const W = 1080;
export const H = 1920;

export const TEXT = {
  hud: ['НОЧЬ 1/7', '02:14', 'ДРОВА 60 %'],
  sub: 'ОТКРОЙ. ЭТО Я.',
};

/** Раскладка: окно, фигура за окном, рация на столе. */
export const G = {
  win: { x: 230, y: 330, w: 620, h: 560 },
  fig: { cx: 600, head: 560, r: 56, shoulders: 650, w: 250 },
  radio: { x: 290, y: 990, w: 420, h: 200 },
  dial: { x: 610, y: 1090, r: 34 },
  antenna: { x1: 660, y1: 990, x2: 790, y2: 780 },
  table: 1190,
};

/** Силуэт за окном: плечи и корпус до подоконника (голова — отдельным кругом). */
export function figurePath(): string {
  const { cx, shoulders: s, w } = G.fig;
  const b = G.win.y + G.win.h;
  const neck = `M ${cx - 24} ${G.fig.head + G.fig.r - 10} H ${cx + 24} V ${s + 6} H ${cx - 24} Z `;
  return neck + `M ${cx - w / 2} ${b} Q ${cx - w / 2} ${s + 14} ${cx - 62} ${s} L ${cx + 62} ${s} Q ${cx + w / 2} ${s + 14} ${cx + w / 2} ${b} Z`;
}

/** Сидированная случайность: кадр должен совпадать при каждом рендере. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Flake = { x: number; y: number; r: number };

/** Снег в прямоугольнике: падает и чуть качается; время — только из номера кадра. */
export function snow(n: number, seed: number, t: number, box: { x: number; y: number; w: number; h: number }): Flake[] {
  const r = rng(seed);
  const out: Flake[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = r() * box.w;
    const y0 = r() * box.h;
    const speed = 60 + r() * 110;
    const sway = 8 + r() * 22;
    const ph = r() * 6.28;
    const size = 2 + r() * 5;
    out.push({
      x: box.x + ((x0 + Math.sin(t * 1.3 + ph) * sway + box.w) % box.w),
      y: box.y + ((y0 + speed * t) % box.h),
      r: size,
    });
  }
  return out;
}

/** Состояние сцены-хука — общее для шести обликов (декорации `look/<облик>-window`). */
export type HookState = {
  /** Секунды от начала ролика: снег, мерцание. */
  t: number;
  /** 0…1 — фигура за окном есть. */
  there?: number;
  /** 0…1 — фигура подошла к стеклу (крупнее). */
  near?: number;
  /** 0…1 — шкала рации горит. */
  dial?: number;
  /** 0…1 — за окном светло (0 — ночь без луны). */
  lit?: number;
  /** 0…1 — у фигуры светятся глаза (где облик их рисует). */
  eyes?: number;
  /** Префикс id фильтров, если сцена дважды в кадре. */
  p?: string;
};

/** Фигура крупнее: масштаб `1 + 0.45 · near` от подоконника, чтобы она росла вверх, к стеклу. */
export function nearTransform(near: number, cx = G.fig.cx): string | undefined {
  if (!near) return undefined;
  const b = G.win.y + G.win.h;
  return `translate(${cx} ${b}) scale(${1 + 0.45 * near}) translate(${-cx} ${-b})`;
}
