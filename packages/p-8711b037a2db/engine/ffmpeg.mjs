// ffmpeg для «Ленты»: свой у человека (FFMPEG или в PATH — полный, с наложением картинок и фильтрами звука) или
// тот, что приходит с Remotion (урезанный: громкость loudnorm, паузы silencedetect, склейка, масштаб — без overlay
// и звуковых фильтров). Чего урезанному не хватает, движок делает сам на JS (sound.mjs) или рисует Remotion.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

let found = null;

function works(path) {
    if (!path) return false;
    const answer = spawnSync(path, ['-hide_banner', '-version'], { encoding: 'utf8' });
    return answer.status === 0;
}

function onPath(name) {
    const answer = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
    return answer.status === 0 ? answer.stdout.split(/\r?\n/)[0].trim() : null;
}

/** Где ffmpeg Remotion: пакет @remotion/compositor-<система> рядом с @remotion/renderer. */
function remotions() {
    try {
        const require = createRequire(import.meta.url);
        const renderer = require.resolve('@remotion/renderer');
        const fromRenderer = createRequire(renderer);
        const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
        const names = {
            darwin: [`@remotion/compositor-darwin-${arch}`],
            linux: [`@remotion/compositor-linux-${arch}-gnu`, `@remotion/compositor-linux-${arch}-musl`],
            win32: ['@remotion/compositor-win32-x64-msvc'],
        }[process.platform] ?? [];
        for (const name of names) {
            try {
                const dir = dirname(fromRenderer.resolve(`${name}/package.json`));
                const exe = process.platform === 'win32' ? '.exe' : '';
                if (existsSync(join(dir, `ffmpeg${exe}`))) return { ffmpeg: join(dir, `ffmpeg${exe}`), ffprobe: join(dir, `ffprobe${exe}`), dir };
            } catch {
                // нет такого пакета — следующий
            }
        }
    } catch {
        // Remotion ещё не поставлен
    }
    return null;
}

/** ffmpeg и ffprobe, и полный ли это ffmpeg (есть overlay и звуковые фильтры). */
export function tools() {
    if (found) return found;
    const own = process.env.FFMPEG || onPath('ffmpeg');
    if (own && works(own)) {
        const probe = process.env.FFPROBE || onPath('ffprobe') || own.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
        const filters = spawnSync(own, ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout ?? '';
        found = { ffmpeg: own, ffprobe: probe, full: / overlay /.test(filters) && / anoisesrc /.test(filters), env: {} };
        return found;
    }
    const bundled = remotions();
    if (bundled) {
        // Его библиотеки лежат рядом, и называет он их голым именем (libavdevice.dylib): на Linux их ищут по
        // LD_LIBRARY_PATH, на macOS — по DYLD_LIBRARY_PATH (так запускает его и сам Remotion). Без этого на Mac —
        // «Library not loaded: libavdevice.dylib», когда своего ffmpeg в PATH нет: приложение DuoWave запущено не из
        // терминала, и PATH у него без Homebrew.
        const env = { linux: { LD_LIBRARY_PATH: bundled.dir }, darwin: { DYLD_LIBRARY_PATH: bundled.dir } }[process.platform] ?? {};
        found = { ffmpeg: bundled.ffmpeg, ffprobe: bundled.ffprobe, full: false, env };
        return found;
    }
    throw new Error('нет ffmpeg: он приходит с Remotion — его ставит шлюз при первом запуске «Ленты»');
}

/** ffmpeg с аргументами: stdout (Buffer), stderr (текст); ошибка — с последней строкой stderr. */
export function run(args, { onProgress, signal, input } = {}) {
    const { ffmpeg, env } = tools();
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpeg, ['-hide_banner', ...args], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
        const out = [];
        let err = '';
        child.stdout.on('data', (chunk) => {
            out.push(chunk);
            if (onProgress) {
                const text = chunk.toString();
                const match = /out_time_us=(\d+)/g;
                let last;
                for (const found of text.matchAll(match)) last = found;
                if (last) onProgress(Number(last[1]) / 1e6);
            }
        });
        child.stderr.on('data', (chunk) => {
            err += chunk.toString();
            if (err.length > 400_000) err = err.slice(-200_000);
        });
        const stop = () => child.kill('SIGKILL');
        signal?.addEventListener?.('abort', stop);
        child.on('error', reject);
        child.on('close', (code) => {
            signal?.removeEventListener?.('abort', stop);
            if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
            else {
                const last = err.trim().split('\n').slice(-3).join(' · ');
                reject(new Error(`ffmpeg: ${last || `код ${code}`}`));
            }
        });
        if (input) child.stdin.end(input);
        else child.stdin.end();
    });
}

/** Длина файла в секундах (ffprobe). */
export function duration(file) {
    const { ffprobe, env } = tools();
    const answer = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
    });
    const seconds = parseFloat((answer.stdout ?? '').trim());
    return Number.isFinite(seconds) ? seconds : 0;
}

/** Есть ли в файле звук. */
export function hasAudio(file) {
    const { ffprobe, env } = tools();
    const answer = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
    });
    return (answer.stdout ?? '').includes('audio');
}

/** Любой звук → WAV 16 бит моно в памяти (через ffmpeg). */
export async function decodeToWav(file, rate = 44100) {
    const { stdout } = await run(['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1']);
    return stdout;
}

/** Громкость по EBU R128 (loudnorm, замер): input_i, input_tp, input_lra, input_thresh, target_offset. */
export async function loudness(file, target = -14) {
    const { stderr } = await run(['-i', file, '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
    const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
    return JSON.parse(json);
}

/** Где в звуке тишина: [[начало, конец]] (silencedetect). */
export async function silences(file, noiseDb = -42, minGap = 0.08) {
    const { stderr } = await run(['-i', file, '-af', `silencedetect=n=${noiseDb}dB:d=${minGap}`, '-f', 'null', '-']);
    const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
    const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
    const merged = [];
    for (let k = 0; k < Math.min(starts.length, ends.length); k++) {
        const [s, e] = [starts[k], ends[k]];
        if (merged.length && s - merged[merged.length - 1][1] < 0.02) merged[merged.length - 1][1] = e;
        else merged.push([s, e]);
    }
    return merged.map(([s, e]) => [Math.round(s * 1000) / 1000, Math.round(e * 1000) / 1000]);
}
