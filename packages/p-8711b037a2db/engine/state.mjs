// Состояние «Ленты» — один файл feed.json в своей папке приложения (series-feed tools/feed.ts, перенесено): что
// выбрано при знакомстве, сериалы, серии, оценки, выбор на развилках, пожелания. Вкус ленты — то, что из этого
// следует, словами. Запись — целиком через временный файл: окно и сборка пишут почти одновременно.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP } from './host.mjs';
import { L } from './i18n.mjs';

export const ID = /^[a-z0-9][a-z0-9-]*$/;
/** Причины «Не нравится» — кнопками в окне. */
export const REASONS = ['скучно', 'непонятно', 'страшно', 'голос', 'картинка', 'длинно', 'не моё'];

export function folder() {
    if (!APP.files) throw new Error('нет своей папки (DUOWAVE_APP_FILES)');
    mkdirSync(APP.files, { recursive: true });
    return APP.files;
}

export const statePath = () => join(folder(), 'feed.json');
export const episodeDir = (id) => join(folder(), 'episodes', id);
export const seriesDir = (id) => join(folder(), 'series', id);

export function blank() {
    return {
        schema: 1,
        introduced: false,
        lang: 'ru',
        /** «Обычно» (data) или «Режиссёр» (director). */
        mode: 'data',
        voice: { id: 'piper/denis', kind: 'computer', title: 'Денис', license: 'CC0', publish: true },
        /** Сколько последних серий хранить роликами; у старых — только текст. */
        keep: 30,
        /** Память DuoWave: выключена; включённая — только интересы дома, по «да» владельца на связь шины. */
        memory: false,
        /** Снимать следующую серию сразу после выбора на развилке (заранее). */
        ahead: false,
        /** Снимать серию ночью, к утру, если последнюю посмотрели и выбрали. */
        night: false,
        /** Какая модель писала последней: облачная — янтарём рядом с памятью. */
        lastModel: null,
        /** Своя модель «Ленты» из моделей пульта ({provider, model}); null — «Умная» «Мозга». */
        model: null,
        /** Потолок на серию в кредитах ElevenLabs и расход. */
        budget: { perEpisodeCredits: 1500, spentCredits: 0, tokensIn: 0, tokensOut: 0, episodesToday: 0, day: '' },
        series: [],
        current: null,
        episodes: [],
        events: [],
    };
}

export function load() {
    const path = statePath();
    if (!existsSync(path)) return blank();
    try {
        return { ...blank(), ...JSON.parse(readFileSync(path, 'utf8')) };
    } catch {
        // Испорченный файл не роняет ленту: прежний — рядом, начинаем с чистого.
        renameSync(path, `${path}.broken-${Date.now()}`);
        return blank();
    }
}

export function save(state) {
    const path = statePath();
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 1)}\n`);
    renameSync(tmp, path);
}

/** Изменить состояние: прочитать свежее, поправить, записать. */
export function update(change) {
    const state = load();
    const result = change(state);
    save(state);
    return result;
}

export function findEpisode(state, id) {
    const episode = state.episodes.find((one) => one.id === id);
    if (!episode) throw new Error(L(`нет серии ${id}`, `no episode ${id}`));
    return episode;
}

export function currentSeries(state) {
    return state.series.find((one) => one.id === state.current) ?? state.series.at(-1) ?? null;
}

export function episodesOf(state, series) {
    return state.episodes.filter((one) => one.series === series).sort((a, b) => a.n - b.n);
}

/** id нового сериала из названия: латиница, по-русски — транслитом. */
export function slug(title, taken) {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
    const base =
        String(title)
            .toLowerCase()
            .split('')
            .map((c) => map[c] ?? c)
            .join('')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 24) || 'serial';
    let id = base;
    for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
    return id;
}

/** Оценка, выбор, пожелание — в серию и в журнал событий ленты. */
export function apply(state, event) {
    if (event.type === 'rate') {
        const episode = findEpisode(state, event.id);
        if (event.value !== 'like' && event.value !== 'dislike') throw new Error('оценка — like или dislike');
        episode.rating = event.value;
        episode.reasons = (event.reasons ?? []).filter((reason) => REASONS.includes(reason));
        if (event.note?.trim()) episode.note = event.note.trim().slice(0, 500);
    } else if (event.type === 'choose') {
        if (event.value !== 'a' && event.value !== 'b') throw new Error('выбор — a или b');
        findEpisode(state, event.id).chosen = event.value;
    } else if (event.type !== 'wish') {
        throw new Error('событие — rate, choose или wish');
    }
    // Передумал — остаётся последнее.
    state.events = state.events.filter(
        (old) => old.id !== event.id || old.type !== event.type || (event.type === 'wish' && old.value !== event.value),
    );
    state.events.push({ at: new Date().toISOString(), id: event.id, type: event.type, value: String(event.value ?? '').slice(0, 1000) });
    state.events = state.events.slice(-500);
}

/** Вкус ленты словами: что нравится и не нравится — облики, направления, причины, пожелания. */
export function taste(state) {
    const lines = [];
    const tally = (key) => {
        const counts = new Map();
        for (const episode of state.episodes) {
            if (!episode.rating || !episode[key]) continue;
            const [likes, dislikes] = counts.get(episode[key]) ?? [0, 0];
            counts.set(episode[key], episode.rating === 'like' ? [likes + 1, dislikes] : [likes, dislikes + 1]);
        }
        return [...counts].map(([name, [likes, dislikes]]) => `${name} (+${likes} / −${dislikes})`).join(', ');
    };
    const looks = tally('look');
    const directions = tally('direction');
    if (looks) lines.push(L(`облики: ${looks}`, `looks: ${looks}`));
    if (directions) lines.push(L(`направления: ${directions}`, `directions: ${directions}`));
    const reasons = new Map();
    for (const episode of state.episodes) for (const reason of episode.reasons ?? []) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    if (reasons.size) lines.push(L(`не нравится: ${[...reasons].map(([reason, n]) => `${reason} ×${n}`).join(', ')}`, `dislikes: ${[...reasons].map(([reason, n]) => `${reason} ×${n}`).join(', ')}`));
    for (const episode of state.episodes) if (episode.note) lines.push(`«${episode.title}»: ${episode.note}`);
    for (const wish of new Set(state.events.filter((event) => event.type === 'wish').map((event) => event.value))) lines.push(L(`пожелание: ${wish}`, `wish: ${wish}`));
    return lines;
}

/** «Что лента о вас знает» — забыть: оценки, пожелания или всё, что о вкусе. */
export function forget(state, what) {
    if (what === 'wishes' || what === 'all') state.events = state.events.filter((event) => event.type !== 'wish');
    if (what === 'ratings' || what === 'all') {
        for (const episode of state.episodes) {
            delete episode.rating;
            delete episode.reasons;
            delete episode.note;
        }
        state.events = state.events.filter((event) => event.type !== 'rate');
    }
}

/** Ролики старше последних `keep` серий уходят; текст серии остаётся. */
export function prune(state) {
    const withVideo = state.episodes.filter((one) => one.file).sort((a, b) => (b.builtAt ?? '').localeCompare(a.builtAt ?? ''));
    for (const old of withVideo.slice(Math.max(1, state.keep))) {
        const dir = episodeDir(old.id);
        for (const name of ['episode.mp4', 'raw.mp4']) rmSync(join(dir, name), { force: true });
        rmSync(join(dir, 'audio'), { recursive: true, force: true });
        delete old.file;
        old.archived = true;
    }
}

/** Сколько места занимают ролики (байты) — рядом с настройкой «хранить N серий». */
export function bytesOfVideos(state) {
    let total = 0;
    for (const episode of state.episodes) {
        try {
            if (episode.file) total += statSize(join(folder(), episode.file));
        } catch {
            // нет файла — нет места
        }
    }
    return total;
}

function statSize(path) {
    return existsSync(path) ? statSync(path).size : 0;
}

/** Серия для окна: то, что ему нужно, без служебного. */
export function view(episode) {
    return {
        id: episode.id,
        series: episode.series,
        n: episode.n,
        title: episode.title,
        logline: episode.logline,
        look: episode.look,
        mode: episode.mode,
        file: episode.file ?? null,
        poster: episode.poster ?? null,
        durationSec: episode.durationSec ?? null,
        choice: episode.choice ?? null,
        choiceAt: episode.choiceAt ?? null,
        branchTimes: episode.branchTimes ?? null,
        wrong: episode.wrong ?? null,
        after: episode.after ?? null,
        chosen: episode.chosen ?? null,
        rating: episode.rating ?? null,
        reasons: episode.reasons ?? [],
        note: episode.note ?? null,
        silent: !!episode.silent,
        voice: episode.voice ?? null,
        checks: episode.checks ?? [],
        builtAt: episode.builtAt ?? null,
        archived: !!episode.archived,
        watch: episode.watch ?? null,
        publicVotes: episode.publicVotes ?? null,
        credits: episode.credits ?? 0,
        tokens: episode.tokens ?? null,
    };
}
