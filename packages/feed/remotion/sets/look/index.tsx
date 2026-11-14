// Сцена-хук каждого облика как декорация: комната, окно, фигура за окном, рация. Есть у всех шести обликов —
// серия данными в любом облике может начаться отсюда; свои миры облика добавляются рядом.

import React from 'react';
import { LOOKS, LOOK_IDS } from '../../looks/index';
import { CATALOG } from '../catalog';
import type { SetDef } from '../types';

export const LOOK_SETS: Record<string, SetDef> = Object.fromEntries(
  LOOK_IDS.map((look) => {
    const id = `look/${look}-window`;
    const { Scene } = LOOKS[look];
    const Component: SetDef['Component'] = ({ state: s, t, p }) => <Scene t={t} there={s.there} near={s.near} dial={s.dial} lit={s.lit} eyes={s.eyes} p={p} />;
    return [id, { ...CATALOG[id]!, Component }];
  }),
);
