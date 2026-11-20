// Пример серии «Режиссёра» — серия kompas-03 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { Bay, BayChart, Deck, INK } from '@feed/sets/kompas';

// «Компас», серия 3. Обе ветки развилки серии 2, неверная — первой (зритель выбрал её):
//   крючок и повтор развилки → ВАРИАНТ ① «проходом» (неверный, твой выбор): отлив, шхуна на камнях, «КОНЕЦ» →
//   «Перемотаем» → ВАРИАНТ ② «вокруг острова»: бухта, водолаз, насос, лодка «рыбаков» → новая развилка.
// Новый мир — бухта (parts.tsx). Улики развилки в кадре: в лодке нет сетей, под брезентом — водолазный шлем.

export const meta: EpisodeMeta = {
  id: 'kompas-03',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.4, '04': 0.4, '05': 0.6, '06': 1.7, '07': 0.9, '08': 0.5, '10': 0.5, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'a' as 'a' | 'b';
const PREV = { a: '① ПРОХОДОМ', b: '② ВОКРУГ ОСТРОВА' };
const CHOICE = {
  q: 'БРОСАЕШЬ?',
  a: { n: '①', title: 'БРОСИТЬ КОНЕЦ', price: 'придётся оставить насос' },
  b: { n: '②', title: 'НЕ ПОДПУСКАТЬ', price: 'воды на три дня' },
};
const DARK = '#0f2a2d';

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={INK.teal} ink={INK.paper} {...p} />;

/** Плашка ветки под строкой состояния: какой вариант сейчас идёт и чей это выбор. */
const Branch: React.FC<{ text: string; color: string; mine: boolean; show: number }> = ({ text, color, mine, show }) => (
  <div style={{ position: 'absolute', left: 60, top: 318, display: 'flex', gap: 14, alignItems: 'center', opacity: show, transform: `translateX(${(1 - show) * -30}px)`, fontFamily: fonts.display, fontWeight: 900, fontSize: 38, letterSpacing: '0.04em' }}>
    <span style={{ padding: '8px 16px', background: color, color: DARK }}>{text}</span>
    {/* «ТВОЙ ВЫБОР» рисует плеер поверх ролика, не серия */}
  </div>
);

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: INK.paper }} />;
  const c = cues(tl);
  const w = (id: string, re: RegExp, fallback: number) => c.find(id, re)?.start ?? fallback;
  const ask = w('01', /^Идти/, c.e('01') - 2.6);
  const tide = w('03', /^Отлив/, c.e('03') - 1.2);
  const helmet = w('08', /^Ты$/, c.e('08') - 1.6);
  const fishers = w('10', /^«Рыбаки/, c.e('10') - 2);
  const nope = w('12', /^Не$/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, water: c.s('03') - 0.15, tide: tide - 0.1, grind: c.s('04') - 0.15, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, bay: c.s('08') - 0.15, helmet: helmet - 0.1, pump: c.s('09') - 0.15,
    boat: c.s('10') - 0.15, fishers: fishers - 0.1, line: c.s('11') - 0.15, price: c.s('12') - 0.15, nope: nope - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pump = t * 140;
  const diver = ramp(t, cut.bay + 1.2, cut.helmet + 0.6);
  const boat = interpolate(t, [cut.boat, cut.price], [0, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bay = { boat, diver, pump, t };

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: карта бухты — проход и путь вокруг
    shot = (
      <Shot fx={540} fy={1000} s={1.25 + 0.35 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.1)} cy={900}>
        <BayChart pass={1} around={1} table={0} />
      </Shot>
    );
  } else if (t < cut.water) {
    // в проходе: камни по обе стороны
    shot = (
      <Shot fx={560} fy={980} s={z(cut.b1, cut.water, 1.4, 1.7)} cy={860}>
        <Deck clear={1} dawn={1} reef="ahead" reefShow={1} reefNear={0.8} t={t} />
      </Shot>
    );
  } else if (t < cut.tide) {
    shot = (
      <Shot fx={560} fy={1020} s={z(cut.water, cut.tide, 1.7, 1.9)} cy={860}>
        <Deck clear={1} dawn={1} reef="ahead" reefShow={1} reefNear={z(cut.water, cut.tide, 0.8, 1)} t={t} />
      </Shot>
    );
  } else if (t < cut.grind) {
    // «Отлив был в семь»: таблица приливов крупно
    shot = (
      <Shot fx={235} fy={1105} s={z(cut.tide, cut.grind, 2.4, 2.6)} cy={820}>
        <BayChart pass={1} around={0} table={1} />
      </Shot>
    );
  } else if (t < cut.montage) {
    const j = shake(t, [cut.grind + 0.4], 26, 0.6);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={560} fy={1000} s={z(cut.grind, cut.montage, 1.8, 2)} cy={860}>
          <Deck clear={1} dawn={1} reef="ahead" reefShow={1} reefNear={1} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 18, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px) rotate(${Math.min(12, step * -2.2)}deg)` }}>
        <Shot fx={560} fy={1000} s={2 + step * 0.1} cy={860}>
          <Deck clear={1} dawn={1} reef="ahead" reefShow={1} reefNear={1} barrels={Math.max(0, 6 - step)} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={560 + 14 * Math.sin(t * 90)} fy={1000} s={2 - 0.8 * p} cy={860}>
        <Deck clear={1} dawn={1} reef="ahead" reefShow={1 - p} reefNear={1 - p} t={t} />
      </Shot>
    );
  } else if (t < cut.bay) {
    // три дня вокруг острова
    shot = (
      <Shot fx={z(cut.b2, cut.bay, 700, 860)} fy={z(cut.b2, cut.bay, 1300, 800)} s={1.5} cy={860}>
        <BayChart pass={0} around={ramp(t, cut.b2, cut.bay - 0.3)} table={0} />
      </Shot>
    );
  } else if (t < cut.helmet) {
    // бухта: капитан в шлеме уходит под воду
    shot = (
      <Shot fx={500} fy={1200} s={z(cut.bay, cut.helmet, 1.2, 1.5)} cy={860}>
        <Bay {...bay} boat={0} />
      </Shot>
    );
  } else if (t < cut.boat) {
    // качаешь воздух: колесо насоса крупно, пузыри
    shot = (
      <Shot fx={300} fy={1450} s={z(cut.helmet, cut.boat, 1.8, 2.1)} cy={900}>
        <Bay {...bay} boat={0} />
      </Shot>
    );
  } else if (t < cut.line) {
    // из-за мыса выходит лодка
    shot = (
      <Shot fx={z(cut.boat, cut.line, 900, 760)} fy={880} s={z(cut.boat, cut.line, 1.8, 1.6)} cy={820}>
        <Bay {...bay} />
      </Shot>
    );
  } else if (t < cut.price) {
    // лодка ближе: пустое дно, брезент на носу
    shot = (
      <Shot fx={640} fy={1040} s={z(cut.line, cut.price, 1.7, 2)} cy={860}>
        <Bay {...bay} tarp={ramp(t, cut.line + 0.6, cut.line + 1.2)} />
      </Shot>
    );
  } else if (t < cut.nope) {
    shot = (
      <Shot fx={300} fy={1450} s={z(cut.price, cut.nope, 1.9, 2.2)} cy={900}>
        <Bay {...bay} tarp={1} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={540} fy={1150} s={z(cut.nope, cut.cards, 1.1, 1.25)} cy={880}>
        <Bay {...bay} tarp={1} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.bay ? ['ДЕНЬ 2/7', '06:40', 'ВОДА 6 ДН.'] : ['ДЕНЬ 5/7', '10:20', 'ВОДА 3 ДН.'];
  const hudOn = t < cut.end || t >= cut.b2 ? 1 - cardsIn : 0;

  return (
    <AbsoluteFill style={{ background: INK.paper }}>
      <AbsoluteFill style={{ filter: grey ? 'grayscale(1) contrast(1.1)' : undefined }}>{shot}</AbsoluteFill>
      <Film grain={0.03} />

      {/* повтор развилки прошлой серии — на вопросе крючка */}
      {t >= ask - 0.1 && t < cut.b1 && (
        <div style={{ position: 'absolute', left: 60, top: 1010, width: 870, display: 'flex', flexDirection: 'column', gap: 14, opacity: ramp(t, ask - 0.1, ask + 0.2), fontFamily: fonts.display, fontWeight: 900, fontSize: 54, letterSpacing: '0.03em' }}>
          <span style={{ padding: '14px 22px', background: DARK, border: `6px solid ${INK.orange}`, color: INK.paper }}>{PREV.a}</span>
          <span style={{ padding: '14px 22px', background: DARK, border: `6px solid ${INK.yellow}`, color: INK.paper }}>{PREV.b}</span>
        </div>
      )}

      {t >= cut.end && t < cut.rewind && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 150 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 150, letterSpacing: '0.08em', color: INK.orange, opacity: ramp(t, cut.end, cut.end + 0.15) }}>КОНЕЦ</div>
          <div style={{ fontFamily: fonts.ui, fontWeight: 700, fontSize: 40, color: INK.paper, opacity: 0.85 * ramp(t, cut.end + 0.3, cut.end + 0.6), marginTop: 10 }}>вариант ① — неверный</div>
        </AbsoluteFill>
      )}
      {t >= cut.rewind && t < cut.b2 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 150 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 200, color: INK.paper, textShadow: `0 0 30px ${DARK}`, opacity: Math.floor(t * 8) % 2 ? 1 : 0.55 }}>◀◀</div>
        </AbsoluteFill>
      )}

      {t >= cut.cards && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: 'rgba(15,42,45,.88)', opacity: cardsIn }} />
          <Card top={250} color={INK.orange} item={CHOICE.a} show={cardsIn}>
            <div style={{ position: 'absolute', left: -330, top: -1580, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.6)' }}>
              <Bay boat={0.85} tarp={1} diver={1} pump={t * 140} t={t} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -60, top: -2000, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.6)' }}>
              <Bay boat={0} diver={1} pump={t * 140} t={t} p="c2" />
            </div>
          </Card>
          <div style={{ position: 'absolute', left: 40, top: 780, width: 1000, height: 100, display: 'flex', alignItems: 'center', paddingLeft: 34, opacity: cardsIn, fontFamily: fonts.display, fontWeight: 900, fontSize: 62, letterSpacing: '0.04em', color: INK.paper }}>
            {CHOICE.q}
          </div>
          <div style={{ position: 'absolute', left: 40, top: 872, width: 1000 * left, height: 8, background: INK.orange }} />
        </AbsoluteFill>
      )}

      <div style={{ position: 'absolute', left: 60, top: 244, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 18px', background: DARK, fontFamily: fonts.display, fontWeight: 800, fontSize: 36, letterSpacing: '0.05em', color: INK.paper, opacity: hudOn }}>
        <span>{hud[0]}</span>
        <span style={{ opacity: 0.8 }}>· {hud[1]}</span>
        <span style={{ color: INK.yellow }}>· {hud[2]}</span>
      </div>
      {inBad && <Branch text={`ВАРИАНТ ${PREV.a}`} color={INK.orange} mine={CHOSEN === 'a'} show={ramp(t, cut.b1, cut.b1 + 0.25)} />}
      {inGood && <Branch text={`ВАРИАНТ ${PREV.b}`} color={INK.yellow} mine={CHOSEN === 'b'} show={ramp(t, cut.b2, cut.b2 + 0.25)} />}

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '10': INK.yellow, '11': INK.yellow }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} until={cut.end} src={`${SFX}/sea.wav`} volume={0.4} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.55} />
          <Sfx at={cut.b2} src={`${SFX}/sea.wav`} volume={0.35} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.18} fadeIn={0.4} fadeOut={0.4} />
          {/* неверная ветка: отлив, скрежет, удары о камни, «КОНЕЦ» */}
          <Sfx at={cut.tide} src={`${SFX}/hit.wav`} volume={0.55} />
          <Sfx at={cut.grind + 0.4} src={`${SFX}/hit.wav`} volume={0.9} />
          <Sfx at={cut.grind + 0.4} src={`${SFX}/crunch.wav`} volume={0.5} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.b1} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={0.8} duck={speech} duckTo={0.7} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: насос качает — ровный низкий удар, лодка, развилка */}
          <Sfx at={cut.helmet} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.3} fadeIn={0.6} duck={speech} duckTo={0.6} />
          <Sfx at={cut.boat + 0.2} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.line + 0.7} src={`${SFX}/hit.wav`} volume={0.75} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
