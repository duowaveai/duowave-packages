// Звук серии без кредитов и без полного ffmpeg (docs: series-feed tools/sound.sh, перенесено на JS): базовый набор
// синтезом — шумы, фильтры, тремоло, огибающие — и обработка голоса «через рацию» и «угроза». ffmpeg Remotion
// умеет только громкость и склейку, поэтому всё остальное считается здесь, на PCM.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { decodeToWav, run } from './ffmpeg.mjs';

export const RATE = 48000;

// ——— WAV ———

/** PCM 16 бит моно → WAV. */
export function encodeWav(samples, rate = RATE) {
    const data = Buffer.alloc(44 + samples.length * 2);
    data.write('RIFF', 0, 'ascii');
    data.writeUInt32LE(36 + samples.length * 2, 4);
    data.write('WAVE', 8, 'ascii');
    data.write('fmt ', 12, 'ascii');
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);
    data.writeUInt16LE(1, 22);
    data.writeUInt32LE(rate, 24);
    data.writeUInt32LE(rate * 2, 28);
    data.writeUInt16LE(2, 32);
    data.writeUInt16LE(16, 34);
    data.write('data', 36, 'ascii');
    data.writeUInt32LE(samples.length * 2, 40);
    for (let i = 0; i < samples.length; i++) {
        const value = Math.max(-1, Math.min(1, samples[i]));
        data.writeInt16LE(Math.round(value < 0 ? value * 32768 : value * 32767), 44 + i * 2);
    }
    return data;
}

/** WAV 16 бит (моно или стерео — каналы смешиваются) → {samples: Float32Array, rate}. */
export function decodeWav(buffer) {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('не WAV');
    let offset = 12;
    let channels = 1;
    let rate = RATE;
    let bits = 16;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        let size = buffer.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            channels = buffer.readUInt16LE(body + 2);
            rate = buffer.readUInt32LE(body + 4);
            bits = buffer.readUInt16LE(body + 14);
        } else if (id === 'data') {
            // Поток из pipe: размер не известен заранее — до конца файла.
            if (size === 0 || size === 0xffffffff || body + size > buffer.length) size = buffer.length - body;
            if (bits !== 16) throw new Error(`WAV ${bits} бит — нужен 16`);
            const frames = Math.floor(size / (2 * channels));
            const samples = new Float32Array(frames);
            for (let i = 0; i < frames; i++) {
                let sum = 0;
                for (let c = 0; c < channels; c++) sum += buffer.readInt16LE(body + (i * channels + c) * 2) / 32768;
                samples[i] = sum / channels;
            }
            return { samples, rate };
        }
        offset = body + size + (size % 2);
    }
    throw new Error('в WAV нет данных');
}

// ——— Источники и фильтры ———

/** Случайные числа по зерну: звук один и тот же от сборки к сборке. */
function random(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return ((state >>> 0) / 4294967296) * 2 - 1;
    };
}

export function noise(kind, seconds, seed, amplitude = 1, rate = RATE) {
    const out = new Float32Array(Math.round(seconds * rate));
    const next = random(seed);
    let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
    let brown = 0;
    for (let i = 0; i < out.length; i++) {
        const white = next();
        if (kind === 'white') out[i] = white;
        else if (kind === 'pink') {
            // Пол Келлет: розовый шум из белого.
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856;
            b4 = 0.55 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.016898;
            out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        } else {
            brown = (brown + 0.02 * white) / 1.02;
            out[i] = brown * 3.5;
        }
        out[i] *= amplitude;
    }
    return out;
}

/** Двухполюсный фильтр (RBJ): нижние или верхние частоты. */
export function biquad(samples, type, frequency, rate = RATE, q = Math.SQRT1_2) {
    const w = (2 * Math.PI * frequency) / rate;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0, b1, b2;
    if (type === 'lowpass') {
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = (1 - cos) / 2;
    } else {
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = (1 + cos) / 2;
    }
    const a0 = 1 + alpha;
    const [a1, a2] = [-2 * cos, 1 - alpha];
    const out = new Float32Array(samples.length);
    let [x1, x2, y1, y2] = [0, 0, 0, 0];
    for (let i = 0; i < samples.length; i++) {
        const x = samples[i];
        const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        out[i] = y;
        [x2, x1, y2, y1] = [x1, x, y1, y];
    }
    return out;
}

const band = (samples, low, high, rate = RATE) => biquad(biquad(samples, 'highpass', low, rate), 'lowpass', high, rate);

/** Тремоло: громкость качается с частотой f и глубиной d (как у ffmpeg tremolo). */
function tremolo(samples, f, d, rate = RATE) {
    for (let i = 0; i < samples.length; i++) samples[i] *= 1 - d / 2 + (d / 2) * Math.sin((2 * Math.PI * f * i) / rate);
    return samples;
}

function fade(samples, { inFor = 0, outAt, outFor = 0, curve = 'linear' } = {}, rate = RATE) {
    const n = samples.length;
    const inN = Math.round(inFor * rate);
    for (let i = 0; i < Math.min(inN, n); i++) {
        const x = i / inN;
        samples[i] *= curve === 'exp' ? x * x * x : x;
    }
    if (outFor > 0) {
        const start = Math.round((outAt ?? n / rate - outFor) * rate);
        const len = Math.round(outFor * rate);
        for (let i = Math.max(0, start); i < n; i++) samples[i] *= Math.max(0, 1 - (i - start) / len);
    }
    return samples;
}

function gain(samples, k) {
    for (let i = 0; i < samples.length; i++) samples[i] *= k;
    return samples;
}

/** Самый громкий отсчёт — к пределу (без перегруза при сохранении). */
function peakTo(samples, peak = 0.89) {
    let max = 0;
    for (const value of samples) max = Math.max(max, Math.abs(value));
    return max > 0 ? gain(samples, peak / max) : samples;
}

function mix(a, b, kb = 1) {
    const out = new Float32Array(Math.max(a.length, b.length));
    for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + kb * (b[i] ?? 0);
    return out;
}

function sine(f, seconds, envelope, rate = RATE) {
    const out = new Float32Array(Math.round(seconds * rate));
    for (let i = 0; i < out.length; i++) {
        const t = i / rate;
        out[i] = Math.sin(2 * Math.PI * f * t) * envelope(t);
    }
    return out;
}

// ——— Базовый набор ———

const BASE = {
    wind: () => fade(tremolo(tremolo(band(noise('pink', 64, 3, 0.8), 180, 1400), 0.13, 0.7), 0.31, 0.4), { inFor: 1.5 }),
    low: () => peakTo(band(noise('brown', 64, 5, 0.9), 28, 110), 0.7),
    hit: () => {
        const body = sine(52 * 0.9, 1.4, (t) => Math.exp(-4 * t));
        const click = fade(biquad(noise('brown', 0.08, 7, 1), 'lowpass', 900), { outFor: 0.08 });
        return peakTo(mix(body, click));
    },
    radio_on: () => fade(tremolo(band(noise('white', 0.9, 9, 0.7), 1200, 5200), 19, 0.9), { inFor: 0.03, outAt: 0.35, outFor: 0.55 }),
    static: () => fade(tremolo(band(noise('white', 8, 11, 0.5), 1500, 4500), 7, 0.5), { inFor: 0.1 }),
    heart: () => peakTo(sine(46, 0.6, (t) => Math.exp(-22 * t) + (t > 0.17 ? 0.7 * Math.exp(-22 * Math.abs(t - 0.17)) : 0))),
    rise: () => fade(band(noise('pink', 3, 2, 0.8), 300, 2600), { inFor: 2.9, curve: 'exp', outAt: 2.95, outFor: 0.05 }),
    crunch: () => fade(tremolo(tremolo(band(noise('white', 2.4, 17, 0.9), 1400, 5200), 2.1, 1), 23, 0.5), { inFor: 0.2, outAt: 1.9, outFor: 0.5 }),
    rewind: () => {
        // Перемотка: свист, что качается и уходит вверх, и шорох ленты.
        const whistle = new Float32Array(Math.round(1.3 * RATE));
        let phase = 0;
        for (let i = 0; i < whistle.length; i++) {
            const t = i / RATE;
            phase += (2 * Math.PI * (1440 + 600 * t + 120 * Math.sin(2 * Math.PI * 11 * t))) / RATE;
            whistle[i] = 0.5 * Math.sin(phase) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 26 * t));
        }
        const tape = tremolo(band(noise('pink', 1.3, 4, 0.6), 900, 5000), 31, 0.9);
        return fade(peakTo(mix(whistle, tape)), { inFor: 0.05, outAt: 0.6, outFor: 0.2 });
    },
    sea: () => fade(peakTo(tremolo(tremolo(band(noise('brown', 64, 23, 0.9), 60, 700), 0.11, 0.85), 0.23, 0.5), 0.8), { inFor: 1.5 }),
};

export const BASE_SOUNDS = Object.keys(BASE);

/** Базовый набор звуков серии в `<папка>/sfx/*.wav`; готовые не трогает. */
export function baseSounds(dir) {
    const sfx = join(dir, 'sfx');
    mkdirSync(sfx, { recursive: true });
    for (const [name, make] of Object.entries(BASE)) {
        const file = join(sfx, `${name}.wav`);
        if (!existsSync(file)) writeFileSync(file, encodeWav(peakTo(make(), 0.89)));
    }
    return sfx;
}

// ——— Голос: рация и угроза ———

/** Простой компрессор: громкое прижимается, тихое подтягивается. */
function compress(samples, threshold = 0.08, ratio = 6) {
    let env = 0;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const level = Math.abs(samples[i]);
        env = level > env ? 0.9 * env + 0.1 * level : 0.9995 * env + 0.0005 * level;
        const over = env > threshold ? threshold + (env - threshold) / ratio : env;
        out[i] = env > 1e-6 ? (samples[i] * over) / env : samples[i];
    }
    return peakTo(out, 0.9);
}

/** Голос «через рацию / телефон»: узкая полоса, хрип, треск эфира. */
export function radio(samples, rate) {
    const narrow = band(samples, 380, 3000, rate);
    const squeezed = compress(narrow);
    const levels = 2 ** 8;
    const crushed = new Float32Array(squeezed.length);
    let held = 0;
    for (let i = 0; i < squeezed.length; i++) {
        if (i % 3 === 0) held = Math.round(squeezed[i] * levels) / levels;
        crushed[i] = 0.55 * squeezed[i] + 0.45 * held;
    }
    const air = band(noise('white', crushed.length / rate, 31, 0.035, rate), 900, 4200, rate);
    return band(mix(band(crushed, 380, 3200, rate), air), 300, 4400, rate);
}

/** Голос угрозы: тот же голос плюс два ниже (сдвиг высоты с той же длиной) и эхо. */
function shifted(samples, factor) {
    // Ниже на factor: читаем медленнее, длину держим окнами с перекрытием (простой гранулярный сдвиг).
    const grain = 2048;
    const hop = grain / 2;
    const out = new Float32Array(samples.length);
    const window = new Float32Array(grain).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / grain));
    for (let start = 0; start + grain < samples.length; start += hop) {
        for (let i = 0; i < grain; i++) {
            const at = start + i * factor;
            const k = Math.floor(at);
            const frac = at - k;
            const value = (samples[k] ?? 0) * (1 - frac) + (samples[k + 1] ?? 0) * frac;
            out[start + i] += value * window[i];
        }
    }
    return out;
}

export function deep(samples, rate) {
    let voice = mix(mix(samples, shifted(samples, 0.86)), shifted(samples, 0.72));
    for (const [delayMs, decay] of [
        [70, 0.35],
        [140, 0.2],
    ]) {
        const d = Math.round((delayMs / 1000) * rate);
        const echoed = new Float32Array(voice.length);
        for (let i = 0; i < voice.length; i++) echoed[i] = voice[i] + (i >= d ? decay * voice[i - d] : 0);
        voice = echoed;
    }
    return peakTo(biquad(voice, 'lowpass', 5200, rate), 0.9);
}

/** Реплика через обработку (`radio` или `deep`): вход любой (mp3, wav), выход — WAV с громкостью рассказчика. */
export async function treatVoice(kind, input, output, lufs = kind === 'radio' ? -24 : -22) {
    const { samples, rate } = decodeWav(await decodeToWav(input, 44100));
    const treated = kind === 'radio' ? radio(samples, rate) : deep(samples, rate);
    const raw = `${output}.raw.wav`;
    writeFileSync(raw, encodeWav(peakTo(treated, 0.9), rate));
    await run(['-y', '-loglevel', 'error', '-i', raw, '-af', `loudnorm=I=${lufs}:TP=-2:LRA=7`, '-ar', '44100', '-c:a', 'pcm_s16le', output]);
    const { rmSync } = await import('node:fs');
    rmSync(raw, { force: true });
}
