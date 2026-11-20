import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts } from './fonts';
import type { Timeline, Word } from './timeline';

// Общие куски для всех серий: шрифты, время, субтитры по словам, плашка, камера, плёнка, звук.
// Шрифты — из файлов пакета (lib/fonts.ts), без сети: `fonts.display`, `fonts.ui`, `fonts.hand`, `fonts.pixel`,
// `fonts.serif`, `fonts.mono`.

export { fonts };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** 0 → 1 между секундами a и b. */
export const ramp = (t: number, a: number, b: number, easing = Easing.bezier(0.22, 1, 0.36, 1)) => interpolate(t, [a, b], [0, 1], { ...clamp, easing });
/** Секунды от начала ролика. */
export const useTime = () => useCurrentFrame() / useVideoConfig().fps;

/** Короткая затухающая тряска после каждого момента из `at`. */
export function shake(t: number, at: number[], amp = 6, len = 0.35) {
  let x = 0;
  let y = 0;
  for (const a of at) {
    const d = t - a;
    if (d < 0 || d > len) continue;
    const k = amp * (1 - d / len);
    x += Math.sin(d * 90) * k;
    y += Math.cos(d * 70) * k * 0.6;
  }
  return { x, y };
}

// --- Безопасная зона 9:16 сразу для TikTok, Instagram Reels, Stories и YouTube Shorts (кадр 1080×1920) ---
// Сверху — шапки и вкладки (Reels, Following / For You, имя и полоска в Stories), снизу — ник, подпись, музыка, поле
// ответа, справа — колонка кнопок (лайк, комментарии, репост). Текст и важные детали держим внутри.

export const SAFE = { top: 240, bottom: 1420, left: 60, right: 930, buttons: [800, 1640] as [number, number] };

/** Наложение для проверки кадров: красным — зоны под интерфейсом платформ, оранжевым — колонка кнопок. */
export const SafeGuide: React.FC = () => {
  const zone = (style: React.CSSProperties, label: string) => (
    <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: fonts.ui, fontWeight: 700, fontSize: 26, ...style }}>{label}</div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {zone({ left: 0, top: 0, width: 1080, height: SAFE.top, background: 'rgba(255,0,80,.32)' }, 'шапки: Reels · TikTok · Stories')}
      {zone({ left: 0, top: SAFE.bottom, width: 1080, height: 1920 - SAFE.bottom, background: 'rgba(255,0,80,.32)' }, 'ник, подпись, музыка, ответ')}
      {zone({ left: SAFE.right, top: SAFE.buttons[0], width: 1080 - SAFE.right, height: SAFE.buttons[1] - SAFE.buttons[0], background: 'rgba(255,150,0,.38)' }, 'кнопки')}
      {zone({ left: 0, top: SAFE.top, width: SAFE.left, height: SAFE.bottom - SAFE.top, background: 'rgba(255,0,80,.14)' }, '')}
    </AbsoluteFill>
  );
};

// --- Субтитры: 1–3 слова, текущее слово ярче, остальные в тени ---

/** Выделить слова реплики: подряд идущие `words` (без знаков препинания, без регистра). */
export type Emphasis = { id: string; words: string[]; tone: 'yellow' | 'red'; shake?: boolean };
/** `quote` — цвет слов в кавычках: сообщения из переписки отличаются от голоса рассказчика. */
type SubWord = Word & { emph?: Emphasis; quote?: string };
type Chunk = { words: SubWord[]; start: number; end: number };

const norm = (w: string) => w.toLowerCase().replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');

function markWords(tl: Timeline, emphasis: Emphasis[], quotes: Record<string, string>): SubWord[][] {
  return tl.lines.map((line) => {
    const words: SubWord[] = line.words.map((w) => ({ ...w }));
    for (const e of emphasis.filter((x) => x.id === line.id)) {
      const target = e.words.map(norm);
      const at = words.findIndex((_, i) => target.every((x, k) => words[i + k] && norm(words[i + k].text) === x));
      if (at >= 0) target.forEach((_, k) => (words[at + k].emph = e));
    }
    // Всё, что в «…» или “…”, — чужое сообщение: красим цветом отправителя.
    const color = quotes[line.id];
    if (color) {
      let inside = false;
      for (const w of words) {
        if (/^[«“]/.test(w.text)) inside = true;
        if (inside) w.quote = color;
        if (/[»”][.,!?…]*( [—–-])?$/.test(w.text)) inside = false;
      }
    }
    return words;
  });
}

function buildChunks(tl: Timeline, emphasis: Emphasis[], quotes: Record<string, string>): Chunk[] {
  const out: Chunk[] = [];
  const marked = markWords(tl, emphasis, quotes);
  tl.lines.forEach((line, li) => {
    const chunks: SubWord[][] = [];
    let cur: SubWord[] = [];
    for (const w of marked[li]) {
      // Рассказчик — до 3 слов и ~18 символов в строке: длиннее — перенос, и субтитр наезжает на картинку.
      // Сообщение держится целиком до конца фразы (до 8 слов, ~38 символов, в две ровные строки): «я у твоего дома» и
      // «alguien acaba de entrar a tu casa» — один кадр.
      // Выделенные слова и сообщения начинают свой кусок.
      const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
      const prev = cur.at(-1);
      const q = !!w.quote;
      const startsEmph = w.emph && !prev?.emph;
      const endsEmph = !w.emph && prev?.emph;
      const switchesVoice = prev && q !== !!prev.quote;
      if (cur.length && (startsEmph || endsEmph || switchesVoice || (!w.emph && len + w.text.length > (q ? 38 : 18)))) {
        chunks.push(cur);
        cur = [];
      }
      cur.push(w);
      if ((!w.emph && cur.length >= (q ? 8 : 3)) || /[.,!?…:;»”"—]$/.test(w.text)) {
        chunks.push(cur);
        cur = [];
      }
    }
    if (cur.length) chunks.push(cur);
    const nextLine = tl.lines[li + 1]?.start ?? Infinity;
    chunks.forEach((words, i) => {
      const end = chunks[i + 1]?.[0].start ?? Math.min(line.end + 0.35, nextLine);
      out.push({ words, start: words[0].start, end });
    });
  });
  return out;
}

const TONES = { yellow: '#ffd84a', red: '#ff3d4f' };
const NONE: Emphasis[] = [];
const NO_QUOTES: Record<string, string> = {};

/**
 * Как выглядят субтитры в облике: шрифт, цвет, тень, размер; `box` — подложка (окно диалога у «пикселей», строка
 * терминала). По умолчанию — белый Inter с тенью, как в сериях теста.
 */
export type SubStyle = { font?: string; weight?: number; size?: number; color?: string; shadow?: string; upper?: boolean; box?: React.CSSProperties };
const NO_STYLE: SubStyle = {};

export const Subtitles: React.FC<{ tl: Timeline; y?: number; hideFrom?: number; hide?: [number, number][]; emphasis?: Emphasis[]; quotes?: Record<string, string>; look?: SubStyle }> = ({ tl, y = 1300, hideFrom = Infinity, hide = [], emphasis = NONE, quotes = NO_QUOTES, look = NO_STYLE }) => {
  const t = useTime();
  const chunks = useMemo(() => buildChunks(tl, emphasis, quotes), [tl, emphasis, quotes]);
  const chunk = chunks.find((c) => t >= c.start && t < c.end);
  if (!chunk || t >= hideFrom || hide.some(([a, b]) => t >= a && t < b)) return null;
  const pop = ramp(t, chunk.start, chunk.start + 0.12);
  const big = chunk.words.some((w) => w.emph);
  return (
    // Центр — левее середины кадра, чтобы длинная строка не уходила под колонку кнопок справа.
    <AbsoluteFill style={{ alignItems: 'center', pointerEvents: 'none', paddingRight: 1080 - SAFE.right - SAFE.left }}>
      <div
        style={{
          position: 'absolute', top: y, transform: `translateY(-50%) scale(${(big ? 0.8 : 0.92) + (big ? 0.2 : 0.08) * pop})`, opacity: pop,
          // Без обводки: WebkitTextStroke рисует внутренние контуры глифов — на буквах вылезают «треугольники».
          // balance: сообщение в две строки делится поровну, без одинокого «a» / «into» на второй строке.
          maxWidth: SAFE.right - SAFE.left - 30, textAlign: 'center', textWrap: 'balance', fontFamily: look.font ?? fonts.ui, fontWeight: look.weight ?? 800, fontSize: look.size ?? 76, lineHeight: 1.15, letterSpacing: -0.5,
          color: look.color ?? 'white', textShadow: look.shadow ?? '0 3px 18px rgba(0,0,0,.95), 0 0 6px rgba(0,0,0,.9)', textTransform: look.upper ? 'uppercase' : undefined,
          ...look.box,
        }}
      >
        {chunk.words.map((w, i) => {
          const e = w.emph;
          const j = e?.shake ? shake(t, [w.start, w.start + 0.4, w.start + 0.8], 5, 0.4) : { x: 0, y: 0 };
          return (
            <span
              key={i}
              style={{
                display: 'inline-block', whiteSpace: 'pre', opacity: t >= w.start - 0.03 ? 1 : 0.45,
                ...(w.quote && !e && { color: w.quote }),
                ...(e && { color: TONES[e.tone], fontSize: Math.round((look.size ?? 76) * 1.26), fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0, transform: `translate(${j.x}px, ${j.y}px)`, textShadow: `0 3px 18px rgba(0,0,0,.95), 0 0 26px ${TONES[e.tone]}55` }),
              }}
            >
              {(i ? ' ' : '') + w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Фонарик — значком, а не эмодзи: у рендера может не оказаться шрифта с эмодзи. */
export const TorchIcon: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = 'currentColor' }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 50 30" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="2" y="10" width="22" height="10" rx="2" fill={color} />
    <polygon points="24,7 34,4 34,26 24,23" fill={color} />
    <path d="M 38 9 L 47 5 M 38 15 L 48 15 M 38 21 L 47 25" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// --- Плашка в углу: «NIGHT 1/7 · 02:47 · 2ND FLOOR», мигающая точка, заряд телефона ---

export const Hud: React.FC<{ text: string; blink?: boolean; battery?: number; torch?: boolean }> = ({ text, blink, battery, torch }) => {
  const t = useTime();
  const on = !blink || t % 1 < 0.6;
  return (
    <div
      style={{
        position: 'absolute', left: SAFE.left, top: SAFE.top, padding: '14px 24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(8,11,22,.62)', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.86)',
        fontFamily: fonts.ui, fontWeight: 600, fontSize: 32, letterSpacing: 2, fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ width: 14, height: 14, borderRadius: 7, background: '#ff4256', boxShadow: '0 0 12px #ff4256', opacity: on ? 1 : 0.15 }} />
      {text}
      {battery !== undefined && (
        <>
          <span style={{ opacity: 0.5 }}>·</span>
          {/* фонарик включён — заряд тает быстрее */}
          {torch && <TorchIcon size={30} color="#ffe9b0" />}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: battery <= 25 ? '#ff6b78' : undefined }}>
            <span style={{ position: 'relative', width: 38, height: 20, border: '2.5px solid currentColor', borderRadius: 5, padding: 2 }}>
              <span style={{ display: 'block', width: `${battery}%`, height: '100%', background: 'currentColor', borderRadius: 1.5 }} />
              <span style={{ position: 'absolute', right: -7, top: 4, width: 3.5, height: 7, background: 'currentColor', borderRadius: 1 }} />
            </span>
            {battery}%
          </span>
        </>
      )}
    </div>
  );
};

// --- Камера: медленный наезд внутри сцены, вспышка из чёрного на склейке ---

/**
 * `zoom` — наезд за время плана, к точке `origin` (или `focus`).
 * `base` + `focus` — второй ракурс той же сцены: план в `base` раз крупнее, точка `focus` (px сцены) — в центре кадра.
 * `fade` — вспышка из чёрного на склейке; у первого кадра ролика её нет, чтобы он совпадал с последним (петля).
 */
export const Cam: React.FC<{
  t: number; from: number; to: number; zoom?: number; base?: number; focus?: [number, number];
  driftX?: number; driftY?: number; origin?: string; fade?: boolean; children: React.ReactNode;
}> = ({ t, from, to, zoom = 0.06, base = 1, focus: focusIn, driftX = 0, driftY = 0, origin = '50% 50%', fade = true, children }) => {
  let focus = focusIn;
  const p = interpolate(t, [from, to], [0, 1], clamp);
  const fadeIn = fade ? ramp(t, from, from + 0.18) : 1;
  const { width, height } = useVideoConfig();
  // Крупный план не должен показывать край сцены: точку фокуса держим так, чтобы сцена закрывала весь кадр.
  if (focus && base > 1) {
    const hx = width / (2 * base);
    const hy = height / (2 * base);
    focus = [Math.min(width - hx, Math.max(hx, focus[0])), Math.min(height - hy, Math.max(hy, focus[1]))];
  }
  const outer: React.CSSProperties =
    base === 1 ? {} : focus
      ? { transform: `scale(${base})`, transformOrigin: `${(width / 2 - base * focus[0]) / (1 - base)}px ${(height / 2 - base * focus[1]) / (1 - base)}px` }
      : { transform: `scale(${base})`, transformOrigin: origin };
  return (
    <AbsoluteFill style={{ opacity: fadeIn, ...outer }}>
      <AbsoluteFill style={{ transformOrigin: focus ? `${focus[0]}px ${focus[1]}px` : origin, transform: `scale(${1 + zoom * p}) translate(${driftX * p}px, ${driftY * p}px)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Плёнка: виньетка и зерно ---

export const Film: React.FC<{ grain?: number }> = ({ grain = 0.07 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.72) 100%)' }} />
      <svg width="1080" height="1920" style={{ position: 'absolute', opacity: grain, mixBlendMode: 'screen' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={Math.floor(frame / 3)} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1080" height="1920" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// --- Звук: эффект в момент `at` (секунды) ---

/** Множитель громкости: внутри любого из интервалов `spans` — `k`, на краях плавно до 1. */
export function duckGain(x: number, spans: [number, number][], k: number) {
  let g = 1;
  for (const [a, b] of spans) {
    if (x < a - 0.08 || x > b + 0.15) continue;
    const w = x < a ? (a - x) / 0.08 : x > b ? (x - b) / 0.15 : 0;
    g = Math.min(g, k + (1 - k) * w);
  }
  return g;
}

/** `duck` — интервалы голоса (секунды ролика): там звук тише в `duckTo` раз, чтобы не глушить слова. */
export const Sfx: React.FC<{ at: number; src: string; volume?: number; until?: number; loop?: boolean; fadeIn?: number; fadeOut?: number; duck?: [number, number][]; duckTo?: number }> = ({ at, src, volume = 1, until, loop, fadeIn = 0, fadeOut = 0, duck, duckTo = 0.5 }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const from = Math.max(0, Math.round(at * fps));
  const dur = until ? Math.round((until - at) * fps) : durationInFrames - from;
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <Html5Audio
        src={staticFile(src)}
        loop={loop}
        volume={(f) => {
          const s = f / fps;
          const a = fadeIn ? Math.min(1, s / fadeIn) : 1;
          const b = fadeOut ? Math.min(1, (dur / fps - s) / fadeOut) : 1;
          const d = duck ? duckGain(at + s, duck, duckTo) : 1;
          return volume * d * Math.max(0, Math.min(a, b));
        }}
      />
    </Sequence>
  );
};

/** Все реплики серии, каждая — в свою секунду; звучит только `clip` файла, на срезе — короткое затухание. */
export const Voice: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {tl.lines.filter((l) => l.audio).map((l) => {
        const dur = Math.max(1, Math.round((l.clip[1] - l.clip[0]) * fps));
        return (
          <Sequence key={l.id} from={Math.round(l.start * fps)} durationInFrames={dur} layout="none">
            <Html5Audio src={staticFile(l.audio)} trimBefore={Math.round(l.clip[0] * fps)} volume={(f) => Math.min(1, (f + 1) / 2, (dur - f) / 3)} />
          </Sequence>
        );
      })}
    </>
  );
};

// --- Знаки, которых может не быть в шрифтах: рисуем сами ---

/** Номер варианта в кружке (① ②): в файлах шрифтов этих знаков нет, на чужом компьютере вылез бы квадрат. */
export const Circled: React.FC<{ n: number | string; size?: number; color?: string; fill?: string; ink?: string; font?: string; stroke?: number }> = ({ n, size = 64, color = 'currentColor', fill, ink, font, stroke }) => (
  <span
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size, boxSizing: 'border-box',
      border: `${stroke ?? Math.max(2, Math.round(size * 0.085))}px solid ${color}`, background: fill, color: ink ?? color,
      fontFamily: font ?? fonts.ui, fontWeight: 800, fontSize: Math.round(size * 0.58), lineHeight: 1, verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
    }}
  >
    {n}
  </span>
);

/** «◀◀» перемотки — двумя треугольниками. */
export const RewindIcon: React.FC<{ size?: number; color?: string }> = ({ size = 200, color = 'currentColor' }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 100 60" style={{ display: 'block' }}>
    <polygon points="48,2 48,58 4,30" fill={color} />
    <polygon points="96,2 96,58 52,30" fill={color} />
  </svg>
);
