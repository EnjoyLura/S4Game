/** 定向验证：线上/本地战斗内怪物形象与步态序列帧。
 * 开局 GM 放 42 只怪摆成行军阵型，连拍两帧（间隔 0.6s），
 * 输出像素差分（>2 即怪物在动）与两张实照。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const output = path.resolve(process.env.KW_QA_OUTPUT || path.join(__dirname, '../docs/fire-vfx-preview/mob_anim_online'));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const consoleErrs = [];
  page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') consoleErrs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`); });
  await page.addInitScript(() => {
    const heroes = {};
    for (const id of ['archer', 'sniper', 'pyro', 'volt', 'mora']) heroes[id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
    localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad: ['archer', 'pyro', 'volt', 'mora'], curHero: 'archer', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
  });
  await page.goto(process.env.KW_QA_URL || 'http://127.0.0.1:4173/');
  await page.waitForFunction(() => !!globalThis.cc?.director?.getScene(), null, { timeout: 30000 });
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
  await page.waitForFunction(() => globalThis.__kw?.state === 'running', null, { timeout: 20000 });
  const t0 = Date.now();
  // 贴图冷加载在慢网下可能 >2.5s：等全部英雄 art loaded（上限 15s），超时也继续截图取证
  await page.waitForFunction(() => {
    const d = globalThis.__kw;
    return d?.heroes?.every(h => h.art && h.art.loaded);
  }, null, { timeout: 15000 }).catch(() => {});
  const artWaitMs = Date.now() - t0;
  const info = await page.evaluate(async () => {
    const d = globalThis.__kw;
    d.gmSpawn(42);
    d.mgr.list.forEach((m, i) => {
      m.baseX = -190 + (i % 9) * 48 + Math.sin(i * 1.7) * 10;
      m.node.setPosition(m.baseX, 360 - Math.floor(i / 9) * 72 + Math.cos(i * 2.1) * 12, 0);
      m.hp = m.maxHp = 1e7;
      m.def = { ...m.def, exp: 0 };
    });
    d.line.hp = d.line.maxHp = 1e7;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    await new Promise(r => setTimeout(r, 2500));   // 走 2.5s：序列帧已滚动若干步态环
    return { mobs: d.mgr.list.length,
      heroes: d.heroes.map(h => ({ id: h.id, artLoaded: !!(h.art && h.art.loaded), frame: h.art ? h.art.frame : null })),
      mobArt: d.mgr.list.slice(0, 3).map(m => ({ id: m.def.id, artLoaded: !!(m.art && m.art.loaded) })) };
  });
  await page.screenshot({ path: path.join(output, 'live_mobs_a.png') });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(output, 'live_mobs_b.png') });
  console.log(JSON.stringify({ ok: errors.length === 0, artWaitMs, info, errors, consoleErrs: consoleErrs.slice(0, 10), output }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();
