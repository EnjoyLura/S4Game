/**
 * GM 后台（调试用）：按系统分类页签（战斗/英雄/卡片/经济/存档/系统）
 * 入口：左列 GM 浮钮（save.debug 或 URL ?gm=1 时显示）
 * 打开即冻结战斗（running→paused），关闭恢复；升级三选一队列在恢复时弹出
 */
import { game, Node, view } from 'cc';
import { expNeed, LO, PAL } from '../config/GameConfig';
import { M0_POOL, RARITY_COLOR } from '../config/Cards';
import { loadSave, saveSave } from '../core/SaveData';
import { BattleDirector } from '../battle/BattleDirector';
import { btn, CA, dimLayer, gpanel, label, N, WX, WY } from './UIKit';

const TABS = ['战斗', '英雄', '卡片', '经济', '存档', '系统'] as const;
type Tab = (typeof TABS)[number];

/** 带 URL 参数重载（dpr 覆盖 / 强制 GM 入口） */
function reloadWith(key: string, val: string): void {
  try {
    const u = new URL(location.href);
    u.searchParams.set(key, val);
    location.href = u.toString();
  } catch {
    location.reload();
  }
}

export class GmPanel {
  private root: Node;
  private layer: Node;
  private btnNode: Node;
  private forceShow: boolean;
  private tab: Tab = '战斗';
  private resumeOnClose = false;
  private panelRef: Node | null = null;
  private body: Node | null = null;
  private ry = 0;

  constructor(parent: Node, private dir: BattleDirector) {
    this.root = N('GMRoot', parent, 0, 0);
    this.forceShow = (() => {
      try { return new URLSearchParams(location.search).get('gm') === '1'; } catch { return false; }
    })();
    // debug:false 时隐藏入口（?gm=1 可强制唤出，避免误触锁死）
    this.btnNode = btn(this.root, WX(24, 60), WY(400, 60), 60, 60, 'GM', CA(PAL.purple, 0.92), () => this.open(), 26);
    this.btnNode.active = loadSave().debug || this.forceShow;
    this.layer = N('GMLayer', this.root, 0, 0);
  }

  open(): void {
    if (this.layer.children.length > 0) return;
    // 三选一/结算期间不开 GM（直接胜利等操作在这些状态下会被拒，避免误触无反馈）
    if (this.dir.state !== 'running' && this.dir.state !== 'prepare' && this.dir.state !== 'paused') return;
    if (this.dir.state === 'running') {
      this.dir.state = 'paused';
      this.resumeOnClose = true;
    }
    this.btnNode.active = false; // 浮钮藏起，避免透过遮罩压在页签上
    this.rebuild();
  }

  close(): void {
    if (this.layer.children.length === 0) return;
    this.layer.destroyAllChildren();
    this.panelRef = null;
    this.body = null;
    this.btnNode.active = loadSave().debug || this.forceShow;
    if (this.resumeOnClose) {
      this.resumeOnClose = false;
      this.dir.gmResume();
    }
  }

  /** 每帧同步浮钮可见性：面板开着 / 三选一 / 结算期间一律隐藏（BattleDirector.update 驱动） */
  syncVisibility(): void {
    const want = this.layer.children.length === 0 &&
      (this.dir.state === 'running' || this.dir.state === 'prepare' || this.dir.state === 'paused') &&
      (loadSave().debug || this.forceShow);
    if (this.btnNode.active !== want) this.btnNode.active = want;
  }

  /* ---------- 终结动作：先关面板再触发（胜利/失败面板在 GM 层之下） ---------- */
  private actWin(): void {
    this.close();
    this.dir.gmWin();
  }

  private actLose(): void {
    this.close();
    this.dir.gmLose();
  }

  private actExit(): void {
    this.close();
    this.dir.gmExit();
  }

  /* ---------- 面板骨架 ---------- */
  private rebuild(): void {
    this.layer.destroyAllChildren();
    dimLayer(this.layer, 0.62);
    const ph = 900;
    const panel = gpanel(this.layer, 0, WY(210, ph), 690, ph, CA(PAL.dark, 0.97), PAL.purple, 3, 16);
    this.panelRef = panel;

    label(panel, -60, ph / 2 - 52, 'GM 后台', { size: 32, color: PAL.purple, bold: true });
    btn(panel, 290, ph / 2 - 52, 64, 64, '×', CA(PAL.red, 0.9), () => this.close(), 28);

    // 页签行
    const tw = 100, gap = 8;
    const x0 = -(TABS.length * tw + (TABS.length - 1) * gap) / 2 + tw / 2;
    TABS.forEach((t, i) => {
      const act = t === this.tab;
      const n = gpanel(panel, x0 + i * (tw + gap), ph / 2 - 132, tw, 60,
        act ? CA(PAL.purple, 0.95) : CA(PAL.dark2, 0.92), act ? PAL.gold : '#FFFFFF33', 2, 12);
      label(n, 0, 0, t, { size: 24, color: act ? PAL.ink : '#C9D6DF', bold: true });
      n.on(Node.EventType.TOUCH_END, () => { this.tab = t; this.rebuild(); });
    });

    const B = N('GmBody', panel, 0, 0);
    this.body = B;
    if (this.tab === '战斗') this.tabBattle(B);
    else if (this.tab === '英雄') this.tabHero(B);
    else if (this.tab === '卡片') this.tabCards(B);
    else if (this.tab === '经济') this.tabEconomy(B);
    else if (this.tab === '存档') this.tabSave(B);
    else this.tabSystem(B);
  }

  private refresh(): void {
    if (this.panelRef) this.rebuild();
  }

  /* ---------- 行布局助手 ---------- */
  private row3(B: Node, defs: Array<{ t: string; cb: () => void; danger?: boolean }>): void {
    const xs = [-218, 0, 218];
    defs.forEach((d, i) =>
      btn(B, xs[i], this.ry, 196, 64, d.t, CA(d.danger ? PAL.red : PAL.parch, 0.94), d.cb, 22));
    this.ry -= 80;
  }

  private wide(B: Node, t: string, cb: () => void, danger = false): void {
    btn(B, 0, this.ry, 636, 64, t, CA(danger ? PAL.red : PAL.parch, 0.94), cb, 24);
    this.ry -= 80;
  }

  private infoBox(B: Node, text: string, h = 140, size = 17): void {
    label(B, 0, this.ry - h / 2 + 12, text, { size, color: '#9FE8C0', w: 656, h, align: 'left', lineHeight: size + 6 });
  }

  /* ---------- 战斗 ---------- */
  private tabBattle(B: Node): void {
    this.ry = 268;
    this.row3(B, [
      { t: '刷怪×1', cb: () => { this.dir.gmSpawn(1); this.refresh(); } },
      { t: '刷怪×10', cb: () => { this.dir.gmSpawn(10); this.refresh(); } },
      { t: '刷怪×30', cb: () => { this.dir.gmSpawn(30); this.refresh(); } },
    ]);
    this.row3(B, [
      { t: '全清怪物', cb: () => { this.dir.gmKillAll(); this.refresh(); } },
      { t: '跳过本波', cb: () => { this.dir.gmSkipWave(); this.refresh(); } },
      { t: '切换倍速', cb: () => this.dir.toggleSpeed() },
    ]);
    this.row3(B, [
      { t: '耐久回满', cb: () => { this.dir.gmHealLine(); this.refresh(); } },
      { t: '护盾+1000', cb: () => { this.dir.gmShield(1000); this.refresh(); } },
      { t: '清空护盾', cb: () => { this.dir.gmShield(0); this.refresh(); } },
    ]);
    this.row3(B, [
      { t: '直接胜利', cb: () => this.actWin() },
      { t: '直接失败', danger: true, cb: () => this.actLose() },
      { t: '回主菜单', cb: () => this.actExit() },
    ]);
    const d = this.dir;
    this.infoBox(B,
      `状态 ${d.state}  波次 ${d.waves.waveNum}/${d.waves.total}  场上怪 ${d.mgr.aliveCount}\n` +
      `耐久 ${Math.ceil(d.line.hp)}/${d.line.maxHp}  护盾 ${Math.round(d.line.shield)}  倍速 ×${d.speed}`);
  }

  /* ---------- 英雄 ---------- */
  private tabHero(B: Node): void {
    this.ry = 268;
    this.row3(B, [
      { t: '升级×1', cb: () => { this.dir.gmLevelUp(1); this.refresh(); } },
      { t: '升级×5', cb: () => { this.dir.gmLevelUp(5); this.refresh(); } },
      { t: '升级×10', cb: () => { this.dir.gmLevelUp(10); this.refresh(); } },
    ]);
    this.row3(B, [
      { t: '大招充满', cb: () => { this.dir.gmUltCharge(this.dir.hero.chargeMax); this.refresh(); } },
      { t: '清空充能', cb: () => { this.dir.gmUltCharge(0); this.refresh(); } },
      { t: '技能CD清零', cb: () => { this.dir.gmSkillReady(); this.refresh(); } },
    ]);
    const h = this.dir.hero;
    this.infoBox(B,
      `等级 ${this.dir.heroLevel}  经验 ${Math.floor(this.dir.xp)}/${expNeed(this.dir.heroLevel)}\n` +
      `攻击 ${Math.round(h.effAtk)}  攻速 ${h.stats.aspd}/s  射程 ${h.stats.range}  技能射程 ${h.stats.skillRange}\n` +
      `暴击 ${Math.round(h.stats.critRate * 100)}%  暴伤 ×${h.stats.critMul}  连射 ${h.stats.serial}  齐射 ${h.stats.fan}\n` +
      `充能 ${Math.floor(h.charge)}/${h.chargeMax}  技能CD ${Math.max(0, h.skillCd).toFixed(1)}s`);
  }

  /* ---------- 卡片 ---------- */
  private tabCards(B: Node): void {
    this.ry = 272;
    for (let i = 0; i < M0_POOL.length; i += 2) {
      for (let j = 0; j < 2 && i + j < M0_POOL.length; j++) {
        this.cardCell(B, -166 + j * 332, this.ry, M0_POOL[i + j]);
      }
      this.ry -= 76;
    }
    const learned = M0_POOL.filter(c => (this.dir.stacks[c.id] || 0) > 0).length;
    this.infoBox(B, `已学 ${learned}/${M0_POOL.length} 种；+1/+5 直接生效（不走三选一），面板实时刷新`, 60, 16);
  }

  private cardCell(B: Node, x: number, y: number, def: (typeof M0_POOL)[number]): void {
    const cell = gpanel(B, x, y, 320, 68, CA('#232B36', 0.95), RARITY_COLOR[def.rarity], 2, 10);
    const n = this.dir.stacks[def.id] || 0;
    label(cell, -94, 0, def.name, { size: 19, color: PAL.parch, w: 132, align: 'left' });
    label(cell, 8, 0, `${n}/${def.maxStacks}`, { size: 16, color: n > 0 ? PAL.gold : '#8A93A0', w: 60 });
    btn(cell, 74, 0, 52, 52, '+1', CA(PAL.parch, 0.92), () => { this.dir.gmLearnCard(def.id, 1); this.refresh(); }, 20);
    btn(cell, 130, 0, 52, 52, '+5', CA(PAL.parch, 0.92), () => { this.dir.gmLearnCard(def.id, 5); this.refresh(); }, 20);
  }

  /* ---------- 经济 ---------- */
  private tabEconomy(B: Node): void {
    this.ry = 268;
    this.row3(B, [
      { t: '金币+1k', cb: () => { this.dir.gmAddGold(1000); this.refresh(); } },
      { t: '金币+1w', cb: () => { this.dir.gmAddGold(10000); this.refresh(); } },
      { t: '金币+10w', cb: () => { this.dir.gmAddGold(100000); this.refresh(); } },
    ]);
    this.row3(B, [
      { t: '钻石+10', cb: () => { this.dir.gmAddDiamond(10); this.refresh(); } },
      { t: '钻石+100', cb: () => { this.dir.gmAddDiamond(100); this.refresh(); } },
      { t: '钻石+1000', cb: () => { this.dir.gmAddDiamond(1000); this.refresh(); } },
    ]);
    this.row3(B, [
      { t: '解锁倍速', cb: () => { const s = loadSave(); s.speedUnlocked = true; saveSave(); this.refresh(); } },
      { t: '星级全满', cb: () => { const s = loadSave(); s.stars['1-1'] = 3; s.stars['1-2'] = 3; saveSave(); this.refresh(); } },
      { t: '切调试开关', cb: () => { const s = loadSave(); s.debug = !s.debug; saveSave(); this.btnNode.active = s.debug || this.forceShow; this.refresh(); } },
    ]);
    const s = loadSave();
    this.infoBox(B,
      `存档金币 ${s.gold}  钻石 ${s.diamonds}（战局内金币 ${Math.floor(this.dir.goldEarned)} 不入档）\n` +
      `星级 ${JSON.stringify(s.stars)}  解锁至 ${s.unlocked}\n` +
      `倍速解锁 ${s.speedUnlocked}  调试 ${s.debug}  音乐 ${s.music}  音效 ${s.sfx}`);
  }

  /* ---------- 存档 ---------- */
  private tabSave(B: Node): void {
    this.ry = 268;
    this.row3(B, [
      { t: '保存存档', cb: () => { saveSave(); this.refresh(); } },
      { t: '重载页面', cb: () => location.reload() },
      { t: '带参重启', cb: () => reloadWith('gm', '1') },
    ]);
    this.wide(B, '清空存档并重启', () => {
      try { localStorage.removeItem('kw_save_v1'); } catch { /* 忽略 */ }
      location.reload();
    }, true);
    let json = '';
    try { json = JSON.stringify(loadSave(), null, 1); } catch { json = '序列化失败'; }
    label(B, 0, -150, json, { size: 15, color: '#9FE8C0', w: 656, h: 260, align: 'left', lineHeight: 19 });
  }

  /* ---------- 系统 ---------- */
  private tabSystem(B: Node): void {
    this.ry = 268;
    this.row3(B, [
      { t: 'dpr=1', cb: () => reloadWith('dpr', '1') },
      { t: 'dpr=2', cb: () => reloadWith('dpr', '2') },
      { t: 'dpr=3', cb: () => reloadWith('dpr', '3') },
    ]);
    this.wide(B, '以 ?gm=1 重启（强制显示 GM 入口）', () => reloadWith('gm', '1'));
    const c = (game as unknown as { canvas?: HTMLCanvasElement }).canvas;
    const dpr = c && c.clientWidth > 0 ? c.width / c.clientWidth : 0;
    const vs = view.getVisibleSize();
    this.infoBox(B,
      `画布 ${c ? `${c.width}x${c.height}` : '?'}  CSS ${c ? `${c.clientWidth}x${c.clientHeight}` : '?'}  实际dpr ${dpr.toFixed(2)}\n` +
      `可视区 ${Math.round(vs.width)}x${Math.round(vs.height)}  half ${Math.round(LO.half)}  safeTop ${Math.round(LO.safeTop)}  safeBottom ${Math.round(LO.safeBottom)}\n` +
      `调试开关关闭后入口隐藏，可用 URL 参数 ?gm=1 强制唤出；?dpr=N 覆盖渲染倍率`, 170, 16);
  }
}
