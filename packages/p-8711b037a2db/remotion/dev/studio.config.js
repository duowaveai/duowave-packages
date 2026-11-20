// Настройки Remotion CLI для разработки: псевдоним @feed и модули пакета — как у движка (remotion/webpack.ts).
// Запуск из папки пакета:
//   node node_modules/@remotion/cli/remotion-cli.js studio remotion/dev-entry.tsx \
//     --config remotion/dev/studio.config.js --public-dir <папка серий>
import fs from 'node:fs';
import path from 'node:path';
import { Config } from '@remotion/cli/config';

const cwd = process.cwd();
const REMOTION = fs.existsSync(path.join(cwd, 'root.tsx')) ? cwd : path.join(cwd, 'remotion');
const MODULES = path.join(path.dirname(REMOTION), 'node_modules');
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...config.resolve?.alias, '@feed': REMOTION },
    modules: [...(config.resolve?.modules ?? ['node_modules']), MODULES],
  },
}));
Config.setVideoImageFormat('jpeg');
