// Библиотека декораций «Ленты»: миры 14 серий теста («Сторож», «Компас») и сцены-хуки шести обликов.
// Серия данными ставит камеру на декорацию и меняет её состояние; режиссёр может брать их же:
//   import { SETS, SetView } from '@feed/sets';                  // единый вид { state, t }
//   import { GlassRoom } from '@feed/sets/storozh';                // мир компонентом со своими пропсами

import React from 'react';
import { KOMPAS_SETS } from './kompas/index';
import { LOOK_SETS } from './look/index';
import { STOROZH_SETS } from './storozh/index';
import type { SetDef, SetState } from './types';

export type { SetDef, SetInfo, SetProps, SetState, Spot, StateInfo, LookId } from './types';
export { CATALOG } from './catalog';

export const SETS: Record<string, SetDef> = { ...STOROZH_SETS, ...KOMPAS_SETS, ...LOOK_SETS };

/** Состояние декорации: значения по умолчанию, поверх — заданные. */
export function fullState(id: string, state: SetState = {}): SetState {
  const set = SETS[id];
  if (!set) throw new Error(`нет декорации ${id}; есть: ${Object.keys(SETS).join(', ')}`);
  const out: SetState = {};
  for (const [k, v] of Object.entries(set.states)) out[k] = v.default;
  for (const [k, v] of Object.entries(state)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

/** Нарисовать декорацию по id: недостающие числа состояния — по умолчанию. */
export const SetView: React.FC<{ id: string; state?: SetState; t: number; p?: string }> = ({ id, state, t, p }) => {
  const set = SETS[id];
  if (!set) throw new Error(`нет декорации ${id}`);
  return React.createElement(set.Component, { state: fullState(id, state), t, p });
};
