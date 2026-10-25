/** Run: node docs/wind-ninja-v120/check_registration.cjs
 * Contract checks for actual data and cross-file registration; no engine, scenes or combat.
 * TypeScript is transpiled in memory. Imports are explicit, saves use private memory,
 * UI/factory nodes are inspected as AST; no battle/UI module is required or instantiated.
 * Only registration-check.json is written. No build, package-size budget, git or deploy.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), SRC = 'assets/scripts/';
const IDS = ['archer', 'sniper', 'pyro', 'volt', 'mora', 'cannon', 'siphon', 'wind', 'ninja'];
const NEW = IDS.slice(7), SLOTS = ['atk', 'skill', 'ult'];
const report = { checkedAt: new Date().toISOString(), status: 'FAIL',
  scope: 'Static AST, isolated configuration functions, memory-only saves, PNG headers/atlas bounds',
  excludedExecution: ['engine', 'combat', 'browser', 'audio', 'WASM', 'build', 'git', 'deployment'],
  packageSizeBudgetEnforced: false, checks: [], heroes: [], sha256: {} };
let ts;
for (const name of [process.env.WIND_NINJA_TYPESCRIPT, 'typescript',
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript']) {
  if (name) try { ts = require(name); break; } catch (_) { /* Installed compiler only. */ }
}
const plain = x => JSON.parse(JSON.stringify(x));
const trees = new Map();
function read(file) {
  const text = fs.readFileSync(path.join(ROOT, SRC, file), 'utf8');
  report.sha256[SRC + file] = crypto.createHash('sha256').update(text).digest('hex');
  return text;
}
function tree(file) {
  if (!trees.has(file)) trees.set(file, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true));
  return trees.get(file);
}
function nodes(root, predicate) {
  const out = [];
  function visit(n) { if (predicate(n)) out.push(n); ts.forEachChild(n, visit); }
  visit(root); return out;
}
function named(root, name) {
  const n = nodes(root, n => (ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name?.getText() === name)[0];
  assert(n, 'Missing declaration: ' + name); return n;
}
function isolated(text, imports = {}, globals = {}) {
  const result = ts.transpileModule(text, { reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
  assert.equal(result.diagnostics?.length || 0, 0, 'Transpile syntax diagnostics');
  const context = { exports: {}, ...globals, require(name) {
    assert(Object.hasOwn(imports, name), 'Refused runtime import: ' + name); return imports[name];
  } };
  vm.runInNewContext(result.outputText, context, { timeout: 3000 }); return context.exports;
}
const pure = (file, imports, globals) => isolated(read(file), imports, globals);
function select(file, names, globals = {}) {
  const source = tree(file);
  return isolated(names.map(name => {
    const n = named(source, name);
    return (ts.isVariableDeclaration(n) ? 'const ' + n.getText(source) + ';' : n.getText(source))
      + '\nexports.' + name + ' = ' + name + ';';
  }).join('\n'), {}, globals);
}
const expression = (n, globals) => vm.runInNewContext('(' + n.getText() + ')', globals, { timeout: 1000 });
function check(name, run) {
  try { run(); report.checks.push({ name, status: 'PASS' }); }
  catch (error) { report.checks.push({ name, status: 'FAIL', error: error.message }); }
}
try {
  assert(ts, 'Set WIND_NINJA_TYPESCRIPT to an installed typescript.js; no install is performed.');
  report.typescript = ts.version;
  // Select real constants without evaluating GameConfig's engine import or stage/wave modules.
  const { PAL } = select('config/GameConfig.ts', ['PAL']);
  const cfg = pure('config/WindNinjaConfig.ts'), previousCfg = pure('config/NewHeroConfig.ts');
  const weapons = pure('config/Weapons.ts'), early = pure('config/EarlyEconomy.ts');
  const chapter = pure('config/ChapterContent.ts');
  const campaign = pure('config/Campaign.ts', { './ChapterContent': chapter });
  const difficulty = select('config/LevelDifficulty.ts', ['DIFFICULTIES', 'difficultyIndex', 'starChestRewards'],
    { campaignStage: campaign.campaignStage, LEVEL_IDS: campaign.CAMPAIGN_LEVEL_IDS });
  const cards = pure('config/Cards.ts', { './GameConfig': { PAL }, './NewHeroConfig': previousCfg, './WindNinjaConfig': cfg });
  function session(raw) {
    const memory = new Map(raw === undefined ? [] : [['kw_save_v1', JSON.stringify(raw)]]);
    const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
    const save = pure('core/SaveData.ts', { '../config/Weapons': weapons, '../config/EarlyEconomy': early }, { localStorage });
    const data = pure('core/GameData.ts', { './SaveData': save, '../config/Weapons': weapons,
      '../config/ChapterContent': chapter, '../config/LevelDifficulty': difficulty,
      '../config/Campaign': campaign, '../config/WindNinjaConfig': cfg });
    return { sv: save.loadSave(), data, save, reload: () => session(JSON.parse(memory.get('kw_save_v1'))) };
  }
  const fresh = session(), data = fresh.data;
  const heroArt = select('ui/HeroComic.ts', ['HERO_PASTEL', 'heroPortraitKey', 'heroFigureKey']);
  const frames = pure('ui/NewHeroArt.ts').NEW_HERO_FRAMES;
  const msNames = tree('ui/pages/UpgradePage.ts').statements.filter(ts.isVariableStatement)
    .flatMap(n => [...n.declarationList.declarations]).map(n => n.name.getText()).filter(n => n.startsWith('SKILL_'));
  const upgrade = select('ui/pages/UpgradePage.ts', ['btMs', ...msNames, 'skillMilestones', 'skillName', 'skillIconId'],
    { ...data, ...cfg, ...previousCfg });
  const feedback = select('ui/GrowthFeedback.ts', ['NORMAL_CFG', 'ULT_DAMAGE'], { ...cards, ...cfg, ...previousCfg });
  const { ULT_FX } = select('ui/HUD.ts', ['ULT_FX'], { PAL });
  const director = tree('battle/BattleDirector.ts');
  const factory = nodes(director, ts.isArrowFunction).find(n => n.parameters[0]?.name.getText() === 'hid'
    && nodes(n.body, ts.isNewExpression).length >= IDS.length);
  assert(factory, 'Missing nine-hero factory callback');
  const statRoute = named(factory, 'st').initializer;
  const heroRoute = nodes(factory.body, ts.isReturnStatement).find(n => n.expression)?.expression;
  function leaf(n, id) {
    if (ts.isParenthesizedExpression(n)) return leaf(n.expression, id);
    return ts.isConditionalExpression(n) ? leaf(expression(n.condition, { hid: id }) ? n.whenTrue : n.whenFalse, id) : n;
  }
  function art(key) {
    const alias = frames[key], source = alias?.source || key, file = 'assets/resources/ux/' + source + '.png';
    const png = fs.readFileSync(path.join(ROOT, file));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', key + ': not PNG');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    const rect = plain(alias?.rect || [0, 0, width, height]), [x, y, w, h] = rect;
    assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, key + ': crop out of bounds');
    return { source, rect };
  }
  check('all nine: definitions, save entries, compatible starters and progression', () => {
    assert.deepEqual(Object.keys(data.HERO_DEFS).sort(), [...IDS].sort());
    for (const id of IDS) {
      const def = data.HERO_DEFS[id], hs = fresh.sv.heroes[id], weapon = weapons.WEAPONS[weapons.STARTER_WEAPON[id]];
      assert.equal(def.id, id); for (const field of ['name', 'job', 'story', 'skillName', 'ultName']) assert(def[field]);
      assert(hs && weapon?.starter && weapons.weaponFits(id, weapon.id), id);
      const base = expression(leaf(statRoute, id), cards);
      assert.equal(base.atk, def.baseAtk); assert.equal(base.skillDmg, def.baseSkillDmg); assert.equal(base.aspd, def.atkSpd);
      const before = data.heroStatsAt(id, 1, 1), next = data.heroStatsAt(id, 2, 1), armed = data.heroStatsAt(id, 1, 2);
      assert(next.atk > before.atk && next.skillDmg > before.skillDmg && armed.atk > before.atk);
      assert.equal(data.heroBtList(id).length, 9); assert.equal(data.weaponBtList(id).length, 9);
      for (const slot of SLOTS) {
        assert.deepEqual(plain(upgrade.skillMilestones(id, slot)).map(x => x.lv), [5, 10, 15, 20]);
        assert(upgrade.skillName(id, slot)); assert.equal(upgrade.skillIconId(id, slot), 'ui_icon_' + slot + '_' + id);
      }
      assert(cards.skillBaseMultiplier(id, 20) > cards.skillBaseMultiplier(id, 1));
      assert(feedback.NORMAL_CFG[id](20).normalMul > feedback.NORMAL_CFG[id](1).normalMul);
      assert(feedback.ULT_DAMAGE[id](20) > feedback.ULT_DAMAGE[id](1));
      report.heroes.push({ id, name: def.name, growth: def.growthType, initialOwned: hs.owned, starter: weapon.id });
    }
    assert.equal(data.HERO_DEFS.wind.name, '赛兰·逐风'); assert.equal(data.HERO_DEFS.wind.growthType, 'skill');
    assert.equal(data.HERO_DEFS.ninja.name, '胧·影刃'); assert(['normal', 'hybrid'].includes(data.HERO_DEFS.ninja.growthType));
  });
  const legacy = { gold: 76543, diamonds: 21000, unlocked: '1-4', stars: { '1-1': 3, '1-2': 2, '1-3': 1, '1-4': 3 },
    weaponSystemVersion: 1, squad: ['archer', 'sniper'], curHero: 'mora', keepLv: 4,
    bag: { mat_stone: 42 }, chestClaimed: { '1-1': 2 }, equips: [], heroes: {} };
  IDS.slice(0, 7).forEach((id, i) => {
    legacy.equips.push({ uid: 'existing_' + id, defId: weapons.STARTER_WEAPON[id], lv: 1 });
    legacy.heroes[id] = { owned: id !== 'siphon', lv: 11 + i, weaponLv: 3 + i,
      atkLv: 6, skillLv: 11, ultLv: 16, worn: { weapon: 'existing_' + id } };
  });
  check('migration: fresh/old saves keep both new heroes locked; existing investment survives reload', () => {
    const migrated = session(legacy), roundTrip = migrated.reload();
    for (const current of [fresh, migrated, roundTrip]) for (const id of NEW) {
      const h = current.sv.heroes[id]; assert.equal(h.owned, false, id + ': free grant');
      for (const key of ['lv', 'weaponLv', 'atkLv', 'skillLv', 'ultLv']) assert.equal(h[key], 1);
      assert(!current.sv.squad.includes(id));
    }
    for (const key of ['gold', 'diamonds', 'unlocked', 'stars', 'squad', 'curHero', 'keepLv', 'bag', 'chestClaimed'])
      assert.deepEqual(plain(roundTrip.sv[key]), legacy[key], key);
    for (const id of IDS.slice(0, 7)) assert.deepEqual(plain(roundTrip.sv.heroes[id]), legacy.heroes[id], id);
    assert.deepEqual(plain(roundTrip.sv.equips.slice(0, 7)), legacy.equips);
    assert.deepEqual(plain(roundTrip.sv), plain(migrated.sv), 'Reload changes migrated save');
    report.migration = { freshLocked: NEW, oldLocked: NEW, preservedOriginalHeroes: 7, reloadStable: true };
  });
  check('shop: 1-4 gate, exact diamond prices, no free/duplicate grant or auto-deploy', () => {
    for (const [id, price] of [['wind', 5200], ['ninja', 5400]]) {
      const matches = data.SHOP.filter(x => x.give.kind === 'hero' && x.give.id === id);
      assert.equal(matches.length, 1); const row = matches[0];
      assert.equal(row.price, price); assert.equal(row.price, data.HERO_DEFS[id].shopPrice);
      assert.equal(row.currency, 'diamond'); assert.equal(row.unlock, '1-4');
      const s = session({ ...legacy, unlocked: '1-3' });
      assert.equal(s.data.shopBuy(row).ok, false); assert.equal(s.sv.heroes[id].owned, false);
      assert.equal(s.sv.diamonds, legacy.diamonds);
      s.sv.unlocked = '1-4'; s.sv.diamonds = price - 1;
      assert.equal(s.data.shopBuy(row).ok, false); assert.equal(s.sv.heroes[id].owned, false);
      assert.equal(s.sv.diamonds, price - 1);
      s.sv.diamonds = price; assert.equal(s.data.shopBuy(row).ok, true);
      assert.equal(s.sv.diamonds, 0); assert.equal(s.sv.heroes[id].owned, true);
      assert.deepEqual(plain(s.sv.squad), legacy.squad); assert.equal(s.data.shopBuy(row).ok, false);
    }
  });
  check('factory: each route selects its own imported class with matching declared hero id (AST only)', () => {
    for (const row of report.heroes) {
      const n = leaf(heroRoute, row.id); assert(ts.isNewExpression(n)); const name = n.expression.getText();
      const declaration = director.statements.filter(ts.isImportDeclaration).find(n =>
        n.importClause?.namedBindings?.elements?.some(e => e.name.text === name));
      assert(declaration, name + ': class not imported');
      const module = path.posix.normalize(path.posix.join('battle', declaration.moduleSpecifier.text)) + '.ts';
      const cls = nodes(tree(module), ts.isClassDeclaration).find(n => n.name?.text === name); assert(cls, name);
      const id = cls.members.find(n => n.name?.getText() === 'id'); assert.equal(expression(id.initializer, {}), row.id);
      row.factory = name; row.factoryModule = module;
    }
  });
  check('new progression: shared cfg drives multipliers/milestones and cultivation without archer fallback', () => {
    const s = session(legacy), growth = select('battle/BattleDirector.ts', ['applyHeroGrowth'], { ...s.data, ...cards, ...previousCfg });
    for (const id of NEW) {
      for (const level of [1, 5, 10, 15, 20]) {
        assert.equal(cards.skillBaseMultiplier(id, level), (id === 'wind' ? cfg.windSkillCfg : cfg.ninjaSkillCfg)(level).mul);
        assert.equal(feedback.ULT_DAMAGE[id](level), (id === 'wind' ? cfg.windUltCfg : cfg.ninjaUltCfg)(level).mul);
      }
      for (const slot of SLOTS) assert.deepEqual(plain(upgrade.skillMilestones(id, slot)), plain(cfg.windNinjaMilestones(id, slot)));
      const h = s.sv.heroes[id]; h.lv = 20; h.atkLv = h.skillLv = h.ultLv = 20;
      const st = expression(leaf(statRoute, id), cards); growth.applyHeroGrowth(st, id);
      assert.equal(st.atk, s.data.heroStats(id).atk); assert.equal(st.skillDmg, s.data.heroStats(id).skillDmg);
      assert.equal(st.aspd, s.data.heroStats(id).atkSpd); assert.equal(st.skillCdFlat, 1); assert.equal(st.chargeMul, .9);
      assert.equal(st.normalMul, feedback.NORMAL_CFG[id](20).normalMul);
    }
    assert(['book', 'staff'].includes(weapons.WEAPONS[weapons.STARTER_WEAPON.wind].type));
    assert.equal(weapons.WEAPONS[weapons.STARTER_WEAPON.ninja].type, 'shuriken');
    for (const id of IDS) assert.equal(weapons.weaponFits(id, weapons.STARTER_WEAPON.ninja), id === 'ninja');
  });
  check('UI: nine roster/palette/skill entries, dynamic HUD rows and six-row new-hero tips (AST only)', () => {
    for (const id of IDS) { assert(heroArt.HERO_PASTEL[id]); assert.equal(ULT_FX[id].length, 3); }
    assert.equal(ULT_FX.wind[0], '#55D8C3'); assert.equal(ULT_FX.ninja[0], '#4559A8');
    for (const [file, name] of [['ui/TrainingLobby.ts', 'roster'], ['ui/pages/HeroPage.ts', 'buildLobbyRoster']]) {
      const roster = named(tree(file), name), heroes = expression(named(roster, 'heroes').initializer, { HERO_DEFS: data.HERO_DEFS });
      assert.deepEqual(plain(heroes.map(x => x.id)).sort(), [...IDS].sort());
    }
    const hud = tree('ui/HUD.ts'); assert(nodes(hud, ts.isInterfaceDeclaration).some(n => n.name.text === 'SkillUI'));
    for (const method of ['buildSkillBadge', 'buildUlt']) assert(nodes(hud, ts.isCallExpression).some(n =>
      n.expression.getText() === 'this.dir.heroes.forEach' && nodes(n, ts.isPropertyAccessExpression).some(x => x.name.text === method)));
    const tips = nodes(tree('ui/Panels.ts'), ts.isIfStatement).find(n => n.expression.getText().includes("hero.id === 'wind'")
      && n.expression.getText().includes("hero.id === 'ninja'")); assert(tips);
    // Follow each slot's branch without executing any UI construction or damage callback.
    for (const id of NEW) for (const kind of SLOTS) {
      let branch = tips.thenStatement.statements.find(ts.isIfStatement);
      while (ts.isIfStatement(branch)) branch = expression(branch.expression, { kind }) ? branch.thenStatement : branch.elseStatement;
      const assignment = nodes(branch, ts.isBinaryExpression).find(n => n.left.getText() === 'rows'); assert(assignment);
      let rows = assignment.right;
      while (ts.isConditionalExpression(rows)) rows = expression(rows.condition, { wind: id === 'wind' }) ? rows.whenTrue : rows.whenFalse;
      assert(ts.isArrayLiteralExpression(rows)); assert.equal(rows.elements.length, 6, id + ':' + kind);
    }
    const painted = select('ui/ComicUI.ts', ['paintedCircle'], { key: 'ui_avatar_wind' }); assert(painted.paintedCircle);
    assert(select('ui/ComicUI.ts', ['paintedCircle'], { key: 'ui_avatar_ninja' }).paintedCircle);
    for (const id of NEW) assert.equal(select('ui/HeroComic.ts', ['footMargin'], { id }).footMargin, 24 / 768);
  });
  check('art: all nine real portrait/figure/action resources; v120 front/back crops and aliases are in PNG bounds', () => {
    for (const row of report.heroes) {
      const id = row.id, keys = [data.HERO_DEFS[id].avatar, heroArt.heroPortraitKey(id), heroArt.heroFigureKey(id),
        ...SLOTS.map(slot => upgrade.skillIconId(id, slot))];
      row.art = Object.fromEntries(keys.map(key => {
        const resolved = art(key); return [key, resolved.source + ' [' + resolved.rect.join(', ') + ']'];
      }));
    }
    report.newArtAliases = {};
    for (const id of NEW) {
      assert.equal(heroArt.heroPortraitKey(id), 'ui_avatar_' + id);
      assert.equal(heroArt.heroFigureKey(id), 'hero_comic_v1/comic_figure_' + id + '_v1');
      for (const [view, x] of [['lobby', 0], ['battle', 512]]) {
        const key = 'new_heroes_v120/' + id + '_' + view; assert(frames[key]);
        const resolved = art(key); assert.equal(resolved.source, 'wind_ninja_v120/' + id + '_figures');
        assert.deepEqual(resolved.rect, [x, 0, 512, 768]); report.newArtAliases[key] = resolved;
      }
      assert.deepEqual(plain(frames[heroArt.heroFigureKey(id)]), plain(frames['new_heroes_v120/' + id + '_lobby']));
      for (const key of ['ui_avatar_' + id, ...SLOTS.map(slot => 'ui_icon_' + slot + '_' + id)]) {
        assert(frames[key]); assert.deepEqual(plain(frames[key]), plain(frames['shop_comic_v1/' + key])); art(key);
      }
    }
    assert(frames.ui_card_volt_field); art('ui_card_volt_field');
  });
  check('cards: volt_field belongs to volt, requires ultimate, caps at one and only toggles voltField', () => {
    const matches = cards.M0_POOL.filter(c => c.id === 'volt_field'); assert.equal(matches.length, 1);
    const card = matches[0]; assert.equal(card.owner, 'volt'); assert.equal(card.rarity, 'purple');
    assert.equal(card.maxStacks, 1); assert.equal(card.art, 'ui_card_volt_field'); assert(cards.isMechanicCard(card));
    assert.equal(card.req, 'volt_unlock_ult');
    assert.equal(cards.canTakeCard(card, {}), false);
    assert.equal(cards.canTakeCard(card, { volt_unlock_skill: 1 }), false);
    assert.equal(cards.canTakeCard(card, { volt_unlock_ult: 1 }), true);
    assert.equal(cards.canTakeCard(card, { volt_unlock_ult: 1, volt_field: 1 }), false);
    const hero = plain(cards.baseVoltStats()), before = plain(hero), global = {};
    card.apply({ hero, global }); assert.deepEqual(global, {});
    assert.equal(hero.voltField, true); delete hero.voltField; assert.deepEqual(hero, before);
    report.voltField = { owner: card.owner, ultimatePrerequisite: card.req, maxStacks: card.maxStacks, isolatedToggle: true };
  });
  check('cards: wind/ninja own only four common numeric cards; no unselected mechanic leaks into the pool', () => {
    const ids = cards.M0_POOL.map(c => c.id); assert.equal(new Set(ids).size, ids.length);
    for (const id of NEW) {
      const owned = cards.M0_POOL.filter(c => c.owner === id);
      assert.deepEqual(plain(owned.map(c => c.id)).sort(), ['attack', 'aspd', 'crit_rate', 'crit_dmg'].map(k => id + '_' + k).sort());
      assert(owned.every(c => c.offerGroup === 'stats' && !cards.isMechanicCard(c) && !c.unlocks));
      report.heroes.find(h => h.id === id).cards = owned.map(c => c.id);
    }
  });
} catch (error) { report.checks.push({ name: 'setup', status: 'FAIL', error: error.stack }); }
report.status = report.checks.length && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
report.summary = { passed: report.checks.filter(c => c.status === 'PASS').length,
  failed: report.checks.filter(c => c.status === 'FAIL').length };
fs.writeFileSync(path.join(__dirname, 'registration-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, ...report.summary,
  failures: report.checks.filter(c => c.status === 'FAIL'), report: 'docs/wind-ninja-v120/registration-check.json' }, null, 2));
process.exitCode = report.status === 'PASS' ? 0 : 1;
