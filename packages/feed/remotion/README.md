# Картинка «Ленты» (Remotion)

Серии 9:16 (1080×1920, 30 кадров/с) рисуются кодом. Здесь — всё, что движок собирает и рендерит: облики,
библиотека декораций, серия данными («Обычно»), серии режиссёра, копия для отправки. Сеть при рендере не нужна:
шрифты — из `../assets/fonts/`, знак ДиВи рисуется кодом.

```
root.tsx          makeRoot(directed) — все композиции
webpack.ts        webpackOverride: @feed → эта папка, модули — из node_modules пакета
lib/              kit (субтитры, звук, камера, плёнка, ①②), stage (Shot, Card), timeline, episode, fonts
looks/            шесть обликов: сцена-хук как мир (Scene) и образец (Hook); LOOKS — краски и рамка серии
sets/             декорации: storozh/, kompas/, look/; catalog.ts → catalog.json; SETS, SetView
data/             серия данными: types.ts (формат), times.ts (времена), DataEpisode.tsx
share/            копия для отправки, знак, плашка, заставка, карточка
examples/         14 серий теста как код режиссёра (образцы)
dev-entry.tsx     точка входа для Studio: всё + 14 образцов
dev/              smoke.mjs (проверка целиком), catalog.mjs, studio.config.js
```

## Как зовёт движок

```js
// точка входа (движок пишет сам)
import { registerRoot } from 'remotion';
import { makeRoot } from '<пакет>/remotion/root';
import * as e0 from '<files>/episodes/storozh-08/code/Episode';
registerRoot(makeRoot([e0]));

// сборка: public-папка — папка серий; staticFile('<id>/…') = <files>/episodes/<id>/…
await bundle({ entryPoint, publicDir: '<files>/episodes', webpackOverride, symlinkPublicDir: true });
```

`symlinkPublicDir: true` обязателен на macOS/Linux: без него сборка копирует всю папку серий (ролики по 20–80 МБ),
а файлы, появившиеся после сборки (`episode.mp4`, кадр для карточки), рендер не увидит. На Windows папка
копируется всегда — там собирать заново или класть новые файлы и в копию.

| Композиция | inputProps | Что |
|---|---|---|
| `look-ink` … `look-ascii` | — | образец облика, 6 с; кадр 90 → `assets/looks/<id>.jpg` |
| `<meta.id>` | — | серия режиссёра; длина — по озвучке, без озвучки — немой черновик |
| `data` | `{ episode: DataEpisode }` | серия данными; длина — по озвучке |
| `share` | `{ src, duration, choiceAt, lang }` | копия для отправки, длина `duration + 4 с`; рендер со `scale: 2/3` → 720p |
| `mark` | `{ position: 'left' \| 'right' }` | знак, прозрачный PNG во весь кадр |
| `plaque` | `{ lang }` | плашка «Пиши в комментариях: ① или ②», прозрачный PNG во весь кадр |
| `outro` | `{ lang }` | заставка 4 с (без звуковой дорожки) |
| `card` | `{ frame, title, n, q?, lang }` | карточка вместо ролика: кадр, «Название» · серия N, плашка, ДиВи |
| `set` | `{ id, state?, spot?, fx?, fy?, s?, t? }` | кадр одной декорации — проверить состояние и ракурс |

`src` и `frame` — пути в public-папке (`'storozh-01/episode.mp4'`); адрес, начинающийся с `/` или `http`, берётся как
есть. Знак: 212×163, 0–5 с слева посередине (x 28, y 878), ровно с 5-й секунды справа ниже (x 840, y 1460);
плашка — x 60, y 1436, с `choiceAt` до конца серии.

**Что calculateMetadata кладёт в props** (движок читает `selectComposition(...).props`): у `data` и у каждой серии
режиссёра — `tl`, `draft`, `choiceAt` (секунда, когда встают карточки развилки, или `null`) и `branchTimes`
(`{ wrong: [начало, конец], right: [начало, конец] }` или `null`; начало — начало первой реплики ветки минус её пауза,
конец — конец последней). У серии режиссёра они берутся из `meta.choiceLine` (карточки за 0,1 с до начала этой
реплики) и `meta.branches`; у серии данными — из `choice` (по умолчанию последняя реплика) и `branches`.
Ошибки серии данными (нет декорации, состояния, реплики) — исключение из calculateMetadata со списком по-русски.

## Файлы серии

`<id>/voice.<lang>.json` — `{ lang, lines: [{ id, text, speak?, role? }] }`; `role: "radio"` или `"phone"` —
субтитр цветом акцента и шум рации под репликой. `<id>/audio/<lang>/<line>.json` — тайминги символов
(формат ElevenLabs) и `durationSec`; `file` — имя звука (`"03.wav"` у голосов компьютера), по умолчанию
`<line>.mp3`. `speech.json` — границы речи (необязательно). `<id>/sfx/<name>.wav` — базовые звуки.

## Серия данными

Формат — `data/types.ts` (`DataEpisode`). Кратко:

- `shots[]` — план: `at` (реплика; склейка за 0,15 с до неё, первый план — с нуля), `set`, `state`, камера
  `fx, fy, cy, s: [от, до]` (s ≥ 1) или готовый ракурс `spot` из каталога. Ещё `word` — склейка за 0,1 с до слова.
- `events[]` — `at` + `word` (номер слова **с нуля**) + `shift`: `change` состояния за `over` с (0,6 по умолчанию;
  декорация — `set` или та, на которой стоит план), `sfx` (+ `volume`), `fx`: `shake`, `flash`, `end` («КОНЕЦ» на
  чёрном — после конца этой реплики, до перемотки или следующей реплики), `rewind` (за 0,25 с до реплики: кадр без
  цвета, «◀◀», звук rewind — до следующей склейки), `hud` — новая плашка с этого момента.
- `bed` — фон под всей серией (`"low"`, `"sea"`, `"wind"`…; или `{ name, volume, from, until }`); молчит во время
  «КОНЕЦ» и перемотки. Перед карточками сами собой — `rise`, на карточках — `hit`.
- `choice` — `q`, `a`/`b`: `title`, `price`, картинка — `set`, `state`, `spot` (или `fx, fy, s`); `at` — реплика,
  с которой встают карточки (по умолчанию последняя). Цвета карточек и рамка — по облику (`LOOKS[look].ui`).
- `branches` — `{ wrong, wrongLines: [первая, последняя], rightLines: [первая, последняя] }`: только для времён.
- «ТВОЙ ВЫБОР» картинка не рисует никогда — это плеер.

## Декорации

`sets/catalog.json` — для подсказки модели: id → название, облик, что это, состояния (`about`, `default`, `min`,
`max`) и готовые ракурсы (`spots`: `fx, fy, s`; первый — общий план и картинка карточки). Пишется из
`sets/catalog.ts`: `node remotion/dev/catalog.mjs` (рядом пишется и `looks/catalog.json`).

Добавить декорацию:

1. Нарисовать мир 1080×1920 в своём облике — компонент со своими пропсами, id фильтров с префиксом `p`
   (образцы — `sets/storozh/room.tsx`, `sets/kompas/ship.tsx`). Время — только из `t`, случайность — `rng(seed)`.
2. Описать в `sets/catalog.ts`: id `<сериал>/<мир>`, `title`, `look`, `about`, `states` (только числа), `spots`.
3. В `sets/<сериал>/index.tsx` — `def(id, ({ state, t, p }) => <Мир … />)` и экспорт компонента.
4. `node remotion/dev/catalog.mjs`, проверить кадром: композиция `set` с `{ id, state }`.

## Код режиссёра

`<files>/episodes/<id>/code/Episode.tsx` (+ свои файлы рядом) экспортирует `meta: EpisodeMeta` (`id`, `lang`,
`pacing`, `choiceLine?`, `branches?`) и `Episode: React.FC<EpisodeProps>` (`{ tl, draft }`). Библиотека — через
псевдоним:

```tsx
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime, Circled } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { cues } from '@feed/lib/timeline';
import { Card, Shot } from '@feed/lib/stage';
import { GlassRoom, DoorRoom, C } from '@feed/sets/storozh';     // миры компонентами
import { SETS, SetView } from '@feed/sets';                       // или единым видом { state, t }
```

`react` и `remotion` берутся из пакета. Шрифты — только `fonts.*` (`display`, `ui`, `hand`, `pixel`, `serif`,
`mono`): `@remotion/google-fonts` ходит в сеть. Образцы — `examples/` (14 серий теста).

## Проверка

```bash
node remotion/dev/smoke.mjs --episodes <series-feed>/feed/episodes --renders <series-feed>/feed/renders \
  --browser <chrome-headless-shell> [--tmp <папка>]
node node_modules/@remotion/cli/remotion-cli.js studio remotion/dev-entry.tsx \
  --config remotion/dev/studio.config.js --public-dir <папка серий>
```
