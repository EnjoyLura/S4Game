/** Real browser integration checks against a locally served web-mobile build.
 * Uses an isolated browser context; never reads or writes the player's browser.
 * KW_QA_PLAYWRIGHT can point at the bundled playwright module.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require(process.env.KW_QA_PLAYWRIGHT || 'playwright');
const output = path.resolve(process.env.KW_QA_OUTPUT || path.resolve(__dirname, '../docs/battle-preview'));
const base = process.env.KW_QA_URL || 'http://127.0.0.1:4173/';

/** Capture the actual Cocos lettering with a quiet, controlled scene for motion review. */
async function captureNumberMotion(page) {
  const encoded = await page.evaluate(async () => {
    const d = globalThis.__kw, [a, b] = d.mgr.list.filter(m => !m.dead);
    const saved = [a, b].map(m => ({ m, position: m.node.position.clone() }));
    a.node.setPosition(-95, -30, 0); b.node.setPosition(80, 20, 0);
    d.float.tick(2); d.pops.tick(2);
    d.mgr.list.forEach(m => { m.flashT = 0; m.tickArt(); });
    const tokens = [{}, {}], events = [];
    for (const start of [0.35, 1.7, 3.05, 4.4]) {
      events.push({ at: start, value: 300, critical: false, slot: 0 }, { at: start + 0.18, value: 950, critical: true, slot: 1 },
        { at: start + 0.62, value: 125, critical: false, slot: 0 }, { at: start + 0.67, value: 175, critical: false, slot: 0 },
        { at: start + 0.88, value: 2500, critical: true, slot: 1 });
    }
    const stream = globalThis.cc.game.canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2500000 });
    const chunks = [];
    const stopped = new Promise(resolve => { recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.onstop = resolve; });
    const start = performance.now(); let previous = start, index = 0;
    recorder.start();
    await new Promise(resolve => {
      function frame(now) {
        const elapsed = (now - start) / 1000, dt = (now - previous) / 1000; previous = now;
        d.float.tick(dt);
        while (index < events.length && events[index].at <= elapsed) {
          const e = events[index++], m = e.slot ? b : a;
          d.float.spawn(m.x, m.y + m.def.radius * 2.05, String(e.value), '#FFFFFF', e.critical, { target: tokens[e.slot], amount: e.value });
        }
        if (elapsed < 6) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    recorder.stop(); await stopped;
    stream.getTracks().forEach(track => track.stop());
    saved.forEach(v => v.m.node.setPosition(v.position));
    d.float.tick(2);
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  });
  fs.writeFileSync(path.join(output, 'damage-lettering-motion.webm'), Buffer.from(encoded, 'base64'));
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = [], errors = [];
  try {
    for (const spec of [
      { name: 'four-heroes', width: 430, height: 932, dpr: 3, squad: ['archer', 'pyro', 'volt', 'mora'] },
      { name: 'compact-sniper', width: 375, height: 667, dpr: 2, squad: ['archer', 'sniper'] },
    ]) {
      const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: spec.dpr, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ squad }) => {
        const heroes = {};
        for (const id of ['archer', 'sniper', 'pyro', 'volt', 'mora']) heroes[id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
        localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad, curHero: 'archer', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true, codex: ['goblin_worker','goblin_slinger','goblin_shaman','wolf_rider','goblin_brute'] }));
      }, { squad: spec.squad });
      await page.goto(base);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(output, spec.name + '-menu.png'), scale: 'css' });
      // Start button follows the height-adaptive page layout; find its world
      // position from the game's own scene tree, then dispatch a real tap.
      const start = await page.evaluate(() => {
        const scene = globalThis.cc?.director?.getScene();
        function find(node) {
          const c = node.getComponent(globalThis.cc.Label);
          if (c?.string.replace(/\s/g, '').includes('开始战斗')) return node;
          for (const child of node.children || []) { const hit = find(child); if (hit) return hit; }
          return null;
        }
        if (!scene) return null;
        const n = find(scene);
        if (!n) return null;
        const p = n.worldPosition;
        const canvas = document.querySelector('canvas');
        const r = canvas.getBoundingClientRect();
        const vis = globalThis.cc.view.getVisibleSize();
        return { x: r.left + (0.5 + p.x / vis.width) * r.width, y: r.top + (0.5 - p.y / vis.height) * r.height };
      });
      // On the current layout Start is at 74.2% height on tall phones and at
      // 77.8% on 16:9. The fallback is only for builds that don't export cc.
      await page.mouse.click(start?.x ?? spec.width * 0.5, start?.y ?? spec.height * (spec.height / spec.width > 1.9 ? 0.742 : 0.778));
      await page.waitForFunction(() => globalThis.__kw?.state === 'running', null, { timeout: 15000 });
      await page.evaluate(() => {
        const d = globalThis.__kw;
        d.state = 'paused';
        d.gmSpawn(38);
        d.mgr.list.forEach((m, i) => {
          const x = -260 + (i % 6) * 101 + Math.sin(i * 1.8) * 18;
          const y = 430 - Math.floor(i / 6) * 137 + Math.cos(i * 2.7) * 28;
          m.baseX = x; m.node.setPosition(x, y, 0);
        });
        d.elapsed = 122; d.hud.setWave(5, 10);
        d.heroes.forEach(h => h.charge = h.chargeGoal);
        d.hud.sync(1);
      });
      await page.waitForTimeout(600);
      const loaded = await page.evaluate(() => {
        const d = globalThis.__kw;
        return { heroes: d.heroes.map(h => [h.id, h.art?.loaded]), mobs: d.mgr.list.map(m => [m.def.id, m.art?.loaded]), layers: d.field.children.map(n => n.name) };
      });
      assert(loaded.heroes.every(x => x[1]), 'Every hero artwork must load');
      assert(loaded.mobs.every(x => x[1]), 'Every enemy artwork must load');
      assert.equal(new Set(loaded.mobs.map(x => x[0])).size, 5, 'All five active enemy archetypes should render');
      assert(loaded.layers.indexOf('HeroLayer') < loaded.layers.indexOf('ProjLayer'), 'Projectiles should render above heroes');
      await page.screenshot({ path: path.join(output, spec.name + '.png'), scale: 'css' });
      const showPickFixture = ids => page.evaluate(ids => {
        const d = globalThis.__kw, pool = globalThis.System.get('chunks:///_virtual/Cards.ts').M0_POOL;
        globalThis.__kwPickCheck = { selected: null, refreshes: 0 };
        d.panels.showPick(ids.map(id => pool.find(c => c.id === id)), d.stacks, {
          onPick: card => { globalThis.__kwPickCheck.selected = card.id; },
          onRefreshRequest: () => { globalThis.__kwPickCheck.refreshes++; },
        });
      }, ids);
      const readPickFixture = () => page.evaluate(() => globalThis.__kw.panels.modalRoot.children
        .filter(n => n.getComponent('cc.UITransform')?.width === 222)
        .map(frame => {
          const header = frame.children.find(n => n.getComponent('cc.UITransform')?.height === 52);
          const name = header.children.find(n => n.getComponent(globalThis.cc.Label)).getComponent(globalThis.cc.Label);
          const desc = frame.children.find(n => n.getComponent(globalThis.cc.Label)).getComponent(globalThis.cc.Label);
          return { name: name.string, width: frame.getComponent('cc.UITransform').width,
            headerWidth: header.getComponent('cc.UITransform').width,
            nameBounds: [name.node.getComponent('cc.UITransform').width, name.node.getComponent('cc.UITransform').height],
            descBounds: [desc.node.getComponent('cc.UITransform').width, desc.node.getComponent('cc.UITransform').height],
            lines: desc._textLayoutData.parsedString,
          };
        }));
      await showPickFixture(['steady_rest', 'wall', 'xp_badge']);
      await page.waitForTimeout(650);
      const pickCards = { reference: await readPickFixture() };
      assert(pickCards.reference[1].lines.length > 1, 'Wall description must actually wrap instead of expanding its box');
      await page.screenshot({ path: path.join(output, spec.name + '-pick.png'), scale: 'css' });
      const longest = await page.evaluate(() => {
        const pool = globalThis.System.get('chunks:///_virtual/Cards.ts').M0_POOL;
        return ['white', 'blue', 'purple'].map(rarity => pool.filter(c => c.rarity === rarity)
          .sort((a, b) => b.desc.length - a.desc.length)[0].id);
      });
      // Reopen with cached fonts: this was the path that resized SHRINK labels.
      await showPickFixture(longest);
      await page.waitForTimeout(650);
      pickCards.longest = await readPickFixture();
      for (const card of [...pickCards.reference, ...pickCards.longest]) {
        assert.equal(card.headerWidth, card.width, 'Quality band must fill the card width');
        assert.deepEqual(card.nameBounds, [188, 40], 'Card title must keep its bounded text box');
        assert.deepEqual(card.descBounds, [196, 90], 'Card description must keep its bounded text box with cached fonts');
      }
      await page.screenshot({ path: path.join(output, spec.name + '-pick-long.png'), scale: 'css' });
      await page.evaluate(() => {
        const frame = globalThis.__kw.panels.modalRoot.children.find(n => n.getComponent('cc.UITransform')?.width === 222);
        frame.emit(globalThis.cc.Node.EventType.TOUCH_END, {});
      });
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => globalThis.__kwPickCheck.selected), longest[0], 'Card selection must still return the chosen card');
      await page.evaluate(() => globalThis.__kw.panels.closeAll());
      await page.waitForFunction(() => globalThis.__kw.float.pool.items.every(t => t.label.font && !t.label.useSystemFont)
        && globalThis.__kw.pops.pool.items.every(t => t.label.font && !t.label.useSystemFont));
      const typography = await page.evaluate(() => {
        const d = globalThis.__kw, [a, b] = d.mgr.list.filter(m => !m.dead);
        const originals = [a, b].map(m => ({ m, hp: m.hp, def: m.def, shockT: m.shockT, vulnT: m.vulnT, position: m.node.position.clone() }));
        globalThis.__kwRestoreTypeFixture = () => originals.forEach(v => { v.m.hp = v.hp; v.m.def = v.def; v.m.shockT = v.shockT; v.m.vulnT = v.vulnT; v.m.node.setPosition(v.position); });
        d.float.tick(2); d.pops.tick(2);
        [a, b].forEach(m => { m.hp = 5000; m.shockT = m.vulnT = 0; m.def = { ...m.def, physRes: 0 }; });
        a.node.setPosition(-80, 0, 0); b.node.setPosition(35, -12, 0);
        a.takeDamage(125, false, 'archer'); a.takeDamage(175, false, 'sniper');
        a.takeDamage(950, true, 'sniper'); a.takeDamage(18, false, 'burn'); b.takeDamage(80, false, 'archer');
        const random = Math.random;
        try { Math.random = () => 0; d.pops.pop(b.x, b.y + b.def.radius, 'ultKill'); }
        finally { Math.random = random; }
        d.float.tick(0.07); d.pops.tick(0.07);
        const entries = d.float.live.map(t => ({ text: t.label.string, kind: t.kind, hits: t.hits, size: t.label.fontSize, font: t.label.font?.name, system: t.label.useSystemFont, color: [t.label.color.r, t.label.color.g, t.label.color.b], x: t.x, y: t.y }));
        return {
          entries, hpAfter: a.hp, comic: d.pops.live.map(p => ({ text: p.label.string, font: p.label.font?.name })),
          hud: [d.hud.timeTxt, d.hud.lvTxt, d.hud.hpVal].map(n => ({ text: n.getComponent(globalThis.cc.Label).string, font: n.getComponent(globalThis.cc.Label).font?.name })),
        };
      });
      const normal = typography.entries.find(t => t.text === '300');
      assert(normal?.hits === 2 && typography.hpAfter === 3732, 'Same-target rapid hits should combine their display without changing damage');
      assert(typography.entries.some(t => t.text === '950' && t.kind === 'crit') && typography.entries.some(t => t.text === '18' && t.kind === 'periodic') && typography.entries.some(t => t.text === '80'), 'Critical, periodic and separate-target numbers must remain distinct');
      assert(typography.entries.every(t => t.font === 'CombatDigits' && !t.system), 'All battle numbers should use the bundled combat font');
      assert(typography.entries.filter(t => t.kind !== 'crit').every(t => t.color.join(',') === '255,255,255'), 'Normal and periodic damage must be pure white');
      assert(typography.entries.filter(t => t.kind === 'crit').every(t => t.color.join(',') === '255,48,48'), 'Critical damage must be red');
      assert(new Set(typography.entries.map(t => Math.round(t.x) + ':' + Math.round(t.y))).size === typography.entries.length, 'Nearby numbers should take separate lanes');
      assert(typography.comic.some(t => t.text === 'KAPOW!' && t.font === 'ComicLettering'), 'Kill exclamations should use the comic font');
      assert(typography.hud.every(t => t.font === 'UINumbers'), 'HUD counters should use the stable upright numeric font');
      await page.waitForTimeout(80);
      await page.screenshot({ path: path.join(output, spec.name + '-typography.png'), scale: 'css' });
      const pauseSnapshot = () => page.evaluate(() => ({ elapsed: globalThis.__kw.elapsed, y: globalThis.__kw.mgr.list[0].y, numbers: globalThis.__kw.float.live.map(t => [t.age, t.x, t.y]), words: globalThis.__kw.pops.live.map(p => [p.age, p.node.position.y]) }));
      const pauseA = await pauseSnapshot();
      await page.waitForTimeout(250);
      const pauseB = await pauseSnapshot();
      assert.deepEqual(pauseA, pauseB, 'Pause must freeze simulation');
      const letteringReuse = await page.evaluate(() => {
        const d = globalThis.__kw;
        globalThis.__kwRestoreTypeFixture();
        d.float.tick(2); d.pops.tick(2);
        d.float.spawn(0, 0, '2300', '#FFD75E', true);
        d.float.tick(0.23); const former = d.float.live[0].node;
        d.float.tick(2);
        d.float.spawn(0, 0, '55', '#FFFFFF');
        const t = d.float.live[0];
        const reused = { sameNode: former === t.node, size: t.label.fontSize, outline: t.label.outlineWidth, opacity: t.opacity.opacity, angle: t.node.angle };
        d.float.tick(2);
        const random = Math.random;
        try { Math.random = () => 0; d.pops.pop(0, 0, 'stoneHit'); }
        finally { Math.random = random; }
        const chineseComic = d.pops.live[0].label.font?.name;
        d.pops.tick(2);
        return { ...reused, chineseComic };
      });
      assert(letteringReuse.sameNode && letteringReuse.size === 27 && letteringReuse.outline === 2.2 && letteringReuse.opacity === 255 && letteringReuse.angle === 0, 'Reused critical numbers should fully restore normal lettering');
      assert.equal(letteringReuse.chineseComic, 'UIBody', 'Chinese exclamations must use a font containing Chinese glyphs');
      const numberMotion = await page.evaluate(() => {
        const d = globalThis.__kw, results = [];
        for (const critical of [false, true]) {
          d.float.tick(2);
          d.float.spawn(0, 0, critical ? '1888' : '300', '#FFFFFF', critical);
          let previous = 0;
          const samples = [];
          for (const time of [0.034, 0.14, critical ? 0.34 : 0.28, critical ? 0.44 : 0.37]) {
            d.float.tick(time - previous); previous = time;
            const t = d.float.live[0];
            samples.push({ time, x: t.x, y: t.y, sx: t.node.scale.x, sy: t.node.scale.y, alpha: t.opacity.opacity });
          }
          d.float.tick(0.2);
          results.push({ critical, samples, released: d.float.live.length === 0 });
        }
        // A low-refresh display still gets a visible punch in its first frame.
        d.float.spawn(0, 0, '999', '#FFFFFF', true); d.float.tick(1 / 30);
        const firstFrame30fps = d.float.live[0].node.scale.x;
        d.float.tick(2);
        return { results, firstFrame30fps };
      });
      for (const motion of numberMotion.results) {
        const [peak, holdA, holdB, exit] = motion.samples;
        assert(peak.sx > (motion.critical ? 1.3 : 1.15), 'The early hit should visibly punch larger than the resting number');
        assert(holdA.alpha === 255 && holdB.alpha === 255 && holdA.x === holdB.x && holdA.y === holdB.y, 'The middle should be fully opaque and stationary');
        assert(exit.alpha > 0 && exit.alpha < 220 && exit.sy < holdB.sy && exit.y < holdB.y, 'Exit should collapse quickly downward instead of floating away');
        assert(motion.released, 'Numbers should release after the short impact envelope');
      }
      assert(numberMotion.firstFrame30fps > 1.3, 'Critical punch should remain visible at 30fps');
      if (process.env.KW_QA_CAPTURE_MOTION === '1' && spec.name === 'four-heroes') await captureNumberMotion(page);
      const casts = await page.evaluate(() => {
        const d = globalThis.__kw;
        // Keep the scene alive long enough to observe every ult's real queue.
        d.mgr.list.forEach(m => { m.hp = m.maxHp = 1e6; });
        d.state = 'running';
        const origin = { x: d.field.position.x, y: d.field.position.y };
        const watch = globalThis.__kwImpactWatch = { frames: 0, movement: 0, lean: 0, fullScreenFlash: false, done: false };
        const since = performance.now();
        function observe() {
          watch.frames++;
          watch.movement = Math.max(watch.movement, Math.hypot(d.field.position.x - origin.x, d.field.position.y - origin.y));
          watch.lean = Math.max(watch.lean, ...d.heroes.map(h => Math.abs(h.art.node.angle)));
          function scan(n) { if (n.name === 'blizFlash' || n.name === 'blizzard') watch.fullScreenFlash = true; n.children.forEach(scan); }
          scan(d.field);
          if (performance.now() - since < 1600) requestAnimationFrame(observe);
          else watch.done = true;
        }
        requestAnimationFrame(observe);
        return d.heroes.map((h, i) => [h.id, d.tryCastUlt(i)]);
      });
      assert(casts.every(x => x[1] === 'ok'), 'All equipped ultimates should cast');
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(output, spec.name + '-effects.png'), scale: 'css' });
      await page.waitForFunction(() => globalThis.__kwImpactWatch.done);
      const impactFeel = await page.evaluate(() => globalThis.__kwImpactWatch);
      assert(impactFeel.frames > 20 && impactFeel.movement === 0, 'All ultimate queues must leave the battlefield fixed');
      assert(!impactFeel.fullScreenFlash, 'Frost ultimate must not add a full-screen flash');
      assert(impactFeel.lean > 0.5, 'Attacks should animate hero force at release');
      await page.evaluate(() => { globalThis.__kw.state = 'paused'; });
      const lowFpsAccent = await page.evaluate(() => {
        const d = globalThis.__kw, step = d.mgr.tick;
        const steps = [];
        d.mgr.tick = function(dt, line) { steps.push(dt); return step.call(this, dt, line); };
        d.speed = 1; d.hitStopT = 0; d.hitStopCd = 0;
        d.onHitStop(); d.state = 'running';
        d.update(1 / 30); d.update(1 / 30);
        d.state = 'paused'; d.mgr.tick = step;
        return { contact: steps[0], recovery: steps[1] };
      });
      assert(Math.abs(lowFpsAccent.contact - 0.004) < 1e-6 && Math.abs(lowFpsAccent.recovery - 1 / 30) < 1e-6, 'Heavy hits should accent one frame at 30fps and recover immediately');
      const alpha = await page.evaluate(() => ({ dpr: globalThis.cc.game.canvas.width / globalThis.cc.game.canvas.clientWidth, state: globalThis.__kw.state, poses: globalThis.__kw.heroes.map(h => h.art.sprite.spriteFrame.rect.height) }));
      assert(alpha.dpr >= spec.dpr - 0.1, 'DPR patch should keep native pixel density');
      // Kill one enemy, wait for recycling, then reuse it with a new archetype.
      const recycled = await page.evaluate(async () => {
        const d = globalThis.__kw, m = d.mgr.list[0], before = d.mgr.pool.length;
        const oldXp = d.xp; m.def = { ...m.def, exp: 0 }; m.takeDamage(2e6, false, 'qa');
        await new Promise(resolve => setTimeout(resolve, 250));
        d.mgr.tick(0, d.line);
        const pooled = d.mgr.pool.length > before;
        d.gmSpawn(1);
        const reused = d.mgr.list.find(x => x === m);
        return { pooled, reused: !!reused, art: reused?.art?.loaded, opacity: reused?.node.getComponent('cc.UIOpacity')?.opacity, xpStable: d.xp === oldXp };
      });
      assert(recycled.pooled && recycled.reused && recycled.art && recycled.opacity === 255 && recycled.xpStable, 'Enemy recycling should restore its presentation');
      const lethalExplosion = await page.evaluate(() => {
        const d = globalThis.__kw;
        const [primary, neighbour] = d.mgr.list.filter(m => !m.dead);
        primary.def = { ...primary.def, exp: 0, physRes: 0 };
        neighbour.def = { ...neighbour.def, exp: 0, physRes: 0 };
        primary.hp = 1; neighbour.hp = neighbour.maxHp = 1000;
        primary.node.setPosition(-200, 300, 0); neighbour.node.setPosition(-160, 300, 0);
        d.projs.fire({ x: -200, y: 300, dirX: 0, dirY: 1, speed: 800, dmg: 100, crit: false, heroId: 'pyro', color: '#FFAD54', explodeR: 80, explodeMul: 0.4 });
        d.projs.tick(0.001, d.line);
        return { primaryDead: primary.dead, neighbourDamage: 1000 - neighbour.hp,
          localizedBlast: d.impacts.active.some(p => p.kind === 'blast' && p.x === -200 && p.y === 300)
            || d.impacts.fire.active.some(p => p.blast && p.x === -200 && p.y === 300),
          impactPool: d.impacts.active.length, firePool: d.impacts.fire.active.length, particles: d.parts.act.length };
      });
      assert(lethalExplosion.primaryDead && lethalExplosion.neighbourDamage >= 40, 'Lethal direct hits must still resolve their blast damage');
      assert(lethalExplosion.localizedBlast, 'Lethal explosions must still render their local impact');
      assert(lethalExplosion.impactPool <= 32 && lethalExplosion.particles <= 90, 'Crowded impacts must retain pool bounds');
      const variants = [];
      if (spec.name === 'compact-sniper') {
        for (const level of ['1-2', '1-3']) {
          await page.evaluate(async level => {
            const mod = await globalThis.System.import('chunks:///_virtual/Flow.ts');
            mod.flow.mode = 'battle'; mod.flow.levelId = level;
            globalThis.cc.director.loadScene('Main');
          }, level);
          await page.waitForFunction(level => globalThis.__kw?.levelDef.id === level && globalThis.__kw.field?.isValid, level);
          await page.waitForTimeout(600);
          const scene = await page.evaluate(level => {
            const clip = globalThis.__kw.field.children.find(n => n.name === 'artClip:scenes/scene_' + level.replace('-', '_'));
            const sprite = clip?.children[0]?.getComponent(globalThis.cc.Sprite);
            return { level, loaded: !!sprite?.spriteFrame };
          }, level);
          assert(scene.loaded, 'Each level should load its own battle background'); variants.push(scene);
        }
      }
      checks.push({ ...spec, loadedHeroes: loaded.heroes, activeArchetypes: [...new Set(loaded.mobs.map(x => x[0]))], casts, pause: 'pass', pickCards, typography, letteringReuse, numberMotion, impactFeel, lowFpsAccent, lethalExplosion, recycling: recycled, sceneVariants: variants, ...alpha });
      await context.close();
    }
    assert.equal(errors.length, 0, 'No JavaScript runtime errors');
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, scenarios: checks.length, errors, output }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
