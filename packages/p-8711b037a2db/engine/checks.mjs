// Автопроверка готовой серии (series-feed tools/check.ts, перенесено): длина, громкость (−14 ±1 LUFS, пик ≤ −1),
// с полным ffmpeg — движение в первые 2 с (хук), чёрные куски, яркость; и речь — готовый звук слушает слух шлюза
// (`system/hearing` → `recognize`), слова сверяются с репликами.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { duration, hasAudio, loudness, run, tools } from './ffmpeg.mjs';
import { letter } from './host.mjs';
import { L } from './i18n.mjs';
import { folder } from './state.mjs';

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Слова для сверки: без регистра, «ё» как «е», без знаков, короче трёх букв — не в счёт. */
function words(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2);
}

/**
 * Речь: распознать звук готовой серии и сверить слова с репликами. Числа и редкие формы слух пишет по-своему («сорок» →
 * «40»), поэтому допускается десятая доля расхождений; без слуха — пропуск, не провал.
 */
export async function speechCheck(video, lines, lang) {
    const want = lines.flatMap((line) => words(line.text)).filter((word) => !/^\d+$/.test(word));
    if (!want.length) return { name: L('речь', 'speech'), ok: null, text: L('пропущено: реплик нет', 'skipped: no lines') };
    let text;
    try {
        const file = relative(folder(), video).split('\\').join('/');
        text = (await letter('system/hearing', 'recognize', { file, lang }))?.text ?? '';
    } catch (error) {
        return { name: L('речь', 'speech'), ok: null, text: L(`пропущено: ${error.message}`, `skipped: ${error.message}`) };
    }
    const heard = new Set(words(text));
    const missing = [...new Set(want.filter((word) => !heard.has(word)))];
    const share = 1 - missing.length / Math.max(1, new Set(want).size);
    const lost = missing.length ? L(`; не услышал: ${missing.slice(0, 8).join(', ')}`, `; not heard: ${missing.slice(0, 8).join(', ')}`) : '';
    return { name: L('речь', 'speech'), ok: share >= 0.9, text: L(`распознано ${Math.round(share * 100)} % слов${lost}`, `${Math.round(share * 100)} % of words recognized${lost}`) };
}

/** Проверки серии; с папкой серии и языком — и речь (её реплики — `voice.<язык>.json`). */
export async function check(video, { dir, lang } = {}) {
    const checks = [];
    const length = duration(video);
    checks.push({ name: L('длина', 'length'), ok: length > 0 && length <= 180, text: L(`${length.toFixed(1)} с`, `${length.toFixed(1)} s`) });
    if (hasAudio(video)) {
        const measured = await loudness(video, -14);
        const level = Number(measured.input_i);
        const peak = Number(measured.input_tp);
        checks.push({
            name: L('громкость', 'loudness'),
            ok: Math.abs(level + 14) <= 1 && peak <= -1,
            text: L(`${level} LUFS, пик ${peak} dBTP (цель −14 ±1, пик ≤ −1)`, `${level} LUFS, peak ${peak} dBTP (target −14 ±1, peak ≤ −1)`),
        });
    } else {
        checks.push({ name: L('громкость', 'loudness'), ok: null, text: L('звука нет — немой черновик', 'no sound — a silent draft') });
    }
    const script = dir && lang ? join(dir, `voice.${lang}.json`) : null;
    if (script && existsSync(script) && hasAudio(video)) {
        const silentDraft = existsSync(join(dir, 'audio', lang)) && /"silent": ?true/.test(readMetaSample(join(dir, 'audio', lang)));
        if (!silentDraft) checks.push(await speechCheck(video, JSON.parse(readFileSync(script, 'utf8')).lines ?? [], lang));
    }
    if (tools().full) {
        const motionOut = await run(['-t', '2', '-i', video, '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
        const motion = mean([...motionOut.stdout.toString().matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1])).slice(1));
        checks.push({ name: L('хук', 'hook'), ok: motion >= 0.5, text: L(`движение в первые 2 с: ${motion.toFixed(2)} (нужно ≥ 0,5)`, `motion in the first 2 s: ${motion.toFixed(2)} (needs ≥ 0.5)`) });
        const black = await run(['-i', video, '-vf', 'blackdetect=d=0.3:pix_th=0.06', '-an', '-f', 'null', '-']);
        const blacks = [...black.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${m[1]}–${m[2]}`);
        checks.push({ name: L('чёрное', 'black'), ok: blacks.length === 0, text: blacks.length ? L(`чёрные куски: ${blacks.join(', ')} с`, `black parts: ${blacks.join(', ')} s`) : L('нет', 'none') });
        const lum = await run(['-i', video, '-vf', 'fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-']);
        const bright = (mean([...lum.stdout.toString().matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]))) / 255) * 100;
        checks.push({ name: L('яркость', 'brightness'), ok: bright >= 10, text: L(`средняя ${bright.toFixed(0)} % (ниже 10 % — на телефоне не читается)`, `average ${bright.toFixed(0)} % (below 10 % does not read on a phone)`) });
    } else {
        checks.push({ name: L('картинка', 'picture'), ok: null, text: L('хук, чёрное и яркость — с полным ffmpeg (FFMPEG или в PATH)', 'hook, black and brightness — with a full ffmpeg (FFMPEG or in PATH)') });
    }
    return { durationSec: length, ok: checks.every((one) => one.ok !== false), checks };
}

/** Первая реплика озвучки — по ней видно немой черновик (в тишине слушать нечего). */
function readMetaSample(audio) {
    try {
        const first = JSON.parse(readFileSync(join(audio, 'speech.json'), 'utf8'));
        const id = Object.keys(first)[0];
        return id ? readFileSync(join(audio, `${id}.json`), 'utf8') : '';
    } catch {
        return '';
    }
}
