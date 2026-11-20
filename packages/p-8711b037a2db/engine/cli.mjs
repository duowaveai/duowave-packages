// Разработчику «Ленты» — то же, что делает программа, из терминала (папка приложения — DUOWAVE_APP_FILES):
//
//   node engine/cli.mjs import <папка series-feed>   серии эксперимента в ленту, без трат
//   node engine/cli.mjs sounds <папка серии>         базовый набор звуков серии
//   node engine/cli.mjs check <ролик.mp4>            автопроверка ролика
//   node engine/cli.mjs status                       что в ленте
//   node engine/cli.mjs render <id>                  отрендерить серию из её файлов (без модели и голоса)
//   node engine/cli.mjs share <id>                   копия для отправки и карточка

import { renderPrepared } from './build.mjs';
import { check } from './checks.mjs';
import { shareCard, shareCopy } from './share.mjs';
import { findEpisode } from './state.mjs';
import { importSeriesFeed } from './importer.mjs';
import { baseSounds } from './sound.mjs';
import { load, taste } from './state.mjs';

const [command, arg] = process.argv.slice(2);

if (command === 'import' && arg) {
    console.log(await importSeriesFeed(arg));
} else if (command === 'sounds' && arg) {
    console.log(baseSounds(arg));
} else if (command === 'check' && arg) {
    console.log(JSON.stringify(await check(arg), null, 1));
} else if (command === 'render' && arg) {
    console.log(JSON.stringify(await renderPrepared(arg, { progress: (share, text) => process.stderr.write(`\r${Math.round(share * 100)}% ${text ?? ''}   `) }), null, 1));
} else if (command === 'share' && arg) {
    const started = Date.now();
    const file = await shareCopy(findEpisode(load(), arg), { progress: (share) => process.stderr.write(`\r${Math.round(share * 100)}%   `) });
    console.log(JSON.stringify({ file, seconds: (Date.now() - started) / 1000, card: await shareCard(findEpisode(load(), arg)) }));
} else if (command === 'status') {
    const state = load();
    console.log(`сериалов ${state.series.length}, серий ${state.episodes.length}, режим ${state.mode}, голос ${state.voice.id}`);
    for (const episode of state.episodes) console.log(`  ${episode.id} «${episode.title}» ${episode.n}${episode.chosen ? ` · выбран ${episode.chosen}` : ''}${episode.rating ? ` · ${episode.rating}` : ''}`);
    console.log(taste(state).join('\n'));
} else {
    console.log('node engine/cli.mjs import <series-feed> | sounds <папка серии> | check <ролик> | status');
}
