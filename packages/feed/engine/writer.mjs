// «Обычно» (этап 8 плана): серия данными. Мозг пишет одной просьбой (`system/brain` → `write`, JSON): реплики,
// развилку и картинку — планы на декорации библиотеки, события по репликам, ресурс на плашке, «обе ветки» прошлой
// развилки. Картинку рисует библиотека пакета (remotion/data), кода модель не пишет. Ответ проверяется и
// поправляется: неизвестная декорация — первая декорация облика, план на несуществующую реплику — выброшен.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { castFromAnswer, castText, voicesText } from './cast.mjs';
import { Cancelled, letter, log } from './host.mjs';
import { L } from './i18n.mjs';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOOK_IDS = ['ink', 'riso', 'pixel', 'papercut', 'glass', 'ascii'];
const FORBIDDEN = /(умер|умир|смерт|убий|убит|убива|суицид|самоубий|\bdie\b|\bdeath\b|\bkill|suicide|алис[аеуы]|яндекс)/iu;
const TEXT_MAX = 1100;

/** Каталог декораций библиотеки (remotion/sets/catalog.json): какие есть, в каком облике, какие у них состояния. */
export function setCatalog() {
    const file = join(PACKAGE, 'remotion', 'sets', 'catalog.json');
    if (!existsSync(file)) return [];
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : Object.entries(raw.sets ?? raw).map(([id, set]) => ({ id, ...set }));
}

function rules(lang) {
    const file = join(PACKAGE, 'lang', lang, 'writing.md');
    return existsSync(file) ? readFileSync(file, 'utf8') : readFileSync(join(PACKAGE, 'lang', 'ru', 'writing.md'), 'utf8');
}

const FORMAT = `Ответь одним JSON-объектом такого вида (без пояснений вокруг):
{
  "series": { "title": "…", "world": "пять строк: закон мира; ресурс на плашке, который тает; главный объект; второй голос, который может врать; обещанный конец" },   // только в первой серии
  "title": "название сериала", "logline": "одна фраза: о чём серия", "direction": "жанр",
  "choice": { "q": "ВОПРОС КАПСОМ?", "a": { "title": "ВАРИАНТ ①", "price": "цена словами" }, "b": { "title": "ВАРИАНТ ②", "price": "цена словами" } },
  "lines": [ { "id": "01", "text": "что в субтитрах", "speak": "как читать, если иначе (число словами, ударение заглавной)", "speaker": "имя персонажа, если реплику говорит он" } ],
  "radio": ["id реплик через рацию или телефон"], "deep": ["id реплик голосом угрозы"],
  "cast": { "narrator": "id голоса рассказчика", "second": "id второго голоса", "characters": { "Имя": "id голоса" } },   // когда есть список голосов
  "worldAdd": "1–2 строки в мир сериала после этой серии: что стало известно, сколько осталось ресурса, какой вариант был верным",
  "data": {
    "pacing": { "defaultPre": 0.3, "pre": { "id": 0.5 }, "endHold": 3.6 },
    "hud": ["счётчик", "ресурс"],
    "shots": [ { "at": "id реплики, с которой план начинается", "set": "id декорации", "state": { "имя": 0.0 }, "fx": 540, "fy": 900, "s": [1, 1.3], "cy": 900 } ],
    "events": [ { "at": "id реплики", "word": 0, "set": "id декорации", "change": { "имя": 1 }, "over": 1.2, "sfx": "hit", "fx": "shake" } ],
    "bed": ["low", "wind"],
    "emphasis": [ { "id": "id реплики", "words": ["слово"], "tone": "red" } ],
    "choice": { "a": { "set": "id декорации", "state": {} }, "b": { "set": "id декорации", "state": {} } },
    "branches": { "wrong": "a", "wrongLines": ["первая", "последняя"], "rightLines": ["первая", "последняя"] }
  }
}
Картинка — только декорации из каталога ниже, планы — ракурсы камеры на них: fx, fy — точка кадра в декорации
(1080×1920), s — масштаб камеры от и до за план, cy — где эта точка на экране по высоте; или spot — готовый ракурс
декорации из её списка. Новый план — каждые 3–6 с; word у плана и события — номер слова реплики с нуля (склейка за
0,1 с до него). Событие без set меняет декорацию текущего плана; у события ещё shift (сдвиг, с), volume, hud
(плашка с этого места). fx "end" — «КОНЕЦ» на чёрном после реплики до перемотки, звук hit сам; fx "rewind" —
перемотка с 0,25 с до реплики, звук rewind сам; перед карточками rise и hit — сами; bed молчит во время «КОНЕЦ» и
перемотки. Реплика с "role": "radio" или "phone" — субтитры цветом и эфир под ней. choice.at — реплика, с которой
выходят карточки (по умолчанию последняя); choice.a/b — декорация и ракурс миниатюры (spot или fx, fy, s).
Состояния декорации — числа 0…1 из её списка; events меняют их по ходу (over — за сколько секунд). sfx — из базового
набора: low, wind, hit, heart, rise, static, radio_on, crunch, rewind, sea. fx: shake, flash, end («КОНЕЦ» неверной
ветки), rewind (перемотка). bed — звуки под всем роликом. branches — только со второй серии: какая ветка прошлой
развилки неверная и какими репликами идёт каждая. Метку «ТВОЙ ВЫБОР» не рисуй и не упоминай: её ставит плеер.
8–12 реплик, 450–900 знаков текста всего; id реплик — "01", "02", … по порядку.`;

function catalogText(catalog, look) {
    const ofLook = catalog.filter((set) => set.look === look);
    const shown = ofLook.length ? ofLook : catalog;
    return shown
        .map((set) => {
            const states = Object.entries(set.states ?? {})
                .map(([name, state]) => `${name} (${state.about ?? ''}, по умолчанию ${state.default ?? 0})`)
                .join('; ');
            const spots = Object.keys(set.spots ?? {}).join(', ');
            return `- ${set.id} — ${set.title}${set.about ? `: ${set.about}` : ''}${states ? `. Состояния: ${states}` : ''}${spots ? `. Ракурсы: ${spots}` : ''}`;
        })
        .join('\n');
}

/** Прошлые серии сериала коротко: модель ссылается только на то, что зритель видел. */
function previous(state, series) {
    return state.episodes
        .filter((episode) => episode.series === series)
        .sort((a, b) => a.n - b.n)
        .map((episode) => {
            const chosen = episode.chosen ? `, зритель выбрал ${episode.chosen === 'a' ? '①' : '②'}` : '';
            const choice = episode.choice ? ` Развилка: ${episode.choice.q} ① ${episode.choice.a.title} / ② ${episode.choice.b.title}${chosen}.` : '';
            return `Серия ${episode.n} «${episode.title}»: ${episode.logline}.${choice}${episode.linesText ? `\nРеплики: ${episode.linesText}` : ''}`;
        })
        .join('\n\n');
}

/** Ответ модели → серия: id реплик по порядку, декорации из каталога, только существующие реплики. */
export function tidy(answer, { look, catalog, n, voices = [] }) {
    const lines = (Array.isArray(answer.lines) ? answer.lines : [])
        .filter((line) => typeof line?.text === 'string' && line.text.trim())
        .slice(0, 16);
    if (lines.length < 3) throw new Error('модель дала меньше трёх реплик');
    const rename = new Map();
    const fixed = lines.map((line, index) => {
        const id = String(index + 1).padStart(2, '0');
        rename.set(String(line.id ?? id), id);
        const out = { id, text: line.text.trim().slice(0, 300) };
        if (typeof line.speak === 'string' && line.speak.trim() && line.speak.trim() !== out.text) out.speak = line.speak.trim().slice(0, 320);
        // Чей голос: персонаж из состава; рассказчик — без поля.
        if (typeof line.speaker === 'string' && line.speaker.trim()) out.speaker = line.speaker.trim().slice(0, 40);
        return out;
    });
    const text = fixed.map((line) => line.text).join(' ');
    if (FORBIDDEN.test(text)) throw new Error('в репликах есть слова, которых в ленте нет');
    if (text.length > TEXT_MAX * 1.4) throw new Error(`реплики длиннее ${TEXT_MAX} знаков`);
    const ids = new Set(fixed.map((line) => line.id));
    const lineOf = (value) => rename.get(String(value)) ?? (ids.has(String(value)) ? String(value) : null);
    const known = new Map(catalog.map((set) => [set.id, set]));
    const firstOfLook = catalog.find((set) => set.look === look)?.id ?? catalog[0]?.id;
    const setOf = (value) => (known.has(value) ? value : firstOfLook);
    const data = answer.data && typeof answer.data === 'object' ? answer.data : {};
    const shots = (Array.isArray(data.shots) ? data.shots : [])
        .map((shot, index) => ({ ...shot, at: index === 0 ? fixed[0].id : lineOf(shot.at), set: setOf(shot.set) }))
        .filter((shot) => shot.at && shot.set);
    if (!shots.length && firstOfLook) shots.push({ at: fixed[0].id, set: firstOfLook, fx: 540, fy: 960, s: [1, 1.2], cy: 960 });
    const events = (Array.isArray(data.events) ? data.events : [])
        .map((event) => ({ ...event, at: lineOf(event.at), set: event.set ? setOf(event.set) : undefined }))
        .filter((event) => event.at);
    const choice = answer.choice;
    if (!choice?.q || !choice?.a?.title || !choice?.b?.title) throw new Error('у серии нет развилки с двумя вариантами');
    const sides = data.choice ?? {};
    // Карточки развилки рисует библиотека из data.choice: вопрос, варианты, цена — и декорация с ракурсом миниатюры.
    const side = (key) => {
        const given = sides[key] ?? {};
        const out = { title: String(choice[key].title).slice(0, 60), price: String(choice[key].price ?? '').slice(0, 160), set: setOf(given.set), state: given.state ?? {} };
        for (const field of ['spot', 'fx', 'fy', 's']) if (given[field] !== undefined) out[field] = given[field];
        return out;
    };
    const branches = n > 1 && data.branches?.wrongLines && data.branches?.rightLines
        ? {
              wrong: data.branches.wrong === 'b' ? 'b' : 'a',
              wrongLines: data.branches.wrongLines.map(lineOf).filter(Boolean),
              rightLines: data.branches.rightLines.map(lineOf).filter(Boolean),
          }
        : undefined;
    return {
        lines: fixed,
        radio: (answer.radio ?? []).map(lineOf).filter(Boolean),
        deep: (answer.deep ?? []).map(lineOf).filter(Boolean),
        info: {
            title: String(answer.title ?? '').trim().slice(0, 60) || L('Без названия', 'Untitled'),
            logline: String(answer.logline ?? '').trim().slice(0, 240),
            direction: String(answer.direction ?? '').trim().slice(0, 40),
            choice: {
                q: String(choice.q).slice(0, 80),
                a: { title: String(choice.a.title).slice(0, 60), price: String(choice.a.price ?? '').slice(0, 160) },
                b: { title: String(choice.b.title).slice(0, 60), price: String(choice.b.price ?? '').slice(0, 160) },
            },
        },
        data: {
            pacing: data.pacing ?? { defaultPre: 0.3, pre: {}, endHold: 3.6 },
            hud: Array.isArray(data.hud) ? data.hud.slice(0, 3).map(String) : [],
            shots,
            events,
            bed: (Array.isArray(data.bed) ? data.bed : ['low']).filter((name) => typeof name === 'string'),
            emphasis: (Array.isArray(data.emphasis) ? data.emphasis : []).map((one) => ({ ...one, id: lineOf(one.id) })).filter((one) => one.id),
            choice: { q: String(choice.q).slice(0, 80), ...(lineOf(sides.at) ? { at: lineOf(sides.at) } : {}), a: side('a'), b: side('b') },
            ...(branches ? { branches } : {}),
        },
        series: answer.series,
        worldAdd: typeof answer.worldAdd === 'string' ? answer.worldAdd.slice(0, 400) : '',
        // Состав голосов — только из голосов, что шлюз дал в списке.
        cast: voices.length ? castFromAnswer(answer.cast, voices) : null,
    };
}

/**
 * Серия данными от Мозга. `ask` — что знает лента: сериал, его мир, прошлые серии, вкус, пожелания, после какой
 * развилки. Сорвалось дважды — ошибка со словами.
 */
export async function writeEpisode({ state, series, world, n, after, look, lang = 'ru', pitch, wish, interests, check, model, signal, cast, voices = [] }) {
    const catalog = setCatalog();
    if (!catalog.length) throw new Error('в пакете нет библиотеки декораций (remotion/sets/catalog.json)');
    const system = `${rules(lang)}\n\n## Формат ответа\n\n${FORMAT}\n\n## Декорации облика «${look}»\n\n${catalogText(catalog, look)}`;
    const parts = [];
    if (n === 1) parts.push(`Новый сериал, серия 1. Завязка: ${pitch ?? 'выбери сам'}. Облик: ${look}. Язык: ${lang}.`);
    else {
        parts.push(`Сериал «${series.title}», серия ${n}. Облик: ${look}. Язык: ${lang}.`);
        if (world) parts.push(`Мир сериала:\n${world}`);
        parts.push(`Прошлые серии:\n${previous(state, series.id)}`);
        if (after) parts.push(`Эта серия идёт после развилки серии ${after.n}: ${after.q}. Покажи обе ветки (branches).`);
    }
    const taste = (await import('./state.mjs')).taste(state);
    if (taste.length) parts.push(`Вкус зрителя (держи то, что нравится; не повторяй то, что нет):\n${taste.join('\n')}`);
    if (wish) parts.push(`Пожелание к этой серии: ${wish}`);
    if (interests?.length) parts.push(`Интересы дома (из памяти DuoWave, по разрешению): ${interests.join('; ')}. Учитывай их бережно, не называй прямо.`);
    // Состав голосов (cast.mjs): в первой серии модель подбирает его из голосов шлюза; дальше держит тех же персонажей.
    if (cast && (cast.narrator || Object.keys(cast.characters ?? {}).length)) {
        parts.push(`Состав голосов сериала: ${castText(cast)}. Реплики этих персонажей помечай "speaker" с тем же именем; реплики рации, телефона и угрозы читает второй голос — их id в radio и deep.`);
    }
    if (voices.length) {
        parts.push(
            [
                'Голоса, которые есть (id — имя, язык, где звучит, лицензия):',
                voicesText(voices),
                `Составь "cast": рассказчик — ${cast?.narrator ? `${cast.narrator.title} (${cast.narrator.id})` : 'голос из списка'}, если в завязке или пожелании человек не назвал другой голос; если назвал — возьми его.`,
                'Второй голос (рация, телефон, угроза) и персонажи с репликами — другие голоса того же языка из списка, разные на слух; облачные и платные — только если рассказчик сам облачный или человек их назвал. Персонажей с голосами — не больше четырёх; их реплики помечай "speaker": "Имя".',
            ].join('\n'),
        );
    }
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const prompt = parts.join('\n\n') + (lastError ? `\n\nПрошлый ответ не подошёл: ${lastError}. Исправь.` : '');
        try {
            const answer = await letter('system/brain', 'write', { system, prompt, model: model ?? 'smart', json: true }, signal);
            const episode = tidy(answer.json, { look, catalog, n, voices });
            // Проверка картинкой: библиотека говорит, что не так (неизвестная декорация, состояние, реплика, ракурс).
            if (check) await check(episode);
            episode.tokens = answer.tokens ?? null;
            episode.model = answer.model ?? null;
            return episode;
        } catch (error) {
            // «Стоп» — без второй попытки.
            if (error instanceof Cancelled || signal?.aborted) throw new Cancelled();
            // Нет «да» на связь с моделью или модели нет вовсе — второй попыткой не исправить: сказать сразу и прямо.
            if (/ждёт вашего «да»|waiting for your “yes”/.test(error.message)) {
                throw new Error(L('нужно ваше «да»: «Лента» хочет звать модель «Мозга» — ответьте «Разрешить» в пульте и нажмите «Далее» снова', 'your “yes” is needed: the Feed wants to call the Brain’s model — answer “Allow” in the panel and press “Next” again'));
            }
            if (/не выбрана|модели здесь нет|моделей здесь нет|no model is chosen|no .*model.* chosen/i.test(error.message)) {
                throw new Error(L('модель «Мозга» не выбрана: подключите её в настройках пульта («Мозг») и нажмите «Далее» снова', 'no Brain model is chosen: connect one in the panel’s settings (“Brain”) and press “Next” again'));
            }
            lastError = error.message;
            log('warn', `сценарий серии ${n}, попытка ${attempt}: ${error.message}`);
        }
    }
    throw new Error(L(`сценарий не получился дважды: ${lastError}`, `the script failed twice: ${lastError}`));
}
