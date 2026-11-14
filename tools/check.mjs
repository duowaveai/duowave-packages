#!/usr/bin/env node
// Проверка пакетов каталога: всё, что сборка обещает шлюзу, проверяется здесь, до упаковки.
//
//   node tools/check.mjs                  все пакеты из packages/
//   node tools/check.mjs packages/arthur  только эти
//
// Сборка (tools/build.mjs) вызывает ту же проверку и без неё ничего не собирает. Правила — docs/plans/characters.md
// шлюза, разделы 1, 2, 8 и «Контракт API»; где шлюз строже или мягче — сказано рядом.
//
// Пакеты с кодом — плагины и приложения (этап 9 docs/plans/feed.md шлюза): манифест — по правилам шлюза
// (`gateway/src/plugins/manifest.rs`, их же повторяет schemas/app-manifest.schema.json), файлы кода на месте
// (`node.entry`, сборки `targets` с их SHA-256, backend.js плагина), без node_modules/: зависимости приложения на Node
// шлюз ставит сам по package-lock.json (`npm ci --ignore-scripts --omit=dev`) — и каждая из них должна прийти из
// registry.npmjs.org с integrity. Проверка принимает такие пакеты всегда; в ленту они идут только подписанными
// (tools/build.mjs --signed).

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LIMITS = {
  promptChars: 4000, // промт персонажа
  avatarBytes: 256 * 1024, // аватар, WebP или PNG
  sampleBytes: 64 * 1024, // одна фраза-пробник, Opus
  samples: 3, // фраз-пробников у персонажа
  packageBytes: 1024 * 1024, // пакет без кода целиком (распакованный) — меньше 1 МБ
  files: 500, // файлов в архиве (предел установщика шлюза)
  pathBytes: 100, // путь в архиве: поле name заголовка ustar
  manifestBytes: 64 * 1024, // manifest.json (MAX_MANIFEST реестра шлюза)
  titleChars: 80,
  descriptionChars: 500,
  licenseChars: 200,
  lineChars: 300, // строка регулятора тона
  sampleTextChars: 200,
};

/** Пределы пакета с кодом: установщик и манифест шлюза (install.rs, manifest.rs), «Лимиты» docs/plugins/AUTHORING.md. */
export const CODE_LIMITS = {
  unpackedBytes: 32 * 1024 * 1024, // MAX_UNPACKED: распакованный архив; у приложения со сборками — архив одной платформы
  backendJsBytes: 1024 * 1024,
  backendWasmBytes: 4 * 1024 * 1024,
  memoryMb: 64, // MAX_MEMORY_MB
  nodeMemoryMb: 1024, // MAX_NODE_MEMORY_MB: сам Node держит 40–60 МБ
  storageMb: 64,
  filesMb: 4096,
  tasks: 4, // tasks::MAX_AT_ONCE
  settings: 30,
  tools: 20,
  phrases: 50,
  phraseChars: 160,
  slots: 4,
  rhythms: 10,
  rhythmTitleChars: 40,
};
/** Бюджет, когда манифест его не называет (manifest.rs, bus/providers/files.rs APP_FOLDER_MB, tasks DEFAULT_AT_ONCE). */
export const BUDGET_DEFAULTS = { memoryMb: 4, storageMb: 1, filesMb: 64, tasks: 1 };

/** Виды пакетов шлюза (`gateway/src/plugins/manifest.rs`). */
export const KINDS = ['plugin', 'app', 'character', 'theme'];
/** Виды с кодом: шлюз ставит их из каталога только из подписанной ленты (`entry_state` в catalog.rs). */
export const CODE_KINDS = ['plugin', 'app'];
/** Что каталог принимает: все виды; код — только в подписанную ленту (tools/build.mjs --signed). */
export const CATALOG_KINDS = KINDS;
/** Размещения шлюза (`gateway/src/core/availability.rs`, `Placement::as_str`). */
export const PLACEMENTS = ['pc', 'station', 'stationServer'];
/** Host API шлюза (`HOST_API` в manifest.rs): `api` плагина и приложения — требование к нему. */
export const HOST_API = [2, 0, 0];
/**
 * Персонаж и тема — данные: шлюз с Host API 2 читает любую их версию, а шлюзы постарше сверяли `api` и с данными —
 * поэтому пакет без кода по-прежнему подходит к Host API 1.
 */
export const DATA_HOST_API = [1, 0, 0];
/**
 * С какой версии шлюза ставится пакет с кодом, если манифест не скажет сам, — и ниже чего его `minGateway` в ленте не
 * опустится: Host API 2 (права — связи шины) вошёл в шлюз 0.7.0; `runtime: node` — в 0.9.0 (выпуски 0.7.x и 0.8.x
 * вышли без него).
 */
export function codeMinGateway(manifest) {
  // Приложения на Node шлюз запускает с 0.9.0 (в 0.7–0.8 их ещё не было): ниже лента их не покажет.
  return manifest?.kind === 'app' && runtimeOf(manifest) === 'node' ? '0.9.0' : '0.7.0';
}
/** Платформы сборок `targets`, которые называет шлюз (`manifest::platform()`, сборки Node в src/apps/node.rs). */
export const PLATFORMS = ['darwin-arm64', 'darwin-x86_64', 'linux-aarch64', 'linux-x86_64'];
/** Модели голоса, под которые пакет может нести снимки; неизвестные шлюз пропускает. */
export const ENGINES = {
  omnivoice: { title: 'OmniVoice', diskMb: 4000 },
  cosyvoice3: { title: 'CosyVoice 3', diskMb: 10000 },
};
/** Встроенные голоса шлюза (`gateway/src/models/showcase.json`), годные в запасной, и их пол. */
export const FALLBACK_VOICES = {
  'piper-denis': 'male',
  'piper-dmitri': 'male',
  'piper-ruslan': 'male',
  'piper-irina': 'female',
};
export const GENDERS = ['male', 'female', 'any'];
export const VOICE_ORIGINS = ['synthetic', 'consent'];

/**
 * Настройки ленты — feed.config.json в корне (нет файла — всё по умолчанию):
 * - `own` — лента для своих источников шлюза (их добавляют по ссылке, docs/plans/custom-feeds.md шлюза): голос
 *   неизвестного происхождения (`voiceOrigin: unknown`) можно, отметки `verified` нет. В нашем каталоге и магазине — нет.
 * - `hidden` — id пакетов, которые шлюз скрывает (шлюз 0.6.0 и новее): в каталоге их нет, а поставленные из этой ленты
 *   пропадают с экрана у всех. В catalog.json такой пакет — только `{ "id", "hidden": true }`.
 */
export function feedConfig() {
  const file = join(ROOT, 'feed.config.json');
  if (!existsSync(file)) return { own: false, hidden: [] };
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`feed.config.json: не JSON — ${error.message}`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('feed.config.json: нужен объект');
  const own = value.own ?? false;
  if (typeof own !== 'boolean') throw new Error('feed.config.json: own — true или false');
  const hidden = value.hidden ?? [];
  if (!Array.isArray(hidden) || hidden.some((id) => !isPackageId(id))) {
    throw new Error('feed.config.json: hidden — список id пакетов');
  }
  return { own, hidden: [...new Set(hidden)] };
}

/** Чей голос может быть у персонажа этой ленты: у своей ленты — и неизвестно чей (`unknown`). */
export function voiceOrigins() {
  return feedConfig().own ? [...VOICE_ORIGINS, 'unknown'] : VOICE_ORIGINS;
}

/** Что может лежать в assets/: картинки, звук, снимки голоса. SVG — нет (скрипт в пульте). */
const ASSET_EXTENSIONS = new Set(['.webp', '.png', '.opus', '.wav', '.pt']);
/** Файлы кода: бывают только у приложений и плагинов. */
const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.wasm']);
/** Картинки пакета с кодом: внутри не должно оказаться SVG под чужим расширением. */
const IMAGE_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif']);
/** Мусор файловых менеджеров: не ошибка, но и в архив не идёт. */
export const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

/** Чужие названия, которых нет ни в промтах, ни в описаниях: имя слова-активации шлюз добавляет сам. */
const FOREIGN_NAMES = [
  { re: /(?<!\p{L})алис/iu, name: '«Алиса»' },
  { re: /(?<!\p{L})яндекс/iu, name: '«Яндекс»' },
  { re: /\b(alice|alisa)\b/i, name: '«Alice»' },
  { re: /\byandex\b/i, name: '«Yandex»' },
];

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const isSemver = (text) => typeof text === 'string' && SEMVER.test(text);

/** id пакета, как его понимает шлюз: строчные латинские, цифры и «-», с буквы, до 32 знаков. */
export const isPackageId = (id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(id) && !id.endsWith('-');

/** id персонажа: он же часть папки голоса `c-<пакет>-<персонаж>-<модель>` — только [a-z0-9-]. */
const isCharacterId = (id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(id) && !id.endsWith('-');

const chars = (text) => [...text].length;

/** «1 файл», «2 файла», «5 файлов». */
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Сравнение версий без пререлизов: -1, 0, 1. */
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/**
 * Подходит ли версия под требование вида `^1`, `~1.2`, `>=1.0.0`, `1.2.3`, `*` (через запятую — все сразу), как у
 * crate semver в шлюзе: без оператора — то же, что `^`.
 */
export function requirementMatches(requirement, version) {
  if (typeof requirement !== 'string' || !requirement.trim()) return null;
  const parts = requirement.split(',').map((part) => part.trim());
  let all = true;
  for (const part of parts) {
    if (part === '*') continue;
    const m = /^(\^|~|>=|<=|>|<|=)?\s*(\d+)(?:\.(\d+|\*))?(?:\.(\d+|\*))?$/.exec(part);
    if (!m) return null;
    const op = m[1] || '^';
    const major = Number(m[2]);
    const minor = m[3] === undefined || m[3] === '*' ? null : Number(m[3]);
    const patch = m[4] === undefined || m[4] === '*' ? null : Number(m[4]);
    const low = [major, minor ?? 0, patch ?? 0];
    let ok;
    switch (op) {
      case '^': {
        let high;
        if (major > 0 || minor === null) high = [major + 1, 0, 0];
        else if (minor > 0 || patch === null) high = [0, minor + 1, 0];
        else high = [0, 0, patch + 1];
        ok = compare(version, low) >= 0 && compare(version, high) < 0;
        break;
      }
      case '~': {
        const high = minor === null ? [major + 1, 0, 0] : [major, minor + 1, 0];
        ok = compare(version, low) >= 0 && compare(version, high) < 0;
        break;
      }
      case '=': {
        const high = minor === null ? [major + 1, 0, 0] : patch === null ? [major, minor + 1, 0] : [major, minor, patch + 1];
        ok = compare(version, low) >= 0 && compare(version, high) < 0;
        break;
      }
      case '>=':
        ok = compare(version, low) >= 0;
        break;
      case '>':
        ok = compare(version, low) > 0;
        break;
      case '<=':
        ok = compare(version, low) <= 0;
        break;
      case '<':
        ok = compare(version, low) < 0;
        break;
    }
    all = all && ok;
  }
  return all;
}

/** Путь файла внутри assets/: относительный, прямыми слешами, без `..`, `.` и пустых частей. */
export function assetPath(path) {
  if (typeof path !== 'string' || !path) return null;
  if (path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return null;
  const segments = path.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
  return `assets/${path}`;
}

// ---- что внутри файлов ----

const startsWith = (buf, text, at = 0) => buf.length >= at + text.length && buf.toString('latin1', at, at + text.length) === text;

/** WebP или PNG и их размер в точках; иначе null. */
export function imageInfo(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && startsWith(buf, 'IHDR', 12)) {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (startsWith(buf, 'RIFF') && startsWith(buf, 'WEBP', 8) && buf.length >= 30) {
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return { type: 'webp', width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    if (chunk === 'VP8L' && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    return { type: 'webp', width: 0, height: 0 };
  }
  return null;
}

const isOpus = (buf) => startsWith(buf, 'OggS') && buf.subarray(0, 128).includes(Buffer.from('OpusHead'));
const isWav = (buf) => startsWith(buf, 'RIFF') && startsWith(buf, 'WAVE', 8);
/** torch.save пишет zip: шлюз читает снимок с weights_only=True — он не выполнит код. */
const isZip = (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x504b0304;
const looksLikeSvg = (buf) => /<svg[\s>]/i.test(buf.subarray(0, 4096).toString('latin1'));

// ---- обход папки пакета ----

function walk(dir, base, out, problems) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = lstatSync(abs);
    if (IGNORED_FILES.has(name)) continue;
    if (stat.isSymbolicLink()) {
      problems.push(`${rel}: ссылка — в пакете только обычные файлы`);
    } else if (stat.isDirectory()) {
      if (name.startsWith('.')) problems.push(`${rel}: скрытая папка`);
      else if (name === 'node_modules') {
        // Внутрь не идём: тысячи файлов, ссылки .bin — одна ошибка вместо них.
        problems.push(
          `${rel}/: зависимости в пакет не кладут — шлюз ставит их сам по package-lock.json (npm ci --ignore-scripts --omit=dev)`,
        );
      } else walk(abs, rel, out, problems);
    } else if (stat.isFile()) {
      if (name.startsWith('.')) problems.push(`${rel}: скрытый файл`);
      else out.push({ path: rel, abs, size: stat.size });
    } else {
      problems.push(`${rel}: не обычный файл`);
    }
  }
}

/**
 * Проверяет папку пакета. Возвращает манифест, файлы для архива (manifest.json первым, дальше по алфавиту), ошибки и
 * предупреждения. Ошибка — пакет в каталог не идёт; предупреждение — идёт, но стоит посмотреть.
 */
export function checkPackage(dir) {
  const errors = [];
  const warnings = [];
  const folder = basename(dir);
  const result = { dir, folder, manifest: null, kind: null, code: false, files: [], bytes: 0, errors, warnings };

  const files = [];
  walk(dir, '', files, errors);
  files.sort((a, b) => (a.path === 'manifest.json' ? -1 : b.path === 'manifest.json' ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  result.files = files;
  result.bytes = files.reduce((sum, file) => sum + file.size, 0);

  // Манифест читается до правил файлов: что может лежать в пакете, решает его вид. Не прочёлся — только общие правила.
  const manifestFile = files.find((file) => file.path === 'manifest.json');
  let manifest = null;
  let manifestProblem = null;
  if (!manifestFile) manifestProblem = 'нет manifest.json';
  else if (manifestFile.size > LIMITS.manifestBytes) manifestProblem = `manifest.json больше ${LIMITS.manifestBytes / 1024} КБ`;
  else {
    try {
      manifest = JSON.parse(readFileSync(manifestFile.abs, 'utf8'));
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        manifest = null;
        manifestProblem = 'manifest.json должен быть объектом';
      }
    } catch (error) {
      manifestProblem = `manifest.json не читается как JSON: ${error.message}`;
    }
  }
  const kind = manifest ? (manifest.kind ?? 'plugin') : null;
  const code = CODE_KINDS.includes(kind);
  result.kind = kind;
  result.code = code;

  for (const file of files) {
    if (Buffer.byteLength(file.path) > LIMITS.pathBytes) errors.push(`${file.path}: путь длиннее ${LIMITS.pathBytes} байт`);
    const ext = extname(file.path).toLowerCase();
    if (code || !manifest) {
      // Код: файлы любые, кроме SVG — его шлюз не распакует (браузер выполнил бы его на адресе пульта).
      if (ext === '.svg' || ext === '.svgz') errors.push(`${file.path}: SVG в пакете нельзя — переведите в WebP или PNG`);
      else if (IMAGE_EXTENSIONS.has(ext) && looksLikeSvg(readFileSync(file.abs))) errors.push(`${file.path}: внутри SVG`);
      continue;
    }
    if (file.path !== 'manifest.json' && !file.path.startsWith('assets/')) {
      errors.push(
        CODE_EXTENSIONS.has(ext)
          ? `${file.path}: код бывает только у приложений и плагинов — в пакете без кода только manifest.json и assets/`
          : `${file.path}: в пакете без кода только manifest.json и assets/`,
      );
    }
    if (file.path.startsWith('assets/')) {
      if (ext === '.svg' || ext === '.svgz') errors.push(`${file.path}: SVG в пакете нельзя — переведите в WebP или PNG`);
      else if (!ASSET_EXTENSIONS.has(ext)) errors.push(`${file.path}: такой файл в assets/ не нужен (есть .webp .png .opus .wav .pt)`);
      else if (looksLikeSvg(readFileSync(file.abs))) errors.push(`${file.path}: внутри SVG`);
    }
  }
  if (manifest && !code && result.bytes >= LIMITS.packageBytes) {
    errors.push(`пакет весит ${(result.bytes / 1024).toFixed(0)} КБ — должен быть меньше ${LIMITS.packageBytes / 1024} КБ`);
  }
  if (files.length > LIMITS.files) errors.push(`файлов ${files.length} — не больше ${LIMITS.files}`);

  if (manifestProblem) {
    errors.push(manifestProblem);
    return result;
  }
  result.manifest = manifest;

  const assets = new Set(files.filter((f) => f.path.startsWith('assets/')).map((f) => f.path));
  const used = new Set();
  const fileOf = (path) => files.find((f) => f.path === path);
  const readAsset = (path) => readFileSync(fileOf(path).abs);
  /** Файл из assets/, на который ссылается манифест: путь, существование; вернёт путь в пакете или null. */
  const asset = (value, at) => {
    const path = assetPath(value);
    if (!path) {
      errors.push(`${at}: путь внутри assets/ — относительный, без «..» (сейчас ${JSON.stringify(value)})`);
      return null;
    }
    if (!assets.has(path)) {
      errors.push(`${at}: нет файла ${path}`);
      return null;
    }
    used.add(path);
    return path;
  };
  const foreign = (text, at) => {
    if (typeof text !== 'string') return;
    for (const { re, name } of FOREIGN_NAMES) if (re.test(text)) errors.push(`${at}: ${name} — чужих названий в пакете нет, имя слова-активации шлюз добавит сам`);
  };
  const text = (value, at, max, required = true) => {
    if (typeof value !== 'string' || !value.trim()) {
      if (required) errors.push(`${at}: нужна непустая строка`);
      return false;
    }
    if (chars(value) > max) errors.push(`${at}: длиннее ${max} знаков (${chars(value)})`);
    return true;
  };

  // ---- общее для всех видов ----
  if (manifest.schema !== 1) errors.push('schema: нужно 1');
  if (!KINDS.includes(kind)) errors.push(`kind «${kind}»: такого вида нет; есть ${KINDS.join(', ')}`);
  else if (!CATALOG_KINDS.includes(kind)) errors.push(`kind «${kind}»: такие пакеты каталог не принимает — есть ${CATALOG_KINDS.join(', ')}`);
  if (!isPackageId(manifest.id)) errors.push('id: строчные латинские буквы, цифры и «-», с буквы, до 32 знаков');
  else if (manifest.id !== folder) errors.push(`id «${manifest.id}» не совпадает с папкой packages/${folder}`);
  if (!isSemver(manifest.version)) errors.push('version: номер версии вида 1.2.0 (semver)');
  if (code) {
    // Код работает с Host API шлюза: приложение под Host API 1 шлюз не включит (manifest.rs).
    const apiOk = requirementMatches(manifest.api, HOST_API);
    const api = typeof manifest.api === 'string' ? manifest.api.trim() : manifest.api;
    if (apiOk === null) errors.push('api: требование к Host API, например «^2»');
    else if (!apiOk && /^(\^1|1|>=1)/.test(api)) {
      errors.push(`api «${api}»: это приложение для Host API 1, а у шлюза ${HOST_API.join('.')} — переделайте его («api»: «^2», права — связи шины)`);
    } else if (!apiOk) errors.push(`api «${api}»: нужен Host API ${api}, а у шлюза ${HOST_API.join('.')}`);
  } else {
    const apiOk = requirementMatches(manifest.api, DATA_HOST_API);
    if (apiOk === null) errors.push('api: требование к Host API, например «^1»');
    else if (!apiOk) errors.push(`api «${manifest.api}» не подходит к Host API шлюза ${DATA_HOST_API.join('.')}`);
  }
  text(manifest.title, 'title', LIMITS.titleChars);
  text(manifest.description, 'description', LIMITS.descriptionChars);
  foreign(manifest.title, 'title');
  foreign(manifest.description, 'description');
  if (!Array.isArray(manifest.runs) || manifest.runs.length === 0) {
    errors.push(`runs: список размещений (${PLACEMENTS.join(', ')})`);
  } else {
    for (const run of manifest.runs) if (!PLACEMENTS.includes(run)) errors.push(`runs: «${run}» — нет такого размещения; есть ${PLACEMENTS.join(', ')}`);
    if (new Set(manifest.runs).size !== manifest.runs.length) errors.push('runs: повторы');
  }
  text(manifest.license, 'license', LIMITS.licenseChars);
  if (manifest.minGateway !== undefined && !isSemver(manifest.minGateway)) errors.push('minGateway: версия шлюза вида 0.2.0');
  const contributes = manifest.contributes;
  if (contributes !== undefined && (typeof contributes !== 'object' || contributes === null || Array.isArray(contributes))) {
    errors.push('contributes: объект');
  }

  // ---- плагин и приложение: код ----
  if (code) {
    if (isSemver(manifest.minGateway) && compareSemver(manifest.minGateway, codeMinGateway(manifest)) < 0) {
      warnings.push(`minGateway ${manifest.minGateway}: такой код шлюзы раньше ${codeMinGateway(manifest)} не запустят — в ленте будет ${codeMinGateway(manifest)}`);
    }
    checkCode(manifest, kind, files, result, foreign);
    return result;
  }

  for (const key of ['runtime', 'permissions', 'budget', 'settings']) {
    if (manifest[key] !== undefined && !(Array.isArray(manifest[key]) && manifest[key].length === 0)) {
      errors.push(`${key}: у пакета вида ${kind} нет кода — это поле плагина`);
    }
  }
  for (const key of ['intents', 'tools', 'media', 'events', 'schedules']) {
    if (contributes?.[key] !== undefined) errors.push(`contributes.${key}: у пакета вида ${kind} нет кода, это дело плагина`);
  }

  // ---- персонаж ----
  if (kind === 'character') {
    const characters = contributes?.characters;
    if (!Array.isArray(characters) || characters.length === 0) {
      errors.push('contributes.characters: список персонажей, хотя бы один');
    } else {
      const ids = new Set();
      characters.forEach((character, index) => {
        const at = `characters[${index}]`;
        if (!character || typeof character !== 'object' || Array.isArray(character)) {
          errors.push(`${at}: объект`);
          return;
        }
        const c = character;
        const name = isCharacterId(c.id) ? c.id : null;
        const where = name ? `персонаж ${manifest.id}:${name}` : at;
        if (!name) errors.push(`${at}.id: строчные латинские буквы, цифры и «-», с буквы, до 32 знаков`);
        else if (ids.has(name)) errors.push(`${where}: id повторяется`);
        if (name) ids.add(name);

        if (!GENDERS.includes(c.gender)) errors.push(`${where}.gender: ${GENDERS.join(' | ')}`);
        if (typeof c.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(c.color)) errors.push(`${where}.color: цвет вида #7A8CA5`);

        const avatar = asset(c.avatar, `${where}.avatar`);
        if (avatar) {
          const buf = readAsset(avatar);
          const info = imageInfo(buf);
          if (!info) errors.push(`${where}.avatar: только WebP или PNG`);
          else {
            if (buf.length > LIMITS.avatarBytes) errors.push(`${where}.avatar: ${(buf.length / 1024).toFixed(0)} КБ — не больше ${LIMITS.avatarBytes / 1024} КБ`);
            if (info.width !== info.height) errors.push(`${where}.avatar: картинка квадратная (сейчас ${info.width}×${info.height})`);
            else if (info.width < 128 || info.width > 1024) errors.push(`${where}.avatar: от 128 до 1024 точек (сейчас ${info.width})`);
            else if (info.width !== 512) warnings.push(`${where}.avatar: лучше 512×512 (сейчас ${info.width})`);
          }
        }

        if (text(c.prompt, `${where}.prompt`, LIMITS.promptChars)) foreign(c.prompt, `${where}.prompt`);

        if (!Array.isArray(c.tones)) errors.push(`${where}.tones: список регуляторов (может быть пустым)`);
        else {
          const toneIds = new Set();
          c.tones.forEach((tone, t) => {
            const tat = `${where}.tones[${t}]`;
            if (!tone || typeof tone !== 'object') return errors.push(`${tat}: объект`);
            if (typeof tone.id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(tone.id)) errors.push(`${tat}.id: строчные латинские буквы, цифры и «-»`);
            else if (toneIds.has(tone.id)) errors.push(`${tat}.id: «${tone.id}» повторяется`);
            else toneIds.add(tone.id);
            if (text(tone.title, `${tat}.title`, 40)) foreign(tone.title, `${tat}.title`);
            if (!Array.isArray(tone.options) || tone.options.length < 2 || tone.options.length > 5) {
              errors.push(`${tat}.options: от 2 до 5 положений`);
            } else {
              tone.options.forEach((option, o) => {
                const oat = `${tat}.options[${o}]`;
                if (!option || typeof option !== 'object') return errors.push(`${oat}: объект`);
                if (text(option.label, `${oat}.label`, 30)) foreign(option.label, `${oat}.label`);
                if (text(option.line, `${oat}.line`, LIMITS.lineChars)) {
                  foreign(option.line, `${oat}.line`);
                  if (/\n/.test(option.line)) errors.push(`${oat}.line: одна строка`);
                }
              });
              if (!Number.isInteger(tone.default) || tone.default < 0 || tone.default >= tone.options.length) {
                errors.push(`${tat}.default: номер положения от 0 до ${tone.options.length - 1}`);
              }
            }
          });
        }

        if (!Array.isArray(c.samples)) errors.push(`${where}.samples: список фраз-пробников (может быть пустым)`);
        else {
          if (c.samples.length > LIMITS.samples) errors.push(`${where}.samples: не больше ${LIMITS.samples}`);
          c.samples.forEach((sample, s) => {
            const sat = `${where}.samples[${s}]`;
            if (!sample || typeof sample !== 'object') return errors.push(`${sat}: объект`);
            if (text(sample.text, `${sat}.text`, LIMITS.sampleTextChars)) foreign(sample.text, `${sat}.text`);
            const path = asset(sample.file, `${sat}.file`);
            if (path) {
              const buf = readAsset(path);
              if (!isOpus(buf)) errors.push(`${sat}.file: только Opus (Ogg)`);
              if (buf.length > LIMITS.sampleBytes) errors.push(`${sat}.file: ${(buf.length / 1024).toFixed(0)} КБ — не больше ${LIMITS.sampleBytes / 1024} КБ`);
            }
          });
        }

        if (typeof c.fallbackVoice !== 'string' || !c.fallbackVoice.trim()) {
          errors.push(`${where}.fallbackVoice: id встроенного голоса шлюза (${Object.keys(FALLBACK_VOICES).join(', ')})`);
        } else if (!(c.fallbackVoice in FALLBACK_VOICES)) {
          warnings.push(`${where}.fallbackVoice «${c.fallbackVoice}»: такого встроенного голоса не знаю — шлюз возьмёт похожий по gender`);
        } else if ((c.gender === 'male' || c.gender === 'female') && FALLBACK_VOICES[c.fallbackVoice] !== c.gender) {
          warnings.push(`${where}.fallbackVoice «${c.fallbackVoice}»: голос другого пола, чем gender`);
        }

        const voices = c.voices;
        if (!voices || typeof voices !== 'object' || Array.isArray(voices)) errors.push(`${where}.voices: объект по id модели (может быть пустым)`);
        else {
          for (const [engine, voice] of Object.entries(voices)) {
            const vat = `${where}.voices.${engine}`;
            if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(engine)) errors.push(`${vat}: id модели — [a-z0-9-]`);
            else if (!(engine in ENGINES)) warnings.push(`${vat}: модель не знаю — шлюзы, которые тоже не знают, её пропустят`);
            if (!voice || typeof voice !== 'object') {
              errors.push(`${vat}: объект {file, model}`);
              continue;
            }
            text(voice.model, `${vat}.model`, 64);
            const path = asset(voice.file, `${vat}.file`);
            if (path) {
              if (extname(path) !== '.pt') errors.push(`${vat}.file: снимок — файл .pt`);
              else if (!isZip(readAsset(path))) errors.push(`${vat}.file: не zip torch.save — шлюз читает снимки только с weights_only=True`);
            }
          }
        }

        if (c.ref !== undefined) {
          if (!c.ref || typeof c.ref !== 'object') errors.push(`${where}.ref: объект {file, text}`);
          else {
            const path = asset(c.ref.file, `${where}.ref.file`);
            if (path && !isWav(readAsset(path))) errors.push(`${where}.ref.file: только WAV`);
            if (text(c.ref.text, `${where}.ref.text`, 500)) foreign(c.ref.text, `${where}.ref.text`);
          }
        } else if (voices && Object.keys(voices).length > 0) {
          warnings.push(`${where}: снимки есть, а ref нет — под новую ревизию модели шлюз голос не переснимет`);
        }

        if (!voiceOrigins().includes(c.voiceOrigin)) {
          errors.push(
            feedConfig().own
              ? `${where}.voiceOrigin: synthetic, consent или unknown (происхождение не проверено — только в своей ленте)`
              : `${where}.voiceOrigin: synthetic (голос по описанию) или consent (диктор с письменным согласием) — другого каталог не принимает`,
          );
        }
      });
    }
  }

  // ---- тема: формат вклада ещё не описан, проверяем только, что он есть ----
  if (kind === 'theme' && (!Array.isArray(contributes?.themes) || contributes.themes.length === 0)) {
    errors.push('contributes.themes: список тем, хотя бы одна');
  }

  for (const path of assets) if (!used.has(path)) warnings.push(`${path}: манифест на него не ссылается — лишний вес в архиве`);
  return result;
}

// ---- код: правила манифеста шлюза (gateway/src/plugins/manifest.rs) ----

/** События, которые шлюз отдаёт плагинам (`PLUGIN_EVENTS`). */
const PLUGIN_EVENTS = [
  'station.connected',
  'station.disconnected',
  'mode.changed',
  'homeServer.up',
  'homeServer.down',
  'player.started',
  'player.stopped',
  'player.failed',
  'player.silent',
];
/** Возможности шлюза (`skills/capabilities.rs`); управление колонкой (`STATION_CONTROLS`) — только встроенным навыкам. */
const CAPABILITIES = [
  'chat', 'volume', 'playback', 'radio', 'music', 'tales', 'games', 'skills', 'timers', 'alarms', 'reminders', 'later',
  'weather', 'news', 'morning_show', 'smart_home', 'bluetooth', 'led', 'do_not_disturb', 'calls', 'music_recognition',
  'account', 'plugins', 'memory',
];
const STATION_CONTROLS = ['volume', 'playback', 'bluetooth', 'timers', 'alarms', 'do_not_disturb', 'calls'];
/** Имена встроенных инструментов «Мозга» (`skills/tools.rs`): плагину их не взять, как и `mcp_…`. */
const BUILT_IN_TOOLS = [
  'set_volume', 'control_playback', 'bluetooth', 'set_timer', 'manage_timer', 'set_alarm', 'manage_alarm',
  'do_not_disturb', 'play_music', 'start_game', 'set_reminder', 'get_weather', 'get_news', 'smart_home', 'phone_call',
  'send_voice_message', 'yandex_skill', 'yandex_account', 'play_radio', 'tell_tale', 'recognize_music', 'morning_show',
];
const MEDIA_KINDS = ['radio', 'music', 'tales'];
/** Опасности умений (`bus/danger.rs`). */
const DANGERS = ['money', 'delete', 'outside', 'locks', 'camera', 'access'];
/** Ступени связи на шине (`bus/level.rs`): каждая держит те, что ниже. */
const LEVELS = ['see', 'listen', 'call', 'edit'];
/** Чем стало право Host API 1 (`right_now`). */
const RIGHT_NOW = {
  'voice.intents': 'не нужно — хватает contributes',
  'llm.tools': 'не нужно — хватает contributes',
  'media.source': 'не нужно — хватает contributes',
  events: 'не нужно — хватает contributes',
  kv: 'не нужно — своё хранилище и своя папка без права',
  files: 'не нужно — своё хранилище и своя папка без права',
  'voice.say': 'call:system/voice',
  'llm.chat': 'call:system/brain',
  'tools.call': 'call:app/<id> или call:app/*',
  smart_home: 'call:system/smart-home',
  'content:music': 'call:system/content',
  'content:tales': 'call:system/content',
  notify: 'call:system/notify',
  schedule: 'call:system/schedule',
  midi: 'listen:device/midi',
  'lan.mdns': 'не нужно — своя программа',
};
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Значение в сообщении: строка — как есть, остальное — JSON (как `string_of` шлюза). */
const shown = (value) => (typeof value === 'string' ? value : JSON.stringify(value));
/** Строка без пробелов по краям или null — как `text()` манифеста шлюза. */
const trimmed = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Движок пакета, как его понимает шлюз: нет или пустой — `js`. */
export function runtimeOf(manifest) {
  return trimmed(manifest?.runtime) ?? 'js';
}

/** Сравнение версий semver без пререлизов: -1, 0, 1. */
export function compareSemver(a, b) {
  const parts = (text) => text.split(/[-+]/)[0].split('.').map(Number);
  return compare(parts(a), parts(b));
}

/** Имя функции: латинские буквы, цифры, `_` и `$`, не с цифры, до 64 знаков (`identifier`). */
const isIdentifier = (name) => typeof name === 'string' && name.length <= 64 && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
/** Имя новости: строчные латинские, цифры, `.`, `-`, `_`, с буквы, до 64 знаков (`news_name`). */
const isNewsName = (name) => typeof name === 'string' && name.length <= 64 && /^[a-z][a-z0-9._-]*$/.test(name);
/** Имя инструмента для модели: строчные латинские, цифры и `_`, с буквы, до 48 знаков (`tool_name`). */
const isToolName = (name) => typeof name === 'string' && name.length <= 48 && /^[a-z][a-z0-9_]*$/.test(name);

/** Путь в пакете (`package_path`): части непустые, не с точки, каждая до 80 байт. */
const isPackagePath = (path) =>
  typeof path === 'string' && path !== '' && path.split('/').every((part) => part !== '' && !part.startsWith('.') && Buffer.byteLength(part) <= 80);

/** Хост в правах `net:` (`host_pattern`): строчные латинские, цифры и «-», хотя бы две части; можно `*.` спереди. */
function isHostPattern(host) {
  const name = host.startsWith('*.') ? host.slice(2) : host;
  const labels = name.split('.');
  return (
    name !== '' &&
    name.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => label !== '' && label.length <= 63 && !label.startsWith('-') && !label.endsWith('-') && /^[a-z0-9-]+$/.test(label))
  );
}

/** Адрес на шине (`bus/address.rs`): вид — строчные латинские, цифры и «-», с буквы; дальше части пути. */
function isBusAddress(text) {
  text = text.trim();
  if (!text || Buffer.byteLength(text) > 512) return false;
  const [kind, ...segments] = text.split('/');
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(kind)) return false;
  return segments.every(
    (segment) =>
      segment !== '' &&
      segment !== '.' &&
      segment !== '..' &&
      segment.trim() === segment &&
      [...segment].length <= 128 &&
      ![...segment].some((c) => /\p{Cc}/u.test(c) || c === '/' || c === '*' || c === '\\'),
  );
}

/** Узор адресов: `*`, адрес или адрес с `/*` (он и всё под ним); null — не узор. */
function busPattern(text) {
  text = text.trim();
  if (text === '*') return text;
  const base = text.endsWith('/*') ? text.slice(0, -2) : text;
  return isBusAddress(base) ? text : null;
}

/** Подходит ли адрес под узор (`Pattern::matches`). */
function patternMatches(pattern, address) {
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return address === base || address.startsWith(`${base}/`);
  }
  return pattern === address;
}

/** Покрывает ли узор весь другой узор (`Pattern::covers`). */
function patternCovers(pattern, other) {
  if (pattern === '*' || pattern === other) return true;
  if (!pattern.endsWith('/*') || other === '*') return false;
  const base = pattern.slice(0, -2);
  const theirs = other.endsWith('/*') ? other.slice(0, -2) : other;
  return theirs === base || theirs.startsWith(`${base}/`);
}

/** Право манифеста (`Permission::parse`): `{net}` или `{level, pattern}`; null — такого права нет. */
function parsePermission(text) {
  for (const level of LEVELS) {
    if (text.startsWith(`${level}:`)) {
      const pattern = busPattern(text.slice(level.length + 1));
      return pattern ? { level, pattern } : null;
    }
  }
  if (!text.startsWith('net:')) return null;
  const host = text.slice(4);
  return isHostPattern(host) ? { net: host } : null;
}

/** Достают ли права до адреса хотя бы на этой ступени (`asks`). */
const asks = (permissions, address, level) =>
  permissions.some((p) => p.level && LEVELS.indexOf(p.level) >= LEVELS.indexOf(level) && patternMatches(p.pattern, address));

/** Фраза намерения, нормализованная, как у шлюза: строчные, ё → е, без знаков. */
const normalizeWords = (text) => text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Что не так с фразой (`Phrase::parse`), или null. */
function phraseProblem(template) {
  if (chars(template) > CODE_LIMITS.phraseChars) return `фраза «${template}» длиннее ${CODE_LIMITS.phraseChars} знаков`;
  const parts = [];
  let rest = template;
  for (let open = rest.indexOf('{'); open !== -1; open = rest.indexOf('{')) {
    const words = normalizeWords(rest.slice(0, open));
    if (words) parts.push({ words });
    const after = rest.slice(open + 1);
    const close = after.indexOf('}');
    if (close === -1) return `фраза «${template}»: нет закрывающей «}»`;
    const name = after.slice(0, close).trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)) return `фраза «${template}»: «{${name}}» — имя из латинских букв, цифр и _`;
    if (name === 'request') return `фраза «${template}»: имя «request» занято: под ним функция получает сам запрос`;
    if (parts.at(-1)?.slot) return `фраза «${template}»: два места подряд, между ними нужно слово`;
    parts.push({ slot: name });
    rest = after.slice(close + 1);
  }
  if (rest.includes('}')) return `фраза «${template}»: лишняя «}»`;
  const words = normalizeWords(rest);
  if (words) parts.push({ words });
  if (!parts[0]?.words) return `фраза «${template}» должна начинаться со слова`;
  const slots = parts.filter((part) => part.slot).map((part) => part.slot);
  if (slots.length > CODE_LIMITS.slots) return `фраза «${template}»: больше ${CODE_LIMITS.slots} мест`;
  if (new Set(slots).size !== slots.length) return `фраза «${template}»: одно имя места дважды`;
  return null;
}

/** «ЧЧ:ММ» → [часы, минуты] или null (`clock` расписаний). */
function clock(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [hours, minutes] = [Number(m[1]), Number(m[2])];
  return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}

/** `5m`, `2h`, `1d` → минуты или null. */
function minutesOf(text) {
  const m = /^(\d+)([mhd])$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * { m: 1, h: 60, d: 1440 }[m[2]];
}

/** Подходит ли значение настройке (`SettingSpec::accepts`). */
function settingAccepts(type, options, value) {
  if (type === 'string') return typeof value === 'string' && chars(value) <= 1000 && (!options || options.includes(value));
  if (type === 'number') return typeof value === 'number';
  return typeof value === 'boolean';
}

/** `settings` манифеста (`settings()`): вернёт список `{key, type}` годных настроек. */
function checkSettings(value, errors) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push('settings: список настроек');
    return [];
  }
  if (value.length > CODE_LIMITS.settings) errors.push(`settings: не больше ${CODE_LIMITS.settings}`);
  const specs = [];
  for (const item of value.slice(0, CODE_LIMITS.settings)) {
    const field = (key) => (isObject(item) ? trimmed(item[key]) : null);
    const key = field('key') ?? '';
    if (!isIdentifier(key) || key.includes('$')) {
      errors.push(`settings: ключ «${key}» — латинские буквы, цифры и _`);
      continue;
    }
    if (specs.some((spec) => spec.key === key)) {
      errors.push(`settings: ключ «${key}» дважды`);
      continue;
    }
    const type = field('type');
    if (!['string', 'number', 'boolean'].includes(type)) {
      errors.push(`settings.${key}: type — string, number или boolean`);
      continue;
    }
    let options = null;
    if (item.options !== undefined) {
      if (Array.isArray(item.options) && type === 'string' && item.options.length > 0) {
        options = item.options.filter((option) => typeof option === 'string');
      } else errors.push(`settings.${key}: options — список строк, только у type string`);
    }
    if (item.secret !== undefined && item.secret !== false) {
      if (item.secret !== true) {
        errors.push(`settings.${key}: secret — true или false`);
        continue;
      }
      if (type !== 'string') {
        errors.push(`settings.${key}: secret — только у type string`);
        continue;
      }
    }
    if (item.default !== undefined && !settingAccepts(type, options, item.default)) {
      errors.push(`settings.${key}: default не подходит к type`);
      continue;
    }
    specs.push({ key, type });
  }
  return specs;
}

/**
 * Пакет с кодом: манифест — по правилам шлюза, файлы кода — на месте, у приложения на Node — зависимости. Ошибки и
 * предупреждения — в `result`; там же — `runtime` и `targets` для сборки.
 */
function checkCode(m, kind, files, result, foreign) {
  const { errors, warnings } = result;
  const fileOf = (path) => files.find((file) => file.path === path);
  const sha256Of = (file) => createHash('sha256').update(readFileSync(file.abs)).digest('hex');

  // ---- движок ----
  const given = trimmed(m.runtime);
  let runtime = 'js';
  if (given !== null && given !== 'js') {
    if ((given === 'wasm' || given === 'mcp') && kind === 'plugin') runtime = given;
    else if ((given === 'process' || given === 'node') && kind === 'app') runtime = given;
    else errors.push(`runtime «${given}» не подходит: у плагина js, wasm или mcp, у приложения — process или node`);
  }
  if (kind === 'app' && runtime !== 'process' && runtime !== 'node') {
    errors.push('приложение — это runtime «process» (своя сборка под каждую систему) или «node» (скрипт на Node шлюза)');
  }
  result.runtime = runtime;

  // ---- сборки приложения: targets ----
  const targets = {};
  if (m.targets !== undefined && !isObject(m.targets)) errors.push('targets: объект «платформа → { file, sha256 }»');
  for (const [platform, target] of Object.entries(isObject(m.targets) ? m.targets : {})) {
    const file = trimmed(target?.file) ?? '';
    const sha256 = (trimmed(target?.sha256) ?? '').toLowerCase();
    if (!isPackagePath(file)) errors.push(`targets.${platform}.file: путь внутри пакета, например bin/app-${platform}`);
    else if (!/^[0-9a-f]{64}$/.test(sha256)) errors.push(`targets.${platform}.sha256: 64 шестнадцатеричных знака`);
    else targets[platform] = { file, sha256 };
  }
  if (kind === 'app' && runtime === 'process' && Object.keys(targets).length === 0) {
    errors.push('targets: сборки приложения под платформы (linux-aarch64, darwin-arm64, linux-x86_64)');
  }
  if (runtime === 'process') {
    for (const [platform, target] of Object.entries(targets)) {
      // Имя платформы — часть имени архива в ленте: <id>-<версия>-<платформа>.vgp.
      if (!/^[a-z0-9]+-[a-z0-9_]+$/.test(platform)) errors.push(`targets.${platform}: платформа вида linux-aarch64 (строчные латинские, цифры, «-», «_»)`);
      else if (!PLATFORMS.includes(platform)) warnings.push(`targets.${platform}: такой платформы шлюз не называет (есть ${PLATFORMS.join(', ')}) — эту сборку никто не возьмёт`);
      const file = fileOf(target.file);
      if (!file) errors.push(`targets.${platform}.file: нет файла ${target.file} в пакете`);
      else if (sha256Of(file) !== target.sha256) {
        errors.push(`targets.${platform}.sha256 не сходится с ${target.file} — шлюз сверяет хеш перед каждым запуском и такую сборку не запустит`);
      }
    }
    result.targets = targets;
  } else if (Object.keys(targets).length) {
    warnings.push(`targets: шлюз читает их только у runtime process, а здесь ${runtime}`);
  }

  // ---- скрипт приложения на Node ----
  if (runtime === 'node') {
    const entry = trimmed(m.node?.entry) ?? 'index.js';
    if (!isPackagePath(entry) || !/\.(js|mjs|cjs)$/.test(entry)) errors.push('node.entry: скрипт в пакете, например server.mjs');
    else if (!fileOf(entry)) {
      errors.push(m.node?.entry === undefined ? 'node.entry не задан, а index.js в пакете нет — назовите скрипт, например server.mjs' : `node.entry: нет файла ${entry} в пакете`);
    }
    result.entry = entry;
  } else if (m.node !== undefined) {
    warnings.push(`node: шлюз читает его только у runtime node, а здесь ${runtime}`);
  }

  // ---- плагин: код в шлюзе ----
  if (runtime === 'mcp') {
    let ok = false;
    try {
      const url = new URL(trimmed(m.mcp?.url) ?? '');
      ok = url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      ok = false;
    }
    if (!ok) errors.push('mcp.url: адрес MCP-сервера (https://…)');
  }
  for (const [file, max] of [['backend.js', CODE_LIMITS.backendJsBytes], ['backend.wasm', CODE_LIMITS.backendWasmBytes]]) {
    const found = fileOf(file);
    if (found && found.size > max) errors.push(`${file}: ${(found.size / 1024 / 1024).toFixed(1)} МБ — не больше ${max / 1024 / 1024} МБ`);
  }

  // ---- здоровье ----
  if (m.health !== undefined) {
    if (!isObject(m.health)) errors.push('health: объект { path, intervalS }');
    else {
      if (m.health.path !== undefined && !(typeof m.health.path === 'string' && m.health.path.startsWith('/'))) {
        warnings.push('health.path: путь с «/» в начале — иначе шлюз спросит /health');
      }
      const interval = m.health.intervalS;
      if (interval !== undefined && !(Number.isInteger(interval) && interval >= 5 && interval <= 300)) {
        warnings.push('health.intervalS: целое от 5 до 300 — иначе шлюз возьмёт ближайшее (или 15)');
      }
    }
  }

  // ---- где работает ----
  const runs = Array.isArray(m.runs) ? m.runs : [];
  if (runtime === 'node' && runs.some((run) => PLACEMENTS.includes(run) && run !== 'pc')) {
    errors.push('runs: Node есть только у шлюза на компьютере — у приложения на Node только pc');
  }
  if (m.dataVersion !== undefined && m.dataVersion !== null && !(Number.isInteger(m.dataVersion) && m.dataVersion >= 0 && m.dataVersion <= 0xffffffff)) {
    errors.push('dataVersion: целое число — вид данных, который хранит плагин');
  }
  const prefer = trimmed(m.prefer);
  if (prefer !== null && prefer !== 'home' && prefer !== 'here') errors.push(`prefer «${prefer}»: home (тяжёлое — на компьютере) или here`);

  // ---- бюджет ----
  const budget = { ...BUDGET_DEFAULTS };
  if (m.budget !== undefined && !isObject(m.budget)) errors.push('budget: объект { memoryMb, storageMb, filesMb, tasks }');
  const maxima = {
    memoryMb: runtime === 'node' ? CODE_LIMITS.nodeMemoryMb : CODE_LIMITS.memoryMb,
    storageMb: CODE_LIMITS.storageMb,
    filesMb: CODE_LIMITS.filesMb,
    tasks: CODE_LIMITS.tasks,
  };
  for (const [key, max] of Object.entries(maxima)) {
    const value = isObject(m.budget) ? m.budget[key] : undefined;
    if (value === undefined) continue;
    if (Number.isInteger(value) && value >= 1 && value <= max) budget[key] = value;
    else errors.push(`budget.${key}: целое от 1 до ${max}`);
  }
  result.budget = budget;

  // ---- права ----
  const permissions = [];
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) errors.push('permissions: список прав');
    else {
      for (const name of m.permissions) {
        const permission = typeof name === 'string' ? parsePermission(name) : null;
        if (permission) {
          if (!permissions.some((p) => p.name === name)) permissions.push({ ...permission, name });
          continue;
        }
        const text = shown(name);
        errors.push(
          RIGHT_NOW[text]
            ? `permissions: «${text}» — право Host API 1; теперь: ${RIGHT_NOW[text]}`
            : `permissions: «${text}» — нет такого права: есть net:<хост> и связи see:/listen:/call:/edit:<адрес>`,
        );
      }
    }
  }
  result.permissions = permissions.map((p) => p.name).sort();

  // ---- настройки и вклады ----
  const settings = checkSettings(m.settings, errors);
  checkContributes(m.contributes, permissions, settings, errors);

  // MIDI-клавиатура подключается к компьютеру: приложение, что её слушает, работает там.
  const hearsMidi = permissions.some((p) => p.level && LEVELS.indexOf(p.level) >= LEVELS.indexOf('listen') && patternMatches(p.pattern, 'device/midi'));
  if (hearsMidi && !runs.includes('pc')) errors.push('midi: MIDI-клавиатура подключается к компьютеру — добавьте pc в runs');

  // Плагину на JS или WASM нужен его код, если он даёт фразы, инструменты, источники или события (registry.rs).
  const c = isObject(m.contributes) ? m.contributes : {};
  const needsCode = ['intents', 'tools', 'media', 'events'].some((key) => Array.isArray(c[key]) && c[key].length > 0);
  const codeFile = { js: 'backend.js', wasm: 'backend.wasm' }[runtime];
  if (kind === 'plugin' && needsCode && codeFile && !fileOf(codeFile)) errors.push(`нужен ${codeFile}: его функции обслуживают то, что плагин даёт`);

  // ---- размер: распакованный архив; у приложения со сборками — архив каждой платформы ----
  const limit = CODE_LIMITS.unpackedBytes;
  const platforms = Object.keys(result.targets ?? {});
  if (platforms.length) {
    for (const platform of platforms) {
      const others = new Set(platforms.filter((p) => p !== platform).map((p) => result.targets[p].file));
      others.delete(result.targets[platform].file);
      const bytes = files.filter((file) => !others.has(file.path)).reduce((sum, file) => sum + file.size, 0);
      if (bytes > limit) errors.push(`пакет под ${platform} весит ${(bytes / 1024 / 1024).toFixed(1)} МБ — распакованный не больше ${limit / 1024 / 1024} МБ`);
    }
  } else if (result.bytes > limit) {
    errors.push(`пакет весит ${(result.bytes / 1024 / 1024).toFixed(1)} МБ — распакованный не больше ${limit / 1024 / 1024} МБ`);
  }

  // ---- чужие названия: во всех текстах манифеста, кроме адресов и путей ----
  const scan = (value, at) => {
    if (typeof value === 'string') foreign(value, at);
    else if (Array.isArray(value)) value.forEach((item, i) => scan(item, `${at}[${i}]`));
    else if (isObject(value)) for (const [key, item] of Object.entries(value)) scan(item, at ? `${at}.${key}` : key);
  };
  for (const [key, value] of Object.entries(m)) {
    if (!['title', 'description', 'permissions', 'targets', 'node', 'mcp', 'health', 'id', 'runtime'].includes(key)) scan(value, key);
  }

  checkDependencies(files, runtime, result);
}

/** `contributes` пакета с кодом (`contributes()` и `bus_spec()` шлюза). */
function checkContributes(value, permissions, settings, errors) {
  if (value === undefined || !isObject(value)) return; // «contributes: объект» уже сказано
  const list = (key) => {
    if (value[key] === undefined) return [];
    if (Array.isArray(value[key])) return value[key];
    errors.push(`contributes.${key}: список`);
    return [];
  };
  const handlerOf = (item, fallback, at) => {
    const handler = (typeof item?.handler === 'string' ? item.handler : fallback).trim();
    if (!isIdentifier(handler)) errors.push(`${at}: handler «${handler}» — имя функции: латинские буквы, цифры, _ и $, не с цифры`);
  };
  const capabilityOf = (item, at) => {
    const name = item?.capability;
    if (typeof name !== 'string') return;
    if (!CAPABILITIES.includes(name)) errors.push(`${at}: нет возможности «${name}»`);
    else if (STATION_CONTROLS.includes(name)) errors.push(`${at}: «${name}» — управление колонкой, его ведут встроенные навыки`);
  };

  let phrases = 0;
  list('intents').forEach((item, index) => {
    const at = `contributes.intents[${index}]`;
    handlerOf(item, '', at);
    capabilityOf(item, at);
    const templates = item?.phrases;
    if (!Array.isArray(templates) || templates.length === 0) {
      errors.push(`${at}: phrases — непустой список фраз`);
      return;
    }
    for (const template of templates) {
      phrases += 1;
      if (typeof template !== 'string') errors.push(`${at}: фраза — строка`);
      else {
        const problem = phraseProblem(template);
        if (problem) errors.push(`${at}: ${problem}`);
      }
    }
  });
  if (phrases > CODE_LIMITS.phrases) errors.push(`contributes.intents: не больше ${CODE_LIMITS.phrases} фраз`);

  const tools = list('tools');
  if (tools.length > CODE_LIMITS.tools) errors.push(`contributes.tools: не больше ${CODE_LIMITS.tools}`);
  const toolNames = [];
  tools.slice(0, CODE_LIMITS.tools).forEach((item, index) => {
    const at = `contributes.tools[${index}]`;
    const name = typeof item?.name === 'string' ? item.name : '';
    if (!isToolName(name)) errors.push(`${at}: name — строчные латинские буквы, цифры и _, с буквы, до 48 знаков`);
    else if (BUILT_IN_TOOLS.includes(name) || name.startsWith('mcp_')) errors.push(`${at}: имя «${name}» занято встроенными инструментами`);
    else if (toolNames.includes(name)) errors.push(`${at}: имя «${name}» дважды`);
    toolNames.push(name);
    if (!trimmed(item?.description)) errors.push(`${at}: нужно description — по нему мозг выбирает инструмент`);
    const input = isObject(item) && 'input' in item ? item.input : item?.inputSchema;
    if (input !== undefined && input?.type !== 'object') errors.push(`${at}: input — JSON Schema объекта ("type": "object")`);
    handlerOf(item, name, at);
    capabilityOf(item, at);
  });

  const mediaIds = [];
  list('media').forEach((item, index) => {
    const at = `contributes.media[${index}]`;
    const id = typeof item?.id === 'string' ? item.id : '';
    if (!isPackageId(id.replaceAll('_', '-'))) errors.push(`${at}: id — строчные латинские буквы, цифры, «-» и «_»`);
    else if (mediaIds.includes(id)) errors.push(`${at}: id «${id}» дважды`);
    mediaIds.push(id);
    if (!MEDIA_KINDS.includes(item?.kind)) {
      errors.push(`${at}: kind — radio, music или tales`);
      return;
    }
    handlerOf(item, id, at);
  });

  list('events').forEach((item, index) => {
    const at = `contributes.events[${index}]`;
    const name = typeof item?.name === 'string' ? item.name : '';
    if (!PLUGIN_EVENTS.includes(name)) {
      errors.push(`${at}: событие «${name}» плагинам не отдаётся; есть ${PLUGIN_EVENTS.join(', ')}`);
      return;
    }
    handlerOf(item, '', at);
  });

  // Ритмы: само в срок — по связи с system/schedule (plugins/schedule.rs).
  const schedules = list('schedules');
  if (schedules.length && !asks(permissions, 'system/schedule', 'call')) errors.push('contributes.schedules: нужна связь call:system/schedule');
  if (schedules.length > CODE_LIMITS.rhythms) errors.push(`contributes.schedules: до ${CODE_LIMITS.rhythms} ритмов`);
  const rhythmIds = [];
  schedules.slice(0, CODE_LIMITS.rhythms).forEach((item, index) => {
    const at = `contributes.schedules[${index}]`;
    const before = errors.length;
    const id = typeof item?.id === 'string' ? item.id : '';
    if (!isPackageId(id)) errors.push(`${at}: id — строчные латинские, цифры и «-»`);
    const title = trimmed(item?.title) ?? id;
    if (chars(title) > CODE_LIMITS.rhythmTitleChars) errors.push(`${at}: title — до ${CODE_LIMITS.rhythmTitleChars} знаков`);
    const hasAt = isObject(item) && item.at !== undefined;
    const hasEvery = isObject(item) && item.every !== undefined;
    if (hasAt && !hasEvery) {
      const time = typeof item.at === 'string' ? item.at.trim() : '';
      const setting = time.startsWith('{') && time.endsWith('}') ? time.slice(1, -1) : null;
      if (!setting && !clock(time)) errors.push(`${at}: at «${time}» — ЧЧ:ММ или {ключ} строковой настройки`);
      if (setting && !settings.some((s) => s.key === setting && s.type === 'string')) {
        errors.push(`contributes.schedules «${id}»: at «${time}» — нет строковой настройки «${setting}»`);
      }
      const days = item.days;
      if (days === undefined || ['daily', 'weekdays', 'weekends'].includes(days)) {
        // годится
      } else if (typeof days === 'string') errors.push(`${at}: days «${days}» — daily, weekdays, weekends или список дней`);
      else if (Array.isArray(days)) {
        const wrong = days.find((day) => !WEEK.includes(day));
        if (wrong !== undefined) errors.push(`${at}: день «${typeof wrong === 'string' ? wrong : ''}» — mon … sun`);
        else if (days.length === 0) errors.push(`${at}: days — пустой список`);
      } else errors.push(`${at}: days — строка или список дней`);
    } else if (hasEvery && !hasAt) {
      const minutes = typeof item.every === 'string' ? minutesOf(item.every) : null;
      if (minutes === null || minutes < 5 || minutes > 1440) errors.push(`${at}: every — от 5m до 1d: не чаще раза в 5 минут`);
      const from = typeof item.from === 'string' ? item.from.trim() : '08:00';
      const to = typeof item.to === 'string' ? item.to.trim() : '22:00';
      const start = clock(from);
      const end = to === '24:00' ? 1440 : clock(to) && clock(to)[0] * 60 + clock(to)[1];
      if (!start || end === null || start[0] * 60 + start[1] >= end) errors.push(`${at}: from и to — ЧЧ:ММ, from раньше to (24:00 — конец дня)`);
      if (item.days !== undefined) errors.push(`${at}: days — только у at`);
    } else errors.push(`${at}: ровно одно из at и every`);
    if (isObject(item) && (item.once !== undefined || item.after !== undefined)) errors.push(`${at}: once и after — у задач из кода, не у ритма манифеста`);
    const handler = trimmed(item?.handler);
    const say = trimmed(item?.say);
    const notify = trimmed(item?.notify);
    if (handler && (say || notify)) errors.push(`${at}: ровно одно — handler или готовый ответ (say, notify)`);
    else if (handler && !isIdentifier(handler)) errors.push(`${at}: handler «${handler}» — имя функции: латинские буквы, цифры, _ и $, не с цифры`);
    else if (!handler && !say && !notify) errors.push(`${at}: нужен handler или готовый ответ say (notify)`);
    else if (say && !asks(permissions, 'system/voice', 'call')) errors.push(`${at}: say — речь без запроса, нужна связь call:system/voice`);
    else if (notify && !asks(permissions, 'system/notify', 'call')) errors.push(`${at}: notify — сообщение владельцу, нужна связь call:system/notify`);
    if (errors.length === before) {
      if (rhythmIds.includes(id)) errors.push(`${at}: id «${id}» уже есть`);
      rhythmIds.push(id);
    }
  });

  // Шина: личные и опасные умения, новости, ответ словами (bus_spec).
  const bus = value.bus;
  if (bus === undefined) return;
  if (!isObject(bus)) {
    errors.push('contributes.bus: объект');
    return;
  }
  for (const key of ['private', 'emits']) {
    if (bus[key] === undefined) continue;
    if (!Array.isArray(bus[key])) errors.push(`contributes.bus.${key}: список имён`);
    else for (const item of bus[key]) if (!(isIdentifier(item) || isNewsName(item))) errors.push(`contributes.bus.${key}: «${shown(item)}» — не имя`);
  }
  if (bus.danger !== undefined) {
    if (!isObject(bus.danger)) errors.push('contributes.bus.danger: объект «умение → опасность»');
    else {
      for (const [handle, mark] of Object.entries(bus.danger)) {
        if (!DANGERS.includes(mark)) errors.push(`contributes.bus.danger.${handle}: ${DANGERS.slice(0, -1).join(', ')} или ${DANGERS.at(-1)}`);
      }
    }
  }
  if (bus.ask !== undefined && !isIdentifier(bus.ask)) errors.push('contributes.bus.ask: имя функции, что отвечает словами');
  const heard = permissions.filter((p) => p.level && LEVELS.indexOf(p.level) >= LEVELS.indexOf('listen')).map((p) => p.pattern);
  (Array.isArray(bus.on) ? bus.on : []).forEach((item, index) => {
    const at = `contributes.bus.on[${index}]`;
    const from = typeof item?.from === 'string' ? busPattern(item.from) : null;
    if (!from) {
      errors.push(`${at}: from — чей адрес (app/shopping, files/home/Фото/*)`);
      return;
    }
    if (!isNewsName(item.event)) {
      errors.push(`${at}: event — имя новости`);
      return;
    }
    if (!heard.some((pattern) => patternCovers(pattern, from))) errors.push(`${at}: слушать «${from}» — нужно право listen:${from}`);
    handlerOf(item, '', at);
  });
}

/** Сколько назвать по имени, остальное — числом. */
const NAMED = 10;
const named = (names) => (names.length > NAMED ? `${names.slice(0, NAMED).join(', ')} и ещё ${names.length - NAMED}` : names.join(', '));

/**
 * Зависимости приложения на Node: шлюз ставит их сам — `npm ci --ignore-scripts --omit=dev` по package-lock.json пакета
 * (src/apps/node.rs). Поэтому lock — обязательно, если package.json их называет; каждая — из registry.npmjs.org с
 * integrity; сценарии установки не запустятся.
 */
function checkDependencies(files, runtime, result) {
  const { errors, warnings } = result;
  const fileOf = (path) => files.find((file) => file.path === path);
  const pkgFile = fileOf('package.json');
  const lockFile = fileOf('package-lock.json');
  if (runtime !== 'node') {
    if (lockFile) warnings.push('package-lock.json: зависимости шлюз ставит только приложениям на Node (runtime node) — этот файл он не прочтёт');
    return;
  }
  const read = (file) => {
    try {
      const value = JSON.parse(readFileSync(file.abs, 'utf8'));
      if (isObject(value)) return value;
      errors.push(`${file.path}: должен быть объектом`);
    } catch (error) {
      errors.push(`${file.path} не читается как JSON: ${error.message}`);
    }
    return null;
  };
  const pkg = pkgFile ? read(pkgFile) : null;
  const sections = ['dependencies', 'optionalDependencies', 'devDependencies'];
  const declared = (section) => (isObject(pkg?.[section]) ? pkg[section] : {});
  const runtimeDeps = [...Object.keys(declared('dependencies')), ...Object.keys(declared('optionalDependencies'))];
  if (pkg) {
    if (pkg.workspaces !== undefined) errors.push('package.json: workspaces — шлюз ставит одно приложение, без рабочих областей');
    for (const script of ['preinstall', 'install', 'postinstall', 'prepare']) {
      if (pkg.scripts?.[script] !== undefined) warnings.push(`package.json: scripts.${script} не запустится — шлюз ставит зависимости без сценариев (--ignore-scripts)`);
    }
  }
  if (!lockFile) {
    if (runtimeDeps.length) {
      errors.push(
        `package.json называет зависимости (${named(runtimeDeps)}), а package-lock.json нет — без него шлюз ничего не поставит: соберите его (npm install --package-lock-only) и положите в пакет`,
      );
    }
    return;
  }
  if (!pkgFile) {
    errors.push('package-lock.json без package.json — npm ci не пройдёт');
    return;
  }
  const lock = read(lockFile);
  if (!lock || !pkg) return;
  if (lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) {
    errors.push(`package-lock.json: lockfileVersion ${shown(lock.lockfileVersion)} — нужен 2 или 3 (npm 7 и новее): пересоберите npm install`);
    return;
  }
  if (!isObject(lock.packages)) {
    errors.push('package-lock.json: нет packages — пересоберите npm install');
    return;
  }

  // npm ci откажет, если lock не сходится с package.json.
  const root = isObject(lock.packages['']) ? lock.packages[''] : {};
  for (const section of sections) {
    const want = declared(section);
    const have = isObject(root[section]) ? root[section] : {};
    const differ = [...new Set([...Object.keys(want), ...Object.keys(have)])].filter((name) => want[name] !== have[name]).sort();
    if (differ.length) errors.push(`package-lock.json не сходится с package.json (${section}: ${named(differ)}) — npm ci откажет; пересоберите: npm install`);
  }

  const foreign = [];
  const unchecked = [];
  const linked = [];
  const scripts = [];
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (key === '') continue;
    const at = key.lastIndexOf('node_modules/');
    if (!key.startsWith('node_modules/') || !isObject(entry)) {
      linked.push(key);
      continue;
    }
    const name = `${key.slice(at + 'node_modules/'.length)}${typeof entry.version === 'string' ? `@${entry.version}` : ''}`;
    if (entry.link === true) {
      linked.push(name);
      continue;
    }
    if (entry.hasInstallScript === true && entry.dev !== true) scripts.push(name);
    if (entry.inBundle === true) continue; // приходит внутри архива пакета, что его везёт
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith('https://registry.npmjs.org/')) foreign.push(name);
    if (typeof entry.integrity !== 'string' || !/^sha(1|256|384|512)-/.test(entry.integrity)) unchecked.push(name);
  }
  if (linked.length) errors.push(`package-lock.json: ${named(linked)} — не пакет из реестра (рабочая область или ссылка на папку): шлюз такое не поставит`);
  if (foreign.length) errors.push(`package-lock.json: не из https://registry.npmjs.org/ — ${named(foreign)}: шлюз ставит зависимости только оттуда`);
  if (unchecked.length) errors.push(`package-lock.json: без integrity — ${named(unchecked)}: npm не сверит, что скачал`);
  for (const name of scripts) warnings.push(`${name}: сценарий установки не запустится: шлюз ставит без сценариев — годится, только если у пакета готовые сборки`);
}

/** Папки пакетов: packages/<id>/, по алфавиту. */
export function packageDirs(src) {
  return readdirSync(src)
    .filter((name) => !name.startsWith('.') && lstatSync(join(src, name)).isDirectory())
    .sort()
    .map((name) => join(src, name));
}

/** Печатает итог проверки; true — ошибок нет. */
export function report(results, { quiet = false } = {}) {
  let ok = true;
  for (const r of results) {
    const id = r.manifest?.id ?? r.folder;
    const version = r.manifest?.version ?? '?';
    if (r.errors.length) ok = false;
    if (!quiet || r.errors.length || r.warnings.length) {
      const mark = r.errors.length ? '✗' : r.warnings.length ? '!' : '✓';
      console.log(`${mark} ${id} ${version} — ${plural(r.files.length, ['файл', 'файла', 'файлов'])}, ${(r.bytes / 1024).toFixed(1)} КБ`);
    }
    for (const e of r.errors) console.log(`    ошибка: ${e}`);
    for (const w of r.warnings) console.log(`    внимание: ${w}`);
  }
  return ok;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dirs = args.length ? args.map((a) => resolve(a)) : packageDirs(join(ROOT, 'packages'));
  const missing = dirs.filter((d) => !existsSync(d));
  if (missing.length) {
    console.error(`нет папки: ${missing.join(', ')}`);
    process.exit(2);
  }
  const ok = report(dirs.map(checkPackage));
  console.log(ok ? 'Пакеты в порядке.' : 'Есть ошибки — в каталог такие пакеты не попадут.');
  process.exit(ok ? 0 : 1);
}
