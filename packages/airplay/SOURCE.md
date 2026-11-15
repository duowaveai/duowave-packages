# Исходный код и пересборка

Программа `bin/duowave-airplay-linux-aarch64` собрана из открытых исходников; всё, что в ней, можно пересобрать и
заменить, в том числе декодер AAC под LGPL-3.0.

| Что | Лицензия | Исходники той же версии |
|---|---|---|
| duowave-airplay 0.1.1 — программа приложения | Apache-2.0 | `apps/airplay/` в репозитории DuoWave: https://github.com/duowaveai/duowave/tree/main/apps/airplay |
| station-airplay v0.2.3 — приёмник AirPlay, модуль вывода звука `station-pcm` и упаковщик | Apache-2.0 | https://github.com/skrashevich/station-airplay/releases/tag/v0.2.3 (архив `station-airplay-0.2.3-source.tar.gz`) |
| go-aac — декодер AAC | LGPL-3.0 | https://github.com/skrashevich/go-aac, версия — в `apps/airplay/go.sum` |
| saprobe-alac — декодер ALAC | Apache-2.0 | https://github.com/mycophonic/saprobe-alac, версия — в `go.sum` |
| purego — вызов ALSA из модуля вывода | Apache-2.0 | https://github.com/ebitengine/purego, версия — в `go.sum` |

Тексты лицензий — `LICENSE` и `docs/licenses/`, уведомления — `NOTICE`.

## Как пересобрать

Нужен Go 1.26 или новее.

```sh
git clone https://github.com/duowaveai/duowave && cd duowave
sh apps/airplay/build.sh          # → apps/airplay/dist/duowave-airplay-linux-aarch64
```

Сборка статическая (`CGO_ENABLED=0 GOOS=linux GOARCH=arm64`), затем `station-pcm-package -arch arm64` дописывает в
файл модули вывода звука ARMv7 и ARM64. Сборка повторяется байт в байт: из тех же исходников получится файл с тем же
SHA-256, что в `manifest.json`.

## Как заменить декодер AAC

1. Возьмите исходники go-aac (или свою изменённую копию) в папку рядом.
2. В `apps/airplay/go.mod` добавьте `replace github.com/skrashevich/go-aac => ../путь/к/go-aac`.
3. `sh apps/airplay/build.sh` — новый файл с вашим декодером.
4. Положите его на колонку вместо прежнего вместе с новым SHA-256 в `manifest.json` пакета (свой пакет — «Свои
   источники» MagicPlace) — шлюз сверяет хеш перед каждым запуском.
