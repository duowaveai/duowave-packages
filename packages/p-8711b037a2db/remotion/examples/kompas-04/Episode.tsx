// Пример серии «Режиссёра» — серия kompas-04 теста series-feed, перенесённая на библиотеку пакета: миры — из
// @feed/sets/kompas, общие куски — из @feed/lib. Так выглядит код режиссёра в <files>/episodes/<id>/code/Episode.tsx.

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Film, Sfx, Subtitles, Voice, fonts, ramp, shake, useTime } from '@feed/lib/kit';
import type { EpisodeMeta, EpisodeProps } from '@feed/lib/episode';
import { Card as StageCard, Shot } from '@feed/lib/stage';
import { cues } from '@feed/lib/timeline';
import { Bay, INK } from '@feed/sets/kompas';

// «Компас», серия 4. Обе ветки развилки серии 3:
//   крючок и повтор развилки → ВАРИАНТ ① «бросить конец» (неверный): насос брошен, пузырей всё меньше, у борта
//   соперники, «КОНЕЦ» → «Перемотаем» → ВАРИАНТ ② «не подпускать» (верный, твой выбор): раскрытие — «рыбаки»
//   ищут тот же пароход; капитан поднимается с табличкой «Северянин» → новая развилка.
// Улика развилки — «Правила водолаза» у насоса: между спусками не меньше 6 часов.

export const meta: EpisodeMeta = {
  id: 'kompas-04',
  lang: 'ru',
  pacing: { pre: { '01': 0.3, '03': 0.5, '04': 0.5, '05': 0.6, '06': 1.7, '07': 0.9, '09': 0.4, '10': 0.6, '11': 0.4, '12': 0.4, '14': 0.45 }, defaultPre: 0.3, endHold: 3.6 },
  choiceLine: '14',
  branches: { wrong: 'a', wrongLines: ['02', '05'], rightLines: ['07', '13'] },
};
const SFX = `${meta.id}/sfx`;
const CHOSEN = 'b' as 'a' | 'b';
const PREV = { a: '① БРОСИТЬ КОНЕЦ', b: '② НЕ ПОДПУСКАТЬ' };
const CHOICE = {
  q: 'ПУСКАЕШЬ?',
  a: { n: '①', title: 'ПУСТИТЬ СЕЙЧАС', price: 'если ему станет плохо — ты наверху один' },
  b: { n: '②', title: 'ЖДАТЬ ШЕСТЬ ЧАСОВ', price: 'к ночи вернётся лодка' },
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
  const ask = w('01', /^Бросить/, c.e('01') - 2.4);
  const tarpBad = w('04', /^Под$/, c.s('04') + 1);
  const tarpGood = w('08', /^Под$/, c.e('08') - 1.8);
  const wait = w('13', /^Подождёшь/, (c.s('13') + c.e('13')) / 2);
  const end = c.e('05') + 0.25; // «КОНЕЦ»
  const cut = {
    b1: c.s('02') - 0.2, bubbles: c.s('03') - 0.15, boat: c.s('04') - 0.15, tarp: tarpBad - 0.1, montage: c.s('05') - 0.1, end,
    rewind: c.s('06') - 0.25, b2: c.s('07') - 0.3, turn: c.s('08') - 0.15, helmet: tarpGood - 0.1, rivals: c.s('09') - 0.15,
    tugs: c.s('10') - 0.15, plate: c.s('11') - 0.15, again: c.s('12') - 0.15, price: c.s('13') - 0.15, wait: wait - 0.1, cards: c.s('14') - 0.1,
  };
  const z = (a: number, b: number, from: number, to: number) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // насос: в неверной ветке останавливается, в верной качает до конца
  const pumpBad = t < cut.b1 + 0.8 ? t * 140 : (cut.b1 + 0.8) * 140;
  const pump = t * 140;
  const air = t >= cut.b1 && t < cut.end ? Math.max(0.1, 1 - (t - cut.b1) / 5) : 1;
  const up = ramp(t, cut.tugs + 0.4, cut.plate + 0.2);

  let shot: React.ReactNode;
  let grey = 0;
  if (t < cut.b1) {
    // крючок: насос качает, лодка просится к борту
    shot = (
      <Shot fx={500} fy={1250} s={1.15 + 0.35 * ramp(t, 0, 2.2) + z(2.2, cut.b1, 0, 0.1)} cy={900}>
        <Bay boat={0.85} tarp={0} diver={1} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.bubbles) {
    shot = (
      <Shot fx={300} fy={1480} s={z(cut.b1, cut.bubbles, 1.8, 2.1)} cy={900}>
        <Bay boat={0.85} diver={1} pump={pumpBad} air={air} t={t} />
      </Shot>
    );
  } else if (t < cut.boat) {
    // пузырей всё меньше
    shot = (
      <Shot fx={470} fy={1180} s={z(cut.bubbles, cut.boat, 2, 2.4)} cy={860}>
        <Bay boat={0.85} diver={1} pump={pumpBad} air={air} t={t} />
      </Shot>
    );
  } else if (t < cut.montage) {
    // лодка у борта, брезент сдвинут
    shot = (
      <Shot fx={680} fy={1180} s={z(cut.boat, cut.montage, 1.9, 2.4)} cy={860}>
        <Bay boat={1} tarp={ramp(t, cut.tarp, cut.tarp + 0.5)} diver={1} pump={pumpBad} air={air} t={t} />
      </Shot>
    );
  } else if (t < cut.end) {
    const step = Math.floor((t - cut.montage) / 0.42);
    const j = shake(t, Array.from({ length: 12 }, (_, i) => cut.montage + i * 0.42), 14, 0.3);
    shot = (
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${j.x}px, ${j.y}px)` }}>
        <Shot fx={460} fy={1200} s={2.2 + step * 0.3} cy={860}>
          <Bay boat={1} tarp={1} diver={1} pump={pumpBad} air={0.05} t={t} />
        </Shot>
      </div>
    );
  } else if (t < cut.rewind) {
    shot = <AbsoluteFill style={{ background: DARK }} />;
  } else if (t < cut.b2) {
    grey = 1;
    const p = (t - cut.rewind) / (cut.b2 - cut.rewind);
    shot = (
      <Shot fx={460 + 14 * Math.sin(t * 90)} fy={1200} s={2.6 - 1.2 * p} cy={860}>
        <Bay boat={1 - 0.15 * p} tarp={1 - p} diver={1} pump={-t * 300} air={p} t={t} />
      </Shot>
    );
  } else if (t < cut.turn) {
    // не отходишь от насоса
    shot = (
      <Shot fx={300} fy={1480} s={z(cut.b2, cut.turn, 1.8, 2.1)} cy={900}>
        <Bay boat={0.85} diver={1} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.rivals) {
    // лодка разворачивается: пустое дно, под брезентом шлем
    shot = (
      <Shot fx={640} fy={1060} s={z(cut.turn, cut.rivals, 1.8, 2.3)} cy={860}>
        <Bay boat={z(cut.turn, cut.rivals, 0.85, 0.6)} tarp={ramp(t, cut.helmet, cut.helmet + 0.5)} diver={1} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.tugs) {
    shot = (
      <Shot fx={820} fy={880} s={z(cut.rivals, cut.tugs, 1.6, 1.4)} cy={820}>
        <Bay boat={z(cut.rivals, cut.tugs, 0.6, 0.1)} tarp={1} diver={1} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.again) {
    // два рывка — капитан поднимается; табличка «Северянин»
    shot = (
      <Shot fx={t < cut.plate ? 480 : 600} fy={t < cut.plate ? 1250 : 1290} s={t < cut.plate ? z(cut.tugs, cut.plate, 1.6, 1.9) : z(cut.plate, cut.again, 2.3, 2.6)} cy={860}>
        <Bay boat={0} diver={1 - 0.75 * up} plate={ramp(t, cut.plate, cut.plate + 0.4)} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.price) {
    shot = (
      <Shot fx={520} fy={1260} s={z(cut.again, cut.price, 2, 2.3)} cy={860}>
        <Bay boat={0} diver={0.25} plate={1} pump={pump} t={t} />
      </Shot>
    );
  } else if (t < cut.wait) {
    // правила водолаза у насоса — в кадре, без слов
    shot = (
      <Shot fx={765} fy={1275} s={z(cut.price, cut.wait, 1.9, 2.1)} cy={860}>
        <Bay boat={0} diver={0.25} pump={pump} rules={1} t={t} />
      </Shot>
    );
  } else {
    shot = (
      <Shot fx={860} fy={860} s={z(cut.wait, cut.cards, 1.5, 1.7)} cy={820}>
        <Bay boat={0.05} tarp={1} diver={0.25} pump={pump} rules={1} t={t} />
      </Shot>
    );
  }

  const speech = tl.lines.map((l) => [l.start, l.end] as [number, number]);
  const cardsIn = ramp(t, cut.cards, cut.cards + 0.3);
  const left = interpolate(t, [cut.cards + 0.3, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const inBad = t >= cut.b1 && t < cut.end;
  const inGood = t >= cut.b2 && t < cut.cards;
  const hud = t < cut.tugs ? ['ДЕНЬ 5/7', '10:40', 'ВОДА 3 ДН.'] : ['ДЕНЬ 5/7', '11:05', 'ВОДА 3 ДН.'];
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
            <div style={{ position: 'absolute', left: -320, top: -1880, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.7)' }}>
              <Bay boat={0} diver={0.25} plate={1} pump={t * 140} t={t} p="c1" />
            </div>
          </Card>
          <Card top={880} color={INK.yellow} item={CHOICE.b} show={ramp(t, cut.cards + 0.12, cut.cards + 0.42)}>
            <div style={{ position: 'absolute', left: -877, top: -2030, width: 1080, height: 1920, transformOrigin: '0 0', transform: 'scale(1.8)' }}>
              <Bay boat={0} diver={0.25} pump={t * 140} rules={1} t={t} p="c2" />
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

      <Subtitles tl={tl} hideFrom={cut.cards} hide={[[ask - 0.1, cut.b1], [cut.end, cut.rewind]]} quotes={{ '07': INK.paper, '11': INK.yellow, '12': INK.yellow }} />
      {!draft && (
        <>
          <Voice tl={tl} />
          <Sfx at={0} src={`${SFX}/sea.wav`} volume={0.35} fadeIn={0.3} fadeOut={0.5} duck={speech} duckTo={0.55} />
          <Sfx at={0} until={cut.end} src={`${SFX}/low.wav`} volume={0.18} fadeIn={0.4} fadeOut={0.1} />
          <Sfx at={cut.b2} src={`${SFX}/low.wav`} volume={0.18} fadeIn={0.4} fadeOut={0.4} />
          {/* насос — ровный стук, пока качают; в неверной ветке обрывается */}
          <Sfx at={0} until={cut.b1 + 0.8} src={`${SFX}/heart.wav`} loop volume={0.3} fadeIn={0.4} fadeOut={0.2} duck={speech} duckTo={0.6} />
          <Sfx at={cut.b2} until={cut.cards} src={`${SFX}/heart.wav`} loop volume={0.3} fadeIn={0.3} duck={speech} duckTo={0.6} />
          {/* неверная ветка */}
          <Sfx at={cut.b1 + 0.8} src={`${SFX}/hit.wav`} volume={0.5} />
          <Sfx at={cut.tarp} src={`${SFX}/hit.wav`} volume={0.85} />
          {Array.from({ length: Math.max(0, Math.floor((cut.end - cut.montage) / 0.42)) }, (_, i) => (
            <Sfx key={i} at={cut.montage + i * 0.42} src={`${SFX}/hit.wav`} volume={0.34 + i * 0.05} />
          ))}
          <Sfx at={cut.end} src={`${SFX}/hit.wav`} volume={0.95} />
          <Sfx at={cut.rewind} src={`${SFX}/rewind.wav`} volume={0.4} />
          {/* верная ветка: шлем в лодке, рывки верёвки, табличка */}
          <Sfx at={cut.helmet} src={`${SFX}/hit.wav`} volume={0.75} />
          <Sfx at={cut.tugs + 0.1} src={`${SFX}/hit.wav`} volume={0.4} />
          <Sfx at={cut.tugs + 0.5} src={`${SFX}/hit.wav`} volume={0.4} />
          <Sfx at={cut.plate} src={`${SFX}/hit.wav`} volume={0.8} />
          <Sfx at={cut.cards - 3} until={cut.cards} src={`${SFX}/rise.wav`} volume={0.2} duck={speech} duckTo={0.5} />
          <Sfx at={cut.cards} src={`${SFX}/hit.wav`} volume={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};
