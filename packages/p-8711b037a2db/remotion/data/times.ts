// Времена серии данными — без React: склейки, события, состояния декораций, окна «КОНЕЦ» и перемотки, карточки.
// Всё считается от таймлайна озвучки, поэтому монтаж подстраивается под длину реплик сам.

import { CATALOG } from '../sets/catalog';
import type { SetState } from '../sets/types';
import type { Pacing, Timeline } from '../lib/timeline-core';
import { branchTimesOf } from '../lib/timeline-core';
import type { DataEpisode, DataEvent, DataShot } from './types';

export const CUT_BEFORE_LINE = 0.15;
export const CUT_BEFORE_WORD = 0.1;
export const CARDS_BEFORE_LINE = 0.1;

export type ShotSpan = { shot: DataShot; start: number; end: number; fx: number; fy: number; cy: number; s: [number, number] };
export type TimedEvent = { ev: DataEvent; t: number; set: string | null };
export type Keyframe = { t: number; over: number; values: SetState };
export type DataTimes = {
  shots: ShotSpan[];
  events: TimedEvent[];
  /** Состояния по декорациям: точки во времени, отсортированы. */
  keys: Record<string, Keyframe[]>;
  /** «КОНЕЦ»: [начало, конец]. */
  ends: [number, number][];
  /** Перемотка: [начало, конец]. */
  rewinds: [number, number][];
  /** Плашка: с какого момента какая. */
  huds: { t: number; hud: string[] }[];
  /** Карточки развилки (секунды) или Infinity. */
  cards: number;
  total: number;
};

/** Pacing для таймлайна из pacing серии данными. */
export const pacingOf = (ep: DataEpisode): Pacing => ({ pre: ep.pacing.pre ?? {}, defaultPre: ep.pacing.defaultPre ?? 0.3, endHold: ep.pacing.endHold ?? 3.6 });

function lineOf(tl: Timeline, id: string) {
  const l = tl.lines.find((x) => x.id === id);
  if (!l) throw new Error(`в серии нет реплики "${id}" (есть: ${tl.lines.map((x) => x.id).join(', ')})`);
  return l;
}

/** Начало слова `word` (с нуля) реплики; нет номера — начало реплики. */
export function momentOf(tl: Timeline, at: string, word?: number): number {
  const l = lineOf(tl, at);
  if (word === undefined || word === null) return l.start;
  const w = l.words[Math.max(0, Math.min(l.words.length - 1, Math.floor(word)))];
  return w ? w.start : l.start;
}

/** Ракурс плана: spot из каталога, иначе fx/fy/s, иначе — общий план. */
function frameOf(shot: DataShot): { fx: number; fy: number; cy: number; s: [number, number] } {
  const spot = shot.spot ? CATALOG[shot.set]?.spots[shot.spot] : undefined;
  const base = spot ?? { fx: 540, fy: 960, s: 1 };
  const fx = shot.fx ?? base.fx;
  const fy = shot.fy ?? base.fy;
  const raw = shot.s ?? [base.s, base.s * 1.08];
  const s: [number, number] = Array.isArray(raw) ? [raw[0], raw[1] ?? raw[0]] : [raw, raw * 1.06];
  return { fx, fy, cy: shot.cy ?? 960, s: [Math.max(1, s[0]), Math.max(1, s[1])] };
}

/** Проверить серию до рендера: декорации, реплики, состояния. Пустой список — всё в порядке. */
export function problemsOf(ep: DataEpisode, tl: Timeline): string[] {
  const out: string[] = [];
  const has = (id: string) => tl.lines.some((l) => l.id === id);
  const checkSet = (where: string, set: string | undefined, state?: Record<string, number>) => {
    if (!set) return;
    const info = CATALOG[set];
    if (!info) return out.push(`${where}: нет декорации "${set}"`);
    for (const k of Object.keys(state ?? {})) if (!info.states[k]) out.push(`${where}: у "${set}" нет состояния "${k}" (есть: ${Object.keys(info.states).join(', ')})`);
  };
  if (!ep.shots?.length) out.push('нет ни одного плана (shots)');
  ep.shots?.forEach((s, i) => {
    if (!has(s.at)) out.push(`план ${i + 1}: нет реплики "${s.at}"`);
    checkSet(`план ${i + 1}`, s.set, s.state);
    if (s.spot && !CATALOG[s.set]?.spots[s.spot]) out.push(`план ${i + 1}: у "${s.set}" нет ракурса "${s.spot}"`);
  });
  ep.events?.forEach((e, i) => {
    if (!has(e.at)) out.push(`событие ${i + 1}: нет реплики "${e.at}"`);
    checkSet(`событие ${i + 1}`, e.set, e.change);
  });
  if (ep.choice) {
    checkSet('развилка ①', ep.choice.a.set, ep.choice.a.state);
    checkSet('развилка ②', ep.choice.b.set, ep.choice.b.state);
    if (ep.choice.at && !has(ep.choice.at)) out.push(`развилка: нет реплики "${ep.choice.at}"`);
  }
  if (ep.branches) for (const id of [...ep.branches.wrongLines, ...ep.branches.rightLines]) if (!has(id)) out.push(`ветки: нет реплики "${id}"`);
  return out;
}

export function computeTimes(ep: DataEpisode, tl: Timeline): DataTimes {
  const total = tl.total;
  const last = tl.lines.at(-1);
  const cards = ep.choice ? Math.max(0, (ep.choice.at ? lineOf(tl, ep.choice.at).start : (last?.start ?? total)) - CARDS_BEFORE_LINE) : Infinity;

  // планы: склейка за 0,15 с до реплики (или 0,1 с до слова); первый — с нуля
  const cuts = ep.shots
    .map((shot, i) => ({ shot, i, start: shot.word !== undefined ? momentOf(tl, shot.at, shot.word) - CUT_BEFORE_WORD : lineOf(tl, shot.at).start - CUT_BEFORE_LINE }))
    .sort((a, b) => a.start - b.start || a.i - b.i);
  if (cuts[0]) cuts[0].start = 0;
  const shots: ShotSpan[] = cuts.map((c, k) => ({ shot: c.shot, start: Math.max(0, c.start), end: cuts[k + 1]?.start ?? total, ...frameOf(c.shot) }));
  const shotAt = (t: number) => shots.findLast((s) => t >= s.start) ?? shots[0];

  // события: в начале слова (или реплики) плюс сдвиг; перемотка — за 0,25 с до реплики
  const events: TimedEvent[] = (ep.events ?? [])
    .map((ev) => {
      const base = momentOf(tl, ev.at, ev.word) + (ev.shift ?? 0) - (ev.fx === 'rewind' && ev.word === undefined ? 0.25 : 0);
      const t = Math.max(0, base);
      return { ev, t, set: ev.set ?? shotAt(t)?.shot.set ?? null };
    })
    .sort((a, b) => a.t - b.t);

  // состояния декораций: на склейке — мгновенно, по событию — плавно за `over`
  const keys: Record<string, Keyframe[]> = {};
  const push = (set: string, k: Keyframe) => (keys[set] ??= []).push(k);
  for (const s of shots) if (s.shot.state) push(s.shot.set, { t: s.start, over: 0, values: s.shot.state });
  for (const e of events) if (e.set && e.ev.change) push(e.set, { t: e.t, over: Math.max(0, e.ev.over ?? 0.6), values: e.ev.change });
  for (const list of Object.values(keys)) list.sort((a, b) => a.t - b.t);

  // «КОНЕЦ» — после конца реплики, где стоит событие, до перемотки или следующей реплики/склейки
  const rewindStarts = events.filter((e) => e.ev.fx === 'rewind').map((e) => e.t);
  const ends: [number, number][] = events
    .filter((e) => e.ev.fx === 'end')
    .map((e) => {
      const line = lineOf(tl, e.ev.at);
      const a = Math.max(e.t, line.end + 0.25);
      const nextLine = tl.lines.find((l) => l.start > line.start)?.start;
      const nextCut = shots.find((s) => s.start > a + 0.05)?.start;
      const nextRewind = rewindStarts.find((r) => r > a);
      const b = Math.min(nextRewind ?? Infinity, nextCut ?? Infinity, nextLine !== undefined ? nextLine - 0.25 : Infinity, cards, total);
      return [a, Math.max(a + 0.8, Number.isFinite(b) ? b : a + 1.6)] as [number, number];
    });
  // перемотка — до следующей склейки (верная ветка), но не короче 0,8 с и не длиннее 3 с
  const rewinds: [number, number][] = rewindStarts.map((a) => {
    const next = shots.find((s) => s.start > a + 0.3)?.start ?? a + 1.6;
    return [a, Math.min(a + 3, Math.max(a + 0.8, next))];
  });

  const huds = [{ t: 0, hud: ep.hud ?? [] }, ...events.filter((e) => e.ev.hud).map((e) => ({ t: e.t, hud: e.ev.hud! }))];
  return { shots, events, keys, ends, rewinds, huds, cards, total };
}

/** Состояние декорации в момент t: умолчания, поверх — точки по порядку, каждая плавно за своё время. */
export function stateAt(set: string, keys: Keyframe[] | undefined, t: number, ease: (x: number) => number): SetState {
  const info = CATALOG[set];
  const v: SetState = {};
  if (info) for (const [k, s] of Object.entries(info.states)) v[k] = s.default;
  for (const key of keys ?? []) {
    if (key.t > t) break;
    const p = key.over > 0 ? ease(Math.min(1, (t - key.t) / key.over)) : 1;
    for (const [k, to] of Object.entries(key.values)) v[k] = (v[k] ?? 0) + (to - (v[k] ?? 0)) * p;
  }
  return v;
}

/** То, что calculateMetadata отдаёт движку: когда карточки и где ветки. */
export function engineTimes(ep: DataEpisode, tl: Timeline) {
  const times = computeTimes(ep, tl);
  return { choiceAt: Number.isFinite(times.cards) ? times.cards : null, branchTimes: branchTimesOf(tl, pacingOf(ep), ep.branches) };
}
