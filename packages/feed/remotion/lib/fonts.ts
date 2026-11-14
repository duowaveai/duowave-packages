// Шрифты из файлов пакета (assets/fonts), без сети: сборка кладёт их рядом с кодом, рендер ждёт, пока они загрузятся.
// Набор и лицензии — assets/fonts/README.md.

import { cancelRender, continueRender, delayRender } from 'remotion';
import caveatCyr from '../../assets/fonts/caveat-cyrillic-wght-normal.woff2';
import caveatExt from '../../assets/fonts/caveat-latin-ext-wght-normal.woff2';
import caveatLat from '../../assets/fonts/caveat-latin-wght-normal.woff2';
import plex5Cyr from '../../assets/fonts/ibm-plex-mono-cyrillic-500-normal.woff2';
import plex7Cyr from '../../assets/fonts/ibm-plex-mono-cyrillic-700-normal.woff2';
import plex5Ext from '../../assets/fonts/ibm-plex-mono-latin-ext-500-normal.woff2';
import plex7Ext from '../../assets/fonts/ibm-plex-mono-latin-ext-700-normal.woff2';
import plex5Lat from '../../assets/fonts/ibm-plex-mono-latin-500-normal.woff2';
import plex7Lat from '../../assets/fonts/ibm-plex-mono-latin-700-normal.woff2';
import interCyr from '../../assets/fonts/inter-cyrillic-wght-normal.woff2';
import interExt from '../../assets/fonts/inter-latin-ext-wght-normal.woff2';
import interLat from '../../assets/fonts/inter-latin-wght-normal.woff2';
import montCyr from '../../assets/fonts/montserrat-cyrillic-wght-normal.woff2';
import montExt from '../../assets/fonts/montserrat-latin-ext-wght-normal.woff2';
import montLat from '../../assets/fonts/montserrat-latin-wght-normal.woff2';
import pressCyr from '../../assets/fonts/press-start-2p-cyrillic-400-normal.woff2';
import pressExt from '../../assets/fonts/press-start-2p-latin-ext-400-normal.woff2';
import pressLat from '../../assets/fonts/press-start-2p-latin-400-normal.woff2';
import ptCyr from '../../assets/fonts/pt-serif-cyrillic-700-normal.woff2';
import ptExt from '../../assets/fonts/pt-serif-latin-ext-700-normal.woff2';
import ptLat from '../../assets/fonts/pt-serif-latin-700-normal.woff2';

// Диапазоны подмножеств — как у Google Fonts.
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const CYRILLIC = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';

type Face = { family: string; weight: string; files: [lat: string, ext: string, cyr: string] };

const FACES: Face[] = [
  { family: 'Inter', weight: '100 900', files: [interLat, interExt, interCyr] },
  { family: 'Montserrat', weight: '100 900', files: [montLat, montExt, montCyr] },
  { family: 'Caveat', weight: '400 700', files: [caveatLat, caveatExt, caveatCyr] },
  { family: 'Press Start 2P', weight: '400', files: [pressLat, pressExt, pressCyr] },
  { family: 'PT Serif', weight: '700', files: [ptLat, ptExt, ptCyr] },
  { family: 'IBM Plex Mono', weight: '500', files: [plex5Lat, plex5Ext, plex5Cyr] },
  { family: 'IBM Plex Mono', weight: '700', files: [plex7Lat, plex7Ext, plex7Cyr] },
];

/** Семейства для `fontFamily`; запасные — на случай, если в тексте встретится знак, которого в файлах нет. */
export const fonts = {
  /** Заголовки, карточки, «КОНЕЦ» (Montserrat 700–900). */
  display: "'Montserrat', 'Inter', sans-serif",
  /** Субтитры, плашки, подписи (Inter 400–800). */
  ui: "'Inter', sans-serif",
  /** Рукопись: журнал, записка (Caveat). */
  hand: "'Caveat', cursive",
  /** Облик «пиксели» (Press Start 2P). */
  pixel: "'Press Start 2P', monospace",
  /** Облик «бумага» (PT Serif 700). */
  serif: "'PT Serif', serif",
  /** Облик «терминал» (IBM Plex Mono 500, 700). */
  mono: "'IBM Plex Mono', monospace",
};

let loaded = false;

/** Загрузить все шрифты один раз; рендер кадра ждёт их через delayRender. */
function loadAll() {
  if (loaded || typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  loaded = true;
  const handle = delayRender('Шрифты «Ленты» из assets/fonts', { timeoutInMilliseconds: 60000 });
  const ranges = [LATIN, LATIN_EXT, CYRILLIC];
  const all = FACES.flatMap((f) =>
    f.files.map((src, i) => {
      const face = new FontFace(f.family, `url(${src}) format('woff2')`, { weight: f.weight, style: 'normal', unicodeRange: ranges[i] });
      return face.load().then((ok) => {
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(ok);
      });
    }),
  );
  Promise.all(all)
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
}

loadAll();
