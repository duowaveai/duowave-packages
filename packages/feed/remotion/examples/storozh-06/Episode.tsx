// Пример серии «Режиссёра» — серия storozh-06 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, Feet, Shed, Yard } from '@feed/sets/storozh';

// «Сторож», серия 6. Обе ветки развилки серии 5, неверная — первой (зритель выбрал её):
//   крючок → ВАРИАНТ 1 «назваться»: вопрос задал не пилот, «КОНЕЦ» → «Перемотаем» → ВАРИАНТ 2 «идти молча»:
//   спасатель светит фонарём — и тени нет у самого героя. Раскрытие сериала; развилка моральная.
// Новый мир — взгляд под ноги (parts.tsx); остальное — двор и сарай из серии 3.

export const meta: EpisodeMeta = {
  id: 'storozh-06',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '03': 0.5, '05': 0.6, '06': 1.7, '07': 0.9, '09': 0.5, '10': 0.7, '11': 1.1, '12': 0.9, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'a' as 'a' | 'b';
const PREV = { a: '① НАЗВАТЬСЯ', b: '② ИДТИ МОЛЧА' };
const CHOICE = {
  q: 'ЛЕТИШЬ?',
  a: { n: '①', title: 'ЛЕТЕТЬ', price: 'увезёшь это к людям' },
  b: { n: '②', title: 'ОСТАТЬСЯ', price: 'вертолёт заберёт его — настоящего' },
};

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={C.stone} ink={C.cream} {...p} />;

/** Плашка ветки под строкой состояния: какой вариант сейчас идёт и чей это выбор. */
const Branch: React.FC<{ text: string; color: string; mine: boolean; show: number }> = ({ text, color, mine, show }) => (
  <div style={{ position: 'absolute', left: 60, top: 318, display: 'flex', gap: 14, alignItems: 'center', opacity: show, transform: `translateX(${(1 - show) * -30}px)`, fontFamily: fonts.display, fontWeight: 900, fontSize: 38, letterSpacing: '0.04em' }}>
    <span style={{ padding: '8px 16px', background: color, color: '#0b0a0d' }}>{text}</span>
    {/* «ТВОЙ ВЫБОР» рисует плеер поверх ролика, не серия */}
  </div>
);

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: C.stone }} />;
  const c = cues(tl);
  const w = (id: string, re: RegExp, fallback: number) => c.find(id, re)?.start ?? fallback;
  const ask = w('01', /^Назваться/, c.e('01') - 2.4);
  const second = w('03', /^Второй/, c.s('03') + 1.6);
  const base = w('04', /^«База»/, c.s('04') + 2);
  const heFirst = w('07', /^Он$/, c.s('07') + 2);
  const onYou = w('08', /^Потом/, c.e('08') - 1);
  const stay = w('12', /^Останешься/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, echo: second - 0.1, crew: c.s('04') - 0.15, base: base - 0.1, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, he: heFirst - 0.1, lamp: c.s('08') - 0.15, you: onYou - 0.1, said: c.s('09') - 0.15,
    down: c.s('10') - 0.15, none: c.s('11') - 0.5, fly: c.s('12') - 0.15, stay: stay - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dial = 0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3);
  const yard = { there: 1, dx: 330, wave: true, heli: 1, t };

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: двор, вертолёт и тот, кто машет у сарая
    shot = (
      <Shot fx={620} fy={800} s={1 + 0.5 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.15)} cy={820}>
        <Yard {...yard} />
      </Shot>
    );
  } else if (t < cut.echo) {
    shot = (
      <Shot fx={560} fy={400} s={z(cut.b1, cut.echo, 2, 2.4)} cy={760}>
        <Yard {...yard} />
      </Shot>
    );
  } else if (t < cut.crew) {
    // второй раз — от сарая: он опускает руку и смотрит сюда
    shot = (
      <Shot fx={860} fy={980} s={z(cut.echo, cut.crew, 2, 2.5)} cy={800}>
        <Yard {...yard} wave={false} eyes={ramp(t, cut.echo + 0.5, cut.echo + 0.9)} />
      </Shot>
    );
  } else if (t < cut.base) {
    shot = (
      <Shot fx={540} fy={1250} s={z(cut.crew, cut.base, 2, 2.3)} cy={800}>
        <Yard {...yard} wave={false} eyes={1} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // «База» говорил только он: вторая рация в сарае
    shot = (
      <Shot fx={860} fy={1040} s={z(cut.base, cut.montage, 2.4, 2.9)} cy={880}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 16, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={850} fy={990 - step * 24} s={2 + step * 0.42} cy={840}>
          <Yard {...yard} wave={false} eyes={1} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: '#050406' }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={850 - 260 * p + 14 * Math.sin(t * 90)} fy={900} s={2.8 - 1.4 * p} cy={820}>
        <Yard {...yard} wave={false} eyes={1} />
      </Shot>
    );
  } else if (t < cut.he) {
    // идёшь к вертолёту: камера поднимается от снега к прожектору
    shot = (
      <Shot fx={z(cut.b2, cut.he, 420, 560)} fy={z(cut.b2, cut.he, 1400, 760)} s={1.6} cy={820}>
        <Yard {...yard} />
      </Shot>
    );
  } else if (t < cut.lamp) {
    shot = (
      <Shot fx={860} fy={980} s={z(cut.he, cut.lamp, 1.9, 2.3)} cy={800}>
        <Yard {...yard} />
      </Shot>
    );
  } else if (t < cut.you) {
    // спасатель с фонарём: сначала на него
    shot = (
      <Shot fx={z(cut.lamp, cut.you, 560, 700)} fy={1190} s={z(cut.lamp, cut.you, 2.6, 3)} cy={800}>
        <Yard {...yard} wave={false} />
      </Shot>
    );
  } else if (t < cut.down) {
    // потом на тебя: фонарь в лицо
    shot = (
      <Shot fx={548} fy={1180} s={z(cut.you, cut.down, 3.4, 4.2)} cy={800}>
        <Yard {...yard} wave={false} />
      </Shot>
    );
  } else if (t < cut.fly) {
    // под ноги; на «тени нет у тебя» — наезд на пустой снег под ботинками
    shot = (
      <Shot fx={540} fy={t < cut.none ? z(cut.down, cut.none, 700, 1100) : z(cut.none, cut.fly, 1100, 1500)} s={t < cut.none ? 1 : z(cut.none, cut.none + 0.5, 1, 1.5)} cy={900}>
        <Feet light={ramp(t, cut.down + 0.3, cut.down + 1)} />
      </Shot>
    );
  } else if (t < cut.stay) {
    shot = (
      <Shot fx={560} fy={400} s={z(cut.fly, cut.stay, 2, 2.4)} cy={760}>
        <Yard {...yard} wave={false} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={860} fy={1000} s={z(cut.stay, cut.cards, 1.9, 2.4)} cy={800}>
        <Yard {...yard} wave={false} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blink = Math.floor(t * 2) % 2 === 0;
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const flash = t >= cut.montage && t < cut.end ? 0.35 * Math.max(0, 1 - ((t - cut.montage) % 0.42) / 0.2) : 0;
  const hud = ['НОЧЬ 1/7', '06:14', 'ДРОВА 60 %'];
  const hudOn = t < cut.end || t >= cut.b2 ? 1 - cardsIn : 0;

  return (
    <AbsoluteFill style={{ background: C.stone }}>
      <AbsoluteFill style={{ filter: grey ? 'grayscale(1) contrast(1.1)' : undefined }}>{shot}</AbsoluteFill>
      <AbsoluteFill style={{ background: '#ff1f2e', opacity: flash, mixBlendMode: 'screen' }} />
      <Film grain={0.05} />

      {/* повтор развилки прошлой серии — на вопросе крючка */}
      {t >= ask - 0.1 && t < cut.b1 && (
        <div style={{ position: 'absolute', left: 60, top: 1010, width: 870, display: 'flex', flexDirection: 'column', gap: 14, opacity: ramp(t, ask - 0.1, ask + 0.2), fontFamily: fonts.display, fontWeight: 900, fontSize: 54, letterSpacing: '0.03em' }}>
          <span style={{ padding: '14px 22px', background: 'rgba(8,7,10,.82)', border: `6px solid ${C.amber}`, color: C.cream }}>{PREV.a}</span>
          <span style={{ padding: '14px 22px', background: 'rgba(8,7,10,.82)', border: `6px solid ${C.cobalt}`, color: C.cream }}>{PREV.b}</span>
        </div>
      )}

      {/* «КОНЕЦ» плохой ветки и перемотка */}
      {t >= cut.end && t < cut.rewind && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 150 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 150, letterSpacing: '0.08em', color: '#ff3d4f', opacity: ramp(t, cut.end, cut.end + 0.15) }}>КОНЕЦ</div>
          <div style={{ fontFamily: fonts.ui, fontWeight: 700, fontSize: 40, color: C.cream, opacity: 0.85 * ramp(t, cut.end + 0.3, cut.end + 0.6), marginTop: 10 }}>вариант ① — неверный</div>
        </AbsoluteFill>
      )}
      {t >= cut.rewind && t < cut.b2 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 150 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 200, color: C.cream, opacity: Math.floor(t * 8) % 2 ? 1 : 0.55 }}>◀◀</div>
        </AbsoluteFill>
      )}

      {t >= cut.cards && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: 'rgba(8,7,10,.86)', opacity: cardsIn }} />
          <Card top={250} color={C.amber} item={CHOICE.a} show={cardsIn}>
            <div style={{ position: 'absolute', left: -560, top: -420, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.9)' }}>
              <Yard there={0} heli={1} t={t} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.cobalt} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -560, top: -1010, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.5)' }}>
              <Yard there={1} dx={330} heli={1} t={t} p="c2" />
            </div>
          </Card>
          <div style={{ position: 'absolute', left: 40, top: 780, width: 1000, height: 100, display: 'flex', alignItems: 'center', paddingLeft: 34, opacity: cardsIn, fontFamily: fonts.display, fontWeight: 900, fontSize: 62, letterSpacing: '0.04em', color: C.cream }}>
            {CHOICE.q}
          </div>
          <div style={{ position: 'absolute', left: 40, top: 872, width: 1000 * left, height: 8, background: '#ff3d4f' }} />
        </AbsoluteFill>
      )}

      <div style={{ position: 'absolute', left: 60, top: 244, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 18px', background: 'rgba(8,7,10,.62)', fontFamily: fonts.display, fontWeight: 800, fontSize: 36, letterSpacing: '0.05em', color: C.cream, opacity: hudOn }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: '#ff3d4f', opacity: blink ? 1 : 0.25 }} />
        <span>{hud[0]}</span>
        <span style={{ opacity: 0.8 }}>· {hud[1]}</span>
        <span style={{ color: C.amber }}>· {hud[2]}</span>
      </div>
      {inBad && <Branch text={`ВАРИАНТ ${PREV.a}`} color={C.amber} mine={CHOSEN === 'a'} show={ramp(t, cut.b1, cut.b1 + 0.25)} />}
      {inGood && <Branch text={`ВАРИАНТ ${PREV.b}`} color={C.cobalt} mine={CHOSEN === 'b'} show={ramp(t, cut.b2, cut.b2 + 0.25)} />}

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '02': C.cream, '04': C.cream, '05': '#ff5a66', '09': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          {/* гул винтов и ветер под всей серией, кроме «КОНЕЦ» */}
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.5} fadeIn={0.3} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.5} fadeIn={0.3} fadeOut={0.4} />
          <Sfx at={0} until={cut.end} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.5} />
          <Sfx at={cut.b2} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.2} fadeOut={0.4} duck={speech} duckTo={0.5} />
          <Sfx at={c.s('09') - 0.2} until={c.e('09') + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          {/* неверная ветка: эхо от сарая, рация, рывки, «КОНЕЦ» */}
          <Sfx at={cut.echo + 0.5} src={`${SFX}/hit.wav`} volume={0.75} />
          <Sfx at={cut.base} src={`${SFX}/radio_on.wav`} volume={0.32} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.echo} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.6} fadeIn={0.8} duck={speech} duckTo={0.7} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: шаги к вертолёту, фонарь, тишина перед раскрытием и главный удар */}
          <Sfx at={cut.b2 + 0.2} src={`${SFX}/crunch.wav`} volume={0.32} />
          <Sfx at={cut.you} src={`${SFX}/hit.wav`} volume={0.55} />
          <Sfx at={c.s('11') - 0.05} src={`${SFX}/hit.wav`} volume={1} />
          <Sfx at={cut.fly} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.5} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
