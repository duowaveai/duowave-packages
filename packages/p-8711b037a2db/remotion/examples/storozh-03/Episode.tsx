// Пример серии «Режиссёра» — серия storozh-03 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, Shed, Yard } from '@feed/sets/storozh';

// «Сторож», серия 3 — после выбора «идти за дровами». Новое место: двор и сарай, героя впервые видно снаружи дома.
// Уловка серии: рация зовёт голосом самого сторожа, а тот, кто стоял во дворе, пропадает со своего места.

export const meta: EpisodeMeta = {
  id: 'storozh-03',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '04': 0.45, '06': 0.5, '07': 0.6, '09': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '09',
};
const SFX = `${meta.id}/sfx`;
const HUD = ['НОЧЬ 1/7', '02:38', 'ДРОВА 20 %'];
const CHOICE = {
  q: 'ОТВЕЧАЕШЬ?',
  a: { n: '①', title: 'ОТВЕТИТЬ', price: 'нарушишь четвёртый пункт' },
  b: { n: '②', title: 'БЕЖАТЬ К ДОМУ', price: 'приведёшь того, кто идёт следом, к двери' },
};

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={C.stone} ink={C.cream} {...p} />;

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: C.stone }} />;
  const c = cues(tl);
  const radioWord = c.find('04', /^рация/i)?.start ?? c.s('04') + 2;
  const run = c.find('08', /^Побежишь/)?.start ?? (c.s('08') + c.e('08')) / 2;
  const cut = {
    pass: c.s('02') - 0.15, jacket: c.s('03') - 0.15, shed: c.s('04') - 0.15, radio: radioWord - 0.2, journal: c.s('05') - 0.15,
    call: c.s('06') - 0.15, gone: c.s('07') - 0.2, answer: c.s('08') - 0.15, run: run - 0.1, cards: c.s('09') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const dial = 0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3);
  const ink = ramp(t, cut.journal + 0.3, cut.journal + 1.3);
  const there = t < cut.gone ? 1 : 0;
  const steps = ramp(t, cut.gone + 0.3, cut.gone + 1.2);

  let shot: React.ReactNode;
  if (t < cut.pass) {
    // двор целиком, быстрый наезд на фигуру
    shot = (
      <Shot fx={520} fy={1000} s={1 + 0.5 * ramp(t, 0, 2.4) + z(2.4, cut.pass, 0, 0.12)} cy={820}>
        <Yard there={1} t={t} />
      </Shot>
    );
  } else if (t < cut.jacket) {
    // проход мимо: камера ведёт слева направо мимо фигуры
    shot = (
      <Shot fx={z(cut.pass, cut.jacket, 300, 640)} fy={1010} s={2} cy={800}>
        <Yard there={1} t={t} />
      </Shot>
    );
  } else if (t < cut.shed) {
    shot = (
      <Shot fx={548} fy={1010} s={z(cut.jacket, cut.shed, 3, 3.5)} cy={760}>
        <Yard there={1} t={t} />
      </Shot>
    );
  } else if (t < cut.radio) {
    shot = (
      <Shot fx={330} fy={1180} s={z(cut.shed, cut.radio, 1.15, 1.32)} cy={860}>
        <Shed dial={dial} ink={0} />
      </Shot>
    );
  } else if (t < cut.journal) {
    shot = (
      <Shot fx={810} fy={1060} s={z(cut.radio, cut.journal, 2, 2.25)} cy={800}>
        <Shed dial={dial} ink={0} />
      </Shot>
    );
  } else if (t < cut.call) {
    shot = (
      <Shot fx={800} fy={1420} s={z(cut.journal, cut.call, 2.15, 2.4)} cy={780}>
        <Shed dial={dial} ink={ink} />
      </Shot>
    );
  } else if (t < cut.gone) {
    shot = (
      <Shot fx={860} fy={1040} s={z(cut.call, cut.gone, 2.5, 2.8)} cy={900}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else if (t < cut.answer) {
    // взгляд из сарая во двор: на его месте пусто, следы идут сюда
    shot = (
      <Shot fx={520} fy={1150} s={z(cut.gone, cut.answer, 1.25, 1.5)} cy={820}>
        <Yard there={there} steps={steps} t={t} />
      </Shot>
    );
  } else if (t < cut.run) {
    shot = (
      <Shot fx={860} fy={1040} s={z(cut.answer, cut.run, 2.2, 2.45)} cy={900}>
        <Shed dial={dial} ink={1} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={260} fy={900} s={z(cut.run, cut.cards, 1.5, 1.75)} cy={800}>
        <Yard there={0} steps={1} t={t} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blink = Math.floor(t * 2) % 2 === 0;

  return (
    <AbsoluteFill style={{ background: C.stone }}>
      {shot}
      <Film grain={0.05} />

      {t >= cut.cards && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: 'rgba(8,7,10,.86)', opacity: cardsIn }} />
          <Card top={250} color={C.amber} item={CHOICE.a} show={cardsIn}>
            <div style={{ position: 'absolute', left: -560, top: -1530, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.7)' }}>
              <Shed dial={1} ink={1} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.cobalt} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: 250, top: -560, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.05)' }}>
              <Yard there={0} steps={1} t={t} p="c2" />
            </div>
          </Card>
          <div style={{ position: 'absolute', left: 40, top: 780, width: 1000, height: 100, display: 'flex', alignItems: 'center', paddingLeft: 34, opacity: cardsIn, fontFamily: fonts.display, fontWeight: 900, fontSize: 62, letterSpacing: '0.04em', color: C.cream }}>
            {CHOICE.q}
          </div>
          <div style={{ position: 'absolute', left: 40, top: 872, width: 1000 * left, height: 8, background: '#ff3d4f' }} />
        </AbsoluteFill>
      )}

      <div style={{ position: 'absolute', left: 60, top: 244, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 18px', background: 'rgba(8,7,10,.62)', fontFamily: fonts.display, fontWeight: 800, fontSize: 36, letterSpacing: '0.05em', color: C.cream, opacity: 1 - cardsIn }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: '#ff3d4f', opacity: blink ? 1 : 0.25 }} />
        <span>{HUD[0]}</span>
        <span style={{ opacity: 0.8 }}>· {HUD[1]}</span>
        <span style={{ color: '#ff6b5e' }}>· {HUD[2]}</span>
      </div>

      <Subtitles tl={tl} hideFrom={cut.cards} quotes={{ '06': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.4} fadeOut={0.4} />
          {/* снаружи ветер громче, в сарае — глуше */}
          <Sfx at={0} until={cut.shed} src={`${SFX}/wind.wav`} volume={0.26} fadeIn={0.3} fadeOut={0.3} duck={speech} duckTo={0.5} />
          <Sfx at={cut.shed} src={`${SFX}/wind.wav`} volume={0.1} fadeIn={0.3} fadeOut={0.4} duck={speech} duckTo={0.5} />
          <Sfx at={0.2} src={`${SFX}/crunch.wav`} volume={0.2} />
          <Sfx at={cut.pass} src={`${SFX}/crunch.wav`} volume={0.22} />
          <Sfx at={cut.radio} src={`${SFX}/radio_on.wav`} volume={0.3} />
          <Sfx at={c.s('06') - 0.2} until={c.e('06') + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          {/* удары: куртка, журнал, пустое место во дворе (главный) */}
          {[cut.jacket, cut.journal + 0.4, cut.gone + 0.25].map((at, i) => (
            <Sfx key={i} at={at} src={`${SFX}/hit.wav`} volume={i === 2 ? 0.9 : 0.5} />
          ))}
          <Sfx at={c.s('07') - 0.1} src={`${SFX}/crunch.wav`} volume={0.34} />
          <Sfx at={cut.gone} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={1} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
