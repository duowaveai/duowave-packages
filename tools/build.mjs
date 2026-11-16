#!/usr/bin/env node
// Сборка каталога: проверка пакетов → архивы .vgp, превью, хеши, catalog.json и сайт в dist/.
//
//   node tools/build.mjs            проверить и собрать dist/
//   node tools/build.mjs --check    только проверить (то же, что node tools/check.mjs)
//   node tools/build.mjs --src <папка с пакетами> --out <куда собрать>
//   node tools/build.mjs --allow-empty   собрать и пустую ленту (каталог, где пакетов ещё нет)
//   node tools/build.mjs --signed   лента будет подписана: собрать и пакеты с кодом (плагины, приложения)
//
// Код — только в подписанной ленте: шлюз ставит плагины и приложения из каталога, только если catalog.json подписан
// ключом каталога (`entry_state` в gateway/src/plugins/catalog.rs). Подписывает CI (.github/workflows/pages.yml) — он
// и зовёт сборку с --signed, когда ключ есть в секретах. Без --signed пакеты с кодом проверяются, но в ленту не идут —
// сборка называет каждый. Своя лента (feed.config.json own) кода не несёт никогда: из своих источников шлюз его не
// ставит. У приложения со сборками (`runtime: process`) — архив под каждую платформу (`platforms`, в нём только её
// сборка) и общий архив со всеми, если он укладывается в пределы установщика.
//
// Пакет с ошибкой не собирается — и весь каталог тоже: лента либо целая, либо прежняя. Зависимостей нет: Node 18+.
// Формат — docs/plans/characters.md шлюза, раздел 2; схема — schemas/catalog.schema.json.
// Дополнительные ленты (ступень 2, docs/plans/catalog-feeds.md шлюза) — из feeds.json в корне: в catalog.json они
// попадают полем `feeds`, его читает шлюз 0.4.0 и новее; старые его пропускают.
// feed.config.json (docs/plans/custom-feeds.md шлюза): `hidden` — пакеты, которые шлюз 0.6.0+ скрывает (в ленте только
// `{ id, hidden: true }`, без архива и превью; папку пакета можно оставить); `own` — лента для своих источников: без
// отметки verified, голос `unknown` можно; `recommended` — что мы рекомендуем (MagicPlace шлюза 0.9.0); `recommends` —
// пакеты чужих лент, которые мы посмотрели и рекомендуем: адрес ленты (или без него), id и sha256 архива (поле `recommends` ленты).
// Для MagicPlace (docs/plans/magicplace.md шлюза) у пакета ещё `faces` (лица приложения — из манифеста), `addedAt`
// (первый коммит его manifest.json — нужна вся история git) и `downloads` (что он скачает сам — из манифеста).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import {
  ROOT,
  ENGINES,
  CODE_LIMITS,
  checkPackage,
  codeMinGateway,
  compareSemver,
  feedConfig,
  feedPhrases,
  imageInfo,
  packageDirs,
  plural,
  report,
} from './check.mjs';
import { readTarGz, tarGz } from './tar.mjs';

/** Формат ленты, который читает шлюз. */
const FORMAT = 1;
/**
 * С какой версии шлюз ставит пакеты этого вида из каталога, если манифест не скажет сам (`minGateway`). Каталог и
 * персонажи вошли в шлюз 0.1.0 (main, 07.11.2026): шлюзы без каталога ленту не читают вовсе. Новый вид или новое поле,
 * которого старый шлюз не поймёт, — поднять здесь или в манифесте до версии, где они появились. У кода — нижняя граница
 * `codeMinGateway` в check.mjs: ниже её лента не опустит, что бы ни сказал манифест.
 */
const DEFAULT_MIN_GATEWAY = { character: '0.1.0', theme: '0.1.0' };
/** Архив больше — установщик шлюза откажет. */
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;

/** Дополнительных лент — не больше стольких: столько же читает шлюз. */
const MAX_FEEDS = 4;

function parseArgs(argv) {
  const args = { check: false, allowEmpty: false, signed: false, src: join(ROOT, 'packages'), out: join(ROOT, 'dist') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--allow-empty') args.allowEmpty = true;
    else if (arg === '--signed') args.signed = true;
    else if (arg === '--src' || arg === '--out') {
      const value = argv[++i];
      if (!value) fail(`${arg}: нужна папка`);
      args[arg.slice(2)] = resolve(value);
    } else if (arg === '-h' || arg === '--help') {
      console.log('node tools/build.mjs [--check] [--allow-empty] [--signed] [--src packages] [--out dist]');
      process.exit(0);
    } else fail(`не знаю аргумент ${arg}`);
  }
  return args;
}

/**
 * Дополнительные ленты из feeds.json: `[{ url, publisher, title?, verified? }]`. Адрес — HTTPS (HTTP — только
 * localhost и 127.0.0.1, для проверки), `publisher` — строчные латинские буквы, цифры и «-», `title` — до 40 знаков,
 * `verified` — признаёт ли шлюз отметки `verified` пакетов этой ленты. Нет файла — нет и лент.
 */
function readFeeds() {
  const file = join(ROOT, 'feeds.json');
  if (!existsSync(file)) return [];
  let list;
  try {
    list = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`feeds.json: не JSON — ${error.message}`);
  }
  if (!Array.isArray(list)) fail('feeds.json: нужен список лент');
  if (list.length > MAX_FEEDS) fail(`feeds.json: не больше ${MAX_FEEDS} лент`);
  const seen = new Set();
  return list.map((feed, i) => {
    const at = `feeds.json[${i}]`;
    if (!feed || typeof feed !== 'object') fail(`${at}: нужен объект`);
    let url;
    try {
      url = new URL(feed.url);
    } catch {
      fail(`${at}.url: не адрес`);
    }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) fail(`${at}.url: только HTTPS`);
    if (seen.has(url.href)) fail(`${at}.url: эта лента уже есть`);
    seen.add(url.href);
    if (typeof feed.publisher !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(feed.publisher)) {
      fail(`${at}.publisher: строчные латинские буквы, цифры и «-», до 40 знаков`);
    }
    if (feed.title !== undefined && (typeof feed.title !== 'string' || !feed.title.trim() || feed.title.length > 40)) {
      fail(`${at}.title: строка до 40 знаков`);
    }
    if (feed.verified !== undefined && typeof feed.verified !== 'boolean') fail(`${at}.verified: true или false`);
    return { url: url.href, publisher: feed.publisher, title: feed.title?.trim(), verified: feed.verified ?? false };
  });
}

/**
 * «Где что работает» (reach.json в корне; docs/plans/own-server.md шлюза): `services` — поставщики «Мозга», слуха и
 * голоса, MCP-инструменты, Алиса по id — уходят файлом рядом с catalog.json (подписывается тем же ключом:
 * scripts/sign-catalog.sh шлюза, dist/reach.json); `apps` — по id пакета — ложатся в запись пакета ленты полем
 * `reach`. Данные без слов: `blocked` (откуда не работает) или `only` (откуда только), коды стран ISO 3166-1.
 */
/** `reach` записи пакета: из reach.json apps, без hosts (адреса приложения шлюз знает из его net:). */
function appReach(reach, id) {
  const entry = reach?.apps?.[id];
  if (!entry) return null;
  const { hosts: _hosts, ...rest } = entry;
  return rest;
}

function readReach(ids) {
  const file = join(ROOT, 'reach.json');
  if (!existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`reach.json: не JSON — ${error.message}`);
  }
  if (data.format !== 1) fail('reach.json: нужен format 1');
  if (!data.updatedAt || !/^\d{4}-\d{2}-\d{2}/.test(data.updatedAt)) fail('reach.json: нужен updatedAt (ГГГГ-ММ-ДД)');
  const country = /^[A-Z]{2}$/;
  const check = (at, entry) => {
    for (const key of Object.keys(entry)) {
      if (!['blocked', 'only', 'hosts'].includes(key)) fail(`${at}: лишнее поле ${key}`);
    }
    for (const key of ['blocked', 'only']) {
      if (entry[key] === undefined) continue;
      if (!Array.isArray(entry[key]) || !entry[key].every((code) => country.test(code))) {
        fail(`${at}.${key}: список кодов стран, например ["RU", "CN"]`);
      }
    }
    if (entry.blocked && entry.only) fail(`${at}: либо blocked, либо only`);
    if (entry.hosts !== undefined && (!Array.isArray(entry.hosts) || !entry.hosts.every((host) => typeof host === 'string' && /^[a-z0-9.*-]+$/.test(host)))) {
      fail(`${at}.hosts: список имён хостов строчными`);
    }
  };
  for (const [id, entry] of Object.entries(data.services ?? {})) check(`reach.json: services.${id}`, entry);
  for (const [id, entry] of Object.entries(data.apps ?? {})) {
    check(`reach.json: apps.${id}`, entry);
    if (!ids.includes(id)) fail(`reach.json: apps.${id} — нет такого пакета`);
  }
  return data;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const inside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Время ленты: SOURCE_DATE_EPOCH, иначе время последнего коммита, если рабочая копия чистая (сборка повторяется
 * байт в байт), иначе — сейчас.
 */
function updatedAt(src) {
  if (process.env.SOURCE_DATE_EPOCH) return iso(Number(process.env.SOURCE_DATE_EPOCH) * 1000);
  if (inside(src, ROOT)) {
    try {
      const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (git('status', '--porcelain') === '') {
        const seconds = git('log', '-1', '--format=%ct');
        if (seconds) return iso(Number(seconds) * 1000);
      }
    } catch {
      // не git или нет коммитов — тогда время сборки
    }
  }
  return iso(Date.now());
}

function copyTree(from, to, taken) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    const target = join(to, name);
    if (statSync(source).isDirectory()) copyTree(source, target, taken);
    else {
      if (existsSync(target)) fail(`site/${relative(join(ROOT, 'site'), source)}: такой файл в dist/ уже есть (${relative(ROOT, target)})`);
      copyFileSync(source, target);
      taken.push(relative(ROOT, target));
    }
  }
}

/** Архив .vgp из файлов пакета (manifest.json первым) с самопроверкой: читается обратно и даёт ровно те же файлы. */
function archiveOf(id, files) {
  const entries = files.map((file) => ({ name: file.path, data: readFileSync(file.abs) }));
  const archive = tarGz(entries);
  const back = readTarGz(archive);
  const same =
    back.length === entries.length &&
    back.every((entry, i) => entry.type === '0' && entry.name === entries[i].name && entry.data.equals(entries[i].data));
  if (!same) fail(`${id}: архив не читается обратно — сборка сломана`);
  if (!back.some((entry) => entry.name === 'manifest.json')) fail(`${id}: в архиве нет manifest.json`);
  return { archive, sha256: createHash('sha256').update(archive).digest('hex') };
}

/** Что это за пакет с кодом — для строк сборки. */
function whatOf(r) {
  const kind = r.manifest.kind ?? 'plugin';
  if (kind === 'plugin') return 'плагин';
  if (kind !== 'app') return kind;
  return r.runtime === 'node' ? 'приложение на Node' : r.runtime === 'process' ? 'приложение со сборками' : 'приложение';
}

/**
 * Лица приложения для MagicPlace (docs/plans/magicplace.md шлюза): виджет стола — карточки или слот `desk.widgets`
 * (у приложения, что объявляет виджет только в коде своего окна, как «Лента», — по `panel.js`); навык — фразы для
 * колонки или инструменты «Мозга»; окно — свой раздел пульта; расписание. У персонажа и темы лиц нет.
 */
function facesOf(r) {
  const m = r.manifest;
  if (!r.code) return [];
  const c = m.contributes && typeof m.contributes === 'object' ? m.contributes : {};
  const panel = c.panel && typeof c.panel === 'object' ? c.panel : {};
  const listed = (value) => Array.isArray(value) && value.length > 0;
  const panelJs = r.files.find((file) => file.path === 'panel.js');
  const widgetInCode = panelJs ? /["']desk\.widgets["']/.test(readFileSync(panelJs.abs, 'utf8')) : false;
  const faces = [];
  if (listed(panel.cards) || (Array.isArray(panel.slots) && panel.slots.includes('desk.widgets')) || widgetInCode) faces.push('widget');
  if (listed(c.intents) || listed(c.tools)) faces.push('skill');
  if (listed(panel.sections)) faces.push('window');
  if (listed(c.schedules)) faces.push('schedule');
  return faces;
}

/** Что пакет скачает сам, кроме архива (манифест `downloads`, проверен в check.mjs). */
function downloadsOf(manifest) {
  if (!Array.isArray(manifest.downloads)) return [];
  return manifest.downloads.map((item) => ({ id: item.id, title: item.title.trim(), mb: item.mb, when: item.when }));
}

/** git в корне репозитория; не git или ошибка — исключение. */
const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

let historyKnown;
/** Есть ли у сборки вся история git: в неглубокой копии (CI без fetch-depth: 0) первого коммита пакета не узнать. */
function fullHistory(src) {
  if (historyKnown !== undefined) return historyKnown;
  historyKnown = false;
  if (!inside(src, ROOT)) return historyKnown;
  try {
    historyKnown = git('rev-parse', '--is-shallow-repository') === 'false';
  } catch {
    historyKnown = false;
  }
  return historyKnown;
}

/**
 * Когда пакет появился в каталоге: время первого коммита его manifest.json (с переездами папки). MagicPlace по нему
 * собирает ряд «Новое». Неглубокая история или пакет ещё не закоммичен — null, поля в ленте не будет.
 */
function addedAtOf(src, id) {
  if (!fullHistory(src)) return null;
  try {
    const path = relative(ROOT, join(src, id, 'manifest.json')).split(sep).join('/');
    const times = git('log', '--follow', '--diff-filter=A', '--format=%ct', '--', path).split('\n').filter(Boolean);
    const first = times[times.length - 1];
    return first ? iso(Number(first) * 1000) : null;
  } catch {
    return null;
  }
}

/** Модели, под которые у персонажей пакета есть снимки: известные — в их порядке, остальные — по алфавиту. */
function needsOf(manifest) {
  const engines = new Set();
  for (const character of manifest.contributes?.characters ?? []) {
    for (const engine of Object.keys(character.voices ?? {})) engines.add(engine);
  }
  const known = Object.keys(ENGINES).filter((id) => engines.has(id));
  const other = [...engines].filter((id) => !(id in ENGINES)).sort();
  return [...known, ...other].map((id) => ({
    kind: 'engine',
    id,
    ...(ENGINES[id] ? { title: ENGINES[id].title, diskMb: ENGINES[id].diskMb } : {}),
    optional: true,
  }));
}

/** JSON с отступом в два пробела, но короткие списки строк и чисел — в одну строку: ленту удобно читать глазами. */
function pretty(value, indent = '') {
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((item) => item === null || typeof item !== 'object')) {
      const line = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (line.length <= 100) return line;
    }
    return `[\n${value.map((item) => inner + pretty(item, inner)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined);
    if (keys.length === 0) return '{}';
    return `{\n${keys.map((key) => `${inner}${JSON.stringify(key)}: ${pretty(value[key], inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.src)) fail(`нет папки пакетов ${args.src}`);

  let config;
  try {
    config = feedConfig();
  } catch (error) {
    fail(error.message);
  }
  // Скрытые не проверяются и не собираются: в ленте от них остаётся только id.
  const results = packageDirs(args.src)
    .filter((dir) => !config.hidden.includes(dir.split(sep).pop()))
    .map(checkPackage);
  if (results.length === 0 && config.hidden.length === 0 && !args.allowEmpty) {
    fail(`в ${args.src} нет ни одного пакета (пустая лента — --allow-empty)`);
  }
  const ok = results.length === 0 || report(results);
  if (!ok) fail('есть ошибки — каталог не собран');
  const feeds = readFeeds();
  const reach = readReach(results.map((r) => r.manifest.id));
  // Коронные фразы персонажей (phrases.json): только пакетов этой ленты и их персонажей.
  let phrases;
  try {
    phrases = feedPhrases(
      Object.fromEntries(results.map((r) => [r.manifest.id, (r.manifest.contributes?.characters ?? []).map((c) => c.id)])),
    );
  } catch (error) {
    fail(error.message);
  }
  const phraseCount = Object.values(phrases).flatMap((byCharacter) => Object.values(byCharacter)).reduce((n, c) => n + c.lines.length, 0);
  const unknownUnlisted = config.unlisted.filter((id) => !results.some((r) => r.manifest.id === id));
  if (unknownUnlisted.length) fail(`feed.config.json: unlisted — нет таких пакетов: ${unknownUnlisted.join(', ')}`);
  const unknownRecommended = config.recommended.filter((id) => !results.some((r) => r.manifest.id === id));
  if (unknownRecommended.length) fail(`feed.config.json: recommended — нет таких пакетов: ${unknownRecommended.join(', ')}`);

  // Код — только в подписанную ленту; в свою — никогда.
  const skipped = [];
  const included = results.filter((r) => {
    if (!r.code) return true;
    if (config.own) skipped.push({ r, why: 'своя лента, а из своих источников шлюз код не ставит' });
    else if (!args.signed) skipped.push({ r, why: 'код идёт только в подписанную ленту (сборка с --signed; подпись ставит CI ключом каталога)' });
    else return true;
    return false;
  });
  const tellSkipped = () => {
    for (const { r, why } of skipped) console.log(`  ${r.manifest.id} ${r.manifest.version} (${whatOf(r)}) не в ленте: ${why}`);
  };

  if (args.check) {
    const extra = feeds.length ? `, ${plural(feeds.length, ['дополнительная лента', 'дополнительные ленты', 'дополнительных лент'])}` : '';
    const hidden = config.hidden.length ? `, скрыто: ${config.hidden.join(', ')}` : '';
    const unlisted = config.unlisted.length ? `, скрыты от списков: ${config.unlisted.join(', ')}` : '';
    const recommended = config.recommended.length ? `, рекомендуем: ${config.recommended.join(', ')}` : '';
    const pinned = config.recommends.length ? `, из чужих лент: ${config.recommends.map((pin) => pin.id).join(', ')}` : '';
    const said = phraseCount ? `, коронных фраз: ${phraseCount}` : '';
    console.log(`Проверка пройдена: ${plural(results.length, ['пакет', 'пакета', 'пакетов'])}${extra}${hidden}${unlisted}${recommended}${pinned}${said}.`);
    tellSkipped();
    return;
  }
  if (included.length === 0 && results.length > 0 && config.hidden.length === 0 && !args.allowEmpty) {
    tellSkipped();
    fail('в ленту не идёт ни один пакет (пустая лента — --allow-empty)');
  }

  const out = args.out;
  for (const [what, path] of [['репозиторий', ROOT], ['пакеты', args.src], ['сайт', join(ROOT, 'site')]]) {
    if (inside(path, out)) fail(`--out ${out} содержит ${what} — не стану его стирать`);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'packages'), { recursive: true });
  mkdirSync(join(out, 'previews'), { recursive: true });

  const packages = [];
  const lines = [];
  for (const r of included) {
    const m = r.manifest;
    const put = (name, { archive, sha256 }) => {
      if (archive.length > MAX_ARCHIVE_BYTES) fail(`${m.id}: архив ${name} — ${archive.length} байт, больше предела установщика`);
      writeFileSync(join(out, 'packages', name), archive);
      return { url: `packages/${name}`, sha256, size: archive.length };
    };

    // Приложение со сборками: под каждую платформу — архив только с её сборкой; общий — со всеми, если влезает.
    let platforms;
    let common;
    const targets = r.code && r.runtime === 'process' ? Object.entries(r.targets ?? {}) : [];
    if (targets.length) {
      platforms = {};
      for (const [platform, target] of targets) {
        const others = new Set(targets.filter(([p]) => p !== platform).map(([, t]) => t.file));
        others.delete(target.file);
        const files = r.files.filter((file) => !others.has(file.path));
        platforms[platform] = put(`${m.id}-${m.version}-${platform}.vgp`, archiveOf(m.id, files));
      }
      const whole = archiveOf(m.id, r.files);
      if (whole.archive.length <= MAX_ARCHIVE_BYTES && r.bytes <= CODE_LIMITS.unpackedBytes) {
        common = put(`${m.id}-${m.version}.vgp`, whole);
      } else {
        // Шлюз читает platforms (каждый, что ставит код) и общий архив тогда не берёт: адрес — лишь для полноты записи.
        const first = Object.keys(platforms).sort()[0];
        common = platforms[first];
        lines.push(`  ${m.id}: все сборки вместе не влезают в один архив — общий адрес ведёт на архив ${first}`);
      }
    } else common = put(`${m.id}-${m.version}.vgp`, archiveOf(m.id, r.files));

    // Превью: картинка и фразы первого персонажа — галерея покажет и проиграет пакет до установки. У приложения и плагина
    // — только картинка, их значок (`icon`): MagicPlace и ярлык на столе.
    const preview = {};
    const first = r.code ? undefined : m.contributes?.characters?.[0];
    // Папка превью — по версии: адрес картинки меняется с каждой версией, и ни кэш перед сайтом, ни копия в шлюзе
    // (он скачивает превью один раз на версию) не оставят старую картинку у новой версии.
    const previewDir = join(out, 'previews', m.id, m.version);
    if (first) {
      mkdirSync(previewDir, { recursive: true });
      const avatar = join(r.dir, 'assets', first.avatar);
      const type = imageInfo(readFileSync(avatar)).type;
      copyFileSync(avatar, join(previewDir, `image.${type}`));
      preview.image = `previews/${m.id}/${m.version}/image.${type}`;
    } else if (r.icon) {
      mkdirSync(previewDir, { recursive: true });
      const icon = join(r.dir, r.icon);
      const type = imageInfo(readFileSync(icon)).type;
      copyFileSync(icon, join(previewDir, `image.${type}`));
      preview.image = `previews/${m.id}/${m.version}/image.${type}`;
    }
    preview.samples = [];
    if (first) {
      first.samples.forEach((sample, i) => {
        copyFileSync(join(r.dir, 'assets', sample.file), join(previewDir, `${i + 1}.opus`));
        preview.samples.push(`previews/${m.id}/${m.version}/${i + 1}.opus`);
      });
    }

    let minGateway = m.minGateway ?? DEFAULT_MIN_GATEWAY[m.kind];
    if (r.code && (!minGateway || compareSemver(minGateway, codeMinGateway(m)) < 0)) minGateway = codeMinGateway(m);
    const faces = facesOf(r);
    const addedAt = addedAtOf(args.src, m.id);
    const downloads = downloadsOf(m);

    packages.push({
      id: m.id,
      kind: m.kind ?? 'plugin',
      version: m.version,
      title: m.title,
      description: m.description,
      // Языки пакета и его название с описанием на них (манифест `languages`, `locales`): каталог шлюза показывает
      // пакет на языке человека, нет перевода — по-английски.
      ...(Array.isArray(m.languages) ? { languages: m.languages } : {}),
      ...(m.locales && typeof m.locales === 'object' ? { locales: catalogLocales(m.locales, downloads) } : {}),
      api: m.api,
      runs: m.runs,
      minGateway,
      url: common.url,
      sha256: common.sha256,
      size: common.size,
      platforms,
      preview,
      needs: r.code ? [] : needsOf(m),
      license: m.license,
      // Своя лента (feed.config.json own) ни за кого не ручается.
      verified: !config.own,
      // Код: чем он работает, сколько памяти просит (шлюз читает budget.memoryMb — на колонке не влезающее серое) и
      // сколько места его папке, какие права спросит — страница каталога и пульт показывают это до установки.
      ...(r.code
        ? {
            runtime: r.runtime,
            budget: { memoryMb: r.budget.memoryMb, filesMb: r.budget.filesMb },
            permissions: r.permissions,
          }
        : {}),
      // MagicPlace (шлюз 0.9.0; старые шлюзы поля пропускают): лица приложения, наша рекомендация, когда пакет
      // появился в каталоге и что он скачает сам.
      ...(faces.length ? { faces } : {}),
      ...(config.recommended.includes(m.id) ? { recommended: true } : {}),
      // Скрытый лентой (шлюз новее 0.11.1; старые поле пропускают): виден со скрытой возможностью разработчика.
      ...(config.unlisted.includes(m.id) ? { unlisted: true } : {}),
      ...(addedAt ? { addedAt } : {}),
      ...(downloads.length ? { downloads } : {}),
      // Откуда до приложения достучаться (reach.json apps; шлюз с «Выходом в интернет», старые поле пропускают).
      ...(appReach(reach, m.id) ? { reach: appReach(reach, m.id) } : {}),
    });
  }
  for (const id of config.hidden) packages.push({ id, hidden: true });

  // Пакеты чужих лент, которые мы посмотрели и рекомендуем (feed.config.json `recommends`): шлюз читает их только у
  // главной ленты и метит пакет, только если хеш его архива тот же.
  const catalog = {
    format: FORMAT,
    updatedAt: updatedAt(args.src),
    packages,
    ...(feeds.length ? { feeds } : {}),
    ...(config.recommends.length ? { recommends: config.recommends } : {}),
    // Коронные фразы персонажей (phrases.json): шлюз новее 0.13.0 говорит их изредка, старые поле пропускают.
    ...(phraseCount ? { phrases } : {}),
  };
  writeFileSync(join(out, 'catalog.json'), pretty(catalog) + '\n');
  if (reach) {
    const { apps: _apps, ...shared } = reach;
    writeFileSync(join(out, 'reach.json'), pretty(shared) + '\n');
  }

  const site = [];
  if (existsSync(join(ROOT, 'site'))) copyTree(join(ROOT, 'site'), out, site);
  // GitHub Pages: отдавать файлы как есть, без Jekyll.
  writeFileSync(join(out, '.nojekyll'), '');

  console.log('');
  const built = packages.filter((p) => !p.hidden).length;
  const own = config.own ? ' (своя лента: без отметки verified)' : '';
  console.log(`Каталог собран в ${relative(process.cwd(), out) || '.'}/ — ${plural(built, ['пакет', 'пакета', 'пакетов'])}${own}, обновлён ${catalog.updatedAt}:`);
  for (const p of packages) {
    if (p.hidden) {
      console.log(`  ${p.id}: скрыт — шлюзы 0.6.0+ уберут его с экрана`);
      continue;
    }
    const archive = (a) => `${a.url}  ${(a.size / 1024).toFixed(1)} КБ  sha256 ${a.sha256.slice(0, 12)}…`;
    if (p.runtime) {
      const rights = p.permissions.length ? `права: ${p.permissions.join(', ')}` : 'без прав';
      console.log(`  ${archive(p)}  ${whatOf({ manifest: p, runtime: p.runtime })}, память до ${p.budget.memoryMb} МБ, ${rights}`);
      for (const [platform, a] of Object.entries(p.platforms ?? {})) console.log(`    ${platform}: ${archive(a)}`);
      continue;
    }
    const needs = p.needs.length ? `нужна модель: ${p.needs.map((n) => n.title ?? n.id).join(' или ')}` : 'без моделей';
    console.log(`  ${archive(p)}  ${plural(p.preview.samples.length, ['фраза', 'фразы', 'фраз'])}  ${needs}`);
  }
  for (const line of lines) console.log(line);
  tellSkipped();
  const coded = packages.filter((p) => p.runtime).length;
  if (coded) {
    console.log(`  с кодом: ${plural(coded, ['пакет', 'пакета', 'пакетов'])} — шлюзы поставят их, только если catalog.json подписан ключом каталога (catalog.json.minisig рядом)`);
  }
  const faced = packages.filter((p) => p.faces?.length);
  if (faced.length) console.log(`  лица приложений: ${faced.map((p) => `${p.id} — ${p.faces.join(', ')}`).join('; ')}`);
  const recommended = packages.filter((p) => p.recommended).map((p) => p.id);
  if (recommended.length) console.log(`  рекомендуем: ${recommended.join(', ')}`);
  for (const [pkg, byCharacter] of Object.entries(phrases)) {
    for (const [character, given] of Object.entries(byCharacter)) {
      console.log(`  коронные фразы: ${pkg}/${character} — ${given.lines.length}, раз в ${given.every ?? 4} ответа в среднем`);
    }
  }
  for (const pin of config.recommends) {
    console.log(`  рекомендуем из чужой ленты: ${pin.id} (${pin.feed ?? 'без адреса ленты'}), архив ${pin.sha256.slice(0, 12)}…`);
  }
  if (packages.some((p) => !p.hidden) && !packages.some((p) => p.addedAt)) {
    console.log('  addedAt не записан: нет всей истории git (CI — fetch-depth: 0) — ряд «Новое» в MagicPlace будет пуст');
  }
  console.log(`  catalog.json, сайт: ${site.length ? site.map((s) => s.split(sep).pop()).join(', ') : 'нет'}`);
  for (const feed of feeds) console.log(`  дополнительная лента: ${feed.url} — ${feed.title ?? feed.publisher}${feed.verified ? ', проверенная' : ''}`);
}

main();

/**
 * Из переводов манифеста — то, что нужно каталогу: название и описание на каждом языке и названия загрузок
 * (`downloads`) — MagicPlace ищет по всем языкам и называет загрузки на языке человека.
 */
function catalogLocales(locales, downloads = []) {
  const out = {};
  const ids = new Set(downloads.map((item) => item.id));
  for (const [code, texts] of Object.entries(locales)) {
    if (!/^[a-z]{2,3}$/.test(code) || !texts || typeof texts !== 'object') continue;
    const entry = {};
    if (typeof texts.title === 'string' && texts.title.trim()) entry.title = texts.title.trim().slice(0, 80);
    if (typeof texts.description === 'string' && texts.description.trim()) entry.description = texts.description.trim().slice(0, 500);
    if (texts.downloads && typeof texts.downloads === 'object') {
      const named = {};
      for (const [id, title] of Object.entries(texts.downloads)) {
        if (ids.has(id) && typeof title === 'string' && title.trim()) named[id] = title.trim().slice(0, 80);
      }
      if (Object.keys(named).length) entry.downloads = named;
    }
    if (Object.keys(entry).length) out[code] = entry;
  }
  return out;
}
