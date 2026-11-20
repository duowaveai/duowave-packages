// Декорации «Сторожа» (облик «витраж»). Режиссёр берёт миры компонентами:
//   import { GlassRoom, DoorRoom, C } from '@feed/sets/storozh';
// серия данными — через SETS['storozh/…'] (единый вид: { state, t }).

import React from 'react';
import { CATALOG } from '../catalog';
import type { SetDef, SetProps } from '../types';
import { Cockpit } from './cockpit';
import { Feet } from './feet';
import { DoorRoom, GlassRoom } from './room';
import { Porch, ShedDoor } from './shed-door';
import { StoveRoom } from './stove';
import { Shed, Yard } from './yard';

export { C, Defs, Stone, GlassRoom, DoorRoom, type RoomState } from './room';
export { StoveRoom } from './stove';
export { Yard, Shed, type YardState } from './yard';
export { ShedDoor, Porch } from './shed-door';
export { Feet } from './feet';
export { Cockpit, hand } from './cockpit';

/** Рация живая: шкала чуть мерцает, как в сериях теста. */
const flicker = (on: number, t: number) => (on ? on * (0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3)) : 0);
const RULE4 = 'На свой голос не отвечать.';

const def = (id: string, Component: React.FC<SetProps>): [string, SetDef] => [id, { ...CATALOG[id]!, Component }];

export const STOROZH_SETS: Record<string, SetDef> = Object.fromEntries([
  def('storozh/glass-room', ({ state: s, t, p }) => <GlassRoom lit={s.lit!} near={s.near} eyes={s.eyes} there={s.there} dial={flicker(s.dial!, t)} p={p} />),
  def('storozh/door-room', ({ state: s, p }) => <DoorRoom lamp={s.lamp!} rule4={s.rule4 ? RULE4 : undefined} rule4Show={s.rule4} p={p} />),
  def('storozh/stove-room', ({ state: s, t, p }) => <StoveRoom fire={s.fire!} t={t} p={p} />),
  def('storozh/yard', ({ state: s, t, p }) => <Yard there={s.there!} steps={s.steps} heli={s.heli} second={s.second} eyes={s.eyes} wave={(s.wave ?? 0) >= 0.5} dx={s.dx} t={t} p={p} />),
  def('storozh/shed', ({ state: s, t, p }) => <Shed dial={flicker(s.dial!, t)} ink={s.ink!} p={p} />),
  def('storozh/shed-door', ({ state: s, p }) => <ShedDoor near={s.near!} eyes={s.eyes!} p={p} />),
  def('storozh/porch', ({ state: s, p }) => <Porch steps={s.steps!} p={p} />),
  def('storozh/feet', ({ state: s, p }) => <Feet light={s.light!} own={s.own} p={p} />),
  def('storozh/cockpit', ({ state: s, t, p }) => <Cockpit city={s.city!} turn={s.turn!} t={t} p={p} />),
]);
