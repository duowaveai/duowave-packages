#!/usr/bin/env node
// Аватары: art/<id>.svg → packages/<id>/assets/avatar.webp (512×512, WebP без потерь).
//
//   node tools/avatars.mjs            все рисунки из art/
//   node tools/avatars.mjs arthur     только этот
//
// SVG — исходник, в пакет он не попадает (SVG в пакетах запрещён: скрипт в пульте). Рисует ImageMagick (`magick`),
// своим встроенным рендером MSVG: у обводок нужно явное stroke-opacity="1", иначе он их не рисует.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 512;
const MAX_BYTES = 256 * 1024;

const wanted = process.argv.slice(2);
const ids = (wanted.length ? wanted : readdirSync(join(ROOT, 'art')).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4))).sort();

let failed = false;
for (const id of ids) {
  const source = join(ROOT, 'art', `${id}.svg`);
  const assets = join(ROOT, 'packages', id, 'assets');
  if (!existsSync(source)) {
    console.error(`✗ ${id}: нет art/${id}.svg`);
    failed = true;
    continue;
  }
  if (!existsSync(assets)) {
    console.error(`✗ ${id}: нет папки packages/${id}/assets`);
    failed = true;
    continue;
  }
  const target = join(assets, 'avatar.webp');
  // density 144 — рисуем вдвое крупнее и уменьшаем: края ровнее. -strip — без метаданных и дат: файл повторяем.
  execFileSync('magick', [
    '-background', 'none', '-density', '144', source,
    '-resize', `${SIZE}x${SIZE}`, '-strip',
    '-define', 'webp:lossless=true', '-define', 'webp:method=6', target,
  ]);
  const bytes = statSync(target).size;
  const size = execFileSync('magick', ['identify', '-format', '%wx%h', target]).toString().trim();
  const ok = bytes <= MAX_BYTES && size === `${SIZE}x${SIZE}`;
  if (!ok) failed = true;
  console.log(`${ok ? '✓' : '✗'} ${id}: avatar.webp ${size}, ${(bytes / 1024).toFixed(1)} КБ`);
}
process.exit(failed ? 1 : 0);
