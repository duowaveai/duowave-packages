// VPN — окно приложения и виджет стола (docs/plans/own-server.md шлюза, этап 3).
// С 0.1.2 (образец владельца 16.11 — телефонный VPN, «одно место»): всё о VPN — в разделе пульта «VPN»
// (`go("egress")`): большой переключатель, локации, кто идёт через сервер, подписки, страна дома. Его функции
// (`status`, `select`, `check`, `refresh`, `add`, `remove`, `rename`) пульт зовёт сам. Окно открывает этот раздел
// сразу; задерживает только одно — «да» на «VPN → Сеть шлюза»: спросить его может лишь само приложение.
// Ссылки и пароли окно не видит никогда: программа отдаёт только имена, страны, состояние и хост подписки.
import { h } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { Action, Note, askRights, definePlugin, icons, rights, t as translate, useApi, usePanelState, useT } from "@duowave/panel-sdk";

const ID = "own-server";
/** The panel's section of the VPN: the switch, locations, settings, subscriptions. */
const SCREEN = "egress";

const T = {
  ru: {
    title: "VPN",
    source: "приложение",
    opening: "Открываю VPN…",
    about: "Свой сервер для DuoWave: переключатель, локации, кто идёт через сервер и подписки — в разделе «VPN».",
    open: "Открыть VPN",
    rightsWait: "Шлюз ещё не пускает VPN: нужно ваше «да» на «VPN → Сеть шлюза». Пока его нет, всё ходит напрямую.",
    allow: "Разрешить",
    widgetNone: "Не подключено",
    up: "работает",
    down: "не отвечает",
    starting: "запускается",
  },
  en: {
    title: "VPN",
    source: "app",
    opening: "Opening the VPN…",
    about: "Your own server for DuoWave: the switch, locations, who goes through the server and subscriptions — in the “VPN” section.",
    open: "Open the VPN",
    rightsWait: "The gateway does not let the VPN in yet: it needs your “yes” to “VPN → Gateway network”. Until then everything goes directly.",
    allow: "Allow",
    widgetNone: "Not connected",
    up: "works",
    down: "not answering",
    starting: "starting",
  },
};

/** The flag emoji of a country code: two regional indicator letters. */
function flag(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** A name starts with its flag already — no second one. */
function withFlag(name, country) {
  if (!name) return "";
  if (/^\p{Regional_Indicator}{2}/u.test(name)) return name;
  const mark = flag(country);
  return mark ? `${mark} ${name}` : name;
}

/** Whether the owner still has to say «да» to «VPN → Сеть шлюза»: null — not known yet. */
function useRightsPending() {
  const [pending, setPending] = useState(null);
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
  return { pending, look };
}

/** The window: straight to the panel's «VPN»; only the «да» to «Сеть шлюза» keeps it here. */
function Screen() {
  const tr = useT(T);
  const panel = usePanelState();
  const { pending, look } = useRightsPending();
  useEffect(() => {
    if (pending === false) panel.go(SCREEN);
    // Once the answer is known: the window opens the section, not again on every redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  return h(
    "section",
    { class: "card glass os-card" },
    h("h2", { class: "t-title-xs m-0" }, tr("title")),
    pending
      ? h(Note, { tone: "warning" }, tr("rightsWait"))
      : h(Note, null, pending === null ? tr("opening") : tr("about")),
    h(
      "div",
      { class: "os-actions" },
      pending &&
        h(Action, {
          label: tr("allow"),
          tone: "on",
          onClick: async () => {
            await askRights();
            look();
          },
        }),
      h(Action, { label: tr("open"), tone: pending ? undefined : "on", onClick: () => panel.go(SCREEN) }),
    ),
  );
}

/** On the desk: how the connections are; «Открыть» — the panel's «VPN». */
function Tile() {
  const tr = useT(T);
  const panel = usePanelState();
  const api = useApi(ID);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      api.call("status").then(
        (answer) => alive && setStatus(answer),
        () => undefined,
      );
    read();
    const timer = setInterval(read, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api]);
  const connections = status?.connections ?? [];
  return h(
    "div",
    { class: "w-rows" },
    connections.length === 0 && h("div", { class: "w-row" }, h("span", { class: "w-cap" }, tr("widgetNone"))),
    connections.slice(0, 3).map((one) =>
      h(
        "div",
        { class: "w-row", key: one.id },
        h("span", null, withFlag(one.current || one.name, one.country)),
        h("span", { class: `w-cap${one.state === "down" ? " os-dead" : ""}` }, tr(one.state)),
      ),
    ),
    h("button", { type: "button", class: "w-btn", onClick: () => panel.go(SCREEN) }, tr("open")),
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
