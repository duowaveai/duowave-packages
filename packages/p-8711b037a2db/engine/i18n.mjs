// «Лента» говорит на языке дома (docs/plugins/AUTHORING.md, «Языки»): тексты для людей — парами по языкам прямо там,
// где их говорят (`pick({ ru, en })`, `L(ru, en)`). Язык дома шлюз даёт по `GET /api/v1/apps/host/locale`; его меняют в
// «Настройках» пульта — перечитывается перед ответом, не чаще раза в 20 секунд. Языков у «Ленты» два: русский и
// английский; любой другой язык дома читает английский.

import { APP, host } from './host.mjs';

let now = 'ru';
let readAt = 0;

/** Язык дома — перечитать, если прочитан давно; шлюз молчит — прежний. */
export async function refreshLocale({ force = false } = {}) {
    if (!APP.url || (!force && Date.now() - readAt < 20_000)) return now;
    try {
        const answer = await host('GET', '/api/v1/apps/host/locale');
        const code = String(answer?.body?.locale ?? '')
            .toLowerCase()
            .split(/[-_]/)[0];
        if (answer?.ok && code) now = code;
        readAt = Date.now();
    } catch {
        // прежний язык
    }
    return now;
}

/** Язык дома сейчас: `ru`, `en`… */
export const locale = () => now;

/** Говорим ли по-английски: всё, кроме русского. */
export const english = () => now !== 'ru';

/** Текст на языке дома из пары `{ ru, en }`. */
export function pick(variants) {
    return english() ? (variants.en ?? variants.ru) : (variants.ru ?? variants.en);
}

/** Короче: `L('Готово', 'Done')`. */
export const L = (ru, en) => (english() ? en : ru);

/** Форма числа: русская (1 серия, 2 серии, 5 серий) или английская (1 episode, 2 episodes). */
export function plural(count, ru, en) {
    if (english()) return count === 1 ? en[0] : en[1];
    const n = Math.abs(count) % 100;
    const last = n % 10;
    if (n > 10 && n < 20) return ru[2];
    if (last === 1) return ru[0];
    if (last >= 2 && last <= 4) return ru[1];
    return ru[2];
}
