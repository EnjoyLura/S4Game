/** 定向验证：齐射主箭索敌（两段式，带诊断）。
 * evaluate#1 布置：清场→刷 1 只定身怪(y=300，距弓手 ~845px<射程900)→弓手 stats.fan=1（2 列）
 *   →包一层 shoot 记录每箭目标、包 takeDamage 记录命中；后台每秒采样全场怪 y。
 * 节点侧 5s/4s 各截一屏后 evaluate#2 回收 {shots, hits, samples, 几何}。
 * 判据：hits(archer)≥3 且全部来自 archer。旧中心索敌 ±5° 在 741px 横向脱靶 ~65px（怪半径 22~34）必空。 */
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
  await page.addInitScript(() => {
    const heroes = {};
    for (const id of ['archer', 'sniper', 'pyro', 'volt', 'mora']) heroes[id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
    localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad: ['archer'], curHero: 'archer', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
  });
  await page.goto(process.env.KW_QA_URL || 'https://kingdom-watch.pages.dev/');
  await page.waitForFunction(() => !!globalThis.cc?.director?.getScene(), null, { timeout: 45000 });
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
  await page.waitForFunction(() => {
    const d = globalThis.__kw;
    return d?.heroes?.every(h => h.art && h.art.loaded);
  }, null, { timeout: 15000 }).catch(() => {});
  const geo = await page.evaluate(() => {
    const d = globalThis.__kw;
    d.gmKillAll();
    return { heroY: d.heroes[0].node.position.y, heroX: d.heroes[0].x, state: d.state };
  });
  await page.waitForTimeout(800);   // 等死怪出列
  const setup = await page.evaluate(() => {
    const d = globalThis.__kw;
    d.gmSpawn(1);
    const m = d.mgr.list.find(x => !x.dead);
    m.def = { ...m.def, speed: 0, exp: 0 };
    m.baseX = 0;
    m.node.setPosition(0, 50, 0);
    m.hp = m.maxHp = 1e7;
    const archer = d.heroes.find(h => h.id === 'archer');
    archer.stats.fan = 1;   // 1 层齐射 = 2 列
    d.line.hp = d.line.maxHp = 1e7;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    const diag = { shots: [], hits: [], samples: [] };
    globalThis.__volleyDiag = diag;
    const origShoot = archer.shoot;
    archer.shoot = function (t, mgr, projs) {
      diag.shots.push({ id: t && t.def.id, y: t ? Math.round(t.node.position.y) : null, t: performance.now() | 0 });
      return origShoot.call(this, t, mgr, projs);
    };
    const origDmg = m.takeDamage.bind(m);
    m.takeDamage = (dmg, crit, heroId, ...rest) => { diag.hits.push({ heroId, dmg: Math.round(dmg), t: performance.now() | 0 }); return origDmg(dmg, crit, heroId, ...rest); };
    const t0 = performance.now();
    diag.sampler = setInterval(() => {
      const alive = d.mgr.list.filter(x => !x.dead);
      diag.samples.push({
        t: Math.round(performance.now() - t0),
        mobs: alive.map(x => `${x.def.id}:${Math.round(x.node.position.y)}`).slice(0, 6),
        state: d.state,
      });
    }, 1000);
    return { mobId: m.def.id, fan: archer.stats.fan };
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(output, 'volley_primary_a.png') });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(output, 'volley_primary_b.png') });
  const result = await page.evaluate(() => {
    const d = globalThis.__kw;
    const diag = globalThis.__volleyDiag;
    clearInterval(diag.sampler);
    const m = d.mgr.list.find(x => !x.dead && x.def.speed === 0);
    return {
      shots: diag.shots, hits: diag.hits,
      samples: diag.samples.slice(0, 12),
      mobY: m ? Math.round(m.node.position.y) : null, mobDead: m ? m.dead : null,
      fan: d.heroes.find(h => h.id === 'archer').stats.fan,
      empowerLeft: d.heroes.find(h => h.id === 'archer').empowerLeft,
      mobsOnField: d.mgr.list.filter(x => !x.dead).length,
    };
  });
  const archerHits = result.hits.filter(h => h.heroId === 'archer').length;
  const ok = errors.length === 0 && archerHits >= 3;
  console.log(JSON.stringify({ ok, geo, setup, archerHits, result, errors, output }, null, 1));
  await browser.close();
  if (!ok) process.exitCode = 1;
})();
