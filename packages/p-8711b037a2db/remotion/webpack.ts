// Сборка Remotion для «Ленты»: `@feed/…` → эта папка (remotion/), а модули (remotion, react, @remotion/*) берутся из
// node_modules пакета — даже для файлов вне пакета (код режиссёра лежит в папке приложения:
// <files>/episodes/<id>/code/Episode.tsx).
//
//   import { bundle } from '@remotion/bundler';
//   import { webpackOverride } from '<пакет>/remotion/webpack.ts';
//   await bundle({ entryPoint, publicDir: '<files>/episodes', webpackOverride });
//
// Remotion сам привязывает react, react-dom и remotion к своей копии; здесь — только псевдоним и место модулей.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Config = {
  resolve?: { alias?: Record<string, unknown>; modules?: string[]; [k: string]: unknown };
  [k: string]: unknown;
};

export const REMOTION_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_DIR = path.dirname(REMOTION_DIR);
export const NODE_MODULES = path.join(PACKAGE_DIR, 'node_modules');

export function webpackOverride<T extends Config>(config: T): T {
  const resolve = config.resolve ?? {};
  return {
    ...config,
    resolve: {
      ...resolve,
      alias: { ...resolve.alias, '@feed': REMOTION_DIR },
      modules: [...(resolve.modules ?? ['node_modules']), NODE_MODULES],
    },
  };
}
