// Чистое ядро таймлайна серии: без Remotion. Используется и в рендере (timeline.ts), и движком на Node (сверка,
// субтитры для выкладки) — один источник таймингов.
//
// Таймлайн строится из озвучки: каждая реплика — отдельный файл с таймингами символов
// (episodes/<серия>/audio/<lang>/<id>.json). Паузы между репликами задаёт серия.
//
// Файл реплики: { text, durationSec, file?, alignment: { characters, character_start_times_seconds,
// character_end_times_seconds } } — формат ElevenLabs. `file` — имя звука рядом (голоса компьютера дают WAV:
// "03.wav"); без него — "<id>.mp3".

export type Lang = 'en' | 'ru' | 'es';
export type Word = { text: string; start: number; end: number };
/** `clip` — какой кусок файла звучит, секунды от начала файла; `role` — чей голос (из voice.<lang>.json). */
export type Line = { id: string; text: string; start: number; end: number; audio: string; clip: [number, number]; words: Word[]; role?: string };
export type Timeline = { lang: Lang; lines: Line[]; total: number };

export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
export type VoiceLine = { id: string; text: string; speak?: string; role?: string };
type VoiceFile = { lang?: string; lines: VoiceLine[] };
type LineFile = { text?: string; durationSec: number; file?: string; alignment: Alignment };
/** audio/<lang>/speech.json: где в файле речь, а где тишина. */
export type Speech = Record<string, { duration: number; start: number; end: number; gaps: [number, number][] }>;

/** Оставить от реплики кусок: `from` — с первого вхождения этой строки, `to` — до конца первого вхождения этой. */
export type Keep = { from?: string; to?: string };

export type Pacing = {
  pre: Record<string, number>;
  defaultPre: number;
  endHold: number;
  /** Паузы, которые отличаются по языкам: перекрывают `pre`. */
  preLang?: Partial<Record<Lang, Record<string, number>>>;
  /** Реплики, которые в монтаж не входят. */
  skip?: string[];
  /** Куски реплик по языкам: звук режется в ближайшей паузе, субтитры — по тем же символам. */
  keep?: Partial<Record<Lang, Record<string, Keep>>>;
};

const HEAD = 0.03; // сколько тишины оставить перед речью
const TAIL = 0.1; // и после неё — чтобы не обрубить затухание

/** Прочитать JSON: в рендере — из public-папки (staticFile + fetch), на Node — с диска. */
export type ReadJson = (path: string) => Promise<unknown>;

/** Пауза перед репликой: по языку, по реплике или общая. */
export const preOf = (pacing: Pacing, lang: Lang, id: string) => pacing.preLang?.[lang]?.[id] ?? pacing.pre[id] ?? pacing.defaultPre;

// Субтитры показывают `text`, а озвучен `speak` (например, «2:47» прочитано как «два сорок семь»).
// Слова текста раскладываются по таймингам пропорционально позиции символа; когда text === speak — точно.
function wordsOf(text: string, alignment: Alignment, offset: number): Word[] {
  const n = alignment.characters.length;
  const words: Word[] = [];
  const re = /\S+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const a = Math.min(n - 1, Math.floor((m.index / text.length) * n));
    const b = Math.min(n - 1, Math.floor(((m.index + m[0].length - 1) / text.length) * n));
    const w = { text: m[0], start: offset + alignment.character_start_times_seconds[a]!, end: offset + alignment.character_end_times_seconds[b]! };
    // Одинокое тире приклеиваем к предыдущему слову, чтобы оно не висело отдельной строкой.
    if (/^[—–-]$/.test(w.text) && words.length) words[words.length - 1]!.text += ' ' + w.text;
    else words.push(w);
  }
  return words;
}

/** Кусок реплики: символы i..j озвучки, звук режется в паузах рядом с ними. */
function cutPiece(al: Alignment, keep: Keep, sp: Speech[string] | undefined, duration: number) {
  const chars = al.characters.join('');
  const i = keep.from ? chars.indexOf(keep.from) : 0;
  const j = keep.to ? chars.indexOf(keep.to, Math.max(0, i)) + keep.to.length - 1 : chars.length - 1;
  if (i < 0 || j < i) throw new Error(`не нашёл кусок ${JSON.stringify(keep)} в «${chars}»`);
  const a = al.character_start_times_seconds[i]!;
  const b = al.character_end_times_seconds[j]!;
  const gaps = sp?.gaps ?? [];
  // Начало — в конце паузы перед куском, конец — в начале паузы после него (тайминги растягивают последнее слово
  // через паузу, поэтому режем по началу тишины, а не по концу слова).
  const before = i === 0 ? undefined : gaps.find(([s, e]) => s <= a + 0.05 && e >= a - 0.3);
  const after = j === chars.length - 1 ? undefined : gaps.find(([s, e]) => e >= b - 0.05 && s <= b + 0.3);
  const from = i === 0 ? Math.max(0, (sp?.start ?? 0) - HEAD) : before ? before[1] - HEAD : Math.max(0, a - 0.05);
  const to = j === chars.length - 1 ? Math.min(duration, (sp?.end ?? duration) + TAIL) : after ? after[0] + TAIL : b + 0.12;
  const piece: Alignment = {
    characters: al.characters.slice(i, j + 1),
    character_start_times_seconds: al.character_start_times_seconds.slice(i, j + 1),
    character_end_times_seconds: al.character_end_times_seconds.slice(i, j + 1),
  };
  return { text: chars.slice(i, j + 1), alignment: piece, from, to };
}

/** Реплики серии: voice.<lang>.json. */
export async function loadVoice(episode: string, lang: Lang, read: ReadJson): Promise<VoiceLine[]> {
  const voice = (await read(`${episode}/voice.${lang}.json`)) as VoiceFile;
  return voice.lines;
}

/** Настоящий таймлайн по озвучке. Нет файла хотя бы одной реплики — ошибка (тогда серия — немой черновик). */
export async function loadTimeline(episode: string, lang: Lang, pacing: Pacing, read: ReadJson): Promise<Timeline> {
  const voice = await loadVoice(episode, lang, read);
  let speech: Speech = {};
  try {
    speech = (await read(`${episode}/audio/${lang}/speech.json`)) as Speech;
  } catch {
    // Без speech.json звучит весь файл целиком.
  }
  const lines: Line[] = [];
  let t = 0;
  for (const l of voice) {
    if (pacing.skip?.includes(l.id)) continue;
    const meta = (await read(`${episode}/audio/${lang}/${l.id}.json`)) as LineFile;
    const sp = speech[l.id];
    const keep = pacing.keep?.[lang]?.[l.id];
    const piece = keep
      ? cutPiece(meta.alignment, keep, sp, meta.durationSec)
      : { text: l.text, alignment: meta.alignment, from: sp ? Math.max(0, sp.start - HEAD) : 0, to: sp ? Math.min(meta.durationSec, sp.end + TAIL) : meta.durationSec };
    t += preOf(pacing, lang, l.id);
    const len = piece.to - piece.from;
    lines.push({
      id: l.id, text: piece.text, start: t, end: t + len, audio: `${episode}/audio/${lang}/${meta.file ?? `${l.id}.mp3`}`,
      clip: [piece.from, piece.to] as [number, number], words: wordsOf(piece.text, piece.alignment, t - piece.from), role: l.role,
    });
    t += len;
  }
  return { lang, lines, total: t + pacing.endHold };
}

/** Таймлайн без озвучки: ~15 знаков в секунду, слова — равномерно по тексту. Только чтобы смотреть кадры. */
export function estimateTimeline(lines: VoiceLine[], lang: Lang, pacing: Pacing): Timeline {
  let t = 0;
  const out: Line[] = [];
  for (const l of lines) {
    if (pacing.skip?.includes(l.id)) continue;
    t += preOf(pacing, lang, l.id);
    const len = Math.max(1.2, l.text.length / 15);
    const words = [...l.text.matchAll(/\S+/g)].map((m) => ({
      text: m[0],
      start: t + (m.index! / l.text.length) * len,
      end: t + ((m.index! + m[0].length) / l.text.length) * len,
    }));
    out.push({ id: l.id, text: l.text, start: t, end: t + len, audio: '', clip: [0, len], words, role: l.role });
    t += len;
  }
  return { lang, lines: out, total: t + pacing.endHold };
}

export function cues(tl: Timeline) {
  const line = (id: string) => {
    const l = tl.lines.find((x) => x.id === id);
    if (!l) throw new Error(`нет реплики ${id}`);
    return l;
  };
  return {
    s: (id: string) => line(id).start,
    e: (id: string) => line(id).end,
    // То же, но без ошибки, если слова нет (например, в этом языке реплика обрезана).
    find: (id: string, ...patterns: RegExp[]) => line(id).words.find((x) => patterns.some((p) => p.test(x.text))),
    // Время слова в реплике: первое слово, подходящее под любое из регулярных выражений.
    word: (id: string, ...patterns: RegExp[]) => {
      const w = line(id).words.find((x) => patterns.some((p) => p.test(x.text)));
      if (!w) throw new Error(`в реплике ${id} нет слова ${patterns.join(' | ')}`);
      return w;
    },
  };
}
export type Cues = ReturnType<typeof cues>;

// --- Времена для движка и плеера: когда встают карточки развилки и где идут ветки «обе ветки» ---

/** «Обе ветки»: неверный вариант прошлой развилки (реплики wrongLines[0]..wrongLines[1]) до «КОНЕЦ», перемотка, верный. */
export type Branches = { wrong: 'a' | 'b'; wrongLines: [string, string]; rightLines: [string, string] };
export type BranchTimes = { wrong: [number, number]; right: [number, number] };

/** Карточки развилки встают за 0,1 с до начала реплики `line` (как `cut.cards` в сериях теста). */
export function choiceAtOf(tl: Timeline, line: string | undefined | null): number | null {
  if (!line) return null;
  const l = tl.lines.find((x) => x.id === line);
  return l ? Math.max(0, l.start - 0.1) : null;
}

/** Секунды веток: начало первой реплики минус её пауза — конец последней. */
export function branchTimesOf(tl: Timeline, pacing: Pacing, branches: Branches | undefined | null): BranchTimes | null {
  if (!branches) return null;
  const span = ([a, b]: [string, string]): [number, number] | null => {
    const first = tl.lines.find((x) => x.id === a);
    const last = tl.lines.find((x) => x.id === b);
    if (!first || !last) return null;
    return [Math.max(0, first.start - preOf(pacing, tl.lang, a)), last.end];
  };
  const wrong = span(branches.wrongLines);
  const right = span(branches.rightLines);
  return wrong && right ? { wrong, right } : null;
}
