/** Pack transparent ImageGen silhouettes into a padded runtime atlas.
 * Usage: KW_ART_SHARP=<path-to-sharp> node pack-battle-art.cjs source.png output.png ids.json
 * ids.json is an array of ids in reading order. Alpha is preserved; isolated
 * silhouettes are segmented before packing so irregular neighbours cannot bleed.
 */
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.KW_ART_SHARP || 'sharp');

async function main() {
  const [source, output, idsFile] = process.argv.slice(2);
  if (!idsFile) throw new Error('Expected source.png output.png ids.json');
  const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const labels = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  const parts = [];
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] !== -1 || data[p * 4 + 3] < 96) continue;
    const id = parts.length;
    let head = 0, tail = 1;
    queue[0] = p; labels[p] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (head < tail) {
      const k = queue[head++], x = k % w, y = (k / w) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const n of [x > 0 ? k - 1 : -1, x + 1 < w ? k + 1 : -1, y > 0 ? k - w : -1, y + 1 < h ? k + w : -1]) {
        if (n >= 0 && labels[n] === -1 && data[n * 4 + 3] >= 96) { labels[n] = id; queue[tail++] = n; }
      }
    }
    parts.push({ id, area: tail, x0, y0, x1, y1 });
  }
  const major = parts.filter(p => p.area > 1000).sort((a, b) => b.area - a.area).slice(0, ids.length);
  if (major.length !== ids.length) throw new Error(`Expected ${ids.length} silhouettes, found ${major.length}`);
  // Sort into explicit rows by centre, then left-to-right (we do not assume the
  // generator observed an exact grid or equal whitespace).
  const cols = ids.length === 10 ? 5 : 3;
  major.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  for (let r = 0; r < major.length / cols; r++) {
    const row = major.slice(r * cols, (r + 1) * cols).sort((a, b) => a.x0 - b.x0);
    major.splice(r * cols, cols, ...row);
  }
  const cell = ids.length === 10 ? 384 : 512, margin = 24, sprites = [], frames = {};
  fs.mkdirSync(path.dirname(output), { recursive: true });
  for (let i = 0; i < major.length; i++) {
    const p = major[i], x0 = Math.max(0, p.x0 - 4), y0 = Math.max(0, p.y0 - 4);
    const cw = Math.min(w - x0, p.x1 - x0 + 5), ch = Math.min(h - y0, p.y1 - y0 + 5);
    const crop = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const k = (y0 + y) * w + x0 + x;
      let keep = labels[k] === p.id;
      // Retain native anti-aliased edge pixels within four pixels of this island.
      if (!keep && data[k * 4 + 3] < 96) {
        for (let oy = -4; oy <= 4 && !keep; oy++) for (let ox = -4; ox <= 4; ox++) {
          const nx = x0 + x + ox, ny = y0 + y + oy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && labels[ny * w + nx] === p.id) { keep = true; break; }
        }
      }
      if (keep) data.copy(crop, (y * cw + x) * 4, k * 4, k * 4 + 4);
    }
    const scale = Math.min((cell - margin * 2) / cw, (cell - margin * 2) / ch);
    const rw = Math.round(cw * scale), rh = Math.round(ch * scale);
    const sprite = await sharp(crop, { raw: { width: cw, height: ch, channels: 4 } }).resize(rw, rh).png().toBuffer();
    const left = (i % cols) * cell + Math.floor((cell - rw) / 2);
    const top = Math.floor(i / cols) * cell + cell - margin - rh;
    sprites.push({ input: sprite, left, top });
    frames[ids[i]] = [left, top, rw, rh];
  }
  await sharp({ create: { width: cols * cell, height: Math.ceil(ids.length / cols) * cell, channels: 4, background: '#00000000' } })
    .composite(sprites).png().toFile(output);
  const manifest = { source: path.basename(source), atlas: path.basename(output), width: cols * cell, height: Math.ceil(ids.length / cols) * cell, frames };
  fs.writeFileSync(output.replace(/\.png$/i, '.frames.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
