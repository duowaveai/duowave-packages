// Декорация (set) — мир 1080×1920, нарисованный в одном облике, с состоянием из чисел. Серия данными ставит камеру
// на декорацию (план) и меняет её состояние по репликам (события). Режиссёр берёт те же миры прямо компонентами.

import type React from 'react';
import type { LookId } from '../looks/info';

export type { LookId };
export type SetState = Record<string, number>;

export type StateInfo = {
  /** Что меняет это число. */
  about: string;
  /** С чего декорация начинает. */
  default: number;
  /** Разумные пределы (нет — 0…1). */
  min?: number;
  max?: number;
};

/** Точка, куда удобно ставить камеру: fx, fy — точка мира в центре кадра, s — увеличение (1 — весь мир). */
export type Spot = { about: string; fx: number; fy: number; s: number };

export type SetInfo = {
  title: string;
  look: LookId;
  about: string;
  states: Record<string, StateInfo>;
  /** Готовые ракурсы из серий теста; первый — общий план (он же картинка для карточки развилки). */
  spots: Record<string, Spot>;
};

export type SetProps = {
  /** Состояние: все числа из `states`, недостающие — по умолчанию. */
  state: SetState;
  /** Секунды от начала ролика: волна, снег, мерцание. */
  t: number;
  /** Префикс id фильтров, если декорация дважды в кадре (карточка развилки). */
  p?: string;
};

export type SetDef = SetInfo & { Component: React.FC<SetProps> };
