#!/usr/bin/env node
// Сборка каталога: проверка пакетов → архивы .vgp, превью, хеши, catalog.json и сайт в dist/.
//
//   node tools/build.mjs            проверить и собрать dist/
//   node tools/build.mjs --check    только проверить (то же, что node tools/check.mjs)
//   node tools/build.mjs --src <папка с пакетами> --out <куда собрать>
//   node tools/build.mjs --allow-empty   собрать и пустую ленту (каталог, где пакетов ещё нет)
//
// Пакет с ошибкой не собирается — и весь каталог тоже: лента либо целая, либо прежняя. Зависимостей нет: Node 18+.
// Формат — docs/plans/characters.md шлюза, раздел 2; схема — schemas/catalog.schema.json.
// Дополнительные ленты (ступень 2, docs/plans/catalog-feeds.md шлюза) — из feeds.json в корне: в catalog.json они
// попадают полем `feeds`, его читает шлюз 0.4.0 и новее; старые его пропускают.
// feed.config.json (docs/plans/custom-feeds.md шлюза): `hidden` — пакеты, которые шлюз 0.6.0+ скрывает (в ленте только
// `{ id, hidden: true }`, без архива и превью; папку пакета можно оставить); `own` — лента для своих источников: без
// отметки verified, голос `unknown` можно.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import { ROOT, ENGINES, checkPackage, feedConfig, imageInfo, packageDirs, plural, report } from './check.mjs';
import { readTarGz, tarGz } from './tar.mjs';

/** Формат ленты, который читает шлюз. */
const FORMAT = 1;
/**
 * С какой версии шлюз ставит пакеты этого вида из каталога, если манифест не скажет сам (`minGateway`). Каталог и
 * персонажи вошли в шлюз 0.1.0 (main, 07.11.2026): шлюзы без каталога ленту не читают вовсе. Новый вид или новое поле,
 * которого старый шлюз не поймёт, — поднять здесь или в манифесте до версии, где они появились.
 */
const DEFAULT_MIN_GATEWAY = { character: '0.1.0', theme: '0.1.0' };
/** Архив больше — установщик шлюза откажет. */
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;

/** Дополнительных лент — не больше стольких: столько же читает шлюз. */
const MAX_FEEDS = 4;

function parseArgs(argv) {
  const args = { check: false, allowEmpty: false, src: join(ROOT, 'packages'), out: join(ROOT, 'dist') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--allow-empty') args.allowEmpty = true;
    else if (arg === '--src' || arg === '--out') {
      const value = argv[++i];
      if (!value) fail(`${arg}: нужна папка`);
      args[arg.slice(2)] = resolve(value);
    } else if (arg === '-h' || arg === '--help') {
      console.log('node tools/build.mjs [--check] [--allow-empty] [--src packages] [--out dist]');
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
  if (args.check) {
    const extra = feeds.length ? `, ${plural(feeds.length, ['дополнительная лента', 'дополнительные ленты', 'дополнительных лент'])}` : '';
    const hidden = config.hidden.length ? `, скрыто: ${config.hidden.join(', ')}` : '';
    console.log(`Проверка пройдена: ${plural(results.length, ['пакет', 'пакета', 'пакетов'])}${extra}${hidden}.`);
    return;
  }

  const out = args.out;
  for (const [what, path] of [['репозиторий', ROOT], ['пакеты', args.src], ['сайт', join(ROOT, 'site')]]) {
    if (inside(path, out)) fail(`--out ${out} содержит ${what} — не стану его стирать`);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'packages'), { recursive: true });
  mkdirSync(join(out, 'previews'), { recursive: true });

  const packages = [];
  for (const r of results) {
    const m = r.manifest;
    const entries = r.files.map((file) => ({ name: file.path, data: readFileSync(file.abs) }));
    const archive = tarGz(entries);

    // Самопроверка: архив читается обратно и даёт ровно те же файлы.
    const back = readTarGz(archive);
    const same =
      back.length === entries.length &&
      back.every((entry, i) => entry.type === '0' && entry.name === entries[i].name && entry.data.equals(entries[i].data));
    if (!same) fail(`${m.id}: архив не читается обратно — сборка сломана`);
    if (!back.some((entry) => entry.name === 'manifest.json')) fail(`${m.id}: в архиве нет manifest.json`);
    if (archive.length > MAX_ARCHIVE_BYTES) fail(`${m.id}: архив ${archive.length} байт — больше предела установщика`);

    const name = `${m.id}-${m.version}.vgp`;
    writeFileSync(join(out, 'packages', name), archive);
    const sha256 = createHash('sha256').update(archive).digest('hex');

    // Превью: картинка и фразы первого персонажа — галерея покажет и проиграет пакет до установки.
    const preview = {};
    const first = m.contributes?.characters?.[0];
    const previewDir = join(out, 'previews', m.id);
    if (first) {
      mkdirSync(previewDir, { recursive: true });
      const avatar = join(r.dir, 'assets', first.avatar);
      const type = imageInfo(readFileSync(avatar)).type;
      copyFileSync(avatar, join(previewDir, `image.${type}`));
      preview.image = `previews/${m.id}/image.${type}`;
    }
    preview.samples = [];
    if (first) {
      first.samples.forEach((sample, i) => {
        copyFileSync(join(r.dir, 'assets', sample.file), join(previewDir, `${i + 1}.opus`));
        preview.samples.push(`previews/${m.id}/${i + 1}.opus`);
      });
    }

    packages.push({
      id: m.id,
      kind: m.kind,
      version: m.version,
      title: m.title,
      description: m.description,
      api: m.api,
      runs: m.runs,
      minGateway: m.minGateway ?? DEFAULT_MIN_GATEWAY[m.kind],
      url: `packages/${name}`,
      sha256,
      size: archive.length,
      preview,
      needs: needsOf(m),
      license: m.license,
      // Своя лента (feed.config.json own) ни за кого не ручается.
      verified: !config.own,
    });
  }
  for (const id of config.hidden) packages.push({ id, hidden: true });

  const catalog = { format: FORMAT, updatedAt: updatedAt(args.src), packages, ...(feeds.length ? { feeds } : {}) };
  writeFileSync(join(out, 'catalog.json'), pretty(catalog) + '\n');

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
    const needs = p.needs.length ? `нужна модель: ${p.needs.map((n) => n.title ?? n.id).join(' или ')}` : 'без моделей';
    console.log(`  ${p.url}  ${(p.size / 1024).toFixed(1)} КБ  sha256 ${p.sha256.slice(0, 12)}…  ${plural(p.preview.samples.length, ['фраза', 'фразы', 'фраз'])}  ${needs}`);
  }
  console.log(`  catalog.json, сайт: ${site.length ? site.map((s) => s.split(sep).pop()).join(', ') : 'нет'}`);
  for (const feed of feeds) console.log(`  дополнительная лента: ${feed.url} — ${feed.title ?? feed.publisher}${feed.verified ? ', проверенная' : ''}`);
}

main();
