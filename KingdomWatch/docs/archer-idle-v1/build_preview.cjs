const fs = require('fs'), path = require('path');
const root = __dirname, game = path.resolve(root, '../..');
const out = path.join(game, 'build/web-mobile/previews/archer-idle-v1');
fs.mkdirSync(out, { recursive: true });
for (const [source, name] of [['preview.html', 'index.html'],
  ['../../assets/resources/ux/archer_idle_v1/idle.png', 'idle.png'],
  ['../../assets/resources/ux/archer_idle_v1/idle.frames.json', 'idle.frames.json'],
  ['../../assets/resources/ux/archer_attack_v1/attack.png', 'attack.png'],
  ['../../assets/resources/ux/archer_attack_v1/attack.frames.json', 'attack.frames.json']]) {
  fs.copyFileSync(path.resolve(root, source), path.join(out, name));
}
console.log(JSON.stringify({ preview: out }));
