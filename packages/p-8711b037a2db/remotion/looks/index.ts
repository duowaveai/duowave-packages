// Шесть обликов. Облик — это как нарисовано, а не что: одна и та же сцена-хук (scene.ts) в шести материалах.
// Для каждого облика здесь: название, сцена-хук (`Scene` — мир с состоянием, `Hook` — образец для знакомства,
// композиция look-<id>), краски и то, как в этом облике выглядит рамка серии данными: плашка, субтитры, карточки.

import type React from 'react';
import { fonts, type SubStyle } from '../lib/kit';
import { ASCII_PALETTE, AsciiHook, AsciiScene } from './ascii';
import { GLASS_PALETTE, GlassHook, GlassScene } from './glass';
import { INK_PALETTE, InkHook, InkScene } from './ink';
import { PAPERCUT_PALETTE, PapercutHook, PapercutScene } from './papercut';
import { PIXEL_PALETTE, PixelHook, PixelScene } from './pixel';
import { RISO_PALETTE, RisoHook, RisoScene } from './riso';
import type { HookState } from './scene';

import { LOOK_IDS, LOOK_INFO, type LookId } from './info';

export { LOOK_IDS, LOOK_INFO, type LookId };

export type LookDef = {
  /** Как облик называется у людей (reference/looks.md). */
  title: string;
  /** Что это и кому идёт — одной строкой. */
  about: string;
  /** Образец для знакомства: сцена-хук с плашкой и репликой (композиция look-<id>, 6 с). */
  Hook: React.FC;
  /** Сцена-хук как мир с состоянием (декорация `look/<id>-window`). */
  Scene: React.FC<HookState>;
  /** Краски облика — их берут декорации, нарисованные в этом облике. */
  palette: Record<string, string>;
  /** Рамка серии: фон, текст, акцент, цвета карточек ① и ② (не зелёный), затемнение под карточками, тревога. */
  ui: { bg: string; ink: string; accent: string; a: string; b: string; shade: string; cardBg: string; cardInk: string; alarm: string };
  /** Плашка ресурса вверху слева. */
  hud: { bg: string; ink: string; accent: string; font: string; border?: string; dot: boolean };
  /** Субтитры. */
  sub: SubStyle;
  /** Зерно плёнки поверх кадра (0 — без). */
  grain: number;
  /** Шрифт заголовков рамки (вопрос развилки, «КОНЕЦ»). */
  display: string;
};

export const LOOKS: Record<LookId, LookDef> = {
  ink: {
    ...LOOK_INFO.ink,
    Hook: InkHook,
    Scene: InkScene,
    palette: INK_PALETTE,
    ui: { bg: INK_PALETTE.paper, ink: INK_PALETTE.ink, accent: INK_PALETTE.red, a: '#d2463a', b: '#d8cdb6', shade: 'rgba(27,26,24,.88)', cardBg: INK_PALETTE.paper, cardInk: INK_PALETTE.paper, alarm: '#d2463a' },
    hud: { bg: 'rgba(242,236,222,.86)', ink: INK_PALETTE.ink, accent: INK_PALETTE.red, font: fonts.display, dot: false },
    sub: {},
    grain: 0.03,
    display: fonts.display,
  },
  riso: {
    ...LOOK_INFO.riso,
    Hook: RisoHook,
    Scene: RisoScene,
    palette: RISO_PALETTE,
    ui: { bg: RISO_PALETTE.paper, ink: RISO_PALETTE.paper, accent: RISO_PALETTE.red, a: RISO_PALETTE.red, b: '#a9bde8', shade: 'rgba(37,48,82,.9)', cardBg: RISO_PALETTE.paper, cardInk: RISO_PALETTE.paper, alarm: RISO_PALETTE.red },
    hud: { bg: '#2a3a62', ink: RISO_PALETTE.paper, accent: '#ff9a93', font: fonts.display, dot: false },
    sub: {},
    grain: 0.03,
    display: fonts.display,
  },
  pixel: {
    ...LOOK_INFO.pixel,
    Hook: PixelHook,
    Scene: PixelScene,
    palette: PIXEL_PALETTE,
    ui: { bg: PIXEL_PALETTE.black, ink: PIXEL_PALETTE.white, accent: PIXEL_PALETTE.gold, a: PIXEL_PALETTE.amber, b: PIXEL_PALETTE.haze, shade: 'rgba(11,10,20,.9)', cardBg: PIXEL_PALETTE.night, cardInk: PIXEL_PALETTE.white, alarm: '#e83b3b' },
    hud: { bg: PIXEL_PALETTE.black, ink: PIXEL_PALETTE.white, accent: PIXEL_PALETTE.amber, font: fonts.pixel, border: `6px solid ${PIXEL_PALETTE.white}`, dot: false },
    sub: {
      font: fonts.pixel, weight: 400, size: 44, color: PIXEL_PALETTE.white, shadow: 'none',
      box: { background: PIXEL_PALETTE.black, border: `6px solid ${PIXEL_PALETTE.white}`, padding: '30px 34px 26px', lineHeight: 1.4, letterSpacing: 0 },
    },
    grain: 0,
    display: fonts.pixel,
  },
  papercut: {
    ...LOOK_INFO.papercut,
    Hook: PapercutHook,
    Scene: PapercutScene,
    palette: PAPERCUT_PALETTE,
    ui: { bg: PAPERCUT_PALETTE.sky, ink: PAPERCUT_PALETTE.cream, accent: PAPERCUT_PALETTE.gold, a: PAPERCUT_PALETTE.red, b: PAPERCUT_PALETTE.gold, shade: 'rgba(20,27,54,.9)', cardBg: PAPERCUT_PALETTE.sky, cardInk: PAPERCUT_PALETTE.cream, alarm: PAPERCUT_PALETTE.red },
    hud: { bg: PAPERCUT_PALETTE.near, ink: PAPERCUT_PALETTE.cream, accent: PAPERCUT_PALETTE.gold, font: fonts.display, dot: false },
    sub: {
      font: fonts.serif, weight: 700, size: 72, color: PAPERCUT_PALETTE.cream, shadow: 'none',
      box: { background: PAPERCUT_PALETTE.redD, padding: '26px 76px 30px', clipPath: 'polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%)', filter: 'drop-shadow(7px 10px 7px rgba(3,4,12,.6))' },
    },
    grain: 0.02,
    display: fonts.serif,
  },
  glass: {
    ...LOOK_INFO.glass,
    Hook: GlassHook,
    Scene: GlassScene,
    palette: GLASS_PALETTE,
    ui: { bg: GLASS_PALETTE.stone, ink: GLASS_PALETTE.cream, accent: GLASS_PALETTE.amber, a: GLASS_PALETTE.amber, b: GLASS_PALETTE.cobalt, shade: 'rgba(8,7,10,.86)', cardBg: GLASS_PALETTE.stone, cardInk: GLASS_PALETTE.cream, alarm: '#ff3d4f' },
    hud: { bg: 'rgba(8,7,10,.62)', ink: GLASS_PALETTE.cream, accent: GLASS_PALETTE.amber, font: fonts.display, dot: true },
    sub: {},
    grain: 0.05,
    display: fonts.display,
  },
  ascii: {
    ...LOOK_INFO.ascii,
    Hook: AsciiHook,
    Scene: AsciiScene,
    palette: ASCII_PALETTE,
    ui: { bg: ASCII_PALETTE.bg, ink: ASCII_PALETTE.amber, accent: ASCII_PALETTE.ice, a: ASCII_PALETTE.amber, b: ASCII_PALETTE.ice, shade: 'rgba(13,8,3,.92)', cardBg: ASCII_PALETTE.bg, cardInk: ASCII_PALETTE.amber, alarm: '#ff5a3c' },
    hud: { bg: ASCII_PALETTE.amber, ink: ASCII_PALETTE.bg, accent: ASCII_PALETTE.bg, font: fonts.mono, dot: false },
    sub: {
      font: fonts.mono, weight: 700, size: 60, color: ASCII_PALETTE.amber, shadow: '0 0 14px rgba(255,150,0,.8)',
      box: { background: ASCII_PALETTE.bg, borderTop: '3px dashed rgba(255,176,0,.45)', padding: '22px 26px' },
    },
    grain: 0,
    display: fonts.mono,
  },
};
