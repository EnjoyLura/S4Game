/** 定向验证：商店页资源栏左对齐/图标不出框 + 标题横幅居中。
 * 断言（设计单位）：金币药丸中心 x≈-216（左缘对齐 -MAIN_W/2=-343）、图标左缘 ≥ 药丸左缘-127 内侧、
 * 钻石药丸 x≈+50、shopSign 世界坐标 x≈0。另出整页截图人工复核。 */
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
    localStorage.setItem('kw_save_v1', JSON.stringify({ gold: 301984, diamonds: 8278, heroes, squad: ['archer', 'pyro', 'volt', 'mora'], curHero: 'archer', unlocked: '1-1', stars: {}, debug: false, music: false, sfx: true }));
  });
  await page.goto(process.env.KW_QA_URL || 'https://kingdom-watch.pages.dev/');
  await page.waitForFunction(() => !!globalThis.cc?.director?.getScene(), null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const s = globalThis.cc.director.getScene();
    const find = (n) => { if (n.name === 'resource:diamond') return n; for (const c of n.children) { const r = find(c); if (r) return r; } };
    return !!find(s);
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);   // 等背景/横幅美术冷加载
  // 切到商店页签（资源栏五页共用已可断言；shopSign 仅商店页有）
  const tab0 = await page.evaluate(() => {
    const find = (n) => { if (n.name === 'tab0') return n; for (const c of n.children) { const r = find(c); if (r) return r; } };
    const n = find(globalThis.cc.director.getScene()), r = document.querySelector('canvas').getBoundingClientRect();
    const size = globalThis.cc.view.getVisibleSize(), p = n.worldPosition;
    return { x: r.left + (0.5 + p.x / size.width) * r.width, y: r.top + (0.5 - p.y / size.height) * r.height };
  });
  await page.mouse.click(tab0.x, tab0.y);
  await page.waitForTimeout(1800);   // 等商店页重建 + 横幅美术
  const geo = await page.evaluate(() => {
    const find = (n) => { if (n.name === 'resource:diamond') return n; for (const c of n.children) { const r = find(c); if (r) return r; } };
    const diamond = find(globalThis.cc.director.getScene());
    const wallet = diamond.parent;
    const gold = wallet.getChildByName('resource:gold');
    const iconOf = (row) => row.children.find(c => c.getComponent(globalThis.cc.Sprite));
    const findName = (n, nm) => { if (n.name === nm) return n; for (const c of n.children) { const r = findName(c, nm); if (r) return r; } };
    const sign = findName(globalThis.cc.director.getScene(), 'shopSign');
    const wp = (n) => n.worldPosition.x;
    const iconPill = (row) => { const ic = iconOf(row); return { x: ic.position.x, left: ic.position.x - 25, pillLeft: -127 }; };
    return {
      goldX: wp(gold), diamondX: wp(diamond),
      goldIcon: iconPill(gold), diamondIcon: iconPill(diamond),
      signX: sign ? wp(sign) : null,
      goldText: gold.getChildByName('resourceAmount').getComponent(globalThis.cc.Label).string,
    };
  });
  await page.screenshot({ path: path.join(output, 'shop_ui_check.png') });
  const inside = (ic) => ic.left >= ic.pillLeft + 1;
  const ok = errors.length === 0
    && Math.abs(geo.goldX - -216) < 2 && Math.abs(geo.diamondX - 50) < 2
    && inside(geo.goldIcon) && inside(geo.diamondIcon)
    && geo.signX !== null && Math.abs(geo.signX) < 1;
  console.log(JSON.stringify({ ok, geo, errors, output }));
  await browser.close();
  if (!ok) process.exitCode = 1;
})();
