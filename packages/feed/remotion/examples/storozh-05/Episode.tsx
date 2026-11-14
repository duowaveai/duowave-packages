// Пример серии «Режиссёра» — серия storozh-05 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, DoorRoom, GlassRoom, StoveRoom, Yard } from '@feed/sets/storozh';

// «Сторож», серия 5. Обе ветки развилки серии 4, неверная — первой (зритель выбрал её):
//   крючок → ВАРИАНТ 2 «остаться»: вертолёт уходит, ночью сбывается запись из журнала, «КОНЕЦ» → «Перемотаем» →
//   ВАРИАНТ 1 «выйти»: спасатели настоящие, но у сарая — второй сторож; пилот спрашивает, кто из двоих настоящий.
// Декорации — из серий 1–3; нового мира нет, новое — состояния двора (двое, глаза, взмах руки).

export const meta: EpisodeMeta = {
  id: 'storozh-05',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '04': 0.6, '05': 0.6, '06': 1.7, '07': 0.9, '10': 0.6, '11': 0.5, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'b', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'b' as 'a' | 'b';
const PREV = { a: '① ВЫЙТИ', b: '② ОСТАТЬСЯ' };
const CHOICE = {
  q: 'НАЗЫВАЕШЬСЯ?',
  a: { n: '①', title: 'НАЗВАТЬСЯ', price: 'если спросил не пилот — ты ему ответил' },
  b: { n: '②', title: 'МОЛЧА ИДТИ К ВЕРТОЛЁТУ', price: 'первым назовётся он' },
};
const RULE4 = 'На свой голос не отвечать.';

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
  const ask = w('01', /^Выйти/, c.e('01') - 2.4);
  const wood = w('03', /^А$/, c.s('03') + 2.2);
  const wait = w('04', /^Во$/, c.s('04') + 1.6);
  const waveAt = w('10', /^И$/, c.e('10') - 1.2);
  const silent = w('12', /^Промолчишь/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, gone: c.s('03') - 0.15, wood: wood - 0.1, night: c.s('04') - 0.2, wait: wait - 0.1, montage: c.s('05') - 0.1,
    end, rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, people: c.s('08') - 0.15, call: c.s('09') - 0.15, him: c.s('10') - 0.15,
    pilot: c.s('11') - 0.15, name: c.s('12') - 0.15, silent: silent - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const waving = t >= waveAt;

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: вертолёт над двором, быстрый наезд
    shot = (
      <Shot fx={560} fy={620} s={1 + 0.55 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.15)} cy={800}>
        <Yard there={0} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.gone) {
    shot = (
      <Shot fx={540} fy={980} s={z(cut.b1, cut.gone, 1.2, 1.35)} cy={860}>
        <DoorRoom lamp={0.8} rule4={RULE4} rule4Show={1} />
      </Shot>
    );
  } else if (t < cut.wood) {
    // вертолёта нет: пустой двор
    shot = (
      <Shot fx={560} fy={560} s={z(cut.gone, cut.wood, 1.3, 1.45)} cy={760}>
        <Yard there={0} heli={0} t={t} />
      </Shot>
    );
  } else if (t < cut.night) {
    shot = (
      <Shot fx={540} fy={1090} s={z(cut.wood, cut.night, 1.3, 1.5)} cy={820}>
        <StoveRoom fire={z(cut.wood, cut.night, 0.5, 0.12)} t={t} />
      </Shot>
    );
  } else if (t < cut.wait) {
    shot = (
      <Shot fx={z(cut.night, cut.wait, 300, 520)} fy={1000} s={1.5} cy={820}>
        <Yard there={1} t={t} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // «встаёшь рядом»: в кадре появляется второй
    shot = (
      <Shot fx={640} fy={1020} s={z(cut.wait, cut.montage, 1.5, 1.8)} cy={820}>
        <Yard there={1} second={ramp(t, cut.wait + 0.9, cut.wait + 1.5)} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    // плохой конец: двое рывками ближе, у обоих загораются глаза
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 16, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={636} fy={1000 - step * 22} s={1.9 + step * 0.36} cy={840}>
          <Yard there={1} second={1} eyes={1} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: '#050406' }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={640 - 200 * p + 14 * Math.sin(t * 90)} fy={900} s={2.6 - 1.2 * p} cy={820}>
        <Yard there={1} second={1} eyes={1} t={t} />
      </Shot>
    );
  } else if (t < cut.people) {
    // дверь изнутри, свет рассвета; наезд на засов
    shot = (
      <Shot fx={540} fy={1240} s={z(cut.b2, cut.people, 1.3, 1.9)} cy={860}>
        <DoorRoom lamp={1} rule4={RULE4} rule4Show={1} />
      </Shot>
    );
  } else if (t < cut.call) {
    // трое с фонарями и следы за каждым
    shot = (
      <Shot fx={540} fy={1250} s={z(cut.people, cut.call, 2, 2.35)} cy={800}>
        <Yard there={0} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.him) {
    shot = (
      <Shot fx={560} fy={460} s={z(cut.call, cut.him, 1.7, 2)} cy={760}>
        <Yard there={0} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.pilot) {
    // у сарая — он, в твоей куртке; на «и машет» поднимает руку
    shot = (
      <Shot fx={860} fy={1010} s={z(cut.him, cut.pilot, 1.7, 2.3)} cy={800}>
        <Yard there={1} dx={330} wave={waving} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.name) {
    shot = (
      <Shot fx={560} fy={400} s={z(cut.pilot, cut.name, 2.2, 2.6)} cy={760}>
        <Yard there={1} dx={330} wave heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.silent) {
    shot = (
      <Shot fx={540} fy={1250} s={z(cut.name, cut.silent, 1.9, 2.1)} cy={800}>
        <Yard there={1} dx={330} wave heli={1} t={t} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={860} fy={1000} s={z(cut.silent, cut.cards, 2, 2.5)} cy={800}>
        <Yard there={1} dx={330} wave eyes={ramp(t, cut.silent + 0.6, cut.silent + 1)} heli={1} t={t} />
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
  const hud = t >= cut.night && t < cut.end ? ['НОЧЬ 2/7', '00:04', 'ДРОВА 0 %'] : t >= cut.wood && t < cut.night ? ['НОЧЬ 1/7', '19:40', 'ДРОВА 10 %'] : ['НОЧЬ 1/7', '06:12', 'ДРОВА 60 %'];
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
          <div style={{ fontFamily: fonts.ui, fontWeight: 700, fontSize: 40, color: C.cream, opacity: 0.85 * ramp(t, cut.end + 0.3, cut.end + 0.6), marginTop: 10 }}>вариант ② — неверный</div>
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
              <Yard there={1} dx={330} wave eyes={1} heli={1} t={t} p="c2" />
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
        <span style={{ color: hud[2] === 'ДРОВА 60 %' ? C.amber : '#ff6b5e' }}>· {hud[2]}</span>
      </div>
      {inBad && <Branch text={`ВАРИАНТ ${PREV.b}`} color={C.cobalt} mine={CHOSEN === 'b'} show={ramp(t, cut.b1, cut.b1 + 0.25)} />}
      {inGood && <Branch text={`ВАРИАНТ ${PREV.a}`} color={C.amber} mine={CHOSEN === 'a'} show={ramp(t, cut.b2, cut.b2 + 0.25)} />}

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '05': '#ff5a66', '09': C.amber, '11': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.3} fadeOut={0.4} />
          {/* гул винтов — тот же низ, громче, пока вертолёт над двором */}
          <Sfx at={0} until={cut.gone + 0.6} src={`${SFX}/low.wav`} volume={0.5} fadeIn={0.2} fadeOut={1.6} />
          <Sfx at={cut.people} src={`${SFX}/low.wav`} volume={0.45} fadeIn={0.6} fadeOut={0.4} />
          <Sfx at={0} until={cut.end} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.5} />
          <Sfx at={cut.b2} src={`${SFX}/wind.wav`} volume={0.18} fadeIn={0.2} fadeOut={0.4} duck={speech} duckTo={0.5} />
          {(['09', '11'] as const).map((id) => (
            <Sfx key={id} at={c.s(id) - 0.2} until={c.e(id) + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          ))}
          {/* неверная ветка: тишина после вертолёта, шаги к сараю, двое, рывки, «КОНЕЦ» */}
          <Sfx at={cut.gone} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.night} src={`${SFX}/crunch.wav`} volume={0.3} />
          <Sfx at={cut.wait + 0.9} src={`${SFX}/hit.wav`} volume={0.7} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.night} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.6} fadeIn={1.2} duck={speech} duckTo={0.7} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка */}
          <Sfx at={cut.people - 0.4} src={`${SFX}/crunch.wav`} volume={0.3} />
          <Sfx at={cut.him + 0.1} src={`${SFX}/hit.wav`} volume={0.85} />
          <Sfx at={cut.pilot} src={`${SFX}/radio_on.wav`} volume={0.3} />
          <Sfx at={cut.name} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.5} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
