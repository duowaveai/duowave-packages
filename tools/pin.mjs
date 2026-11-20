#!/usr/bin/env node
// Рекомендовать пакет чужой ленты — своего источника, который люди добавляют по ссылке, или ленты партнёра
// (`recommends` в feed.config.json, README, «Рекомендовать пакет чужой ленты»): хеш его архива берётся отсюда, не руками.
//
//   node tools/pin.mjs                          закреплённые пакеты: тот ли у каждого архив в его ленте сейчас
//   node tools/pin.mjs <лента> <id>             закрепить: скачать ленту и архив пакета, сверить хеш, положить архив
//                                               в work/pins/ — посмотреть его, — и вписать строку в feed.config.json
//   node tools/pin.mjs --no-feed <лента> <id>   закрепить без адреса ленты: в каталоге — только id и хеш архива (шлюз
//                                               новее 0.11.0), адрес остаётся здесь, в work/pins/feeds.json, для проверки;
//                                               id такого пакета — только случайный, «p-» и 12 знаков 0–9 a–f
//   node tools/pin.mjs --remove <лента> <id>    убрать строки пакета (у сборок под платформы — все)
//   --platform <платформа>                      у приложения со сборками под платформы — чей архив закрепить
//                                               (linux-aarch64 — колонка, darwin-arm64 — Mac); одна сборка — берётся
//                                               она сама. Шлюз ставит архив своей платформы, только если закреплён
//                                               именно он: каждая платформа — своей строкой, своей командой
//
// <лента> — адрес её catalog.json: HTTPS (HTTP — только localhost и 127.0.0.1). Пакет с кодом (плагин, приложение
// одним архивом) шлюз из чужой ленты ставит, только когда подписанный каталог закрепил этот архив: закрепляйте код,
// только посмотрев его (архив кладётся в work/pins/). У приложения со сборками под платформы каждая команда закрепляет
// архив одной платформы (`--platform`) своей строкой: строки других платформ этой же версии остаются, строки прежних
// версий (их архивов в ленте уже нет) уходят. Закрепили — каталог публикуется как обычно
// (tools/publish.sh); выпуск шлюза не нужен (код из чужих лент ставят шлюзы с `code_allowed`, старые его не ставят).
// Зависимостей нет: Node 18+.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { MAX_RECOMMENDS, ROOT, compareSemver, feedConfig, isPackageId, isRandomPackageId } from './check.mjs';
import { readTarGz } from './tar.mjs';

/** Лента — до 1 МБ, архив — до 16 МБ: столько же берёт шлюз. */
const MAX_FEED_BYTES = 1024 * 1024;
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const CONFIG = join(ROOT, 'feed.config.json');
const PINS_DIR = join(ROOT, 'work', 'pins');
/** Адреса лент закреплённых без адреса: id → лента. Только здесь (work/ не в git): чтобы проверять, тот ли архив. */
const ADDRESSES = join(PINS_DIR, 'feeds.json');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Адрес ленты, как его пишет feed.config.json: HTTPS, HTTP — только этот компьютер. */
function feedUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`«${text}» — не адрес ленты (…/catalog.json)`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error(`${url.href}: только HTTPS`);
  return url;
}

/** Файл по адресу целиком, не больше `max` байт. */
async function download(url, max) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`${url}: ответ ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > max) throw new Error(`${url}: больше ${max / 1024 / 1024} МБ`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > max) throw new Error(`${url}: больше ${max / 1024 / 1024} МБ`);
    return bytes;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${url}: не ответил за ${TIMEOUT_MS / 1000} с`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Лента по адресу: формат 1, список пакетов. */
async function readFeed(url) {
  const bytes = await download(url, MAX_FEED_BYTES);
  let feed;
  try {
    feed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${url.href}: не JSON`);
  }
  if (feed?.format !== 1) throw new Error(`${url.href}: format ${feed?.format ?? 'нет'} — шлюз читает только 1`);
  if (!Array.isArray(feed.packages)) throw new Error(`${url.href}: нет списка packages`);
  return feed;
}

/** Самая новая версия пакета в ленте; скрытый — как нет. */
function newestOf(feed, id) {
  const versions = feed.packages.filter((entry) => entry?.id === id && !entry.hidden);
  if (feed.packages.some((entry) => entry?.id === id && entry.hidden === true)) return { hidden: true };
  return versions.sort((a, b) => compareSemver(b.version, a.version))[0] ?? null;
}

/** feed.config.json как есть (нет файла — пустой). */
function readConfig() {
  if (!existsSync(CONFIG)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch (error) {
    fail(`feed.config.json: не JSON — ${error.message}`);
  }
}

/** feed.config.json глазами: короткие списки — в строку, каждая строка recommends — одной строкой. */
function configText(config) {
  const keys = Object.keys(config).filter((key) => config[key] !== undefined);
  const lines = keys.map((key) => {
    const value = config[key];
    if (key === 'recommends' && Array.isArray(value)) {
      if (value.length === 0) return `  "recommends": []`;
      const item = (pin) =>
        `{ ${Object.entries(pin).map(([name, text]) => `${JSON.stringify(name)}: ${JSON.stringify(text)}`).join(', ')} }`;
      return `  "recommends": [\n${value.map((pin) => `    ${item(pin)}`).join(',\n')}\n  ]`;
    }
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** Записать и проверить тем же, чем сборка: не прошло — вернуть прежний файл. */
function writeConfig(config) {
  const before = existsSync(CONFIG) ? readFileSync(CONFIG, 'utf8') : null;
  writeFileSync(CONFIG, configText(config));
  try {
    feedConfig();
  } catch (error) {
    if (before === null) writeFileSync(CONFIG, '{}\n');
    else writeFileSync(CONFIG, before);
    fail(error.message);
  }
}

const short = (sha) => `${sha.slice(0, 12)}…`;

/** Адреса лент для строк без адреса (work/pins/feeds.json): нет файла — пусто. */
function readAddresses() {
  if (!existsSync(ADDRESSES)) return {};
  try {
    const value = JSON.parse(readFileSync(ADDRESSES, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeAddresses(addresses) {
  mkdirSync(PINS_DIR, { recursive: true });
  writeFileSync(ADDRESSES, `${JSON.stringify(addresses, null, 2)}\n`);
}

/** Лента строки: её `feed` или, у строки без адреса, записанный здесь. */
const feedOf = (item, addresses) => item?.feed ?? addresses[item?.id] ?? null;

/** Что внутри архива: манифест — вид, название, версия, чей голос у персонажей; сколько файлов. */
function describe(archive) {
  let entries;
  try {
    entries = readTarGz(archive);
  } catch (error) {
    throw new Error(`архив не читается: ${error.message}`);
  }
  const manifest = entries.find((entry) => entry.name === 'manifest.json');
  if (!manifest) throw new Error('в архиве нет manifest.json');
  let m;
  try {
    m = JSON.parse(manifest.data.toString('utf8'));
  } catch {
    throw new Error('manifest.json архива — не JSON');
  }
  const voices = (m.contributes?.characters ?? []).map((character) => character.voiceOrigin ?? 'не сказано');
  return { manifest: m, files: entries.length, voices };
}

async function pin(feedArg, id, { noFeed = false, platform = null } = {}) {
  if (!isPackageId(id)) fail(`«${id}» — не id пакета`);
  // Без адреса — лента закрытая, а список закреплённых открыт: id не должен говорить, что в ней.
  if (noFeed && !isRandomPackageId(id)) {
    fail(`«${id}» — говорящий id: пакет закрытой ленты закрепляется только со случайным («p-» и 12 знаков 0–9 a–f) — переименуйте его в той ленте`);
  }
  const url = feedUrl(feedArg);
  const config = readConfig();
  const addresses = readAddresses();
  const pins = Array.isArray(config.recommends) ? config.recommends : [];
  if (config.own) fail('feed.config.json: это своя лента (own) — рекомендовать чужое может только главная');
  const entry = newestOf(await readFeed(url), id);
  if (!entry) fail(`в ${url.href} нет пакета «${id}»`);
  if (entry.hidden) fail(`«${id}» в ${url.href} скрыт (hidden)`);
  if (entry.kind === 'agent') fail(`«${id}» — карточка агента: из чужих лент шлюз их не ставит, рекомендовать нечего`);
  const coded = entry.kind === 'plugin' || entry.kind === 'app';
  // Приложение со сборками: шлюз ставит архив своей платформы — закрепляется он (колонка — linux-aarch64).
  const platforms = coded && entry.platforms ? Object.keys(entry.platforms) : [];
  let archiveOf = entry;
  if (platforms.length) {
    const chosen = platform ?? (platforms.length === 1 ? platforms[0] : null);
    if (!chosen) fail(`«${id}» — приложение со сборками (${platforms.join(', ')}): чей архив закрепить — --platform <платформа>`);
    if (!entry.platforms[chosen]) fail(`у «${id}» нет сборки ${chosen}: есть ${platforms.join(', ')}`);
    archiveOf = entry.platforms[chosen];
    console.log(`  сборка ${chosen}: шлюзы этой платформы поставят её, остальные — нет`);
  } else if (platform) fail(`«${id}» — без сборок под платформы: --platform не нужен`);
  const sha256 = typeof archiveOf.sha256 === 'string' ? archiveOf.sha256.toLowerCase() : '';
  if (!/^[0-9a-f]{64}$/.test(sha256)) fail(`у «${id}» в ленте нет sha256 архива`);
  // Архив — с того же адреса, что лента (так берёт его шлюз), и тот самый, что лента называет.
  const archiveUrl = new URL(archiveOf.url ?? '', url);
  if (archiveUrl.origin !== url.origin) fail(`архив «${id}» — не с адреса ленты (${archiveUrl.href})`);
  const archive = await download(archiveUrl, MAX_ARCHIVE_BYTES);
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== sha256) fail(`архив «${id}» не тот, что называет лента: в ленте ${short(sha256)}, скачан ${short(actual)}`);
  const inside = describe(archive);
  if (inside.manifest.id !== id) fail(`в архиве — пакет «${inside.manifest.id}», а не «${id}»`);
  mkdirSync(PINS_DIR, { recursive: true });
  // Each platform's archive under its own name: pinning one does not overwrite another's copy.
  const saved = join(PINS_DIR, `${id}-${entry.version}${platforms.length ? `-${platform ?? platforms[0]}` : ''}.vgp`);
  writeFileSync(saved, archive);

  // Тот же пакет той же ленты — с адресом или без. Одна сборка: строка заменяется (так же меняют одно на другое).
  // Сборки под платформы: остаются строки архивов других платформ, что есть в ленте сейчас; эта платформа и прежние
  // версии (их архивов в ленте нет) заменяются этой строкой.
  const same = (item) => item?.id === id && (item.feed === undefined || item.feed === url.href);
  const others = new Set(
    platforms.filter((name) => name !== (platform ?? platforms[0])).map((name) => String(entry.platforms[name]?.sha256 ?? '').toLowerCase()),
  );
  const keep = (item) => !same(item) || (platforms.length > 0 && others.has(item.sha256) && item.sha256 !== sha256);
  const line = noFeed ? { id, sha256 } : { feed: url.href, id, sha256 };
  const was = pins.find((item) => same(item) && !keep(item)) ?? null;
  const dropped = pins.filter((item) => !keep(item) && item.sha256 !== sha256);
  const at = pins.findIndex((item) => !keep(item));
  const kept = pins.filter(keep);
  const next = at >= 0 ? [...kept.slice(0, at), line, ...kept.slice(at)] : [...pins, line];
  if (next.length > MAX_RECOMMENDS) fail(`recommends — не больше ${MAX_RECOMMENDS}`);
  writeConfig({ ...config, recommends: next });
  if (noFeed) writeAddresses({ ...addresses, [id]: url.href });
  else if (addresses[id] === url.href) {
    const { [id]: _, ...rest } = addresses;
    writeAddresses(rest);
  }

  const m = inside.manifest;
  console.log(`«${m.title ?? id}» ${entry.version} (${m.kind ?? entry.kind}) из ${url.href}`);
  console.log(`  архив ${short(sha256)}, ${(archive.length / 1024).toFixed(1)} КБ, файлов: ${inside.files}`);
  if (inside.voices.length) console.log(`  голос: ${inside.voices.join(', ')}${inside.voices.includes('unknown') ? ' — происхождение не проверено: послушайте и решите, рекомендовать ли' : ''}`);
  console.log(`  сохранён для просмотра: ${relative(process.cwd(), saved)} (tar -tzf — что внутри)`);
  if (coded) console.log('  это код: шлюзы с `code_allowed` поставят его из чужой ленты — закрепляйте, только прочитав его');
  if (noFeed) console.log(`  в каталоге — без адреса ленты: только id и хеш (шлюз новее 0.11.0); адрес — в ${relative(process.cwd(), ADDRESSES)}`);
  if (!was) console.log('✓ вписан в feed.config.json (recommends)');
  else if (was.sha256 === sha256 && dropped.length === 0) console.log('✓ уже был вписан с этим же архивом');
  else console.log(`✓ хеш обновлён: был ${dropped.map((item) => short(item.sha256)).join(', ') || short(was.sha256)}`);
  if (platforms.length > 1) {
    const pinned = platforms.filter((name) => next.some((item) => same(item) && item.sha256 === String(entry.platforms[name]?.sha256 ?? '').toLowerCase()));
    console.log(`  закреплены сборки: ${pinned.join(', ')}${pinned.length < platforms.length ? ` — ещё нет: ${platforms.filter((name) => !pinned.includes(name)).join(', ')}` : ''}`);
  }
  console.log('Дальше — опубликовать каталог (tools/publish.sh): шлюзы подхватят при следующем чтении ленты.');
}

function remove(feedArg, id) {
  const url = feedUrl(feedArg);
  const config = readConfig();
  const addresses = readAddresses();
  const pins = Array.isArray(config.recommends) ? config.recommends : [];
  // Строка без адреса — одна на id: убирается и тогда, когда её адрес здесь не записан.
  const next = pins.filter((item) => !(item?.id === id && (item.feed === undefined || item.feed === url.href)));
  if (next.length === pins.length) fail(`«${id}» из ${url.href} не закреплён`);
  const updated = { ...config, recommends: next };
  if (next.length === 0) delete updated.recommends;
  writeConfig(updated);
  if (id in addresses) {
    const { [id]: _, ...rest } = addresses;
    writeAddresses(rest);
  }
  console.log(`✓ «${id}» из ${url.href} убран из recommends`);
}

async function list() {
  let pins;
  try {
    pins = feedConfig().recommends;
  } catch (error) {
    fail(error.message);
  }
  if (pins.length === 0) {
    console.log('Закреплённых пакетов чужих лент нет. Закрепить: node tools/pin.mjs <лента> <id>');
    return;
  }
  const addresses = readAddresses();
  let changed = 0;
  for (const item of pins) {
    const feed = feedOf(item, addresses);
    const head = item.feed ? `${item.id} — ${item.feed}` : `${item.id} — без адреса в каталоге${feed ? ` (${feed})` : ''}`;
    if (!feed) {
      console.log(`  ? ${head}: адрес ленты здесь не записан — проверить нечем; закрепите заново: --no-feed <лента> ${item.id}`);
      continue;
    }
    try {
      const entry = newestOf(await readFeed(new URL(feed)), item.id);
      if (!entry) console.log(`  ✗ ${head}: в ленте его больше нет`);
      else if (entry.hidden) console.log(`  ✗ ${head}: скрыт (hidden)`);
      else if ([entry, ...Object.values(entry.platforms ?? {})].some((archive) => String(archive?.sha256 ?? '').toLowerCase() === item.sha256)) {
        console.log(`  ✓ ${head}: ${entry.version}, тот же архив`);
      }
      else {
        changed += 1;
        console.log(`  ! ${head}: архив поменялся (в ленте ${entry.version}, ${short(String(entry.sha256 ?? ''))}) — пометки у шлюзов нет, пока не посмотрите и не закрепите заново${item.feed ? '' : ' (с --no-feed)'}`);
      }
    } catch (error) {
      console.log(`  ? ${head}: ${error.message}`);
    }
  }
  if (changed) console.log(`Поменялось: ${changed}. Закрепить заново — node tools/pin.mjs <лента> <id>.`);
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length === 0) return await list();
    if (args[0] === '-h' || args[0] === '--help') {
      console.log('node tools/pin.mjs | node tools/pin.mjs [--no-feed] <лента> <id> | node tools/pin.mjs --remove <лента> <id>');
      return;
    }
    let platform = null;
    const at = args.indexOf('--platform');
    if (at >= 0) {
      platform = args[at + 1] ?? fail('--platform <платформа>: linux-aarch64, darwin-arm64…');
      args.splice(at, 2);
    }
    if (args[0] === '--no-feed') {
      if (args.length !== 3) fail('node tools/pin.mjs --no-feed <лента> <id>');
      return await pin(args[1], args[2], { noFeed: true, platform });
    }
    if (args[0] === '--remove') {
      if (args.length !== 3) fail('node tools/pin.mjs --remove <лента> <id>');
      return remove(args[1], args[2]);
    }
    if (args.length !== 2) fail('node tools/pin.mjs <лента> <id>');
    await pin(args[0], args[1], { platform });
  } catch (error) {
    fail(error.message);
  }
}

main();
