const fs = require('fs'), path = require('path');
const root = __dirname, game = path.resolve(root, '../..');
const out = path.join(game, 'build/web-mobile/previews/archer-combat-rebuild-v1');
fs.mkdirSync(out, { recursive: true });
for (const [source, name] of [
  ['preview.html', 'index.html'], ['archer-ready-up-left.png', 'archer-ready-up-left.png'],
  ['archer-ready-up-left-v2.png', 'archer-ready-up-left-v2.png'],
  ['archer-ready-up-left-v3.png', 'archer-ready-up-left-v3.png'], ['art.json', 'art.json'],
  ['../../assets/resources/ux/hero_comic_v1/comic_figure_archer_v1.png', 'figure-reference.png']
]) fs.copyFileSync(path.resolve(root, source), path.join(out, name));
console.log(JSON.stringify({ preview: out }));
