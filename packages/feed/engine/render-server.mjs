// Сервер рендера «Ленты» (этап 10 плана: «сервер и облако для рендера»): тот же движок картинки — на другом
// компьютере дома или на сервере в облаке. «Лента» отдаёт ему файлы серии (реплики, озвучку, данные или код
// режиссёра) и получает ролик; громкость, проверки и ленту делает у себя.
//
//   FEED_RENDER_KEY=<ключ> [PORT=7795] [FEED_RENDER_DIR=<папка>] node engine/render-server.mjs
//
// В «Ленте»: настройки «Сервер рендера» (адрес, например http://192.168.1.20:7795) и «Ключ сервера рендера».
// Зависимости — те же, что у пакета (npm ci по package-lock.json); браузер рендера Remotion скачает сам.

import http from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.FEED_RENDER_KEY ?? '';
const PORT = Number(process.env.PORT ?? 7795);
const ROOT = process.env.FEED_RENDER_DIR ?? join(tmpdir(), 'duowave-feed-render');
if (KEY.length < 16) {
    console.error('нужен FEED_RENDER_KEY — не короче 16 знаков');
    process.exit(2);
}
// Движок читает свою папку из окружения: у сервера рендера она своя.
process.env.DUOWAVE_APP_FILES = ROOT;
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));
const { bundleOnce, renderVideo } = await import('./render.mjs');
const { baseSounds } = await import('./sound.mjs');

const ID = /^[a-z0-9][a-z0-9-]*$/;
const MAX = 200 * 1024 * 1024;
let busy = Promise.resolve();

/** Путь файла серии: внутри её папки, без точек впереди. */
function inside(dir, path) {
    const clean = normalize(path).replace(/\\/g, '/');
    if (clean.startsWith('..') || clean.startsWith('/') || clean.split('/').some((part) => !part || part.startsWith('.'))) throw new Error(`путь «${path}»`);
    return join(dir, clean);
}

async function render(job) {
    if (!ID.test(job.id ?? '')) throw new Error('id серии');
    const dir = join(ROOT, 'episodes', job.id);
    rmSync(dir, { recursive: true, force: true });
    for (const [path, base64] of Object.entries(job.files ?? {})) {
        const file = inside(dir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, Buffer.from(String(base64), 'base64'));
    }
    baseSounds(dir);
    const serveUrl = await bundleOnce();
    const raw = join(dir, 'raw.mp4');
    const props = job.mode === 'data' ? { episode: JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8')) } : {};
    const comp = await renderVideo(serveUrl, job.mode === 'data' ? 'data' : job.id, props, raw);
    const video = readFileSync(raw);
    rmSync(dir, { recursive: true, force: true });
    return { video, props: { choiceAt: comp?.props?.choiceAt ?? null, branchTimes: comp?.props?.branchTimes ?? null, frames: comp.durationInFrames } };
}

http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') return response.writeHead(200).end('ok');
    if (request.method !== 'POST' || request.url !== '/render') return response.writeHead(404).end();
    if (request.headers.authorization !== `Bearer ${KEY}`) return response.writeHead(401).end();
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX) return response.writeHead(413).end('больше 200 МБ');
        chunks.push(chunk);
    }
    // По одной серии за раз: рендер и так берёт все ядра.
    const turn = busy.then(() => render(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
    busy = turn.catch(() => {});
    try {
        const { video, props } = await turn;
        response.writeHead(200, { 'content-type': 'video/mp4', 'x-feed-props': Buffer.from(JSON.stringify(props)).toString('base64') }).end(video);
    } catch (error) {
        response.writeHead(500).end(String(error.message ?? error).slice(0, 2000));
    }
}).listen(PORT, () => console.log(`сервер рендера «Ленты» слушает порт ${PORT}`));
