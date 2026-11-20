// Обёртка таймлайна для рендера: файлы серии читаются из public-папки (staticFile + fetch).
// Public-папка — папка серий приложения: staticFile('<id>/…') — это <files>/episodes/<id>/….

import { staticFile } from 'remotion';
import { loadTimeline as coreLoadTimeline, loadVoice as coreLoadVoice, type Lang, type Pacing } from './timeline-core';

export type { Lang, Word, Line, Timeline, Pacing, Keep, Cues, VoiceLine, Branches, BranchTimes } from './timeline-core';
export { cues, estimateTimeline, choiceAtOf, branchTimesOf, preOf } from './timeline-core';

export const readJson = async (path: string): Promise<unknown> => {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`не читается ${path}: ${res.status}`);
  return res.json();
};

export const loadTimeline = (episode: string, lang: Lang, pacing: Pacing) => coreLoadTimeline(episode, lang, pacing, readJson);
export const loadVoice = (episode: string, lang: Lang) => coreLoadVoice(episode, lang, readJson);
