/** 定向验证：放大招 → 等火焰散尽 → 截陨石坑持久态（单坑/七星叠坑观感）。 */
const path = require('path');
const { chromium } = require('playwright');
const output = path.join(__dirname, '../docs/fire-vfx-preview/crater_dust');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const heroes = {};
    for (const id of ['archer', 'sniper', 'pyro', 'volt', 'mora']) heroes[id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 10, worn: {} };
    localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad: ['archer', 'pyro', 'volt', 'mora'], curHero: 'pyro', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
  });
  await page.goto(process.env.KW_QA_URL || 'http://127.0.0.1:4173/');
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
  // 七星大招 → 火焰 0.78s 散尽后截图（坑寿命 4s，取中段 fade=1 的稳定态）
  await page.evaluate(async () => {
    const d = globalThis.__kw;
    d.gmSpawn(42);
    d.mgr.list.forEach((m, i) => {
      m.baseX = -180 + (i % 9) * 45 + Math.sin(i * 1.7) * 10;
      m.node.setPosition(m.baseX, 320 - Math.floor(i / 9) * 70 + Math.cos(i * 2.1) * 12, 0);
      m.hp = m.maxHp = 1e7;
    });
    d.line.hp = d.line.maxHp = 1e7;
    const pyro = d.heroes.find(h => h.id === 'pyro');
    pyro.charge = pyro.chargeGoal; pyro.skillCd = 99;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    const cast = d.tryCastUlt(d.heroes.indexOf(pyro));
    await new Promise(r => setTimeout(r, 3200));
    // 隐怪 + 等爆炸火焰（0.78s）散尽，截纯焦痕持久态
    d.mgr.list.forEach(m => { m.node.active = false; });
    await new Promise(r => setTimeout(r, 950));
    d.state = 'paused';
    d.state = 'paused';
    globalThis.__kwCast = cast;
  });
  await page.waitForTimeout(300);
  const cast = await page.evaluate(() => globalThis.__kwCast);
  await page.screenshot({ path: path.join(output, 'live_ult_craters.png') });
  console.log(JSON.stringify({ ok: cast === 'ok', cast, errors }));
  await browser.close();
  if (errors.length || cast !== 'ok') process.exitCode = 1;
})();
