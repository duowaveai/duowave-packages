import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Circled, fonts } from '../lib/kit';
import { DARK, Divi, LIME } from './Divi';

// Знак, плашка и заставка копии для отправки (решения 4–6 и 17 плана «Ленты»): только в том, что уходит наружу.
// Кадр 1080×1920; движок рендерит копию в масштабе 2/3 (720p). Каждая часть есть и отдельно — прозрачной картинкой
// или клипом (композиции mark, plaque, outro) — для быстрого пути движка через ffmpeg.

export type ShareLang = 'ru' | 'en';
export const MARK = { w: 212, h: 163 };
/** Где стоит знак: 0–5 с — слева посередине, с 5-й секунды — справа ниже (как у ТикТока). */
export const MARK_AT = {
  left: { left: 28, top: Math.round((1920 - MARK.h) / 2) },
  right: { left: 1080 - MARK.w - 28, top: 1460 },
};
export const PLAQUE_TOP = 1436;
export const MARK_SWITCH = 5;
export const OUTRO = 4;

const SHADOW = 'drop-shadow(0 2px 6px rgba(0,0,0,.55)) drop-shadow(0 0 18px rgba(0,0,0,.25))';

/** Знак: ДиВи белый и «DuoWave.ai» под ним, 212×163. */
export const MarkBadge: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ width: MARK.w, height: MARK.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 12, filter: SHADOW, ...style }}>
    <Divi width={92} color="#fff" />
    <div style={{ fontFamily: fonts.ui, fontWeight: 650, fontSize: 36, lineHeight: 1, letterSpacing: '-0.01em', color: '#fff', whiteSpace: 'nowrap' }}>DuoWave.ai</div>
  </div>
);

/** Знак на кадре: слева посередине или справа ниже. */
export const Mark: React.FC<{ position: 'left' | 'right' }> = ({ position }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <MarkBadge style={{ position: 'absolute', ...MARK_AT[position] }} />
  </AbsoluteFill>
);

/** «Пиши в комментариях: ① или ②» — белая капсула. */
export const PlaqueBadge: React.FC<{ lang: ShareLang; style?: React.CSSProperties }> = ({ lang, style }) => {
  const c = (n: number) => <Circled n={n} size={46} color={DARK} stroke={4} font={fonts.ui} />;
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12, padding: '20px 32px', borderRadius: 999, background: '#fff', color: DARK,
        fontFamily: fonts.ui, fontWeight: 600, fontSize: 40, lineHeight: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap', boxShadow: '0 6px 24px rgba(0,0,0,.35)', ...style,
      }}
    >
      <span>{lang === 'en' ? 'Comment:' : 'Пиши в комментариях:'}</span>
      {c(1)}
      <span>{lang === 'en' ? 'or' : 'или'}</span>
      {c(2)}
    </div>
  );
};

/** Плашка на кадре: под карточками развилки, левее знака (знак в это время справа ниже). */
export const Plaque: React.FC<{ lang: ShareLang; pop?: number }> = ({ lang, pop = 1 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <PlaqueBadge lang={lang} style={{ position: 'absolute', left: 60, top: PLAQUE_TOP, opacity: pop, transform: `translateY(${(1 - pop) * 24}px) scale(${0.94 + 0.06 * pop})`, transformOrigin: '0 50%' }} />
  </AbsoluteFill>
);

/** Лупа строки поиска. */
const Magnifier: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0 }}>
    <circle cx="20" cy="20" r="13" fill="none" stroke="#fff" strokeWidth="5" />
    <path d="M30 30 L42 42" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
  </svg>
);

/** Заставка 4 с: ДиВи, «DuoWave», строка поиска, в которой печатается «duowave.ai», и кнопка с глазами ДиВи. */
export const Outro: React.FC<{ lang?: ShareLang }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const out = Easing.bezier(0.22, 1, 0.36, 1);
  const body = spring({ frame, fps, config: { damping: 12, stiffness: 160, mass: 0.6 } });
  const blinkAt = 1.7;
  const blink = t > blinkAt && t < blinkAt + 0.22 ? Math.sin(((t - blinkAt) / 0.22) * Math.PI) : 0;
  const word = interpolate(t, [0.3, 0.75], [0, 1], { ...clamp, easing: out });
  const bar = interpolate(t, [0.7, 1.15], [0, 1], { ...clamp, easing: out });
  const url = 'duowave.ai';
  const typed = url.slice(0, Math.max(0, Math.min(url.length, Math.floor((t - 1.15) * 14))));
  const caret = t < 2.6 && Math.floor(t * 3) % 2 === 0;
  const press = t > 2.55 && t < 2.85 ? 1 - 0.08 * Math.sin(((t - 2.55) / 0.3) * Math.PI) : 1;
  const fade = interpolate(t, [3.7, 4], [1, 0.85], clamp);
  const W = 680;
  const Hb = 112;

  return (
    <AbsoluteFill style={{ background: '#11100f', alignItems: 'center', opacity: fade }}>
      <div style={{ position: 'absolute', top: 650, transform: `scale(${0.55 + 0.45 * body})`, opacity: Math.min(1, body * 1.5) }}>
        <Divi width={176} mode="lime" blink={blink} />
      </div>
      <div style={{ position: 'absolute', top: 905, fontFamily: fonts.ui, fontWeight: 500, fontSize: 116, lineHeight: 1, letterSpacing: '-0.025em', color: '#fff', opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>
        DuoWave
      </div>
      <div
        style={{
          position: 'absolute', top: 1108, width: W, height: Hb, borderRadius: Hb, background: LIME, display: 'flex', alignItems: 'center', padding: 8, boxSizing: 'border-box',
          opacity: bar, transform: `translateY(${(1 - bar) * 40}px) scale(${0.96 + 0.04 * bar})`,
        }}
      >
        <div style={{ flex: 1, height: '100%', borderRadius: Hb, background: '#1b1a17', display: 'flex', alignItems: 'center', gap: 20, paddingLeft: 30 }}>
          <Magnifier size={46} />
          <span style={{ fontFamily: fonts.ui, fontWeight: 500, fontSize: 46, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'pre' }}>
            {typed}
            <span style={{ display: 'inline-block', width: 4, height: 46, marginLeft: 3, verticalAlign: '-6px', background: caret ? LIME : 'transparent' }} />
          </span>
        </div>
        {/* кнопка — глаза ДиВи на лайме */}
        <div style={{ width: Hb - 16, height: Hb - 16, marginLeft: 8, borderRadius: Hb, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transform: `scale(${press})` }}>
          {[0, 1].map((i) => (
            <span key={i} style={{ width: 17, height: 32, borderRadius: 9, background: DARK }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
