// Точка входа для разработки: все композиции пакета и 14 серий теста из examples/ как серии режиссёра.
// Движок пишет свою точку входа (см. root.tsx); эта — для Studio и ручной проверки:
//   node node_modules/@remotion/cli/remotion-cli.js studio remotion/dev-entry.tsx --config remotion/dev/studio.config.js --public-dir <папка серий>
import { registerRoot } from 'remotion';
import * as k1 from './examples/kompas-01/Episode';
import * as k2 from './examples/kompas-02/Episode';
import * as k3 from './examples/kompas-03/Episode';
import * as k4 from './examples/kompas-04/Episode';
import * as k5 from './examples/kompas-05/Episode';
import * as k6 from './examples/kompas-06/Episode';
import * as k7 from './examples/kompas-07/Episode';
import * as s1 from './examples/storozh-01/Episode';
import * as s2 from './examples/storozh-02/Episode';
import * as s3 from './examples/storozh-03/Episode';
import * as s4 from './examples/storozh-04/Episode';
import * as s5 from './examples/storozh-05/Episode';
import * as s6 from './examples/storozh-06/Episode';
import * as s7 from './examples/storozh-07/Episode';
import { makeRoot } from './root';

registerRoot(makeRoot([s1, s2, s3, s4, s5, s6, s7, k1, k2, k3, k4, k5, k6, k7]));
