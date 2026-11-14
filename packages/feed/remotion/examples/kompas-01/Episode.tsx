// Пример серии «Режиссёра» — серия kompas-01 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { Chart, Deck, INK, Wheelhouse } from '@feed/sets/kompas';

// «Компас», серия 1 — приключение, облик «ризограф». Три мира из parts.tsx: палуба, рубка, карта.
// Улика серии — железный сундук под компасом: компас из-за него врёт, а Полярная звезда — нет.
// Верный вариант развилки — «по звёздам»; покажет его серия 2 (обе ветки).

export const meta: EpisodeMeta = {
  id: 'kompas-01',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.45, '05': 0.5, '06': 0.4, '09': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '09',
};
const SFX = `${meta.id}/sfx`;
const CHOICE = {
  q: 'КУДА ПРАВИШЬ?',
  a: { n: '①', title: 'ПО КОМПАСУ', price: 'если он врёт — к рассвету рифы' },
  b: { n: '②', title: 'ПО ЗВЁЗДАМ', price: 'нарушишь приказ капитана' },
};
const DARK = '#0f2a2d';

const Card: React.FC<Omit<React.ComponentProps<typeof StageCard>, 'bg' | 'ink'>> = (p) => <StageCard bg={INK.teal} ink={INK.paper} {...p} />;

export const Episode: React.FC<EpisodeProps> = ({ tl, draft }) => {
  const t = useTime();
  if (!tl) return <AbsoluteFill style={{ background: INK.paper }} />;
  const c = cues(tl);
  const w = (id: string, re: RegExp, fallback: number) => c.find(id, re)?.start ?? fallback;
  const rule = w('01', /^Правило/, c.e('01') - 3);
  const puts = w('03', /^ставит/, c.e('03') - 1.4);
  const lies = w('05', /^компас/, c.e('05') - 2.4);
  const viaCompass = w('08', /^Пойдёшь/, (c.s('08') + c.e('08')) / 2);
  const cut = {
    rule: rule - 0.1, water: c.s('02') - 0.15, night: c.s('03') - 0.15, puts: puts - 0.1, captain: c.s('04') - 0.15,
    stars: c.s('05') - 0.15, lies: lies - 0.1, chart: c.s('06') - 0.15, poets: c.s('07') - 0.15, price: c.s('08') - 0.15,
    viaCompass: viaCompass - 0.1, cards: c.s('09') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // стрелка компаса: пока сундука нет — смотрит на север (вправо, туда же, где звезда); сундук тянет её прямо по курсу
  const needle = interpolate(t, [cut.puts, cut.puts + 1.4], [62, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const clear = ramp(t, cut.stars, cut.stars + 1.2);
  const room = { needle, chest: t < cut.night ? 0 : ramp(t, cut.night + 0.4, cut.night + 1.2), captain: t >= cut.night ? 1 : 0, clear, t };

  let shot: React.ReactNode;
  if (t < cut.rule) {
    // палуба ночью, сразу наезд на нос
    shot = (
      <Shot fx={540} fy={1000} s={1 + 0.4 * ramp(t, 0, 2.2) + z(2.2, cut.rule, 0, 0.12)} cy={880}>
        <Deck clear={0} t={t} />
      </Shot>
    );
  } else if (t < cut.water) {
    shot = (
      <Shot fx={540} fy={1060} s={z(cut.rule, cut.water, 2.3, 2.7)} cy={820}>
        <Wheelhouse {...room} chest={0} captain={0} />
      </Shot>
    );
  } else if (t < cut.night) {
    shot = (
      <Shot fx={230} fy={1640} s={z(cut.water, cut.night, 2, 2.3)} cy={880}>
        <Deck clear={0} t={t} />
      </Shot>
    );
  } else if (t < cut.puts) {
    shot = (
      <Shot fx={600} fy={1200} s={z(cut.night, cut.puts, 1.05, 1.2)} cy={900}>
        <Wheelhouse {...room} />
      </Shot>
    );
  } else if (t < cut.captain) {
    // сундук встаёт под компас — стрелка уходит
    shot = (
      <Shot fx={540} fy={1340} s={z(cut.puts, cut.captain, 1.7, 1.95)} cy={880}>
        <Wheelhouse {...room} />
      </Shot>
    );
  } else if (t < cut.stars) {
    shot = (
      <Shot fx={905} fy={980} s={z(cut.captain, cut.stars, 2.2, 2.5)} cy={820}>
        <Wheelhouse {...room} />
      </Shot>
    );
  } else if (t < cut.lies) {
    // тучи расходятся: Полярная звезда справа от носа
    shot = (
      <Shot fx={z(cut.stars, cut.lies, 600, 820)} fy={z(cut.stars, cut.lies, 760, 460)} s={z(cut.stars, cut.lies, 1.2, 1.7)} cy={760}>
        <Deck clear={clear} mark={ramp(t, cut.stars + 1.4, cut.stars + 1.8)} t={t} />
      </Shot>
    );
  } else if (t < cut.chart) {
    shot = (
      <Shot fx={540} fy={1060} s={z(cut.lies, cut.chart, 2.4, 2.8)} cy={840}>
        <Wheelhouse {...room} />
      </Shot>
    );
  } else if (t < cut.poets) {
    shot = (
      <Shot fx={540} fy={z(cut.chart, cut.poets, 1200, 760)} s={z(cut.chart, cut.poets, 1.2, 1.5)} cy={820}>
        <Chart route={ramp(t, cut.chart, cut.chart + 1.6)} alt={0} reefs={ramp(t, cut.chart + 0.9, cut.chart + 1.3)} />
      </Shot>
    );
  } else if (t < cut.price) {
    shot = (
      <Shot fx={905} fy={950} s={z(cut.poets, cut.price, 2.6, 2.9)} cy={820}>
        <Wheelhouse {...room} />
      </Shot>
    );
  } else if (t < cut.viaCompass) {
    shot = (
      <Shot fx={820} fy={420} s={z(cut.price, cut.viaCompass, 1.6, 1.85)} cy={760}>
        <Deck clear={1} mark={1} t={t} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={540} fy={900} s={z(cut.viaCompass, cut.cards, 1.2, 1.4)} cy={820}>
        <Chart route={1} alt={ramp(t, cut.viaCompass + 0.4, cut.viaCompass + 1.6)} reefs={1} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hud = t < cut.night ? ['ДЕНЬ 1/7', '18:40', 'ВОДА 7 ДН.'] : t < cut.stars ? ['ДЕНЬ 1/7', '02:10', 'ВОДА 7 ДН.'] : ['ДЕНЬ 1/7', '04:50', 'ВОДА 7 ДН.'];

  return (
    <AbsoluteFill style={{ background: INK.paper }}>
      {shot}
      <Film grain={0.03} />

      {t >= cut.cards && (
        <AbsoluteFill>
          <AbsoluteFill style={{ background: 'rgba(15,42,45,.88)', opacity: cardsIn }} />
          <Card top={250} color={INK.orange} item={CHOICE.a} show={cardsIn}>
            <div style={{ position: 'absolute', left: -380, top: -1620, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.7)' }}>
              <Wheelhouse needle={0} chest={1} captain={0} clear={1} t={t} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -700, top: -300, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.3)' }}>
              <Deck clear={1} mark={1} t={t} p="c2" />
            </div>
          </Card>
          <div style={{ position: 'absolute', left: 40, top: 780, width: 1000, height: 100, display: 'flex', alignItems: 'center', paddingLeft: 34, opacity: cardsIn, fontFamily: fonts.display, fontWeight: 900, fontSize: 62, letterSpacing: '0.04em', color: INK.paper }}>
            {CHOICE.q}
          </div>
          <div style={{ position: 'absolute', left: 40, top: 872, width: 1000 * left, height: 8, background: INK.orange }} />
        </AbsoluteFill>
      )}

      {/* плашка: день из семи, время, тающая вода */}
      <div style={{ position: 'absolute', left: 60, top: 244, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 18px', background: DARK, fontFamily: fonts.display, fontWeight: 800, fontSize: 36, letterSpacing: '0.05em', color: INK.paper, opacity: 1 - cardsIn }}>
        <span>{hud[0]}</span>
        <span style={{ opacity: 0.8 }}>· {hud[1]}</span>
        <span style={{ color: INK.yellow }}>· {hud[2]}</span>
      </div>

      <Subtitles tl={tl} hideFrom={cut.cards} quotes={{ '04': INK.yellow, '07': INK.yellow }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/sea.wav`} volume={0.4} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} src={`${SFX}/wind.wav`} volume={0.12} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.5} />
          <Sfx at={0} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.4} />
          {/* удары: правило, сундук встал, стрелка ушла, рифы, развилка */}
          <Sfx at={cut.rule} src={`${SFX}/hit.wav`} volume={0.45} />
          <Sfx at={cut.puts + 0.1} src={`${SFX}/hit.wav`} volume={0.8} />
          <Sfx at={cut.lies} src={`${SFX}/hit.wav`} volume={0.55} />
          <Sfx at={cut.chart + 1} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.poets} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.45} fadeIn={1.2} duck={speech} duckTo={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
