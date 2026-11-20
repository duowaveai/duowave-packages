// Пример серии «Режиссёра» — серия kompas-02 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { BayChart, Deck, INK, Wheelhouse } from '@feed/sets/kompas';

// «Компас», серия 2. Обе ветки развилки серии 1:
//   крючок и повтор развилки → ВАРИАНТ ① «по компасу» (неверный): рифы по носу, «КОНЕЦ» → «Перемотаем» →
//   ВАРИАНТ ② «по звёздам» (верный, твой выбор): рифы слева, капитан признаёт железо под компасом, в сундуке шлем
//   и карта → новая развилка у бухты. Улика развилки — таблица приливов на карте и время на плашке.

export const meta: EpisodeMeta = {
  id: 'kompas-02',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.5, '04': 0.6, '05': 1.7, '06': 0.9, '07': 0.5, '10': 0.5, '11': 0.5, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'a', wrongLines: ['02', '04'], rightLines: ['06', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'b' as 'a' | 'b';
const PREV = { a: '① ПО КОМПАСУ', b: '② ПО ЗВЁЗДАМ' };
const CHOICE = {
  q: 'КУДА ИДЁШЬ?',
  a: { n: '①', title: 'ПРОХОДОМ', price: 'к обеду в бухте, но между камнями в обрез' },
  b: { n: '②', title: 'ВОКРУГ ОСТРОВА', price: 'три дня и половина воды' },
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
  const ask = w('01', /^Держать/, c.e('01') - 2.4);
  const grind = w('03', /^скрежет/, c.e('03') - 1);
  const atChest = w('08', /^Потом/, c.e('08') - 1);
  const around = w('11', /^Или/, (c.s('11') + c.e('11')) / 2);
  const around2 = w('12', /^Вокруг/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('04') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, dawnBad: c.s('03') - 0.15, grind: grind - 0.1, montage: c.s('04') - 0.1, end,
    rewind: c.s('05') - 0.25, b2: c.s('06') - 0.3, dawnGood: c.s('07') - 0.15, captain: c.s('08') - 0.15, atChest: atChest - 0.1,
    admits: c.s('09') - 0.15, open: c.s('10') - 0.15, ways: c.s('11') - 0.15, around: around - 0.1, price: c.s('12') - 0.15,
    around2: around2 - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const night = { needle: 0, chest: 1, captain: 1, clear: 1, t };

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: компас и звезда в окне
    shot = (
      <Shot fx={540} fy={820} s={1.2 + 0.4 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.12)} cy={820}>
        <Wheelhouse {...night} captain={0} />
      </Shot>
    );
  } else if (t < cut.dawnBad) {
    shot = (
      <Shot fx={905} fy={980} s={z(cut.b1, cut.dawnBad, 2.1, 2.4)} cy={820}>
        <Wheelhouse {...night} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // рассвет: рифы прямо по носу; на «скрежет» — удар
    const j = t >= cut.grind ? shake(t, [cut.grind], 26, 0.6) : { x: 0, y: 0 };
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={560} fy={980} s={z(cut.dawnBad, cut.montage, 1.3, 1.7)} cy={860}>
          <Deck clear={1} dawn={ramp(t, cut.dawnBad, cut.dawnBad + 0.8)} reef="ahead" reefShow={ramp(t, cut.dawnBad + 0.4, cut.dawnBad + 1)} reefNear={z(cut.dawnBad, cut.montage, 0.2, 0.7)} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.end) {
    // плохой конец: шхуну кренит на камнях, кадр рывками
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 18, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px) rotate(${Math.min(14, step * 2.4)}deg)` }}>
        <Shot fx={560} fy={980} s={1.8 + step * 0.12} cy={860}>
          <Deck clear={1} dawn={1} reef="ahead" reefShow={1} reefNear={1} barrels={Math.max(0, 7 - step)} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={560 + 14 * Math.sin(t * 90)} fy={980} s={2 - 0.7 * p} cy={860}>
        <Deck clear={1} dawn={1 - p} reef="ahead" reefShow={1 - p} reefNear={1 - p} t={t} />
      </Shot>
    );
  } else if (t < cut.dawnGood) {
    // крутишь штурвал вправо: штурвал и компас в кадре, звезда в окне
    shot = (
      <Shot fx={330} fy={1300} s={z(cut.b2, cut.dawnGood, 1.3, 1.5)} cy={860}>
        <Wheelhouse {...night} captain={0} wheel={z(cut.b2 + 0.3, cut.dawnGood, 0, 140)} />
      </Shot>
    );
  } else if (t < cut.captain) {
    shot = (
      <Shot fx={640} fy={980} s={z(cut.dawnGood, cut.captain, 1.25, 1.5)} cy={860}>
        <Deck clear={1} dawn={ramp(t, cut.dawnGood, cut.dawnGood + 0.8)} reef="left" reefShow={1} reefNear={0.25} t={t} />
      </Shot>
    );
  } else if (t < cut.atChest) {
    shot = (
      <Shot fx={905} fy={980} s={z(cut.captain, cut.atChest, 1.9, 2.2)} cy={820}>
        <Wheelhouse {...night} />
      </Shot>
    );
  } else if (t < cut.admits) {
    shot = (
      <Shot fx={540} fy={1700} s={z(cut.atChest, cut.admits, 2, 2.3)} cy={900}>
        <Wheelhouse {...night} />
      </Shot>
    );
  } else if (t < cut.open) {
    shot = (
      <Shot fx={905} fy={950} s={z(cut.admits, cut.open, 2.5, 2.8)} cy={820}>
        <Wheelhouse {...night} />
      </Shot>
    );
  } else if (t < cut.ways) {
    // сундук открывается: шлем и карта
    shot = (
      <Shot fx={540} fy={1620} s={z(cut.open, cut.ways, 2.1, 2.4)} cy={900}>
        <Wheelhouse {...night} open={ramp(t, cut.open + 0.2, cut.open + 0.9)} />
      </Shot>
    );
  } else if (t < cut.price) {
    // карта бухты: сначала путь проходом, потом вокруг острова; таблица приливов в кадре
    shot = (
      <Shot fx={540} fy={960} s={z(cut.ways, cut.price, 1, 1.08)} cy={900}>
        <BayChart pass={ramp(t, cut.ways + 0.3, cut.around)} around={ramp(t, cut.around, cut.around + 1.6)} table={0} />
      </Shot>
    );
  } else if (t < cut.around2) {
    shot = (
      <Shot fx={330} fy={900} s={z(cut.price, cut.around2, 1.8, 2.1)} cy={860}>
        <BayChart pass={1} around={1} table={0} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={860} fy={900} s={z(cut.around2, cut.cards, 1.4, 1.6)} cy={820}>
        <BayChart pass={1} around={1} table={0} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.dawnBad ? ['ДЕНЬ 1/7', '02:30', 'ВОДА 7 ДН.'] : t < cut.end ? ['ДЕНЬ 2/7', '05:40', 'ВОДА 7 ДН.'] : t < cut.dawnGood ? ['ДЕНЬ 1/7', '02:30', 'ВОДА 7 ДН.'] : ['ДЕНЬ 2/7', '06:20', 'ВОДА 6 ДН.'];
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
            <div style={{ position: 'absolute', left: -60, top: -1100, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.6)' }}>
              <BayChart pass={1} around={0} table={0} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -600, top: -760, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.3)' }}>
              <BayChart pass={0} around={1} table={0} p="c2" />
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

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '09': INK.yellow }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} until={cut.end} src={`${SFX}/sea.wav`} volume={0.4} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.55} />
          <Sfx at={cut.b2} src={`${SFX}/sea.wav`} volume={0.4} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/wind.wav`} volume={0.12} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.5} />
          <Sfx at={cut.b2} src={`${SFX}/wind.wav`} volume={0.12} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.5} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.4} />
          {/* неверная ветка: скрежет, удары о камни, «КОНЕЦ» */}
          <Sfx at={cut.grind} src={`${SFX}/hit.wav`} volume={0.9} />
          <Sfx at={cut.grind} src={`${SFX}/crunch.wav`} volume={0.5} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.dawnBad} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={0.8} duck={speech} duckTo={0.7} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: рифы проходят мимо, сундук, карта */}
          <Sfx at={cut.dawnGood + 0.3} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.admits} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.open + 0.3} src={`${SFX}/hit.wav`} volume={0.7} />
          <Sfx at={cut.price} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.45} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
