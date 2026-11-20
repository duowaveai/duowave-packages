# Шрифты картинки «Ленты»

Рендер работает без сети: шрифты лежат здесь и попадают в сборку Remotion как файлы (`remotion/lib/fonts.ts`).
Взяты один раз с Fontsource (тот же набор, что у Google Fonts), версия пакетов 5.3.0, подмножества `latin`,
`latin-ext`, `cyrillic`. Все — SIL Open Font License 1.1, тексты лицензий — в `licenses/`.

| Семейство | Файлы | Начертания | Пакет | Где в картинке |
|---|---|---|---|---|
| Inter | `inter-*-wght-normal.woff2` | переменный, 100–900 | `@fontsource-variable/inter` | субтитры, плашки, знак, заставка |
| Montserrat | `montserrat-*-wght-normal.woff2` | переменный, 100–900 | `@fontsource-variable/montserrat` | заголовки, карточки развилки, «КОНЕЦ» |
| Caveat | `caveat-*-wght-normal.woff2` | переменный, 400–700 | `@fontsource-variable/caveat` | рукописное: журнал, записки |
| Press Start 2P | `press-start-2p-*-400-normal.woff2` | 400 | `@fontsource/press-start-2p` | облик «пиксели» |
| PT Serif | `pt-serif-*-700-normal.woff2` | 700 | `@fontsource/pt-serif` | облик «бумага» |
| IBM Plex Mono | `ibm-plex-mono-*-{500,700}-normal.woff2` | 500, 700 | `@fontsource/ibm-plex-mono` | облик «терминал» |

Знаков ① и ② в этих шрифтах нет — картинка рисует их сама (`Circled` в `remotion/lib/kit.tsx`).
