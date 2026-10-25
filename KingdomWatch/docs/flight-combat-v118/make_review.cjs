/* Existing atlas/background compositing only. This is isolated review, not gameplay. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { context, project, sha, dependency, relative } = require('./check_geometry.cjs');
const sharp = dependency('sharp', [process.env.KW_SHARP,
  'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'].filter(Boolean));
const ATLAS = 'assets/resources/ux/forest_mob_walk_v87.png';
const FRAMES = 'assets/resources/ux/forest_mob_walk_v87.frames.json';
const SCENE = 'assets/resources/scenes/scene_1_2.jpg';
const IDS = ['forest_eagle', 'forest_bat'];
const SNAPSHOT_CLOCK = .25;
const rgba = (width, height, background = '#131c18') => sharp({ create: { width, height, channels: 4, background } });
const text = (x, y, value, size = 18, color = '#f6edd3', anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${value}</text>`;
const svg = (width, height, content) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`);
async function main() {
  const c = context(), manifest = JSON.parse(c.read(FRAMES));
  const defs = Object.fromEntries(IDS.map(id => [id, c.mob(id)]));
  const atlasInput = fs.readFileSync(path.join(project, ATLAS));
  const sceneInput = fs.readFileSync(path.join(project, SCENE));
  const scene = await sharp(sceneInput).resize(750, 1334, { fit: 'cover' }).png().toBuffer();
  const spriteCache = new Map(), backgroundCache = new Map();
  function sample(id, clock, current) {
    const def = defs[id], count = Object.keys(manifest.frames).filter(key => new RegExp('^' + id + '_w\\d+$').test(key)).length;
    const tempo = Math.min(1.25, Math.max(.75, def.speed / manifest.walkSpeeds[id]));
    const frame = Math.floor(clock * tempo / manifest.cycles[id] * count) % count;
    const frameName = id + '_w' + frame, rect = manifest.frames[frameName];
    assert(rect, frameName);
    const height = def.radius * c.MOB_ART_HEIGHT;
    const lift = current ? c.flight.flightLiftFor(true, id, def.radius, clock) : 0;
    const actor = { y: 0, def, artHeight: height, groundOffset: manifest.ground[id].offset, flightLift: lift };
    return { id, def, count, frameName, rect, height, groundOffset: actor.groundOffset, lift,
      artBaseY: c.getters.artBaseY.call(actor), groundY: c.getters.groundY.call(actor) };
  }
  async function sprite(item, zoom) {
    const key = item.frameName + ':' + zoom;
    if (!spriteCache.has(key)) {
      const [left, top, width, height] = item.rect;
      const h = Math.round(item.height * zoom), w = Math.round(item.height * width / height * zoom);
      spriteCache.set(key, { width: w, height: h, buffer: await sharp(atlasInput).extract({ left, top, width, height }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer() });
    }
    return spriteCache.get(key);
  }
  async function clippedOverlay(buffer, width, height, left, top, panelWidth, panelHeight) {
    const x = Math.max(0, -left), y = Math.max(0, -top);
    const w = Math.min(width - x, panelWidth - Math.max(0, left)), h = Math.min(height - y, panelHeight - Math.max(0, top));
    if (w <= 0 || h <= 0) return null;
    if (x || y || w !== width || h !== height) buffer = await sharp(buffer).extract({ left: x, top: y, width: w, height: h }).png().toBuffer();
    return { input: buffer, left: Math.max(0, left), top: Math.max(0, top) };
  }
  async function panel(width, height, zoom, clock, current, showGuides) {
    const worldWidth = width / zoom, worldHeight = height / zoom, rootScreenY = worldHeight - 36;
    const backgroundKey = [width, height, zoom].join(':');
    if (!backgroundCache.has(backgroundKey)) {
      const w = Math.ceil(worldWidth), h = Math.ceil(worldHeight);
      backgroundCache.set(backgroundKey, await sharp(scene).extract({ left: Math.floor((750 - w) / 2), top: 610, width: w, height: h }).resize(width, height).png().toBuffer());
    }
    const overlays = [], items = IDS.map((id, i) => ({ ...sample(id, clock, current), x: worldWidth * (i ? .70 : .30) }));
    let shadows = '', annotations = '';
    for (const item of items) {
      const radius = item.def.radius;
      const projection = current ? c.flight.FLIGHT_SHADOW : { width: 1.02, height: .20, alpha: 38 };
      const cx = item.x * zoom, cy = (rootScreenY - item.groundY) * zoom;
      shadows += `<ellipse cx="${cx}" cy="${cy}" rx="${radius * projection.width * zoom}" ry="${radius * projection.height * zoom}" fill="rgb(30,24,16)" fill-opacity="${projection.alpha / 255}"/>`;
      if (showGuides) {
        annotations += `<path d="M${cx - 12} ${cy}h24" stroke="#f1d18a" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>`;
        annotations += text(cx, height - 19, (item.id === 'forest_eagle' ? 'EAGLE' : 'BAT') + (current ? ` / +${item.lift.toFixed(1)}px` : ' / zero lift'), 17, '#fff3cb', 'middle');
      }
      const art = await sprite(item, zoom);
      const placed = await clippedOverlay(art.buffer, art.width, art.height,
        Math.round(item.x * zoom - art.width / 2), Math.round((rootScreenY - item.artBaseY - item.height) * zoom), width, height);
      if (placed) overlays.push(placed);
    }
    return sharp(backgroundCache.get(backgroundKey)).composite([
      { input: svg(width, height, shadows), left: 0, top: 0 }, ...overlays,
      ...(annotations ? [{ input: svg(width, height, annotations), left: 0, top: 0 }] : [])
    ]).png().toBuffer();
  }
  const sheetWidth = 1500, sheetHeight = 1042;
  const panels = await Promise.all([
    panel(750, 300, 1, SNAPSHOT_CLOCK, false, true), panel(750, 300, 1, SNAPSHOT_CLOCK, true, true),
    panel(750, 500, 3, SNAPSHOT_CLOCK, false, true), panel(750, 500, 3, SNAPSHOT_CLOCK, true, true)
  ]);
  const labels = text(24, 33, 'FLIGHT PRESENTATION / EXISTING FOREST ART', 26)
    + text(24, 59, 'ISOLATED ATLAS COMPOSITE — NOT GAMEPLAY, NO ENGINE / BROWSER / COMBAT', 16, '#b9c9b9')
    + text(24, 98, 'ORIGINAL / zero-lift reconstruction', 22)
    + text(774, 98, 'CURRENT / raised body + ground-projected shadow', 22)
    + text(24, 134, '1× DESIGN SCALE / SAME CEL, SAME FOOTPRINT / t = 0.25s', 17)
    + text(24, 468, '3× ZOOM / BOTH BIRDS: radius 18 → art canvas 69.3px; dotted ticks identify the ground projection', 17)
    + text(24, 1005, 'Eagle ground offset 0.050000 / Bat 0.039931. Transparent canvas headroom is preserved.', 17)
    + text(24, 1030, 'Original is a presentation reconstruction, not an old gameplay screenshot. Same atlas pixels; no new character art.', 16, '#b9c9b9')
    + '<path d="M750 72V978" stroke="#131c18" stroke-width="4"/>';
  const sheetPath = path.join(__dirname, 'review-contact-sheet.png');
  await rgba(sheetWidth, sheetHeight).composite([
    { input: panels[0], left: 0, top: 144 }, { input: panels[1], left: 750, top: 144 },
    { input: panels[2], left: 0, top: 478 }, { input: panels[3], left: 750, top: 478 },
    { input: svg(sheetWidth, sheetHeight, labels), left: 0, top: 0 }
  ]).png().toFile(sheetPath);
  const gifWidth = 960, gifHeight = 344, count = 72, rawFrames = [], delays = [];
  for (let i = 0; i < count; i++) {
    const clock = i / 24;
    const [original, current] = await Promise.all([panel(480, 280, 2, clock, false, false), panel(480, 280, 2, clock, true, false)]);
    const caption = text(16, 26, 'ORIGINAL / 2×', 18) + text(496, 26, 'CURRENT / 2×', 18)
      + text(16, 333, `Isolated atlas sample / t=${clock.toFixed(2)}s / nonseamless 3-second loop / not gameplay`, 15, '#b9c9b9')
      + '<path d="M480 38V318" stroke="#131c18" stroke-width="3"/>';
    rawFrames.push(await rgba(gifWidth, gifHeight).composite([
      { input: original, left: 0, top: 38 }, { input: current, left: 480, top: 38 },
      { input: svg(gifWidth, gifHeight, caption), left: 0, top: 0 }
    ]).raw().toBuffer());
    delays.push(i % 6 === 5 ? 50 : 40); // GIF centisecond quantization averages exactly 24fps.
  }
  const gifPath = path.join(__dirname, 'review-animation.gif');
  await sharp(Buffer.concat(rawFrames), { raw: { width: gifWidth, height: gifHeight * count, channels: 4, pageHeight: gifHeight } })
    .gif({ delay: delays, loop: 0, effort: 3, colours: 128, dither: 0 }).toFile(gifPath);
  const metadata = await sharp(gifPath, { animated: true }).metadata();
  assert.equal(metadata.pages, count); assert.equal(metadata.pageHeight, gifHeight);
  assert.deepEqual(metadata.delay, delays);
  const reportPath = path.join(__dirname, 'geometry-check.json');
  assert(fs.existsSync(reportPath), 'Run check_geometry.cjs first');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const sources = Object.fromEntries([...c.texts].map(([file, source]) => [file, sha(source)]));
  Object.assign(sources, { [ATLAS]: sha(atlasInput), [SCENE]: sha(sceneInput),
    [relative(__filename)]: sha(fs.readFileSync(__filename)) });
  report.visualReview = { generatedAt: new Date().toISOString(), isolatedReview: true, gameplay: false,
    sourceSnapshotChangedDuringRender: [...c.texts].filter(([file, source]) => sha(fs.readFileSync(path.join(project, file))) !== sha(source)).map(([file]) => file),
    sourceHashes: sources, outputs: [sheetPath, gifPath].map(file => ({ file: relative(file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) })),
    sheet: { width: sheetWidth, height: sheetHeight, snapshotClock: SNAPSHOT_CLOCK, zooms: [1, 3],
      actors: IDS.map(id => { const item = sample(id, SNAPSHOT_CLOCK, true); return { id, radius: item.def.radius,
        artHeight: item.height, groundOffset: item.groundOffset, frame: item.frameName, sourceRect: item.rect,
        lift: item.lift, artBaseY: item.artBaseY, shadowGroundY: item.groundY }; }) },
    gif: { width: gifWidth, height: gifHeight, frames: count, durationMilliseconds: delays.reduce((a, b) => a + b, 0),
      averageFps: 24, zoom: 2, encodedFrameDelaysVerified: true, usesSourceCyclesAndFrameOrder: true, seamlessLoop: false },
    background: { file: SCENE, coverResize: [750, 1334], cropTop: 610, centerCrop: true },
    limitations: ['Sharp atlas compositing, not gameplay rendering or visual acceptance.',
      'Original is reconstructed using zero added lift and the previous ground-shadow geometry; no old engine screenshot.',
      '1x preserves design scale; 2x/3x enlarge the complete geometry for inspection. Raster placement rounds to the nearest pixel.',
      'No shaders, damage, combat, gameplay movement, device layout, depth occlusion or click interaction execute.',
      'GIF is a nonseamless three-second sample; source wing loops and hover are sampled at their real clocks.'] };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contactSheet: relative(sheetPath), gif: relative(gifPath), frames: count,
    isolatedReview: true, gameplay: false, metadataSavedIn: relative(reportPath) }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
