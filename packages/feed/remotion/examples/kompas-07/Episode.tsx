// Пример серии «Режиссёра» — серия kompas-07 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { CoastChart, Deck, INK, Lighthouse, Pier, Treasure, Wheelhouse } from '@feed/sets/kompas';

// «Компас», серия 7 — финал сезона. Обе ветки развилки серии 6, они же концовки:
//   крючок → ВАРИАНТ ① «в порт Алый» (неверный, твой выбор): у причала лодка соперников, «КОНЕЦ» → «Перемотаем» →
//   ВАРИАНТ ② «к маяку»: вода, золото «Северянина», журнал с последней записью — простыми словами, что сгубило
//   пароход; крючок на второй сезон и развилка «второй сезон / новая история». Новые миры — parts.tsx.

export const meta: EpisodeMeta = {
  id: 'kompas-07',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.4, '04': 0.5, '05': 0.6, '06': 1.7, '07': 0.9, '08': 0.6, '10': 0.6, '11': 0.7, '12': 0.6, '13': 0.6, '14': 0.6 }, defaultPre: 0.3, endHold: 3.8 },
  choiceLine: '14',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '13'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'a' as 'a' | 'b';
const PREV = { a: '① В ПОРТ АЛЫЙ', b: '② К МАЯКУ' };
const CHOICE = {
  q: 'ЧТО ДАЛЬШЕ?',
  a: { n: '①', title: 'ВТОРОЙ СЕЗОН', price: 'на север, за вторым пароходом' },
  b: { n: '②', title: 'НОВАЯ ИСТОРИЯ', price: 'другой мир и другой облик' },
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
  const ask = w('01', /^В$/, c.e('01') - 2);
  const theyWait = w('03', /^А$/, c.e('03') - 1.8);
  const youChecked = w('11', /^Ты$/, c.e('11') - 1.6);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, name: c.s('03') - 0.15, wait: theyWait - 0.1, demand: c.s('04') - 0.15, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, cape: c.s('08') - 0.15, box: c.s('09') - 0.15, entry: c.s('10') - 0.15,
    law: c.s('11') - 0.15, checked: youChecked - 0.1, half: c.s('12') - 0.15, map: c.s('13') - 0.15, cards: c.s('14') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    shot = (
      <Shot fx={540} fy={960} s={1 + 0.35 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.1)} cy={900}>
        <CoastChart left={1} right={1} />
      </Shot>
    );
  } else if (t < cut.name) {
    // вечер, порт Алый
    shot = (
      <Shot fx={540} fy={900} s={z(cut.b1, cut.name, 1, 1.15)} cy={860}>
        <Pier near={z(cut.b1, cut.name, 0, 0.4)} t={t} />
      </Shot>
    );
  } else if (t < cut.wait) {
    // название на борту лодки
    shot = (
      <Shot fx={760} fy={1000} s={z(cut.name, cut.wait, 2, 2.3)} cy={860}>
        <Pier near={0.4} t={t} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // те двое на причале
    shot = (
      <Shot fx={470} fy={820} s={z(cut.wait, cut.montage, 2.2, 2.6)} cy={820}>
        <Pier near={0.5} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 14, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={480} fy={820} s={2.6 + step * 0.3} cy={820}>
          <Pier near={0.6} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={480 + 14 * Math.sin(t * 90)} fy={820} s={2.6 - 1.5 * p} cy={820}>
        <Pier near={0.6 - 0.6 * p} t={t} />
      </Shot>
    );
  } else if (t < cut.cape) {
    // два дня к маяку: бочки пусты
    shot = (
      <Shot fx={230} fy={1640} s={z(cut.b2, cut.cape, 1.6, 1.9)} cy={880}>
        <Deck clear={1} dawn={1} barrels={0} t={t} />
      </Shot>
    );
  } else if (t < cut.box) {
    shot = (
      <Shot fx={600} fy={700} s={z(cut.cape, cut.box, 1.2, 1.5)} cy={820}>
        <Lighthouse beam={1} keeper={ramp(t, cut.cape + 0.3, cut.cape + 0.8)} t={t} />
      </Shot>
    );
  } else if (t < cut.entry) {
    // золото и журнал
    shot = (
      <Shot fx={540} fy={490} s={z(cut.box, cut.entry, 1.2, 1.4)} cy={760}>
        <Treasure entry={0} map={0} />
      </Shot>
    );
  } else if (t < cut.law) {
    shot = (
      <Shot fx={500} fy={1080} s={z(cut.entry, cut.law, 1.6, 1.8)} cy={820}>
        <Treasure entry={ramp(t, cut.entry + 0.6, cut.entry + 1.6)} map={0} />
      </Shot>
    );
  } else if (t < cut.half) {
    // закон сезона: компас и железо — та же рубка, тот же сундук
    shot = (
      <Shot fx={t < cut.checked ? 540 : 820} fy={t < cut.checked ? 1300 : 420} s={t < cut.checked ? z(cut.law, cut.checked, 1.6, 1.8) : z(cut.checked, cut.half, 1.6, 1.8)} cy={t < cut.checked ? 860 : 760}>
        {t < cut.checked ? <Wheelhouse needle={0} chest={1} captain={0} clear={1} t={t} /> : <Deck clear={1} dawn={0} mark={1} t={t} />}
      </Shot>
    );
  } else if (t < cut.map) {
    shot = (
      <Shot fx={540} fy={490} s={z(cut.half, cut.map, 1.5, 1.7)} cy={760}>
        <Treasure entry={1} map={0} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={640} fy={1400} s={z(cut.map, cut.cards, 1.5, 1.8)} cy={860}>
        <Treasure entry={1} map={ramp(t, cut.map + 0.6, cut.map + 1.4)} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.b1 ? ['ДЕНЬ 6/7', '07:10', 'ВОДА 2 ДН.'] : t < cut.end ? ['ДЕНЬ 6/7', '19:20', 'ВОДА 1 ДН.'] : t < cut.box ? ['ДЕНЬ 7/7', '06:40', 'ВОДА 0 ДН.'] : ['ФИНАЛ', 'МАЯК', 'СЕЗОН 1'];
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
            <div style={{ position: 'absolute', left: -480, top: -2380, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.8)' }}>
              <Treasure entry={1} map={1} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <Img src={staticFile(`${meta.id}/looks.jpg`)} style={{ position: 'absolute', left: 300, top: 0, height: 530 }} />
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

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '04': INK.orange, '10': INK.yellow }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/sea.wav`} volume={0.35} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} until={cut.box} src={`${SFX}/low.wav`} volume={0.2} fadeIn={0.4} fadeOut={0.6} />
          <Sfx at={cut.b2} src={`${SFX}/wind.wav`} volume={0.12} fadeIn={0.3} fadeOut={0.6} duck={speech} duckTo={0.5} />
          {/* неверная ветка: название лодки, те двое, «КОНЕЦ» */}
          <Sfx at={cut.name + 0.3} src={`${SFX}/hit.wav`} volume={0.7} />
          <Sfx at={cut.wait} until={cut.end} src={`${SFX}/heart.wav`} loop volume={0.5} fadeIn={0.6} duck={speech} duckTo={0.7} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка и ответ сезона: удары только на раскрытиях */}
          <Sfx at={cut.cape + 0.3} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.box + 0.2} src={`${SFX}/hit.wav`} volume={0.8} />
          <Sfx at={cut.entry + 0.6} src={`${SFX}/hit.wav`} volume={0.7} />
          <Sfx at={cut.map + 0.6} src={`${SFX}/hit.wav`} volume={0.6} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
