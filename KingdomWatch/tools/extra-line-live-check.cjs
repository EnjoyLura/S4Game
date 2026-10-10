/** 定向验证：重弩手「额外枪线」卡（extra_line，大招额外 +1 条枪线/层）。
 * 只上阵狙击手；清场刷 3 只定身坦克怪（血量 9e6/8e6/7e6 递减，锁定/补线目标确定性），
 * 包一层 projs.fire 按 spec.ult 计数并把每发弹道方向归因到怪（dot 最大者）：
 *   A 基线 0 层 → 预期 1 发（主目标 = 血量最高怪）；
 *   B gmLearnCard ×1 → 预期 2 发（+ 其余血量最高 = 第二怪）；
 *   C ×2 → 预期 3 发（+ 第三怪）。
 * 每阶段 gmUltCharge(1e9)+tryCastUlt 触发（锁定 0.5s 后同帧全部出膛）。
 * 末尾调 panels.showTips('ult') 抓「形态/目标」面板文案，人工比对枪线数是否随卡显示。 */
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
  await page.evaluate(() => { globalThis.__kw.gmKillAll(); });
  await page.waitForTimeout(800);   // 等死怪出列
  const setup = await page.evaluate(() => {
    const d = globalThis.__kw;
    globalThis.__spawnLog = [];
    const origSpawn = d.mgr.spawn.bind(d.mgr);
    d.mgr.spawn = function (def) {
      const r = origSpawn(def);
      globalThis.__spawnLog.push({ id: def && def.id, t: performance.now() | 0, stack: new Error().stack.split('\n').slice(2, 6).map(s => s.trim().replace(/^at /, '')).join(' <- ') });
      return r;
    };
    d.gmSpawn(3);
    const mobs = d.mgr.list.filter(x => !x.dead).slice(0, 3);
    const spots = [[-200, 50, 9e6], [0, 60, 8e6], [200, 50, 7e6]];   // hp 递减：锁定=怪0，补线依次怪1/怪2
    mobs.forEach((m, i) => {
      m.def = { ...m.def, speed: 0, exp: 0 };
      m.baseX = spots[i][0];
      m.node.setPosition(spots[i][0], spots[i][1], 0);
      m.hp = m.maxHp = spots[i][2];
    });
    d.line.hp = d.line.maxHp = 1e7;
    d.speed = 1; d.hitStopT = d.hitStopCd = 0;
    const sn = d.heroes.find(h => h.id === 'sniper');
    sn.skillCd = 999;   // 抑制技能施放噪声（计数只认 spec.ult）
    const diag = { phase: 'A', fires: [], leads: [], fub: [] };
    globalThis.__elDiag = diag;
    globalThis.__pid = 0;
    const tag = m => (m.__pid = m.__pid || ++globalThis.__pid);
    const orig = d.projs.fire.bind(d.projs);
    d.projs.fire = function (spec) {
      if (spec && spec.ult === true) diag.fires.push({ phase: diag.phase, x: spec.x, y: spec.y, dirX: spec.dirX, dirY: spec.dirY });
      return orig(spec);
    };
    const origLead = sn.lead.bind(sn);
    sn.lead = function (t, s) {   // 大招弹速 1100（普攻 1140/技能 1800 不入记录）
      const r = origLead(t, s);
      if (s === 1100) diag.leads.push({ phase: diag.phase, tx: Math.round(t.x), ty: Math.round(t.y), nx: Math.round(t.node.position.x), ny: Math.round(t.node.position.y), dead: t.dead, st: t.state });
      return r;
    };
    const origFub = sn.fireUltBolt.bind(sn);
    sn.fireUltBolt = function (projs, mgr, locked) {
      const alive = mgr.list.filter(m => !m.dead);
      diag.fub = diag.fub || [];
      diag.fub.push({
        phase: diag.phase,
        listLen: mgr.list.length,
        uniq: new Set(mgr.list).size,
        pids: mgr.list.map(tag),
        locked: { hp: locked.hp, x: Math.round(locked.x), y: Math.round(locked.y), pid: tag(locked) },
        candidates: alive.map(m => ({ hp: m.hp, x: Math.round(m.x), y: Math.round(m.y), id: m.def.id, pid: tag(m), ref: m === locked ? 'LOCKED' : 'other' })),
      });
      return origFub(projs, mgr, locked);
    };
    return {
      mobs: mobs.map((m, i) => ({ i, id: m.def.id, hp: m.hp, x: Math.round(m.node.position.x), y: Math.round(m.node.position.y), pid: tag(m) })),
      afterSpawn: { listLen: d.mgr.list.length, uniq: new Set(d.mgr.list).size, pids: d.mgr.list.map(tag), poolLen: d.mgr.pool.length },
      spawnLog: globalThis.__spawnLog,
      ultBolts: sn.stats.ultBolts, state: d.state,
    };
  });
  const phase = async (name, extra) => {
    await page.evaluate(([nm, ex]) => {
      const d = globalThis.__kw, diag = globalThis.__elDiag;
      d.pickQueue = 0;
      if (d.state === 'pick') { d.panels.closeAll(); d.state = 'running'; }
      if (ex && ex.learn) d.gmLearnCard('extra_line', ex.learn);
      d.gmUltCharge(1e9);
      diag.phase = nm;
      const cast = d.tryCastUlt(0);
      globalThis.__elCast = cast;
    }, [name, extra]);
    await page.waitForTimeout(2500);   // 锁定 0.5s + 全部弹同帧出膛
  };
  await phase('A', {});
  await phase('B', { learn: 1 });
  await phase('C', { learn: 1 });
  const result = await page.evaluate(() => {
    const d = globalThis.__kw, diag = globalThis.__elDiag;
    const sn = d.heroes.find(h => h.id === 'sniper');
    const mobs = d.mgr.list.filter(x => !x.dead).slice(0, 3).map((m, i) => ({ i, id: m.def.id, x: m.node.position.x, y: m.node.position.y }));
    const aim = f => {
      let best = null, bd = -2;
      for (const m of mobs) {
        const dx = m.x - f.x, dy = m.y - f.y, L = Math.hypot(dx, dy) || 1;
        const dot = (dx / L) * f.dirX + (dy / L) * f.dirY;
        if (dot > bd) { bd = dot; best = m.i; }
      }
      return best;
    };
    const aims = {};
    for (const f of diag.fires) (aims[f.phase] = aims[f.phase] || []).push(aim(f));
    // 面板文案：直接调 showTips('ult') 后扫 Label（与玩家点大招图标看到的一致）
    let panelRows = null;
    try {
      d.panels.showTips('ult', sn, { maxHp: 1 });
      const labels = [];
      const walk = n => {
        const l = n.getComponent && n.getComponent(globalThis.cc.Label);
        if (l && l.string) labels.push(l.string);
        for (const c of n.children) walk(c);
      };
      walk(d.panels.modalRoot || globalThis.cc.director.getScene());
      panelRows = labels.filter(s => /线|锁定|贯穿|血量|弹体/.test(s)).slice(0, 8);
      d.panels.closeAll();
    } catch (e) { panelRows = ['ERR:' + e.message]; }
    return {
      counts: { A: (aims.A || []).length, B: (aims.B || []).length, C: (aims.C || []).length },
      aims, ultBolts: sn.stats.ultBolts,
      fires: diag.fires.map(f => ({ phase: f.phase, x: Math.round(f.x), y: Math.round(f.y), dirX: +f.dirX.toFixed(3), dirY: +f.dirY.toFixed(3) })),
      leads: diag.leads,
      fub: diag.fub || [],
      mobsAtResult: mobs.map((m, i) => ({ i, id: m.id, x: Math.round(m.x), y: Math.round(m.y) })),
      stackRecorded: (d.stacks && d.stacks.extra_line) || 0,
      cast: globalThis.__elCast, panelRows,
      mobsAlive: mobs.length,
    };
  });
  await page.screenshot({ path: path.join(output, 'extra_line_check.png') });
  const ok = errors.length === 0 && result.counts.A === 1 && result.counts.B === 2 && result.counts.C === 3
    && JSON.stringify(result.aims.A) === '[0]' && JSON.stringify(result.aims.B) === '[0,1]' && JSON.stringify(result.aims.C) === '[0,1,2]'
    && result.mobsAlive === 3;
  console.log(JSON.stringify({ ok, setup, result, errors }, null, 1));
  await browser.close();
  if (!ok) process.exitCode = 1;
})();
