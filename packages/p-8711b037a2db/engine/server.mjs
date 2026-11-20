// «Лента» — программа приложения на Node (runtime: node, docs/plans/feed.md). Шлюз запускает её своим Node и зовёт её
// функции как POST /call/<функция> с токеном: окно (contributes.panel.calls), карточку стола, фразы колонки и
// инструменты «Мозга». Долгое — снять серию, переозвучить, приготовить копию для отправки — идёт задачей шлюза:
// функция отвечает сразу id задачи, ход окно видит само.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { revoice, shoot } from './build.mjs';
import { APP, asTask, host, letter, log, settings } from './host.mjs';
import { bundleOnce, renderPicture } from './render.mjs';
import { postText, shareCard, shareCopy } from './share.mjs';
import { REASONS, apply, bytesOfVideos, currentSeries, episodesOf, findEpisode, folder, forget, load, slug, taste, update, view } from './state.mjs';
import { instructions } from './director.mjs';
import { castOf, mergeCast } from './cast.mjs';
import { L, english, refreshLocale } from './i18n.mjs';
import { gatewayVoices, voiceProviders } from './voice.mjs';
import { LOOK_IDS } from './writer.mjs';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
// Remotion ищет браузер рендера в node_modules/.remotion ближайшего package.json от рабочей папки: им будет пакет.
process.chdir(PACKAGE);
const SEASON = 7;
/**
 * Что идёт — по дорожкам: съёмка (снять, переозвучить, своя запись) и отправка (копия, карточка, Telegram, ссылка).
 * На дорожке — одна работа; две дорожки — сразу: прошлую серию можно отправить, пока снимается новая. Тяжёлое
 * рисование Remotion они делят по очереди (render.mjs).
 */
const lanes = { shoot: null, share: null };
/** Задачи дорожек: «стоп» голосом, из поля или «Стоп» останавливает их в ближайшей точке. */
const laneTasks = { shoot: null, share: null };
const laneOf = (kind) => (kind === 'share' ? 'share' : 'shoot');
/** Что идёт сейчас, съёмка первой: для слов «снимается» и карточки. */
const anyRunning = () => lanes.shoot ?? lanes.share;

/** Облики словами — на языке дома. */
const LOOK_TITLES = {
    ru: { ink: 'Тушь', riso: 'Ризограф', pixel: 'Пиксели', papercut: 'Бумага', glass: 'Витраж', ascii: 'Терминал' },
    en: { ink: 'Ink', riso: 'Riso', pixel: 'Pixels', papercut: 'Papercut', glass: 'Stained glass', ascii: 'Terminal' },
};
const lookTitle = (id) => (english() ? LOOK_TITLES.en : LOOK_TITLES.ru)[id] ?? id;

/** Причины «не нравится» — ключи данных (русские), словами — на языке дома. */
const REASON_TITLES = { скучно: 'boring', непонятно: 'confusing', страшно: 'too scary', голос: 'the voice', картинка: 'the picture', длинно: 'too long', 'не моё': 'not my thing' };
const reasonTitle = (key) => (english() ? REASON_TITLES[key] ?? key : key);

function stories(lang) {
    const file = join(PACKAGE, 'lang', lang, 'stories.json');
    const list = JSON.parse(readFileSync(existsSync(file) ? file : join(PACKAGE, 'lang', 'ru', 'stories.json'), 'utf8')).stories;
    return list.map((story) => ({ ...story, lookTitle: lookTitle(story.look), frame: `assets/looks/${story.look}.jpg` }));
}

/** Пульту — что данные поменялись: карточка стола и окно перечитают сами. */
function touched(what) {
    host('PUT', '/api/v1/apps/host/kv/changed', { what, at: Date.now() }).catch(() => {});
}

/**
 * Работа задачей с отметкой «идёт». Уже идёт другая — не ошибка: ответ `{ busy }` с её названием, окно скажет это
 * словами («Сейчас снимается серия — дождитесь или «Стоп»»), а не «HTTP 500».
 */
async function work(kind, title, text, job) {
    const lane = laneOf(kind);
    if (lanes[lane]) return { busy: lanes[lane].title, lane };
    // Дорожка занята сразу, ещё до ответа шлюза о задаче: второе нажатие в ту же секунду её не займёт.
    lanes[lane] = { kind, title, task: null, lane };
    try {
        return await asTask(title, text, async (task) => {
            lanes[lane] = { kind, title, task: task.id, lane };
            laneTasks[lane] = task;
            touched('started');
            try {
                return await job(task);
            } finally {
                lanes[lane] = null;
                laneTasks[lane] = null;
                touched('ended');
            }
        });
    } catch (error) {
        // Задача не началась (шлюз отказал): дорожка свободна.
        if (!laneTasks[lane]) lanes[lane] = null;
        throw error;
    }
}

/** Обложка последней серии наверху своей папки: её показывает карточка стола (деталь picture). */
function cover(state) {
    const last = [...state.episodes].reverse().find((episode) => episode.poster && existsSync(join(folder(), episode.poster)));
    if (!last) return null;
    try {
        copyFileSync(join(folder(), last.poster), join(folder(), 'cover.jpg'));
        return { last, name: 'cover.jpg' };
    } catch {
        return null;
    }
}


/** «Мир сериала» для окна: строки «Закон: …», «Ресурс: …» из series/<id>/world.md (до пяти), без строк серий. */
function worldOf(id) {
    const file = join(folder(), 'series', id, 'world.md');
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[^-–—#*][^:]{1,28}:\s*\S/.test(line))
        .slice(0, 5)
        .map((line) => {
            const at = line.indexOf(':');
            return { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
        });
}

/** Своя модель «Ленты»: null — «Умная» «Мозга», 'fast' — «Быстрая», {provider, model} — одна из моделей пульта. */
function modelPick(value) {
    if (value === 'fast') return 'fast';
    if (value && typeof value === 'object' && value.provider && value.model) return { provider: String(value.provider), model: String(value.model) };
    return null;
}

/** Название своей истории — из её первых слов: «история про кота, который ищет дом» → «Про кота, который ищет дом». */
function titleOf(pitch) {
    const words = String(pitch ?? '')
        .replace(/^\s*(история|сериал)\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6);
    const text = words.join(' ').replace(/[.,;:!?]+$/, '');
    if (!text) return L('Своя история', 'Your own story');
    return (text[0].toUpperCase() + text.slice(1)).slice(0, 40);
}

// ——— Команды словами: голосом колонки («Лента, дальше») и полем виджета — один разбор ———

export const help = () =>
    L(
        'Скажите «Лента» и что сделать: «дальше», «первый» или «второй», «нравится» или «не нравится, скучно», «режиссёр» или «обычно», «голос Денис», «второй голос Адам», «модель умная», «память включи», «храни 20 серий», «заранее», «к утру», «новая история про …», «в телеграм», «ссылка», «стоп», «что нового». Другие слова — пожелание к следующей серии.',
        'Say “Feed” and what to do: “next”, “first” or “second”, “like it” or “don’t like it, boring”, “director” or “normal”, “voice Denis”, “second voice Adam”, “model smart”, “memory on”, “keep 20 episodes”, “in advance”, “by morning”, “new story about …”, “to telegram”, “link”, “stop”, “what’s new”. Other words are a wish for the next episode.',
    );

/** Строка команды: строчными, ё как е, без знаков — как фразы колонки. */
export function plain(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const NUMBERS = { один: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, пятнадцать: 15, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, сто: 100, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const FILLER = new Set(['серию', 'серия', 'серии', 'следующую', 'новую', 'еще', 'пожалуйста', 'давай', 'но', 'и', 'а', 'только', 'ну', 'лента', 'ленту', 'в', 'ленте', 'модель', 'модели', 'мозг', 'мозга', 'поставь', 'выбери', 'сделай', 'episode', 'episodes', 'the', 'a', 'an', 'please', 'feed', 'model', 'brain', 'set', 'pick', 'make', 'and', 'but', 'just', 'to', 'in', 'next']);
const REASON_STEMS = [['скучн', 'скучно'], ['непонят', 'непонятно'], ['страш', 'страшно'], ['голос', 'голос'], ['картин', 'картинка'], ['длин', 'длинно'], ['долг', 'длинно'], ['мое', 'не моё'], ['boring', 'скучно'], ['dull', 'скучно'], ['confus', 'непонятно'], ['unclear', 'непонятно'], ['scar', 'страшно'], ['voice', 'голос'], ['pictur', 'картинка'], ['image', 'картинка'], ['long', 'длинно'], ['slow', 'длинно']];

function numberIn(words) {
    for (const word of words) {
        if (/^\d+$/.test(word)) return Number(word);
        if (NUMBERS[word]) return NUMBERS[word];
    }
    return null;
}

/** Слова после первого, без «серию», «пожалуйста»…: пожелание, если что-то осталось. */
function restOf(words, from = 1) {
    const rest = words.slice(from).filter((word) => !FILLER.has(word));
    return rest.length && rest.join(' ').length > 2 ? rest.join(' ') : '';
}

/** Последняя серия того сериала, что смотрим. */
function lastOf(state) {
    const series = currentSeries(state);
    return series ? episodesOf(state, series.id).at(-1) ?? null : null;
}

/** Готова ли «Лента» снимать: модель есть и «да» на связи дано. Нет — что сказать человеку. */
async function readiness(state) {
    try {
        const answer = await letter('system/brain', 'models');
        if (!answer?.ready && !state.model) return L('Модели пока нет: подключите её в пульте — «Персонаж», «Мозг», — или выберите в «Ленте» на главном экране.', 'No model yet: connect one in the panel — “Character”, “Brain” — or choose one in the Feed on the home screen.');
        return null;
    } catch (error) {
        const text = String(error.message ?? error);
        if (/«да»|разреш/i.test(text)) return L('Сначала разрешите «Ленте» модель и голос: на главном экране, в «Ленте», — «Разрешить».', 'First allow the Feed its model and voice: on the home screen, in the Feed — “Allow”.');
        return L(`Модель не ответила: ${text}.`, `The model did not answer: ${text}.`);
    }
}

/** Голос по имени из сказанного: «Денис», «ирина», «eleven rachel». */
async function voiceByName(name) {
    const list = (await calls.voices()).filter((one) => !one.problem);
    const wanted = plain(name);
    const found = wanted ? list.find((one) => plain(one.title ?? one.id).includes(wanted) || plain(one.id).includes(wanted) || wanted.includes(plain(one.title ?? one.id))) : null;
    return { list, found };
}

/** Голос для начала голосом: прежний, если он есть на компьютере, иначе первый, который можно публиковать. */
async function someVoice(state) {
    const list = (await calls.voices().catch(() => [])).filter((one) => !one.problem);
    return list.find((one) => one.id === state.voice?.id) ?? list.find((one) => one.kind === 'computer' && one.publish) ?? list[0] ?? null;
}

export const calls = {
    /**
     * ElevenLabs для окна настроек: подключён ли он в шлюзе, его голоса и сколько знаков осталось на тарифе. Ключ
     * «Лента» не хранит и не видит: он в сейфе шлюза, вставляется в пульте («Голос» → «Облачные голоса»).
     */
    async eleven() {
        const providers = await voiceProviders({ balance: true }).catch((error) => ({ problem: error.message }));
        if (!Array.isArray(providers)) return { connected: false, problem: providers.problem };
        const card = providers.find((one) => one.id === 'elevenlabs');
        if (!card?.ready) return { connected: false, problem: L('ключ ElevenLabs теперь вставляется в пульте: «Голос» → «Облачные голоса»', 'the ElevenLabs key is now pasted in the panel: “Voice” → “Cloud voices”') };
        const voices = await gatewayVoices().catch((error) => ({ problem: error.message }));
        if (!Array.isArray(voices)) return { connected: true, problem: voices.problem };
        return { connected: true, voices: voices.filter((voice) => voice.kind === 'elevenlabs'), balance: card.balance ?? null, problem: card.problem };
    },

    /** Модели пульта на выбор «Ленте» и какая выбрана: письмо `system/brain` → `models`. */
    async models() {
        const state = load();
        try {
            const answer = await letter('system/brain', 'models');
            return { ...answer, pick: state.model };
        } catch (error) {
            return { models: [], fast: null, smart: null, ready: false, pick: state.model, problem: String(error.message ?? error) };
        }
    },

    /** Остановить то, что идёт: дорожку `lane` (shoot, share), без неё — съёмку, а нет её — отправку. */
    async cancel({ lane } = {}) {
        const which = lane && laneTasks[lane] ? lane : laneTasks.shoot ? 'shoot' : laneTasks.share ? 'share' : null;
        if (!which) return { say: L('Сейчас ничего не идёт.', 'Nothing is running now.') };
        const title = lanes[which]?.title ?? L('работу', 'the work');
        laneTasks[which].stop();
        return { say: L(`Останавливаю: ${String(title).toLowerCase()}.`, `Stopping: ${String(title).toLowerCase()}.`), did: 'cancel' };
    },

    /**
     * Команда словами — голосом колонки («Лента, дальше») или полем виджета: тот же разбор. Ответ — что сказать
     * человеку (`say`) и что сделано (`did`). Что не команда — пожелание к следующей серии.
     */
    async command({ text, id } = {}) {
        const said = plain(text);
        const words = said.split(' ').filter(Boolean);
        const has = (...stems) => words.some((word) => stems.some((stem) => word.startsWith(stem)));
        const first = (...stems) => words.length > 0 && stems.some((stem) => words[0].startsWith(stem));
        const off = () => has('выключ', 'отключ', 'нет', 'убер', 'без', 'забудь', 'off', 'disabl', 'without', 'forget') || words.includes('не') || words.includes('no');
        const busy = (lane = 'shoot') => (lanes[lane] ? { say: L(`Подождите: ${String(lanes[lane].title).toLowerCase()} ещё идёт. Скажите «стоп», чтобы остановить.`, `Wait: ${String(lanes[lane].title).toLowerCase()} is still going. Say “stop” to stop it.`) } : null);
        const state = load();
        const episode = (id && state.episodes.find((one) => one.id === id)) || lastOf(state);

        if (!said) {
            const now = await calls.whatsNew();
            return { say: `${now.say} ${state.introduced ? L('Скажите «дальше», «первый» или «второй».', 'Say “next”, “first” or “second”.') : ''}`.trim() };
        }
        if (first('помощ', 'команд', 'умеешь', 'справк', 'help', 'command') || said === 'что можно' || said === 'что ты умеешь' || said.startsWith('what can')) return { say: help() };
        if (first('стоп', 'хватит', 'отмен', 'останов', 'прекрат', 'stop', 'cancel', 'enough', 'halt')) return calls.cancel();
        if (said.startsWith('что нов') || said.startsWith('что там') || said.startsWith('что в ленте') || first('расскаж', 'статус', 'status', 'tell') || said.startsWith('о чем') || /^what( s| is)? new|^whats new|^what s in/.test(said)) return calls.whatsNew();

        // Своя или другая история: «новая история про кота», «про кота», «другой сериал».
        if ((first('нов', 'друг', 'new', 'another') && has('истор', 'сериал', 'story', 'series')) || ['про', 'об', 'about'].includes(words[0]) || (first('истор', 'story') && words.length > 1)) {
            const at = words.findIndex((word) => ['про', 'о', 'об', 'about'].includes(word));
            const own = at >= 0 ? words.slice(at).join(' ') : first('истор', 'story') ? words.slice(1).join(' ') : '';
            const wait = busy();
            if (wait) return wait;
            const problem = await readiness(state);
            if (problem) return { say: problem };
            const voice = state.introduced ? state.voice : await someVoice(state);
            await calls.intro({ own, any: !own, mode: state.mode, voice, keep: state.keep, lang: state.lang });
            const fresh = currentSeries(load());
            return { say: L(`${state.introduced ? 'Новый сериал' : 'Начинаю сериал'} «${fresh?.title ?? titleOf(own)}»: первая серия будет через пару минут.`, `${state.introduced ? 'New series' : 'Starting the series'} “${fresh?.title ?? titleOf(own)}”: the first episode comes in a couple of minutes.`), did: 'story' };
        }

        // Развилка: «первый», «выбираю второй», «вариант два».
        if (first('выбир', 'выбер', 'выбор', 'вариант', 'перв', 'втор', 'choos', 'pick', 'option', 'first', 'second') && !has('голос', 'voice') || ['один', 'два', '1', '2', 'one', 'two'].includes(words[0])) {
            const value = has('втор', 'два', '2', 'second', 'two') ? 'b' : has('перв', 'один', '1', 'first', 'one') ? 'a' : null;
            const fork = episode?.choice ? episode : [...state.episodes].reverse().find((one) => one.choice && one.series === state.current);
            if (!fork) return { say: L('Развилки пока нет.', 'No fork yet.') };
            if (!value) return { say: L(`Первый — ${fork.choice.a.title.toLowerCase()}, или второй — ${fork.choice.b.title.toLowerCase()}?`, `First — ${fork.choice.a.title.toLowerCase()}, or second — ${fork.choice.b.title.toLowerCase()}?`) };
            const answer = await calls.choose({ id: fork.id, value });
            const title = value === 'a' ? fork.choice.a.title : fork.choice.b.title;
            return { say: answer.ahead ? L(`Выбрано: ${title}. Снимаю следующую серию.`, `Chosen: ${title}. Shooting the next episode.`) : L(`Выбрано: ${title}. Скажите «дальше» — сниму продолжение.`, `Chosen: ${title}. Say “next” and I’ll shoot what comes after.`), did: 'choose' };
        }

        // Оценка: «нравится», «не нравится, скучно».
        if (has('нрав', 'понрав', 'класс', 'супер', 'круто', 'отличн', 'лайк', 'дизлайк', 'плох', 'скучн', 'like', 'love', 'great', 'cool', 'awesome', 'bad', 'boring', 'dislik', 'hate')) {
            if (!episode) return { say: L('Серий пока нет — оценивать нечего.', 'No episodes yet — nothing to rate.') };
            const bad = words.includes('не') || words.includes('not') || words.includes('don') || words.includes('dont') || has('плох', 'дизлайк', 'скучн', 'bad', 'dislik', 'boring', 'hate');
            if (!bad) {
                await calls.rate({ id: episode.id, value: 'like' });
                return { say: L('Записал: нравится. Буду снимать в том же духе.', 'Noted: you like it. I’ll keep shooting in the same spirit.'), did: 'rate' };
            }
            const reasons = [...new Set(REASON_STEMS.filter(([stem]) => has(stem)).map(([, reason]) => reason))];
            await calls.rate({ id: episode.id, value: 'dislike', reasons });
            return { say: reasons.length ? L(`Записал: не нравится — ${reasons.join(', ')}. Учту в следующей серии.`, `Noted: you don’t like it — ${reasons.map(reasonTitle).join(', ')}. I’ll take it into account in the next episode.`) : L('Записал: не нравится. Что не так — скучно, непонятно, голос, картинка?', 'Noted: you don’t like it. What’s wrong — boring, confusing, the voice, the picture?'), did: 'rate' };
        }

        // Своя модель: «модель умная», «быстрая модель», «модель gpt 5».
        if (has('модел', 'model') || first('мозг', 'brain')) {
            const name = restOf(words, 0);
            if (!name) {
                const pick = state.model;
                return { say: L(`Пишет ${pick === 'fast' ? '«Быстрая» модель «Мозга»' : pick?.model ? pick.model : '«Умная» модель «Мозга»'}. Скажите «модель быстрая», «модель умная» или имя модели.`, `Writing: ${pick === 'fast' ? 'the Brain’s “Fast” model' : pick?.model ? pick.model : 'the Brain’s “Smart” model'}. Say “model fast”, “model smart” or a model’s name.`) };
            }
            if (has('умн', 'обычн', 'как', 'smart', 'default', 'usual')) {
                await calls.configure({ model: null });
                return { say: L('Пишет «Умная» модель «Мозга».', 'The Brain’s “Smart” model writes.'), did: 'model' };
            }
            if (has('быстр', 'fast', 'quick')) {
                await calls.configure({ model: 'fast' });
                return { say: L('Пишет «Быстрая» модель «Мозга»: быстрее, но проще.', 'The Brain’s “Fast” model writes: quicker, but simpler.'), did: 'model' };
            }
            const squash = (value) => plain(value).replace(/[\s._-]+/g, '');
            const list = await calls.models();
            const found = (list.models ?? []).find((one) => squash(one.model).includes(squash(name)) || squash(`${one.title}${one.model}`).includes(squash(name)));
            if (!found) return { say: L(`Не нашёл модель «${name}». ${list.models?.length ? `Есть: ${list.models.slice(0, 4).map((one) => one.model).join(', ')}.` : 'Моделей пока нет: подключите её в пульте — «Персонаж», «Мозг».'}`, `No model “${name}”. ${list.models?.length ? `There are: ${list.models.slice(0, 4).map((one) => one.model).join(', ')}.` : 'No models yet: connect one in the panel — “Character”, “Brain”.'}`) };
            await calls.configure({ model: { provider: found.provider, model: found.model } });
            return { say: L(`Пишет ${found.model}${found.cloud ? ', в облаке' : ', на этом компьютере'}.`, `${found.model} writes${found.cloud ? ', in the cloud' : ', on this computer'}.`), did: 'model' };
        }

        // Как снимать.
        if (has('режисс', 'director')) {
            await calls.configure({ mode: 'director' });
            return { say: L('Режим «Режиссёр»: у каждой серии своя картинка, снимается 10–25 минут.', '“Director” mode: each episode gets its own picture, shooting takes 10–25 minutes.'), did: 'mode' };
        }
        if (first('обычн', 'прост', 'normal', 'simple', 'usual')) {
            await calls.configure({ mode: 'data' });
            return { say: L('Режим «Обычно»: серия за пару минут.', '“Normal” mode: an episode in a couple of minutes.'), did: 'mode' };
        }

        // Состав голосов сериала: «второй голос Адам», «голос рации Адам», «голос рассказчика Денис», «голос Спасателя
        // Рэйчел» (персонаж из состава); просто «голос Денис» — голос «Ленты» и рассказчик сериала.
        if (first('голос', 'озвуч', 'втор', 'voice', 'second', 'narrator', 'radio', 'phone', 'threat') && has('голос', 'voice')) {
            const series = currentSeries(state);
            const characters = Object.keys(series?.cast?.characters ?? {});
            const after = words.slice(words.findIndex((word) => word.startsWith('голос') || word.startsWith('voice')) + 1).filter((word) => !['of', 'the', 'for'].includes(word));
            let role = 'narrator';
            let rest = after;
            if (first('втор', 'second', 'radio', 'phone', 'threat') || ['рации', 'рация', 'телефона', 'угрозы', 'второго', 'radio', 'phone', 'threat'].includes(after[0])) {
                role = 'second';
                rest = first('втор', 'second', 'radio', 'phone', 'threat') ? after : after.slice(1);
            } else if (first('narrator')) {
                rest = after;
            } else if (['рассказчика', 'диктора', 'автора', 'narrator'].includes(after[0])) {
                rest = after.slice(1);
            } else {
                const character = characters.find((name) => after[0] && plain(name).split(' ')[0].startsWith(after[0].slice(0, Math.max(3, after[0].length - 2))));
                if (character) {
                    role = `character:${character}`;
                    rest = after.slice(1);
                }
            }
            const { list, found } = await voiceByName(rest.join(' '));
            if (!found) return { say: list.length ? L(`Какой голос? Есть: ${list.slice(0, 5).map((one) => one.title ?? one.id).join(', ')}.`, `Which voice? There are: ${list.slice(0, 5).map((one) => one.title ?? one.id).join(', ')}.`) : L('Голосов на компьютере пока нет: поставьте голос в пульте — «Персонаж», «Голос».', 'No voices on the computer yet: install one in the panel — “Character”, “Voice”.') };
            const licence = found.publish ? '' : L(': только для себя, публиковать с ним нельзя', ': for yourself only, it may not be published');
            if (role === 'narrator') {
                await calls.configure({ voice: found });
                if (series) await calls.cast({ role: 'narrator', voice: found });
                return { say: L(`Голос — ${found.title ?? found.id}${licence}.`, `Voice — ${found.title ?? found.id}${licence}.`), did: 'voice' };
            }
            if (!series) return { say: L('Сначала начните сериал: состав голосов — у сериала.', 'Start a series first: the voices belong to a series.') };
            await calls.cast({ role, voice: found });
            const who = role === 'second' ? L('Второй голос', 'Second voice') : L(`Голос «${role.slice(10)}»`, `The voice of “${role.slice(10)}”`);
            return { say: L(`${who} — ${found.title ?? found.id}${licence}. Со следующей серии.`, `${who} — ${found.title ?? found.id}${licence}. From the next episode.`), did: 'cast' };
        }

        // Память, хранение, заранее, к утру.
        if (has('памят', 'memory')) {
            const on = !off();
            await calls.configure({ memory: on });
            return { say: on ? L('Учитываю интересы из памяти дома. Первый раз шлюз спросит у вас «да».', 'Taking the household’s interests from memory. The first time, the gateway will ask for your “yes”.') : L('Память выключена: только оценки и пожелания здесь.', 'Memory is off: only the ratings and wishes here.'), did: 'memory' };
        }
        if (has('хран', 'keep', 'store')) {
            const keep = numberIn(words);
            if (!keep) return { say: L(`Храню ${state.keep} последних серий роликами. Скажите, сколько хранить.`, `Keeping the last ${state.keep} episodes as videos. Say how many to keep.`) };
            const status = await calls.configure({ keep });
            return { say: L(`Храню ${status.keep} последних серий роликами, у старых — только текст.`, `Keeping the last ${status.keep} episodes as videos, the older ones as text only.`), did: 'keep' };
        }
        if (has('заранее', 'advance', 'ahead')) {
            const on = !off();
            await calls.configure({ ahead: on });
            return { say: on ? L('Сразу после выбора сниму следующую серию.', 'Right after your choice I’ll shoot the next episode.') : L('Следующую серию — только по «дальше».', 'The next episode only on “next”.'), did: 'ahead' };
        }
        if (has('утр', 'ноч', 'morning', 'night')) {
            const on = !off();
            await calls.configure({ night: on });
            return { say: on ? L('Ночью сниму серию к утру, если вы выбрали развилку.', 'At night I’ll shoot an episode for the morning if you chose at the fork.') : L('Ночью не снимаю.', 'No shooting at night.'), did: 'night' };
        }

        // Не начата: «начни», «дальше» — начать; остальное — подсказка.
        if (!state.introduced) {
            if (first('начн', 'начат', 'включ', 'запуст', 'старт', 'поехал', 'давай', 'дальш', 'сним', 'start', 'begin', 'go', 'next', 'shoot', 'play')) {
                const problem = await readiness(state);
                if (problem) return { say: problem };
                const voice = await someVoice(state);
                await calls.intro({ any: true, voice, lang: state.lang });
                const fresh = currentSeries(load());
                return { say: L(`Начинаю сериал «${fresh?.title ?? 'Лента'}»: первая серия будет через пару минут.`, `Starting the series “${fresh?.title ?? 'Feed'}”: the first episode comes in a couple of minutes.`), did: 'start' };
            }
            return { say: L('Лента ещё не начата. Скажите «Лента, начни» — или «Лента, история про…» со своей завязкой.', 'The Feed has not started yet. Say “Feed, start” — or “Feed, a story about…” with your own premise.') };
        }

        // Поделиться.
        if (has('телеграм', 'telegram')) {
            if (!episode) return { say: L('Серий пока нет.', 'No episodes yet.') };
            const wait = busy('share');
            if (wait) return wait;
            await calls.publishTelegram({ id: episode.id });
            return { say: L(`Готовлю серию ${episode.n} для Telegram — скажу, когда уйдёт.`, `Preparing episode ${episode.n} for Telegram — I’ll say when it’s sent.`), did: 'share' };
        }
        if (has('ссылк', 'link')) {
            if (!episode) return { say: L('Серий пока нет.', 'No episodes yet.') };
            const wait = busy('share');
            if (wait) return wait;
            await calls.watchLink({ id: episode.id });
            return { say: L('Готовлю ссылку «смотри и выбирай» — она появится в «Ленте».', 'Preparing the “watch and choose” link — it will appear in the Feed.'), did: 'share' };
        }

        // Сезон, сериалы, забыть.
        if (has('сезон', 'season')) {
            const wait = busy();
            if (wait) return wait;
            await calls.season({ action: 'second' });
            return { say: L('Второй сезон: снимаю.', 'Season two: shooting.'), did: 'next' };
        }
        if (first('сериал', 'переключ', 'смотр', 'вернись', 'верни', 'series', 'switch', 'watch', 'back')) {
            const name = restOf(words);
            const found = name ? state.series.find((one) => plain(one.title).includes(name) || name.includes(plain(one.title))) : null;
            if (!found) return { say: L(`Какой сериал? ${state.series.map((one) => `«${one.title}»`).join(', ')}.`, `Which series? ${state.series.map((one) => `“${one.title}”`).join(', ')}.`) };
            await calls.switchSeries({ id: found.id });
            return { say: L(`Смотрим «${found.title}».`, `Watching “${found.title}”.`), did: 'series' };
        }
        if (first('забуд', 'забыть', 'forget')) {
            const what = has('оцен', 'rating') ? 'ratings' : has('пожелан', 'wish') ? 'wishes' : 'all';
            await calls.forget({ what });
            return { say: what === 'ratings' ? L('Забыл оценки.', 'Ratings forgotten.') : what === 'wishes' ? L('Забыл пожелания.', 'Wishes forgotten.') : L('Забыл всё о вашем вкусе.', 'Forgot everything about your taste.'), did: 'forget' };
        }

        // Дальше: «дальше», «сними серию», «дальше, но мрачнее».
        if (first('дальш', 'далее', 'следующ', 'сним', 'продолж', 'еще', 'вперед', 'начн', 'включ', 'давай', 'next', 'continue', 'shoot', 'more', 'go', 'start')) {
            const wait = busy();
            if (wait) return wait;
            const last = lastOf(state);
            if (last?.choice && !last.chosen) return { say: L(`Сначала выберите: первый — ${last.choice.a.title.toLowerCase()}, или второй — ${last.choice.b.title.toLowerCase()}.`, `Choose first: first — ${last.choice.a.title.toLowerCase()}, or second — ${last.choice.b.title.toLowerCase()}.`) };
            const problem = await readiness(state);
            if (problem) return { say: problem };
            const wish = restOf(words);
            await calls.next({ wish: wish || undefined });
            return { say: wish ? L(`Снимаю следующую серию — учту: ${wish}.`, `Shooting the next episode — with your wish: ${wish}.`) : L('Снимаю следующую серию. Скажу, когда будет готова.', 'Shooting the next episode. I’ll say when it’s ready.'), did: 'next' };
        }

        // Остальное — пожелание к следующей серии.
        update((fresh) => apply(fresh, { type: 'wish', id: episode?.id, value: String(text ?? '').trim() }));
        touched('wish');
        return { say: L('Учту в следующей серии. Скажите «дальше» — сниму.', 'I’ll take it into account in the next episode. Say “next” and I’ll shoot it.'), did: 'wish' };
    },

    /** Всё, что окну нужно, одним ответом. */
    async status() {
        const state = load();
        const series = currentSeries(state);
        // Подключён ли ElevenLabs в шлюзе (сам ключ «Ленте» не виден): тогда окно предлагает его голоса.
        const providers = await voiceProviders().catch(() => []);
        return {
            keys: { elevenlabs: providers.some((one) => one.id === 'elevenlabs' && one.ready) },
            introduced: state.introduced,
            lang: state.lang,
            mode: state.mode,
            voice: state.voice,
            keep: state.keep,
            memory: state.memory,
            ahead: state.ahead,
            night: state.night,
            lastModel: state.lastModel,
            model: state.model,
            videoBytes: bytesOfVideos(state),
            budget: state.budget,
            series: state.series.map((one) => ({ ...one, episodes: episodesOf(state, one.id).length })),
            current: series?.id ?? null,
            world: series ? worldOf(series.id) : [],
            episodes: state.episodes.map(view).sort((a, b) => (a.builtAt ?? '').localeCompare(b.builtAt ?? '')),
            seasonEnd: series ? episodesOf(state, series.id).length % SEASON === 0 && episodesOf(state, series.id).length > 0 : false,
            running: anyRunning(),
            lanes: { shoot: lanes.shoot, share: lanes.share },
            reasons: REASONS,
            // Причины словами на языке дома: окно показывает их, а шлёт ключи.
            reasonTitles: Object.fromEntries(REASONS.map((key) => [key, reasonTitle(key)])),
            taste: taste(state),
            looks: LOOK_IDS.map((id) => ({ id, title: lookTitle(id), frame: `assets/looks/${id}.jpg` })),
        };
    },

    /**
     * Состав голосов сериала (cast.mjs): `role` — `narrator`, `second` или `character:<Имя>`; `voice` — голос шлюза,
     * `null` убирает персонажа или второй голос (тогда — пара рассказчика). Ответ — состав сериала.
     */
    async cast({ series: seriesId, role, voice } = {}) {
        const state = load();
        const series = (seriesId && state.series.find((one) => one.id === seriesId)) || currentSeries(state);
        if (!series) throw new Error(L('сериала ещё нет', 'there is no series yet'));
        const change =
            role === 'narrator' ? { narrator: voice } : role === 'second' ? { second: voice ?? null } : String(role ?? '').startsWith('character:') ? { characters: { [String(role).slice(10).trim().slice(0, 40)]: voice ?? null } } : null;
        if (!change || (role === 'narrator' && !voice?.id)) throw new Error(L('роль: narrator, second или character:<Имя>, голос — из списка', 'role: narrator, second or character:<Name>, the voice from the list'));
        update((fresh) => {
            const own = fresh.series.find((one) => one.id === series.id);
            if (own) own.cast = mergeCast(own.cast, change);
        });
        const after = load().series.find((one) => one.id === series.id);
        return { series: series.id, cast: castOf(after, load().voice) };
    },

    /** Три истории на выбор в знакомстве (из шести языкового пакета). */
    async stories({ lang } = {}) {
        const state = load();
        const all = stories(lang ?? state.lang);
        const used = new Set(state.series.map((one) => one.story));
        return all.filter((story) => !used.has(story.id)).sort(() => Math.random() - 0.5).slice(0, 3);
    },

    /**
     * Голоса на выбор — все, что даёт шлюз (`system/voice` → `voices`): компьютера и облачные (ElevenLabs по ключу в
     * пульте), каждый с лицензией и меткой «можно публиковать». Кто озвучивает — решает шлюз по голосу.
     */
    async voices() {
        try {
            return await gatewayVoices();
        } catch (error) {
            return [{ problem: L(`голоса: ${error.message}`, `voices: ${error.message}`) }];
        }
    },

    /** Голос читает начало истории (третий экран знакомства): файл в своей папке для useMedia. */
    async sample({ voice, text }) {
        if (!voice?.id || voice.kind !== 'computer') return { file: null };
        const name = `samples/${voice.id.replace(/[^a-z0-9]+/gi, '-')}.wav`;
        // Нет начала истории — фраза на языке дома.
        const said = String(text ?? '').trim() || L('Серия начинается. Что будет дальше — выбираете вы.', 'The episode begins. What happens next is your choice.');
        await letter('system/voice', 'synth', { text: said.slice(0, 300), voice: voice.id, to: name, lang: english() ? 'en' : 'ru' });
        return { file: name };
    },

    /**
     * Знакомство пройдено: режим, история, голос, модель, память, сколько хранить — и сразу первая серия. Без истории
     * («Лента, начни» голосом) — одна из ещё не снятых.
     */
    async intro({ mode, story, own, voice, keep, lang, model, memory, any }) {
        // Пока идёт другая работа, новый сериал не начинается: иначе он появился бы без первой серии.
        if (lanes.shoot) return { busy: lanes.shoot.title, lane: 'shoot' };
        const all = stories(lang ?? 'ru');
        const used = new Set(load().series.map((one) => one.story));
        const picked = all.find((one) => one.id === story) ?? (any && !String(own ?? '').trim() ? all.find((one) => !used.has(one.id)) ?? all[0] : undefined);
        const pitch = String(own ?? '').trim() || picked?.pitch;
        if (!pitch) throw new Error(L('выберите историю или напишите свою', 'choose a story or write your own'));
        update((state) => {
            state.introduced = true;
            state.lang = lang === 'en' ? 'en' : 'ru';
            if (mode) state.mode = mode === 'director' ? 'director' : 'data';
            if (voice?.id) state.voice = { id: voice.id, kind: voice.kind ?? 'computer', title: voice.title ?? voice.id, license: voice.license ?? null, publish: voice.publish !== false };
            if (model !== undefined) state.model = modelPick(model);
            if (typeof memory === 'boolean') state.memory = memory;
            if (Number.isFinite(Number(keep)) && keep !== null && keep !== undefined) state.keep = Math.max(3, Math.min(200, Number(keep)));
            const title = picked && !String(own ?? '').trim() ? picked.title : titleOf(pitch);
            const id = slug(title, state.series.map((one) => one.id));
            state.series.push({ id, title, story: picked?.id ?? null, pitch, look: picked?.look ?? 'glass', direction: picked?.genre ?? '', startedAt: new Date().toISOString() });
            state.current = id;
        });
        return calls.next({});
    },

    /** «Далее»: снять следующую серию. */
    async next({ wish } = {}) {
        if (lanes.shoot) return { busy: lanes.shoot.title, lane: 'shoot' };
        const state = load();
        if (!state.introduced || !currentSeries(state)) throw new Error(L('сначала знакомство', 'the introduction first'));
        if (wish) update((fresh) => apply(fresh, { type: 'wish', value: String(wish) }));
        return work('shoot', L('Снять серию', 'Shoot an episode'), L('Пишу серию', 'Writing the episode'), (task) => shoot(task, { wish }));
    },

    async rate({ id, value, reasons, note }) {
        update((state) => apply(state, { type: 'rate', id, value, reasons, note }));
        touched('rate');
        return { ok: true };
    },

    async choose({ id, value }) {
        const state = update((fresh) => {
            apply(fresh, { type: 'choose', id, value });
            return fresh;
        });
        touched('choose');
        // Заранее: выбор на последней развилке — и следующая серия уже снимается.
        const series = currentSeries(state);
        const last = series ? episodesOf(state, series.id).at(-1) : null;
        if (state.ahead && last?.id === id && !lanes.shoot) {
            calls.next({}).catch((error) => log('warn', `заранее: ${error.message}`));
            return { ok: true, ahead: true };
        }
        return { ok: true };
    },

    /** Ритм «Серия к утру»: ночью снять следующую, если последнюю посмотрели и выбрали. */
    async night() {
        const state = load();
        const series = currentSeries(state);
        const last = series ? episodesOf(state, series.id).at(-1) : null;
        if (!state.night || lanes.shoot || !last || (last.choice && !last.chosen)) return null;
        await calls.next({});
        return null;
    },

    async wish({ text, id }) {
        update((state) => apply(state, { type: 'wish', id, value: String(text ?? '') }));
        return { ok: true };
    },

    /** «Что лента о вас знает» и «Забыть». */
    async taste() {
        const state = load();
        return { lines: taste(state), ratings: state.episodes.filter((one) => one.rating).length, wishes: state.events.filter((one) => one.type === 'wish').length };
    },

    async forget({ what }) {
        update((state) => forget(state, what === 'wishes' || what === 'ratings' ? what : 'all'));
        return calls.taste();
    },

    /** Настройки окна: режим, голос, сколько хранить, язык. */
    async configure({ mode, voice, keep, lang, memory, ahead, night, model }) {
        update((state) => {
            if (model !== undefined) state.model = modelPick(model);
            if (typeof memory === 'boolean') state.memory = memory;
            if (typeof ahead === 'boolean') state.ahead = ahead;
            if (typeof night === 'boolean') state.night = night;
            if (mode) state.mode = mode === 'director' ? 'director' : 'data';
            if (voice?.id) state.voice = { id: voice.id, kind: voice.kind ?? 'computer', title: voice.title ?? voice.id, license: voice.license ?? null, publish: voice.publish !== false };
            if (keep !== undefined) state.keep = Math.max(3, Math.min(200, Number(keep) || 30));
            if (lang) state.lang = lang === 'en' ? 'en' : 'ru';
        });
        return calls.status();
    },

    /** Конец сезона: «Второй сезон» — тот же сериал дальше; «Другая история» — снова выбор истории. */
    async season({ action }) {
        if (action === 'other') {
            update((state) => {
                state.current = null;
            });
            return { pick: true };
        }
        return calls.next({});
    },

    /** Сменить сериал на один из начатых. */
    async switchSeries({ id }) {
        update((state) => {
            if (!state.series.some((one) => one.id === id)) throw new Error(L(`нет сериала ${id}`, `no series ${id}`));
            state.current = id;
        });
        return calls.status();
    },

    /** Новая история после «Другая история»: тот же режим и голос. */
    async newStory({ story, own }) {
        const state = load();
        return calls.intro({ mode: state.mode, story, own, voice: state.voice, keep: state.keep, lang: state.lang });
    },

    /** Копия для отправки — задачей с настоящими процентами; готовая сегодня — сразу. */
    async prepareShare({ id, kind }) {
        const episode = findEpisode(load(), id);
        // В ответе задачи — и чья это серия: окно, что ждёт двух задач сразу, знает, к какой серии текст поста.
        if (kind === 'card') return work('share', L('Карточка серии', 'Episode card'), L('Рисую карточку', 'Drawing the card'), async (task) => ({ id, file: await shareCard(episode, { progress: (share, text) => task.tick(share * 100, text) }) }));
        return work('share', L('Файл для отправки', 'File to send'), L('Готовим файл к отправке', 'Preparing the file to send'), async (task) => ({
            id,
            file: await shareCopy(episode, { progress: (share, text) => task.tick(share * 100, text), cancelled: () => task.cancelled }),
        }));
    },

    /** Опубликовать в Telegram ботом шлюза (канал из настроек или «Оповещения»): копия со знаком — и отправка. */
    async publishTelegram({ id, to }) {
        const state = load();
        const episode = findEpisode(state, id);
        const options = await settings();
        const target = String(to ?? options.telegramChannel ?? '').trim();
        return work('share', L('Публикация в Telegram', 'Publishing to Telegram'), L('Готовим файл к отправке', 'Preparing the file to send'), async (task) => {
            const file = await shareCopy(episode, { progress: (share, text) => task.tick(share * 90, text), cancelled: () => task.cancelled });
            await task.step(92, L('Отправляю в Telegram', 'Sending to Telegram'));
            await letter('system/publish', 'telegram', { file, caption: postText(episode, state.lang), ...(target ? { to: target } : {}) });
            return { id, sent: true, to: target || L('Оповещения', 'Alerts') };
        });
    },

    /** Ссылка «смотри и выбирай»: страница на шлюзе с копией серии и развилкой; голоса придут сюда (vote). */
    async watchLink({ id }) {
        const episode = findEpisode(load(), id);
        return work('share', L('Ссылка «смотри и выбирай»', '“Watch and choose” link'), L('Готовим файл', 'Preparing the file'), async (task) => {
            const file = await shareCopy(episode, { progress: (share, text) => task.tick(share * 95, text), cancelled: () => task.cancelled });
            const page = await letter('system/publish', 'watch', {
                file,
                id: episode.id,
                title: L(`${episode.title} — серия ${episode.n}`, `${episode.title} — episode ${episode.n}`),
                q: episode.choice?.q,
                a: episode.choice?.a?.title,
                b: episode.choice?.b?.title,
            });
            update((state) => {
                const own = state.episodes.find((one) => one.id === id);
                if (own) own.watch = { path: page.path, at: new Date().toISOString() };
            });
            return { id, path: page.path };
        });
    },

    /** Голос со страницы «смотри и выбирай»: счёт у серии. */
    async vote({ id, votes }) {
        if (!id || !Array.isArray(votes)) return null;
        update((state) => {
            const own = state.episodes.find((one) => one.id === id);
            if (own) own.publicVotes = { a: Number(votes[0]) || 0, b: Number(votes[1]) || 0 };
        });
        touched('vote');
        return null;
    },

    /** Текст к посту — со строкой о голосе. */
    async shareText({ id }) {
        const state = load();
        return { text: postText(findEpisode(state, id), state.lang) };
    },

    /** Что человек выбрал, когда голос «только для себя»: журнал помнит. */
    async shareChoice({ id, choice }) {
        log('info', `отправка серии ${id} с голосом «только для себя»: ${choice}`);
        return { ok: true };
    },

    /** Переозвучить серию голосом, который можно публиковать. */
    async revoice({ id, voice }) {
        if (!voice?.id) throw new Error(L('какой голос?', 'which voice?'));
        return work('revoice', L('Переозвучить серию', 'Re-voice the episode'), L('Переозвучиваю', 'Re-voicing'), (task) => revoice(task, { id, voice: { publish: true, ...voice } }));
    },

    /** Свой голос: записи реплик из окна (record()) — в серию. */
    async ownVoice({ id, files }) {
        if (!files || typeof files !== 'object') throw new Error(L('нет записей', 'no recordings'));
        const voice = { id: 'own', kind: 'recording', title: L('Свой голос', 'Your own voice'), license: L('свой', 'your own'), publish: true, files };
        return work('revoice', L('Свой голос в серии', 'Your voice in the episode'), L('Ставлю вашу запись', 'Putting in your recording'), (task) => revoice(task, { id, voice }));
    },

    /** Реплики серии — окну записи своим голосом. */
    async lines({ id }) {
        const state = load();
        const episode = findEpisode(state, id);
        const file = join(folder(), 'episodes', id, `voice.${episode.lang ?? state.lang}.json`);
        return { lines: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).lines : [] };
    },

    /** Карточка стола (cards.md): кадр последней серии, ход съёмки, «Снять следующую». */
    async card() {
        const state = load();
        if (!state.introduced) return { cap: L('Лента', 'Feed'), empty: L('Откройте «Ленту», чтобы выбрать историю', 'Open the Feed to choose a story'), say: L('Лента ещё не начата.', 'The Feed has not started yet.') };
        const shown = cover(state);
        const last = shown?.last ?? state.episodes.at(-1);
        const card = {};
        if (shown) card.picture = { name: shown.name, caption: last ? L(`«${last.title}», серия ${last.n}`, `“${last.title}”, episode ${last.n}`) : undefined };
        const running = anyRunning();
        if (running) {
            card.progress = { value: 0.5, text: `${running.title}…` };
            card.cap = L('Снимается', 'Shooting');
            card.say = L('Серия снимается.', 'An episode is being shot.');
        } else {
            card.cap = last ? L('Серия готова', 'Episode ready') : L('Серий пока нет', 'No episodes yet');
            card.buttons = [{ text: L('Снять следующую', 'Shoot the next'), tap: 'next' }];
            card.say = last ? L(`В ленте серия ${last.n} сериала «${last.title}». ${last.choice ? `Развилка: ${last.choice.q}` : ''}`, `In the feed: episode ${last.n} of “${last.title}”. ${last.choice ? `The fork: ${last.choice.q}` : ''}`) : L('Серий пока нет.', 'No episodes yet.');
        }
        return card;
    },

    // ——— Голос колонки и «Мозг» ———

    /** «Что в ленте?» */
    async whatsNew() {
        const state = load();
        const last = lastOf(state) ?? state.episodes.at(-1);
        if (lanes.shoot) return { say: L('Серия ещё снимается — скажу, когда будет готова.', 'The episode is still being shot — I’ll say when it’s ready.') };
        if (!last) return { say: state.introduced ? L('Серий пока нет. Скажите «Лента, дальше».', 'No episodes yet. Say “Feed, next”.') : L('Лента ещё не начата. Скажите «Лента, начни».', 'The Feed has not started yet. Say “Feed, start”.') };
        const choice = last.choice && !last.chosen ? L(` Ждёт вашего выбора: ${last.choice.q.toLowerCase()} Первый — ${last.choice.a.title.toLowerCase()}, второй — ${last.choice.b.title.toLowerCase()}.`, ` Waiting for your choice: ${last.choice.q.toLowerCase()} First — ${last.choice.a.title.toLowerCase()}, second — ${last.choice.b.title.toLowerCase()}.`) : '';
        return { say: L(`Последняя серия — «${last.title}», серия ${last.n}: ${last.logline}.${choice}`, `The last episode — “${last.title}”, episode ${last.n}: ${last.logline}.${choice}`) };
    },

    /** «Сними серию» голосом. */
    async voiceNext() {
        return calls.voiceCommand({ command: 'дальше' });
    },

    /** «Лента, …» голосом: та же команда, что в поле виджета. */
    async voiceCommand({ command, request } = {}) {
        try {
            const answer = await calls.command({ text: command ?? request?.text ?? '' });
            return { say: answer.say };
        } catch (error) {
            return { say: L(`Не вышло: ${error.message}.`, `It did not work: ${error.message}.`) };
        }
    },

    /** «Включи ленту»: начать или снять дальше. */
    async voiceStart() {
        return calls.voiceCommand({ command: 'начни' });
    },

    /** «Что умеет лента?» */
    async voiceHelp() {
        return { say: help() };
    },

    /** «Серия понравилась» / «серия не понравилась, скучно». */
    async voiceLike() {
        return calls.voiceCommand({ command: 'нравится' });
    },

    async voiceDislike({ why } = {}) {
        return calls.voiceCommand({ command: `не нравится ${why ?? ''}` });
    },

    /** «Выбираю первый» / «второй» — выбор на последней развилке голосом. */
    async voiceChoose({ which, request }) {
        const state = load();
        const last = [...state.episodes].reverse().find((one) => one.choice);
        if (!last) return { say: L('Развилки пока нет.', 'No fork yet.') };
        const text = `${which ?? ''} ${request?.text ?? ''}`.toLowerCase();
        const value = /втор|два|2|b|second|two/.test(text) ? 'b' : /перв|один|1|a|first|one/.test(text) ? 'a' : null;
        if (!value) return { say: L(`Первый — ${last.choice.a.title.toLowerCase()} или второй — ${last.choice.b.title.toLowerCase()}?`, `First — ${last.choice.a.title.toLowerCase()} or second — ${last.choice.b.title.toLowerCase()}?`) };
        update((fresh) => apply(fresh, { type: 'choose', id: last.id, value }));
        touched('choose');
        return { say: L(`Записал: ${value === 'a' ? last.choice.a.title : last.choice.b.title}.`, `Noted: ${value === 'a' ? last.choice.a.title : last.choice.b.title}.`) };
    },

    /** Инструмент «Мозга»: что в ленте — словами. */
    async toolStatus() {
        const state = load();
        return {
            introduced: state.introduced,
            series: state.series.map((one) => one.title),
            episodes: state.episodes.slice(-5).map((one) => ({ id: one.id, title: one.title, n: one.n, logline: one.logline, choice: one.choice?.q, chosen: one.chosen ?? null })),
            running: anyRunning()?.title ?? null,
        };
    },

    /**
     * Путеводитель режиссёра — своему Claude Code через сервер MCP приложения (/mcp/apps/feed): как снять серию кодом,
     * какие серии уже есть и какая следующая.
     */
    async guide() {
        const state = load();
        const series = currentSeries(state);
        const last = series ? episodesOf(state, series.id).at(-1) : null;
        const next = series ? `${series.id}-${String((last?.n ?? 0) + 1).padStart(2, '0')}` : null;
        const where = series
            ? `Сейчас сериал «${series.title}» (${series.id}), облик ${series.look}; следующая серия — ${next}${last?.choice ? `, после развилки «${last.choice.q}»${last.chosen ? ` (зритель выбрал ${last.chosen === 'a' ? '①' : '②'})` : ''}` : ''}. Мир сериала — series/${series.id}/world.md.`
            : 'Сериала ещё нет: человек выбирает историю в окне «Ленты».';
        return `${where}\n\nКогда файлы серии готовы и feed_check_episode говорит «собралось», зовите feed_render_episode { id } — «Лента» озвучит, отрендерит и поставит серию в ленту.\n\n${instructions(state.lang)}`;
    },

    /** Снять серию, которую код уже написал (Claude Code через MCP): озвучка, рендер, лента — задачей. */
    async renderEpisode({ id }) {
        return work('shoot', L('Снять серию', 'Shoot an episode'), 'Озвучиваю', (task) => shoot(task, { prepared: String(id ?? '') }));
    },

    /** Инструмент режиссёра: собрать серию кодом и отрендерить три кадра; ответ — текстом. */
    async checkEpisode({ id }) {
        const dir = join(folder(), 'episodes', String(id ?? ''));
        if (!existsSync(join(dir, 'code', 'Episode.tsx'))) return `нет episodes/${id}/code/Episode.tsx`;
        try {
            const serveUrl = await bundleOnce();
            const shots = join(dir, 'check');
            mkdirSync(shots, { recursive: true });
            const { composition } = await import('./render.mjs');
            const comp = await composition(serveUrl, String(id), {});
            const frames = [0.1, 0.5, 0.9].map((share) => Math.floor(share * (comp.durationInFrames - 1)));
            for (const frame of frames) await renderPicture(serveUrl, String(id), {}, join(shots, `frame-${frame}.jpg`), { frame, scale: 0.25 });
            return `собралось: ${comp.durationInFrames} кадров (${(comp.durationInFrames / comp.fps).toFixed(1)} с), кадры ${frames.join(', ')} рисуются без ошибок${comp.props?.choiceAt ? `, карточки развилки с ${comp.props.choiceAt.toFixed(1)} с` : ', карточек развилки нет (meta.choiceLine)'}`;
        } catch (error) {
            return `не собралось: ${String(error.message ?? error).slice(0, 3000)}`;
        }
    },
};

http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
        response.writeHead(200).end('ok');
        return;
    }
    const match = request.method === 'POST' ? request.url?.match(/^\/call\/([A-Za-z0-9_]+)$/) : null;
    const call = match && Object.hasOwn(calls, match[1]) ? calls[match[1]] : null;
    if (!call) {
        response.writeHead(404).end();
        return;
    }
    if (request.headers.authorization !== `Bearer ${APP.token}`) {
        response.writeHead(401).end();
        return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    try {
        const input = body ? JSON.parse(body) : {};
        // Отвечаем на языке дома: его могли поменять в «Настройках».
        await refreshLocale();
        const result = await call(input ?? {});
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result ?? null));
    } catch (error) {
        log('warn', `${match[1]}: ${error.message}`);
        response.writeHead(500).end(String(error.message ?? error));
    }
}).listen(APP.port, '127.0.0.1', () => log('info', `«Лента» слушает порт ${APP.port}`));
