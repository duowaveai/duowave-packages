// Пример серии «Режиссёра» — серия storozh-07 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, Cockpit, DoorRoom, Feet, GlassRoom, Porch, Yard, hand } from '@feed/sets/storozh';

// «Сторож», серия 7 — финал сезона. Обе ветки развилки серии 6, они же две концовки:
//   крючок → ВАРИАНТ 1 «лететь»: увёз это к людям, «КОНЕЦ» → «Перемотаем» → ВАРИАНТ 2 «остаться»: отпустил
//   настоящего сторожа. Дальше простыми словами — кто ты и от кого запирали дверь, крючок на второй сезон и развилка
//   «второй сезон / новая история». Новый мир — кабина вертолёта (parts.tsx).

export const meta: EpisodeMeta = {
  id: 'storozh-07',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '04': 0.5, '05': 0.6, '06': 1.7, '07': 0.9, '08': 0.5, '09': 0.8, '11': 0.5, '13': 0.8, '14': 0.6 }, defaultPre: 0.3, endHold: 3.8 },
  choiceLine: '14',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '13'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'b' as 'a' | 'b';
const PREV = { a: '① ЛЕТЕТЬ', b: '② ОСТАТЬСЯ' };
const CHOICE = {
  q: 'ЧТО ДАЛЬШЕ?',
  a: { n: '①', title: 'ВТОРОЙ СЕЗОН', price: 'на базу пришлют нового сторожа' },
  b: { n: '②', title: 'НОВАЯ ИСТОРИЯ', price: 'другой мир и другой облик' },
};
const OLD4 = 'На свой голос не отвечать.';
const NEW4 = 'Открой. Это я.';

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
  const ask = w('01', /^Лететь/, c.e('01') - 1.8);
  const boards = w('07', /^и$/, c.e('07') - 1.6);
  const first = w('08', /^Как/, c.e('08') - 1.2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, cockpit: c.s('03') - 0.15, below: c.s('04') - 0.15, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, gone: c.s('08') - 0.15, first: first - 0.1, you: c.s('09') - 0.2,
    door: c.s('10') - 0.15, flew: c.s('11') - 0.15, rule: c.s('12') - 0.15, next: c.s('13') - 0.15, cards: c.s('14') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: вертолёт и тот, кто стоит у сарая
    shot = (
      <Shot fx={620} fy={760} s={1 + 0.5 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.15)} cy={820}>
        <Yard there={1} dx={330} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.cockpit) {
    shot = (
      <Shot fx={560} fy={400} s={z(cut.b1, cut.cockpit, 2, 2.7)} cy={760}>
        <Yard there={1} dx={330} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.below) {
    // кабина: пилот оборачивается
    shot = (
      <Shot fx={700} fy={1000} s={z(cut.cockpit, cut.below, 1.3, 1.55)} cy={900}>
        <Cockpit city={0} turn={ramp(t, cut.cockpit + 0.2, cut.cockpit + 0.9)} t={t} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // внизу: настоящий сторож машет вслед, а вертолёт уходит — кадр отъезжает
    shot = (
      <Shot fx={860} fy={1000} s={z(cut.below, cut.montage, 2.2, 1.2)} cy={800}>
        <Yard there={1} dx={330} wave heli={0} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    // плохой конец: под нами огни города, кадр рывками ближе
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 14, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={540} fy={900 + step * 10} s={1.2 + step * 0.3} cy={860}>
          <Cockpit city={ramp(t, cut.montage, cut.montage + 0.6)} turn={1} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: '#050406' }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={540 + 14 * Math.sin(t * 90)} fy={900 + 200 * p} s={2 - 0.8 * p} cy={860}>
        <Cockpit city={1} turn={1} t={t} />
      </Shot>
    );
  } else if (t < cut.gone) {
    // остаёшься: тот, у сарая, идёт к вертолёту и пропадает в нём
    shot = (
      <Shot fx={z(cut.b2, cut.gone, 860, 600)} fy={900} s={1.6} cy={800}>
        <Yard there={1 - ramp(t, boards + 0.6, cut.gone)} dx={z(cut.b2, cut.gone, 330, 60)} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.first) {
    // гул стихает: вертолёт уходит
    shot = (
      <Shot fx={560} fy={460} s={z(cut.gone, cut.first, 1.6, 1.3)} cy={760}>
        <Yard there={0} heli={1 - ramp(t, cut.gone, cut.first)} t={t} />
      </Shot>
    );
  } else if (t < cut.you) {
    // как в первую ночь: тёмное окно, рация молчит
    shot = (
      <Shot fx={540} fy={900} s={z(cut.first, cut.you, 1, 1.08)} cy={900}>
        <GlassRoom lit={0.2} there={0} eyes={0} dial={0} />
      </Shot>
    );
  } else if (t < cut.door) {
    shot = (
      <Shot fx={540} fy={1300} s={z(cut.you, cut.door, 1, 1.4)} cy={900}>
        <Feet light={0.6} />
      </Shot>
    );
  } else if (t < cut.flew) {
    shot = (
      <Shot fx={540} fy={1000} s={z(cut.door, cut.flew, 1.2, 1.45)} cy={860}>
        <DoorRoom lamp={1} rule4={OLD4} rule4Show={1} />
      </Shot>
    );
  } else if (t < cut.rule) {
    shot = (
      <Shot fx={560} fy={560} s={z(cut.flew, cut.rule, 1.2, 1.35)} cy={760}>
        <Yard there={0} heli={0} t={t} />
      </Shot>
    );
  } else if (t < cut.next) {
    // новый пункт проступает почерком
    shot = (
      <Shot fx={540} fy={820} s={z(cut.rule, cut.next, 2.4, 2.75)} cy={760}>
        <DoorRoom lamp={1} rule4={NEW4} rule4Show={ramp(t, cut.rule + 1, cut.rule + 2)} rule4Font={hand} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={540} fy={1100} s={z(cut.next, cut.cards, 1.7, 1.2)} cy={880}>
        <Porch steps={0} />
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
  const hud = t < cut.you ? ['НОЧЬ 1/7', '06:16', 'ДРОВА 60 %'] : ['ФИНАЛ', 'УТРО', 'СЕЗОН 1'];
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
            <div style={{ position: 'absolute', left: 240, top: -500, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(0.8)' }}>
              <Porch steps={1} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.cobalt} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <Img src={staticFile(`${meta.id}/looks.jpg`)} style={{ position: 'absolute', left: 300, top: 0, height: 530 }} />
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

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '03': C.amber, '05': '#ff5a66' }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          {/* гул винтов — под крючком и плохой веткой; в верной стихает на «Гул стихает» */}
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.5} fadeIn={0.3} fadeOut={0.1} />
          <Sfx at={cut.b2} until={cut.first + 0.4} src={`${SFX}/low.wav`} volume={0.5} fadeIn={0.3} fadeOut={1.6} />
          <Sfx at={cut.first} src={`${SFX}/low.wav`} volume={0.22} fadeIn={1} fadeOut={0.6} />
          <Sfx at={0} until={cut.cockpit} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.3} fadeOut={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.b2} src={`${SFX}/wind.wav`} volume={0.14} fadeIn={0.4} fadeOut={0.6} duck={speech} duckTo={0.5} />
          <Sfx at={c.s('03') - 0.2} until={c.e('03') + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          {/* неверная ветка */}
          <Sfx at={cut.b1 + 0.9} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.cockpit + 0.5} src={`${SFX}/hit.wav`} volume={0.7} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.cockpit} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={0.8} duck={speech} duckTo={0.7} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка и ответ сезона: тихо, удары только на раскрытиях */}
          <Sfx at={cut.you + 0.2} src={`${SFX}/hit.wav`} volume={0.85} />
          <Sfx at={cut.door} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.rule + 1} src={`${SFX}/hit.wav`} volume={0.7} />
          <Sfx at={cut.next} src={`${SFX}/crunch.wav`} volume={0.25} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
