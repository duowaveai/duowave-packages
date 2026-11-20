// Пример серии «Режиссёра» — серия kompas-05 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { Bay, BayChart, INK } from '@feed/sets/kompas';

// «Компас», серия 5. Обе ветки развилки серии 4, неверная — первой (зритель выбрал её):
//   крючок и повтор развилки → ВАРИАНТ ① «пустить сейчас» (неверный, твой выбор): капитану плохо под водой,
//   «КОНЕЦ» → «Перемотаем» → ВАРИАНТ ② «ждать шесть часов»: вечером ящик «Северянина» поднят, у мыса фонарь лодки.
// Улика развилки — ночная строка в таблице приливов: «ПРИЛИВ · 01:30»; ночью проход глубокий.

export const meta: EpisodeMeta = {
  id: 'kompas-05',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.5, '04': 0.4, '05': 0.6, '06': 1.7, '07': 0.9, '08': 0.6, '10': 0.6, '11': 0.5, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'a' as 'a' | 'b';
const PREV = { a: '① ПУСТИТЬ СЕЙЧАС', b: '② ЖДАТЬ ШЕСТЬ ЧАСОВ' };
const CHOICE = {
  q: 'УХОДИШЬ ПРОХОДОМ?',
  a: { n: '①', title: 'УЙТИ ПРОХОДОМ', price: 'ночью, между камнями' },
  b: { n: '②', title: 'ЖДАТЬ РАССВЕТА', price: 'лодка подойдёт в темноте первой' },
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
  const ask = w('01', /^Пустить/, c.e('01') - 2.2);
  const box = w('09', /^На$/, c.e('09') - 1.4);
  const stay = w('12', /^Останешься/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, tugs: c.s('03') - 0.15, up: c.s('04') - 0.15, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, dusk: c.s('08') - 0.15, box: c.s('09') - 0.15, label: box - 0.1,
    lantern: c.s('10') - 0.15, water: c.s('11') - 0.15, price: c.s('12') - 0.15, stay: stay - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pump = t * 140;
  const dusk = t >= cut.b2 ? ramp(t, cut.dusk - 0.4, cut.dusk + 0.8) : 0;

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: капитан с табличкой, правила у насоса
    shot = (
      <Shot fx={700} fy={1250} s={1.15 + 0.35 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.1)} cy={880}>
        <Bay boat={0} diver={0.25} plate={1} pump={pump} rules={1} t={t} />
      </Shot>
    );
  } else if (t < cut.tugs) {
    shot = (
      <Shot fx={470} fy={1200} s={z(cut.b1, cut.tugs, 1.8, 2.1)} cy={860}>
        <Bay boat={0} diver={ramp(t, cut.b1, cut.b1 + 1.4)} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.up) {
    // частые рывки: кадр дёргается вместе с верёвкой
    const j = shake(t, Array.from({ length: 10 }, (_, i) => cut.tugs + 0.3 + i * 0.28), 12, 0.2);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={420} fy={1350} s={z(cut.tugs, cut.up, 2.2, 2.5)} cy={880}>
          <Bay boat={0} diver={1} pump={pump} air={0.4} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.montage) {
    // капитан на палубе не может поднять руку
    shot = (
      <Shot fx={870} fy={1600} s={z(cut.up, cut.montage, 1.8, 2.2)} cy={880}>
        <Bay boat={0} diver={0} pump={pump} sitting={1} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 14, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={940} fy={760 + step * 20} s={1.6 + step * 0.3} cy={820}>
          <Bay boat={0} diver={0} pump={pump} sitting={1} dusk={Math.min(1, step * 0.25)} lantern={1} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={870 + 14 * Math.sin(t * 90)} fy={1500} s={2.2 - 1 * p} cy={880}>
        <Bay boat={0} diver={0.25} pump={-t * 300} sitting={1 - p} plate={p} t={t} />
      </Shot>
    );
  } else if (t < cut.dusk) {
    // ждёшь шесть часов: солнце уходит вниз
    shot = (
      <Shot fx={880} fy={z(cut.b2, cut.dusk, 400, 640)} s={1.5} cy={760}>
        <Bay boat={0} diver={0.25} pump={pump} rules={1} dusk={dusk} t={t} />
      </Shot>
    );
  } else if (t < cut.box) {
    shot = (
      <Shot fx={470} fy={1200} s={z(cut.dusk, cut.box, 1.8, 2.1)} cy={860}>
        <Bay boat={0} diver={ramp(t, cut.dusk, cut.dusk + 1.2)} pump={pump} dusk={dusk} t={t} />
      </Shot>
    );
  } else if (t < cut.lantern) {
    // ящик на палубе, наклейка «Северянин»
    shot = (
      <Shot fx={505} fy={1715} s={t < cut.label ? z(cut.box, cut.label, 1.7, 1.9) : z(cut.label, cut.lantern, 2.1, 2.3)} cy={880}>
        <Bay boat={0} diver={0.25} pump={pump} dusk={dusk} box={ramp(t, cut.box + 0.2, cut.box + 0.7)} t={t} />
      </Shot>
    );
  } else if (t < cut.water) {
    // у мыса загорается фонарь
    shot = (
      <Shot fx={900} fy={660} s={z(cut.lantern, cut.water, 1.8, 2.3)} cy={780}>
        <Bay boat={0} diver={0.25} pump={pump} dusk={1} box={1} lantern={ramp(t, cut.lantern + 0.6, cut.lantern + 0.9)} t={t} />
      </Shot>
    );
  } else if (t < cut.stay) {
    // карта: таблица приливов с ночной строкой — в кадре, без слов
    shot = (
      <Shot fx={t < cut.price ? 540 : 240} fy={t < cut.price ? 960 : 1130} s={t < cut.price ? z(cut.water, cut.price, 1, 1.08) : z(cut.price, cut.stay, 2.1, 2.3)} cy={t < cut.price ? 900 : 820}>
        <BayChart pass={ramp(t, cut.price, cut.price + 0.8)} around={1} table={0} night={1} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={900} fy={680} s={z(cut.stay, cut.cards, 1.6, 1.9)} cy={780}>
        <Bay boat={0} diver={0.25} pump={pump} dusk={1} box={1} lantern={1} t={t} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.b2 ? ['ДЕНЬ 5/7', '11:10', 'ВОДА 3 ДН.'] : t < cut.lantern ? ['ДЕНЬ 5/7', '17:20', 'ВОДА 3 ДН.'] : ['ДЕНЬ 5/7', '21:40', 'ВОДА 3 ДН.'];
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
              <BayChart pass={1} around={0} table={0} night={1} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -512, top: -631, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.4)' }}>
              <Bay boat={0} diver={0.25} pump={t * 140} dusk={1} box={1} lantern={1} t={t} p="c2" />
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

      <Subtitles tl={tl} y={t >= cut.box && t < cut.lantern ? 760 : 1300} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{}} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/sea.wav`} volume={0.35} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.18} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.4} />
          <Sfx at={0} until={cut.up} src={`${SFX}/heart.wav`} loop volume={0.3} fadeIn={0.4} fadeOut={0.2} duck={speech} duckTo={0.6} />
          {/* неверная ветка: частые рывки, капитан на палубе, «КОНЕЦ» */}
          {Array.from({ length: 8 }, (_, i) => (
            <Sfx key={`t${i}`} at={cut.tugs + 0.3 + i * 0.28} src={`${SFX}/hit.wav`} volume={0.3} />
          ))}
          <Sfx at={cut.up + 0.3} src={`${SFX}/hit.wav`} volume={0.8} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: насос, ящик, фонарь */}
          <Sfx at={cut.dusk} until={cut.box} src={`${SFX}/heart.wav`} loop volume={0.3} fadeIn={0.3} duck={speech} duckTo={0.6} />
          <Sfx at={cut.box + 0.3} src={`${SFX}/hit.wav`} volume={0.75} />
          <Sfx at={cut.lantern + 0.6} src={`${SFX}/hit.wav`} volume={0.85} />
          <Sfx at={cut.water} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.45} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
