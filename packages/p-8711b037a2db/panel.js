// «Лента» на главном экране (docs/plans/feed.md): виджет стола прямо под колонкой (`under`), его можно передвинуть.
// Вид — по макету «Лента — макет экранов» (язык DuoWave: белые карточки с тонкой линией, лаймовое главное действие,
// чёрное второе, крупные лёгкие заголовки Inter Tight) на токенах темы пульта — светлой и тёмной.
//
// Пока лента не начата — знакомство одним экраном: история, голос, как снимать, кто пишет, память и все «да» одним
// листом, — и «Начать». Потом — лента: сериалы, ролик 9:16 с меткой «Ваш выбор», развилка, «Нравится» / «Не нравится»
// с причинами, «Далее» с ценой и поле команд — те же слова, что колонке («Лента, дальше»). Пока серия снимается —
// процесс создания: первая серия — светлая карточка с «Миром сериала» и шагами, следующая — тёмная панель с кадром
// прошлой серии и теми же шагами (сценарий → голос → картинка → проверка). Отправка идёт своей дорожкой рядом.
//
// Ролики и кадры окно играет из папки приложения (useMedia — движок показа шлюза: перемотка, ключ за «Ленту»), во весь
// экран открывает просмотрщиком пульта (openMedia) с той же секунды, ход работы видит задачами шлюза (useTask),
// отправляет через пульт (share), записывает свой голос через пульт (record). Само окно в сеть не ходит.
import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Switch, ask, askRights, definePlugin, icons, openMedia, record, rights, share, t, useApi, useLocale, useMedia, usePanelState, useTask } from "@duowave/panel-sdk";

const ID = "p-8711b037a2db"; // id пакета — случайный (README, «Правила каталога»)

// Тексты окна на языке пульта (docs/plans/i18n.md): берутся при рисовании — tx(ключ, параметры); useLocale в корне
// окна перерисовывает их, когда человек сменил язык. Чего нет на языке пульта — по-английски, затем по-русски. Не здесь
// — данные: слова для движка (api.call), заголовки задач (TASKS) и ASKING; тексты движка показываются как пришли.
const T = {
  ru: {
    appTitle: "Лента",
    // Долгие задачи, пока идут (TASKS)
    taskShooting: "Снимается серия",
    taskShareFile: "Готовим файл к отправке",
    taskCard: "Рисуем карточку",
    taskRevoice: "Переозвучиваем",
    taskOwnVoice: "Ставим вашу запись",
    taskTelegram: "Публикуем в Telegram",
    taskWatch: "Готовим ссылку",
    // Примеры команд в поле
    hint1: "дальше",
    hint2: "мрачнее и короче",
    hint3: "первый",
    hint4: "не нравится, скучно",
    hint5: "про кота-детектива",
    // Общее
    sizeMb: "{n} МБ",
    sizeGb: "{n} ГБ",
    percent: "{n} %",
    seconds: "{n} с",
    priceCredits: "≈ 700 кредитов",
    priceFree: "бесплатно",
    timeDirector: "10–25 мин",
    timeUsual: "≈ 2 мин",
    busyWait: "Сейчас идёт: {what}. Дождитесь — или нажмите «Отменить».",
    afterAllow: "покажу после «Разрешить»",
    allow: "Разрешить",
    connect: "Подключить",
    cloud: "облако",
    inCloud: "в облаке",
    back: "Назад",
    cancel: "Отменить",
    cancelling: "Отменяю…",
    close: "Закрыть",
    done: "Готово",
    episodeOf: "«{title}», серия {n}",
    episodeN: "Серия {n}",
    modeDirector: "режиссёр",
    modeUsual: "обычный режим",
    howToShoot: "Как снимать",
    whoWrites: "Кто пишет сценарий",
    memoryToggle: "учитывать интересы из памяти дома",
    newSeries: "Новый сериал",
    shootFirst: "Снять первую серию",
    settingsTitle: "Настройки «Ленты»",
    rightsTitle: "«Ленте» нужно ваше «да»",
    // Модель
    modelNone: "моделей пока нет — серию писать некому",
    modelAria: "Модель, которая пишет серии",
    modelSmart: "Как у «Мозга»: «Умная»",
    modelFast: "«Быстрая» «Мозга»",
    modelGone: "{model} — нет среди подключённых",
    // Голоса
    voiceNone: "Голосов на компьютере пока нет",
    voiceAdd: "Поставить голос",
    voiceKeyHint: "Там же — ключ ElevenLabs («Облачные голоса»): голоса из облака без сервера голоса, серия — около 650 знаков тарифа.",
    voiceGone: "«{name}» на этом компьютере нет — выберите голос",
    voiceOnComputer: "на компьютере",
    voicePublish: "можно публиковать",
    voiceSelfOnly: "только для себя",
    voiceMore: { one: "Ещё {count} голос", few: "Ещё {count} голоса", many: "Ещё {count} голосов" },
    // Как снимать
    modeDataTitle: "Обычно",
    modeDataText: "Готовые облики и декорации, серия — за пару минут.",
    modeDataMeta: "пишет ваш «Мозг» · шесть обликов",
    modeDirectorTitle: "Режиссёр",
    modeDirectorText: "Модель рисует каждую серию кодом: свои декорации, свет, камера.",
    modeDirectorMeta: "10–25 мин · нужна сильная модель",
    modeDirectorBadge: "картинка богаче",
    // Знакомство
    storyLabel: "О чём история",
    storyMore: "Ещё три",
    storyOwnPlaceholder: "Или своя завязка: «про кота, который ищет дом»",
    storyOwnAria: "Своя завязка",
    setupNeedYes: "без «да» «Лента» не сможет писать и озвучивать",
    setupLabel: "Лента · знакомство",
    setupTitle: "Ваш первый сериал",
    setupLead: "Мини-сериалы, которые снимает ваш компьютер: вы выбираете развилку — история идёт дальше.",
    setupVoice: "Чей голос рассказывает",
    setupNoModel: "Без модели серию не написать: подключите её — «Подключить» выше.",
    setupBusy: "Сейчас идёт: {what}. Новый сериал начнётся после неё.",
    setupStarting: "Начинаю…",
    setupStart: "Начать",
    setupVoiceHint: "Голосом: «Лента, начни» · «Лента, история про…» · «Лента, режиссёр»",
    // Шаги съёмки
    stepScriptDirector: "Режиссёр пишет серию",
    stepScript: "Сценарий",
    stepScriptDoneNext: "учёл ваш выбор и оценки",
    stepScriptDoneFirst: "реплики и развилка",
    stepVoice: "Голос",
    stepVoiceBy: "читает {name}",
    stepVoiceDone: "реплики озвучены",
    stepRender: "Рендер",
    stepPicture: "Картинка",
    stepPictureDone: "кадры готовы",
    stepCheck: "Проверка",
    stepCheckWhat: "длина, звук, кадр",
    // Первая серия
    buildingLabel: "Лента · первая серия",
    buildingTitle: "Снимаю «{title}», серию 1",
    buildingSeries: "сериал",
    buildingWorld: "Мир сериала",
    buildingWorldPending: "Модель придумывает мир…",
    buildingAway: "Можно заниматься своим — серия появится здесь, колонка скажет, когда готово.",
    buildingHere: "собирает этот компьютер",
    buildingVoice: "голос — {name}",
    // Следующая серия
    nextFork: "обе ветки серии {n}",
    nextPicked: "выбрали {mark} {title}",
    nextLiked: "нравится",
    nextDisliked: "не нравится",
    nextPrevious: "прошлая серия",
    nextTitleDirector: "Режиссёр снимает следующую серию",
    nextTitle: "Снимаю следующую серию",
    nextElapsed: "идёт {time}",
    nextUsualDirector: "обычно 10–25 мин",
    nextUsual: "обычно 1,5–2 мин",
    // Плеер
    playerArchived: "Ролик удалён: хранится только текст",
    playerNone: "Ролика нет",
    playerMine: "ВАШ ВЫБОР",
    playerFull: "Во весь экран",
    // Отправка
    shareLine: "Реплика {n} из {total}",
    shareTitle: "Поделиться серией {n}",
    shareWhat: "Что отправить",
    shareVideo: "Ролик",
    shareCard: "Карточка",
    shareVideoTitle: "Копия ролика для отправки",
    shareCardTitle: "Карточка серии",
    shareVideoSub: "«{title}», серия {n} · 720p, пройдёт и в Telegram",
    shareCardSub: "Одна картинка 1080×1920: кадр развилки, название, ДиВи",
    shareSelfOnly: "Голос «{name}» — только для себя ({license}): для роликов с монетизацией он не подходит. Отправить можно — решать вам.",
    shareThisVoice: "этот",
    shareNoLicense: "лицензия не выяснена",
    shareRevoice: "Переозвучить: {name}",
    shareOwnVoice: "Своим голосом",
    shareAsIs: "Отправить как есть",
    sharePrepareVideo: "Приготовить ролик",
    sharePrepareCard: "Приготовить карточку",
    sharePrepareThen: "потом — куда отправить",
    shareTelegram: "В Telegram-канал",
    shareWatch: "Ссылка «смотри и выбирай»",
    shareBusy: "Сейчас идёт: {what} — отправить можно после неё.",
    shareWatchExists: "Ссылка уже есть: адрес шлюза + {path}",
    // ElevenLabs
    elevenNoKey: "ключа ElevenLabs в шлюзе пока нет",
    elevenNoAnswer: "ElevenLabs не ответил: {problem}",
    elevenOn: "ElevenLabs подключён",
    elevenVoices: { one: "{count} голос — в списке выше", few: "{count} голоса — в списке выше", many: "{count} голосов — в списке выше" },
    elevenLoading: "загружаю голоса…",
    elevenLeft: {
      one: "Остался {left} знак из {limit} · серия — около 650",
      few: "Осталось {left} знака из {limit} · серия — около 650",
      many: "Осталось {left} знаков из {limit} · серия — около 650",
    },
    elevenAbout: " — голоса по вашему ключу, без сервера голоса на компьютере. Серия — около 650 знаков тарифа.",
    elevenWhere: "Ключ хранит шлюз, «Лента» его не видит: вставьте его в пульте — «Персонаж» → «Голос» → «Облачные голоса».",
    elevenOpenVoice: "Открыть «Голос»",
    elevenChecking: "Проверяю…",
    elevenCheck: "Проверить",
    // Голоса сериала
    castGone: "{name} — нет сейчас",
    castSelf: "для себя",
    castTitle: "Голоса сериала «{title}»",
    castNarrator: "Рассказчик",
    castSecond: "Второй голос",
    castSecondAuto: "пара рассказчику",
    castCharacter: "«{name}»",
    castByNarrator: "рассказчик",
    castFromNext: "Со следующей серии; готовые серии — «Переозвучить».",
    castNone: "Персонажей с голосами модель подбирает в первой серии; можно и словами: «Лента, голос рации Адам».",
    // Настройки
    settingsForgetAllQ: "Забыть всё о вкусе?",
    settingsForgetWishesQ: "Забыть пожелания?",
    settingsForgetRatingsQ: "Забыть оценки?",
    settingsForgetText: "Вернуть нельзя: лента начнёт подбирать заново.",
    settingsForget: "Забыть",
    settingsVoice: "Голос",
    settingsMemory: "Память",
    settingsMemoryCloud: "модель в облаке: интересы уйдут туда вместе с просьбой",
    settingsAhead: "Заранее",
    settingsAheadText: "снимать следующую сразу после выбора",
    settingsNight: "К утру",
    settingsNightText: "ночью снять серию, если развилка выбрана",
    settingsKeep: "Хранить",
    settingsKeepAria: "Сколько серий хранить роликами",
    settingsKeepText: { one: "серию роликами · сейчас {size}", few: "серии роликами · сейчас {size}", many: "серий роликами · сейчас {size}" },
    settingsTaste: "Что лента о вас знает",
    settingsTasteNone: "Пока ничего: оцените пару серий.",
    settingsForgetRatings: "Забыть оценки",
    settingsForgetWishes: "Забыть пожелания",
    settingsForgetAll: "Забыть всё",
    settingsTasteWhere: "Хранится в папке «Ленты», в память DuoWave не попадает, пока вы не включите это сами.",
    settingsSpent: {
      one: "Потрачено: ~{credits} кредит ElevenLabs · токенов модели {tokensIn} → {tokensOut}",
      few: "Потрачено: ~{credits} кредита ElevenLabs · токенов модели {tokensIn} → {tokensOut}",
      many: "Потрачено: ~{credits} кредитов ElevenLabs · токенов модели {tokensIn} → {tokensOut}",
    },
    settingsNewStory: "Новая история",
    // Лента
    feedDoneTelegram: "Опубликовано в Telegram: {to}",
    feedDoneWatch: "Ссылка «смотри и выбирай»: адрес шлюза + {path} — 30 дней; голоса придут сюда.",
    feedSeries: "Сериалы",
    feedFailed: "{title}: не получилось — {error}",
    feedInterrupted: "{title}: прервалась — {error}",
    feedRestarted: "шлюз перезапустился",
    feedSilent: "немой черновик",
    feedVoiceIt: "Озвучить",
    feedFork: "Развилка — угадайте верный вариант",
    feedYourChoice: "Ваш выбор",
    feedVotes: "Голоса по ссылке: ① {a} · ② {b}",
    feedLike: "Нравится",
    feedDislike: "Не нравится",
    feedWhatsWrong: "Что не так",
    feedPrev: "Прошлая серия",
    feedNext: "Следующая серия",
    feedPosition: "{n} из {total}",
    feedEmpty: "Серий пока нет: «Снять первую серию» — и через пару минут она будет здесь.",
    feedSeasonEnd: "Сезон окончен",
    feedGuessed: "угадано {right} из {total}",
    feedSeason2: "Второй сезон",
    feedSeason2Sub: "Тот же мир и облик, новая загадка.",
    feedOtherStory: "Другая история",
    feedOtherStorySub: "Три новых варианта — по вашему вкусу.",
    feedAsk: "Напишите или скажите колонке: «Лента, {hint}»",
    feedAskAria: "Команда или пожелание «Ленте»",
    feedSend: "Отправить",
    feedShare: "Поделиться",
    feedGo: "Далее",
    feedShooting: "снимается",
    feedChooseFirst: "сначала выбор",
    feedOpenFull: "Открыть во весь экран",
    feedCapShooting: "Колонка скажет, когда серия будет готова.",
    feedCapWaiting: "Угадайте вариант, оцените серию — и жмите «Далее». Сама лента дальше не идёт.",
    feedCapChosen: "Серия {n} покажет обе ветки — узнаете, угадали ли.",
    feedCapWish: "Пожелание к следующей серии — в поле выше.",
    feedNoAnswer: "«Лента» не отвечает: {problem}",
  },
  en: {
    appTitle: "Feed",
    // Long tasks while they run (TASKS)
    taskShooting: "Shooting an episode",
    taskShareFile: "Preparing the file to send",
    taskCard: "Drawing the card",
    taskRevoice: "Re-voicing",
    taskOwnVoice: "Adding your recording",
    taskTelegram: "Publishing to Telegram",
    taskWatch: "Preparing the link",
    // Command examples in the field
    hint1: "next",
    hint2: "darker and shorter",
    hint3: "first",
    hint4: "don't like it, boring",
    hint5: "about a detective cat",
    // Common
    sizeMb: "{n} MB",
    sizeGb: "{n} GB",
    percent: "{n}%",
    seconds: "{n} s",
    priceCredits: "≈ 700 credits",
    priceFree: "free",
    timeDirector: "10–25 min",
    timeUsual: "≈ 2 min",
    busyWait: "Now running: {what}. Wait for it — or press “Cancel”.",
    afterAllow: "shown after “Allow”",
    allow: "Allow",
    connect: "Connect",
    cloud: "cloud",
    inCloud: "in the cloud",
    back: "Back",
    cancel: "Cancel",
    cancelling: "Cancelling…",
    close: "Close",
    done: "Done",
    episodeOf: "“{title}”, episode {n}",
    episodeN: "Episode {n}",
    modeDirector: "director",
    modeUsual: "normal mode",
    howToShoot: "How to shoot",
    whoWrites: "Who writes the script",
    memoryToggle: "use interests from the home memory",
    newSeries: "New series",
    shootFirst: "Shoot the first episode",
    settingsTitle: "“Feed” settings",
    rightsTitle: "“Feed” needs your “yes”",
    // Model
    modelNone: "no models yet — nobody to write the episode",
    modelAria: "The model that writes the episodes",
    modelSmart: "Same as “Brain”: “Smart”",
    modelFast: "“Fast” from “Brain”",
    modelGone: "{model} — not connected",
    // Voices
    voiceNone: "No voices on this computer yet",
    voiceAdd: "Add a voice",
    voiceKeyHint: "The ElevenLabs key is there too (“Cloud voices”): voices from the cloud without a voice server, about 650 plan characters per episode.",
    voiceGone: "“{name}” isn't on this computer — choose a voice",
    voiceOnComputer: "on this computer",
    voicePublish: "OK to publish",
    voiceSelfOnly: "for yourself only",
    voiceMore: { one: "{count} more voice", other: "{count} more voices" },
    // How to shoot
    modeDataTitle: "Normal",
    modeDataText: "Ready-made looks and sets, an episode in a couple of minutes.",
    modeDataMeta: "written by your “Brain” · six looks",
    modeDirectorTitle: "Director",
    modeDirectorText: "The model draws each episode in code: its own sets, light, camera.",
    modeDirectorMeta: "10–25 min · needs a strong model",
    modeDirectorBadge: "richer picture",
    // Getting started
    storyLabel: "What the story is about",
    storyMore: "Three more",
    storyOwnPlaceholder: "Or your own premise: “about a cat looking for a home”",
    storyOwnAria: "Your own premise",
    setupNeedYes: "without your “yes”, “Feed” can't write or voice episodes",
    setupLabel: "Feed · getting started",
    setupTitle: "Your first series",
    setupLead: "Mini-series shot by your computer: you choose at the fork — and the story goes on.",
    setupVoice: "Whose voice tells the story",
    setupNoModel: "An episode can't be written without a model: connect one — “Connect” above.",
    setupBusy: "Now running: {what}. The new series will start after it.",
    setupStarting: "Starting…",
    setupStart: "Start",
    setupVoiceHint: "By voice: “Feed, start” · “Feed, a story about…” · “Feed, director”",
    // Shooting steps
    stepScriptDirector: "The director writes the episode",
    stepScript: "Script",
    stepScriptDoneNext: "with your choice and ratings",
    stepScriptDoneFirst: "lines and the fork",
    stepVoice: "Voice",
    stepVoiceBy: "read by {name}",
    stepVoiceDone: "lines voiced",
    stepRender: "Render",
    stepPicture: "Picture",
    stepPictureDone: "frames ready",
    stepCheck: "Check",
    stepCheckWhat: "length, sound, frame",
    // First episode
    buildingLabel: "Feed · first episode",
    buildingTitle: "Shooting “{title}”, episode 1",
    buildingSeries: "series",
    buildingWorld: "The world of the series",
    buildingWorldPending: "The model is making up the world…",
    buildingAway: "You can do other things — the episode will appear here, and the speaker will say when it's ready.",
    buildingHere: "made on this computer",
    buildingVoice: "voice — {name}",
    // Next episode
    nextFork: "both branches of episode {n}",
    nextPicked: "you chose {mark} {title}",
    nextLiked: "liked",
    nextDisliked: "disliked",
    nextPrevious: "previous episode",
    nextTitleDirector: "The director is shooting the next episode",
    nextTitle: "Shooting the next episode",
    nextElapsed: "running {time}",
    nextUsualDirector: "usually 10–25 min",
    nextUsual: "usually 1.5–2 min",
    // Player
    playerArchived: "Video deleted: only the text is kept",
    playerNone: "No video",
    playerMine: "YOUR CHOICE",
    playerFull: "Full screen",
    // Sharing
    shareLine: "Line {n} of {total}",
    shareTitle: "Share episode {n}",
    shareWhat: "What to send",
    shareVideo: "Video",
    shareCard: "Card",
    shareVideoTitle: "A copy of the video to send",
    shareCardTitle: "Episode card",
    shareVideoSub: "“{title}”, episode {n} · 720p, works in Telegram too",
    shareCardSub: "One 1080×1920 picture: the fork frame, the title, Deevi",
    shareSelfOnly: "The voice “{name}” is for yourself only ({license}): it doesn't suit monetized videos. You can still send it — it's up to you.",
    shareThisVoice: "this one",
    shareNoLicense: "license unknown",
    shareRevoice: "Re-voice: {name}",
    shareOwnVoice: "In your own voice",
    shareAsIs: "Send as is",
    sharePrepareVideo: "Prepare the video",
    sharePrepareCard: "Prepare the card",
    sharePrepareThen: "then — where to send it",
    shareTelegram: "To the Telegram channel",
    shareWatch: "“Watch and choose” link",
    shareBusy: "Now running: {what} — you can send after it.",
    shareWatchExists: "The link already exists: gateway address + {path}",
    // ElevenLabs
    elevenNoKey: "no ElevenLabs key in the gateway yet",
    elevenNoAnswer: "ElevenLabs didn't answer: {problem}",
    elevenOn: "ElevenLabs connected",
    elevenVoices: { one: "{count} voice — in the list above", other: "{count} voices — in the list above" },
    elevenLoading: "loading voices…",
    elevenLeft: "{left} of {limit} characters left · about 650 per episode",
    elevenAbout: " — voices on your own key, without a voice server on this computer. About 650 plan characters per episode.",
    elevenWhere: "The gateway keeps the key, and “Feed” doesn't see it: paste it in the panel — “Character” → “Voice” → “Cloud voices”.",
    elevenOpenVoice: "Open “Voice”",
    elevenChecking: "Checking…",
    elevenCheck: "Check",
    // Series voices
    castGone: "{name} — not available now",
    castSelf: "for yourself",
    castTitle: "Voices of “{title}”",
    castNarrator: "Narrator",
    castSecond: "Second voice",
    castSecondAuto: "the narrator’s pair",
    castCharacter: "“{name}”",
    castByNarrator: "narrator",
    castFromNext: "From the next episode on; for finished episodes — “Re-voice”.",
    castNone: "The model picks voiced characters in the first episode; you can also say it: “Feed, radio voice Adam”.",
    // Settings
    settingsForgetAllQ: "Forget everything about your taste?",
    settingsForgetWishesQ: "Forget your wishes?",
    settingsForgetRatingsQ: "Forget your ratings?",
    settingsForgetText: "This can't be undone: the feed will start picking from scratch.",
    settingsForget: "Forget",
    settingsVoice: "Voice",
    settingsMemory: "Memory",
    settingsMemoryCloud: "the model is in the cloud: your interests will go there with the request",
    settingsAhead: "Ahead",
    settingsAheadText: "shoot the next one right after you choose",
    settingsNight: "By morning",
    settingsNightText: "shoot an episode at night if the fork is chosen",
    settingsKeep: "Keep",
    settingsKeepAria: "How many episodes to keep as videos",
    settingsKeepText: { one: "episode as video · now {size}", other: "episodes as videos · now {size}" },
    settingsTaste: "What the feed knows about you",
    settingsTasteNone: "Nothing yet: rate a couple of episodes.",
    settingsForgetRatings: "Forget ratings",
    settingsForgetWishes: "Forget wishes",
    settingsForgetAll: "Forget everything",
    settingsTasteWhere: "Kept in the “Feed” folder; it doesn't go into DuoWave memory unless you turn that on yourself.",
    settingsSpent: {
      one: "Spent: ~{credits} ElevenLabs credit · model tokens {tokensIn} → {tokensOut}",
      other: "Spent: ~{credits} ElevenLabs credits · model tokens {tokensIn} → {tokensOut}",
    },
    settingsNewStory: "New story",
    // Feed
    feedDoneTelegram: "Published to Telegram: {to}",
    feedDoneWatch: "“Watch and choose” link: gateway address + {path} — for 30 days; votes will come here.",
    feedSeries: "Series",
    feedFailed: "{title}: failed — {error}",
    feedInterrupted: "{title}: interrupted — {error}",
    feedRestarted: "the gateway restarted",
    feedSilent: "silent draft",
    feedVoiceIt: "Voice it",
    feedFork: "Fork — guess the right option",
    feedYourChoice: "Your choice",
    feedVotes: "Votes from the link: ① {a} · ② {b}",
    feedLike: "Like",
    feedDislike: "Dislike",
    feedWhatsWrong: "What's wrong",
    feedPrev: "Previous episode",
    feedNext: "Next episode",
    feedPosition: "{n} of {total}",
    feedEmpty: "No episodes yet: press “Shoot the first episode” — it will be here in a couple of minutes.",
    feedSeasonEnd: "Season over",
    feedGuessed: "{right} of {total} guessed",
    feedSeason2: "Second season",
    feedSeason2Sub: "The same world and look, a new mystery.",
    feedOtherStory: "Another story",
    feedOtherStorySub: "Three new options — to your taste.",
    feedAsk: "Type it or tell the speaker: “Feed, {hint}”",
    feedAskAria: "A command or a wish for “Feed”",
    feedSend: "Send",
    feedShare: "Share",
    feedGo: "Next",
    feedShooting: "shooting",
    feedChooseFirst: "choose first",
    feedOpenFull: "Open full screen",
    feedCapShooting: "The speaker will say when the episode is ready.",
    feedCapWaiting: "Guess the option, rate the episode — then press “Next”. The feed doesn't move on by itself.",
    feedCapChosen: "Episode {n} will show both branches — you'll see if you guessed right.",
    feedCapWish: "Wishes for the next episode go in the field above.",
    feedNoAnswer: "“Feed” isn't answering: {problem}",
  },
};
const tx = (key, params) => t(T, key, params);

/**
 * Долгие задачи движка по видам: заголовок на обоих языках (движок называет задачу на языке дома), дорожка и слова,
 * пока задача идёт. Дорожки — съёмка и отправка: идут сразу, на каждой — одна работа.
 */
const TASKS = {
  shoot: { ru: "Снять серию", en: "Shoot an episode", lane: "shoot", running: "taskShooting" },
  shareFile: { ru: "Файл для отправки", en: "File to send", lane: "share", running: "taskShareFile" },
  card: { ru: "Карточка серии", en: "Episode card", lane: "share", running: "taskCard" },
  revoice: { ru: "Переозвучить серию", en: "Re-voice the episode", lane: "shoot", running: "taskRevoice" },
  ownVoice: { ru: "Свой голос в серии", en: "Your voice in the episode", lane: "shoot", running: "taskOwnVoice" },
  telegram: { ru: "Публикация в Telegram", en: "Publishing to Telegram", lane: "share", running: "taskTelegram" },
  watch: { ru: "Ссылка «смотри и выбирай»", en: "“Watch and choose” link", lane: "share", running: "taskWatch" },
};
const kindOf = (title) => Object.keys(TASKS).find((kind) => TASKS[kind].ru === title || TASKS[kind].en === title) ?? null;
const laneOf = (title) => TASKS[kindOf(title)]?.lane ?? "shoot";
const runningText = (title) => (kindOf(title) ? tx(TASKS[kindOf(title)].running) : title);
/** Примеры команд для поля ввода — на языке пульта (движок понимает команды и по-английски). */
const hints = () => [tx("hint1"), tx("hint2"), tx("hint3"), tx("hint4"), tx("hint5")];
const ASKING = /«да»|разреш|“yes”/i;

// ——— Вид ———

const STYLE = `
.fd { display: flex; flex-direction: column; gap: 14px; font-size: 14px; line-height: 20px; color: var(--text); min-width: 0; }
.fd-display { margin: 0; font-family: 'Inter Tight', 'Inter', system-ui, sans-serif; font-weight: 300; font-size: 28px; line-height: 1.16; letter-spacing: -0.02em; }
.fd-label { font-size: 12px; line-height: 18px; color: var(--sub); }
.fd-lead { margin: 0; color: var(--sub); }
.fd-h { font-size: 16px; line-height: 24px; font-weight: 500; }
.fd-cap { font-size: 12px; line-height: 16px; color: var(--sub); }
.fd-section { display: flex; flex-direction: column; gap: 8px; }
.fd-card { background: var(--field-bg, #fff); border-radius: 16px; box-shadow: 0 0 0 1px var(--glass-border); padding: 12px; }
.fd-soft { background: var(--chip-bg); border-radius: 16px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.fd-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fd-grow { flex: 1; min-width: 0; }

.fd-btn { height: 44px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; background: var(--field-bg, #fff); color: var(--text); border: 1px solid var(--glass-border); text-decoration: none; white-space: nowrap; }
.fd-btn:hover:not(:disabled) { background: var(--hover-bg); }
.fd-btn:disabled { opacity: 0.5; cursor: default; }
.fd-btn.is-small { height: 32px; padding: 0 12px; font-size: 13px; }
.fd-btn.is-ink { background: var(--ink-bg); color: var(--ink-fg); border-color: transparent; }
.fd-btn.is-ink:hover:not(:disabled) { background: var(--ink-hi); }
.fd-btn.is-danger { color: #b91c1c; }
html[data-theme='dark'] .fd-btn.is-danger { color: #f87171; }
.fd-btn[aria-pressed='true'].is-like { background: #15803d; border-color: #15803d; color: #fff; }
.fd-btn[aria-pressed='true'].is-dislike { background: #b91c1c; border-color: #b91c1c; color: #fff; }
.fd-round { width: 44px; height: 44px; padding: 0; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--field-bg, #fff); color: var(--text); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
.fd-round:hover:not(:disabled) { background: var(--hover-bg); }
.fd-round:disabled { opacity: 0.4; cursor: default; }
.fd-round.is-small { width: 32px; height: 32px; }
.fd-go { width: 100%; height: 48px; border-radius: 999px; border: 0; background: var(--accent); color: var(--on-accent); box-shadow: var(--talk-shadow); font: inherit; font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.fd-go:hover:not(:disabled) { background: var(--accent-hi); box-shadow: var(--talk-shadow-hi); }
.fd-go:disabled { background: var(--track); color: var(--sub); box-shadow: none; cursor: default; }
.fd-go small { font-size: 13px; font-weight: 400; opacity: 0.72; }

.fd-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 1px; }
.fd-chips::-webkit-scrollbar { display: none; }
.fd-chips.is-wrap { flex-wrap: wrap; overflow: visible; }
.fd-chip { flex: none; height: 32px; padding: 0 12px; border-radius: 999px; border: 0; background: var(--chip-bg); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.fd-chip:hover { box-shadow: 0 0 0 1px var(--glass-border); }
.fd-chip[aria-pressed='true'] { background: var(--ink-bg); color: var(--ink-fg); }
.fd-badge { font-size: 11px; line-height: 14px; padding: 3px 8px; border-radius: 999px; background: var(--chip-bg); color: var(--text); white-space: nowrap; flex: none; }
.fd-badge.is-ok { background: var(--pill-own-bg); color: var(--pill-own-fg); }
.fd-badge.is-warn { background: var(--pill-yandex-bg); color: var(--pill-yandex-fg); }
.fd-badge.is-agent { background: var(--pill-agent-bg); color: var(--pill-agent-fg); }
.fd-badge.is-ink { background: var(--ink-bg); color: var(--ink-fg); }

.fd-option { width: 100%; text-align: left; cursor: pointer; padding: 10px 14px; border-radius: 16px; background: var(--field-bg, #fff); color: var(--text); border: 1px solid var(--glass-border); margin: 1px 0; font: inherit; display: flex; flex-direction: column; gap: 2px; }
.fd-option:hover:not(:disabled) { background: var(--hover-bg); }
.fd-option:disabled { opacity: 0.5; cursor: default; }
.fd-option[aria-pressed='true'] { border: 2px solid var(--ink-bg); margin: 0; }
.fd-option-head { display: flex; align-items: center; gap: 8px; }
.fd-option-title { font-size: 15px; line-height: 22px; font-weight: 500; flex: 1; min-width: 0; }
.fd-option-sub { font-size: 13px; line-height: 18px; color: var(--sub); }
.fd-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

.fd-field { height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--field-bg, #fff); color: var(--text); font: inherit; font-size: 14px; min-width: 0; flex: 1 1 160px; }
select.fd-field { padding-right: 10px; }
.fd-ask { position: relative; }
.fd-ask input { width: 100%; box-sizing: border-box; height: 48px; border-radius: 16px; border: 1px solid var(--glass-border); background: var(--field-bg, #fff); color: var(--text); font: inherit; font-size: 14px; padding: 0 56px 0 14px; }
.fd-ask button { position: absolute; right: 6px; top: 6px; width: 36px; height: 36px; border-radius: 999px; border: 0; background: var(--accent); color: var(--on-accent); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.fd-ask button:disabled { background: var(--track); color: var(--sub); cursor: default; }

.fd-stories { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.fd-story { position: relative; aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; border: 0; padding: 0; margin: 0; cursor: pointer; background: #111; color: #fff; text-align: left; font: inherit; outline: 2px solid transparent; outline-offset: 2px; transition: outline-color 0.15s, transform 0.15s; }
.fd-story img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 0%; }
.fd-story::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.8)); }
.fd-story-text { position: absolute; left: 10px; right: 10px; bottom: 9px; z-index: 1; display: flex; flex-direction: column; gap: 1px; }
.fd-story-title { font-weight: 500; font-size: 14px; line-height: 18px; }
.fd-story-sub { font-size: 11px; line-height: 14px; opacity: 0.8; }
.fd-story[aria-pressed='true'] { outline-color: var(--ink-bg); }
.fd-story:hover { transform: translateY(-1px); }
.fd-voice { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 16px; background: var(--field-bg, #fff); color: var(--text); border: 1px solid var(--glass-border); margin: 1px 0; cursor: pointer; font: inherit; text-align: left; }
.fd-voice:hover { background: var(--hover-bg); }
.fd-voice[aria-pressed='true'] { border: 2px solid var(--ink-bg); margin: 0; }
.fd-play { width: 32px; height: 32px; border-radius: 999px; background: var(--ink-bg); color: var(--ink-fg); display: flex; align-items: center; justify-content: center; flex: none; }
.fd-ask-rights { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--pill-own-bg); color: var(--text); }
.fd-ask-rights > span { flex: 1; min-width: 0; }
.fd-note { margin: 0; font-size: 13px; line-height: 18px; padding: 10px 12px; border-radius: 14px; background: var(--chip-bg); }
.fd-note.is-warn { background: var(--pill-yandex-bg); color: var(--text); }
.fd-said { margin: 0; padding: 10px 14px; border-radius: 16px; background: var(--chip-bg); font-size: 13px; line-height: 18px; }

.fd-main { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.fd-player { position: relative; flex: 0 0 196px; aspect-ratio: 9 / 16; border-radius: 16px; overflow: hidden; background: #000; color: #fff; }
.fd.is-page .fd-player { flex-basis: 320px; }
.fd-player video { width: 100%; height: 100%; object-fit: cover; display: block; }
.fd-player-empty { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; font-size: 12px; opacity: 0.8; }
.fd-mine { position: absolute; top: 14%; left: 50%; transform: translateX(-50%); padding: 4px 10px; border-radius: 6px; background: #ffd400; color: #000; font-weight: 800; font-size: 11px; letter-spacing: 0.05em; white-space: nowrap; pointer-events: none; }
.fd-full { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: rgb(0 0 0 / 0.5); color: #fff; cursor: pointer; }
.fd-full:hover { background: rgb(0 0 0 / 0.72); }
.fd-full:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.fd-info { flex: 1 1 240px; min-width: 220px; display: flex; flex-direction: column; gap: 14px; }
.fd-logline { margin: 4px 0 0; }
.fd-nav { display: flex; align-items: center; gap: 6px; color: var(--sub); font-size: 12px; }
.fd-foot { display: flex; gap: 8px; align-items: center; }
.fd-foot .fd-go { flex: 1; width: auto; height: 44px; }

.fd-steps { padding: 4px 14px; }
.fd-step { display: flex; flex-direction: column; gap: 6px; padding: 9px 0; }
.fd-step + .fd-step { border-top: 1px solid var(--row-line, var(--divider)); }
.fd-step-head { display: flex; align-items: center; gap: 10px; }
.fd-step-mark { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex: none; color: var(--bar-own); }
.fd-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--bar-own); }
.fd-dot.is-agent { background: var(--bar-agent); }
.fd-ring { width: 10px; height: 10px; border-radius: 999px; border: 1.5px solid var(--mute, rgba(0, 0, 0, 0.38)); box-sizing: border-box; }
.fd-step.is-todo { color: var(--sub); }
.fd-step.is-now .fd-step-title { font-weight: 500; }
.fd-step-title { flex: 1; min-width: 0; }
.fd-step-time { font-size: 12px; color: var(--sub); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-step-detail { font-size: 12px; line-height: 16px; color: var(--sub); margin-left: 28px; }
.fd-step .fd-bar { margin-left: 28px; }
.fd-bar { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; }
.fd-bar > span { display: block; width: 100%; height: 100%; border-radius: 999px; background: var(--ink-bg); transform-origin: left center; transition: transform 0.4s linear; }
@keyframes fd-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.65); opacity: 0.55; } }
.fd-step.is-now .fd-dot { animation: fd-pulse 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .fd-step.is-now .fd-dot { animation: none; } }
.fd-world { display: flex; gap: 12px; }
.fd-world img { width: 84px; height: 150px; object-fit: cover; border-radius: 10px; flex: none; background: #111; }
.fd-world-facts { display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 18px; min-width: 0; }
.fd-world-key { color: var(--sub); }
.fd-next { position: relative; border-radius: 16px; overflow: hidden; background: #0f2a2d; color: #f5f3f1; }
.fd-next-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.28; filter: blur(6px); transform: scale(1.08); }
.fd-next-body { position: relative; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.fd-next .fd-label, .fd-next .fd-step-time, .fd-next .fd-step-detail { color: rgba(245, 243, 241, 0.7); }
.fd-next .fd-steps { padding: 0; }
.fd-next .fd-step + .fd-step { border-top-color: rgba(245, 243, 241, 0.12); }
.fd-next .fd-step.is-todo { color: rgba(245, 243, 241, 0.6); }
.fd-next .fd-step-mark { color: #b6f36a; }
.fd-next .fd-dot { background: #b6f36a; }
.fd-next .fd-dot.is-agent { background: #a78bfa; }
.fd-next .fd-ring { border-color: rgba(245, 243, 241, 0.6); }
.fd-next .fd-bar { background: rgba(245, 243, 241, 0.16); }
.fd-next .fd-bar > span { background: #b6f36a; }
.fd-next .fd-btn { background: transparent; color: #f5f3f1; border-color: rgba(245, 243, 241, 0.3); }
.fd-next .fd-btn:hover:not(:disabled) { background: rgba(245, 243, 241, 0.08); }
.fd-next .fd-btn.is-danger { color: #fca5a5; }
.fd-prev { display: flex; gap: 10px; align-items: center; padding: 8px; }
.fd-prev img { width: 40px; height: 71px; object-fit: cover; border-radius: 8px; background: #111; flex: none; }
.fd-seg { display: flex; padding: 4px; border-radius: 999px; background: var(--track); gap: 4px; }
.fd-seg button { flex: 1; height: 36px; border-radius: 999px; border: 0; background: transparent; color: var(--seg-off-fg, var(--sub)); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.fd-seg button[aria-pressed='true'] { background: var(--seg-on-bg, #fff); color: var(--seg-on-fg, var(--text)); box-shadow: var(--seg-shadow); }
.fd-preview { display: flex; gap: 12px; align-items: center; }
.fd-preview img { width: 54px; height: 96px; object-fit: cover; border-radius: 10px; background: #111; flex: none; }
.fd-amber { background: var(--pill-yandex-bg); border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.fd-amber-dot { width: 8px; height: 8px; border-radius: 999px; background: #d97706; margin-top: 5px; flex: none; }
.fd-head { display: flex; align-items: center; gap: 8px; }
.fd-head > b { flex: 1; font-size: 16px; line-height: 24px; font-weight: 500; }
.fd-rows { display: flex; flex-direction: column; }
.fd-set { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 0; flex-wrap: wrap; }
.fd-rows > .fd-set + .fd-set { border-top: 1px solid var(--row-line, var(--divider)); }
.fd-set-name { width: 84px; flex: none; color: var(--sub); }
.fd-set-value { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fd-switch-text { flex: 1; min-width: 0; color: var(--sub); font-size: 13px; line-height: 18px; cursor: pointer; }
.fd-taste { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
@media (max-width: 460px) {
  .fd-player { flex-basis: 100%; max-width: 300px; margin: 0 auto; }
  .fd-info { min-width: 0; flex-basis: 100%; }
  .fd-modes { grid-template-columns: 1fr; }
  .fd-set-name { width: 70px; }
  .fd-display { font-size: 26px; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("fd-style")) {
  const style = document.createElement("style");
  style.id = "fd-style";
  style.textContent = STYLE;
  document.head.appendChild(style);
}

// ——— Значки (линия 1,8, как в макете) ———

const PATHS = {
  gear: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"],
  x: ["M18 6L6 18M6 6l12 12"],
  share: ["M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"],
  check: ["M20 6L9 17l-5-5"],
  prev: ["M15 18l-6-6 6-6"],
  next: ["M9 6l6 6-6 6"],
  expand: ["M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"],
  send: ["M5 12h14M13 6l6 6-6 6"],
  refresh: ["M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"],
  plus: ["M12 5v14M5 12h14"],
};

function icon(name, size = 16, width = 1.8) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
    PATHS[name].map((d) => h("path", { key: d, d })),
  );
}

const playIcon = () => h("svg", { width: 12, height: 12, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" }, h("path", { d: "M7 4v16l13-8z" }));

// ——— Мелкое ———

/** Кнопка в языке макета: `kind` — "ink", "danger", "like", "dislike"; `small` — 32 точки. */
const btn = (label, onClick, extra = {}) =>
  h(
    "button",
    {
      type: "button",
      class: `fd-btn${extra.kind ? ` is-${extra.kind}` : ""}${extra.small ? " is-small" : ""}`,
      onClick,
      disabled: extra.disabled,
      "aria-pressed": extra.pressed,
      "aria-label": extra.aria,
      title: extra.aria,
    },
    extra.icon && icon(extra.icon),
    label,
  );
const round = (name, onClick, aria, extra = {}) =>
  h("button", { type: "button", class: `fd-round${extra.small ? " is-small" : ""}`, onClick, disabled: extra.disabled, "aria-label": aria, title: aria }, icon(name, extra.small ? 14 : 18));
const note = (text, warn) => text && h("p", { class: `fd-note${warn ? " is-warn" : ""}` }, text);
const set = (name, ...value) => h("div", { class: "fd-set" }, h("span", { class: "fd-set-name" }, name), h("div", { class: "fd-set-value" }, ...value));
/** Переключатель с видимой подписью (у Switch она только для чтения с экрана); подпись тоже переключает. */
const toggle = (on, text, onChange) => [h(Switch, { on, label: text, onChange }), h("span", { class: "fd-switch-text", onClick: () => onChange(!on) }, text)];

const lookImage = (look) => `/media/packages/${ID}/looks/${look}.jpg`;
/** Имя голоса с большой буквы: голоса компьютера приходят именем файла («denis»). */
const cap = (text) => (text ? String(text)[0].toUpperCase() + String(text).slice(1) : text);

function bytes(n) {
  if (!n) return tx("sizeMb", { n: 0 });
  return n > 1024 ** 3 ? tx("sizeGb", { n: (n / 1024 ** 3).toFixed(1) }) : tx("sizeMb", { n: Math.round(n / 1024 ** 2) });
}

function clock(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Цена на «Далее»: что стоит следующая серия. */
function price(status) {
  const voice = status.voice ?? {};
  return [voice.kind === "elevenlabs" ? tx("priceCredits") : tx("priceFree"), status.mode === "director" ? tx("timeDirector") : tx("timeUsual")].join(" · ");
}

/** Ответ движка «уже идёт другая работа» — словами. */
const busyText = (answer) => (answer?.busy ? tx("busyWait", { what: runningText(answer.busy).toLowerCase() }) : null);

const modelValue = (pick) => (!pick ? "" : pick === "fast" ? "fast" : `${pick.provider}|${pick.model}`);
const modelOf = (value) => {
  if (!value) return null;
  if (value === "fast") return "fast";
  const [provider, ...rest] = value.split("|");
  return { provider, model: rest.join("|") };
};

/** Секунды для живого «идёт 1:10»: тикает, пока `active`. */
function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

// ——— Данные ———

function useFeed() {
  const api = useApi(ID);
  const { version, go } = usePanelState();
  const { task, tasks, ready } = useTask();
  const [status, setStatus] = useState(null);
  const [problem, setProblem] = useState(null);
  const reload = () =>
    api
      .call("status")
      .then((next) => {
        setStatus(next);
        setProblem(null);
      })
      .catch((error) => setProblem(error.message));
  // Перемена любой своей задачи (их может идти две) и новый шаг съёмки (мир сериала готов после сценария) —
  // данные перечитываются.
  const tasksKey = (tasks ?? []).map((one) => `${one.id}:${one.state}:${one.state === "running" ? Math.floor((one.percent ?? 0) / 24) : ""}`).join(",");
  useEffect(() => {
    reload();
  }, [version, tasksKey]);
  return { api, go, task, tasks: tasks ?? [], ready, status, setStatus, problem, reload };
}

/** Модели пульта, голоса и «да» приложения — для знакомства и настроек. */
function useChoices(api) {
  const [models, setModels] = useState(null);
  const [voices, setVoices] = useState(null);
  const [access, setAccess] = useState(null);
  const load = () => {
    api.call("models").then(setModels).catch((error) => setModels({ models: [], problem: error.message }));
    api.call("voices").then(setVoices).catch((error) => setVoices([{ problem: error.message }]));
    rights().then(setAccess).catch(() => setAccess(null));
  };
  useEffect(() => {
    load();
  }, []);
  return { models, voices, access, setAccess, load };
}

// ——— Выбор: модель, голос, как снимать, память, «да» ———

function ModelPick({ models, pick, onPick, go }) {
  if (!models) return h("span", { class: "fd-cap" }, "…");
  const list = models.models ?? [];
  if (!list.length && !models.ready) {
    const asking = ASKING.test(models.problem ?? "");
    return h("div", { class: "fd-row" }, h("span", { class: "fd-cap fd-grow" }, asking ? tx("afterAllow") : tx("modelNone")), !asking && btn(tx("connect"), () => go("character", "brain"), { small: true, kind: "ink" }));
  }
  const find = (one) => one && list.find((model) => model.provider === one.provider && model.model === one.model);
  const active = pick === "fast" ? find(models.fast) : pick ? find(pick) : find(models.smart);
  return h(
    "div",
    { class: "fd-row" },
    h(
      "select",
      { class: "fd-field", value: modelValue(pick), onChange: (event) => onPick(modelOf(event.target.value)), "aria-label": tx("modelAria") },
      h("option", { value: "" }, `${tx("modelSmart")}${models.smart ? ` — ${models.smart.model}` : ""}`),
      h("option", { value: "fast" }, `${tx("modelFast")}${models.fast ? ` — ${models.fast.model}` : ""}`),
      pick && pick !== "fast" && !find(pick) && h("option", { value: modelValue(pick) }, tx("modelGone", { model: pick.model })),
      list.map((one) => h("option", { key: `${one.provider}|${one.model}`, value: `${one.provider}|${one.model}` }, `${one.model} · ${one.title}${one.cloud ? ` · ${tx("cloud")}` : ""}`)),
    ),
    active?.cloud && h("span", { class: "fd-badge is-warn" }, tx("inCloud")),
  );
}

/** Голоса карточками, как в макете: нажали — выбран и читает начало истории; лицензия — бейджем. */
function VoicePick({ api, voices, voice, onPick, pitch, go, withKey = true }) {
  const [sample, setSample] = useState(null);
  const [more, setMore] = useState(false);
  const [problem, setProblem] = useState(null);
  const src = useMedia(sample);
  if (!voices) return h("span", { class: "fd-cap" }, "…");
  const list = voices.filter((one) => !one.problem);
  const trouble = voices.find((one) => one.problem)?.problem;
  if (!list.length) {
    const asking = ASKING.test(trouble ?? "");
    if (asking) return h("span", { class: "fd-cap" }, tx("afterAllow"));
    return h(
      "div",
      { class: "fd-soft" },
      h("div", { class: "fd-row" }, h("span", { class: "fd-grow" }, tx("voiceNone")), btn(tx("voiceAdd"), () => go("character", "voice"), { small: true, kind: "ink" })),
      // Ключ ElevenLabs — у шлюза, на той же странице «Голос» пульта («Облачные голоса»): «Лента» его не видит.
      withKey && h("span", { class: "fd-cap" }, problem ?? tx("voiceKeyHint")),
    );
  }
  const current = list.find((one) => one.id === voice?.id) ?? null;
  const gone = voice?.id && !current;
  const pickVoice = (one) => {
    onPick(one);
    if (one.kind !== "computer") return;
    setSample(null);
    setProblem(null);
    api.call("sample", { voice: one, text: (pitch || "").slice(0, 200) }).then((answer) => setSample(answer?.file ?? null)).catch((error) => setProblem(error.message));
  };
  const shown = more ? list : list.slice(0, 3);
  const rest = list.length - shown.length;
  return h(
    "div",
    { class: "fd-section", style: { gap: "6px" } },
    gone && h("span", { class: "fd-badge is-warn", style: { alignSelf: "flex-start" } }, tx("voiceGone", { name: cap(voice.title ?? voice.id) })),
    shown.map((one) =>
      h(
        "button",
        { type: "button", key: one.id, class: "fd-voice", "aria-pressed": current?.id === one.id, onClick: () => pickVoice(one) },
        h("span", { class: "fd-play" }, playIcon()),
        h(
          "span",
          { class: "fd-grow", style: { display: "flex", flexDirection: "column" } },
          h("span", { style: { fontWeight: 500 } }, cap(one.title ?? one.id)),
          h("span", { class: "fd-cap" }, [one.kind === "computer" ? tx("voiceOnComputer") : one.kind === "cloud" ? tx("cloud") : "ElevenLabs", one.license].filter(Boolean).join(" · ")),
        ),
        h("span", { class: `fd-badge ${one.publish ? "is-ok" : "is-warn"}` }, one.publish ? tx("voicePublish") : tx("voiceSelfOnly")),
      ),
    ),
    rest > 0 && h("button", { type: "button", class: "fd-voice", onClick: () => setMore(true) }, h("span", { class: "fd-grow", style: { fontWeight: 500 } }, tx("voiceMore", { count: rest })), icon("next")),
    src && h("audio", { key: src, src, autoPlay: true, style: { display: "none" } }),
    problem && h("span", { class: "fd-cap" }, problem),
  );
}

function ModePick({ mode, onPick }) {
  const card = (id, title, text, meta, badge) =>
    h(
      "button",
      { type: "button", class: "fd-option", "aria-pressed": (mode === "director") === (id === "director"), onClick: () => onPick(id) },
      h("span", { class: "fd-option-head" }, h("span", { class: "fd-option-title" }, title), badge && h("span", { class: "fd-badge is-agent" }, badge)),
      h("span", { style: { fontSize: "13px", lineHeight: "18px" } }, text),
      h("span", { class: "fd-option-sub", style: { fontSize: "12px" } }, meta),
    );
  return h(
    "div",
    { class: "fd-modes" },
    card("data", tx("modeDataTitle"), tx("modeDataText"), tx("modeDataMeta")),
    card("director", tx("modeDirectorTitle"), tx("modeDirectorText"), tx("modeDirectorMeta"), tx("modeDirectorBadge")),
  );
}

/** Все «да» приложения одним листом: модель, голос, сообщения, память… */
function RightsBar({ access, onAsked }) {
  const [problem, setProblem] = useState(null);
  if (!access?.pending) return null;
  const words = access.asked
    .filter((one) => !one.allowed)
    .map((one) => one.words)
    .join(", ");
  const allow = () =>
    askRights()
      .then((next) => onAsked(next))
      .catch((error) => setProblem(error.message));
  return h(
    "div",
    { class: "fd-ask-rights" },
    h("span", null, h("b", null, tx("rightsTitle")), h("br"), h("span", { class: "fd-cap" }, problem ?? words)),
    btn(tx("allow"), allow, { kind: "ink", small: true }),
  );
}

// ——— Знакомство одним экраном ———

function Stories({ api, lang, story, onPick, own, onOwn }) {
  const [stories, setStories] = useState(null);
  const more = () =>
    api
      .call("stories", { lang })
      .then((list) => {
        setStories(list ?? []);
        if (list?.[0] && !own.trim()) onPick(list[0]);
      })
      .catch(() => setStories([]));
  useEffect(() => {
    more();
  }, []);
  const picked = stories?.find((one) => one.id === story?.id);
  return h(
    "div",
    { class: "fd-section" },
    h("div", { class: "fd-row" }, h("span", { class: "fd-label fd-grow" }, tx("storyLabel")), btn(tx("storyMore"), more, { small: true, icon: "refresh" })),
    h(
      "div",
      { class: "fd-stories" },
      (stories ?? [null, null, null]).map((one, index) =>
        one
          ? h(
              "button",
              { type: "button", key: one.id, class: "fd-story", "aria-pressed": !own.trim() && story?.id === one.id, onClick: () => (onPick(one), onOwn("")) },
              h("img", { src: `/media/packages/${ID}/${one.frame.replace(/^assets\//, "")}`, alt: "" }),
              h("span", { class: "fd-story-text" }, h("span", { class: "fd-story-title" }, one.title), h("span", { class: "fd-story-sub" }, `${one.genre} · ${one.lookTitle}`)),
            )
          : h("div", { key: index, class: "fd-story", "aria-hidden": "true" }),
      ),
    ),
    !own.trim() &&
      picked &&
      h("div", { class: "fd-card", style: { display: "flex", flexDirection: "column", gap: "6px" } }, h("div", { class: "fd-row" }, h("span", { class: "fd-badge" }, `${picked.genre} · ${picked.lookTitle}`)), h("span", null, picked.pitch)),
    h("input", { class: "fd-field", style: { flex: "none" }, type: "text", placeholder: tx("storyOwnPlaceholder"), value: own, onInput: (event) => onOwn(event.target.value), "aria-label": tx("storyOwnAria") }),
  );
}

function Setup({ feed, again, busy, onDone, onBack }) {
  const { api, go, status } = feed;
  const choices = useChoices(api);
  const [story, setStory] = useState(null);
  const [own, setOwn] = useState("");
  const [mode, setMode] = useState(status.mode ?? "data");
  const [model, setModel] = useState(status.model ?? null);
  const [voice, setVoice] = useState(null);
  const [memory, setMemory] = useState(!!status.memory);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState(null);
  const voices = choices.voices?.filter((one) => !one.problem) ?? [];
  // Голос по умолчанию — прежний, если он есть на компьютере, иначе первый, который можно публиковать.
  const chosenVoice = voice ?? voices.find((one) => one.id === status.voice?.id) ?? voices.find((one) => one.kind === "computer" && one.publish) ?? voices[0] ?? null;
  const pitch = own.trim() || story?.pitch || "";
  const models = choices.models;
  const noModel = models && !models.ready && !(models.models ?? []).length && !ASKING.test(models.problem ?? "");

  const start = async () => {
    setStarting(true);
    setProblem(null);
    try {
      if (choices.access?.pending) {
        const next = await askRights();
        choices.setAccess(next);
        if (next.pending) throw new Error(tx("setupNeedYes"));
        choices.load();
      }
      const answer = again
        ? await api.call("newStory", { story: own.trim() ? null : story?.id, own })
        : await api.call("intro", { mode, story: own.trim() ? null : story?.id, own, voice: chosenVoice, model, memory, lang: status.lang });
      if (answer?.busy) throw new Error(busyText(answer));
      onDone();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setStarting(false);
    }
  };

  return h(
    "div",
    { class: "fd" },
    again
      ? h("div", { class: "fd-head" }, h("b", null, tx("newSeries")), btn(tx("back"), onBack, { small: true }))
      : h(
          "div",
          { class: "fd-section", style: { gap: "6px" } },
          h("span", { class: "fd-label" }, tx("setupLabel")),
          h("h2", { class: "fd-display" }, tx("setupTitle")),
          h("p", { class: "fd-lead" }, tx("setupLead")),
        ),
    h(Stories, { api, lang: status.lang, story, onPick: setStory, own, onOwn: setOwn }),
    !again && h("div", { class: "fd-section" }, h("span", { class: "fd-label" }, tx("setupVoice")), h(VoicePick, { api, voices: choices.voices, voice: chosenVoice, onPick: setVoice, pitch, go })),
    !again && h("div", { class: "fd-section" }, h("span", { class: "fd-label" }, tx("howToShoot")), h(ModePick, { mode, onPick: setMode })),
    !again && h("div", { class: "fd-section" }, h("span", { class: "fd-label" }, tx("whoWrites")), h(ModelPick, { models, pick: model, onPick: setModel, go })),
    !again && h("div", { class: "fd-row" }, ...toggle(memory, tx("memoryToggle"), setMemory)),
    h(RightsBar, { access: choices.access, onAsked: (next) => (choices.setAccess(next), choices.load()) }),
    note(problem, true),
    noModel && note(tx("setupNoModel"), true),
    busy && note(tx("setupBusy", { what: runningText(busy.title).toLowerCase() })),
    h(
      "button",
      { type: "button", class: "fd-go", disabled: starting || !pitch || noModel || !!busy, onClick: start },
      starting ? tx("setupStarting") : again ? tx("shootFirst") : tx("setupStart"),
      !starting && h("small", null, mode === "director" && !again ? tx("timeDirector") : tx("timeUsual")),
    ),
    !again && h("span", { class: "fd-cap", style: { textAlign: "center" } }, tx("setupVoiceHint")),
  );
}

// ——— Процесс создания ———

/** Шаги съёмки по ходу задачи: сценарий (до 24 %), голос (до 45 %), картинка (до 93 %), проверка. */
function stepsOf(task, { director, voiceTitle, n }) {
  const percent = task.percent ?? 0;
  const list = [
    { title: director ? tx("stepScriptDirector") : tx("stepScript"), from: 0, to: 24, done: n > 1 ? tx("stepScriptDoneNext") : tx("stepScriptDoneFirst") },
    { title: tx("stepVoice"), from: 24, to: 45, done: voiceTitle ? tx("stepVoiceBy", { name: cap(voiceTitle) }) : tx("stepVoiceDone") },
    { title: director ? tx("stepRender") : tx("stepPicture"), from: 45, to: 93, done: tx("stepPictureDone") },
    { title: tx("stepCheck"), from: 93, to: 100, done: tx("stepCheckWhat"), todo: tx("stepCheckWhat") },
  ];
  return list.map((step) => {
    const state = percent >= step.to ? "done" : percent >= step.from ? "now" : "todo";
    return { ...step, state, share: Math.max(0, Math.min(1, (percent - step.from) / (step.to - step.from))) };
  });
}

function Steps({ steps, task, director, elapsed }) {
  return h(
    "div",
    { class: "fd-steps" },
    steps.map((step) =>
      h(
        "div",
        { key: step.title, class: `fd-step is-${step.state}` },
        h(
          "div",
          { class: "fd-step-head" },
          h("span", { class: "fd-step-mark" }, step.state === "done" ? icon("check", 18, 2.2) : step.state === "now" ? h("span", { class: `fd-dot${director ? " is-agent" : ""}` }) : h("span", { class: "fd-ring" })),
          h("span", { class: "fd-step-title" }, step.state === "done" ? `${step.title} — ${step.done}` : step.state === "todo" && step.todo ? `${step.title} — ${step.todo}` : step.title),
          step.state === "now" && elapsed && h("span", { class: "fd-step-time" }, elapsed),
        ),
        step.state === "now" && task.text && h("div", { class: "fd-step-detail" }, task.text),
        step.state === "now" && step.share > 0.02 && h("div", { class: "fd-bar" }, h("span", { style: { transform: `scaleX(${step.share.toFixed(3)})` } })),
      ),
    ),
  );
}

/** Первая серия сериала: светлая карточка — «Снимаю «Сторожа», серию 1», мир сериала и шаги. */
function Building({ task, series, world, status, onStop }) {
  const now = useNow(true);
  const director = status.mode === "director";
  const elapsed = task.startedAt ? clock(now - task.startedAt) : null;
  const steps = stepsOf(task, { director, voiceTitle: status.voice?.title, n: 1 });
  return h(
    "div",
    { class: "fd-section", style: { gap: "12px" } },
    h("span", { class: "fd-label" }, tx("buildingLabel")),
    h("h2", { class: "fd-display" }, tx("buildingTitle", { title: series?.title ?? tx("buildingSeries") })),
    h(
      "div",
      { class: "fd-card fd-world" },
      series?.look && h("img", { src: lookImage(series.look), alt: "" }),
      h(
        "div",
        { class: "fd-world-facts" },
        h("b", { style: { fontWeight: 500 } }, tx("buildingWorld")),
        world?.length ? world.map((fact) => h("div", { key: fact.key }, h("span", { class: "fd-world-key" }, `${fact.key}: `), fact.value)) : h("div", null, series?.pitch ?? tx("buildingWorldPending")),
      ),
    ),
    h("div", { class: "fd-card", style: { padding: 0 } }, h(Steps, { steps, task, director, elapsed })),
    h("span", null, tx("buildingAway")),
    h(
      "div",
      { class: "fd-row" },
      h("span", { class: "fd-cap fd-grow" }, [tx("buildingHere"), director ? tx("modeDirector") : tx("modeUsual"), status.voice?.title ? tx("buildingVoice", { name: cap(status.voice.title) }) : null].filter(Boolean).join(" · ")),
      btn(task.cancelRequested ? tx("cancelling") : tx("cancel"), onStop, { kind: "danger", small: true, disabled: task.cancelRequested }),
    ),
  );
}

/** Следующая серия: тёмная панель с кадром прошлой серии — «Снимаю следующую серию» и шаги. */
function NextUp({ task, last, status, onStop }) {
  const now = useNow(true);
  const poster = useMedia(last?.poster);
  const director = status.mode === "director";
  const elapsed = task.startedAt ? clock(now - task.startedAt) : null;
  const steps = stepsOf(task, { director, voiceTitle: status.voice?.title, n: (last?.n ?? 0) + 1 });
  const fork = last?.choice && last?.chosen ? tx("nextFork", { n: last.n }) : null;
  const picked = last?.chosen && last?.choice ? tx("nextPicked", { mark: last.chosen === "a" ? "①" : "②", title: String(last.choice[last.chosen]?.title ?? "").toLowerCase() }) : null;
  const rated = last?.rating === "like" ? tx("nextLiked") : last?.rating === "dislike" ? tx("nextDisliked") : null;
  return h(
    "div",
    { class: "fd-section", style: { gap: "10px" } },
    last &&
      h(
        "div",
        { class: "fd-card fd-prev" },
        poster && h("img", { src: poster, alt: "" }),
        h("div", { class: "fd-grow", style: { display: "flex", flexDirection: "column" } }, h("span", { style: { fontWeight: 500 } }, tx("episodeOf", { title: last.title, n: last.n })), h("span", { class: "fd-cap" }, [picked, rated].filter(Boolean).join(" · ") || tx("nextPrevious"))),
      ),
    h(
      "div",
      { class: "fd-next" },
      poster && h("img", { class: "fd-next-bg", src: poster, alt: "" }),
      h(
        "div",
        { class: "fd-next-body" },
        h("span", { class: "fd-label" }, [tx("episodeN", { n: (last?.n ?? 0) + 1 }), fork].filter(Boolean).join(" · ")),
        h("h2", { class: "fd-display", style: { fontSize: "26px" } }, director ? tx("nextTitleDirector") : tx("nextTitle")),
        h(Steps, { steps, task, director, elapsed }),
        h(
          "div",
          { class: "fd-row" },
          h("span", { class: "fd-label fd-grow" }, [elapsed ? tx("nextElapsed", { time: elapsed }) : null, director ? tx("nextUsualDirector") : tx("nextUsual")].filter(Boolean).join(" · ")),
          btn(task.cancelRequested ? tx("cancelling") : tx("cancel"), onStop, { kind: "danger", small: true, disabled: task.cancelRequested }),
        ),
      ),
    ),
  );
}

/** Отправка — своей дорожкой: строка хода, как в макете «Поделиться». */
function SendRow({ task, onStop }) {
  const percent = Math.round(task.percent ?? 0);
  return h(
    "div",
    { class: "fd-card", style: { display: "flex", flexDirection: "column", gap: "8px", padding: "10px 14px" } },
    h("div", { class: "fd-row" }, h("span", { class: "fd-grow", style: { fontWeight: 500 } }, runningText(task.title)), h("span", { style: { fontWeight: 500, fontVariantNumeric: "tabular-nums" } }, tx("percent", { n: percent }))),
    h("div", { class: "fd-bar", role: "progressbar", "aria-valuenow": percent }, h("span", { style: { transform: `scaleX(${(Math.max(2, percent) / 100).toFixed(3)})` } })),
    h("div", { class: "fd-row" }, h("span", { class: "fd-cap fd-grow" }, task.text || "…"), btn(task.cancelRequested ? tx("cancelling") : tx("cancel"), onStop, { small: true, disabled: task.cancelRequested })),
  );
}

/** Задача дорожки: пульт её знает — «Отменить» отменяет её; пока не знает — просит движок. */
function Lane({ api, task, lane, render, onStopped, onProblem }) {
  const own = useTask(task.id ?? "—");
  const live = own.task ?? task;
  const stop = () => (own.task ? own.cancel() : api.call("cancel", { lane })).then(onStopped).catch((error) => onProblem(error.message));
  return render(live, stop);
}

// ——— Плеер ———

/** Значок «во весь экран»: углы рамки. */
const FULL_ICON = h(
  "svg",
  { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
  h("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }),
);

function Player({ episode, previous }) {
  const src = useMedia(episode?.file);
  const video = useRef(null);
  const [time, setTime] = useState(0);
  // «Во весь экран» — просмотрщик пульта, тем же движком показа: с той же секунды; закрыли — ролик здесь идёт оттуда.
  // Пульт постарше просмотрщика не знает — тогда кнопки нет.
  const full = typeof openMedia === "function" && src
    ? () => {
        const element = video.current;
        const at = element?.currentTime ?? 0;
        element?.pause();
        openMedia({ path: episode.file, title: episode.title ? tx("episodeOf", { title: episode.title, n: episode.n }) : undefined }, { at })
          .then((closed) => {
            if (closed?.at != null && video.current) video.current.currentTime = closed.at;
          })
          .catch(() => {});
      }
    : null;
  // «Ваш выбор» — на той ветке прошлой развилки, которую выбрал человек.
  const chosen = previous?.chosen ?? null;
  const times = episode?.branchTimes;
  let mine = null;
  if (chosen && times && episode.wrong) mine = chosen === episode.wrong ? times.wrong : times.right;
  const showMine = mine && time >= mine[0] && time <= mine[1];
  return h(
    "div",
    { class: "fd-player" },
    !episode?.file
      ? h("div", { class: "fd-player-empty" }, episode?.archived ? tx("playerArchived") : tx("playerNone"))
      : src
        ? h("video", { key: src, ref: video, src, controls: true, playsInline: true, preload: "metadata", onTimeUpdate: (event) => setTime(event.target.currentTime) })
        : h("div", { class: "fd-player-empty" }, "…"),
    showMine && h("div", { class: "fd-mine" }, tx("playerMine")),
    full && h("button", { type: "button", class: "fd-full", onClick: full, "aria-label": tx("playerFull"), title: tx("playerFull") }, FULL_ICON),
  );
}

// ——— Отправка ———

function Share({ api, episode, busy, onTask, onBack }) {
  const [problem, setProblem] = useState(null);
  const [voices, setVoices] = useState(null);
  const [tab, setTab] = useState("video");
  const [asIs, setAsIs] = useState(!!episode.voice?.publish);
  const [recording, setRecording] = useState(null);
  const poster = useMedia(episode.poster);
  useEffect(() => {
    api.call("voices").then(setVoices).catch(() => setVoices([]));
  }, []);
  const publishable = (voices ?? []).filter((one) => one.publish && !one.problem);
  const run = (call, input) =>
    api
      .call(call, input)
      .then((answer) => (answer?.busy ? setProblem(busyText(answer)) : onTask(answer?.task)))
      .catch((error) => setProblem(error.message));
  const recordOwn = async () => {
    try {
      const { lines } = await api.call("lines", { id: episode.id });
      const files = {};
      for (const [index, line] of lines.entries()) {
        const title = tx("shareLine", { n: index + 1, total: lines.length });
        setRecording(title);
        const taken = await record({ title, text: line.text, maxSeconds: 30 });
        files[line.id] = taken.file;
      }
      setRecording(null);
      run("ownVoice", { id: episode.id, files });
    } catch (error) {
      setRecording(null);
      setProblem(error.message);
    }
  };
  return h(
    "div",
    { class: "fd" },
    h("div", { class: "fd-head" }, h("b", null, tx("shareTitle", { n: episode.n })), round("x", onBack, tx("close"), { small: true })),
    h(
      "div",
      { class: "fd-seg", role: "group", "aria-label": tx("shareWhat") },
      h("button", { type: "button", "aria-pressed": tab === "video", onClick: () => setTab("video") }, tx("shareVideo")),
      h("button", { type: "button", "aria-pressed": tab === "card", onClick: () => setTab("card") }, tx("shareCard")),
    ),
    h(
      "div",
      { class: "fd-preview" },
      poster && h("img", { src: poster, alt: "" }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", lineHeight: "18px" } },
        h("b", { style: { fontWeight: 500 } }, tab === "video" ? tx("shareVideoTitle") : tx("shareCardTitle")),
        h("span", { class: "fd-cap" }, tab === "video" ? tx("shareVideoSub", { title: episode.title, n: episode.n }) : tx("shareCardSub")),
      ),
    ),
    !asIs &&
      h(
        "div",
        { class: "fd-amber" },
        h(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h("span", { class: "fd-amber-dot" }),
          h("span", { style: { fontSize: "13px", lineHeight: "18px" } }, tx("shareSelfOnly", { name: episode.voice?.title ?? tx("shareThisVoice"), license: episode.voice?.license ?? tx("shareNoLicense") })),
        ),
        h(
          "div",
          { class: "fd-row" },
          publishable.slice(0, 2).map((one) => btn(tx("shareRevoice", { name: one.title ?? one.id }), () => run("revoice", { id: episode.id, voice: one }), { small: true, kind: "ink" })),
          btn(recording ?? tx("shareOwnVoice"), recordOwn, { small: true, disabled: !!recording }),
          btn(
            tx("shareAsIs"),
            () => {
              api.call("shareChoice", { id: episode.id, choice: "как есть" }).catch(() => {});
              setAsIs(true);
            },
            { small: true },
          ),
        ),
      ),
    asIs &&
      h(
        "button",
        { type: "button", class: "fd-go", disabled: !!busy, onClick: () => run("prepareShare", { id: episode.id, kind: tab }) },
        tab === "video" ? tx("sharePrepareVideo") : tx("sharePrepareCard"),
        h("small", null, tx("sharePrepareThen")),
      ),
    asIs &&
      h(
        "div",
        { class: "fd-row" },
        btn(tx("shareTelegram"), () => run("publishTelegram", { id: episode.id }), { small: true, disabled: !!busy }),
        btn(tx("shareWatch"), () => run("watchLink", { id: episode.id }), { small: true, disabled: !!busy }),
      ),
    busy && h("span", { class: "fd-cap" }, tx("shareBusy", { what: runningText(busy.title).toLowerCase() })),
    episode.watch && h("span", { class: "fd-cap" }, tx("shareWatchExists", { path: episode.watch.path })),
    note(problem, true),
  );
}

// ——— Настройки внутри виджета ———

/**
 * ElevenLabs в настройках «Ленты»: ключ хранит шлюз и вставляется в пульте («Персонаж» → «Голос» → «Облачные
 * голоса»), «Лента» его не видит. Нет ключа — что это, куда идти и «Проверить» после возврата: голоса подгружаются
 * сразу, в список выше. Есть ключ — сколько голосов и сколько знаков осталось на тарифе.
 */
function ElevenBlock({ api, go, connected, onConnected }) {
  const locale = useLocale();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  useEffect(() => {
    if (connected) api.call("eleven").then(setInfo).catch((error) => setProblem(error.message));
  }, [connected]);
  const check = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const next = await api.call("eleven");
      setInfo(next);
      if (!next?.connected) throw new Error(next?.problem ?? tx("elevenNoKey"));
      if (next.problem) throw new Error(tx("elevenNoAnswer", { problem: next.problem }));
      await onConnected(next.voices ?? []);
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (connected || info?.connected) {
    const left = info?.balance?.limit ? Math.max(0, info.balance.limit - info.balance.used) : null;
    return h(
      "div",
      { class: "fd-soft" },
      h("div", { class: "fd-row" }, h("span", { class: "fd-badge is-ok" }, tx("elevenOn")), h("span", { class: "fd-cap fd-grow" }, info?.voices ? tx("elevenVoices", { count: info.voices.length }) : info?.problem ? "" : tx("elevenLoading"))),
      left !== null && h("span", { class: "fd-cap" }, tx("elevenLeft", { count: left, left: left.toLocaleString(locale), limit: info.balance.limit.toLocaleString(locale) })),
      (problem || info?.problem) && h("span", { class: "fd-cap" }, problem ?? info.problem),
    );
  }
  return h(
    "div",
    { class: "fd-soft" },
    h("span", { style: { fontSize: "13px", lineHeight: "18px" } }, h("b", { style: { fontWeight: 500 } }, "ElevenLabs"), tx("elevenAbout")),
    h("span", { class: "fd-cap" }, tx("elevenWhere")),
    h(
      "div",
      { class: "fd-row" },
      btn(tx("elevenOpenVoice"), () => go("character", "voice"), { small: true, kind: "ink" }),
      btn(busy ? tx("elevenChecking") : tx("elevenCheck"), check, { small: true, disabled: busy }),
    ),
    problem && h("span", { class: "fd-cap" }, problem),
  );
}

/**
 * Голоса сериала (engine/cast.mjs): рассказчик, второй голос (рация, телефон, угроза), персонажи. Первую серию модель
 * подбирает их сама; здесь — поменять. Меняется со следующей серии; готовые — «Переозвучить».
 */
function CastBlock({ api, series, voice, voices, onChanged }) {
  const [problem, setProblem] = useState(null);
  const list = (voices ?? []).filter((one) => !one.problem);
  if (!series || !list.length) return null;
  const cast = series.cast ?? {};
  const narrator = cast.narrator ?? voice;
  const set = (role, id) => {
    setProblem(null);
    const chosen = id ? list.find((one) => one.id === id) ?? null : null;
    api.call("cast", { series: series.id, role, voice: chosen }).then(onChanged).catch((error) => setProblem(error.message));
  };
  const pick = (role, current, label, { empty } = {}) =>
    h(
      "div",
      { class: "fd-row", key: role },
      h("span", { class: "fd-cap", style: { minWidth: "112px" } }, label),
      h(
        "select",
        { class: "fd-field fd-grow", value: current?.id ?? "", onChange: (event) => set(role, event.target.value), "aria-label": label },
        empty && h("option", { value: "" }, empty),
        current?.id && !list.some((one) => one.id === current.id) && h("option", { value: current.id }, tx("castGone", { name: cap(current.title ?? current.id) })),
        list.map((one) => h("option", { key: one.id, value: one.id }, `${cap(one.title ?? one.id)}${one.kind !== "computer" ? ` · ${tx("cloud")}` : ""}${one.publish ? "" : ` · ${tx("castSelf")}`}`)),
      ),
    );
  const characters = Object.entries(cast.characters ?? {});
  return h(
    "div",
    { class: "fd-section", style: { gap: "6px" } },
    h("span", { class: "fd-label" }, tx("castTitle", { title: series.title ?? "" })),
    pick("narrator", narrator, tx("castNarrator")),
    pick("second", cast.second, tx("castSecond"), { empty: tx("castSecondAuto") }),
    characters.map(([name, one]) => pick(`character:${name}`, one, tx("castCharacter", { name }), { empty: tx("castByNarrator") })),
    h("span", { class: "fd-cap" }, characters.length ? tx("castFromNext") : tx("castNone")),
    problem && h("span", { class: "fd-cap" }, problem),
  );
}

function Settings({ feed, onNewStory, onBack }) {
  const { api, go, status, setStatus } = feed;
  const choices = useChoices(api);
  const [taste, setTaste] = useState(null);
  const [problem, setProblem] = useState(null);
  useEffect(() => {
    api.call("taste").then(setTaste).catch(() => {});
  }, []);
  const change = (input) => api.call("configure", input).then(setStatus).catch((error) => setProblem(error.message));
  const wipe = async (what) => {
    if (!(await ask({ title: what === "all" ? tx("settingsForgetAllQ") : what === "wishes" ? tx("settingsForgetWishesQ") : tx("settingsForgetRatingsQ"), text: tx("settingsForgetText"), ok: tx("settingsForget"), danger: true }))) return;
    api.call("forget", { what }).then(setTaste).catch((error) => setProblem(error.message));
  };
  return h(
    "div",
    { class: "fd" },
    h("div", { class: "fd-head" }, h("b", null, tx("settingsTitle")), btn(tx("done"), onBack, { kind: "ink", small: true })),
    h(RightsBar, { access: choices.access, onAsked: (next) => (choices.setAccess(next), choices.load()) }),
    h(
      "div",
      { class: "fd-section" },
      h("span", { class: "fd-label" }, tx("settingsVoice")),
      h(VoicePick, { api, voices: choices.voices, voice: status.voice, onPick: (voice) => voice && change({ voice }), pitch: "", go, withKey: false }),
      h(ElevenBlock, {
        api,
        go,
        connected: !!status.keys?.elevenlabs,
        // Ключ вставили: голоса — в список; выбранного голоса на компьютере нет — «Лента» сразу берёт голос ElevenLabs.
        onConnected: async (voices) => {
          choices.load();
          const list = ((await api.call("voices").catch(() => [])) ?? []).filter((one) => !one.problem);
          const here = list.some((one) => one.id === status.voice?.id);
          if (!here && voices[0]) await change({ voice: voices[0] });
          else await feed.reload();
        },
      }),
    ),
    h(CastBlock, {
      api,
      series: (status.series ?? []).find((one) => one.id === status.current) ?? null,
      voice: status.voice,
      voices: choices.voices,
      onChanged: () => feed.reload(),
    }),
    h("div", { class: "fd-section" }, h("span", { class: "fd-label" }, tx("howToShoot")), h(ModePick, { mode: status.mode, onPick: (mode) => change({ mode }) })),
    h("div", { class: "fd-section" }, h("span", { class: "fd-label" }, tx("whoWrites")), h(ModelPick, { models: choices.models, pick: status.model ?? null, onPick: (model) => change({ model }), go })),
    h(
      "div",
      { class: "fd-rows" },
      set(tx("settingsMemory"), ...toggle(!!status.memory, tx("memoryToggle"), (memory) => change({ memory }))),
      status.memory && status.lastModel?.cloud && set("", h("span", { class: "fd-badge is-warn" }, tx("settingsMemoryCloud"))),
      set(tx("settingsAhead"), ...toggle(!!status.ahead, tx("settingsAheadText"), (ahead) => change({ ahead }))),
      set(tx("settingsNight"), ...toggle(!!status.night, tx("settingsNightText"), (night) => change({ night }))),
      set(
        tx("settingsKeep"),
        h("input", { class: "fd-field", type: "number", min: 3, max: 200, value: status.keep, style: { flex: "0 0 84px" }, onChange: (event) => change({ keep: Number(event.target.value) }), "aria-label": tx("settingsKeepAria") }),
        h("span", { class: "fd-cap fd-grow" }, tx("settingsKeepText", { count: Number(status.keep), size: bytes(status.videoBytes) })),
      ),
    ),
    h(
      "div",
      { class: "fd-soft" },
      h("b", { style: { fontWeight: 500, fontSize: "13px" } }, tx("settingsTaste")),
      !taste && h("span", { class: "fd-cap" }, "…"),
      taste && (taste.lines.length ? h("ul", { class: "fd-taste" }, taste.lines.map((line, index) => h("li", { key: index }, line))) : h("span", { class: "fd-cap" }, tx("settingsTasteNone"))),
      taste && h("div", { class: "fd-row" }, btn(tx("settingsForgetRatings"), () => wipe("ratings"), { small: true }), btn(tx("settingsForgetWishes"), () => wipe("wishes"), { small: true }), btn(tx("settingsForgetAll"), () => wipe("all"), { small: true, kind: "danger" })),
      h("span", { class: "fd-cap" }, tx("settingsTasteWhere")),
    ),
    h(
      "span",
      { class: "fd-cap" },
      tx("settingsSpent", { count: Number(status.budget?.spentCredits ?? 0), credits: status.budget?.spentCredits ?? 0, tokensIn: status.budget?.tokensIn ?? 0, tokensOut: status.budget?.tokensOut ?? 0 }),
    ),
    h("div", { class: "fd-row" }, btn(tx("settingsNewStory"), onNewStory, { icon: "plus" })),
    note(problem, true),
  );
}

// ——— Лента ———

/** Сколько развилок угадано: серия после развилки знает неверную ветку (`wrong`). */
function guessed(episodes) {
  let right = 0;
  let total = 0;
  for (const one of episodes) {
    if (!one.choice || !one.chosen) continue;
    const next = episodes.find((other) => other.after?.id === one.id);
    if (!next?.wrong) continue;
    total += 1;
    if (one.chosen !== next.wrong) right += 1;
  }
  return { right, total };
}

function Feed({ feed, page }) {
  const { api, go, task, tasks, ready, status, setStatus, reload } = feed;
  const [index, setIndex] = useState(null);
  const [view, setView] = useState("feed");
  const [text, setText] = useState("");
  const [said, setSaid] = useState(null);
  const [problem, setProblem] = useState(null);
  const [done, setDone] = useState(null);
  /** Законченные задачи, о которых окно уже знает: старые при открытии — не новость. */
  const seen = useRef(null);
  /** Пример команды в поле — номер, текст берётся при рисовании на языке пульта. */
  const hint = useRef(Math.floor(Math.random() * hints().length));
  const lookTitle = (id) => status.looks?.find((one) => one.id === id)?.title ?? id;

  // Задача закончилась (их может идти две): готова копия — сразу меню «Поделиться» пульта с текстом к посту.
  const doneKey = tasks
    .filter((one) => one.state === "done")
    .map((one) => one.id)
    .join(",");
  useEffect(() => {
    if (!ready) return;
    const finished = tasks.filter((one) => one.state === "done");
    if (seen.current === null) {
      seen.current = new Set(finished.map((one) => one.id));
      return;
    }
    for (const one of finished) {
      if (seen.current.has(one.id)) continue;
      seen.current.add(one.id);
      const kind = kindOf(one.title);
      if ((kind === "shareFile" || kind === "card") && one.result?.file && one.result?.id) {
        api
          .call("shareText", { id: one.result.id })
          .then((answer) => share({ file: one.result.file, text: answer?.text }))
          .catch((error) => setProblem(error.message));
      }
      if (kind === "shoot") setIndex(null);
      if (kind === "telegram") setDone(tx("feedDoneTelegram", { to: one.result?.to ?? "" }));
      if (kind === "watch" && one.result?.path) {
        setDone(tx("feedDoneWatch", { path: one.result.path }));
        share({ text: one.result.path }).catch(() => {});
      }
    }
  }, [ready, doneKey]);

  // Что идёт — по дорожкам: задача шлюза; пока пульт о ней не узнал — слово самого движка (status.lanes).
  const lane = (name) =>
    tasks.find((one) => one.state === "running" && laneOf(one.title) === name) ??
    (status.lanes?.[name] ? { id: null, title: status.lanes[name].title, percent: 0, text: "", cancelRequested: false } : null);
  const shooting = lane("shoot");
  const sharing = lane("share");

  if (!status.current || view === "story") return h(Setup, { feed, again: true, busy: shooting, onBack: () => setView("feed"), onDone: () => (setView("feed"), setIndex(null), reload()) });
  if (view === "settings") return h(Settings, { feed, onNewStory: () => setView("story"), onBack: () => setView("feed") });

  const series = status.series.find((one) => one.id === status.current) ?? null;
  const episodes = (status.episodes ?? []).filter((one) => one.series === status.current);
  const shown = Math.min(index ?? episodes.length - 1, episodes.length - 1);
  const episode = shown >= 0 ? episodes[shown] : null;
  const previous = episode ? episodes.find((one) => one.id === episode.after?.id) ?? episodes[shown - 1] : null;
  const last = shown === episodes.length - 1;
  const lastEpisode = episodes.at(-1) ?? null;
  const seasonEnd = status.seasonEnd && last;
  const waiting = last && episode?.choice && !episode.chosen;
  const recent = task && task.state !== "running" ? task : null;
  const score = seasonEnd ? guessed(episodes) : null;

  if (view === "share" && episode) return h(Share, { api, episode, busy: sharing, onBack: () => setView("feed"), onTask: () => (setView("feed"), reload()) });

  const act = (call, input) => api.call(call, input).then(reload).catch((error) => setProblem(error.message));
  const next = () => {
    setProblem(null);
    setSaid(null);
    api
      .call("next", {})
      .then((answer) => {
        if (answer?.busy) setProblem(busyText(answer));
        return reload();
      })
      .catch((error) => setProblem(error.message));
  };
  // Без <form>: окошко приложения — рамка без allow-forms, отправку формы браузер не пускает (и submit не приходит).
  const send = () => {
    const words = text.trim();
    if (!words) return;
    setProblem(null);
    api
      .call("command", { text: words, id: episode?.id })
      .then((answer) => {
        setSaid(answer?.say ?? null);
        setText("");
        if (answer?.did === "series" || answer?.did === "story" || answer?.did === "next") setIndex(null);
        return reload();
      })
      .catch((error) => setProblem(error.message));
  };
  const switchTo = (id) =>
    api
      .call("switchSeries", { id })
      .then((next) => (setIndex(null), setStatus(next)))
      .catch((error) => setProblem(error.message));
  const meta = episode
    ? [episode.durationSec ? tx("seconds", { n: Math.round(episode.durationSec) }) : null, String(lookTitle(episode.look) ?? "").toLowerCase() || null, String(series?.direction ?? "").split(":")[0].trim() || null, episode.mode === "code" ? tx("modeDirector") : tx("modeUsual")].filter(Boolean).join(" · ")
    : "";
  const second = () =>
    api
      .call("season", { action: "second" })
      .then((answer) => (answer?.busy ? setProblem(busyText(answer)) : reload()))
      .catch((error) => setProblem(error.message));

  return h(
    "div",
    { class: `fd${page ? " is-page" : ""}` },
    h(
      "div",
      { class: "fd-chips", role: "group", "aria-label": tx("feedSeries") },
      status.series.map((one) => h("button", { type: "button", key: one.id, class: "fd-chip", "aria-pressed": status.current === one.id, onClick: () => switchTo(one.id) }, `${one.title} · ${one.episodes}`)),
      h("button", { type: "button", class: "fd-chip", onClick: () => setView("story") }, icon("plus", 14), tx("newSeries")),
    ),
    sharing && h(Lane, { api, task: sharing, lane: "share", onStopped: reload, onProblem: setProblem, render: (live, stop) => h(SendRow, { task: live, onStop: stop }) }),
    shooting &&
      h(Lane, {
        api,
        task: shooting,
        lane: "shoot",
        onStopped: reload,
        onProblem: setProblem,
        render: (live, stop) =>
          kindOf(live.title) !== "shoot"
            ? h(SendRow, { task: live, onStop: stop })
            : lastEpisode
              ? h(NextUp, { task: live, last: lastEpisode, status, onStop: stop })
              : h(Building, { task: live, series, world: status.world, status, onStop: stop }),
      }),
    !shooting && !sharing && recent?.state === "failed" && note(tx("feedFailed", { title: recent.title, error: recent.error ?? "" }), true),
    !shooting && !sharing && recent?.state === "interrupted" && note(tx("feedInterrupted", { title: recent.title, error: recent.error ?? tx("feedRestarted") }), true),
    episode &&
      h(
        "div",
        { class: "fd-main" },
        h(Player, { episode, previous }),
        h(
          "div",
          { class: "fd-info" },
          h("div", null, h("div", { class: "fd-h" }, tx("episodeOf", { title: episode.title, n: episode.n })), meta && h("div", { class: "fd-label" }, meta), h("p", { class: "fd-logline" }, episode.logline)),
          episode.silent &&
            h(
              "div",
              { class: "fd-row" },
              h("span", { class: "fd-badge is-warn" }, tx("feedSilent")),
              btn(tx("feedVoiceIt"), () => api.call("revoice", { id: episode.id, voice: status.voice }).then((answer) => (answer?.busy ? setProblem(busyText(answer)) : reload())).catch((error) => setProblem(error.message)), { small: true, kind: "ink", disabled: !!shooting }),
            ),
          episode.note && h("span", { class: "fd-cap" }, episode.note),
          episode.choice &&
            h(
              "div",
              { class: "fd-section" },
              h("div", null, h("div", { class: "fd-label" }, tx("feedFork")), h("div", { class: "fd-h" }, episode.choice.q)),
              ["a", "b"].map((side) =>
                h(
                  "button",
                  { type: "button", key: side, class: "fd-option", "aria-pressed": episode.chosen === side, onClick: () => act("choose", { id: episode.id, value: side }) },
                  h("span", { class: "fd-option-head" }, h("span", { class: "fd-option-title" }, `${side === "a" ? "①" : "②"} ${episode.choice[side].title}`), episode.chosen === side && h("span", { class: "fd-badge is-ink" }, tx("feedYourChoice"))),
                  episode.choice[side].price && h("span", { class: "fd-option-sub" }, episode.choice[side].price),
                ),
              ),
              episode.publicVotes && h("span", { class: "fd-cap" }, tx("feedVotes", { a: episode.publicVotes.a, b: episode.publicVotes.b })),
            ),
          h(
            "div",
            { class: "fd-row" },
            btn(tx("feedLike"), () => act("rate", { id: episode.id, value: "like" }), { kind: "like", icon: "heart", pressed: episode.rating === "like" }),
            btn(tx("feedDislike"), () => act("rate", { id: episode.id, value: "dislike", reasons: episode.reasons ?? [] }), { kind: "dislike", icon: "x", pressed: episode.rating === "dislike" }),
          ),
          episode.rating === "dislike" &&
            h(
              "div",
              { class: "fd-chips is-wrap", role: "group", "aria-label": tx("feedWhatsWrong") },
              (status.reasons ?? []).map((reason) => {
                const on = (episode.reasons ?? []).includes(reason);
                return h(
                  "button",
                  { type: "button", key: reason, class: "fd-chip", "aria-pressed": on, onClick: () => act("rate", { id: episode.id, value: "dislike", reasons: on ? episode.reasons.filter((one) => one !== reason) : [...(episode.reasons ?? []), reason] }) },
                  // Причина — ключ данных (русский), словами — на языке дома, как их дал движок.
                  status.reasonTitles?.[reason] ?? reason,
                );
              }),
            ),
          episodes.length > 1 &&
            h(
              "div",
              { class: "fd-nav" },
              round("prev", () => setIndex(shown - 1), tx("feedPrev"), { small: true, disabled: shown <= 0 }),
              h("span", null, tx("feedPosition", { n: shown + 1, total: episodes.length })),
              round("next", () => setIndex(shown + 1), tx("feedNext"), { small: true, disabled: last }),
            ),
        ),
      ),
    !episode && !shooting && h("p", { class: "fd-lead" }, tx("feedEmpty")),
    seasonEnd &&
      h(
        "div",
        { class: "fd-section", style: { gap: "10px" } },
        h("div", { class: "fd-row" }, h("h2", { class: "fd-display fd-grow" }, tx("feedSeasonEnd")), score?.total ? h("span", { class: "fd-badge is-ok" }, tx("feedGuessed", { right: score.right, total: score.total })) : null),
        h("button", { type: "button", class: "fd-option", "aria-pressed": true, disabled: !!shooting, onClick: second }, h("span", { class: "fd-option-title" }, tx("feedSeason2")), h("span", { class: "fd-option-sub" }, tx("feedSeason2Sub"))),
        h("button", { type: "button", class: "fd-option", onClick: () => setView("story") }, h("span", { class: "fd-option-title" }, tx("feedOtherStory")), h("span", { class: "fd-option-sub" }, tx("feedOtherStorySub"))),
      ),
    h(
      "div",
      { class: "fd-ask" },
      h("input", {
        type: "text",
        enterkeyhint: "send",
        value: text,
        onInput: (event) => setText(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            send();
          }
        },
        placeholder: tx("feedAsk", { hint: hints()[hint.current] }),
        "aria-label": tx("feedAskAria"),
      }),
      h("button", { type: "button", disabled: !text.trim(), onClick: send, "aria-label": tx("feedSend") }, icon("send", 16, 2)),
    ),
    said && h("p", { class: "fd-said" }, said),
    h(
      "div",
      { class: "fd-foot" },
      episode && btn(tx("feedShare"), () => setView("share"), { icon: "share" }),
      !seasonEnd && h("button", { type: "button", class: "fd-go", disabled: !!shooting || waiting, onClick: next }, episode ? tx("feedGo") : tx("shootFirst"), h("small", null, shooting ? tx("feedShooting") : waiting ? tx("feedChooseFirst") : price(status))),
      seasonEnd && h("span", { class: "fd-grow" }),
      round("gear", () => setView("settings"), tx("settingsTitle")),
      !page && round("expand", () => go("feed"), tx("feedOpenFull")),
    ),
    !seasonEnd &&
      h(
        "span",
        { class: "fd-cap" },
        shooting
          ? tx("feedCapShooting")
          : waiting
            ? tx("feedCapWaiting")
            : episode?.chosen
              ? tx("feedCapChosen", { n: episode.n + 1 })
              : tx("feedCapWish"),
      ),
    done && note(done),
    note(problem, true),
  );
}

/** Корень окна — и раздела, и виджета стола: useLocale перерисовывает все тексты, когда человек сменил язык пульта. */
function FeedApp({ page }) {
  useLocale();
  const feed = useFeed();
  if (!feed.status) return h("div", { class: "fd" }, h("p", { class: "fd-lead" }, feed.problem ? tx("feedNoAnswer", { problem: feed.problem }) : "…"));
  if (!feed.status.introduced) return h(Setup, { feed, onDone: feed.reload });
  return h(Feed, { feed, page });
}

export default definePlugin({
  id: ID,
  // Подписи раздела и виджета — геттерами: на языке пульта в ту минуту, когда пульт их читает.
  sections: [{ id: "feed", get title() { return tx("appTitle"); }, icon: icons.sparkle, nav: "link", Screen: () => h(FeedApp, { page: true }) }],
  slots: {
    "desk.widgets": [{ id: "feed", get title() { return tx("appTitle"); }, icon: icons.sparkle, size: "large", initial: true, under: true, Component: () => h(FeedApp, {}) }],
  },
});
