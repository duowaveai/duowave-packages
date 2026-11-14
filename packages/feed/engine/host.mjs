// Шлюз для движка «Ленты»: Host API приложения (/api/v1/apps/host/…) с его токеном, письма шины, долгие задачи.
// Всё, что движок знает о шлюзе, — в окружении: PORT, DUOWAVE_URL, DUOWAVE_APP_TOKEN, DUOWAVE_APP_ID,
// DUOWAVE_APP_DATA (свои данные), DUOWAVE_APP_FILES (своя папка на шине — её видит окно).

import { L } from './i18n.mjs';

const env = process.env;

export const APP = {
    id: env.DUOWAVE_APP_ID ?? 'feed',
    port: Number(env.PORT ?? 0),
    url: env.DUOWAVE_URL ?? '',
    token: env.DUOWAVE_APP_TOKEN ?? '',
    data: env.DUOWAVE_APP_DATA ?? '',
    files: env.DUOWAVE_APP_FILES ?? env.DUOWAVE_APP_DATA ?? '',
};

/** Просьба к шлюзу: статус и разобранный JSON (или null). `signal` — перестать ждать («Стоп»). */
export async function host(method, path, body, signal) {
    if (!APP.url) throw new Error('шлюза нет: движок запущен не шлюзом (нет DUOWAVE_URL)');
    const answer = await fetch(`${APP.url}${path}`, {
        method,
        headers: { authorization: `Bearer ${APP.token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
    });
    const text = await answer.text();
    let parsed = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }
    return { status: answer.status, ok: answer.ok, body: parsed };
}

/**
 * Письмо на шине от имени приложения; ответ — что ответил адресат, отказ — ошибка с его словами. `signal` задачи —
 * «Стоп» не ждёт, пока модель допишет: письмо бросается (шлюз свою работу закончит сам).
 */
export async function letter(to, handle, input = {}, signal) {
    if (signal?.aborted) throw new Cancelled();
    let answer;
    try {
        answer = await host('POST', '/api/v1/apps/host/call/bus.call', { to, handle, input }, signal);
    } catch (error) {
        if (signal?.aborted) throw new Cancelled();
        throw error;
    }
    if (!answer.ok) throw new Error(answer.body?.error ?? `${to} ${handle}: HTTP ${answer.status}`);
    return answer.body;
}

/** Строка в журнал приложения (пульт показывает его в карточке приложения). */
export function log(level, message) {
    // Вывод программы шлюз сам кладёт в журнал приложения: stdout — «info», stderr — «warn».
    const line = String(message).slice(0, 900);
    if (level === 'info') console.log(line);
    else console.error(line);
}

/** Настройки приложения (с ключами из сейфа — их видит только само приложение). */
export async function settings() {
    if (!APP.url) return {};
    const answer = await host('GET', '/api/v1/apps/host/settings');
    return answer.ok && answer.body && typeof answer.body === 'object' ? answer.body : {};
}

/** Колонка говорит без запроса (связь call:system/voice); нет колонки — молча. */
export async function say(text) {
    try {
        return await letter('system/voice', 'say', { text });
    } catch (error) {
        log('warn', `сказать не вышло: ${error.message}`);
        return false;
    }
}

/** Сообщение владельцу (связь call:system/notify). */
export async function notify(text) {
    try {
        await letter('system/notify', 'send', { text });
    } catch (error) {
        log('warn', `сообщение владельцу не ушло: ${error.message}`);
    }
}

/** Человек попросил отменить: работа бросается, задача закрывается «отменена». */
export class Cancelled extends Error {
    constructor() {
        super(L('отменено', 'cancelled'));
        this.name = 'Cancelled';
    }
}

/**
 * Долгая задача шлюза (src/tasks): ход в процентах и словах видит окно (useTask) и карточка стола. Отчёт о ходе
 * отвечает, просили ли отменить: `step()` бросает Cancelled — работа обрывается в ближайшей точке.
 */
export class Task {
    constructor(id, title) {
        this.id = id;
        this.title = title;
        this.cancelled = false;
        this.last = 0;
        this.controller = new AbortController();
    }

    /** Чем бросить письма задачи, когда попросили остановиться. */
    get signal() {
        return this.controller.signal;
    }

    /** Остановиться: письма, которые ждут ответа, бросаются сразу, работа обрывается в ближайшей точке. */
    stop() {
        this.cancelled = true;
        this.controller.abort();
    }

    /**
     * Ход, пока ждём долгого ответа (модель пишет сценарий): проценты ползут от `from` к `to` (к `to` не доходят), в
     * словах — сколько уже ждём; заодно каждые 3 с узнаём, не нажали ли «Стоп». Ответ — функция, что ход выключает.
     */
    waiting(from, to, text, expectedSec = 90) {
        const started = Date.now();
        const timer = setInterval(() => {
            const seconds = Math.round((Date.now() - started) / 1000);
            const share = 1 - Math.exp(-seconds / expectedSec);
            this.tick(from + (to - from) * share, L(`${text} · ${seconds} с`, `${text} · ${seconds} s`));
        }, 3000);
        return () => clearInterval(timer);
    }

    static async start(title, text) {
        const answer = await host('POST', '/api/v1/apps/host/tasks', { title, text, percent: 0 });
        if (!answer.ok) throw new Error(answer.body?.error ?? L(`задача не начата: HTTP ${answer.status}`, `the task did not start: HTTP ${answer.status}`));
        return new Task(answer.body.id, title);
    }

    /** Ход; бросает Cancelled, если человек нажал «Отменить». */
    async step(percent, text) {
        const answer = await host('POST', `/api/v1/apps/host/tasks/${this.id}/progress`, {
            percent: Math.max(0, Math.min(100, Math.round(percent * 10) / 10)),
            text,
        });
        // 409/404: шлюз задачу уже закрыл (отменил сам через 30 с после «Отменить», прервал) — дальше работать незачем.
        if (answer.body?.cancelRequested || answer.status === 409 || answer.status === 404) this.stop();
        if (this.cancelled) throw new Cancelled();
    }

    /** Ход без исключения (из обратных вызовов рендера): не чаще раза в 400 мс. */
    tick(percent, text) {
        const now = Date.now();
        if (now - this.last < 400) return;
        this.last = now;
        host('POST', `/api/v1/apps/host/tasks/${this.id}/progress`, { percent: Math.round(percent * 10) / 10, text })
            .then((answer) => {
                if (answer.body?.cancelRequested || answer.status === 409 || answer.status === 404) this.stop();
            })
            .catch(() => {});
    }

    async done(result) {
        await host('POST', `/api/v1/apps/host/tasks/${this.id}/done`, { result });
    }

    async fail(error) {
        await host('POST', `/api/v1/apps/host/tasks/${this.id}/fail`, { error: String(error).slice(0, 500) });
    }

    async gaveUp() {
        await host('POST', `/api/v1/apps/host/tasks/${this.id}/cancelled`, {});
    }
}

/**
 * Работа задачей: начать, вести, закончить — результатом, ошибкой или отменой. Отвечает сразу id задачи: функцию
 * окна шлюз ждёт две секунды, ход и конец окно увидит через useTask.
 */
export async function asTask(title, text, work) {
    const task = await Task.start(title, text);
    (async () => {
        try {
            const result = await work(task);
            await task.done(result ?? null);
        } catch (error) {
            if (error instanceof Cancelled || task.cancelled) await task.gaveUp();
            else {
                log('error', `${title}: ${error?.stack ?? error}`);
                await task.fail(error?.message ?? String(error));
            }
        }
    })();
    return { task: task.id };
}
