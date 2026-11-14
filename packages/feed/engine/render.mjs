// Рендер «Ленты» (series-feed tools/render.sh, перенесено на Node): Remotion собирает картинку серии — из данных
// (обычный режим) или из кода режиссёра — и звук; потом громкость −14 LUFS в два прохода, кадр-обложка.
//
// Сборка (bundle) одна на набор серий режиссёра: точка входа пишется в work/entry.tsx — корень библиотеки пакета
// (remotion/root.tsx, makeRoot) и код серий режиссёра из своей папки. Публичная папка рендера — episodes/ своей папки:
// staticFile('<id>/…') читает реплики, озвучку и звуки серии оттуда.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasAudio, loudness, run } from './ffmpeg.mjs';
import { log } from './host.mjs';
import { L } from './i18n.mjs';
import { folder } from './state.mjs';

export const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = join(PACKAGE, 'remotion');

let remotion = null;

/** Remotion — из зависимостей пакета (их ставит шлюз по package-lock.json при первом запуске). */
async function engine() {
    if (remotion) return remotion;
    try {
        const [bundler, renderer] = await Promise.all([import('@remotion/bundler'), import('@remotion/renderer')]);
        remotion = { bundle: bundler.bundle, ...renderer };
        return remotion;
    } catch (error) {
        throw new Error(L(`движка картинки нет (Remotion не поставлен): ${error.message}`, `no picture engine (Remotion is not installed): ${error.message}`));
    }
}

/** Псевдоним @feed → библиотека пакета; модули (remotion, react) — из node_modules пакета и для кода из своей папки. */
function webpackOverride(config) {
    const modules = join(PACKAGE, 'node_modules');
    return {
        ...config,
        resolve: {
            ...config.resolve,
            alias: { ...(config.resolve?.alias ?? {}), '@feed': LIBRARY },
            modules: [...(config.resolve?.modules ?? ['node_modules']), modules],
        },
        resolveLoader: { ...config.resolveLoader, modules: [...(config.resolveLoader?.modules ?? ['node_modules']), modules] },
    };
}

/** Серии режиссёра, у которых есть код: episodes/<id>/code/Episode.tsx. */
function directed() {
    const root = join(folder(), 'episodes');
    if (!existsSync(root)) return [];
    return readdirSync(root)
        .filter((id) => existsSync(join(root, id, 'code', 'Episode.tsx')))
        .sort();
}

const posix = (path) => path.split('\\').join('/');

/** Точка входа сборки и её отпечаток (код серий режиссёра и версия пакета). */
function entry() {
    const work = join(folder(), 'work');
    mkdirSync(work, { recursive: true });
    const ids = directed();
    const lines = [
        "// Пишет движок «Ленты» (engine/render.mjs) перед сборкой — руками не править.",
        "import { registerRoot } from 'remotion';",
        `import { makeRoot } from '${posix(join(LIBRARY, 'root'))}';`,
        ...ids.map((id, i) => `import * as e${i} from '${posix(join(folder(), 'episodes', id, 'code', 'Episode'))}';`),
        `registerRoot(makeRoot([${ids.map((_, i) => `e${i}`).join(', ')}]));`,
        '',
    ];
    const text = lines.join('\n');
    const file = join(work, 'entry.tsx');
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
    const hash = createHash('sha256').update(text).update(readFileSync(join(PACKAGE, 'package.json')));
    for (const id of ids) {
        const code = join(folder(), 'episodes', id, 'code');
        for (const name of readdirSync(code).sort()) hash.update(`${name}:${statSync(join(code, name)).mtimeMs}`);
    }
    for (const name of libraryFiles(LIBRARY)) hash.update(`${name}:${statSync(name).mtimeMs}`);
    return { file, work, key: hash.digest('hex').slice(0, 16) };
}

function libraryFiles(dir) {
    if (!existsSync(dir)) return [];
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name === 'dev' || name.startsWith('.')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...libraryFiles(path));
        else if (/\.(tsx?|json|css)$/.test(name)) out.push(path);
    }
    return out.sort();
}

let bundled = null;
/** Сборка, что идёт сейчас: съёмка и отправка вместе ждут одну, а не собирают дважды в одну папку. */
let bundling = null;

/**
 * Рисование Remotion — по одному: две дорожки «Ленты» (съёмка и отправка) идут вместе, но Chrome на всех ядрах дважды
 * в память приложения не уложится. Кто ждёт своей очереди — говорит об этом (`waiting`); лёгкое (ffmpeg) идёт без неё.
 */
let drawing = Promise.resolve();
let drawers = 0;

async function inTurn(job, waiting = () => {}) {
    const before = drawing;
    let release;
    drawing = new Promise((resolve) => (release = resolve));
    if (drawers > 0) waiting();
    drawers += 1;
    try {
        await before;
        return await job();
    } finally {
        drawers -= 1;
        release();
    }
}

/** Сборка картинки: та же, пока не поменялся код; старые сборки уходят. */
export async function bundleOnce(progress = () => {}) {
    const { file, work, key } = entry();
    const out = join(work, `bundle-${key}`);
    if (bundled?.key === key && existsSync(out)) return bundled.url;
    if (bundling?.key === key) return bundling.promise;
    if (existsSync(join(out, 'index.html'))) {
        bundled = { key, url: out };
        return out;
    }
    const promise = bundleNow({ file, work, key, out, progress });
    bundling = { key, promise };
    try {
        return await promise;
    } finally {
        if (bundling?.promise === promise) bundling = null;
    }
}

async function bundleNow({ file, work, key, out, progress }) {
    const { bundle } = await engine();
    for (const name of readdirSync(work)) if (name.startsWith('bundle-') && name !== `bundle-${key}`) rmSync(join(work, name), { recursive: true, force: true });
    const publicDir = join(folder(), 'episodes');
    mkdirSync(publicDir, { recursive: true });
    const url = await bundle({
        entryPoint: file,
        outDir: out,
        publicDir,
        // Ссылкой, не копией: в папке — гигабайты роликов, и файлы, что появятся после сборки (ролик для копии,
        // кадр для карточки), рендер увидит.
        symlinkPublicDir: process.platform !== 'win32',
        webpackOverride,
        onProgress: (percent) => progress(percent / 100),
    });
    bundled = { key, url };
    return url;
}

let browser = null;

/** Браузер для рендера: Remotion скачивает его сам при первом рендере (около 100 МБ) — один раз на обе дорожки. */
export function browserReady(progress = () => {}) {
    browser ??= (async () => {
        const { ensureBrowser } = await engine();
        if (typeof ensureBrowser !== 'function') return;
        await ensureBrowser({
            onBrowserDownload: () => ({
                version: null,
                onProgress: ({ percent }) => progress(percent ?? 0, L('Скачиваю браузер для рендера — один раз, около 100 МБ', 'Downloading the browser for drawing — once, about 100 MB')),
            }),
        });
    })().catch((error) => {
        browser = null;
        throw error;
    });
    return browser;
}

async function select(serveUrl, id, inputProps) {
    const { selectComposition } = await engine();
    return selectComposition({ serveUrl, id, inputProps });
}

/** Состав композиции и её свойства после calculateMetadata (choiceAt, branchTimes). В очереди рисования. */
export async function composition(serveUrl, id, inputProps, { waiting } = {}) {
    return inTurn(() => select(serveUrl, id, inputProps), waiting);
}

/** Рендер ролика композиции: ход долей 0…1; отмена — по `cancelled()`; ждёт своей очереди — `waiting()`. */
export async function renderVideo(serveUrl, id, inputProps, output, { progress = () => {}, cancelled = () => false, scale = 1, waiting } = {}) {
    return inTurn(() => renderVideoNow(serveUrl, id, inputProps, output, { progress, cancelled, scale }), waiting);
}

async function renderVideoNow(serveUrl, id, inputProps, output, { progress, cancelled, scale }) {
    if (cancelled()) throw new Error(L('отменено', 'cancelled'));
    const { renderMedia, makeCancelSignal } = await engine();
    const comp = await select(serveUrl, id, inputProps);
    const { cancelSignal, cancel } = makeCancelSignal();
    const watch = setInterval(() => cancelled() && cancel(), 300);
    const part = `${output}.part.mp4`;
    try {
        await renderMedia({
            composition: comp,
            serveUrl,
            codec: 'h264',
            outputLocation: part,
            inputProps,
            crf: 20,
            imageFormat: 'jpeg',
            jpegQuality: 92,
            scale,
            cancelSignal,
            onProgress: ({ progress: share }) => progress(share),
        });
    } finally {
        clearInterval(watch);
    }
    renameSync(part, output);
    return comp;
}

/**
 * Рендер на своём сервере рендера (engine/render-server.mjs, другой компьютер или облако): файлы серии — туда, ролик —
 * сюда. Ответ — как у renderVideo: свойства композиции (choiceAt, branchTimes).
 */
export async function renderRemote(server, key, dir, id, mode, output, { progress = () => {} } = {}) {
    const files = {};
    const skip = /(^|\/)(episode\.mp4|raw\.mp4|poster\.jpg|sfx|check)(\/|$)|\.take\./;
    const walk = (at, prefix) => {
        for (const name of readdirSync(at)) {
            const path = join(at, name);
            const relative = prefix ? `${prefix}/${name}` : name;
            if (skip.test(relative) || name.startsWith('.')) continue;
            if (statSync(path).isDirectory()) walk(path, relative);
            else files[relative] = readFileSync(path).toString('base64');
        }
    };
    walk(dir, '');
    progress(0.05, L('Отправляю серию на сервер рендера', 'Sending the episode to the render server'));
    const started = Date.now();
    const timer = setInterval(() => progress(Math.min(0.95, 0.05 + (Date.now() - started) / 180_000), 'Рисую на сервере рендера'), 1000);
    try {
        const answer = await fetch(`${server.replace(/\/$/, '')}/render`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({ id, mode, files }),
        });
        if (!answer.ok) throw new Error(L(`сервер рендера: HTTP ${answer.status} ${(await answer.text()).slice(0, 300)}`, `render server: HTTP ${answer.status} ${(await answer.text()).slice(0, 300)}`));
        writeFileSync(output, Buffer.from(await answer.arrayBuffer()));
        const props = JSON.parse(Buffer.from(answer.headers.get('x-feed-props') ?? 'e30=', 'base64').toString('utf8'));
        return { props, durationInFrames: props.frames ?? null };
    } finally {
        clearInterval(timer);
    }
}

/** Кадр композиции в PNG (обложки обликов, знак, плашка, карточка серии). В очереди рисования. */
export async function renderPicture(serveUrl, id, inputProps, output, { frame = 0, scale = 1, waiting } = {}) {
    return inTurn(async () => {
        const { renderStill } = await engine();
        const comp = await select(serveUrl, id, inputProps);
        await renderStill({ composition: comp, serveUrl, output, inputProps, frame, imageFormat: output.endsWith('.png') ? 'png' : 'jpeg', scale });
        return output;
    }, waiting);
}

/** Громкость −14 LUFS в два прохода (замер, потом линейная поправка); немой — как есть. Видео не перекодируется. */
export async function finish(raw, output) {
    if (!hasAudio(raw)) {
        await run(['-y', '-loglevel', 'error', '-i', raw, '-map', '0:v:0', '-map_metadata', '-1', '-c:v', 'copy', '-movflags', '+faststart', output]);
        return { silent: true };
    }
    const m = await loudness(raw, -14);
    const filter = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    await run([
        '-y', '-loglevel', 'error', '-i', raw, '-map', '0:v:0', '-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1',
        '-c:v', 'copy', '-af', filter, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
        '-metadata:s:v:0', 'handler_name=video', '-metadata:s:a:0', 'handler_name=audio', '-movflags', '+faststart', output,
    ]);
    return { silent: false };
}

/** Последний кадр ролика — обложка серии и основа её карточки. */
export async function poster(video, output) {
    await run(['-y', '-loglevel', 'error', '-sseof', '-0.4', '-i', video, '-frames:v', '1', '-q:v', '3', output]);
    return output;
}

/** Ссылки на библиотеку пакета нет — сказать по-человечески. */
export function libraryReady() {
    if (!existsSync(join(LIBRARY, 'root.tsx'))) throw new Error('в пакете нет библиотеки картинки (remotion/root.tsx)');
    const require = createRequire(import.meta.url);
    require.resolve('remotion');
}

export function warn(message) {
    log('warn', message);
}
