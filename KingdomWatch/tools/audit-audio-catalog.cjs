/** Static TypeScript AST inspection only. Never import or run game/audio code. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'assets/scripts/core/AudioCatalog.ts');
const text = fs.readFileSync(catalogPath, 'utf8');
const source = ts.createSourceFile(catalogPath, text, ts.ScriptTarget.Latest, true);
if (source.parseDiagnostics.length) throw Error('AudioCatalog has syntax errors');
const declarations = new Map();
for (const statement of source.statements) {
  if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations) {
    if (ts.isIdentifier(item.name)) declarations.set(item.name.text, item.initializer);
  }
}
function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
}
function string(node) {
  node = unwrap(node);
  if (!node || !ts.isStringLiteralLike(node)) throw Error('Expected a static audio string');
  return node.text;
}
function object(node) {
  node = unwrap(node);
  if (node && ts.isIdentifier(node)) node = unwrap(declarations.get(node.text));
  if (!node || !ts.isObjectLiteralExpression(node)) throw Error('Expected a static audio object');
  return node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw Error('Unsupported audio object property');
    return [property.name.text, property.initializer];
  });
}
function files(node) {
  node = unwrap(node);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(string);
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) throw Error('Unsupported audio file expression');
  const helper = declarations.get(node.expression.text);
  if (!helper || !ts.isArrowFunction(helper)) throw Error('Unknown audio file helper');
  const body = helper.body.getText(source);
  const mapped = body.match(/^files\.map\(file => '([A-Za-z0-9_/-]+)' \+ file\)$/);
  if (mapped) return node.arguments.map(arg => mapped[1] + string(arg));
  const sequence = body.match(/^\[1, 2, 3\]\.map\(i => `([A-Za-z0-9_/-]+)\$\{kind\}_\$\{i\}`\)$/);
  if (sequence && node.arguments.length === 1) return [1, 2, 3].map(i => sequence[1] + string(node.arguments[0]) + '_' + i);
  throw Error('Review new audio helper before retiring resources: ' + node.expression.text);
}
function resource(file) {
  if (!/^[A-Za-z0-9_/-]+$/.test(file) || file.split('/').some(p => p === '..' || p === '.')) throw Error('Unsafe audio key');
  return 'audio/' + (file.includes('/') ? file : 'v1/' + file);
}
const cues = {};
for (const [name, value] of object(declarations.get('AUDIO_CUES'))) {
  const entries = object(value), fileEntry = entries.find(([key]) => key === 'files');
  if (!fileEntry) throw Error('Cue has no files: ' + name);
  cues[name] = files(fileEntry[1]).map(resource);
}
const music = new Set();
for (const [, chapter] of object(declarations.get('CHAPTER_MUSIC'))) {
  for (const [, track] of object(chapter)) music.add(resource(string(track)));
}
const retained = new Set([...Object.values(cues).flat(), ...music]);
// Keep all declared cues, including currently muted/shared originals, so changing
// the playback policy never requires restoring source recordings first.
const additionalReferences = [];
function visitDirectory(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) { visitDirectory(full); continue; }
    if (!entry.name.endsWith('.ts') || full === catalogPath) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (/\b(?:loadDir|preloadDir)\s*\(\s*['"]audio(?:\/|['"])/.test(content)) throw Error('Review broad audio directory loader: ' + full);
    for (const match of content.matchAll(/['"](audio\/[^'"\s]+)['"]/g)) {
      const key = match[1].replace(/\.(?:wav|mp3)$/, '');
      if (!/^audio\/[A-Za-z0-9_/-]+$/.test(key)) throw Error('Review dynamic audio path: ' + full);
      retained.add(key); additionalReferences.push({ file: path.relative(root, full).replaceAll('\\', '/'), key });
    }
    // The one generic loader has been reviewed together with the catalog.
    if (/['"]audio\/['"]/.test(content) && path.relative(root, full).replaceAll('\\', '/') !== 'assets/scripts/core/GameAudio.ts') {
      throw Error('Review additional dynamic audio loader: ' + full);
    }
  }
}
visitDirectory(path.join(root, 'assets/scripts'));
for (const key of retained) {
  const extension = music.has(key) ? '.mp3' : '.wav';
  const native = path.join(root, 'assets/resources', key + extension);
  if (!fs.existsSync(native) || !fs.existsSync(native + '.meta')) throw Error('Missing declared audio resource: ' + key);
}
const report = {
  schema: 1, catalogSha256: crypto.createHash('sha256').update(text).digest('hex'),
  allDeclaredCuesRetainedIncludingMutedAndShared: true,
  cues, music: [...music].sort(), retainedAudioPaths: [...retained].sort(), additionalReferences,
  gameOrAudioCodeExecuted: false,
};
const outputAt = process.argv.indexOf('--output');
if (outputAt >= 0) {
  const output = path.resolve(process.argv[outputAt + 1]);
  if (!output.startsWith(root + path.sep)) throw Error('Report path must be inside the project');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ staticAudioReferenceAudit: 'passed', cues: Object.keys(cues).length, retainedFiles: retained.size, music: music.size, gameOrAudioCodeExecuted: false }));
