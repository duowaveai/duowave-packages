// Снять серию — долгая задача шлюза (этап 6): сценарий (обычно — данными от Мозга, режиссёр — кодом агента), озвучка,
// звук, рендер, громкость −14 LUFS, кадр-обложка, проверки, запись в ленту, «серия готова». Ход в процентах и
// словах видит окно и карточка стола; «Отменить» обрывает работу в ближайшей точке.

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { check } from './checks.mjs';
import { directEpisode } from './director.mjs';
import { Cancelled, letter, log, notify, say, settings } from './host.mjs';
import { browserReady, bundleOnce, composition, finish, poster, renderRemote, renderVideo } from './render.mjs';
import { baseSounds } from './sound.mjs';
import { currentSeries, episodeDir, episodesOf, load, prune, seriesDir, taste, update } from './state.mjs';
import { castOf, castPaid, castVoice, castVoices, mergeCast, oneVoice } from './cast.mjs';
import { L } from './i18n.mjs';
import { NO_VOICE, cloudFallback, creditsAhead, gatewayVoices, voiceEpisode } from './voice.mjs';
import { writeEpisode } from './writer.mjs';

const write = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** Сколько серий режиссёр снял сегодня — потолок в день. */
function today() {
    return new Date().toISOString().slice(0, 10);
}

/** Серия обычным режимом: файлы серии из ответа Мозга. */
async function asData({ state, series, n, id, dir, after, wish, world, task }) {
    // Память — только когда человек её включил; связь с памятью шлюз спросит у владельца «да» сам.
    let interests = [];
    if (state.memory) {
        try {
            interests = (await letter('system/memory', 'interests')).interests ?? [];
        } catch (error) {
            log('warn', `память: ${error.message}`);
        }
    }
    // Состав голосов: в первой серии (или пока его нет, или пожелание про голос) модель подбирает его из голосов шлюза.
    const cast = castOf(series, state.voice);
    const choosing = n === 1 || !series.cast || /голос|voice/i.test(`${wish ?? ''} ${n === 1 ? series.pitch ?? '' : ''}`);
    const voices = choosing ? await gatewayVoices().catch((error) => (log('info', `голоса для состава: ${error.message}`), [])) : [];
    // Ответ модели сразу проверяет библиотека картинки: её слова об ошибке идут модели во вторую попытку.
    const serveUrl = await bundleOnce();
    const check = async (episode) => {
        const data = { id, series: series.id, n, lang: state.lang, look: series.look, ...episode.data };
        // Библиотека читает реплики серии из её папки: они должны лежать там до проверки.
        write(join(dir, `voice.${state.lang}.json`), { lang: state.lang, lines: episode.lines });
        try {
            await composition(serveUrl, 'data', { episode: data });
        } catch (error) {
            throw new Error(`картинка не собирается: ${String(error.message ?? error).slice(0, 600)}`);
        }
    };
    const written = await writeEpisode({
        check,
        interests,
        model: state.model,
        signal: task?.signal,
        state,
        series,
        world,
        n,
        after,
        look: series.look,
        lang: state.lang,
        pitch: series.pitch,
        wish,
        cast,
        voices,
    });
    if (written.cast) {
        update((fresh) => {
            const own = fresh.series.find((one) => one.id === series.id);
            if (own) own.cast = mergeCast(own.cast, written.cast);
        });
        log('info', `состав голосов «${series.title ?? series.id}»: ${castVoices(castOf({ cast: mergeCast(series.cast, written.cast) }, state.voice)).map((voice) => voice.title).join(', ')}`);
    }
    write(join(dir, `voice.${state.lang}.json`), { lang: state.lang, lines: written.lines });
    write(join(dir, 'data.json'), { id, series: series.id, n, lang: state.lang, look: series.look, ...written.data });
    write(join(dir, 'episode.json'), {
        id,
        series: series.id,
        n,
        lang: state.lang,
        look: series.look,
        mode: 'data',
        ...written.info,
        after: after ? { id: after.id, chosen: after.chosen } : undefined,
        radio: written.radio,
        deep: written.deep,
        // Сценарий готов: сорвётся дальше (голос, рисование) — вторая попытка с той же развилкой его не пишет заново.
        scripted: { at: new Date().toISOString(), after: after?.id ?? null, chosen: after?.chosen ?? null, wish: wish ?? null, seriesTitle: n === 1 ? written.series?.title ?? written.info.title ?? null : null },
    });
    // Мир сериала: в первой серии — пять строк, потом по строке-две после каждой.
    const worldFile = join(seriesDir(series.id), 'world.md');
    mkdirSync(seriesDir(series.id), { recursive: true });
    if (n === 1 && written.series?.world) writeFileSync(worldFile, `${String(written.series.world).trim()}\n`);
    if (written.worldAdd) appendFileSync(worldFile, `- серия ${n}: ${written.worldAdd.trim()}\n`);
    return { tokens: written.tokens, model: written.model, seriesTitle: n === 1 ? written.series?.title ?? written.info.title : null };
}

/** Серия режиссёром: агент пишет файлы сам; проверено — серия кодом есть. Две попытки. */
async function asDirector({ state, series, n, id, dir, after, wish, world, task }) {
    const previous = episodesOf(state, series.id)
        .map((episode) => `Серия ${episode.n} «${episode.title}»: ${episode.logline}`)
        .join('\n');
    for (let attempt = 1; attempt <= 2; attempt++) {
        await task.step(4 + attempt * 6, attempt === 1 ? L('Режиссёр пишет серию', 'The director is writing the episode') : L('Режиссёр пробует ещё раз', 'The director tries again'));
        try {
            const answer = await directEpisode({ id, series, n, look: series.look, lang: state.lang, pitch: series.pitch, world, previous, taste: taste(state), wish, after, model: state.model, signal: task.signal });
            const ready = ['episode.json', `voice.${state.lang}.json`, 'code/Episode.tsx'].every((name) => existsSync(join(dir, name)));
            if (ready) {
                const info = readJson(join(dir, 'episode.json'));
                write(join(dir, 'episode.json'), { ...info, id, series: series.id, n, lang: state.lang, look: info.look ?? series.look, mode: 'code', after: after ? { id: after.id, chosen: after.chosen } : undefined });
                return { tokens: null, model: null, steps: answer.steps };
            }
            log('warn', `режиссёр, попытка ${attempt}: файлов серии нет`);
        } catch (error) {
            // «Стоп» — без второй попытки и без «обычного режима» вместо неё.
            if (error instanceof Cancelled || task.cancelled) throw new Cancelled();
            log('warn', `режиссёр, попытка ${attempt}: ${error.message}`);
        }
    }
    return null;
}

/**
 * Голос серии для окна и поста: рассказчик, а если кто-то из состава только для себя — он (его и называет предупреждение
 * «только для себя» в «Поделиться»); публиковать можно, когда можно всем.
 */
function episodeVoice(cast) {
    const voices = castVoices(cast);
    const blocking = voices.find((voice) => voice.kind !== 'recording' && !voice.publish);
    const shown = blocking ?? cast.narrator;
    return { id: shown.id, title: shown.title, license: shown.license, publish: !blocking, kind: shown.kind };
}

/**
 * Состав для переозвучки голосом `voice`: рассказчик — он; кто в составе только для себя, тоже уступает ему (второй —
 * его паре), если сам `voice` можно публиковать. Своя запись читает всё сама.
 */
function revoiceCast(series, voice) {
    if (voice.kind === 'recording') return oneVoice(voice);
    const narrator = castVoice(voice);
    const stored = series?.cast ?? {};
    // Голос, который можно публиковать, заменяет тех, кого нельзя; иначе состав остаётся как был.
    const keep = (one) => (one && (one.publish || !narrator.publish) ? castVoice(one) : null);
    return {
        narrator,
        second: keep(stored.second) ?? oneVoice(narrator).second,
        characters: Object.fromEntries(Object.entries(stored.characters ?? {}).map(([name, one]) => [name, keep(one) ?? narrator])),
    };
}

/**
 * Переозвучить готовую серию другим голосом или своей записью (окно «Поделиться» с голосом «только для себя»): реплики
 * те же, озвучка заново, рендер заново. Новая озвучка остаётся у серии — в ленте человек слышит её.
 */
export async function revoice(task, { id, voice }) {
    const state = load();
    const episode = state.episodes.find((one) => one.id === id);
    if (!episode) throw new Error(L(`нет серии ${id}`, `no episode ${id}`));
    const dir = episodeDir(id);
    const info = readJson(join(dir, 'episode.json'));
    // Состав сериала с этим рассказчиком (переозвучка голосом, который можно публиковать, меняет и тех, кого нельзя).
    let cast = revoiceCast(state.series.find((one) => one.id === episode.series), voice);
    await task.step(3, voice.kind === 'recording' ? L('Ставлю вашу запись', 'Putting in your recording') : L('Переозвучиваю', 'Re-voicing'));
    rmSync(join(dir, 'audio'), { recursive: true, force: true });
    let credits;
    try {
        credits = await voiceEpisode(dir, info, cast, { progress: (share, text) => task.tick(3 + share * 30, text) });
    } catch (error) {
        // Голосов компьютера нет, а у шлюза есть облачный голос (ключ ElevenLabs в пульте) — озвучивает он и остаётся
        // голосом «Ленты» (как в съёмке).
        if (error instanceof Cancelled || !NO_VOICE.test(String(error?.message ?? error))) throw error;
        const cloud = await cloudFallback();
        if (!cloud) throw error;
        voice = cloud;
        cast = oneVoice(cloud);
        update((fresh) => {
            fresh.voice = cloud;
        });
        await task.step(5, L(`Озвучиваю облачным голосом: ${voice.title}`, `Voicing with a cloud voice: ${voice.title}`));
        rmSync(join(dir, 'audio'), { recursive: true, force: true });
        credits = await voiceEpisode(dir, info, cast, { progress: (share, text) => task.tick(5 + share * 28, text) });
    }
    if (task.cancelled) throw new Cancelled();
    baseSounds(dir);
    const serveUrl = await bundleOnce((share) => task.tick(34 + share * 6, L('Готовлю картинку', 'Preparing the picture')));
    const raw = join(dir, 'raw.mp4');
    const mode = info.mode === 'code' ? 'code' : 'data';
    const props = mode === 'data' ? { episode: readJson(join(dir, 'data.json')) } : {};
    const comp = await renderVideo(serveUrl, mode === 'data' ? 'data' : id, props, raw, {
        progress: (share) => task.tick(40 + share * 50, L(`Рисую серию заново — ${Math.round(share * 100)} %`, `Drawing the episode again — ${Math.round(share * 100)} %`)),
        cancelled: () => task.cancelled,
        waiting: () => task.tick(40, L('Жду: дорисовывается копия для отправки', 'Waiting: the copy to send is being drawn')),
    });
    if (task.cancelled) throw new Cancelled();
    await task.step(92, L('Свожу громкость', 'Evening out the loudness'));
    const out = join(dir, 'episode.mp4');
    const { silent } = await finish(raw, out);
    rmSync(raw, { force: true });
    await poster(out, join(dir, 'poster.jpg'));
    const checked = await check(out, { dir, lang: info.lang ?? load().lang });
    const kept = voice.kind === 'recording' ? { id: voice.id, title: voice.title, license: voice.license, publish: true, kind: voice.kind } : episodeVoice(cast);
    update((fresh) => {
        const own = fresh.episodes.find((one) => one.id === id);
        if (!own) return;
        Object.assign(own, { voice: kept, voices: voice.kind === 'recording' ? [kept] : castVoices(cast), durationSec: checked.durationSec, checks: checked.checks, choiceAt: comp?.props?.choiceAt ?? own.choiceAt, branchTimes: comp?.props?.branchTimes ?? own.branchTimes });
        // Был немым черновиком — теперь с голосом: пометка и слова о черновике уходят.
        own.silent = silent;
        if (typeof own.note === 'string') own.note = own.note.replace(/\s*(Немой черновик|Silent draft):[^]*$/, '').trim() || null;
        own.credits = (own.credits ?? 0) + credits;
        fresh.budget.spentCredits += credits;
    });
    // Прежняя копия для отправки — с прежним голосом: её больше нет.
    rmSync(join(dir, '..', '..', 'share', `${id}.mp4`), { force: true });
    return { id, voice: kept };
}

/**
 * Отрендерить серию, файлы которой уже лежат в её папке (data.json или code/, реплики; озвучка — если есть, иначе
 * немой черновик): проверка библиотеки и рендера без модели и голосов. Разработчику — `node engine/cli.mjs render <id>`.
 */
export async function renderPrepared(id, { progress = () => {} } = {}) {
    const dir = episodeDir(id);
    const info = readJson(join(dir, 'episode.json'));
    baseSounds(dir);
    await browserReady((share, text) => progress(share * 0.05, text));
    const serveUrl = await bundleOnce((share) => progress(0.05 + share * 0.1, L('Готовлю картинку', 'Preparing the picture')));
    const raw = join(dir, 'raw.mp4');
    const mode = info.mode === 'code' ? 'code' : 'data';
    const props = mode === 'data' ? { episode: readJson(join(dir, 'data.json')) } : {};
    const started = Date.now();
    const comp = await renderVideo(serveUrl, mode === 'data' ? 'data' : id, props, raw, { progress: (share) => progress(0.15 + share * 0.8, L('Рисую', 'Drawing')) });
    const seconds = (Date.now() - started) / 1000;
    const out = join(dir, 'episode.mp4');
    const { silent } = await finish(raw, out);
    rmSync(raw, { force: true });
    await poster(out, join(dir, 'poster.jpg'));
    const checked = await check(out, { dir, lang: info.lang ?? load().lang });
    return { id, frames: comp.durationInFrames, renderSeconds: seconds, fps: comp.durationInFrames / seconds, silent, choiceAt: comp.props?.choiceAt ?? null, branchTimes: comp.props?.branchTimes ?? null, checks: checked.checks };
}

/**
 * Сценарий прошлой попытки той же серии, если он цел и написан для той же развилки и пожелания: модель второй раз
 * не платится. Иначе — null, и серия пишется с чистого листа.
 */
function scripted(dir, { after, wish, lang }) {
    const file = join(dir, 'episode.json');
    if (!existsSync(file) || !existsSync(join(dir, 'data.json')) || !existsSync(join(dir, `voice.${lang}.json`))) return null;
    let info;
    try {
        info = readJson(file);
    } catch {
        return null;
    }
    const mark = info.scripted;
    if (!mark || info.mode !== 'data') return null;
    if ((mark.after ?? null) !== (after?.id ?? null) || (mark.chosen ?? null) !== (after?.chosen ?? null) || (mark.wish ?? null) !== (wish ?? null)) return null;
    return { tokens: null, model: null, seriesTitle: mark.seriesTitle ?? null };
}

/** Снять следующую серию текущего сериала. */
export async function shoot(task, { wish, prepared } = {}) {
    const state = load();
    const series = currentSeries(state);
    if (!series) throw new Error(L('сериала ещё нет — пройдите знакомство', 'there is no series yet — go through the introduction'));
    const all = episodesOf(state, series.id);
    const last = all.at(-1);
    // Серия, которую код уже написал (свой Claude Code через MCP): её id и номер — из её описания.
    const ready = prepared ? readJson(join(episodeDir(prepared), 'episode.json')) : null;
    const n = ready?.n ?? (last?.n ?? 0) + 1;
    const id = prepared || `${series.id}-${String(n).padStart(2, '0')}`;
    const after = last?.choice ? { id: last.id, n: last.n, q: last.choice.q, chosen: last.chosen ?? null } : null;
    const dir = episodeDir(id);
    let mode = prepared ? 'prepared' : state.mode === 'director' ? 'director' : 'data';
    // Прошлая попытка той же серии сорвалась после сценария (не было голоса, «Стоп» на рисовании) — сценарий берём её.
    const kept = mode === 'data' ? scripted(dir, { after, wish, lang: state.lang }) : null;
    if (!prepared && !kept) {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
    }
    const worldFile = join(seriesDir(series.id), 'world.md');
    const world = existsSync(worldFile) ? readFileSync(worldFile, 'utf8') : '';
    const options = await settings();
    const perDay = Number(options.directorPerDay ?? 5);
    let note = null;
    if (mode === 'director' && state.budget.day === today() && state.budget.episodesToday >= perDay) {
        mode = 'data';
        note = L(`Режиссёр сегодня уже снял ${perDay} серий (потолок в день) — эта снята обычным режимом.`, `The director has already shot ${perDay} episodes today (the daily cap) — this one was shot in normal mode.`);
    }
    await task.step(2, L('Пишу серию', 'Writing the episode'));
    let written = null;
    if (mode === 'director') {
        // Режиссёр пишет до 20 минут: ход ползёт, «Стоп» слышен сразу.
        const beat = task.waiting(10, 22, L('Режиссёр пишет серию', 'The director is writing the episode'), 600);
        try {
            written = await asDirector({ state, series, n, id, dir, after, wish, world, task });
        } finally {
            beat();
        }
        if (!written) {
            mode = 'data';
            note = L('Режиссёр сорвался дважды — эту серию сняли обычным режимом.', 'The director failed twice — this episode was shot in normal mode.');
            await say(note);
        }
    }
    if (mode === 'data' && kept) {
        written = kept;
        log('info', `серия ${id}: сценарий прошлой попытки цел — модель не зову`);
        await task.step(22, L('Сценарий уже написан — беру его', 'The script is already written — taking it'));
    } else if (mode === 'data') {
        // Модель пишет сценарий минуту-две: ход ползёт, «Стоп» слышен сразу, а не когда она допишет.
        const beat = task.waiting(2, 22, L('Пишу серию: модель думает', 'Writing the episode: the model is thinking'), 90);
        try {
            written = await asData({ state, series, n, id, dir, after, wish, world, task });
        } finally {
            beat();
        }
    }
    if (mode === 'prepared') {
        if (!existsSync(join(dir, 'code', 'Episode.tsx'))) throw new Error(`нет episodes/${id}/code/Episode.tsx`);
        mode = 'director';
    }
    const info = readJson(join(dir, 'episode.json'));
    await task.step(24, L('Озвучиваю', 'Voicing'));
    // Состав голосов сериала — как он стал после сценария (модель могла его подобрать).
    const now = load();
    let cast = castOf(now.series.find((one) => one.id === series.id) ?? series, now.voice);
    let voice = cast.narrator;
    if (castPaid(cast)) {
        const ahead = creditsAhead(dir, info);
        if (ahead > state.budget.perEpisodeCredits) {
            throw new Error(L(`озвучка — ~${ahead} знаков платного голоса, больше потолка на серию (${state.budget.perEpisodeCredits})`, `voicing — ~${ahead} characters of a paid voice, over the cap per episode (${state.budget.perEpisodeCredits})`));
        }
    }
    let credits;
    let draft = false;
    try {
        credits = await voiceEpisode(dir, info, cast, { progress: (share, text) => task.tick(24 + share * 20, text) });
    } catch (error) {
        if (error instanceof Cancelled || !NO_VOICE.test(String(error?.message ?? error))) throw error;
        // Голосов компьютера нет. У шлюза есть облачный голос (ключ ElevenLabs в пульте) — серию озвучивает он, и его
        // голос остаётся голосом «Ленты»: сервер голоса тогда не нужен вовсе.
        const cloud = await cloudFallback();
        const fits = cloud && (!cloud.paid || creditsAhead(dir, info) <= state.budget.perEpisodeCredits);
        if (fits) {
            voice = cloud;
            cast = oneVoice(cloud);
            update((fresh) => {
                fresh.voice = cloud;
            });
            note = [note, L(`Голоса компьютера нет — озвучил облачный голос: ${voice.title}; он теперь голос «Ленты».`, `No computer voice — a cloud voice voiced it: ${voice.title}; it is now the Feed’s voice.`)].filter(Boolean).join(' ');
            log('info', `серия ${id}: голосов компьютера нет — озвучивает облачный голос (${voice.title})`);
            await task.step(26, L(`Озвучиваю облачным голосом: ${voice.title}`, `Voicing with a cloud voice: ${voice.title}`));
            credits = await voiceEpisode(dir, info, cast, { progress: (share, text) => task.tick(26 + share * 18, text) });
        }
    }
    if (!draft && credits === undefined) {
        // Голосов нет совсем: серия всё равно собирается — немым черновиком, с фоном и субтитрами; голос ей даст
        // «Озвучить», когда он появится. Сценарий и деньги на модель не пропадают.
        draft = true;
        note = [note, L('Немой черновик: голосов нет. Поставьте голос («Персонаж» → «Голос») или вставьте ключ ElevenLabs в пульте («Голос» → «Облачные голоса») — и «Озвучить».', 'Silent draft: no voices. Install a voice (“Character” → “Voice”) or paste an ElevenLabs key in the panel (“Voice” → “Cloud voices”) — then “Voice it”.')].filter(Boolean).join(' ');
        log('warn', `серия ${id}: голосов нет — немой черновик`);
        await task.step(26, L('Голосов нет — собираю немой черновик', 'No voices — making a silent draft'));
        credits = await voiceEpisode(dir, info, voice, { silent: true, progress: (share, text) => task.tick(26 + share * 18, text) });
    }
    if (task.cancelled) throw new Cancelled();
    await task.step(45, L('Собираю звук', 'Putting the sound together'));
    baseSounds(dir);
    const raw = join(dir, 'raw.mp4');
    let comp;
    if (options.renderServer) {
        // Свой сервер рендера (этап 10): картинку рисует он, громкость и проверки — здесь.
        comp = await renderRemote(options.renderServer, options.renderKey ?? '', dir, id, mode === 'data' ? 'data' : 'code', raw, {
            progress: (share, text) => task.tick(46 + share * 46, text),
        });
    } else {
        await browserReady((share, text) => task.tick(46 + share * 3, text));
        const serveUrl = await bundleOnce((share) => task.tick(49 + share * 5, L('Готовлю картинку', 'Preparing the picture')));
        await task.step(55, L('Рисую серию', 'Drawing the episode'));
        const props = mode === 'data' ? { episode: readJson(join(dir, 'data.json')) } : {};
        comp = await renderVideo(serveUrl, mode === 'data' ? 'data' : id, props, raw, {
            progress: (share) => task.tick(55 + share * 37, L(`Рисую серию — ${Math.round(share * 100)} %`, `Drawing the episode — ${Math.round(share * 100)} %`)),
            cancelled: () => task.cancelled,
            waiting: () => task.tick(55, L('Жду: дорисовывается копия для отправки', 'Waiting: the copy to send is being drawn')),
        });
    }
    if (task.cancelled) throw new Cancelled();
    await task.step(93, L('Свожу громкость', 'Evening out the loudness'));
    const out = join(dir, 'episode.mp4');
    const { silent } = await finish(raw, out);
    rmSync(raw, { force: true });
    await poster(out, join(dir, 'poster.jpg'));
    await task.step(97, L('Проверяю', 'Checking'));
    const checked = await check(out, { dir, lang: state.lang });
    const lines = readJson(join(dir, `voice.${state.lang}.json`)).lines;
    const episode = {
        id,
        series: series.id,
        n,
        lang: state.lang,
        title: info.title,
        logline: info.logline,
        direction: info.direction,
        look: info.look ?? series.look,
        mode,
        choice: info.choice ?? null,
        after: info.after ?? null,
        file: `episodes/${id}/episode.mp4`,
        poster: `episodes/${id}/poster.jpg`,
        durationSec: checked.durationSec,
        checks: checked.checks,
        credits,
        tokens: written?.tokens ?? null,
        voice: draft ? { id: 'silent', title: L('без голоса', 'no voice'), license: null, publish: true, kind: 'silent' } : episodeVoice(cast),
        voices: draft ? [] : castVoices(cast),
        silent: silent || draft,
        builtAt: new Date().toISOString(),
        choiceAt: comp?.props?.choiceAt ?? null,
        branchTimes: comp?.props?.branchTimes ?? null,
        wrong: mode === 'data' ? (readJson(join(dir, 'data.json')).branches?.wrong ?? null) : (info.wrong ?? null),
        linesText: lines.map((line) => line.text).join(' ').slice(0, 1500),
        note,
    };
    update((fresh) => {
        fresh.episodes = [...fresh.episodes.filter((one) => one.id !== id), episode];
        const own = fresh.series.find((one) => one.id === series.id);
        if (own && written?.seriesTitle) own.title = written.seriesTitle;
        if (written?.model) fresh.lastModel = written.model;
        fresh.budget.spentCredits += credits;
        if (written?.tokens) {
            fresh.budget.tokensIn += written.tokens.input ?? 0;
            fresh.budget.tokensOut += written.tokens.output ?? 0;
        }
        if (mode === 'director') {
            if (fresh.budget.day !== today()) Object.assign(fresh.budget, { day: today(), episodesToday: 0 });
            fresh.budget.episodesToday += 1;
        }
        prune(fresh);
    });
    if (options.announce !== false) {
        const words = L(`Серия готова: «${episode.title}», серия ${n}.`, `Episode ready: “${episode.title}”, episode ${n}.`);
        await say(words);
        await notify(`${words} ${episode.logline ?? ''}`.trim());
    }
    return { id, n, title: episode.title, note };
}
