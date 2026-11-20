// Декорации «Компаса» (облик «ризограф», три краски). Режиссёр берёт миры компонентами:
//   import { Deck, Wheelhouse, INK } from '@feed/sets/kompas';
// серия данными — через SETS['kompas/…'] (единый вид: { state, t }).

import React from 'react';
import { CATALOG } from '../catalog';
import type { SetDef, SetProps } from '../types';
import { Bay } from './bay';
import { BayChart } from './bay-chart';
import { Lighthouse, Pier, Treasure } from './port';
import { Chart, Deck, Wheelhouse } from './ship';
import { CoastChart, Stern } from './stern';

export { INK, Plate, Defs, Finish, Polaris, Deck, Wheelhouse, Chart, type DeckState, type WheelhouseState } from './ship';
export { BayChart } from './bay-chart';
export { Bay, type BayState } from './bay';
export { Stern, CoastChart } from './stern';
export { Pier, Lighthouse, Treasure } from './port';

const def = (id: string, Component: React.FC<SetProps>): [string, SetDef] => [id, { ...CATALOG[id]!, Component }];

export const KOMPAS_SETS: Record<string, SetDef> = Object.fromEntries([
  def('kompas/deck', ({ state: s, t, p }) => (
    <Deck clear={s.clear!} barrels={Math.round(s.barrels ?? 7)} mark={s.mark} dawn={s.dawn} reef={(s.reefLeft ?? 0) >= 0.5 ? 'left' : 'ahead'} reefShow={s.reef} reefNear={s.reefNear} t={t} p={p} />
  )),
  def('kompas/wheelhouse', ({ state: s, t, p }) => <Wheelhouse needle={s.needle!} chest={s.chest!} captain={s.captain!} clear={s.clear!} wheel={s.wheel} open={s.open} t={t} p={p} />),
  def('kompas/chart', ({ state: s, p }) => <Chart route={s.route!} alt={s.alt!} reefs={s.reefs!} p={p} />),
  def('kompas/bay-chart', ({ state: s, p }) => <BayChart pass={s.pass!} around={s.around!} table={s.table!} night={s.night} p={p} />),
  def('kompas/bay', ({ state: s, t, p }) => (
    <Bay
      boat={s.boat!} tarp={s.tarp} diver={s.diver!} pump={-t * 160 * (s.pumping ?? 1)} air={s.air} rules={s.rules} plate={s.plate} dusk={s.dusk}
      lantern={s.lantern} box={s.box} sitting={s.sitting} night={s.night} noDiver={(s.noDiver ?? 0) >= 0.5} t={t} p={p}
    />
  )),
  def('kompas/stern', ({ state: s, t, p }) => <Stern boat={s.boat!} lamp={s.lamp!} t={t} p={p} />),
  def('kompas/coast-chart', ({ state: s, p }) => <CoastChart left={s.left!} right={s.right!} p={p} />),
  def('kompas/pier', ({ state: s, t, p }) => <Pier near={s.near!} t={t} p={p} />),
  def('kompas/lighthouse', ({ state: s, t, p }) => <Lighthouse beam={s.beam!} keeper={s.keeper!} t={t} p={p} />),
  def('kompas/treasure', ({ state: s, p }) => <Treasure entry={s.entry!} map={s.map!} p={p} />),
]);
