// Общее для серий «Режиссёра»: что серия сообщает о себе и откуда берётся её таймлайн.
// Серия — <files>/episodes/<id>/code/Episode.tsx, экспортирует `meta` и `Episode`; реплики —
// <id>/voice.<lang>.json, озвучка — <id>/audio/<lang>/.

import { branchTimesOf, choiceAtOf, estimateTimeline, loadTimeline, loadVoice, type Branches, type BranchTimes, type Lang, type Pacing, type Timeline } from './timeline';

export type EpisodeMeta = {
  id: string;
  lang: Lang;
  pacing: Pacing;
  /** Реплика, с которой встают карточки развилки (за 0,1 с до её начала). Нет — `choiceAt: null`. */
  choiceLine?: string;
  /** «Обе ветки» (серия 2 и дальше): какие реплики — неверная ветка, какие — верная. */
  branches?: Branches;
};

/**
 * Пропсы серии. `tl`, `draft` — для картинки; `choiceAt` и `branchTimes` считает calculateMetadata для движка:
 * он читает их из `selectComposition(...).props` (когда плееру ставить «ТВОЙ ВЫБОР», когда копии — плашку).
 */
export type EpisodeProps = { tl: Timeline | null; draft: boolean; choiceAt?: number | null; branchTimes?: BranchTimes | null };

/** Настоящий таймлайн, если серия озвучена; иначе — оценка по длине текста (`draft: true`, без звука). */
export async function loadEpisode(meta: Pick<EpisodeMeta, 'id' | 'lang' | 'pacing'>): Promise<{ tl: Timeline; draft: boolean }> {
  try {
    return { tl: await loadTimeline(meta.id, meta.lang, meta.pacing), draft: false };
  } catch {
    return { tl: estimateTimeline(await loadVoice(meta.id, meta.lang), meta.lang, meta.pacing), draft: true };
  }
}

/** Всё, что calculateMetadata серии кладёт в props. */
export async function episodeProps(meta: EpisodeMeta): Promise<Required<EpisodeProps> & { tl: Timeline }> {
  const { tl, draft } = await loadEpisode(meta);
  return { tl, draft, choiceAt: choiceAtOf(tl, meta.choiceLine), branchTimes: branchTimesOf(tl, meta.pacing, meta.branches) };
}
