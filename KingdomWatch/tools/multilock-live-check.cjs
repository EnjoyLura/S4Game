/** 定向验证：重弩手「多目标锁定」卡（multi_lock，穿颅射击连狙 +2 发/层）。
 * 只上阵狙击手；清场刷 1 只定身坦克怪(y=50，距英雄 ~741px<技能索敌 900)；
 * 包一层 snipeShot（技能连狙专用，普攻不走它）按阶段计数：
 *   A 基线 0 层 → 预期 6 发；B gmLearnCard ×1 → 预期 8 发；C ×2 → 预期 10 发。
 * 每阶段 gmSkillReady 触发施放（skillCd 先压到 999 抑制开局自然施放，CD 14s 不会串台）。
 * 末尾调 panels.showTips('skill') 读「连续 N 狙」面板文案：修复前面板恒显 sc.shots（Bug 本体），
 * 修复后应随卡叠加（6/8/10）。ok 只断言战斗侧发数；面板文案输出供人工比对。 */
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
    localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 500, diamonds: 20, heroes, squad: ['sniper'], curHero: 'sniper', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
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
    d.line.hp = d.line.maxHp = 1e7;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    const sn = d.heroes.find(h => h.id === 'sniper');
    sn.skillCd = 999;   // 抑制开局自然施放：各阶段统一用 gmSkillReady 触发
    const diag = { phase: 'A', shots: [] };
    globalThis.__mlDiag = diag;
    const orig = sn.snipeShot;
    sn.snipeShot = function (target, projs, mul, ignoreRes) {
      diag.shots.push({ phase: diag.phase, t: performance.now() | 0 });
      return orig.call(this, target, projs, mul, ignoreRes);
    };
    return { mobId: m.def.id, skillShots: sn.stats.skillShots, skillLv: sn.stats.skillLv, skillRange: sn.stats.skillRange };
  });
  const phase = async (name, extra) => {
    await page.evaluate(([nm, ex]) => {
      const d = globalThis.__kw, diag = globalThis.__mlDiag;
      // gmKillAll/击杀经验可能排队三选一冻结战斗（state='pick'）：清队列恢复 running 再触发施放
      d.pickQueue = 0;
      if (d.state === 'pick') { d.panels.closeAll(); d.state = 'running'; }
      if (ex && ex.learn) d.gmLearnCard('multi_lock', ex.learn);
      d.gmSkillReady();
      diag.phase = nm;
    }, [name, extra]);
    await page.waitForTimeout(extra && extra.wait || 3500);
  };
  await phase('A', { wait: 3500 });
  await phase('B', { learn: 1, wait: 3500 });
  await phase('C', { learn: 1, wait: 4000 });
  const result = await page.evaluate(() => {
    const d = globalThis.__kw, diag = globalThis.__mlDiag;
    const sn = d.heroes.find(h => h.id === 'sniper');
    const count = ph => diag.shots.filter(s => s.phase === ph).length;
    // 面板文案：直接调 showTips 后扫 Label（与玩家点技能图标看到的一致）
    let panelRows = null;
    try {
      d.panels.showTips('skill', sn, { maxHp: 1 });
      const labels = [];
      const walk = n => {
        const l = n.getComponent && n.getComponent(globalThis.cc.Label);
        if (l && l.string) labels.push(l.string);
        for (const c of n.children) walk(c);
      };
      walk(d.panels.modalRoot || globalThis.cc.director.getScene());
      panelRows = labels.filter(s => /狙|窗口|冷却/.test(s)).slice(0, 8);
      d.panels.closeAll();
    } catch (e) { panelRows = ['ERR:' + e.message]; }
    const m = d.mgr.list.find(x => !x.dead && x.def.speed === 0);
    return {
      counts: { A: count('A'), B: count('B'), C: count('C'), other: diag.shots.filter(s => !'ABC'.includes(s.phase)).length },
      skillShots: sn.stats.skillShots,
      stackRecorded: (globalThis.__kw.stacks && globalThis.__kw.stacks.multi_lock) || 0,
      panelRows, mobAlive: !!m, mobY: m ? Math.round(m.node.position.y) : null,
    };
  });
  await page.screenshot({ path: path.join(output, 'multilock_check.png') });
  const ok = errors.length === 0 && result.counts.A === 6 && result.counts.B === 8 && result.counts.C === 10 && result.mobAlive;
  console.log(JSON.stringify({ ok, geo, setup, result, errors }, null, 1));
  await browser.close();
  if (!ok) process.exitCode = 1;
})();
