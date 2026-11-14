// Пример серии «Режиссёра» — серия storozh-02 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { C, DoorRoom, GlassRoom, StoveRoom } from '@feed/sets/storozh';

// «Сторож», серия 2 — после выбора «не открывать». Декорации серии 1 плюс печь; облик «витраж».
// Новое: рация говорит голосом сторожа, стёртый пункт инструкции проступает, огонь в печи гаснет за серию.

export const meta: EpisodeMeta = {
  id: 'storozh-02',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '02': 0.45, '03': 0.6, '10': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '10',
};
const SFX = `${meta.id}/sfx`;
const HUD = ['НОЧЬ 1/7', '02:31', 'ДРОВА 20 %'];
const CHOICE = {
  q: 'ИДЁШЬ?',
  a: { n: '①', title: 'ИДТИ ЗА ДРОВАМИ', price: 'пройдёшь мимо того, кто стоит во дворе' },
  b: { n: '②', title: 'ОСТАТЬСЯ', price: 'к утру печь остынет, а рация знает, где ты' },
};
const RULE4 = 'На свой голос не отвечать.';

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={C.stone} ink={C.cream} {...p} />;

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: C.stone }} />;
  const c = cues(tl);
  const stay = c.find('09', /^Останешься/)?.start ?? (c.s('09') + c.e('09')) / 2;
  const cut = {
    door: c.s('02') - 0.15, radio: c.s('03') - 0.15, window: c.s('04') - 0.1, silent: c.s('05') - 0.15, note: c.s('06') - 0.15,
    stove: c.s('07') - 0.15, warn: c.s('08') - 0.15, yard: c.s('09') - 0.15, cold: stay - 0.1, cards: c.s('10') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // состояние мира во времени
  const dialAt = c.s('03') + 0.2;
  const dial = t < dialAt ? 0 : Math.min(1, (t - dialAt) * 6) * (0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3));
  // фигура: в начале стоит у двора, на словах «у окна» подходит вплотную, к развилке снова далеко
  const near = t < cut.yard ? ramp(t, cut.window, c.e('04') - 0.4) : 0;
  const room = { lit: 1, eyes: 1, there: 1, dial, near };
  const reveal = ramp(t, cut.note + 0.5, cut.note + 1.6);
  const fire = interpolate(t, [0, cut.stove, cut.warn, cut.cards], [0.75, 0.75, 0.3, 0.14], { extrapolateRight: 'clamp' });

  let shot: React.ReactNode;
  if (t < cut.door) {
    shot = (
      <Shot fx={580} fy={640} s={1 + 0.55 * ramp(t, 0, 2.4) + z(2.4, cut.door, 0, 0.12)} cy={760}>
        <GlassRoom {...room} dial={0} />
      </Shot>
    );
  } else if (t < cut.radio) {
    shot = (
      <Shot fx={540} fy={1000} s={z(cut.door, cut.radio, 1.25, 1.4)} cy={860}>
        <DoorRoom lamp={0.9} />
      </Shot>
    );
  } else if (t < cut.window) {
    shot = (
      <Shot fx={520} fy={1070} s={z(cut.radio, cut.window, 1.8, 2.05)} cy={800}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.silent) {
    shot = (
      <Shot fx={600} fy={620} s={z(cut.window, cut.silent, 1.5, 1.95)} cy={760}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.note) {
    shot = (
      <Shot fx={520} fy={1070} s={z(cut.silent, cut.note, 2.2, 2.4)} cy={800}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.stove) {
    shot = (
      <Shot fx={540} fy={836} s={z(cut.note, cut.stove, 2.3, 2.6)} cy={760}>
        <DoorRoom lamp={1} rule4={RULE4} rule4Show={reveal} />
      </Shot>
    );
  } else if (t < cut.warn) {
    shot = (
      <Shot fx={540} fy={1090} s={z(cut.stove, cut.warn, 1.2, 1.45)} cy={820}>
        <StoveRoom fire={fire} t={t} />
      </Shot>
    );
  } else if (t < cut.yard) {
    shot = (
      <Shot fx={520} fy={1070} s={z(cut.warn, cut.yard, 1.9, 2.1)} cy={800}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.cold) {
    shot = (
      <Shot fx={560} fy={640} s={z(cut.yard, cut.cold, 1.3, 1.45)} cy={760}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={540} fy={1090} s={z(cut.cold, cut.cards, 1.5, 1.7)} cy={820}>
        <StoveRoom fire={fire} t={t} />
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
          <Card top={250} color={C.cobalt} item={CHOICE.a} show={cardsIn}>
            <div style={{ position: 'absolute', left: 60, top: -330, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.1)' }}>
              <GlassRoom lit={1} near={0} eyes={1} dial={0} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.amber} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: 330, top: -560, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(0.8)' }}>
              <StoveRoom fire={0.2} t={t} p="c2" />
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

      <Subtitles tl={tl} hideFrom={cut.cards} quotes={{ '04': C.amber, '08': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.4} fadeOut={0.4} />
          <Sfx at={0} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.3} fadeOut={0.4} duck={speech} duckTo={0.5} />
          <Sfx at={dialAt - 0.05} src={`${SFX}/radio_on.wav`} volume={0.32} />
          {(['04', '08'] as const).map((id) => (
            <Sfx key={id} at={c.s(id) - 0.2} until={c.e(id) + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          ))}
          {/* удары: фигура у окна (главный), проступивший пункт, печь, двор */}
          {[cut.window + 0.5, cut.note + 0.6, cut.stove, cut.yard].map((at, i) => (
            <Sfx key={i} at={at} src={`${SFX}/hit.wav`} volume={i === 0 ? 0.85 : 0.5} />
          ))}
          <Sfx at={cut.warn} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={1.5} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
