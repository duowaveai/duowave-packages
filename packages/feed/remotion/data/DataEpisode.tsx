import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { Circled, Film, RewindIcon, Sfx, Subtitles, Voice, ramp, shake, useTime } from '../lib/kit';
import { Shot } from '../lib/stage';
import { loadEpisode } from '../lib/episode';
import type { BranchTimes, Timeline } from '../lib/timeline';
import { LOOKS, type LookDef } from '../looks/index';
import { CATALOG, SetView } from '../sets/index';
import { computeTimes, engineTimes, pacingOf, problemsOf, stateAt, type DataTimes } from './times';
import type { BedItem, ChoiceVariant, DataEpisode } from './types';

// Серия данными («Обычно»): планы — камера на декорации из библиотеки, события — по репликам и словам, плашка,
// субтитры, голос, фон под голосом, «КОНЕЦ» и перемотка для «обе ветки», карточки развилки с отсчётом.
// «ТВОЙ ВЫБОР» здесь не рисуется никогда — его рисует плеер поверх ролика.

export type DataProps = {
  episode: DataEpisode | null;
  tl?: Timeline | null;
  draft?: boolean;
  /** Для движка (calculateMetadata): когда встают карточки, где ветки. */
  choiceAt?: number | null;
  branchTimes?: BranchTimes | null;
};

const FPS = 30;
const ease = Easing.bezier(0.33, 0, 0.2, 1);
const z = (t: number, a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const inAny = (t: number, spans: [number, number][]) => spans.some(([a, b]) => t >= a && t < b);
const sfxPath = (id: string, name: string) => `${id}/sfx/${name.replace(/\.wav$/, '')}.wav`;

/** calculateMetadata композиции `data`: таймлайн по озвучке (или черновик), проверка, длина, времена для движка. */
export async function dataMetadata(props: DataProps) {
  const ep = props.episode;
  if (!ep) return { durationInFrames: FPS, props: { ...props, tl: null, draft: true, choiceAt: null, branchTimes: null } };
  const { tl, draft } = await loadEpisode({ id: ep.id, lang: ep.lang, pacing: pacingOf(ep) });
  const problems = problemsOf(ep, tl);
  if (problems.length) throw new Error(`серия ${ep.id} не собирается:\n- ${problems.join('\n- ')}`);
  return { durationInFrames: Math.ceil(tl.total * FPS), props: { ...props, tl, draft, ...engineTimes(ep, tl) } };
}

/** Камера на план: наезд от s[0] к s[1]; первый план — быстрый наезд в первые секунды (хук). */
function camera(span: DataTimes['shots'][number], t: number, first: boolean) {
  const p = (t - span.start) / Math.max(0.001, span.end - span.start);
  const k = first ? Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (t - span.start) / Math.min(2.4, span.end - span.start)))) * 0.75 + Math.min(1, Math.max(0, p)) * 0.25 : Math.min(1, Math.max(0, p));
  return { fx: span.fx, fy: span.fy, cy: span.cy, s: span.s[0] + (span.s[1] - span.s[0]) * k };
}

/** Картинка варианта на карточке: ракурс декорации так, что её точка стоит справа от текста. */
const Thumb: React.FC<{ v: ChoiceVariant; t: number; p: string }> = ({ v, t, p }) => {
  const info = CATALOG[v.set];
  const spot = v.spot ? info?.spots[v.spot] : info ? Object.values(info.spots)[0] : undefined;
  const fx = v.fx ?? spot?.fx ?? 540;
  const fy = v.fy ?? spot?.fy ?? 960;
  const k = Math.max(0.95, v.s ?? (spot?.s ?? 1) * 0.8);
  // карточка 984×514 внутри рамки; точка (fx, fy) — в (690, 257), край мира в карточку не попадает
  const left = Math.min(0, Math.max(984 - 1080 * k, 690 - fx * k));
  const top = Math.min(0, Math.max(514 - 1920 * k, 257 - fy * k));
  return (
    <div style={{ position: 'absolute', left, top, width: 1080, height: 1920, transformOrigin: '0 0', transform: `scale(${k})` }}>
      <SetView id={v.set} state={v.state} t={t} p={p} />
    </div>
  );
};

/** Карточка варианта: картинка, слева — номер в кружке, название и цена. Цвет — по тому, кому веришь (не зелёный). */
const ChoiceCard: React.FC<{ top: number; n: number; color: string; look: LookDef; v: ChoiceVariant; show: number; t: number; p: string }> = ({ top, n, color, look, v, show, t, p }) => (
  <div style={{ position: 'absolute', left: 40, top, width: 1000, height: 530, overflow: 'hidden', border: `8px solid ${color}`, opacity: show, transform: `translateY(${(1 - show) * 40}px)`, background: look.ui.cardBg }}>
    <Thumb v={v} t={t} p={p} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,7,10,.92) 0%, rgba(8,7,10,.7) 46%, rgba(8,7,10,0) 78%)' }} />
    <div style={{ position: 'absolute', left: 34, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: look.ui.cardInk, fontFamily: look.display }}>
      <Circled n={n} size={78} color={color} font={look.display} />
      <div style={{ fontWeight: 900, fontSize: look.display === LOOKS.pixel.display ? 44 : 66, lineHeight: 1.08, letterSpacing: '0.02em', marginTop: 14, textTransform: 'uppercase', textWrap: 'balance' }}>{v.title}</div>
      <div style={{ fontFamily: look.hud.font === LOOKS.pixel.hud.font ? look.hud.font : undefined, fontWeight: 600, fontSize: look.display === LOOKS.pixel.display ? 24 : 34, lineHeight: 1.25, marginTop: 16, opacity: 0.92 }}>{v.price}</div>
    </div>
  </div>
);

/** Плашка вверху слева: счётчик и ресурс, последнее — цветом акцента. */
const HudPlaque: React.FC<{ hud: string[]; look: LookDef; show: number; t: number }> = ({ hud, look, show, t }) => {
  if (!hud.length || show <= 0) return null;
  const h = look.hud;
  const blink = Math.floor(t * 2) % 2 === 0;
  const pixel = h.font === LOOKS.pixel.hud.font;
  return (
    <div
      style={{
        position: 'absolute', left: 60, top: 244, display: 'flex', alignItems: 'center', gap: pixel ? 22 : 18, padding: pixel ? '16px 22px' : '10px 18px', background: h.bg, border: h.border,
        fontFamily: h.font, fontWeight: pixel ? 400 : 800, fontSize: pixel ? 26 : 36, letterSpacing: pixel ? 0 : '0.05em', color: h.ink, opacity: show, maxWidth: 860, whiteSpace: 'nowrap',
      }}
    >
      {h.dot && <span style={{ width: 16, height: 16, borderRadius: 8, background: look.ui.alarm, opacity: blink ? 1 : 0.25, flexShrink: 0 }} />}
      {hud.map((s, i) => (
        <span key={i} style={{ color: i === hud.length - 1 && hud.length > 1 ? h.accent : undefined, opacity: i > 0 && i < hud.length - 1 ? 0.82 : 1 }}>
          {i ? '· ' : ''}
          {s}
        </span>
      ))}
    </div>
  );
};

/** Фон под всей серией: громкость и приглушение под голосом — по звуку. */
const BED: Record<string, { volume: number; duck?: number }> = {
  low: { volume: 0.3 },
  sea: { volume: 0.4, duck: 0.55 },
  wind: { volume: 0.16, duck: 0.5 },
  static: { volume: 0.06, duck: 0.6 },
  heart: { volume: 0.5, duck: 0.6 },
};

export const DataEpisodeView: React.FC<DataProps> = ({ episode: ep, tl, draft = true }) => {
  const t = useTime();
  const look = LOOKS[ep?.look ?? 'glass'] ?? LOOKS.glass;
  const times = useMemo(() => (ep && tl ? computeTimes(ep, tl) : null), [ep, tl]);
  if (!ep || !tl || !times) return <AbsoluteFill style={{ background: look.ui.bg }} />;
  const lang = ep.lang ?? 'ru';

  // текущий план и камера
  const idx = Math.max(0, times.shots.findLastIndex((s) => t >= s.start));
  const span = times.shots[idx]!;
  const cam = camera(span, t, idx === 0);
  const rewind = times.rewinds.find(([a, b]) => t >= a && t < b);
  const ended = inAny(t, times.ends);
  let { fx, s } = cam;
  if (rewind) {
    // перемотка: кадр без цвета дёргается и отъезжает назад
    const p = (t - rewind[0]) / (rewind[1] - rewind[0]);
    fx += 14 * Math.sin(t * 90);
    s = Math.max(1, s * (1.25 - 0.25 * p));
  }
  const shakes = times.events.filter((e) => e.ev.fx === 'shake').map((e) => e.t);
  const j = shake(t, shakes, 16, 0.35);
  const flashes = times.events.filter((e) => e.ev.fx === 'flash').map((e) => e.t);
  const flash = flashes.reduce((m, a) => (t >= a && t < a + 0.3 ? Math.max(m, 0.75 * (1 - (t - a) / 0.3)) : m), 0);
  const state = stateAt(span.shot.set, times.keys[span.shot.set], t, ease);

  // карточки развилки
  const cards = times.cards;
  const cardsIn = Number.isFinite(cards) ? ramp(t, cards, cards + 0.3) : 0;
  const left = Number.isFinite(cards) ? z(t, cards + 0.3, tl.total, 1, 0) : 1;
  const hud = times.huds.findLast((h) => t >= h.t)?.hud ?? [];
  const hudOn = ended || rewind ? 0 : 1 - cardsIn;

  // звук
  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const silent = times.ends.map(([a, b]) => [a, (times.rewinds.find(([r]) => r >= b - 0.05)?.[1] ?? b)] as [number, number]);
  const quotes = Object.fromEntries(tl.lines.filter((l) => l.role && l.role !== 'narrator').map((l) => [l.id, look.ui.accent]));
  const radioLines = tl.lines.filter((l) => l.role === 'radio' || l.role === 'phone');

  return (
    <AbsoluteFill style={{ background: look.ui.bg }}>
      <AbsoluteFill style={{ transform: `translate(${j.x}px, ${j.y}px)`, filter: rewind ? 'grayscale(1) contrast(1.1)' : undefined }}>
        <Shot fx={fx} fy={cam.fy} s={s} cy={cam.cy}>
          <SetView id={span.shot.set} state={state} t={t} />
        </Shot>
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: '#fff', opacity: flash }} />}
      {look.grain > 0 && <Film grain={look.grain} />}

      {/* «КОНЕЦ» неверной ветки и перемотка */}
      {ended && (
        <AbsoluteFill style={{ background: '#050406', alignItems: 'center', justifyContent: 'center', paddingRight: 150 }}>
          <div style={{ fontFamily: look.display, fontWeight: 900, fontSize: lang === 'en' ? 130 : 150, letterSpacing: '0.08em', color: look.ui.alarm, opacity: ramp(t, times.ends.find(([a, b]) => t >= a && t < b)![0], times.ends.find(([a, b]) => t >= a && t < b)![0] + 0.15) }}>
            {lang === 'en' ? 'THE END' : 'КОНЕЦ'}
          </div>
        </AbsoluteFill>
      )}
      {rewind && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 150, opacity: Math.floor(t * 8) % 2 ? 1 : 0.55 }}>
          <div style={{ filter: 'drop-shadow(0 6px 24px rgba(0,0,0,.7))' }}>
            <RewindIcon size={220} color="#f4efe4" />
          </div>
        </AbsoluteFill>
      )}

      {/* развилка: две карточки, вопрос между ними, красная линия отсчёта */}
      {ep.choice && t >= cards && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: look.ui.shade, opacity: cardsIn }} />
          <ChoiceCard top={250} n={1} color={look.ui.a} look={look} v={ep.choice.a} show={cardsIn} t={t} p="c1" />
          <ChoiceCard top={880} n={2} color={look.ui.b} look={look} v={ep.choice.b} show={ramp(t, cards + 0.12, cards + 0.42)} t={t} p="c2" />
          <div style={{ position: 'absolute', left: 40, top: 780, width: 1000, height: 100, display: 'flex', alignItems: 'center', paddingLeft: 34, opacity: cardsIn, fontFamily: look.display, fontWeight: 900, fontSize: look === LOOKS.pixel ? 40 : 62, letterSpacing: '0.04em', color: look.ui.cardInk, textTransform: 'uppercase' }}>
            {ep.choice.q}
          </div>
          <div style={{ position: 'absolute', left: 40, top: 872, width: 1000 * left, height: 8, background: look.ui.alarm }} />
        </AbsoluteFill>
      )}

      <HudPlaque hud={hud} look={look} show={hudOn} t={t} />
      <Subtitles tl={tl} hideFrom={cards} hide={[...times.ends, ...times.rewinds]} emphasis={ep.emphasis} quotes={quotes} look={look.sub} />

      {!draft && (
        <>
          <Voice tl={tl} />
          {(ep.bed ?? []).map((b, i) => (
            <Bed key={i} item={b} id={ep.id} tl={tl} total={tl.total} silent={silent} speech={speech} />
          ))}
          {radioLines.map((l) => (
            <Sfx key={l.id} at={Math.max(0, l.start - 0.2)} until={l.end + 0.25} src={sfxPath(ep.id, 'static')} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          ))}
          {times.events.map((e, i) => {
            const name = e.ev.sfx ?? (e.ev.fx === 'rewind' ? 'rewind' : e.ev.fx === 'end' ? 'hit' : null);
            if (!name) return null;
            const at = e.ev.fx === 'end' ? times.ends.find(([a]) => a >= e.t - 0.01)?.[0] ?? e.t : e.t;
            const loop = name === 'heart';
            return <Sfx key={i} at={at} src={sfxPath(ep.id, name)} volume={e.ev.volume ?? (e.ev.fx === 'end' ? 0.95 : e.ev.fx === 'rewind' ? 0.4 : 0.6)} {...(loop ? { loop: true, until: Math.min(cards, tl.total), fadeIn: 1, duck: speech, duckTo: 0.6 } : {})} />;
          })}
          {Number.isFinite(cards) && (
            <>
              <Sfx at={Math.max(0, cards - 3)} until={cards} src={sfxPath(ep.id, 'rise')} volume={0.2} duck={speech} duckTo={0.5} />
              <Sfx at={cards} src={sfxPath(ep.id, 'hit')} volume={0.9} />
            </>
          )}
        </>
      )}
      {draft && (
        <div style={{ position: 'absolute', right: 40, top: 150, fontFamily: look.hud.font, fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,.6)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
          {lang === 'en' ? 'draft, no sound' : 'черновик без звука'}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Фон под серией кусками: молчит во время «КОНЕЦ» и перемотки, по краям — плавно. */
const Bed: React.FC<{ item: BedItem; id: string; tl: Timeline; total: number; silent: [number, number][]; speech: [number, number][] }> = ({ item, id, tl, total, silent, speech }) => {
  const b = typeof item === 'string' ? { name: item } : item;
  const conf = BED[b.name] ?? { volume: 0.3, duck: 0.5 };
  const from = b.from ? Math.max(0, (tl.lines.find((l) => l.id === b.from)?.start ?? 0) - 0.15) : 0;
  const until = b.until ? (tl.lines.find((l) => l.id === b.until)?.end ?? total) : total;
  // куски между молчанием
  const pieces: [number, number][] = [];
  let a = from;
  for (const [s, e] of [...silent].sort((x, y) => x[0] - y[0])) {
    if (e <= a || s >= until) continue;
    if (s > a) pieces.push([a, Math.min(s, until)]);
    a = Math.max(a, e);
  }
  if (a < until) pieces.push([a, until]);
  return (
    <>
      {pieces.filter(([s, e]) => e - s > 0.2).map(([s, e], i) => (
        <Sfx key={i} at={s} until={e} src={sfxPath(id, b.name)} loop volume={b.volume ?? conf.volume} fadeIn={0.4} fadeOut={0.4} {...(conf.duck ? { duck: speech, duckTo: conf.duck } : {})} />
      ))}
    </>
  );
};

