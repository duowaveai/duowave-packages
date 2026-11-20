// Пишет каталоги для подсказки модели из данных пакета:
//   remotion/sets/catalog.json  — декорации: id → { title, look, about, states, spots } (как SETS, без компонентов)
//   remotion/looks/catalog.json — облики: id → { title, about }
// Запуск из папки пакета: node remotion/dev/catalog.mjs (Node 22.6+, .ts читается без сборки).

import { writeFileSync } from 'node:fs';
import { CATALOG } from '../sets/catalog.ts';
import { LOOK_IDS, LOOK_INFO } from '../looks/info.ts';

const here = new URL('..', import.meta.url);
const sets = Object.fromEntries(Object.entries(CATALOG).map(([id, s]) => [id, { title: s.title, look: s.look, about: s.about, states: s.states, spots: s.spots }]));
const looks = Object.fromEntries(LOOK_IDS.map((id) => [id, LOOK_INFO[id]]));
writeFileSync(new URL('sets/catalog.json', here), JSON.stringify(sets, null, 2) + '\n');
writeFileSync(new URL('looks/catalog.json', here), JSON.stringify(looks, null, 2) + '\n');
console.log(`декораций: ${Object.keys(sets).length}, обликов: ${LOOK_IDS.length}`);
