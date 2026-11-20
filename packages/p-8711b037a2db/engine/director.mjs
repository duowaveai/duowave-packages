// «Режиссёр» (этап 7 плана): сильная модель для каждой серии пишет код картинки — свои декорации, свет, камеру —
// агентом Мозга (`system/brain` → `agent`) с файлами своей папки и инструментом приложения `feed_check_episode`
// (собрать серию и отрендерить три кадра — ответ текстом: собралось ли, что сломалось). Сама модель кадров не видит:
// слой моделей шлюза пока передаёт только текст. Сорвалось дважды — говорим и снимаем ту же серию обычным режимом.
//
// Тот же агент для своего Claude Code — сервер MCP шлюза приложений (этап 7): инструменты «Ленты» там те же.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { letter, log } from './host.mjs';
import { setCatalog } from './writer.mjs';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEPS = 30;
const MINUTES = 20;

function read(path, max = 24_000) {
    return existsSync(path) ? readFileSync(path, 'utf8').slice(0, max) : '';
}

/** Пример серии кодом для модели: из библиотеки пакета (remotion/examples/<id>/). */
function example() {
    const root = join(PACKAGE, 'remotion', 'examples');
    if (!existsSync(root)) return '';
    const id = readdirSync(root).sort()[0];
    if (!id) return '';
    return ['Episode.tsx', 'parts.tsx']
        .map((name) => {
            const text = read(join(root, id, name), 14_000);
            return text ? `### ${id}/${name}\n\n\`\`\`tsx\n${text}\n\`\`\`` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

export function instructions(lang) {
    return [
        'Ты — режиссёр «Ленты»: снимаешь одну серию вертикального мини-сериала (1080×1920, 30 кадров/с, 40–75 с) кодом Remotion.',
        'Твоя работа — файлы серии в папке приложения (пути — от её корня):',
        '- episodes/<id>/voice.<язык>.json — { "lang", "lines": [{ "id": "01", "text", "speak"? }] }, 8–12 реплик, 450–900 знаков;',
        '- episodes/<id>/episode.json — { "id", "series", "n", "title", "logline", "direction", "look", "lang", "mode": "code", "choice": { "q", "a": { "title", "price" }, "b": {…} }, "radio"?: [], "deep"?: [] };',
        '- episodes/<id>/code/Episode.tsx (и parts.tsx с мирами серии) — экспортирует `meta` ({ id, lang, pacing, choiceLine }) и `Episode`; библиотека — `@feed/lib/kit`, `@feed/lib/stage`, `@feed/lib/timeline`, `@feed/lib/episode`, декорации — `@feed/sets`.',
        'Времена — только от реплик (cues), не в секундах. Новый план каждые 3–6 с. Людей крупно не рисуй: силуэты, руки, предметы. Метку «ТВОЙ ВЫБОР» не рисуй — её ставит плеер.',
        'После файлов зови feed_check_episode { id }: он соберёт серию и отрендерит три кадра; ошибки — исправь и проверь снова. Закончил — ответь одной строкой, что снял.',
        '',
        '## Правила текста',
        '',
        read(join(PACKAGE, 'lang', lang, 'writing.md')) || read(join(PACKAGE, 'lang', 'ru', 'writing.md')),
        '',
        '## Библиотека',
        '',
        read(join(PACKAGE, 'remotion', 'README.md'), 16_000),
        '',
        '## Декорации',
        '',
        setCatalog()
            .map((set) => `- ${set.id} (${set.look}) — ${set.title}`)
            .join('\n'),
        '',
        '## Пример серии кодом',
        '',
        example(),
    ].join('\n');
}

/** Серия кодом от агента; ответ — что агент сказал, сколько шагов. Ошибка — если файлов серии нет. */
export async function directEpisode({ id, series, n, look, lang = 'ru', pitch, world, previous, taste, wish, after, model, signal }) {
    const task = [
        `Сними серию ${id}: сериал «${series.title}» (id ${series.id}), серия ${n}, облик ${look}, язык ${lang}.`,
        n === 1 ? `Завязка: ${pitch ?? 'выбери сам'}.` : `Мир сериала:\n${world ?? ''}\n\nПрошлые серии:\n${previous ?? ''}`,
        after ? `Эта серия идёт после развилки серии ${after.n}: ${after.q}. Покажи обе ветки: неверную до «КОНЕЦ», перемотку и верную.` : '',
        taste?.length ? `Вкус зрителя:\n${taste.join('\n')}` : '',
        wish ? `Пожелание: ${wish}` : '',
    ]
        .filter(Boolean)
        .join('\n\n');
    const answer = await letter('system/brain', 'agent', {
        task,
        system: instructions(lang),
        model: model ?? 'smart',
        tools: ['feed_check_episode'],
        maxSteps: STEPS,
        maxMinutes: MINUTES,
    }, signal);
    log('info', `режиссёр: ${answer.steps} шагов — ${String(answer.text ?? '').slice(0, 200)}`);
    return answer;
}

export const DIRECTOR_LIMITS = { steps: STEPS, minutes: MINUTES };
