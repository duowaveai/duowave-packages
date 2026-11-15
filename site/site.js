// Галерея каталога: читает catalog.json рядом со страницей и рисует карточки по видам пакетов.
// Ничего не грузит извне; адрес шлюза хранится только в этом браузере (localStorage).
'use strict';

(function () {
  const CATALOG = 'catalog.json';
  const STORAGE_KEY = 'duowave.gatewayAddress';
  const DEFAULT_ADDRESS = 'http://localhost';

  /** Виды пакетов в порядке разделов. install — ссылка внутрь пульта шлюза, если пакет этого вида ставится оттуда. */
  const KINDS = [
    {
      kind: 'character',
      title: 'Персонажи',
      soon: 'Персонажи',
      lede: 'Характер, голос и облик помощника. Голоса синтетические — ничьи; промты персонажей видны в пульте после установки.',
      install: (id) => `/panel/#/mind/characters/${encodeURIComponent(id)}?install`,
    },
    { kind: 'theme', title: 'Темы пульта', soon: 'Темы пульта', lede: 'Оформление пульта шлюза.' },
    { kind: 'plugin', title: 'Плагины', soon: 'Плагины', lede: 'Новые навыки шлюза.' },
    { kind: 'app', title: 'Приложения', soon: 'Приложения', lede: 'Программы рядом со шлюзом.' },
  ];

  const PLACES = { pc: 'на компьютере', station: 'на колонке', stationServer: 'на колонке' };

  /** Права пакета словами — до установки (как в пульте шлюза). */
  const RIGHTS = {
    'call:system/brain': 'модель «Мозга»: пишет тексты',
    'call:system/voice': 'голос: говорить и озвучивать в свою папку',
    'call:system/notify': 'сообщения владельцу',
    'call:system/schedule': 'своё расписание',
    'call:system/memory': 'интересы дома из памяти — по вашему «да»',
    'call:system/publish': 'публикация: Telegram ботом шлюза, ссылка «смотри и выбирай»',
    'call:system/smart-home': 'умный дом',
    'call:system/content': 'музыка и сказки семьи',
  };
  const rightWords = (right) => (right.startsWith('net:') ? `сеть: ${right.slice(4)}` : RIGHTS[right] || right);
  const coded = (pkg) => pkg.kind === 'app' || pkg.kind === 'plugin';

  const $ = (id) => document.getElementById(id);

  /** Элемент с атрибутами и детьми; текст — только как текст, без разметки из ленты. */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function gb(mb) {
    const value = mb / 1000;
    return `${value >= 10 ? Math.round(value) : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ГБ`;
  }

  // ---- адрес шлюза ----

  function storedAddress() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeAddress(address) {
    try {
      localStorage.setItem(STORAGE_KEY, address);
    } catch {
      // приватный режим: адрес проживёт до перезагрузки
    }
    sessionAddress = address;
  }

  let sessionAddress = storedAddress();

  /** «192.168.1.20:8080/panel/» → «http://192.168.1.20:8080»; не адрес — null. */
  function normalizeAddress(input) {
    let text = String(input || '').trim();
    if (!text) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `http://${text}`;
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    const path = url.pathname.replace(/\/panel(\/.*)?$/, '').replace(/\/+$/, '');
    return url.origin + path;
  }

  function installUrl(address, kind, id) {
    return address + kind.install(id);
  }

  function renderGatewayLabel() {
    const button = $('gateway-button');
    const label = $('gateway-label');
    if (sessionAddress) {
      label.textContent = sessionAddress.replace(/^https?:\/\//, '');
      button.dataset.set = 'true';
      button.setAttribute('aria-label', `Адрес шлюза: ${sessionAddress}. Изменить`);
    } else {
      label.textContent = 'не указан';
      button.dataset.set = 'false';
      button.setAttribute('aria-label', 'Адрес шлюза не указан. Указать');
    }
    for (const link of document.querySelectorAll('a[data-install]')) {
      const kind = KINDS.find((k) => k.kind === link.dataset.kind);
      link.href = installUrl(sessionAddress || DEFAULT_ADDRESS, kind, link.dataset.install);
    }
  }

  /** Окно адреса. then — что сделать с адресом после «Сохранить» (открыть установку). */
  let pending = null;

  function openGatewayDialog(then) {
    pending = then || null;
    const dialog = $('gateway-dialog');
    const input = $('gateway-input');
    input.value = sessionAddress || DEFAULT_ADDRESS;
    input.removeAttribute('aria-invalid');
    $('gateway-error').hidden = true;
    $('gateway-save').textContent = pending ? 'Сохранить и открыть пульт' : 'Сохранить';
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      input.select();
    } else {
      // Совсем старый браузер без <dialog>: спросим по-простому.
      const answer = window.prompt('Адрес вашего шлюза', input.value);
      if (answer !== null) saveAddress(answer, pending);
      pending = null;
    }
  }

  /** Сохраняет адрес и делает обещанное (открыть установку). false — это не адрес. */
  function saveAddress(value, then) {
    const address = normalizeAddress(value);
    if (!address) return false;
    storeAddress(address);
    renderGatewayLabel();
    if (then) then(address);
    return true;
  }

  function wireGatewayDialog() {
    const dialog = $('gateway-dialog');
    const form = $('gateway-form');
    const input = $('gateway-input');
    $('gateway-button').addEventListener('click', () => openGatewayDialog(null));
    $('gateway-cancel').addEventListener('click', () => {
      pending = null;
      dialog.close();
    });
    dialog.addEventListener('close', () => {
      pending = null;
    });
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      $('gateway-error').hidden = true;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!normalizeAddress(input.value)) {
        input.setAttribute('aria-invalid', 'true');
        $('gateway-error').hidden = false;
        input.focus();
        return;
      }
      const then = pending;
      dialog.close();
      saveAddress(input.value, then);
    });
  }

  // ---- звук ----

  const player = new Audio();
  player.preload = 'none';
  let playing = null;

  function stopPlaying() {
    if (playing) playing.setAttribute('aria-pressed', 'false');
    playing = null;
  }

  player.addEventListener('ended', stopPlaying);
  player.addEventListener('pause', stopPlaying);
  player.addEventListener('error', stopPlaying);

  function toggle(button, url) {
    if (playing === button) {
      player.pause();
      return;
    }
    player.pause();
    stopPlaying();
    player.src = url;
    playing = button;
    button.setAttribute('aria-pressed', 'true');
    player.play().catch(stopPlaying);
  }

  // ---- карточки ----

  /** Адрес файла из ленты: только относительный и только с того же источника, что и страница. */
  function sameOrigin(path, base) {
    if (typeof path !== 'string' || !path) return null;
    try {
      const url = new URL(path, base);
      return url.origin === window.location.origin ? url.href : null;
    } catch {
      return null;
    }
  }

  function voiceFact(needs) {
    const engines = (needs || []).filter((need) => need && need.kind === 'engine');
    if (engines.length === 0) return ['встроенный голос шлюза, модели не нужны'];
    const parts = [];
    engines.forEach((need, i) => {
      if (i > 0) parts.push(' или ');
      parts.push(el('span', { class: 'model' }, need.title || need.id));
      if (need.diskMb) parts.push(` (~${gb(need.diskMb)})`);
    });
    const optional = engines.every((need) => need.optional);
    return ['нужна модель ', ...parts, optional ? '; без неё — встроенный голос шлюза' : ''];
  }

  function placesFact(pkg) {
    const places = [...new Set((pkg.runs || []).map((run) => PLACES[run]).filter(Boolean))];
    const where = places.length ? places.join(' и ') : '';
    const version = pkg.minGateway ? `от ${pkg.minGateway}` : '';
    return [version, where].filter(Boolean).join(', ');
  }

  function card(pkg, kind, base) {
    const image = sameOrigin(pkg.preview && pkg.preview.image, base);
    const samples = ((pkg.preview && pkg.preview.samples) || []).map((path) => sameOrigin(path, base)).filter(Boolean);

    const facts = [];
    if (pkg.kind === 'character') facts.push(['Голос', voiceFact(pkg.needs)]);
    const places = placesFact(pkg);
    if (places) facts.push(['Шлюз', [places]]);
    if (pkg.license) facts.push(['Лицензия', [pkg.license]]);
    // Код приходит только в подписанной ленте: значит, его проверили и подписали мы.
    if (coded(pkg)) facts.push(['Подписано', ['DuoWave — код проверен']]);
    if (pkg.runtime === 'node' || pkg.runtime === 'process') {
      facts.push(['Собирает', [`компьютер: своя программа${pkg.runtime === 'node' ? ' на Node' : ''} с правами пользователя`]]);
    }
    if (pkg.permissions && pkg.permissions.length) facts.push(['Права', [pkg.permissions.map(rightWords).join(' · ')]]);

    const listen = samples.length
      ? el(
          'div',
          { class: 'listen', role: 'group', 'aria-label': `Послушать: ${pkg.title}` },
          samples.map((url, i) => {
            const button = el(
              'button',
              { class: 'play', type: 'button', 'aria-pressed': 'false', 'aria-label': `Фраза ${i + 1}: ${pkg.title}` },
              el('span', { class: 'play-icon', 'aria-hidden': 'true' }),
              `Фраза ${i + 1}`,
            );
            button.addEventListener('click', () => toggle(button, url));
            return button;
          }),
        )
      : null;

    let install = null;
    if (kind.install) {
      install = el(
        'a',
        {
          class: 'btn primary install',
          href: installUrl(sessionAddress || DEFAULT_ADDRESS, kind, pkg.id),
          target: '_blank',
          rel: 'noopener',
          'data-install': pkg.id,
          'data-kind': pkg.kind,
        },
        'Установить в свой шлюз',
      );
      install.addEventListener('click', (event) => {
        if (sessionAddress) return; // адрес уже есть — обычная ссылка
        event.preventDefault();
        openGatewayDialog((address) => window.open(installUrl(address, kind, pkg.id), '_blank', 'noopener'));
      });
    }

    return el(
      'li',
      { class: 'card' },
      el('div', { class: 'card-art' }, image ? el('img', { src: image, alt: `${pkg.title} — аватар`, width: 512, height: 512, loading: 'lazy', decoding: 'async' }) : null),
      el(
        'div',
        { class: 'card-body' },
        el('div', { class: 'card-head' }, el('h3', { text: pkg.title }), el('span', { class: 'card-version', title: 'Версия пакета', text: pkg.version })),
        pkg.description ? el('p', { class: 'card-desc', text: pkg.description }) : null,
        el('ul', { class: 'facts' }, facts.map(([key, value]) => el('li', {}, el('span', { class: 'fact-key', text: key }), el('span', { class: 'fact-value' }, value)))),
        listen,
        install,
      ),
    );
  }

  function render(catalog, base) {
    const sections = $('sections');
    sections.replaceChildren();
    // Скрытые лентой (`unlisted`) страница не показывает: их видно только со скрытой возможностью разработчика в пульте.
    const packages = Array.isArray(catalog.packages)
      ? catalog.packages.filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string' && p.unlisted !== true)
      : [];
    const missing = [];
    for (const kind of KINDS) {
      const list = packages
        .filter((p) => p.kind === kind.kind)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      if (list.length === 0) {
        missing.push(kind.soon);
        continue;
      }
      const headingId = `kind-${kind.kind}`;
      sections.append(
        el(
          'section',
          { class: 'kind', 'aria-labelledby': headingId },
          el(
            'div',
            { class: 'kind-head' },
            el('h2', { id: headingId, text: kind.title }),
            el('span', { class: 'kind-count', text: `${list.length} ${plural(list.length, 'пакет', 'пакета', 'пакетов')}` }),
          ),
          el('p', { class: 'kind-lede', text: kind.lede }),
          el('ul', { class: 'grid' }, list.map((pkg) => card(pkg, kind, base))),
        ),
      );
    }
    if (missing.length && missing.length < KINDS.length) {
      sections.append(el('div', { class: 'soon' }, el('span', { class: 'soon-label', text: 'Скоро в каталоге:' }), missing.map((name) => el('span', { class: 'chip', text: name }))));
    }
    if (packages.length === 0) {
      $('status').textContent = 'Каталог пока пуст.';
    } else {
      $('status').textContent = '';
    }
    const updated = Date.parse(catalog.updatedAt);
    if (!Number.isNaN(updated)) {
      const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(updated);
      $('updated').replaceChildren(`Каталог обновлён ${date} · `, el('a', { href: CATALOG, text: 'catalog.json' }));
    }
  }

  function showError(reason) {
    const status = $('status');
    status.className = 'status error';
    const local = window.location.protocol === 'file:';
    const retry = el('button', { class: 'btn ghost', type: 'button', text: 'Попробовать ещё раз' });
    retry.addEventListener('click', load);
    status.replaceChildren(
      el('b', { text: 'Каталог не загрузился.' }),
      ' ',
      local
        ? ['Страницу нужно открыть через веб-сервер, например: ', el('code', { text: 'python3 -m http.server 8780 -d dist' }), '.']
        : `${reason}.`,
      el('br'),
      retry,
    );
  }

  async function load() {
    const status = $('status');
    status.className = 'status';
    status.textContent = 'Загружаю каталог…';
    const url = new URL(CATALOG, window.location.href);
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`сервер ответил ${response.status}`);
      const catalog = await response.json();
      if (!catalog || catalog.format !== 1) throw new Error('формат ленты не тот, что понимает эта страница');
      render(catalog, url.href);
    } catch (error) {
      showError(error && error.message ? error.message : 'нет связи');
    }
  }

  wireGatewayDialog();
  renderGatewayLabel();
  load();
})();
