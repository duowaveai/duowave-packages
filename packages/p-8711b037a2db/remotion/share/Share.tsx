import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts } from '../lib/kit';
import { DARK, Divi } from './Divi';
import { MARK_SWITCH, Mark, OUTRO, Plaque, PlaqueBadge, Outro, type ShareLang } from './parts';

// Копия для отправки: серия как есть + знак (0–5 с слева посередине, с 5-й секунды справа ниже) + плашка
// «Пиши в комментариях: ① или ②», пока стоят карточки развилки + заставка 4 с. Рисуется 1080×1920, движок
// рендерит в масштабе 2/3 (720p). И карточка серии — картинка, которая уходит вместо ролика.

/** Путь из public-папки ('<id>/episode.mp4') или уже готовый адрес (http…, /…). */
const src = (p: string) => (/^(https?:|\/|data:|blob:)/.test(p) ? p : staticFile(p));

export type ShareProps = { src: string; duration: number; choiceAt: number | null; lang: ShareLang };

export const shareMetadata = (props: ShareProps, fps = 30) => ({ durationInFrames: Math.max(1, Math.ceil((props.duration + OUTRO) * fps)) });

export const Share: React.FC<ShareProps> = ({ src: video, duration, choiceAt, lang }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const end = Math.max(1, Math.round(duration * fps));
  const sw = Math.min(end, MARK_SWITCH * fps);
  const plaqueFrom = choiceAt === null || choiceAt === undefined ? null : Math.max(0, Math.min(end - 1, Math.round(choiceAt * fps)));
  const pop = plaqueFrom === null ? 0 : spring({ frame: frame - plaqueFrom, fps, config: { damping: 14, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence durationInFrames={end}>
        <OffthreadVideo src={src(video)} />
      </Sequence>
      <Sequence durationInFrames={sw}>
        <Mark position="left" />
      </Sequence>
      {end > sw && (
        <Sequence from={sw} durationInFrames={end - sw}>
          <Mark position="right" />
        </Sequence>
      )}
      {plaqueFrom !== null && (
        <Sequence from={plaqueFrom} durationInFrames={end - plaqueFrom}>
          <Plaque lang={lang} pop={pop} />
        </Sequence>
      )}
      <Sequence from={end} durationInFrames={OUTRO * fps}>
        <Outro lang={lang} />
      </Sequence>
    </AbsoluteFill>
  );
};

export type CardProps = { frame: string; title: string; n: number; q?: string; lang: ShareLang };

/** Карточка серии вместо ролика: последний кадр серии, название и номер, (вопрос), плашка, ДиВи и DuoWave.ai. */
export const EpisodeCard: React.FC<CardProps> = ({ frame, title, n, q, lang }) => {
  const head = lang === 'en' ? `“${title}” · episode ${n}` : `«${title}» · серия ${n}`;
  return (
    <AbsoluteFill style={{ background: '#0b0d0c' }}>
      <Img src={src(frame)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 70%, rgba(0,0,0,.78) 88%, rgba(0,0,0,.86) 100%)' }} />
      <div style={{ position: 'absolute', top: 92, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '22px 46px', borderRadius: 28, background: '#fff', color: DARK, fontFamily: fonts.ui, fontWeight: 700, fontSize: 52, lineHeight: 1.1, letterSpacing: '-0.01em', maxWidth: 940, textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.35)' }}>
          {head}
        </div>
      </div>
      {q && (
        <div style={{ position: 'absolute', top: 1418, left: 60, right: 60, textAlign: 'center', fontFamily: fonts.display, fontWeight: 900, fontSize: 64, lineHeight: 1.05, letterSpacing: '0.03em', color: '#fff', textTransform: 'uppercase', textShadow: '0 4px 20px rgba(0,0,0,.8)' }}>
          {q}
        </div>
      )}
      <div style={{ position: 'absolute', top: q ? 1512 : 1490, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <PlaqueBadge lang={lang} />
      </div>
      <div style={{ position: 'absolute', top: 1660, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))' }}>
        <Divi width={112} color="#fff" />
        <div style={{ fontFamily: fonts.ui, fontWeight: 700, fontSize: 44, lineHeight: 1, color: '#fff', letterSpacing: '-0.01em' }}>DuoWave.ai</div>
      </div>
    </AbsoluteFill>
  );
};

