import React from 'react';
import { Composition, Still } from 'remotion';
import { DataEpisodeView, dataMetadata, type DataProps } from './data/DataEpisode';
import { episodeProps, type EpisodeMeta, type EpisodeProps } from './lib/episode';
import './lib/fonts';
import { LOOKS, LOOK_IDS } from './looks/index';
import { SetPreview, type SetPreviewProps } from './sets/preview';
import { EpisodeCard, Share, shareMetadata, type CardProps, type ShareProps } from './share/Share';
import { Mark, OUTRO, Outro, Plaque, type ShareLang } from './share/parts';

// Все композиции «Ленты». Движок пишет свою точку входа:
//   import { registerRoot } from 'remotion';
//   import { makeRoot } from '<пакет>/remotion/root';
//   import * as e0 from '<files>/episodes/<id>/code/Episode';
//   registerRoot(makeRoot([e0, …]));
// и собирает её с webpackOverride (remotion/webpack.ts: `@feed` → remotion/, модули — из node_modules пакета).
//
// Композиции: look-<облик> ×6 (образцы для знакомства, 6 с), серии режиссёра — по meta.id, `data` (серия данными),
// `share` (копия для отправки), `mark`, `plaque`, `card` (картинки), `outro` (заставка 4 с), `set` (кадр одной
// декорации: проверить состояние и ракурс, превью для каталога). Кадр везде 1080×1920.

const W = 1080;
const H = 1920;
const FPS = 30;

export type Directed = { meta: EpisodeMeta; Episode: React.FC<EpisodeProps> };

export function makeRoot(directed: Directed[]): React.FC {
  const Root: React.FC = () => (
    <>
      {LOOK_IDS.map((id) => (
        <Composition key={id} id={`look-${id}`} component={LOOKS[id].Hook} width={W} height={H} fps={FPS} durationInFrames={FPS * 6} />
      ))}

      {directed.map(({ meta, Episode }) => (
        <Composition
          key={meta.id}
          id={meta.id}
          component={Episode}
          width={W}
          height={H}
          fps={FPS}
          durationInFrames={FPS * 60}
          defaultProps={{ tl: null, draft: true, choiceAt: null, branchTimes: null } as EpisodeProps}
          calculateMetadata={async () => {
            const props = await episodeProps(meta);
            return { durationInFrames: Math.ceil(props.tl.total * FPS), props };
          }}
        />
      ))}

      <Composition
        id="data"
        component={DataEpisodeView}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={FPS}
        defaultProps={{ episode: null, tl: null, draft: true, choiceAt: null, branchTimes: null } as DataProps}
        calculateMetadata={({ props }) => dataMetadata(props)}
      />

      <Composition
        id="share"
        component={Share}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={FPS * (OUTRO + 1)}
        defaultProps={{ src: '', duration: 1, choiceAt: null, lang: 'ru' } as ShareProps}
        calculateMetadata={({ props }) => shareMetadata(props, FPS)}
      />
      <Still id="mark" component={Mark} width={W} height={H} defaultProps={{ position: 'left' as 'left' | 'right' }} />
      <Still id="plaque" component={Plaque} width={W} height={H} defaultProps={{ lang: 'ru' as ShareLang }} />
      <Composition id="outro" component={Outro} width={W} height={H} fps={FPS} durationInFrames={FPS * OUTRO} defaultProps={{ lang: 'ru' as ShareLang }} />
      <Still id="set" component={SetPreview} width={W} height={H} defaultProps={{ id: 'storozh/glass-room' } as SetPreviewProps} />
      <Still id="card" component={EpisodeCard} width={W} height={H} defaultProps={{ frame: '', title: '', n: 1, lang: 'ru' } as CardProps} />
    </>
  );
  return Root;
}
