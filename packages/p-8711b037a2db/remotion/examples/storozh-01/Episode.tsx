// Пример серии «Режиссёра» — серия storozh-01 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/storozh, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { cues } from '@feed/lib/timeline';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { C, DoorRoom, GlassRoom } from '@feed/sets/storozh';

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={C.stone} ink={C.cream} {...p} />;

// Пример серии ленты: «Сторож», серия 1, облик «витраж».
// Планы — ракурсы камеры на два мира из parts.tsx; все времена берутся от реплик (cues), а не из секунд.
// Реплики — feed/episodes/storozh-01/voice.ru.json. Без озвучки серия собирается немым черновиком по оценке времён.

export const meta: EpisodeMeta = {
  id: 'storozh-01',
  lang: 'ru',
  pacing: { pre: { '01': 0.35, '03': 0.5, '10': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '10',
};
const SFX = `${meta.id}/sfx`;
const HUD = ['НОЧЬ 1/7', '02:14', 'ДРОВА 60 %'];
const CHOICE = {
  q: 'ОТКРЫВАЕШЬ?',
  a: { n: '①', title: 'ОТКРЫТЬ', price: 'впустишь того, кто пришёл без следов' },
  b: { n: '②', title: 'НЕ ОТКРЫВАТЬ', price: 'если это человек — до утра не дотянет' },
};

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: C.stone }} />;
  const c = cues(tl);
  const cut = { radio: c.s('04') - 0.15, plug: c.s('05') - 0.15, snow: c.s('06') - 0.15, note: c.s('07') - 0.15, near: c.s('08') - 0.15, price: c.s('09') - 0.15, cards: c.s('10') - 0.1 };

  // состояние комнаты во времени
  const moon = c.s('06') + 0.5;
  const lit = interpolate(t, [0, moon, moon + 1.4], [0.2, 0.2, 1], { extrapolateRight: 'clamp' });
  const eyes = ramp(t, moon + 1.2, moon + 1.6);
  const dialAt = c.s('03') + 0.55;
  const dial = t < dialAt ? 0 : Math.min(1, (t - dialAt) * 6) * (0.84 + 0.16 * Math.sin(t * 9) * Math.sin(t * 2.3));
  const near = ramp(t, cut.near, c.e('08'));
  const there = ramp(t, moon + 0.5, moon + 1.1);
  const room = { lit, eyes, dial, near, there };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  let shot: React.ReactNode;
  if (t < c.s('02') - 0.15) {
    shot = (
      <Shot fx={540} fy={850} s={1 + 0.5 * ramp(t, 0, 2.4) + z(2.4, c.s('02'), 0, 0.14)} cy={800}>
        <DoorRoom lamp={0.9} />
      </Shot>
    );
  } else if (t < cut.radio) {
    shot = (
      <Shot fx={540} fy={900} s={z(c.s('02'), cut.radio, 1, 1.07)} cy={900}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.plug) {
    shot = (
      <Shot fx={520} fy={1070} s={z(cut.radio, cut.plug, 1.85, 2)} cy={800}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.snow) {
    shot = (
      <Shot fx={850} fy={1150} s={z(cut.plug, cut.snow, 2.3, 2.5)} cy={800}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.note) {
    shot = (
      <Shot fx={560} fy={640} s={z(cut.snow, cut.note, 1.3, 1.44)} cy={760}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else if (t < cut.near) {
    shot = (
      <Shot fx={540} fy={836} s={z(cut.note, cut.near, 2.25, 2.45)} cy={760}>
        <DoorRoom lamp={1} />
      </Shot>
    );
  } else if (t < cut.price) {
    shot = (
      <Shot fx={600} fy={620} s={z(cut.near, cut.price, 1.85, 2.1)} cy={760}>
        <GlassRoom {...room} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={540} fy={860} s={z(cut.price, cut.cards, 1.1, 1.2)} cy={900}>
        <GlassRoom {...room} />
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
            <div style={{ position: 'absolute', left: 340, top: -330, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(0.72)' }}>
              <DoorRoom lamp={1} p="c1" />
            </div>
          </Card>
          <Card top={880} color={C.cobalt} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: 60, top: -330, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.1)' }}>
              <GlassRoom lit={1} near={1} eyes={1} dial={0} p="c2" />
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
        <span style={{ color: C.amber }}>· {HUD[2]}</span>
      </div>

      <Subtitles tl={tl} hideFrom={cut.cards} quotes={{ '04': C.amber, '08': C.amber }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          {/* низ и метель под всем роликом, под голосом приглушены; удар — на каждое событие картинки */}
          <Sfx at={0} src={`${SFX}/low.wav`} volume={0.3} fadeIn={0.4} fadeOut={0.4} />
          <Sfx at={0} src={`${SFX}/wind.wav`} volume={0.16} fadeIn={0.3} fadeOut={0.4} duck={speech} duckTo={0.5} />
          <Sfx at={dialAt - 0.05} src={`${SFX}/radio_on.wav`} volume={0.32} />
          {(['04', '08'] as const).map((id) => (
            <Sfx key={id} at={c.s(id) - 0.2} until={c.e(id) + 0.25} src={`${SFX}/static.wav`} volume={0.07} fadeIn={0.15} fadeOut={0.2} />
          ))}
          {[cut.plug, moon + 0.5, cut.note, cut.near].map((at, i) => (
            <Sfx key={i} at={at} src={`${SFX}/hit.wav`} volume={i === 1 ? 0.85 : 0.5} />
          ))}
          <Sfx at={cut.near} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.55} fadeIn={1.5} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
      {draft && (
        <div style={{ position: 'absolute', right: 40, top: 150, fontFamily: fonts.ui, fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,.55)' }}>черновик без звука</div>
      )}
    </AbsoluteFill>
  );
};
