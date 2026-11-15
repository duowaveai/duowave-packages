// VPN — окно приложения (docs/plans/own-server.md шлюза, этап 3): подключения человека, их серверы с флагами и
// задержкой, «Авто — самый быстрый» или сервер руками, «Добавить подключение», «Обновить подписку», «Проверить».
// Куда кому ходить — не здесь, а на экране шлюза «Выход в интернет» (go("egress")): там таблица и три кнопки.
// Ссылки и пароли окно не видит никогда: программа отдаёт только имена, страны, состояние и хост подписки.
import { h } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import {
  Action,
  Card,
  Note,
  Sheet,
  ask,
  askRights,
  definePlugin,
  icons,
  rights,
  t as translate,
  useApi,
  useLocale,
  usePanelState,
  useT,
} from "@duowave/panel-sdk";

const ID = "own-server";

const T = {
  ru: {
    title: "VPN",
    source: "приложение",
    empty: "Подключений пока нет. Добавьте подписку или ссылку своего сервера — DuoWave сам решит, кому идти через него.",
    add: "Добавить подключение",
    addTitle: "Новое подключение",
    addAbout: "Подписка (ссылка https://…), ссылки серверов строками или текст файла WireGuard. Ссылка остаётся на колонке и никуда не показывается.",
    name: "Название",
    namePlaceholder: "Мой VPN",
    source_: "Подписка, ссылки или WireGuard",
    sourcePlaceholder: "https://… или vless://…, hysteria2://…, tuic://…, ss://…, trojan://…, anytls://…",
    save: "Добавить",
    cancel: "Отмена",
    auto: "Авто — самый быстрый",
    up: "работает",
    down: "не отвечает",
    starting: "запускается",
    reading: "читаю подписку…",
    noAnswer: "не отвечает",
    notProbed: "—",
    ms: "{n} мс",
    via: "Сейчас через {server}",
    now: "сейчас",
    check: "Проверить",
    checked: "Работает: {country}, {n} мс",
    checkPending: "Проверяю…",
    refresh: "Обновить подписку",
    rename: "Переименовать",
    renameTitle: "Название подключения",
    remove: "Удалить",
    removeAsk: "Удалить подключение «{name}»?",
    removeText: "Его ссылка будет стёрта с колонки. Кто ходил через него, пойдёт по правилам «Выхода в интернет».",
    subscription: "Подписка {host}",
    updated: "обновлена {when}",
    skipped: "Пропущено {n}:",
    servers: { one: "{count} сервер", few: "{count} сервера", many: "{count} серверов", other: "{count} сервера" },
    routes: "Куда как ходить",
    routesAbout: "Кому идти через сервер, а кому напрямую — на экране «Выход в интернет».",
    rightsWait: "Шлюз ещё не пускает VPN: нужно ваше «да» на «VPN → Сеть шлюза». Пока его нет, всё ходит напрямую.",
    allow: "Разрешить",
    widgetNone: "Не подключено",
    open: "Открыть",
    failed: "Не вышло: {why}",
  },
  en: {
    title: "VPN",
    source: "app",
    empty: "No connections yet. Add a subscription or your server's link — DuoWave decides who goes through it.",
    add: "Add a connection",
    addTitle: "New connection",
    addAbout: "A subscription (an https://… link), server links one per line, or a WireGuard file's text. The link stays on the speaker and is never shown.",
    name: "Name",
    namePlaceholder: "My VPN",
    source_: "Subscription, links or WireGuard",
    sourcePlaceholder: "https://… or vless://…, hysteria2://…, tuic://…, ss://…, trojan://…, anytls://…",
    save: "Add",
    cancel: "Cancel",
    auto: "Auto — the fastest",
    up: "works",
    down: "not answering",
    starting: "starting",
    reading: "reading the subscription…",
    noAnswer: "not answering",
    notProbed: "—",
    ms: "{n} ms",
    via: "Now through {server}",
    now: "now",
    check: "Check",
    checked: "Works: {country}, {n} ms",
    checkPending: "Checking…",
    refresh: "Update the subscription",
    rename: "Rename",
    renameTitle: "Connection name",
    remove: "Remove",
    removeAsk: "Remove the connection “{name}”?",
    removeText: "Its link is erased from the speaker. Whoever went through it follows the rules of “Internet access”.",
    subscription: "Subscription {host}",
    updated: "updated {when}",
    skipped: "Skipped {n}:",
    servers: { one: "{count} server", other: "{count} servers" },
    routes: "Who goes where",
    routesAbout: "Who goes through a server and who goes directly — on the “Internet access” screen.",
    rightsWait: "The gateway does not let the VPN in yet: it needs your “yes” to “VPN → Gateway network”. Until then everything goes directly.",
    allow: "Allow",
    widgetNone: "Not connected",
    open: "Open",
    failed: "Did not work: {why}",
  },
};

/** The flag emoji of a country code: two regional indicator letters. */
function flag(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(code, locale) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

/** The program's own words from a refused call: the gateway wraps them («…HTTP 400 {"error":"…"}»). */
function errorText(error) {
  const message = String(error?.message ?? error ?? "");
  const found = message.match(/"error"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (found) {
    try {
      return JSON.parse(`"${found[1]}"`);
    } catch {
      return found[1];
    }
  }
  return message;
}

/** A server's name starts with its flag already — no second one. */
function withFlag(name, country) {
  if (!name) return "";
  if (/^\p{Regional_Indicator}{2}/u.test(name)) return name;
  const mark = flag(country);
  return mark ? `${mark} ${name}` : name;
}

/** The status, read now and then: faster while something starts or a subscription is being read. */
function useStatus() {
  const api = useApi(ID);
  const { version } = usePanelState();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      setStatus(await api.call("status"));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [api]);
  useEffect(() => {
    reload();
  }, [reload, version]);
  const busy = (status?.connections ?? []).some((one) => one.state === "starting" || one.subscription?.reading);
  useEffect(() => {
    const timer = setInterval(reload, busy ? 1500 : 5000);
    return () => clearInterval(timer);
  }, [reload, busy]);
  return { status, error, reload, api };
}

function Field({ label, children }) {
  return h("label", { class: "os-field" }, h("span", { class: "t-meta" }, label), children);
}

function AddSheet({ api, onClose, onDone }) {
  const tr = useT(T);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.call("add", { name: name.trim(), source });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return h(
    Sheet,
    { title: tr("addTitle"), about: tr("addAbout"), onClose },
    h(
      Field,
      { label: tr("name") },
      h("input", {
        class: "os-input",
        type: "text",
        value: name,
        placeholder: tr("namePlaceholder"),
        maxLength: 60,
        onInput: (e) => setName(e.currentTarget.value),
      }),
    ),
    h(
      Field,
      { label: tr("source_") },
      h("textarea", {
        class: "os-input os-source",
        rows: 6,
        value: source,
        spellcheck: false,
        autocomplete: "off",
        placeholder: tr("sourcePlaceholder"),
        onInput: (e) => setSource(e.currentTarget.value),
      }),
    ),
    error && h(Note, { tone: "error" }, error),
    h(
      "div",
      { class: "os-actions" },
      h(Action, { label: tr("save"), tone: "on", busy, disabled: !source.trim(), onClick: save }),
      h(Action, { label: tr("cancel"), onClick: onClose }),
    ),
  );
}

function RenameSheet({ api, connection, onClose, onDone }) {
  const tr = useT(T);
  const [name, setName] = useState(connection.name);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.call("rename", { connection: connection.id, name: name.trim() });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return h(
    Sheet,
    { title: tr("renameTitle"), onClose },
    h("input", {
      class: "os-input",
      type: "text",
      value: name,
      maxLength: 60,
      onInput: (e) => setName(e.currentTarget.value),
      onKeyDown: (e) => e.key === "Enter" && name.trim() && save(),
    }),
    h(
      "div",
      { class: "os-actions" },
      h(Action, { label: tr("rename"), tone: "on", busy, disabled: !name.trim(), onClick: save }),
      h(Action, { label: tr("cancel"), onClick: onClose }),
    ),
  );
}

function delayText(tr, server) {
  if (server.up === false) return tr("noAnswer");
  if (typeof server.delayMs === "number") return tr("ms", { n: server.delayMs });
  return tr("notProbed");
}

function ConnectionCard({ api, connection, reload }) {
  const tr = useT(T);
  const locale = useLocale();
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const run = async (what, work) => {
    setBusy(what);
    setNote(null);
    try {
      await work();
    } catch (e) {
      setNote({ tone: "error", text: tr("failed", { why: errorText(e) }) });
    } finally {
      setBusy(null);
      reload();
    }
  };
  const check = () =>
    run("check", async () => {
      const answer = await api.call("check", { connection: connection.id });
      if (answer?.pending) setNote({ tone: "meta", text: tr("checkPending") });
      else
        setNote({
          tone: "meta",
          text: tr("checked", { country: `${flag(answer.country)} ${countryName(answer.country, locale)}`.trim(), n: answer.delayMs }),
        });
    });
  const select = (name) => run(`select:${name}`, () => api.call("select", { connection: connection.id, name }));
  const refresh = () => run("refresh", () => api.call("refresh", { connection: connection.id }));
  const remove = async () => {
    const yes = await ask({ title: tr("removeAsk", { name: connection.name }), text: tr("removeText"), ok: tr("remove"), danger: true });
    if (yes) await run("remove", () => api.call("remove", { connection: connection.id }));
  };
  const stateWord = connection.subscription?.reading && !connection.servers.length ? tr("reading") : tr(connection.state);
  const sub = connection.subscription;
  const when = sub?.updatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(sub.updatedAt * 1000))
    : null;
  return h(
    Card,
    { title: withFlag(connection.name, connection.country), meta: `${stateWord} · ${tr("servers", { count: connection.servers.length })}` },
    connection.current &&
      h(
        "p",
        { class: "t-caption m-0" },
        tr("via", { server: withFlag(connection.current, connection.country) }),
        connection.country ? ` · ${countryName(connection.country, locale)}` : "",
      ),
    connection.servers.length > 0 &&
      h(
        "div",
        { class: "os-servers", role: "list" },
        h(
          "button",
          {
            type: "button",
            role: "listitem",
            class: `os-server${connection.mode === "auto" ? " os-chosen" : ""}`,
            "aria-pressed": connection.mode === "auto",
            disabled: busy !== null,
            onClick: () => select("auto"),
          },
          h("span", { class: "os-server-name" }, tr("auto")),
          busy === "select:auto" && h("span", { class: "spinner spinner-sm" }),
        ),
        connection.servers.map((server) =>
          h(
            "button",
            {
              type: "button",
              role: "listitem",
              key: server.name,
              class: `os-server${connection.mode === "manual" && connection.choice === server.name ? " os-chosen" : ""}${server.up === false ? " os-dead" : ""}`,
              "aria-pressed": connection.mode === "manual" && connection.choice === server.name,
              disabled: busy !== null,
              onClick: () => select(server.name),
            },
            h("span", { class: "os-server-name" }, withFlag(server.name, server.country)),
            server.name === connection.current && h("span", { class: "t-meta os-now" }, tr("now")),
            h("span", { class: "t-meta os-delay" }, delayText(tr, server)),
          ),
        ),
      ),
    sub &&
      h(
        Note,
        { tone: sub.error ? "warning" : "meta" },
        [tr("subscription", { host: sub.host }), when && tr("updated", { when }), sub.reading && tr("reading")].filter(Boolean).join(" · "),
        sub.error ? ` — ${sub.error}` : "",
      ),
    connection.skipped.length > 0 &&
      h(
        Note,
        { tone: "warning" },
        `${tr("skipped", { n: connection.skipped.length })} `,
        connection.skipped
          .slice(0, 5)
          .map((one) => `${one.scheme} — ${one.reason}`)
          .join("; "),
      ),
    note && h(Note, { tone: note.tone }, note.text),
    h(
      "div",
      { class: "os-actions" },
      h(Action, { label: tr("check"), busy: busy === "check", disabled: busy !== null || !connection.servers.length, onClick: check }),
      sub && h(Action, { label: tr("refresh"), busy: busy === "refresh" || sub.reading, disabled: busy !== null, onClick: refresh }),
      h(Action, { label: tr("rename"), disabled: busy !== null, onClick: () => setRenaming(true) }),
      h(Action, { label: tr("remove"), busy: busy === "remove", disabled: busy !== null, onClick: remove }),
    ),
    renaming &&
      h(RenameSheet, {
        api,
        connection,
        onClose: () => setRenaming(false),
        onDone: () => {
          setRenaming(false);
          reload();
        },
      }),
  );
}

/** «VPN → Сеть шлюза»: until the owner says yes, the gateway does not take the connections. */
function RightsNote() {
  const tr = useT(T);
  const [pending, setPending] = useState(false);
  const look = useCallback(async () => {
    try {
      const state = await rights();
      setPending(state.asked.some((one) => one.right === "call:system/network" && !one.allowed));
    } catch {
      setPending(false);
    }
  }, []);
  useEffect(() => {
    look();
  }, [look]);
  if (!pending) return null;
  return h(
    Card,
    null,
    h(Note, { tone: "warning" }, tr("rightsWait")),
    h("div", { class: "os-actions" }, h(Action, { label: tr("allow"), tone: "on", onClick: async () => { await askRights(); look(); } })),
  );
}

function Screen() {
  const tr = useT(T);
  const panel = usePanelState();
  const { status, error, reload, api } = useStatus();
  const [adding, setAdding] = useState(false);
  const connections = status?.connections ?? [];
  const full = status && connections.length >= (status.max ?? 8);
  return h(
    "div",
    { class: "os-screen" },
    h(RightsNote),
    error && h(Card, null, h(Note, { tone: "error" }, error)),
    status && connections.length === 0 && h(Card, { title: tr("title") }, h(Note, null, tr("empty"))),
    connections.map((connection) => h(ConnectionCard, { key: connection.id, api, connection, reload })),
    h(
      "div",
      { class: "os-actions" },
      h(Action, { label: tr("add"), tone: "on", disabled: !status || full, onClick: () => setAdding(true) }),
      h(Action, { label: tr("routes"), onClick: () => panel.go("egress") }),
    ),
    h(Note, null, tr("routesAbout")),
    adding &&
      h(AddSheet, {
        api,
        onClose: () => setAdding(false),
        onDone: () => {
          setAdding(false);
          reload();
        },
      }),
  );
}

/** On the desk: how the connections are, and the window. */
function Tile() {
  const tr = useT(T);
  const panel = usePanelState();
  const { status } = useStatus();
  const connections = status?.connections ?? [];
  return h(
    "div",
    { class: "w-rows" },
    connections.length === 0 && h("div", { class: "w-row" }, h("span", { class: "w-cap" }, tr("widgetNone"))),
    connections.slice(0, 3).map((one) =>
      h(
        "div",
        { class: "w-row", key: one.id },
        h("span", null, withFlag(one.name, one.country)),
        h("span", { class: `w-cap${one.state === "down" ? " os-dead" : ""}` }, tr(one.state)),
      ),
    ),
    h("button", { type: "button", class: "w-btn", onClick: () => panel.go(ID) }, tr("open")),
  );
}

export default definePlugin({
  id: ID,
  sections: [{ id: ID, title: translate(T, "title"), icon: icons.globe, Screen, nav: "link" }],
  slots: {
    "desk.widgets": [
      { id: "state", title: translate(T, "title"), icon: icons.globe, size: "small", source: translate(T, "source"), Component: Tile },
    ],
  },
});
