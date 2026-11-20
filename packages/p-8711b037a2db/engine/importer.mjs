// Серии эксперимента series-feed — в «Ленту» без трат (проверка этапа 6 плана: «на 14 сериях теста»): готовые
// ролики, реплики и развилки, оценки и выбор из его feed.json. Серии кодом — как серии режиссёра: их код не
// переносится (он писан под библиотеку эксперимента), ролик уже готов.
//
//   DUOWAVE_APP_FILES=<папка приложения> node engine/cli.mjs import <папка series-feed>

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { duration } from './ffmpeg.mjs';
import { poster } from './render.mjs';
import { episodeDir, seriesDir, update } from './state.mjs';

const LOOKS = { 'витраж': 'glass', glass: 'glass', 'ризограф': 'riso', riso: 'riso', 'тушь': 'ink', ink: 'ink', 'пиксели': 'pixel', pixel: 'pixel', 'бумага': 'papercut', papercut: 'papercut', 'терминал': 'ascii', ascii: 'ascii' };

export async function importSeriesFeed(source) {
    const episodesDir = join(source, 'feed', 'episodes');
    const renders = join(source, 'feed', 'renders');
    if (!existsSync(episodesDir) || !existsSync(renders)) throw new Error(`${source}: нет feed/episodes или feed/renders`);
    const old = existsSync(join(source, 'feed', 'feed.json')) ? JSON.parse(readFileSync(join(source, 'feed', 'feed.json'), 'utf8')) : { episodes: [] };
    const imported = [];
    for (const id of readdirSync(episodesDir).sort()) {
        const info = join(episodesDir, id, 'episode.json');
        const video = join(renders, `${id}.mp4`);
        if (!existsSync(info) || !existsSync(video)) continue;
        const meta = JSON.parse(readFileSync(info, 'utf8'));
        const dir = episodeDir(id);
        mkdirSync(dir, { recursive: true });
        copyFileSync(video, join(dir, 'episode.mp4'));
        for (const name of ['voice.ru.json', 'voice.en.json']) if (existsSync(join(episodesDir, id, name))) copyFileSync(join(episodesDir, id, name), join(dir, name));
        await poster(join(dir, 'episode.mp4'), join(dir, 'poster.jpg'));
        const length = duration(join(dir, 'episode.mp4'));
        // Карточки развилки — с последней реплики: длина − хвост (3,6 с) − её длина.
        const voice = existsSync(join(dir, 'voice.ru.json')) ? JSON.parse(readFileSync(join(dir, 'voice.ru.json'), 'utf8')) : { lines: [] };
        const lastLine = voice.lines.at(-1)?.id;
        const lastMeta = lastLine ? join(episodesDir, id, 'audio', 'ru', `${lastLine}.json`) : null;
        const lastLength = lastMeta && existsSync(lastMeta) ? Number(JSON.parse(readFileSync(lastMeta, 'utf8')).durationSec ?? 4) : 4;
        const was = old.episodes?.find((one) => one.id === id) ?? {};
        writeFileSync(join(dir, 'episode.json'), `${JSON.stringify({ ...meta, mode: 'code', lang: 'ru' }, null, 1)}\n`);
        const record = {
            id,
            series: meta.series,
            n: meta.n,
            lang: 'ru',
            title: meta.title,
            logline: meta.logline,
            direction: meta.direction,
            look: LOOKS[meta.look] ?? meta.look,
            mode: 'code',
            choice: meta.choice ?? null,
            after: meta.after ?? null,
            file: `episodes/${id}/episode.mp4`,
            poster: `episodes/${id}/poster.jpg`,
            durationSec: length,
            checks: was.checks ?? [],
            credits: was.credits ?? 0,
            voice: { id: 'elevenlabs', kind: 'elevenlabs', title: 'ElevenLabs (тест)', license: 'ElevenLabs', publish: true },
            silent: !!was.silent,
            builtAt: was.builtAt ?? new Date().toISOString(),
            choiceAt: meta.choice ? Math.max(0, length - 3.6 - lastLength - 0.1) : null,
            branchTimes: null,
            linesText: voice.lines.map((line) => line.text).join(' ').slice(0, 1500),
            rating: was.rating,
            note: was.note,
            chosen: was.chosen,
            imported: true,
        };
        imported.push(record);
    }
    const series = [...new Set(imported.map((one) => one.series))];
    for (const id of series) {
        const world = join(source, 'feed', 'series', id, 'world.md');
        mkdirSync(seriesDir(id), { recursive: true });
        if (existsSync(world)) copyFileSync(world, join(seriesDir(id), 'world.md'));
    }
    update((state) => {
        state.introduced = true;
        for (const id of series) {
            if (state.series.some((one) => one.id === id)) continue;
            const first = imported.find((one) => one.series === id);
            state.series.push({ id, title: first.title, story: id, pitch: first.logline, look: first.look, direction: first.direction, startedAt: first.builtAt, imported: true });
        }
        state.current = state.current ?? series[0] ?? null;
        const ids = new Set(imported.map((one) => one.id));
        state.episodes = [...state.episodes.filter((one) => !ids.has(one.id)), ...imported];
    });
    return { episodes: imported.length, series };
}
