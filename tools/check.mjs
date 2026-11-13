#!/usr/bin/env node
// Проверка пакетов каталога: всё, что сборка обещает шлюзу, проверяется здесь, до упаковки.
//
//   node tools/check.mjs                  все пакеты из packages/
//   node tools/check.mjs packages/arthur  только эти
//
// Сборка (tools/build.mjs) вызывает ту же проверку и без неё ничего не собирает. Правила — docs/plans/characters.md
// шлюза, разделы 1, 2, 8 и «Контракт API»; где шлюз строже или мягче — сказано рядом.

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LIMITS = {
  promptChars: 4000, // промт персонажа
  avatarBytes: 256 * 1024, // аватар, WebP или PNG
  sampleBytes: 64 * 1024, // одна фраза-пробник, Opus
  samples: 3, // фраз-пробников у персонажа
  packageBytes: 1024 * 1024, // пакет целиком (распакованный) — меньше 1 МБ
  files: 500, // файлов в архиве (предел установщика шлюза)
  pathBytes: 100, // путь в архиве: поле name заголовка ustar
  titleChars: 80,
  descriptionChars: 500,
  licenseChars: 200,
  lineChars: 300, // строка регулятора тона
  sampleTextChars: 200,
};

/** Виды пакетов шлюза (`gateway/src/plugins/manifest.rs`). */
export const KINDS = ['plugin', 'app', 'character', 'theme'];
/** Что каталог принимает, пока нет подписи (этап 8): только пакеты без кода. */
export const CATALOG_KINDS = ['character', 'theme'];
/** Размещения шлюза (`gateway/src/core/availability.rs`, `Placement::as_str`). */
export const PLACEMENTS = ['pc', 'station', 'stationServer'];
/** Host API шлюза: `api` пакета — требование к нему. */
export const HOST_API = [1, 0, 0];
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
      else walk(abs, rel, out, problems);
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
  const result = { dir, folder, manifest: null, files: [], bytes: 0, errors, warnings };

  const files = [];
  walk(dir, '', files, errors);
  for (const file of files) {
    if (file.path !== 'manifest.json' && !file.path.startsWith('assets/')) {
      errors.push(`${file.path}: в пакете только manifest.json и assets/ (код пакетам этого каталога не положен)`);
    }
    if (Buffer.byteLength(file.path) > LIMITS.pathBytes) errors.push(`${file.path}: путь длиннее ${LIMITS.pathBytes} байт`);
    if (file.path.startsWith('assets/')) {
      const ext = extname(file.path).toLowerCase();
      if (ext === '.svg' || ext === '.svgz') errors.push(`${file.path}: SVG в пакете нельзя — переведите в WebP или PNG`);
      else if (!ASSET_EXTENSIONS.has(ext)) errors.push(`${file.path}: такой файл в assets/ не нужен (есть .webp .png .opus .wav .pt)`);
      else if (looksLikeSvg(readFileSync(file.abs))) errors.push(`${file.path}: внутри SVG`);
    }
  }
  files.sort((a, b) => (a.path === 'manifest.json' ? -1 : b.path === 'manifest.json' ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  result.files = files;
  result.bytes = files.reduce((sum, file) => sum + file.size, 0);
  if (result.bytes >= LIMITS.packageBytes) {
    errors.push(`пакет весит ${(result.bytes / 1024).toFixed(0)} КБ — должен быть меньше ${LIMITS.packageBytes / 1024} КБ`);
  }
  if (files.length > LIMITS.files) errors.push(`файлов ${files.length} — не больше ${LIMITS.files}`);

  const manifestFile = files.find((file) => file.path === 'manifest.json');
  if (!manifestFile) {
    errors.push('нет manifest.json');
    return result;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile.abs, 'utf8'));
  } catch (error) {
    errors.push(`manifest.json не читается как JSON: ${error.message}`);
    return result;
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('manifest.json должен быть объектом');
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
  const kind = manifest.kind ?? 'plugin';
  if (!KINDS.includes(kind)) errors.push(`kind «${kind}»: такого вида нет; есть ${KINDS.join(', ')}`);
  else if (!CATALOG_KINDS.includes(kind)) errors.push(`kind «${kind}»: пока у каталога нет подписи (этап 8), в нём только пакеты без кода — ${CATALOG_KINDS.join(', ')}`);
  if (!isPackageId(manifest.id)) errors.push('id: строчные латинские буквы, цифры и «-», с буквы, до 32 знаков');
  else if (manifest.id !== folder) errors.push(`id «${manifest.id}» не совпадает с папкой packages/${folder}`);
  if (!isSemver(manifest.version)) errors.push('version: номер версии вида 1.2.0 (semver)');
  const apiOk = requirementMatches(manifest.api, HOST_API);
  if (apiOk === null) errors.push('api: требование к Host API, например «^1»');
  else if (!apiOk) errors.push(`api «${manifest.api}» не подходит к Host API шлюза ${HOST_API.join('.')}`);
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
  for (const key of ['runtime', 'permissions', 'budget', 'settings']) {
    if (manifest[key] !== undefined && !(Array.isArray(manifest[key]) && manifest[key].length === 0)) {
      errors.push(`${key}: у пакета вида ${kind} нет кода — это поле плагина`);
    }
  }
  const contributes = manifest.contributes;
  if (contributes !== undefined && (typeof contributes !== 'object' || contributes === null || Array.isArray(contributes))) {
    errors.push('contributes: объект');
  }
  for (const key of ['intents', 'tools', 'media', 'events']) {
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
