// Копия для отправки (решения 4–7, 16, 17 плана «Ленты»): по нажатию, без второй версии на диске — ролик серии,
// знак как у ТикТока (ДиВи белый и «DuoWave.ai»: 0–5 с слева посередине, с 5-й секунды справа ниже), плашка «Пиши в
// комментариях: ① или ②», пока стоят карточки развилки, заставка 4 с; 720p. Копия лежит в share/ сутки.
//
// Быстрый путь — полный ffmpeg (свой у человека): знак, плашку и заставку Remotion рисует один раз, ffmpeg сводит их
// с роликом одним проходом за секунды, ход — по `-progress`. Без полного ffmpeg копию рисует сам Remotion
// (композиция `share`) — дольше, ход тот же. Карточка серии — кадр развилки с названием, плашкой и ДиВи.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { duration, run, tools } from './ffmpeg.mjs';
import { bundleOnce, renderPicture, renderVideo } from './render.mjs';
import { L } from './i18n.mjs';
import { episodeDir, folder } from './state.mjs';

const DAY = 24 * 3600 * 1000;

export function shareDir() {
    const dir = join(folder(), 'share');
    mkdirSync(dir, { recursive: true });
    return dir;
}

/** Копии старше суток уходят. */
export function sweep() {
    const dir = shareDir();
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        try {
            if (Date.now() - statSync(path).mtimeMs > DAY) rmSync(path, { recursive: true, force: true });
        } catch {
            // уже нет
        }
    }
}

/** Знак, плашка и заставка для быстрого пути — один раз на язык. `waiting` — пока рисует серия. */
async function parts(serveUrl, lang, waiting) {
    const dir = join(folder(), 'work', 'share-parts', lang);
    mkdirSync(dir, { recursive: true });
    const files = {
        left: join(dir, 'mark-left.png'),
        right: join(dir, 'mark-right.png'),
        plaque: join(dir, 'plaque.png'),
        outro: join(dir, 'outro.mp4'),
    };
    if (!existsSync(files.left)) await renderPicture(serveUrl, 'mark', { position: 'left', lang }, files.left, { waiting });
    if (!existsSync(files.right)) await renderPicture(serveUrl, 'mark', { position: 'right', lang }, files.right, { waiting });
    if (!existsSync(files.plaque)) await renderPicture(serveUrl, 'plaque', { lang }, files.plaque, { waiting });
    if (!existsSync(files.outro)) await renderVideo(serveUrl, 'outro', { lang }, files.outro, { waiting });
    return files;
}

/**
 * Копия серии для отправки: путь в своей папке (`share/<id>.mp4`). `progress(доля, слова)`; уже готовая сегодня —
 * сразу.
 */
export async function shareCopy(episode, { progress = () => {}, cancelled = () => false } = {}) {
    sweep();
    const out = join(shareDir(), `${episode.id}.mp4`);
    if (existsSync(out)) return `share/${episode.id}.mp4`;
    const video = join(episodeDir(episode.id), 'episode.mp4');
    if (!existsSync(video)) throw new Error(L('ролика серии нет на диске — пересоберите её', 'the episode’s video is not on the disk — rebuild it'));
    const lang = episode.lang ?? 'ru';
    const length = episode.durationSec ?? duration(video);
    const total = length + 4;
    progress(0.02, L('Готовим файл к отправке', 'Preparing the file to send'));
    const serveUrl = await bundleOnce();
    const part = `${out}.part.mp4`;
    // Рисованию Remotion — очередь (идёт съёмка — копия подождёт её рисунка); ffmpeg идёт сразу.
    const waiting = () => progress(0.02, L('Жду: дорисовывается новая серия — потом сразу', 'Waiting: a new episode is being drawn — right after it'));
    if (tools().full) {
        const files = await parts(serveUrl, lang, waiting);
        const choice = episode.choiceAt ?? null;
        const graph = [
            '[0:v]scale=720:1280,fps=30,format=yuv420p[v0]',
            '[1:v]scale=720:1280[ml]',
            '[2:v]scale=720:1280[mr]',
            '[3:v]scale=720:1280[pl]',
            "[v0][ml]overlay=enable='lt(t,5)'[a]",
            "[a][mr]overlay=enable='gte(t,5)'[b]",
            choice === null ? '[b]null[c]' : `[b][pl]overlay=enable='gte(t,${Number(choice).toFixed(2)})'[c]`,
            '[4:v]scale=720:1280,fps=30,format=yuv420p[o]',
            '[c][o]concat=n=2:v=1:a=0[vv]',
            '[0:a]apad=pad_dur=4[aa]',
        ].join(';');
        await run(
            [
                '-y', '-loglevel', 'error', '-i', video, '-i', files.left, '-i', files.right, '-i', files.plaque, '-i', files.outro,
                '-filter_complex', graph, '-map', '[vv]', '-map', '[aa]', '-t', total.toFixed(2),
                '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '160k',
                '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', part,
            ],
            { onProgress: (seconds) => progress(Math.min(0.99, seconds / total), L('Готовим файл к отправке', 'Preparing the file to send')) },
        );
    } else {
        await renderVideo(
            serveUrl,
            'share',
            { src: `${episode.id}/episode.mp4`, duration: length, choiceAt: episode.choiceAt ?? null, lang },
            part,
            { scale: 2 / 3, progress: (share) => progress(Math.min(0.99, share), L('Готовим файл к отправке', 'Preparing the file to send')), cancelled, waiting },
        );
    }
    const { renameSync } = await import('node:fs');
    renameSync(part, out);
    progress(1, L('Файл готов', 'File ready'));
    return `share/${episode.id}.mp4`;
}

/** Карточка серии для отправки картинкой: кадр развилки, название, плашка, ДиВи. */
export async function shareCard(episode, { progress = () => {} } = {}) {
    sweep();
    const out = join(shareDir(), `${episode.id}-card.png`);
    if (existsSync(out)) return `share/${episode.id}-card.png`;
    const serveUrl = await bundleOnce();
    await renderPicture(
        serveUrl,
        'card',
        { frame: `${episode.id}/poster.jpg`, title: episode.title, n: episode.n, q: null, lang: episode.lang ?? 'ru' },
        out,
        { waiting: () => progress(0.05, L('Жду: дорисовывается новая серия — потом сразу', 'Waiting: a new episode is being drawn — right after it')) },
    );
    return `share/${episode.id}-card.png`;
}

/** Готовый текст к посту: название, о чём, развилка, строка о голосе (лицензии CC BY требуют автора). */
export function postText(episode, lang = 'ru') {
    const en = lang === 'en';
    const lines = [`${episode.title} — ${en ? 'episode' : 'серия'} ${episode.n}`];
    if (episode.logline) lines.push(episode.logline);
    if (episode.choice) {
        lines.push('');
        lines.push(episode.choice.q);
        lines.push(`① ${episode.choice.a.title}`);
        lines.push(`② ${episode.choice.b.title}`);
        lines.push(en ? 'Comment: ① or ②' : 'Пиши в комментариях: ① или ②');
    }
    // Голоса серии — весь состав (рассказчик, второй голос, персонажи): лицензии CC BY требуют назвать каждый.
    const voices = Array.isArray(episode.voices) && episode.voices.length ? episode.voices : episode.voice ? [episode.voice] : [];
    if (voices.length) {
        lines.push('');
        const label = voices.length > 1 ? (en ? 'Voices' : 'Голоса') : en ? 'Voice' : 'Голос';
        lines.push(`${label}: ${voices.map((voice) => `${voice.title ?? voice.id}${voice.license ? `, ${voice.license}` : ''}`).join('; ')}`);
    }
    lines.push(en ? 'Shot on my computer with DuoWave · duowave.ai' : 'Снято на моём компьютере в DuoWave · duowave.ai');
    return lines.join('\n');
}
