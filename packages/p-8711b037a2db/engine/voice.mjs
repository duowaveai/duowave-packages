// Озвучка серии (series-feed tools/voice.ts и speech.ts, перенесено): каждая реплика — свой файл и рядом JSON с
// временем каждого знака, по нему таймлайн Remotion ставит субтитры и склейки.
//
// - Любой голос — одним письмом шлюзу (`system/voice` → `synth`): компьютер (Piper, Silero), ElevenLabs, облако —
//   поставщики шлюза, их ключи — в его сейфе; «Лента» ни одного поставщика сама не зовёт. Время знаков — от
//   поставщика, если он его знает, иначе от слуха шлюза (`system/hearing` → `recognize`, решение 12 плана), а нет
//   слуха — по паузам в файле (их находит ffmpeg).
// - Своя запись (окно «Записать своим голосом») — WAV в папке приложения; время — так же, слухом или по паузам.
// - Немой черновик (голосов нет совсем): тишина длиной в реплику, время знаков — по длине текста; серия собирается с
//   фоном и субтитрами, «Озвучить» потом даст ей голос.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { oneVoice, voiceForLine } from './cast.mjs';
import { L } from './i18n.mjs';
import { duration, silences } from './ffmpeg.mjs';
import { letter, log } from './host.mjs';
import { folder } from './state.mjs';
import { RATE, encodeWav, treatVoice } from './sound.mjs';

/** Голосов нет совсем — серию можно собрать немым черновиком. Слова шлюза на языке дома: русские и английские. */
export const NO_VOICE = /голосов (компьютера )?нет|сервер голоса не настроен|no (computer )?voices|voice server is not set up/i;

/** Голос шлюза — голос «Ленты»: компьютера или облачный (ElevenLabs), с лицензией и «можно публиковать». */
export function feedVoice(card) {
    const provider = card?.provider ?? 'computer';
    const voice = {
        id: card.id,
        kind: provider === 'computer' ? 'computer' : provider,
        title: provider === 'computer' ? card.voice ?? card.title ?? card.id : card.title ?? card.id,
        license: card.license,
        publish: !!card.publish,
        cloud: !!card.cloud,
        paid: !!card.paid,
    };
    if (card.lang) voice.lang = card.lang;
    return voice;
}

/** Все голоса шлюза, компьютера и облачные (`system/voice` → `voices`); голосов нет совсем — ошибка (NO_VOICE). */
export async function gatewayVoices() {
    const cards = await letter('system/voice', 'voices');
    return (Array.isArray(cards) ? cards : []).map(feedVoice);
}

/** Голоса компьютера нет — первый облачный голос шлюза (ElevenLabs по ключу в пульте), если он есть. */
export async function cloudFallback() {
    const voices = await gatewayVoices().catch((error) => (log('info', `голоса шлюза: ${error.message}`), []));
    return voices.find((voice) => voice.kind !== 'computer') ?? null;
}

/** Поставщики голосов шлюза (`system/voice` → `providers`): готов ли, с `balance` — что осталось на тарифе. */
export async function voiceProviders({ balance = false } = {}) {
    const cards = await letter('system/voice', 'providers', { balance });
    return Array.isArray(cards) ? cards : [];
}

/** Сколько «весит» знак при раскладке по времени: буквы — полностью, пробел и знаки — меньше. */
function weight(char) {
    if (/\p{L}|\p{N}/u.test(char)) return 1;
    if (char === ' ') return 0.6;
    return 0.35;
}

/** Время каждого знака по звучащим кускам реплики (без пауз в начале, внутри и в конце). */
export function estimateAlignment(text, bounds) {
    const characters = [...text];
    const pieces = [];
    let at = bounds.start;
    for (const [gapStart, gapEnd] of bounds.gaps) {
        if (gapStart > at) pieces.push([at, gapStart]);
        at = Math.max(at, gapEnd);
    }
    if (bounds.end > at) pieces.push([at, bounds.end]);
    if (!pieces.length) pieces.push([bounds.start, Math.max(bounds.start + 0.2, bounds.end)]);
    const spoken = pieces.reduce((sum, [a, b]) => sum + (b - a), 0);
    const total = characters.reduce((sum, char) => sum + weight(char), 0) || 1;
    const timeAt = (share) => {
        let left = share * spoken;
        for (const [a, b] of pieces) {
            if (left <= b - a) return a + left;
            left -= b - a;
        }
        return pieces.at(-1)[1];
    };
    const starts = [];
    const ends = [];
    let done = 0;
    for (const char of characters) {
        starts.push(Math.round(timeAt(done / total) * 1000) / 1000);
        done += weight(char);
        ends.push(Math.round(timeAt(done / total) * 1000) / 1000);
    }
    return { characters, character_start_times_seconds: starts, character_end_times_seconds: ends };
}

/**
 * Время каждого знака по распознанным словам (слух шлюза, `system/hearing` → `recognize`): слова реплики по порядку
 * ложатся на слова, что услышал слух, знаки слова — внутри его времени, пробелы и знаки — в паузах между словами.
 * Слов услышано столько же — точно; иначе слова реплики делят общее время речи пропорционально длине. Ничего не
 * услышано — null (тогда — по паузам, `estimateAlignment`).
 */
export function alignmentFromWords(text, heard) {
    const words = (heard ?? []).filter((one) => Number.isFinite(one?.start) && Number.isFinite(one?.end) && one.end >= one.start);
    if (!words.length) return null;
    const characters = [...text];
    // Слова реплики: [начало, конец) в знаках.
    const spans = [];
    let at = null;
    characters.forEach((char, index) => {
        const letter = /\p{L}|\p{N}/u.test(char);
        if (letter && at === null) at = index;
        if (!letter && at !== null) {
            spans.push([at, index]);
            at = null;
        }
    });
    if (at !== null) spans.push([at, characters.length]);
    if (!spans.length) return null;
    // Время каждого слова реплики: одно к одному или пропорционально длине по всей речи.
    const times = [];
    if (spans.length === words.length) {
        for (const word of words) times.push([word.start, word.end]);
    } else {
        const from = words[0].start;
        const to = words.at(-1).end;
        const total = spans.reduce((sum, [a, b]) => sum + (b - a), 0) || 1;
        let done = 0;
        for (const [a, b] of spans) {
            const start = from + ((to - from) * done) / total;
            done += b - a;
            times.push([start, from + ((to - from) * done) / total]);
        }
    }
    const starts = new Array(characters.length);
    const ends = new Array(characters.length);
    spans.forEach(([a, b], index) => {
        const [start, end] = times[index];
        const step = (end - start) / (b - a);
        for (let i = a; i < b; i += 1) {
            starts[i] = start + step * (i - a);
            ends[i] = start + step * (i - a + 1);
        }
    });
    // Пробелы и знаки между словами — в паузе между ними; до первого и после последнего — у их краёв.
    for (let i = 0; i < characters.length; i += 1) {
        if (starts[i] !== undefined) continue;
        const before = [...ends.slice(0, i)].reverse().find((value) => value !== undefined);
        const after = starts.slice(i + 1).find((value) => value !== undefined);
        const start = before ?? after ?? 0;
        starts[i] = start;
        ends[i] = after ?? start;
    }
    const round = (value) => Math.round(value * 1000) / 1000;
    return { characters, character_start_times_seconds: starts.map(round), character_end_times_seconds: ends.map(round) };
}

/** Где в файле речь: длина, начало, конец, паузы внутри (как speech.json series-feed). */
export async function speechBounds(file) {
    const length = Math.round(duration(file) * 1000) / 1000;
    const gaps = await silences(file);
    const start = gaps.length && gaps[0][0] <= 0.01 ? gaps[0][1] : 0;
    const end = gaps.length && gaps.at(-1)[1] >= length - 0.01 ? gaps.at(-1)[0] : length;
    return { duration: length, start, end, gaps: gaps.filter(([s, e]) => s > 0.01 && e < length - 0.01) };
}

/**
 * Озвучить реплики серии: что уже озвучено — не трогается (кредиты второй раз не тратятся). `progress(доля, слова)`.
 * Ответ — сколько знаков ушло платному голосу (ElevenLabs).
 */
export async function voiceEpisode(dir, info, voiceOrCast, { progress = () => {}, only, silent = false } = {}) {
    // Состав голосов сериала (cast.mjs): рассказчик, второй голос, персонажи; один голос — состав из него.
    const cast = voiceOrCast?.narrator ? voiceOrCast : oneVoice(voiceOrCast);
    const lang = info.lang ?? 'ru';
    const lines = JSON.parse(readFileSync(join(dir, `voice.${lang}.json`), 'utf8')).lines;
    const audio = join(dir, 'audio', lang);
    mkdirSync(audio, { recursive: true });
    const treated = new Map([...(info.radio ?? []).map((line) => [line, 'radio']), ...(info.deep ?? []).map((line) => [line, 'deep'])]);
    let credits = 0;
    let index = 0;
    for (const line of lines) {
        index += 1;
        const meta = join(audio, `${line.id}.json`);
        const kind = treated.get(line.id);
        // Своя запись читает все реплики сама; иначе — голос роли реплики из состава.
        const own = cast.narrator?.kind === 'recording' ? cast.narrator : voiceForLine(cast, line, kind);
        // Озвучено тем же голосом (вторая попытка после срыва) — не заново; другим голосом или тишиной — заново.
        if (existsSync(meta) && !only?.includes(line.id) && voiceOf(meta) === (silent ? 'silent' : own.id)) continue;
        const spoken = line.speak ?? line.text;
        progress(index / lines.length, silent ? L(`Немой черновик: реплика ${index} из ${lines.length}`, `Silent draft: line ${index} of ${lines.length}`) : L(`Озвучиваю реплику ${index} из ${lines.length}`, `Voicing line ${index} of ${lines.length}`));
        if (silent) {
            silentLine(audio, line, meta);
            continue;
        }
        let file;
        let alignment = null;
        /** Откуда время знаков: от поставщика голоса, от слуха шлюза или по паузам (оценка). */
        let timing = 'pauses';
        if (own.kind === 'recording') {
            // Своя запись: файл из окна записи уже в папке — копируем на место реплики.
            const recorded = own.files?.[line.id];
            if (!recorded) throw new Error(L(`для реплики ${line.id} нет записи своим голосом`, `line ${line.id} has no recording in your own voice`));
            file = `${line.id}.wav`;
            copyFileSync(join(folder(), recorded), join(audio, file));
        } else {
            // Любой голос — одним письмом шлюзу: какой поставщик озвучит (компьютер, ElevenLabs, облако), решает шлюз по
            // голосу; ключи поставщиков — у шлюза. Расширение файла — поставщика (WAV или MP3); время слов — от
            // поставщика, а нет у него — от слуха шлюза (`words: true`).
            const to = relative(folder(), join(audio, line.id)).split('\\').join('/');
            // Соседние реплики — для интонации от реплики к реплике (ElevenLabs их берёт, компьютер — нет).
            const around = (at) => (lines[at] ? (lines[at].speak ?? lines[at].text) : undefined);
            const answer = await letter('system/voice', 'synth', { text: spoken, voice: own.id, to, lang, previous: around(index - 2), next: around(index), words: true });
            file = String(answer?.file ?? `${to}.wav`).split('/').pop();
            // Время знаков от поставщика — только если он озвучивал тот же текст, что в субтитрах; иначе — по словам.
            alignment = spoken === line.text && answer?.alignment ? answer.alignment : alignmentFromWords(line.text, answer?.words);
            if (alignment) timing = answer?.timing === 'hearing' ? 'hearing' : 'voice';
            else if (answer?.timingProblem) log('info', `слух шлюза: ${answer.timingProblem} — время слов по паузам`);
            if (answer?.paid) credits += spoken.length;
        }
        // Своя запись — у слуха шлюза (`system/hearing` → `recognize`): по распознанным словам точнее, чем по паузам;
        // слуха нет — по паузам.
        if (!alignment && own.kind === 'recording') {
            try {
                const rel = relative(folder(), join(audio, file)).split('\\').join('/');
                const recognized = await letter('system/hearing', 'recognize', { file: rel, lang });
                alignment = alignmentFromWords(line.text, recognized?.words);
                if (alignment) timing = 'hearing';
            } catch (error) {
                log('info', `слух шлюза: ${error.message} — время слов по паузам`);
            }
        }
        if (kind) {
            // Рация и угроза: обработка поверх; время знаков не меняется (длина та же).
            const raw = join(audio, `${line.id}.take${file.slice(file.lastIndexOf('.'))}`);
            copyFileSync(join(audio, file), raw);
            file = `${line.id}.wav`;
            await treatVoice(kind, raw, join(audio, file));
        }
        const bounds = await speechBounds(join(audio, file));
        if (!alignment) alignment = estimateAlignment(line.text, bounds);
        const durationSec = alignment.character_end_times_seconds.at(-1) ?? bounds.end;
        writeFileSync(meta, JSON.stringify({ text: line.text, voice: own.id, file, durationSec, alignment, timing, estimated: timing === 'pauses' }, null, 1));
    }
    await writeSpeech(dir, lang);
    if (credits) log('info', `платный голос: ~${credits} знаков на серию`);
    return credits;
}


/** Каким голосом озвучена реплика (по её JSON рядом с файлом). */
function voiceOf(metaFile) {
    try {
        return JSON.parse(readFileSync(metaFile, 'utf8')).voice ?? null;
    } catch {
        return null;
    }
}

/**
 * Реплика немого черновика: тишина длиной в реплику (≈ 14 знаков в секунду, не короче 1,2 с) и время знаков по
 * длине текста; границы «речи» записаны в JSON — в тишине ffmpeg их не найдёт.
 */
function silentLine(audio, line, metaFile) {
    const text = line.text;
    const seconds = Math.max(1.2, [...text].length / 14 + 0.4);
    const file = `${line.id}.wav`;
    writeFileSync(join(audio, file), encodeWav(new Float32Array(Math.round(seconds * RATE)), RATE));
    const bounds = { duration: Math.round(seconds * 1000) / 1000, start: 0.15, end: Math.round((seconds - 0.15) * 1000) / 1000, gaps: [] };
    const alignment = estimateAlignment(text, bounds);
    writeFileSync(metaFile, JSON.stringify({ text, voice: 'silent', file, durationSec: alignment.character_end_times_seconds.at(-1) ?? bounds.end, alignment, estimated: true, silent: true, bounds }, null, 1));
}

/** speech.json — границы речи всех реплик (по нему таймлайн срезает тишину). */
export async function writeSpeech(dir, lang) {
    const audio = join(dir, 'audio', lang);
    const lines = JSON.parse(readFileSync(join(dir, `voice.${lang}.json`), 'utf8')).lines;
    const out = {};
    for (const line of lines) {
        const metaFile = join(audio, `${line.id}.json`);
        if (!existsSync(metaFile)) continue;
        const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
        out[line.id] = meta.bounds ?? (await speechBounds(join(audio, meta.file ?? `${line.id}.mp3`)));
    }
    writeFileSync(join(audio, 'speech.json'), `${JSON.stringify(out, null, 1)}\n`);
}

/** Сколько кредитов ElevenLabs займут неозвученные реплики. */
export function creditsAhead(dir, info) {
    const lang = info.lang ?? 'ru';
    const lines = JSON.parse(readFileSync(join(dir, `voice.${lang}.json`), 'utf8')).lines;
    return lines.filter((line) => !existsSync(join(dir, 'audio', lang, `${line.id}.json`))).reduce((sum, line) => sum + (line.speak ?? line.text).length, 0);
}
