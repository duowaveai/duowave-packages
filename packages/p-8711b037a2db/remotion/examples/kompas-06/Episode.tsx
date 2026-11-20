// Пример серии «Режиссёра» — серия kompas-06 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { Bay, CoastChart, Deck, INK, Stern } from '@feed/sets/kompas';

// «Компас», серия 6. Обе ветки развилки серии 5:
//   крючок и повтор развилки → ВАРИАНТ ② «ждать рассвета» (неверный): ночью без огня обрезали якорь и увели ящик,
//   «КОНЕЦ» → «Перемотаем» → ВАРИАНТ ① «уйти проходом» (верный, твой выбор): ночной прилив, лодка за кормой,
//   утро и два пути к берегу. Улика развилки — название «АЛЫЙ» на борту лодки в свете её фонаря.

export const meta: EpisodeMeta = {
  id: 'kompas-06',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.6, '04': 0.6, '05': 0.6, '06': 1.7, '07': 0.9, '09': 0.5, '10': 0.6, '11': 0.4, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'b', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'a' as 'a' | 'b';
const PREV = { a: '① УЙТИ ПРОХОДОМ', b: '② ЖДАТЬ РАССВЕТА' };
const CHOICE = {
  q: 'КУДА ПРАВИШЬ?',
  a: { n: '①', title: 'В ПОРТ АЛЫЙ', price: 'день хода, но порт тебе незнаком' },
  b: { n: '②', title: 'К МАЯКУ', price: 'два дня, каждый глоток на счету' },
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
  const ask = w('01', /^Уйти/, c.e('01') - 2.4);
  const lightOut = w('02', /^Фонарь/, c.e('02') - 1.2);
  const noBox = w('04', /^Ящика/, c.e('04') - 1.2);
  const below = w('08', /^Но$/, c.e('08') - 1.2);
  const far = w('11', /^Или/, (c.s('11') + c.e('11')) / 2);
  const toLight = w('12', /^К$/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, lightOut: lightOut - 0.1, oars: c.s('03') - 0.15, morning: c.s('04') - 0.15, noBox: noBox - 0.1,
    montage: c.s('05') - 0.1, end, rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, foam: c.s('08') - 0.15, below: below - 0.1,
    stern: c.s('09') - 0.15, day: c.s('10') - 0.15, ways: c.s('11') - 0.15, far: far - 0.1, price: c.s('12') - 0.15,
    toLight: toLight - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pump = 0;
  const night = { boat: 0, diver: 0, pump, dusk: 1, box: 1, noDiver: true, t };

  // правая ветка (верная) идёт второй; метку «ТВОЙ ВЫБОР» на ветке зрителя рисует плеер
  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    shot = (
      <Shot fx={900} fy={680} s={1.4 + 0.4 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.1)} cy={780}>
        <Bay {...night} lantern={1} />
      </Shot>
    );
  } else if (t < cut.oars) {
    // фонарь у мыса гаснет
    shot = (
      <Shot fx={900} fy={680} s={z(cut.b1, cut.oars, 2, 2.3)} cy={780}>
        <Bay {...night} lantern={1 - ramp(t, cut.lightOut, cut.lightOut + 0.3)} night={ramp(t, cut.b1, cut.oars)} />
      </Shot>
    );
  } else if (t < cut.morning) {
    // в темноте у самого борта — лодка без огня
    shot = (
      <Shot fx={620} fy={1150} s={z(cut.oars, cut.morning, 1.7, 2)} cy={860}>
        <Bay {...night} boat={ramp(t, cut.oars, cut.oars + 1.6)} night={1} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // утро: ящика нет
    shot = (
      <Shot fx={505} fy={1715} s={z(cut.morning, cut.montage, 1.7, 2.1)} cy={880}>
        <Bay boat={0} diver={0} noDiver pump={pump} box={1 - ramp(t, cut.noBox, cut.noBox + 0.3)} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 14, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={505} fy={1715} s={2.2 + step * 0.3} cy={880}>
          <Bay boat={0} diver={0} noDiver pump={pump} box={0} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={505 + 14 * Math.sin(t * 90)} fy={1500} s={2 - 0.8 * p} cy={880}>
        <Bay boat={0} diver={0} noDiver pump={pump} box={p} dusk={p} night={p} t={t} />
      </Shot>
    );
  } else if (t < cut.stern) {
    // ночной проход: камни с пеной по обе стороны, под килем вода
    shot = (
      <Shot fx={560} fy={980} s={t < cut.foam ? z(cut.b2, cut.foam, 1.3, 1.5) : z(cut.foam, cut.stern, 1.6, 1.9)} cy={860}>
        <Deck clear={1} dawn={0} reef="ahead" reefShow={1} reefNear={t < cut.foam ? 0.4 : 0.9} t={t} />
      </Shot>
    );
  } else if (t < cut.day) {
    // за кормой фонарь — в его свете название на борту
    shot = (
      <Shot fx={540} fy={1000} s={z(cut.stern, cut.day, 1.2, 1.6)} cy={860}>
        <Stern boat={z(cut.stern, cut.day, 0.2, 0.6)} lamp={ramp(t, cut.stern + 0.3, cut.stern + 0.6)} t={t} />
      </Shot>
    );
  } else if (t < cut.ways) {
    shot = (
      <Shot fx={560} fy={980} s={z(cut.day, cut.ways, 1.2, 1.35)} cy={860}>
        <Deck clear={1} dawn={1} barrels={2} t={t} />
      </Shot>
    );
  } else if (t < cut.price) {
    shot = (
      <Shot fx={540} fy={960} s={z(cut.ways, cut.price, 1, 1.08)} cy={900}>
        <CoastChart left={ramp(t, cut.ways + 0.3, cut.far)} right={ramp(t, cut.far, cut.far + 1.4)} />
      </Shot>
    );
  } else if (t < cut.toLight) {
    shot = (
      <Shot fx={300} fy={800} s={z(cut.price, cut.toLight, 1.6, 1.85)} cy={820}>
        <CoastChart left={1} right={1} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={860} fy={500} s={z(cut.toLight, cut.cards, 1.6, 1.85)} cy={760}>
        <CoastChart left={1} right={1} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.morning ? ['ДЕНЬ 5/7', '23:50', 'ВОДА 3 ДН.'] : t < cut.b2 ? ['ДЕНЬ 6/7', '06:10', 'ВОДА 3 ДН.'] : t < cut.day ? ['ДЕНЬ 6/7', '01:30', 'ВОДА 3 ДН.'] : ['ДЕНЬ 6/7', '07:10', 'ВОДА 2 ДН.'];
  const hudOn = t < cut.end || t >= cut.b2 ? 1 - cardsIn : 0;

  return (
    <AbsoluteFill style={{ background: INK.paper }}>
      <AbsoluteFill style={{ filter: grey ? 'grayscale(1) contrast(1.1)' : undefined }}>{shot}</AbsoluteFill>
      {/* ночь в бухте: кадр притушен */}
      <AbsoluteFill style={{ background: DARK, opacity: t >= cut.lightOut && t < cut.morning ? 0.5 * ramp(t, cut.lightOut, cut.lightOut + 0.6) : 0 }} />
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
          <div style={{ fontFamily: fonts.ui, fontWeight: 700, fontSize: 40, color: INK.paper, opacity: 0.85 * ramp(t, cut.end + 0.3, cut.end + 0.6), marginTop: 10 }}>вариант ② — неверный</div>
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
            <div style={{ position: 'absolute', left: 232, top: -1180, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.8)' }}>
              <CoastChart left={1} right={0} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -848, top: -743, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.8)' }}>
              <CoastChart left={0} right={1} p="c2" />
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
      {inBad && <Branch text={`ВАРИАНТ ${PREV.b}`} color={INK.yellow} mine={CHOSEN === 'b'} show={ramp(t, cut.b1, cut.b1 + 0.25)} />}
      {inGood && <Branch text={`ВАРИАНТ ${PREV.a}`} color={INK.orange} mine={CHOSEN === 'a'} show={ramp(t, cut.b2, cut.b2 + 0.25)} />}

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{}} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/sea.wav`} volume={0.35} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.4} />
          <Sfx at={cut.b2} until={cut.day} src={`${SFX}/wind.wav`} volume={0.14} fadeIn={0.3} fadeOut={0.4} duck={speech} duckTo={0.5} />
          {/* неверная ветка: фонарь гаснет, вёсла в темноте, пустая палуба, «КОНЕЦ» */}
          <Sfx at={cut.lightOut} src={`${SFX}/hit.wav`} volume={0.45} />
          <Sfx at={cut.oars} until={cut.morning} src={`${SFX}/crunch.wav`} volume={0.25} fadeIn={0.4} />
          <Sfx at={cut.oars} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.5} fadeIn={0.8} duck={speech} duckTo={0.7} />
          <Sfx at={cut.noBox} src={`${SFX}/hit.wav`} volume={0.85} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: проход, фонарь за кормой, развилка */}
          <Sfx at={cut.b2} until={cut.stern} src={`${SFX}/heart.wav`} loop volume={0.45} fadeIn={0.6} duck={speech} duckTo={0.6} />
          <Sfx at={cut.below} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.stern + 0.3} src={`${SFX}/hit.wav`} volume={0.85} />
          <Sfx at={cut.price} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.4} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
