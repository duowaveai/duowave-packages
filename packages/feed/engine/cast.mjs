// Состав голосов сериала: кто какие реплики читает. Рассказчик — голос «Ленты», если человек не назвал другой;
// второй голос — рация, телефон и угроза; персонажи — реплики с "speaker": "Имя". Голоса — любые голоса шлюза
// (компьютера и облачные): их подбирает модель, когда пишет первую серию, или человек — словами («второй голос Адам»)
// и в настройках. Состав живёт у сериала, чтобы голоса не менялись от серии к серии.

/** Ролей у персонажей — не больше четырёх: дальше голоса перестают различаться на слух. */
export const CHARACTERS_MOST = 4;

/** Голос в составе — как его хранит лента. */
export function castVoice(voice) {
    if (!voice?.id) return null;
    const { id, kind, title, license, publish, cloud, paid } = voice;
    return { id, kind: kind ?? 'computer', title: title ?? id, license: license ?? null, publish: !!publish, cloud: !!cloud, paid: !!paid };
}

/** Пара рассказчику, когда второго голоса в составе нет: «Дмитрий» к «Денису» (решение 18), иначе тот же голос. */
export function pairOf(voice) {
    if (voice?.kind !== 'computer') return voice;
    return voice.id === 'piper/denis' ? { ...voice, id: 'piper/dmitri', title: 'Дмитрий' } : voice;
}

/**
 * Состав для озвучки серии: рассказчик — из состава сериала или голос «Ленты» (`voice`); второй — из состава, иначе
 * пара рассказчика; персонажи — как есть.
 */
export function castOf(series, voice) {
    const own = series?.cast ?? {};
    const narrator = castVoice(own.narrator) ?? castVoice(voice);
    return { narrator, second: castVoice(own.second) ?? pairOf(narrator), characters: { ...(own.characters ?? {}) } };
}

/** Состав из одного голоса: своя запись, переозвучка одним голосом, немой черновик. */
export function oneVoice(voice) {
    return { narrator: voice, second: pairOf(voice), characters: {} };
}

/** Чей голос читает реплику: персонажа, второй (рация, телефон, угроза) или рассказчика. */
export function voiceForLine(cast, line, treated) {
    const character = line?.speaker ? cast.characters?.[line.speaker] : null;
    if (character) return castVoice(character);
    if (treated || line?.speaker === 'second') return cast.second ?? cast.narrator;
    return cast.narrator;
}

/** Все разные голоса состава — для лицензии серии и строки о голосе в посте. */
export function castVoices(cast) {
    const all = [cast.narrator, cast.second, ...Object.values(cast.characters ?? {})].map(castVoice).filter(Boolean);
    return [...new Map(all.map((voice) => [voice.id, voice])).values()];
}

/** Платит ли кто-то из состава (облачный голос по тарифу): тогда — потолок знаков на серию. */
export function castPaid(cast) {
    return castVoices(cast).some((voice) => voice.paid || voice.kind === 'elevenlabs');
}

/** Голоса шлюза для модели — строкой на голос: id, имя, язык, облачный ли, можно ли публиковать. */
export function voicesText(list) {
    return list
        .slice(0, 40)
        .map((voice) => {
            const notes = [voice.lang, voice.kind !== 'computer' ? `${voice.kind}, облачный, платный` : 'на компьютере', voice.publish ? 'можно публиковать' : 'только для себя'].filter(Boolean);
            return `- ${voice.id} — ${voice.title ?? voice.id} (${notes.join(', ')})`;
        })
        .join('\n');
}

/** Состав словами для модели: кто кем озвучен в этом сериале. */
export function castText(cast) {
    const parts = [];
    if (cast.narrator) parts.push(`рассказчик — ${cast.narrator.title} (${cast.narrator.id})`);
    if (cast.second) parts.push(`второй голос (рация, телефон, угроза) — ${cast.second.title} (${cast.second.id})`);
    for (const [name, voice] of Object.entries(cast.characters ?? {})) parts.push(`«${name}» — ${voice.title} (${voice.id})`);
    return parts.join('; ');
}

/**
 * Состав из ответа модели: только голоса из списка шлюза, имена персонажей — короткие, не больше четырёх. Что модель
 * не назвала, остаётся как было.
 */
export function castFromAnswer(answer, list) {
    if (!answer || typeof answer !== 'object') return null;
    const byId = new Map(list.map((voice) => [voice.id, voice]));
    const pick = (id) => (typeof id === 'string' ? castVoice(byId.get(id.trim())) : null);
    const out = {};
    const narrator = pick(answer.narrator);
    if (narrator) out.narrator = narrator;
    const second = pick(answer.second);
    if (second) out.second = second;
    const characters = {};
    for (const [rawName, id] of Object.entries(answer.characters && typeof answer.characters === 'object' ? answer.characters : {})) {
        const name = String(rawName).trim().slice(0, 40);
        const voice = pick(id);
        if (name && voice && Object.keys(characters).length < CHARACTERS_MOST) characters[name] = voice;
    }
    if (Object.keys(characters).length) out.characters = characters;
    return Object.keys(out).length ? out : null;
}

/** Состав сериала после ответа модели или слова человека: новое поверх прежнего. */
export function mergeCast(before, change) {
    const merged = { ...(before ?? {}) };
    if (change?.narrator) merged.narrator = castVoice(change.narrator);
    if (change?.second !== undefined) merged.second = change.second ? castVoice(change.second) : null;
    if (change?.characters) {
        const characters = { ...(merged.characters ?? {}) };
        for (const [name, voice] of Object.entries(change.characters)) {
            if (voice) characters[name] = castVoice(voice);
            else delete characters[name];
        }
        merged.characters = Object.fromEntries(Object.entries(characters).slice(0, CHARACTERS_MOST));
    }
    return merged;
}
