// Архив пакета .vgp — tar.gz без внешних программ и зависимостей, одинаковый от сборки к сборке.
//
// Внутри только обычные файлы (без записей папок, ссылок и прочего: установщик шлюза их не примет), в заданном
// порядке, владелец 0:0, права 0644, одно и то же время. Заголовки — ustar. Сжатие — zlib; в заголовке gzip время 0 и
// ОС «Unix», как у `gzip -n`. Сжатые байты повторяются на той же версии zlib (Node); хеш в каталоге — от готового архива.

import { gzipSync, gunzipSync, constants } from 'node:zlib';

const BLOCK = 512;
/** Время файлов в архиве: 2026-01-01T00:00:00Z — не время сборки, чтобы архив не менялся без причины. */
export const MTIME = 1767225600;

const octal = (value, digits) => value.toString(8).padStart(digits, '0') + '\0';

function header(name, size) {
  const nameBytes = Buffer.from(name, 'utf8');
  if (nameBytes.length > 100) throw new Error(`${name}: путь длиннее 100 байт`);
  const block = Buffer.alloc(BLOCK, 0);
  nameBytes.copy(block, 0);
  block.write(octal(0o644, 7), 100, 'latin1'); // mode
  block.write(octal(0, 7), 108, 'latin1'); // uid
  block.write(octal(0, 7), 116, 'latin1'); // gid
  block.write(octal(size, 11), 124, 'latin1'); // size
  block.write(octal(MTIME, 11), 136, 'latin1'); // mtime
  block.fill(0x20, 148, 156); // checksum считается с пробелами на его месте
  block.write('0', 156, 'latin1'); // typeflag: обычный файл
  block.write('ustar\0', 257, 'latin1');
  block.write('00', 263, 'latin1');
  block.write(octal(0, 7), 329, 'latin1'); // devmajor
  block.write(octal(0, 7), 337, 'latin1'); // devminor
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(octal(sum, 6) + ' ', 148, 'latin1');
  return block;
}

/** entries: [{name, data: Buffer}] в нужном порядке → tar.gz. */
export function tarGz(entries) {
  const parts = [];
  for (const { name, data } of entries) {
    parts.push(header(name, data.length), data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  const gz = gzipSync(Buffer.concat(parts), { level: constants.Z_BEST_COMPRESSION });
  gz.writeUInt32LE(0, 4); // MTIME в заголовке gzip
  gz[9] = 3; // OS: Unix — один и тот же байт на любой машине
  return gz;
}

/** Обратное: tar.gz → [{name, type, size, data}]. Для самопроверки сборки; бросает, если архив битый. */
export function readTarGz(gz) {
  const tar = gunzipSync(gz);
  const entries = [];
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const block = tar.subarray(offset, offset + BLOCK);
    if (block.every((byte) => byte === 0)) break;
    const field = (start, length) => block.toString('latin1', start, start + length).replace(/\0.*$/s, '').trim();
    const stored = parseInt(field(148, 8), 8);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i];
    if (sum !== stored) throw new Error(`битый заголовок на ${offset}`);
    const nameEnd = block.indexOf(0);
    const name = block.toString('utf8', 0, nameEnd === -1 || nameEnd > 100 ? 100 : nameEnd);
    const prefix = field(345, 155);
    const size = parseInt(field(124, 12), 8);
    const type = String.fromCharCode(block[156] || 0x30);
    offset += BLOCK;
    entries.push({ name: prefix ? `${prefix}/${name}` : name, type, size, data: tar.subarray(offset, offset + size) });
    offset += Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}
