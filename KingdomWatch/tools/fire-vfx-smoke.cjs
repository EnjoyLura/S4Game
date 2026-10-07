/** Real Cocos collisions, bounded stress fixtures and recorded running gameplay.
 * Isolated saves; the player's browser and game balance are never modified.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require(process.env.KW_QA_PLAYWRIGHT || 'playwright');
const output = path.resolve(process.env.KW_QA_OUTPUT || path.join(__dirname, '../docs/fire-vfx-preview'));
const base = process.env.KW_QA_URL || 'http://127.0.0.1:4173/';

async function frame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function recordBattle(page, name) {
  const result = await page.evaluate(async () => {
    const d = globalThis.__kw, fire = d.impacts.fire;
    d.impacts.tick(3); d.float.tick(2); d.pops.tick(2); d.parts.tick(3);
    while (d.projs.active.length) d.projs.recycle(d.projs.active.length - 1, d.projs.active.at(-1));
    d.projs.render();
    d.mgr.list.forEach((m, i) => {
      // The GM fixture adds density and HP only. Live AI/attack/collision queues run normally.
      const x = -260 + (i % 7) * 84 + Math.sin(i * 1.7) * 12;
      const y = 345 - Math.floor(i / 7) * 100 + Math.cos(i * 2.1) * 18;
      m.baseX = x; m.node.setPosition(x, y, 0);
      m.hp = m.maxHp = 1e7; m.def = { ...m.def, exp: 0 };
      m.state = 'move'; m.flashT = m.shockT = m.vulnT = m.burnT = m.slowT = m.stunT = 0; m.tickArt();
    });
    d.line.hp = d.line.maxHp = 1e7;
    const pyro = d.heroes.find(h => h.id === 'pyro');
    pyro.skillCd = 0.25; pyro.charge = pyro.chargeGoal;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    const Sfx = globalThis.System.get('chunks:///_virtual/Sfx.ts').Sfx;
    const stream = globalThis.cc.game.canvas.captureStream(60);
    let audioDestination = null;
    if (Sfx.ctx?.state === 'running' && Sfx.master) {
      audioDestination = Sfx.ctx.createMediaStreamDestination();
      Sfx.master.connect(audioDestination);
      audioDestination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    }
    const recorder = new MediaRecorder(stream, {
      mimeType: audioDestination ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8',
      videoBitsPerSecond: 3000000,
    });
    const chunks = [];
    const stopped = new Promise(resolve => {
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = resolve;
    });
    const origin = d.field.position.clone();
    const watch = globalThis.__kwFireRecording = { frames: 0, maxActive: 0, maxBlasts: 0, maxFlights: 0, maxResidues: 0, legacyCrater: false, movement: 0, cast: null, audio: !!audioDestination, done: false };
    const start = performance.now();
    recorder.start(); d.state = 'running';
    await new Promise(resolve => {
      function observe() {
        const elapsed = (performance.now() - start) / 1000;
        watch.frames++;
        watch.maxActive = Math.max(watch.maxActive, fire.active.length);
        watch.maxBlasts = Math.max(watch.maxBlasts, fire.active.filter(b => b.blast).length);
        watch.maxFlights = Math.max(watch.maxFlights, fire.flightCount);
        watch.maxResidues = Math.max(watch.maxResidues, fire.residues.filter(r => r.root.active).length);
        watch.legacyCrater ||= !!pyro.craterNode;
        watch.movement = Math.max(watch.movement, Math.hypot(d.field.position.x - origin.x, d.field.position.y - origin.y));
        if (elapsed > 0.55 && watch.cast === null) watch.cast = d.tryCastUlt(d.heroes.indexOf(pyro));
        if (elapsed < 8) requestAnimationFrame(observe);
        else { d.state = 'paused'; watch.done = true; resolve(); }
      }
      requestAnimationFrame(observe);
    });
    recorder.stop(); await stopped;
    if (audioDestination) Sfx.master.disconnect(audioDestination);
    stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { encoded: btoa(binary), watch };
  });
  fs.writeFileSync(path.join(output, name + '-battle.webm'), Buffer.from(result.encoded, 'base64'));
  assert.equal(result.watch.cast, 'ok');
  assert(result.watch.maxActive > 0 && result.watch.maxBlasts > 0 && result.watch.maxFlights > 0, 'Recorded gameplay must contain real fire contacts, explosions and flights');
  assert(result.watch.maxActive <= 16 && result.watch.maxBlasts <= 8 && result.watch.maxFlights <= 32);
  assert.equal(result.watch.movement, 0, 'The meteor queue must never shake the battlefield');
  assert(result.watch.maxResidues > 0 && result.watch.maxResidues <= 8 && !result.watch.legacyCrater, 'Live craters must use the bounded ground texture pool');
  return result.watch;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
  const checks = [], errors = [], shaderErrors = [];
  try {
    for (const spec of [{ name: 'phone-430x932', width: 430, height: 932, dpr: 3 }, { name: 'phone-375x667', width: 375, height: 667, dpr: 2 }]) {
      const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: spec.dpr, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (/shader.*(error|failed)|GL_INVALID|fire-paint.*error/i.test(message.text())) shaderErrors.push(message.text());
      });
      await page.addInitScript(() => {
        const heroes = {};
        for (const id of ['archer', 'sniper', 'pyro', 'volt', 'mora']) heroes[id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
        localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad: ['archer', 'pyro', 'volt', 'mora'], curHero: 'pyro', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
      });
      await page.goto(base);
      await page.waitForFunction(() => !!globalThis.cc?.director?.getScene(), null, { timeout: 25000 });
      await page.waitForTimeout(1200);
      const start = await page.evaluate(() => {
        function find(n) {
          if (n.getComponent(globalThis.cc.Label)?.string.replace(/\s/g, '').includes('开始战斗')) return n;
          for (const c of n.children) { const hit = find(c); if (hit) return hit; }
        }
        const n = find(globalThis.cc.director.getScene()), r = document.querySelector('canvas').getBoundingClientRect();
        const size = globalThis.cc.view.getVisibleSize(), p = n.worldPosition;
        return { x: r.left + (0.5 + p.x / size.width) * r.width, y: r.top + (0.5 - p.y / size.height) * r.height };
      });
      await page.mouse.click(start.x, start.y);
      await page.waitForFunction(() => globalThis.__kw?.state === 'running' && globalThis.__kw.impacts?.fire?.loaded, null, { timeout: 15000 });
      const loaded = await page.evaluate(() => {
        const d = globalThis.__kw, f = d.impacts.fire;
        d.state = 'paused'; d.gmSpawn(42);
        return { frames: f.frames.size, pool: f.free.length + f.active.length, flights: f.flights.length,
          sharedMaterial: f.free.every(b => [...b.flames, ...b.smoke].every(p => p.sprite.customMaterial === f.material)),
          materialName: f.material.effectAsset.name, layers: d.field.children.map(n => n.name), mobs: d.mgr.list.length };
      });
      assert.equal(loaded.frames, 17); assert.equal(loaded.pool, 16); assert.equal(loaded.flights, 32);
      assert(loaded.sharedMaterial && loaded.materialName.includes('fire-paint-v2'));
      assert(loaded.layers.indexOf('GroundFxLayer') < loaded.layers.indexOf('MobLayer'));
      assert(loaded.layers.indexOf('FxLayer') < loaded.layers.indexOf('TextLayer'));
      await page.waitForTimeout(500);
      const collision = await page.evaluate(() => {
        const d = globalThis.__kw, f = d.impacts.fire;
        d.impacts.tick(3); d.float.tick(2); d.parts.tick(3);
        while (d.projs.active.length) d.projs.recycle(d.projs.active.length - 1, d.projs.active.at(-1));
        d.mgr.list.forEach((m, i) => {
          m.baseX = 250; m.node.setPosition(250, 480 + i * 80, 0);
          m.hp = m.maxHp = 1000; m.flashT = m.shockT = m.vulnT = m.burnT = m.slowT = m.stunT = 0;
          m.def = { ...m.def, physRes: 0, exp: 0 }; m.tickArt();
        });
        const [a, b] = d.mgr.list;
        a.baseX = -100; a.node.setPosition(-100, 120, 0);
        b.baseX = -55; b.node.setPosition(-55, 120, 0);
        const events = []; let step = 0;
        const Sfx = globalThis.System.get('chunks:///_virtual/Sfx.ts').Sfx;
        const floatSpawn = d.float.spawn, hit = d.impacts.hit, flash = a.flash, sound = Sfx.impact;
        d.float.spawn = function(...args) { events.push({ kind: 'number', step, value: args[2] }); return floatSpawn.apply(this, args); };
        d.impacts.hit = function(...args) { events.push({ kind: 'vfx', step }); return hit.apply(this, args); };
        a.flash = function(...args) { events.push({ kind: 'redFlash', step }); return flash.apply(this, args); };
        Sfx.impact = function(...args) { events.push({ kind: 'sound', step }); return sound.apply(this, args); };
        d.projs.fire({ x: -100, y: -80, dirX: 0, dirY: 1, speed: 400, dmg: 100, crit: false, heroId: 'pyro', color: '#FFAD54', explodeR: 80, explodeMul: 0.4 });
        const initial = { hp: a.hp, effects: f.active.length };
        try {
          while (a.hp === 1000 && step < 50) { step++; d.projs.tick(1 / 60, d.line); }
        } finally { d.float.spawn = floatSpawn; d.impacts.hit = hit; a.flash = flash; Sfx.impact = sound; }
        globalThis.__kwFirePair = [a, b];
        return { initial, collisionStep: step, primaryDamage: 1000 - a.hp, neighbourDamage: 1000 - b.hp,
          flashT: a.flashT, events, blasts: f.active.filter(x => x.blast).length, flightsAfterHit: f.flightCount,
          numbers: d.float.live.map(x => ({ text: x.label.string, color: [x.label.color.r, x.label.color.g, x.label.color.b] })) };
      });
      assert.deepEqual(collision.initial, { hp: 1000, effects: 0 });
      assert(collision.collisionStep > 10, 'The fireball must fly before a genuine collision triggers the effect');
      assert.equal(collision.primaryDamage, 100); assert.equal(collision.neighbourDamage, 40);
      assert.equal(collision.blasts, 1, 'Direct contact should merge into the local explosion');
      assert.equal(collision.flashT, 0.12); assert.equal(collision.flightsAfterHit, 0);
      for (const kind of ['number', 'vfx', 'redFlash', 'sound']) assert(collision.events.some(e => e.kind === kind && e.step === collision.collisionStep));
      assert(collision.numbers.every(n => n.color.join(',') === '255,255,255'));
      const phases = [];
      for (const time of [0.055, 0.16, 0.42]) {
        const previous = phases.at(-1)?.time || 0;
        const phase = await page.evaluate(dt => {
          const d = globalThis.__kw; d.impacts.tick(dt); d.float.tick(dt);
          const b = d.impacts.fire.active.find(b => b.blast);
          return { age: b.age, core: b.core.node.active, flames: b.flames.map(p => ({ active: p.node.active, frame: p.frame, alpha: p.sprite.color.a })),
            smoke: b.smoke.map(p => ({ active: p.node.active, alpha: p.sprite.color.a })), ground: b.ground.active, scorch: b.scorch.sprite.color.a };
        }, time - previous);
        phases.push({ time, ...phase });
        await frame(page);
        await page.screenshot({ path: path.join(output, spec.name + '-phase-' + Math.round(time * 1000) + '.png'), scale: 'css' });
      }
      assert(phases[0].core && phases[0].flames.some(p => p.active));
      assert(phases[1].smoke.some(p => p.active) && phases[1].flames.some(p => p.active));
      assert(phases[2].flames.every(p => !p.active) && phases[2].scorch > 0);
      const pauseSnapshot = () => page.evaluate(() => {
        const d = globalThis.__kw, f = d.impacts.fire;
        return { time: d.elapsed, effects: f.active.map(b => ({ age: b.age, x: b.x, y: b.y,
          parts: [...b.flames, ...b.smoke, b.core, b.scorch].map(p => [p.node.active, p.frame, p.sprite.color.a, p.node.position.x, p.node.position.y]) })),
          flights: f.flightCount, monsters: d.mgr.list.map(m => [m.x, m.y, m.hp]) };
      });
      const paused = await pauseSnapshot(); await page.waitForTimeout(250);
      assert.deepEqual(await pauseSnapshot(), paused, 'Pause must freeze every fire layer and the simulation');
      await page.evaluate(() => { globalThis.__kw.state = 'pick'; });
      await page.waitForTimeout(120);
      assert.deepEqual(await pauseSnapshot(), paused, 'Upgrade selection must also freeze fire layers');
      await page.evaluate(() => { globalThis.__kw.state = 'paused'; });
      const celMotion = await page.evaluate(() => {
        const d = globalThis.__kw, f = d.impacts.fire;
        d.impacts.tick(3); f.blast(-100, 120, 80);
        const samples = []; let previous = 0;
        for (const time of [0, 0.025, 0.065, 0.115, 0.185, 0.245, 0.290, 0.335]) {
          f.tick(time - previous); previous = time;
          const b = f.active.find(x => x.blast), p = b.flames[0];
          samples.push({ time, frame: p.frame, alpha: p.sprite.color.a, x: p.node.position.x, y: p.node.position.y });
        }
        f.tick(3);
        return samples;
      });
      assert.deepEqual(celMotion.map(p => p.frame), Array.from({ length: 8 }, (_, i) => 'flame_' + i), 'The coherent sequence must actually play all eight cels');
      assert(celMotion[2].alpha >= 240 && celMotion[3].alpha >= 240, 'The peak must hold a solid painted fire body');
      assert(celMotion.every(p => p.x === 0 && p.y === 0), 'Cel transitions must keep the impact pivot fixed');
      const stress = await page.evaluate(() => {
        const d = globalThis.__kw, f = d.impacts.fire, [a, b] = globalThis.__kwFirePair;
        function nodes(n) { return 1 + n.children.reduce((total, c) => total + nodes(c), 0); }
        d.impacts.tick(3); d.float.tick(2); d.parts.tick(3);
        const beforeNodes = nodes(d.field);
        a.hp = b.hp = a.maxHp = b.maxHp = 1e8;
        for (let i = 0; i < 64; i++) d.projs.fire({ x: a.x, y: a.y, dirX: 0, dirY: 1, speed: 400, dmg: 100, crit: false, heroId: 'pyro', color: '#FFAD54', explodeR: 80, explodeMul: 0.4 });
        d.projs.tick(0.001, d.line);
        const dense = { active: f.active.length, blasts: f.active.filter(b => b.blast).length, contacts: f.active.filter(b => !b.blast).length,
          pool: f.active.length + f.free.length, damage: 2e8 - a.hp - b.hp, nodes: nodes(d.field), particles: d.parts.act.length };
        d.impacts.tick(3); d.parts.tick(3); d.float.tick(3);
        const reused = f.free.at(-1).root.uuid;
        f.hit(10, 20, false, Math.PI / 4); f.tick(1 / 30);
        const first = f.active[0];
        const firstFrame = { reused: reused === first.root.uuid, core: first.core.node.active, flame: first.flames.some(p => p.node.active), ground: first.ground.active, alpha: first.flames[0].sprite.color.a };
        f.tick(3);
        return { beforeNodes, dense, firstFrame, freeAfter: f.free.length, activeAfter: f.active.length };
      });
      assert(stress.dense.active <= 16 && stress.dense.blasts <= 8 && stress.dense.contacts <= 10 && stress.dense.pool === 16);
      assert.equal(stress.dense.damage, 8960, 'VFX concurrency drops must never drop damage');
      assert.equal(stress.dense.nodes, stress.beforeNodes, 'Hit bursts must not allocate scene nodes');
      assert(stress.firstFrame.reused && stress.firstFrame.core && stress.firstFrame.flame && !stress.firstFrame.ground);
      assert.equal(stress.freeAfter, 16); assert.equal(stress.activeAfter, 0);
      const recordingPromise = recordBattle(page, spec.name);
      await page.waitForTimeout(1700);
      await page.screenshot({ path: path.join(output, spec.name + '-dense.png'), scale: 'css' });
      await page.waitForTimeout(1050);
      await page.screenshot({ path: path.join(output, spec.name + '-meteor.png'), scale: 'css' });
      const recording = await recordingPromise;
      checks.push({ ...spec, loaded, collision, phases, celMotion, pause: 'pass', selectionPause: 'pass', stress, recording });
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(shaderErrors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, shaderErrors }, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, scenarios: checks.length, errors, shaderErrors, output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
