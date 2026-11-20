# Исходный код и пересборка

Программа `bin/duowave-own-server-linux-aarch64` собрана из открытых исходников; всё, что в ней, можно пересобрать и
заменить.

| Что | Лицензия | Исходники той же версии |
|---|---|---|
| duowave-own-server 0.1.0 — программа приложения | Apache-2.0 | `apps/own-server/` в репозитории DuoWave: https://github.com/duowaveai/duowave/tree/main/apps/own-server |
| shoes 0.3.7 — движок протоколов | MIT | https://github.com/cfal/shoes/tree/d1742b93e0d3541aae75005a610d2c702ead7144 |
| GotaTun 0.10.2 — WireGuard внутри shoes | MPL-2.0 | https://github.com/mullvad/gotatun/tree/c06582e41022bcecbf33751631fd5a63d5794dc5 (без изменений) |
| Остальные зависимости | разные, свободные | версии — `apps/own-server/Cargo.lock`; тексты — `docs/licenses/dependencies.txt` |

Тексты лицензий — `LICENSE` (программа), `docs/licenses/` (shoes, MPL-2.0, Cloudflare, musl, Rust, зависимости),
уведомления — `NOTICE` и `THIRD_PARTY_NOTICES.md` (уведомления автора shoes, как есть).

## Как пересобрать

Нужны Rust 1.99.1, `cargo-zigbuild` и zig.

```sh
git clone https://github.com/duowaveai/duowave && cd duowave
sh apps/own-server/build.sh          # → apps/own-server/dist/duowave-own-server-linux-aarch64
```

Сборка статическая (`aarch64-unknown-linux-musl`), зависимости закреплены в `Cargo.lock` (`--locked`). Свой файл —
свой SHA-256 в `manifest.json` пакета: шлюз сверяет хеш перед каждым запуском.
