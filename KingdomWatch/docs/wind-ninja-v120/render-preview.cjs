/** Engine-free VFX contact sheet. Loads ONLY geometry/config and the isolated drawing module.
 * Run: node docs/wind-ninja-v120/render-preview.cjs
 * Requires a local TypeScript compiler and Python + Pillow for PNG; --svg-only needs only Node/TS.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');

function loadTypeScript() {
  for (const name of [process.env.WIND_NINJA_TYPESCRIPT, 'typescript',
    'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js']) {
    if (!name) continue;
    try { return require(name); } catch (_) { /* Try the next installed compiler. */ }
  }
  throw Error('Set WIND_NINJA_TYPESCRIPT to a local typescript.js; no package install or engine is required.');
}
function loadIsolated(relative, imports = {}) {
  const ts = loadTypeScript(), filename = path.join(ROOT, relative);
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  if ((result.diagnostics || []).length) throw Error('Transpile diagnostics in ' + relative);
  const context = { exports: {}, Math, Number, Map, Set,
    require(name) {
      if (!Object.hasOwnProperty.call(imports, name)) throw Error('Isolated check refused import: ' + name);
      return imports[name];
    } };
  vm.runInNewContext(result.outputText, context, { filename });
  return context.exports;
}
class Color {
  constructor() { this.r = this.g = this.b = this.a = 255; }
  static fromHEX(c, hex) {
    c.r = parseInt(hex.slice(1, 3), 16); c.g = parseInt(hex.slice(3, 5), 16); c.b = parseInt(hex.slice(5, 7), 16); return c;
  }
}
class RecordingGraphics {
  constructor() { this.commands = []; this.current = []; this.lineWidth = 1; }
  set fillColor(c) { this.fc = [c.r, c.g, c.b, c.a]; }
  set strokeColor(c) { this.sc = [c.r, c.g, c.b, c.a]; }
  moveTo(x, y) { this.current = [[x, y]]; }
  lineTo(x, y) { this.current.push([x, y]); }
  bezierCurveTo(a, b, c, d, x, y) {
    const start = this.current[this.current.length - 1];
    for (let i = 1; i <= 20; i++) {
      const t = i / 20, u = 1 - t;
      this.current.push([u ** 3 * start[0] + 3 * u * u * t * a + 3 * u * t * t * c + t ** 3 * x,
        u ** 3 * start[1] + 3 * u * u * t * b + 3 * u * t * t * d + t ** 3 * y]);
    }
  }
  ellipse(x, y, rx, ry) {
    this.current = Array.from({ length: 49 }, (_, i) =>
      [x + Math.cos(i / 48 * Math.PI * 2) * rx, y + Math.sin(i / 48 * Math.PI * 2) * ry]);
  }
  circle(x, y, r) { this.ellipse(x, y, r, r); }
  close() { if (this.current.length) this.current.push(this.current[0]); }
  fill() { this.record('fill', this.fc); }
  stroke() { this.record('stroke', this.sc); }
  record(kind, color) {
    if (!color || !color.every(Number.isFinite) || this.current.some(p => p.some(n => !Number.isFinite(n))))
      throw Error('Nonfinite Graphics command');
    this.commands.push({ kind, color: [...color], width: this.lineWidth, points: this.current.map(p => [...p]) });
  }
  clear() { this.commands.length = this.current.length = 0; }
}
class DrawingNode {
  constructor() { this.isValid = true; }
  setParent(parent) { this.parent = parent; }
  addComponent(C) { return new C(); }
  destroy() { this.isValid = false; }
}
const DRAWING_CC = { Color, Graphics: RecordingGraphics, Node: DrawingNode, Layers: { Enum: { UI_2D: 1 } } };
function loadDrawing() { return loadIsolated('assets/scripts/battle/WindNinjaVFX.ts', { cc: DRAWING_CC }); }
function loadGeometry() { return loadIsolated('assets/scripts/battle/WindNinjaGeometry.ts'); }
function loadConfig() { return loadIsolated('assets/scripts/config/WindNinjaConfig.ts'); }
function paint(g, hex, alpha, fill = false, width = 1) {
  const c = Color.fromHEX(new Color(), hex); c.a = Math.round(255 * alpha);
  if (fill) g.fillColor = c; else { g.strokeColor = c; g.lineWidth = width; }
}
function line(g, a, b, hex = '#D1ECE3', alpha = .5, width = 1) {
  paint(g, hex, alpha, false, width); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
}
/** Neutral reference silhouettes are drawing coordinates, never Monster instances. */
function body(g, x, y, air = false) {
  paint(g, '#303B3B', .16, true); g.ellipse(x, y - (air ? 38 : 27), 24, 7); g.fill();
  paint(g, '#6A6962', .6, true); g.ellipse(x, y + 2, 15, 22); g.fill();
  paint(g, '#D2C5A1', .9, false, 1.2); g.ellipse(x, y + 2, 15, 22); g.stroke();
  paint(g, '#EDE2BE', .7, true); g.circle(x, y + 26, 8); g.fill();
  if (air) for (const side of [-1, 1]) {
    paint(g, '#C9D3C8', .42, true);
    g.moveTo(x + side * 10, y + 8); g.lineTo(x + side * 38, y + 21); g.lineTo(x + side * 24, y - 4); g.close(); g.fill();
  }
  paint(g, '#FFF1BF', .9, true); g.circle(x, y, 2.4); g.fill();
}
function makePreview(age = 1.3) {
  const drawing = loadDrawing(), geo = loadGeometry(), { WIND, NINJA } = loadConfig();
  const g = new RecordingGraphics(), commands = [];
  const append = () => { commands.push(...g.commands); g.clear(); };
  const labels = [
    ['WIND / FIXED WIND EYE', '4s / 0.5s ticks / body-space pull'],
    ['WIND / SEEKING TORNADO', '5s / 82 px per second / 0.4s ticks'],
    ['NINJA / STATIONARY SPIRAL', '4s / 0.25s ticks / real area contacts'],
    ['HAND RELEASE / WIND CRESCENT', 'Horizontal silhouette / pierce 2 / retain 80%'],
    ['ATTACHED METAL / ONE PER LIFE', 'Body anchor / pool-safe life ID / max 80'],
    ['RECALL / EXACT LAUNCH ENDPOINT', 'Source + route contacts / no automatic return'],
  ].map(([title, subtitle], i) => ({ title, subtitle, x: i % 3 * 400 + 22, y: Math.floor(i / 3) * 500 + 22 }));
  const notes = [
    { x: 22, y: 456, text: 'Fixed center; ground and flying bodies share hitY.' },
    { x: 422, y: 456, text: 'Independent funnel position; steering never teleports.' },
    { x: 822, y: 456, text: 'Enemies entering later take the next scheduled tick.' },
    { x: 22, y: 956, text: 'Three sampled positions on one predicted flight.' },
    { x: 422, y: 956, text: 'Cyan halo = waiting for an available projectile slot.' },
    { x: 822, y: 956, text: 'Three sampled positions; yellow ring = original hand.' },
  ];
  for (const [kind, x, radius, duration] of [
    ['eye', 200, WIND.eyeRadius, WIND.eyeDuration],
    ['tornado', 600, WIND.tornadoRadius, WIND.tornadoDuration],
    ['spiral', 1000, NINJA.ultRadius, NINJA.ultDuration],
  ]) {
    body(g, x - 31, 749); body(g, x + 40, 779, true); append();
    const batch = new drawing.WindNinjaVFX(new DrawingNode()); batch.begin();
    batch.area({ kind, x, y: 752, radius, age, duration }); batch.end(); commands.push(...batch.g.commands);
  }
  const hand = { x: 65, y: 149 }, target = { x: 316, y: 350 };
  const aim = geo.interceptDirection(hand.x, hand.y, target.x, target.y, 36, WIND.bladeSpeed);
  body(g, target.x, target.y); line(g, hand, { x: aim.impactX, y: aim.impactY }, '#B9D6C5', .48, 1);
  paint(g, '#FFF1BF', .9, false, 2); g.circle(hand.x, hand.y, 8); g.stroke();
  for (const fraction of [.2, .48, .76]) drawing.drawWindBlade(g,
    hand.x + aim.dirX * WIND.bladeSpeed * aim.flightTime * fraction,
    hand.y + aim.dirY * WIND.bladeSpeed * aim.flightTime * fraction,
    aim.dirX * WIND.bladeSpeed, aim.dirY * WIND.bladeSpeed, 10, aim.flightTime * fraction);
  append();
  const embedded = new drawing.WindNinjaVFX(new DrawingNode()); embedded.begin();
  for (const [i, x, y, air] of [[0, 482, 277, false], [1, 579, 316, true], [2, 683, 267, false]]) {
    body(g, x, y, air); embedded.mark(x + 6, y + 6, .7 + i * .9, i === 2);
  }
  append(); embedded.end(); commands.push(...embedded.g.commands);
  const from = { x: 1100, y: 365 }, endpoint = { x: 867, y: 135 };
  const route = geo.finiteReturnPath(from.x, from.y, endpoint.x, endpoint.y, NINJA.recallSpeed);
  body(g, from.x, from.y); body(g, 1013, 279); append();
  for (let i = 0; i < 18; i += 2) {
    const a = i / 18, b = (i + 1) / 18;
    line(g, { x: from.x + route.dirX * route.distance * a, y: from.y + route.dirY * route.distance * a },
      { x: from.x + route.dirX * route.distance * b, y: from.y + route.dirY * route.distance * b }, '#C7E9E7', .7, 1.4);
  }
  paint(g, '#FFF1BF', 1, false, 2); g.circle(endpoint.x, endpoint.y, 10); g.stroke();
  for (const t of [.22, .53, .82]) drawing.drawShuriken(g,
    from.x + route.dirX * route.distance * t, from.y + route.dirY * route.distance * t,
    route.dirX * NINJA.recallSpeed, route.dirY * NINJA.recallSpeed, 7, t * route.distance / NINJA.recallSpeed);
  append();
  return { width: 1200, height: 1000, age, commands, labels, notes };
}
function xml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])); }
function svg(preview) {
  const rows = [`<svg xmlns="http://www.w3.org/2000/svg" width="${preview.width}" height="${preview.height}" viewBox="0 0 ${preview.width} ${preview.height}">`,
    '<rect width="1200" height="1000" fill="#A99D80"/>'];
  for (let i = 0; i < 6; i++) rows.push(`<rect x="${i % 3 * 400 + 10}" y="${Math.floor(i / 3) * 500 + 10}" width="380" height="480" rx="10" fill="#B4A88A" fill-opacity=".4" stroke="#857F6B"/>`);
  for (const c of preview.commands) {
    if (!c.points.length) continue;
    const points = c.points.map(([x, y]) => x.toFixed(2) + ',' + (preview.height - y).toFixed(2)).join(' ');
    const rgb = `rgb(${c.color.slice(0, 3).join(',')})`, alpha = (c.color[3] / 255).toFixed(3);
    rows.push(c.kind === 'fill' ? `<polygon points="${points}" fill="${rgb}" fill-opacity="${alpha}"/>`
      : `<polyline points="${points}" fill="none" stroke="${rgb}" stroke-opacity="${alpha}" stroke-width="${c.width.toFixed(2)}" stroke-linejoin="round"/>`);
  }
  for (const label of preview.labels) {
    rows.push(`<text x="${label.x}" y="${label.y + 15}" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#263E40">${xml(label.title)}</text>`);
    rows.push(`<text x="${label.x}" y="${label.y + 37}" font-family="Arial,sans-serif" font-size="11" fill="#354A47">${xml(label.subtitle)}</text>`);
  }
  for (const n of preview.notes) rows.push(`<text x="${n.x}" y="${n.y}" font-family="Arial,sans-serif" font-size="10" fill="#354A47">${xml(n.text)}</text>`);
  rows.push('</svg>'); return rows.join('\n');
}
const PILLOW_RENDER = String.raw`
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
a=json.load(open(sys.argv[1],encoding='utf8')); s=2
im=Image.new('RGB',(a['width']*s,a['height']*s),'#A99D80'); d=ImageDraw.Draw(im,'RGBA')
for i in range(6):
    x=i%3*400+10; y=i//3*500+10
    d.rounded_rectangle((x*s,y*s,(x+380)*s,(y+480)*s),radius=10*s,fill=(180,168,138,100),outline=(133,127,107,255),width=s)
for c in a['commands']:
    points=[(round(x*s),round((a['height']-y)*s)) for x,y in c['points']]
    if len(points)<2: continue
    if c['kind']=='fill': d.polygon(points,fill=tuple(c['color']))
    else: d.line(points,fill=tuple(c['color']),width=max(1,round(c['width']*s)),joint='curve')
fonts=[r'C:/Windows/Fonts/arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
fp=next((p for p in fonts if os.path.exists(p)),None)
def font(size): return ImageFont.truetype(fp,size*s) if fp else ImageFont.load_default()
for l in a['labels']:
    d.text((l['x']*s,l['y']*s),l['title'],font=font(16),fill=(38,62,64,255))
    d.text((l['x']*s,(l['y']+25)*s),l['subtitle'],font=font(11),fill=(53,74,71,255))
for n in a['notes']: d.text((n['x']*s,(n['y']-10)*s),n['text'],font=font(10),fill=(53,74,71,255))
im.resize((a['width'],a['height']),Image.Resampling.LANCZOS).save(sys.argv[2])
`;
function renderPreview({ svgOnly = false, age = 1.3 } = {}) {
  const preview = makePreview(age), jsonFile = path.join(__dirname, 'preview-drawing.json');
  fs.writeFileSync(jsonFile, JSON.stringify(preview));
  fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg(preview));
  if (!svgOnly) {
    const result = spawnSync(process.env.WIND_NINJA_PYTHON || 'python', ['-c', PILLOW_RENDER, jsonFile, path.join(__dirname, 'preview.png')], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error(result.error || result.stderr || 'Pillow renderer failed');
  }
  return { mode: 'isolated Graphics commands; no engine/combat/browser/audio/WASM', age,
    commands: preview.commands.length, svg: 'preview.svg', png: svgOnly ? null : 'preview.png' };
}
module.exports = { ROOT, loadTypeScript, loadIsolated, loadGeometry, loadConfig, loadDrawing,
  RecordingGraphics, DrawingNode, makePreview, renderPreview };
if (require.main === module) console.log(JSON.stringify(renderPreview({ svgOnly: process.argv.includes('--svg-only') }), null, 2));
