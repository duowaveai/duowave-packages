// Серия данными (режим «Обычно»): Мозг пишет не код, а этот JSON — <files>/episodes/<id>/data.json.
// Реплики — в <id>/voice.<lang>.json, озвучка — в <id>/audio/<lang>/; без озвучки серия собирается немым черновиком.
// Композиция `data`, inputProps { episode: DataEpisode }; длина — по таймлайну.

import type { Branches } from '../lib/timeline-core';
import type { LookId } from '../looks/info';

export type { Branches };

/** id реплики из voice.<lang>.json: "01", "02"… */
export type LineId = string;
/** Числа состояния декорации (см. sets/catalog.json): { "storm": 0.3 }. */
export type StateMap = Record<string, number>;

export type DataShot = {
  /** Реплика, с которой начинается план: склейка за 0,15 с до её начала (первый план — с нуля). */
  at: LineId;
  /** Номер слова в реплике, с нуля: склейка за 0,1 с до этого слова (необязательно). */
  word?: number;
  /** Декорация: id из каталога ("kompas/deck"). */
  set: string;
  /** Состояние декорации на склейке: то, что не задано, остаётся как было (или по умолчанию). */
  state?: StateMap;
  /** Точка мира в центре кадра (px мира 1080×1920) и где она стоит по высоте кадра (cy, по умолчанию 960). */
  fx?: number;
  fy?: number;
  cy?: number;
  /** Увеличение: [в начале плана, в конце] или одно число; не меньше 1. */
  s?: [number, number] | number;
  /** Вместо fx/fy/s — готовый ракурс декорации из каталога (`spots`), например "radio". */
  spot?: string;
};

export type DataFx = 'shake' | 'flash' | 'end' | 'rewind';

export type DataEvent = {
  /** Реплика и (необязательно) номер слова в ней, с нуля: событие — в начале этого слова. */
  at: LineId;
  word?: number;
  /** Сдвиг от этого момента, секунды (может быть отрицательным). */
  shift?: number;
  /** Чья декорация меняется (по умолчанию — та, на которой стоит план в этот момент). */
  set?: string;
  /** Новые числа состояния; меняются плавно за `over` секунд. */
  change?: StateMap;
  over?: number;
  /** Звук из <id>/sfx/: hit, heart, rise, static, radio_on, crunch, rewind, wind, low, sea; громкость 0…1. */
  sfx?: string;
  volume?: number;
  /**
   * shake — тряска кадра; flash — вспышка; end — большое «КОНЕЦ» на чёрном (неверная ветка «обе ветки» кончилась,
   * держится до перемотки или следующего плана); rewind — перемотка: кадр без цвета, «◀◀», звук rewind.
   */
  fx?: DataFx;
  /** Плашка с этого момента — другая (ресурс тает): ["ДЕНЬ 3", "ВОДА 30 %"]. */
  hud?: string[];
};

/** Фон под всей серией: имя звука или { name, volume, from, until } (реплики). */
export type BedItem = string | { name: string; volume?: number; from?: LineId; until?: LineId };

export type Emphasis = { id: LineId; words: string[]; tone: 'yellow' | 'red'; shake?: boolean };

export type ChoiceVariant = {
  title: string;
  /** Цена варианта — одна строка под названием. */
  price: string;
  /** Картинка карточки: декорация, состояние и (необязательно) ракурс: spot или fx/fy/s. */
  set: string;
  state?: StateMap;
  spot?: string;
  fx?: number;
  fy?: number;
  s?: number;
};

export type DataChoice = {
  /** Вопрос между карточками: «ПЛЫВЁМ?». */
  q: string;
  a: ChoiceVariant;
  b: ChoiceVariant;
  /** Реплика, с которой встают карточки (за 0,1 с до неё). По умолчанию — последняя реплика. */
  at?: LineId;
};

export type DataPacing = {
  /** Пауза перед репликой по умолчанию, секунды. */
  defaultPre: number;
  /** Паузы перед отдельными репликами. */
  pre?: Record<LineId, number>;
  /** Сколько держать экран развилки после последней реплики (3–4 с). */
  endHold: number;
};

export type DataEpisode = {
  id: string;
  series: string;
  n: number;
  lang: 'ru' | 'en';
  look: LookId;
  pacing: DataPacing;
  /** Плашка вверху слева: счётчик и ресурс — ["ДЕНЬ 3", "ВОДА 40 %"]. */
  hud?: string[];
  shots: DataShot[];
  events?: DataEvent[];
  bed?: BedItem[];
  emphasis?: Emphasis[];
  choice?: DataChoice;
  /** «Обе ветки» (с серии 2): неверная ветка — реплики wrongLines[0..1], верная — rightLines[0..1]. */
  branches?: Branches;
};
