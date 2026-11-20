// Пример серии «Режиссёра» — серия storozh-04 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, DoorRoom, GlassRoom, Porch, Shed, ShedDoor, StoveRoom, Yard } from '@feed/sets/storozh';

// «Сторож», серия 4. Показывает обе ветки развилки серии 3:
//   крючок и повтор развилки → ВАРИАНТ 1 (неверный) до плохого конца и «КОНЕЦ» → «Перемотаем» → ВАРИАНТ 2 (верный),
//   раскрытие, новая угроза и новая развилка.
// Метку «ТВОЙ ВЫБОР» рисует плеер «Ленты» поверх ролика (meta.branches говорит ему, где какая ветка).

export const meta: EpisodeMeta = {
  id: 'storozh-04',
  lang: 'ru',
  // пауза перед «Перемотаем» держит «КОНЕЦ»; перед рассветом — короткая тишина
  pacing: { pre: { '01': 0.35, '04': 0.5, '05': 0.7, '06': 1.7, '07': 0.9, '10': 0.8, '13': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '13',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '12'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'b' as 'a' | 'b';
const PREV = { a: '① ОТВЕТИТЬ', b: '② БЕЖАТЬ К ДОМУ' };
const CHOICE = {
  q: 'ВЫХОДИШЬ?',
  a: { n: '①', title: 'ВЫЙТИ', price: 'если это снова он — ты вышел к нему сам' },
  b: { n: '②', title: 'ОСТАТЬСЯ', price: 'если это люди — улетят без тебя' },
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
  const ask = w('01', /^Ответить/, c.e('01') - 2.2);
  const law = w('09', /^Ему/, c.s('09') + 1.4);
  const heliAt = w('10', /^Вертол/, c.s('10') + 2.6);
  const stayAt = w('12', /^Останешься/, (c.s('12') + c.e('12')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, door: c.s('04') - 0.15, montage: c.s('05') - 0.1, end, rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3,
    yard: c.s('07') + 1.1, porch: c.s('08') - 0.15, inside: c.s('09') - 0.15, stove: law - 0.1, dawn: c.s('10') - 0.3, heli: heliAt - 0.15,
    call: c.s('11') - 0.15, out: c.s('12') - 0.15, stay: stayAt - 0.1, cards: c.s('13') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dial = 0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3);

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: рация в сарае, быстрый наезд
    shot = (
      <Shot fx={860} fy={1040} s={1.5 + 0.9 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.2)} cy={880}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.door) {
    shot = (
      <Shot fx={880} fy={1080} s={z(cut.b1, cut.door, 2.9, 3.4)} cy={860}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // в дверях — второй сторож; глаза загораются на слове «Второй»
    shot = (
      <Shot fx={540} fy={980} s={z(cut.door, cut.montage, 1, 1.18)} cy={900}>
        <ShedDoor near={z(cut.door, cut.montage, 0, 0.12)} eyes={ramp(t, w('04', /^Второй/, cut.montage - 0.6), cut.montage)} />
      </Shot>
    );
  } else if (t < cut.end) {
    // плохой конец: он подходит рывками, кадр трясёт
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 16, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={540} fy={900 - step * 28} s={1.3 + step * 0.34} cy={860}>
          <ShedDoor near={0.2 + step * 0.22} eyes={1} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: '#050406' }} />;
  } else if (t < cut.b2) {
    // перемотка: кадр без цвета едет назад
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={860 - 300 * p + 14 * Math.sin(t * 90)} fy={1040} s={2.9 - 1.2 * p} cy={880}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.yard) {
    // хватаешь поленья
    shot = (
      <Shot fx={z(cut.b2, cut.yard, 420, 250)} fy={1200} s={z(cut.b2, cut.yard, 1.5, 1.9)} cy={860}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.porch) {
    // бег через двор к дому
    const j = shake(t, Array.from({ length: 10 }, (_, i) => cut.yard + i * 0.3), 9, 0.28);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={z(cut.yard, cut.porch, 520, 210)} fy={900} s={z(cut.yard, cut.porch, 1.5, 2.3)} cy={820}>
          <Yard there={0} steps={1} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.inside) {
    shot = (
      <Shot fx={540} fy={z(cut.porch, cut.inside, 1560, 1400)} s={z(cut.porch, cut.inside, 1.25, 1.6)} cy={860}>
        <Porch steps={ramp(t, cut.porch + 0.2, cut.porch + 1)} />
      </Shot>
    );
  } else if (t < cut.stove) {
    shot = (
      <Shot fx={540} fy={1000} s={z(cut.inside, cut.stove, 1.25, 1.4)} cy={860}>
        <DoorRoom lamp={1} rule4="На свой голос не отвечать." rule4Show={1} />
      </Shot>
    );
  } else if (t < cut.dawn) {
    shot = (
      <Shot fx={540} fy={1090} s={z(cut.stove, cut.dawn, 1.25, 1.45)} cy={820}>
        <StoveRoom fire={1} t={t} />
      </Shot>
    );
  } else if (t < cut.heli) {
    // рассвет: окно разгорается, за ним никого
    shot = (
      <Shot fx={560} fy={640} s={z(cut.dawn, cut.heli, 1.25, 1.5)} cy={780}>
        <GlassRoom lit={z(cut.dawn, cut.dawn + 1.2, 0.25, 1)} there={0} eyes={0} dial={0} />
      </Shot>
    );
  } else if (t < cut.call) {
    shot = (
      <Shot fx={560} fy={560} s={z(cut.heli, cut.call, 1.15, 1.4)} cy={760}>
        <Yard there={0} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.out) {
    shot = (
      <Shot fx={540} fy={1180} s={z(cut.call, cut.out, 2, 2.4)} cy={820}>
        <Yard there={0} heli={1} t={t} />
      </Shot>
    );
  } else if (t < cut.stay) {
    shot = (
      <Shot fx={540} fy={980} s={z(cut.out, cut.stay, 1.2, 1.4)} cy={860}>
        <DoorRoom lamp={1} rule4="На свой голос не отвечать." rule4Show={1} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={560} fy={480} s={z(cut.stay, cut.cards, 1.6, 1.9)} cy={760}>
        <Yard there={0} heli={1} t={t} />
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
  const hud = t < cut.inside ? ['НОЧЬ 1/7', '02:41', 'ДРОВА 20 %'] : t < cut.dawn ? ['НОЧЬ 1/7', '02:55', 'ДРОВА 80 %'] : ['НОЧЬ 1/7', '06:10', 'ДРОВА 60 %'];
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
            <div style={{ position: 'absolute', left: 180, top: -330, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(0.86)' }}>
              <Yard there={0} heli={1} t={t} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.cobalt} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: 340, top: -330, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(0.72)' }}>
              <DoorRoom lamp={1} rule4="На свой голос не отвечать." rule4Show={1} p="c2" />
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
        <span style={{ color: hud[2] === 'ДРОВА 20 %' ? '#ff6b5e' : C.amber }}>· {hud[2]}</span>
      </div>
      {inBad && <Branch text={`ВАРИАНТ ${PREV.a}`} color={C.amber} mine={CHOSEN === 'a'} show={ramp(t, cut.b1, cut.b1 + 0.25)} />}
      {inGood && <Branch text={`ВАРИАНТ ${PREV.b}`} color={C.cobalt} mine={CHOSEN === 'b'} show={ramp(t, cut.b2, cut.b2 + 0.25)} />}

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '02': C.cream, '03': C.amber, '05': '#ff5a66', '11': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.3} fadeOut={0.4} />
          <Sfx at={0} until={cut.end} src={`${SFX}/wind.wav`} volume={0.1} fadeIn={0.3} fadeOut={0.1} duck={speech} duckTo={0.5} />
          <Sfx at={cut.b2} until={cut.inside} src={`${SFX}/wind.wav`} volume={0.24} fadeIn={0.2} fadeOut={0.3} duck={speech} duckTo={0.5} />
          <Sfx at={cut.dawn} src={`${SFX}/wind.wav`} volume={0.14} fadeIn={0.5} fadeOut={0.4} duck={speech} duckTo={0.5} />
          <Sfx at={0.1} src={`${SFX}/crunch.wav`} volume={0.22} />
          {(['03', '11'] as const).map((id) => (
            <Sfx key={id} at={c.s(id) - 0.2} until={c.e(id) + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          ))}
          {/* плохая ветка: шаг на каждый рывок, сердце, удар в «КОНЕЦ» */}
          <Sfx at={cut.door} src={`${SFX}/hit.wav`} volume={0.6} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.door} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.6} fadeIn={0.6} />
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка */}
          <Sfx at={cut.yard} src={`${SFX}/crunch.wav`} volume={0.34} />
          <Sfx at={cut.porch + 0.2} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.heli} src={`${SFX}/hit.wav`} volume={0.8} />
          <Sfx at={cut.out} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.5} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
