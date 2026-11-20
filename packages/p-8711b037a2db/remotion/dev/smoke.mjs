// Проверка картинки «Ленты» целиком, как её зовёт движок: своя точка входа вне пакета, webpackOverride движка
// (`@feed` → remotion/, модули — из node_modules пакета), public-папка = папка серий.
//
//   node remotion/dev/smoke.mjs --episodes <series-feed>/feed/episodes --renders <series-feed>/feed/renders \
//     [--browser <путь к chrome-headless-shell>] [--tmp <папка>] [--keep]
//
// Что делает: копирует две серии теста (storozh-01, storozh-04) с их кодом из remotion/examples как серии режиссёра,
// пишет две серии данными (test-01 — немой черновик из трёх реплик на декорациях обоих сериалов; test-02 — с голосом
// из storozh-01, «КОНЕЦ», перемотка и ветки), собирает и рендерит: кадры обликов в assets/looks/<id>.jpg (540×960),
// серии данными целиком, копию для отправки из готового ролика (720p), знак, плашку, заставку, карточку и по кадру
// каждой декорации библиотеки.
// Печатает скорость рендера (кадров в секунду) и времена для движка (choiceAt, branchTimes).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const REMOTION = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG = path.dirname(REMOTION);
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const SRC_EPISODES = arg('episodes');
const SRC_RENDERS = arg('renders');
const BROWSER = arg('browser', process.env.FEED_BROWSER);
const TMP = arg('tmp', path.join(tmpdir(), 'feed-smoke'));
const KEEP = process.argv.includes('--keep');
if (!SRC_EPISODES || !SRC_RENDERS) {
  console.error('нужно: --episodes <папка серий теста> --renders <папка готовых роликов теста>');
  process.exit(2);
}

const PUB = path.join(TMP, 'episodes');
const OUT = path.join(TMP, 'out');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- public-папка: серии режиссёра, серии данными, ролик для копии ---

const copyEpisode = (id, { withCode = true } = {}) => {
  const from = path.join(SRC_EPISODES, id);
  const to = path.join(PUB, id);
  for (const f of ['episode.json', 'voice.ru.json', 'audio', 'sfx']) if (existsSync(path.join(from, f))) cpSync(path.join(from, f), path.join(to, f), { recursive: true });
  if (withCode) cpSync(path.join(REMOTION, 'examples', id, 'Episode.tsx'), path.join(to, 'code', 'Episode.tsx'));
};
copyEpisode('storozh-01');
copyEpisode('storozh-04');
cpSync(path.join(SRC_RENDERS, 'storozh-01.mp4'), path.join(PUB, 'storozh-01', 'episode.mp4'));

const writeJson = (p, v) => {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2));
};

// test-01: три реплики, без озвучки (черновик), декорации обоих сериалов
writeJson(path.join(PUB, 'test-01', 'voice.ru.json'), {
  lang: 'ru',
  lines: [
    { id: '01', text: 'Шторм третий день. Компас крутится, как заведённый.' },
    { id: '02', text: 'А в рубке оживает рация: «Откройте, это я».', role: 'radio' },
    { id: '03', text: 'Так что? Открываешь — или веришь компасу?' },
  ],
});
const test01 = {
  id: 'test-01', series: 'test', n: 1, lang: 'ru', look: 'riso',
  pacing: { defaultPre: 0.3, pre: { '02': 0.5 }, endHold: 3.6 },
  hud: ['ДЕНЬ 3', 'ВОДА 40 %'],
  shots: [
    { at: '01', set: 'kompas/deck', state: { clear: 0, barrels: 4 }, fx: 540, fy: 1000, s: [1, 1.4], cy: 880 },
    { at: '01', word: 4, set: 'kompas/wheelhouse', spot: 'compass', state: { chest: 1, clear: 0 } },
    { at: '02', set: 'storozh/glass-room', spot: 'radio', state: { lit: 0.2, dial: 0 } },
    { at: '02', word: 5, set: 'storozh/glass-room', spot: 'window' },
  ],
  events: [
    { at: '01', word: 5, change: { needle: 120 }, over: 1.4, sfx: 'hit' },
    { at: '02', word: 3, change: { dial: 1 }, over: 0.3, sfx: 'radio_on', fx: 'shake' },
    { at: '02', word: 5, change: { lit: 1 }, over: 1.2, fx: 'flash', hud: ['ДЕНЬ 3', 'ВОДА 30 %'] },
  ],
  bed: ['low', 'sea'],
  emphasis: [{ id: '01', words: ['Компас'], tone: 'yellow' }],
  choice: {
    q: 'ОТКРЫВАЕШЬ?',
    a: { title: 'ОТКРЫТЬ', price: 'впустишь того, кто стучит', set: 'storozh/door-room', state: { rule4: 1 }, spot: 'note' },
    b: { title: 'ПО КОМПАСУ', price: 'он врёт уже третий день', set: 'kompas/wheelhouse', state: { chest: 1, needle: 40 }, spot: 'compass' },
  },
};
writeJson(path.join(PUB, 'test-01', 'data.json'), test01);

// test-02: четыре реплики с голосом storozh-01 — «КОНЕЦ», перемотка, ветки, рация, фон
for (const id of ['01', '02', '03', '04']) {
  for (const ext of ['json', 'mp3']) cpSync(path.join(SRC_EPISODES, 'storozh-01', 'audio', 'ru', `${id}.${ext}`), path.join(PUB, 'test-02', 'audio', 'ru', `${id}.${ext}`));
}
cpSync(path.join(SRC_EPISODES, 'storozh-01', 'audio', 'ru', 'speech.json'), path.join(PUB, 'test-02', 'audio', 'ru', 'speech.json'));
cpSync(path.join(SRC_EPISODES, 'kompas-01', 'sfx'), path.join(PUB, 'test-02', 'sfx'), { recursive: true });
writeJson(path.join(PUB, 'test-02', 'voice.ru.json'), {
  lang: 'ru',
  lines: [
    { id: '01', text: 'Представь: тебя наняли на неделю сторожем горной базы. Платят втрое. Правило одно: после полуночи дверь не открывать.' },
    { id: '02', text: 'Первая ночь. Ты один на сорок километров.' },
    { id: '03', text: 'В два часа оживает рация.' },
    { id: '04', text: '«База, я спасатель. Стою у твоей двери. Открой, это я».', role: 'radio' },
  ],
});
const test02 = {
  id: 'test-02', series: 'test', n: 2, lang: 'ru', look: 'glass',
  pacing: { defaultPre: 0.3, pre: { '03': 1.7 }, endHold: 3.4 },
  hud: ['НОЧЬ 1/7', '02:14', 'ДРОВА 60 %'],
  branches: { wrong: 'a', wrongLines: ['02', '02'], rightLines: ['03', '03'] },
  shots: [
    { at: '01', set: 'storozh/door-room', fx: 540, fy: 850, s: [1, 1.6], cy: 800 },
    { at: '02', set: 'storozh/shed-door', state: { near: 0.2, eyes: 1 }, spot: 'figure', s: [1.3, 2.2] },
    { at: '03', set: 'storozh/glass-room', spot: 'room', state: { lit: 0.2 } },
    { at: '03', word: 3, set: 'storozh/glass-room', spot: 'radio', s: [1.8, 2] },
  ],
  events: [
    { at: '02', word: 0, fx: 'shake', sfx: 'hit' },
    { at: '02', word: 3, set: 'storozh/shed-door', change: { near: 1.2 }, over: 1, fx: 'flash' },
    { at: '02', fx: 'end' },
    { at: '03', fx: 'rewind' },
    { at: '03', word: 3, change: { dial: 1 }, over: 0.2, sfx: 'radio_on', hud: ['НОЧЬ 1/7', '02:41', 'ДРОВА 20 %'] },
  ],
  bed: ['low', 'wind'],
  choice: {
    q: 'ОТКРЫВАЕШЬ?',
    a: { title: 'ОТКРЫТЬ', price: 'впустишь того, кто пришёл без следов', set: 'storozh/door-room' },
    b: { title: 'НЕ ОТКРЫВАТЬ', price: 'если это человек — до утра не дотянет', set: 'storozh/glass-room', state: { lit: 1, near: 1 }, spot: 'figure' },
  },
};
writeJson(path.join(PUB, 'test-02', 'data.json'), test02);

// --- точка входа, как у движка: вне пакета ---

const entry = path.join(TMP, 'entry.tsx');
const directed = ['storozh-01', 'storozh-04'];
writeFileSync(
  entry,
  [
    "import { registerRoot } from 'remotion';",
    `import { makeRoot } from ${JSON.stringify(path.join(REMOTION, 'root'))};`,
    ...directed.map((id, i) => `import * as e${i} from ${JSON.stringify(path.join(PUB, id, 'code', 'Episode'))};`),
    `registerRoot(makeRoot([${directed.map((_, i) => `e${i}`).join(', ')}]));`,
    '',
  ].join('\n'),
);

// webpackOverride движка — ровно так: псевдоним @feed и модули из node_modules пакета
const engineOverride = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), '@feed': REMOTION },
    modules: [...(config.resolve?.modules ?? ['node_modules']), path.join(PKG, 'node_modules')],
  },
});

const sec = (t0) => (Date.now() - t0) / 1000;
let t0 = Date.now();
const serveUrl = await bundle({ entryPoint: entry, publicDir: PUB, webpackOverride: engineOverride, enableCaching: false, symlinkPublicDir: true, outDir: path.join(TMP, 'bundle') });
console.log(`сборка: ${sec(t0).toFixed(1)} с`);

const common = { serveUrl, browserExecutable: BROWSER ?? null, logLevel: 'warn' };
const pick = (id, inputProps = {}) => selectComposition({ ...common, id, inputProps });
const still = async (id, inputProps, output, opts = {}) => {
  const composition = await pick(id, inputProps);
  await renderStill({ ...common, composition, inputProps, output, ...opts });
  return composition;
};
const video = async (id, inputProps, output, opts = {}) => {
  const composition = await pick(id, inputProps);
  const t = Date.now();
  await renderMedia({ ...common, composition, inputProps, codec: 'h264', outputLocation: output, ...opts });
  const s = sec(t);
  const frames = composition.durationInFrames;
  console.log(`${id}: ${frames} кадров ${composition.width * (opts.scale ?? 1)}×${composition.height * (opts.scale ?? 1)} за ${s.toFixed(1)} с — ${(frames / s).toFixed(1)} кадр/с, ${(statSync(output).size / 1e6).toFixed(1)} МБ`);
  return composition;
};

// 1. облики: кадры для экранов знакомства
const LOOKS = ['ink', 'riso', 'pixel', 'papercut', 'glass', 'ascii'];
mkdirSync(path.join(PKG, 'assets', 'looks'), { recursive: true });
t0 = Date.now();
for (const id of LOOKS) await still(`look-${id}`, {}, path.join(PKG, 'assets', 'looks', `${id}.jpg`), { frame: 90, scale: 0.5, imageFormat: 'jpeg', jpegQuality: 86 });
console.log(`облики: 6 кадров за ${sec(t0).toFixed(1)} с → assets/looks/*.jpg`);

// 2. серии режиссёра: метаданные для движка и кадры
for (const id of directed) {
  const c = await pick(id);
  console.log(`${id}: ${(c.durationInFrames / 30).toFixed(1)} с, черновик: ${c.props.draft}, choiceAt: ${c.props.choiceAt?.toFixed(2)}, branchTimes: ${JSON.stringify(c.props.branchTimes && Object.fromEntries(Object.entries(c.props.branchTimes).map(([k, v]) => [k, v.map((x) => +x.toFixed(2))])))}`);
}
await still('storozh-04', {}, path.join(OUT, 'storozh-04-f300.jpg'), { frame: 300, scale: 0.5, imageFormat: 'jpeg' });
const s01 = await pick('storozh-01');
// последний кадр серии — картинка для карточки; кладём в public-папку уже после сборки (symlinkPublicDir)
await renderStill({ ...common, composition: s01, output: path.join(PUB, 'storozh-01', 'last.jpg'), frame: s01.durationInFrames - 1, imageFormat: 'jpeg', jpegQuality: 90 });

// 3. серии данными
for (const ep of [test01, test02]) {
  const c = await pick('data', { episode: ep });
  console.log(`${ep.id}: ${(c.durationInFrames / 30).toFixed(1)} с, черновик: ${c.props.draft}, choiceAt: ${c.props.choiceAt?.toFixed(2)}, branchTimes: ${JSON.stringify(c.props.branchTimes)}`);
}
await video('data', { episode: test01 }, path.join(OUT, 'test-01.mp4'));
await video('data', { episode: test02 }, path.join(OUT, 'test-02.mp4'));
const sheet = async (ep, at) => {
  for (const t of at) await still('data', { episode: ep }, path.join(OUT, `${ep.id}-${t.toFixed(1)}.jpg`), { frame: Math.round(t * 30), scale: 0.5, imageFormat: 'jpeg' });
};
await sheet(test01, [0.5, 2.5, 4.2, 5.8, 8.8]);
const c02 = await pick('data', { episode: test02 });
const l = c02.props.tl.lines;
await sheet(test02, [1, l[1].start + 1.2, l[1].end + 0.6, l[2].start - 0.1, l[2].start + 1.6, l[3].start + 0.8]);

// рамка серии в каждом облике: сцена-хук облика, плашка, субтитры, карточки развилки
mkdirSync(path.join(OUT, 'looks'), { recursive: true });
for (const look of ['ink', 'riso', 'pixel', 'papercut', 'glass', 'ascii']) {
  const set = `look/${look}-window`;
  const ep = {
    ...test01, look,
    shots: [{ at: '01', set, s: [1, 1.3] }, { at: '02', set, spot: 'figure', state: { near: 0.5 } }],
    events: [{ at: '02', word: 3, change: { near: 1, lit: 0.3 }, over: 1 }],
    choice: { ...test01.choice, a: { ...test01.choice.a, set, spot: 'figure', state: { near: 1 } }, b: { ...test01.choice.b, set, spot: 'radio', state: { dial: 0 } } },
  };
  for (const t of [1.5, 5.4, 9]) await still('data', { episode: ep }, path.join(OUT, 'looks', `${look}-${t}.jpg`), { frame: Math.round(t * 30), scale: 0.4, imageFormat: 'jpeg' });
}

// 4. копия для отправки: первые 7 с серии, развилка «на 5,5 с» — знак переезжает на 5 с, плашка с 5,5 с
const share = { src: 'storozh-01/episode.mp4', duration: 7, choiceAt: 5.5, lang: 'ru' };
await video('share', share, path.join(OUT, 'share.mp4'), { scale: 2 / 3 });
for (const t of [2, 6, 8.5]) await still('share', share, path.join(OUT, `share-${t}.jpg`), { frame: Math.round(t * 30), scale: 2 / 3, imageFormat: 'jpeg' });

// 5. части для быстрого пути движка: прозрачные PNG, заставка, карточка
await still('mark', { position: 'left' }, path.join(OUT, 'mark-left.png'), { scale: 2 / 3, imageFormat: 'png' });
await still('mark', { position: 'right' }, path.join(OUT, 'mark-right.png'), { scale: 2 / 3, imageFormat: 'png' });
await still('plaque', { lang: 'ru' }, path.join(OUT, 'plaque-ru.png'), { scale: 2 / 3, imageFormat: 'png' });
await still('plaque', { lang: 'en' }, path.join(OUT, 'plaque-en.png'), { scale: 2 / 3, imageFormat: 'png' });
await video('outro', { lang: 'ru' }, path.join(OUT, 'outro.mp4'), { scale: 2 / 3 });
await still('outro', { lang: 'ru' }, path.join(OUT, 'outro-3s.jpg'), { frame: 90, scale: 0.5, imageFormat: 'jpeg' });
await still('card', { frame: 'storozh-01/last.jpg', title: 'Сторож', n: 1, lang: 'ru' }, path.join(OUT, 'card.jpg'), { scale: 2 / 3, imageFormat: 'jpeg' });

// 6. все декорации библиотеки: по кадру в состоянии по умолчанию, общим планом
const catalog = JSON.parse(readFileSync(path.join(REMOTION, 'sets', 'catalog.json'), 'utf8'));
mkdirSync(path.join(OUT, 'sets'), { recursive: true });
t0 = Date.now();
for (const id of Object.keys(catalog)) await still('set', { id, t: 1 }, path.join(OUT, 'sets', `${id.replace('/', '__')}.jpg`), { scale: 0.25, imageFormat: 'jpeg' });
console.log(`декорации: ${Object.keys(catalog).length} кадров за ${sec(t0).toFixed(1)} с → ${path.join(OUT, 'sets')}`);

console.log(`готово: ${OUT}`);
if (!KEEP) rmSync(path.join(TMP, 'bundle'), { recursive: true, force: true });
