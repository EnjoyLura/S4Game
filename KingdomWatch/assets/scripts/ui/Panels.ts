/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Graphics, Node, tween, UIOpacity, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR } from '../config/Cards';
import { HERO_Y, LO, PAL } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroBase } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave } from '../core/SaveData';
import { btn, CA, dimLayer, gbar, gcircle, gpanel, gswitch, label, N, setText, WY, WYB, WX } from './UIKit';
import { artIcon, artSprite } from './Ux';

/** 奖励行文字兜底 → A2 图标（有美术时整座替换，失败保持 emoji） */
const REWARD_ICON: Record<string, string> = {
  '🪙': 'ui_icon_coin', 'EXP': 'ui_icon_exp', '💎': 'ui_icon_diamond',
  '🎁': 'ui_icon_chest', '🛡': 'ui_icon_equip',
};

interface PickCallbacks {
  onPick: (card: CardDef) => void;
  onRefreshRequest: () => void;
}

export class Panels {
  private modalRoot: Node;
  private pickAdLeft = 1;
  private pickDiaLeft = 1;

  constructor(parent: Node, private dir: BattleDirector) {
    this.modalRoot = new Node('ModalRoot');
    this.modalRoot.setParent(parent);
  }

  /** 三选一选择动画进行中（防连点、防刷新打断丢回调） */
  private picking = false;

  closeAll(): void {
    this.picking = false;
    this.modalRoot.destroyAllChildren();
  }

  /** 新的三选一弹窗打开时重置刷新次数（跨弹窗不共享 §3.8） */
  resetPickRefresh(): void {
    this.pickAdLeft = 1;
    this.pickDiaLeft = 1;
  }

  /* ---------- ② 三选一 ---------- */
  showPick(cards: CardDef[], _stacks: CardStacks, cb: PickCallbacks): void {
    this.closeAll();
    dimLayer(this.modalRoot);
    // 标题淡入（美术：撕纸金横幅，深墨字）
    const titleBg = gpanel(this.modalRoot, 0, WY(308, 88), 520, 88, CA(PAL.wood, 0.95), PAL.gold, 2.5, 14);
    artSprite(titleBg, 0, 0, 520, 88, 'ui_banner_title', { belowIdx: 0 });
    label(titleBg, 0, 0, '选择强化', { size: 34, color: '#4A3214', bold: true });
    const titleOp = titleBg.getComponent(UIOpacity) || titleBg.addComponent(UIOpacity);
    titleOp.opacity = 0;
    tween(titleOp).to(0.25, { opacity: 255 }).start();

    const xs = [22, 264, 506];
    const frames: Node[] = [];
    cards.forEach((card, i) => {
      const x = WX(xs[i], 222), y = WY(428, 360);
      const frame = gpanel(this.modalRoot, x, y, 222, 360, CA('#E9DFC2', 0.96), undefined, 0, 12);
      frames.push(frame);
      this.buildCard(frame, card);
      frame.on(Node.EventType.TOUCH_END, e => {
        e.propagationStopped = true;
        this.pickChoose(frame, frames.filter(f => f !== frame), card, cb);
      });
      // 入场：自下方滑入 + 淡入，逐张错峰
      const op = frame.getComponent(UIOpacity) || frame.addComponent(UIOpacity);
      op.opacity = 0;
      frame.setPosition(x, y + 70, 0);
      tween(frame).delay(i * 0.08)
        .to(0.3, { position: new Vec3(x, y, 0) }, { easing: 'cubicOut' }).start();
      tween(op).delay(i * 0.08).to(0.25, { opacity: 255 }).start();
    });

    label(this.modalRoot, 0, WY(818, 40),
      '当局剩余刷新：广告 ' + this.pickAdLeft + ' 次 · 钻石 ' + this.pickDiaLeft + ' 次',
      { size: 18, color: '#CFE3FF' });

    btn(this.modalRoot, WX(130, 300), WY(862, 76), 300, 76,
      '▶ 广告刷新', this.pickAdLeft > 0 ? PAL.green : '#5A6472', () => {
        if (this.picking || this.pickAdLeft <= 0) return;
        this.pickAdLeft--;
        AdService.showRewarded('pick_refresh', () => cb.onRefreshRequest(), () => { this.pickAdLeft++; });
      }, 24, true);
    btn(this.modalRoot, WX(460, 180), WY(862, 76), 180, 76,
      '💎2 钻石刷新', this.pickDiaLeft > 0 ? PAL.gold : '#5A6472', () => {
        if (this.picking || this.pickDiaLeft <= 0) return;
        const sv = loadSave();
        if (sv.diamonds < 2) return;
        sv.diamonds -= 2;
        this.pickDiaLeft--;
        cb.onRefreshRequest();
      }, 22, true);
  }

  /** 选择动画：选中卡弹跳、其余卡淡出，随后真实回调（三选一冻结期间 tween 仍走主循环时钟） */
  private pickChoose(chosen: Node, others: Node[], card: CardDef, cb: PickCallbacks): void {
    if (this.picking) return;
    this.picking = true;
    tween(chosen)
      .to(0.1, { scale: new Vec3(1.09, 1.09, 1) }, { easing: 'sineOut' })
      .to(0.09, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })
      .call(() => { this.picking = false; cb.onPick(card); })
      .start();
    for (const o of others) {
      const op = o.getComponent(UIOpacity) || o.addComponent(UIOpacity);
      tween(op).to(0.16, { opacity: 70 }).start();
    }
  }

  /** 卡面布局（扁平无美术；去「新」标与稀有度小字——用户要求：卡面只留 名称/图标/归属/描述）：
   *  顶部稀有度通栏色带 → 圆形图标座 → 右上归属角标（避开色带与图标座）→ 下半区大号加粗描述（shrink 防超框） */
  private buildCard(frame: Node, card: CardDef): void {
    const rarity = RARITY_COLOR[card.rarity];

    // ① 卡头稀有度色带（222×52 通栏扁平色板）
    const header = gpanel(frame, 0, 154, 222, 52, CA(rarity, 0.85), undefined, 0, 12);
    label(header, 0, 0, card.name, { size: 22, color: card.rarity === 'white' ? '#4A3214' : '#FFFFFF', bold: true, w: 208, h: 40, shrink: true });

    // ② 图标座 120 圆 + 内嵌 96 圆
    const gear = gcircle(frame, 0, 50, 60, CA('#2A3240', 1));
    const icon = gcircle(frame, 0, 50, 48, CA(rarity, 0.16));
    label(icon, 0, 0, card.id.slice(0, 2).toUpperCase(), { size: 26, color: card.rarity === 'white' ? '#E8E0C8' : rarity, bold: true });

    // ③ 右上归属角标（圆心 y94/r24：顶缘 118 离色带底 128 十分距；距图标座圆心 91 > 60+24）
    // 英雄卡贴头像图（同英雄页/编队/大招钮），全局卡保持文字（用户要求：三选一卡用上英雄头像）
    const ava = gcircle(frame, 80, 94, 24, CA('#2A3240', 1));
    if (card.owner === 'global') label(ava, 0, 0, '全', { size: 18, color: PAL.green, bold: true });
    else artSprite(ava, 0, 0, 48, 48, 'ui_avatar_' + card.owner, { sliced: false });

    // ④ 描述（18 号加粗，shrink 保证不超框）
    label(frame, 0, -95, card.desc, { size: 18, color: '#4A3214', bold: true, w: 206, h: 90, shrink: true, lineHeight: 26 });
  }

  /* ---------- 页签条（线稿④-1/④-2/⑤-1/⑥-1）：点页签本地重渲染当前面板（无边框规范：纯色板） ---------- */
  private tabsBar(tabs: string[], active: number, y: number, x0: number, w: number, gap: number, onSel: (i: number) => void): void {
    tabs.forEach((t, i) => {
      const x = WX(x0 + i * (w + gap), w), cy = WY(y, 72);
      const tab = gpanel(this.modalRoot, x, cy, w, 72, i === active ? CA(PAL.gold, 0.25) : CA('#14181E', 0.85), undefined, 0, 12);
      // 激活页签金底 → 亮金文字；未激活深蓝底 → 白字
      label(this.modalRoot, x, cy, t, { size: 20, color: i === active ? '#FFE08A' : '#FFFFFF' });
      if (i !== active) {
        const hit = N('tabHit' + i, this.modalRoot, x, cy, w, 72);
        hit.on(Node.EventType.TOUCH_END, e => { e.propagationStopped = true; onSel(i); });
      }
    });
  }

  /** 伤害统计行（线稿④-1⑤-1⑥-1）：整行水平居中（40..710），头像40..110 / 名称130起 / 占比条130..710，数值 W/K 格式化居中条内 */
  private statsRows(rows: DamageRow[], t0: number, step: number): void {
    rows.slice(0, 3).forEach((r, i) => {
      const t = t0 + i * step;
      const av = gcircle(this.modalRoot, WX(40, 70), WY(t, 70), 35, CA('#2A3240', 1));
      const avLbl = label(av, 0, 0, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      if (r.id === 'archer' || r.id === 'sniper')   // 英雄头像盖字（加载失败保持首字兜底）
        artSprite(av, 0, 0, 58, 58, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(this.modalRoot, WX(130, 220), WY(t + 2, 40), r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 220, h: 40, shrink: true });
      label(this.modalRoot, WX(570, 140), WY(t + 2, 40), (r.pct * 100).toFixed(2) + '%',
        { size: 18, color: PAL.orange, align: 'right', w: 140, h: 40, shrink: true });
      const barX = WX(130, 580);
      const bar = gbar(this.modalRoot, barX, WY(t + 44, 16), 580, 16, PAL.orange);   // 美术轨道+白填充染色
      bar.set(r.val > 0 ? r.pct : 0);
      label(this.modalRoot, barX, WY(t + 44, 16), fmtWk(r.val), { size: 14, color: '#FFFFFF', bold: true });
    });
  }

  /** 奖励图标行（整组水平居中，pitch 160）：[底色, 图标文字, 数值]（扁平无框——用户要求：有色圆座 + 图标/文字兜底） */
  private rewardIcons(y: number, items: [string, string, string][]): void {
    const pitch = 160, s = 96;
    items.forEach((it, i) => {
      const x = (i - (items.length - 1) / 2) * pitch;
      const c = gcircle(this.modalRoot, x, WY(y, s), 42, CA(it[0], 0.25));
      const iconId = REWARD_ICON[it[1]];
      if (iconId) artIcon(c, iconId, 60);
      else label(c, 0, 0, it[1], { size: it[1] === 'EXP' ? 20 : 34, color: '#FFFFFF', bold: true });
      label(this.modalRoot, x, WY(y + s + 4, 36), it[2], { size: 20, color: '#FFFFFF' });
    });
  }

  /* ---------- ④ 暂停（页签：奖励总览/伤害统计/设置，线稿④/④-1/④-2） ---------- */
  showPause(o: {
    onResume: () => void; onExit: () => void;
    music: boolean; sfx: boolean;
    onToggle: (k: 'music' | 'sfx', v: boolean) => void;
    tab?: number; speed: number; speedUnlocked: boolean; xp: number;
  }): void {
    const tab = o.tab ?? 0;
    this.closeAll();
    dimLayer(this.modalRoot);
    label(this.modalRoot, 0, WY(400, 90), '暂 停', { size: 46, color: '#FFFFFF', bold: true });
    this.tabsBar(['奖励总览', '伤害统计', '设置'], tab, 780, 25, 225, 10, t => this.showPause({ ...o, tab: t }));
    if (tab === 0) {
      label(this.modalRoot, 0, WY(470, 44), '— 已获得奖励 —', { size: 22, color: '#FFE08A' });
      this.rewardIcons(530, [
        [PAL.gold, '🪙', String(Math.floor(this.dir.goldEarned))],
        [PAL.green, 'EXP', String(o.xp)],
      ]);
    } else if (tab === 1) {
      label(this.modalRoot, 0, WY(470, 44), '— 伤害统计（本局） —', { size: 22, color: '#FFE08A' });
      this.statsRows(this.dir.dmgSvc.rows(), 520, 115);
    } else {
      // 设置页签：左右旋钮开关（线稿④-2）；音乐/音效切换即时生效并写存档；振动随战斗手感批次实装
      const mkRow = (y: number, name: string, gray: boolean, sw?: { on: boolean; onChange: (v: boolean) => void }) => {
        gpanel(this.modalRoot, WX(40, 670), WY(y, 60), 670, 60, CA('#14181E', 0.85), undefined, 0, 12);
        label(this.modalRoot, WX(60, 380), WY(y, 60), name,
          { size: 20, color: gray ? '#889099' : '#FFFFFF', align: 'left', w: 380, h: 40, shrink: true });
        gswitch(this.modalRoot, WX(590, 100), WY(y + 8, 44), 100, 44, sw ? sw.on : false,
          sw ? sw.onChange : undefined, !sw);
      };
      mkRow(496, '🎵 音乐', false, { on: o.music, onChange: v => o.onToggle('music', v) });
      mkRow(570, '🔊 音效', false, { on: o.sfx, onChange: v => o.onToggle('sfx', v) });
      mkRow(644, '📳 振动（未开放）', true);
      // 倍速行：循环按钮 1x/2x（非开关形态）
      gpanel(this.modalRoot, WX(40, 670), WY(718, 60), 670, 60, CA('#14181E', 0.85), undefined, 0, 12);
      label(this.modalRoot, WX(60, 380), WY(718, 60), '⏩ 战斗倍速' + (o.speedUnlocked ? '' : '（1-2 通关解锁）'),
        { size: 20, color: o.speedUnlocked ? '#FFFFFF' : '#889099', align: 'left', w: 380, h: 40, shrink: true });
      if (o.speedUnlocked) {
        btn(this.modalRoot, WX(590, 100), WY(726, 44), 100, 44, o.speed === 1.5 ? '1.5x' : '1x',
          o.speed === 1.5 ? PAL.green : '#5A6472',
          () => { this.dir.toggleSpeed(); this.showPause({ ...o, tab: 2, speed: this.dir.speed }); }, 18, true);
      } else {
        gswitch(this.modalRoot, WX(590, 100), WY(726, 44), 100, 44, false, undefined, true);
      }
    }
    btn(this.modalRoot, WX(50, 300), WY(880, 88), 300, 88, '⏻ 退出', PAL.gold, o.onExit, 22, true);
    btn(this.modalRoot, WX(400, 300), WY(880, 88), 300, 88, '▶ 继续战斗', PAL.green, o.onResume, 22, true);
  }

  /* ---------- ⑥ 胜利结算（页签：奖励总览/伤害统计，线稿⑥/⑥-1） ---------- */
  showWin(o: {
    stars: 1 | 2 | 3; gold: number; ratio: number; xp: number;
    onDouble: (done: (ok: boolean) => void) => void;
    onNext: () => void; onExit: () => void;
    tab?: number;
  }): void {
    const tab = o.tab ?? 0;
    this.closeAll();
    dimLayer(this.modalRoot);
    const winTitle = gpanel(this.modalRoot, 0, WY(340, 90), 520, 88, CA(PAL.wood, 0.9), PAL.gold, 2.5, 14);
    artSprite(winTitle, 0, 0, 520, 88, 'ui_banner_title', { belowIdx: 0 });
    label(winTitle, 0, 0, '挑战成功！', { size: 40, color: '#4A3214', bold: true });
    for (let i = 0; i < 3; i++) {
      const x = WX(217 + i * 110, 96);
      const lit = i < o.stars;
      const star = gcircle(this.modalRoot, x, WY(450, 96), 44,
        lit ? CA(PAL.gold, 0.35) : CA('#FFFFFF', 0.06),
        lit ? PAL.gold : '#FFFFFF33', 2.5);
      const glyph = label(star, 0, 0, '★', { size: 44, color: lit ? PAL.gold : '#666C77' });
      artSprite(star, 0, 0, 96, 96, lit ? 'ui_star' : 'ui_star_gray', { sliced: false, hideOnLoad: [glyph] });
    }
    label(this.modalRoot, 0, WY(558, 44), tab === 0 ? '— 已获得奖励 —' : '— 伤害统计（本局） —', { size: 22, color: '#FFE08A' });
    if (tab === 0) {
      this.rewardIcons(606, [[PAL.gold, '🪙', String(o.gold)], [PAL.green, 'EXP', String(o.xp)]]);
    } else {
      this.statsRows(this.dir.dmgSvc.rows(), 600, 120);
    }

    // 双倍广告按钮（与失败页复活按钮同位 580,714 120×120；美术绿圆钮，文字保留其上）
    const dbl = gcircle(this.modalRoot, WX(580, 120), WY(714, 120), 58, CA(PAL.green, 0.3));
    const dblTxt = label(dbl, 0, 0, '▶\n双倍', { size: 24, color: '#FFFFFF', bold: true });
    dbl.on(Node.EventType.TOUCH_END, e => {
      e.propagationStopped = true;
      o.onDouble(ok => {
        if (ok) {
          dbl.off(Node.EventType.TOUCH_END);
          setText(dblTxt, '已\n领取');
        }
      });
    });

    this.tabsBar(['奖励总览', '伤害统计'], tab, 840, 40, 330, 10, t => this.showWin({ ...o, tab: t }));
    btn(this.modalRoot, WX(50, 300), WY(940, 88), 300, 88, '下一关 ▶', PAL.green, o.onNext, 22, true);
    btn(this.modalRoot, WX(400, 300), WY(940, 88), 300, 88, '返回', PAL.gold, o.onExit, 22, true);
  }

  /* ---------- ⑤ 失败结算（含广告复活，与胜利双倍按钮同位；页签线稿⑤/⑤-1） ---------- */
  showLose(o: {
    goldFloor: number; reviveRatio: number; xp: number;
    onRevive: (done: (ok: boolean) => void) => void;
    onRetry: () => void; onExit: () => void;
    tab?: number;
  }): void {
    const tab = o.tab ?? 0;
    this.closeAll();
    dimLayer(this.modalRoot, 0.7, true);
    gpanel(this.modalRoot, 0, WY(340, 100), 590, 100, CA(PAL.red, 0.18), undefined, 0, 10);
    label(this.modalRoot, 0, WY(350, 80), '挑战失败', { size: 40, color: '#FFFFFF', bold: true });
    label(this.modalRoot, 0, WY(480, 44), tab === 0 ? '— 已获得奖励（保底 30%）—' : '— 伤害统计（本局） —', { size: 20, color: tab === 0 ? '#FFB0A0' : '#FFE08A' });
    if (tab === 0) {
      this.rewardIcons(528, [[PAL.gold, '🪙', String(o.goldFloor)], [PAL.green, 'EXP', String(o.xp)]]);
    } else {
      this.statsRows(this.dir.dmgSvc.rows(), 520, 110);
    }

    if (tab === 0) {
      label(this.modalRoot, 0, WY(668, 30),
        '复活：耐久 +30% · 不限次 · 不看广告即接受失败', { size: 16, color: '#CCCCCC' });
    }
    const rv = gcircle(this.modalRoot, WX(580, 120), WY(700, 120), 58, CA(PAL.green, 0.3));
    const rvTxt = label(rv, 0, 0, '▶\n复活\n+' + Math.round(o.reviveRatio * 100) + '%', { size: 20, color: '#FFFFFF', bold: true });
    rv.on(Node.EventType.TOUCH_END, e => {
      e.propagationStopped = true;
      o.onRevive(ok => {
        if (!ok) {
          setText(rvTxt, '稍后\n重试');
          tween(rv).to(0.3, { scale: new Vec3(0.92, 0.92, 1) }).to(0.3, { scale: new Vec3(1, 1, 1) }).start();
        }
      });
    });

    this.tabsBar(['奖励总览', '伤害统计'], tab, 840, 40, 330, 10, t => this.showLose({ ...o, tab: t }));
    btn(this.modalRoot, WX(50, 300), WY(940, 88), 300, 88, '↻ 再来一次', PAL.green, o.onRetry, 22, true);
    btn(this.modalRoot, WX(400, 300), WY(940, 88), 300, 88, '返回', PAL.gold, o.onExit, 22, true);
  }

  /* ---------- ③ 伤害统计（不暂停；无遮罩、贴统计图标右侧、点空白关闭，与属性Tips同规范） ---------- */
  showStats(rows: DamageRow[]): void {
    this.closeAll();
    // 全屏透明捕获层：点任意空白处关闭（不加变暗遮罩）
    const catcher = N('statsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll());

    const w = 360, hh = 470;
    // 锚定统计图标（HUD 左列 WX(24,60) WY(320,60)）：面板左缘贴图标右缘，顶对齐
    const iconCX = WX(24, 60), iconCY = WY(320, 60);
    let px = iconCX + 30 + 16 + w / 2;
    let py = iconCY + 30 - hh / 2;
    px = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, px));
    py = Math.max(-LO.half + hh / 2 + 8, Math.min(LO.half - hh / 2 - 8, py));

    const statsPanel = gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.94), undefined, 0, 14);
    label(this.modalRoot, px, py + hh / 2 - 40, '— 伤害统计 —', { size: 22, color: '#FFE08A', w: w, h: 30 });   // 全宽盒居中 + 上内边距 40（用户调整）
    // 行几何：头像/百分比左右内边距相等（16）：头像圆心 = 左缘+51，百分比盒右缘 = 右缘-16
    rows.slice(0, 4).forEach((r, i) => {
      const cyAv = py + hh / 2 - 109 - i * 100;
      const cyTx = py + hh / 2 - 101 - i * 100;
      const cxAv = px - w / 2 + 51;
      gcircle(this.modalRoot, cxAv, cyAv, 35, CA('#2A3240', 1));
      const avLbl = label(this.modalRoot, cxAv, cyAv, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      if (r.id === 'archer' || r.id === 'sniper')
        artSprite(this.modalRoot, cxAv, cyAv, 58, 58, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(this.modalRoot, px - w / 2 + 192, cyTx, r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 150, h: 40, shrink: true });
      label(this.modalRoot, px + w / 2 - 66, cyTx, (r.pct * 100).toFixed(2) + '%',
        { size: 18, color: PAL.orange, align: 'right', w: 100, h: 40, shrink: true });
      const barX = px - w / 2 + 229.5, barY = py + hh / 2 - 130 - i * 100;
      const bar = gbar(this.modalRoot, barX, barY, 225, 16, PAL.orange);
      bar.set(r.val > 0 ? r.pct : 0);
      label(this.modalRoot, barX, barY, fmtWk(r.val), { size: 14, color: '#FFFFFF', bold: true });
    });
    label(this.modalRoot, px, py - hh / 2 + 28, '点击空白处关闭', { size: 12, color: '#888888' });
  }

  /* ---------- ⑧ 属性Tips：无遮罩、贴图标侧、点空白关闭、带索敌范围圈（线稿⑧⑦） ---------- */
  showTips(kind: 'atk' | 'skill' | 'ult', hero: HeroBase, line: { maxHp: number }, ultIdx = 0): void {
    void line;
    this.closeAll();
    // 全屏透明捕获层：点任意空白处关闭（不加变暗遮罩，§3.11 战斗不暂停）
    const catcher = N('tipsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll());

    // 索敌范围圈：以英雄为圆心，半透明填充 + 圈线（线稿⑦）；skillRange=9999 表示全场（狙击），不画圈
    const R = kind === 'atk' ? hero.stats.range : kind === 'skill' ? hero.stats.skillRange : 0;
    if (R > 0 && R < 2000) {
      const rc = N('range', this.modalRoot, hero.x, HERO_Y + 30, R * 2, R * 2);
      const rg = rc.addComponent(Graphics);
      const col = kind === 'atk' ? PAL.gold : PAL.blue;
      rg.fillColor = CA(col, 0.05);
      rg.strokeColor = CA(col, 0.8);
      rg.lineWidth = 3;
      rg.circle(0, 0, R);
      rg.fill();
      rg.stroke();
      rc.on(Node.EventType.TOUCH_END, () => this.closeAll()); // 圈内点按同样视为"空白处"
    }

    const h = hero.stats;
    const isArcher = hero.id === 'archer';
    const iconY = WYB(126, 46);
    let px: number, py: number, w = 300, hh = 272, title: string;
    let rows: [string, string][];
    if (kind === 'atk') {
      title = isArcher ? '🏹 普攻 · 风刃射击' : '🎯 普攻 · 重弩狙击';
      rows = [
        ['伤害', String(Math.round(h.atk * h.atkMul))],
        ['攻速', h.aspd.toFixed(1) + ' 次/秒'],
        ['索敌范围', String(Math.round(h.range))],
        ['弹道', (1 + h.serial) + ' 支' + (h.fan > 0 ? ' +' + h.fan + ' 齐射' : '')],
        ['暴击', Math.round(h.critRate * 100) + '% / ' + Math.round(h.critMul * 100) + '%'],
        ['目标', '最靠下'],
      ];
      px = hero.x - 27 + 23 + 16 + w / 2;
      py = iconY + 23 + 16 + hh / 2;
    } else if (kind === 'skill') {
      if (isArcher) {
        title = '⚡ 技能 · 强化箭矢';
        rows = [
          ['效果', '接下来 6 次普攻强化'],
          ['强化伤害', Math.round(h.atk * h.atkMul * 1.5) + '（×1.5）'],
          ['强化特性', '金色贯穿 · 攻速+30%'],
          ['冷却时间', hero.skillCd > 0 ? hero.skillCd.toFixed(1) + ' 秒' : '就绪'],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else {
        title = '⚡ 技能 · 穿颅射击';
        rows = [
          ['效果', '锁定离防线最近 · 连续 ' + Math.round(h.skillShots || 6) + ' 狙'],
          ['每发伤害', Math.round(h.atk * h.atkMul * 2) + '（×2.0）'],
          ['特性', '持续索敌 · 独立暴击'],
          ['冷却时间', hero.skillCd > 0 ? hero.skillCd.toFixed(1) + ' 秒' : '就绪'],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      }
      px = hero.x + 27 + 23 + 16 + w / 2;
      py = iconY + 23 + 16 + hh / 2;
    } else if (isArcher) {
      title = '✦ 大招 · 扇形箭雨';
      w = 280; hh = 272;
      rows = [
        ['伤害', Math.round(h.atk * h.atkMul * 0.65) + ' × 每箭'],
        ['形态', Math.round(h.ultRounds || 1) > 1 ? Math.round(h.ultRounds) + ' 轮 × 两排扇形 · 每排 8 箭' : '两排扇形 × 每排 8 箭'],
        ['特性', '无限贯穿'],
        ['充能', Math.floor(hero.charge) + ' / ' + hero.chargeMax],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', '手动点击'],
      ];
      // 大招图标半径 45：面板右缘 = 图标圆心 - 45(半径) - 16(间距)
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(504 + ultIdx * 110, 90);
    } else {
      title = '✦ 大招 · 猎杀时刻';
      w = 280; hh = 272;
      rows = [
        ['伤害', '×5.5 必定暴击'],
        ['形态', '0.5 秒锁定 → 贯穿弹' + (Math.round(h.ultBolts || 1) > 1 ? ' × ' + Math.round(h.ultBolts) + ' 线' : '')],
        ['特性', '无限贯穿 · 无视物抗'],
        ['目标', '全场血量最高'],
        ['充能', Math.floor(hero.charge) + ' / ' + hero.chargeMax],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(504 + ultIdx * 110, 90);
    }
    // 面板整体收敛进可视区
    px = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, px));
    py = Math.max(-LO.half + hh / 2 + 8, Math.min(LO.half - hh / 2 - 8, py));

    const tipsPanel = gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.94), undefined, 0, 12);
    // 左右内边距 16（用户调整：原 30 过大）；左列固定 90 + 间距 12，剩余全给数值列（过长 shrink 而非压得过小）
    const pad = 16, lblW = 90, gap = 12;
    const valW = w - pad * 2 - lblW - gap;
    label(this.modalRoot, px - w / 2 + pad + (w - pad * 2) / 2, py + hh / 2 - 41, title,
      { size: 18, color: '#FFE08A', bold: true, align: 'left', w: w - pad * 2, h: 26, shrink: true });
    rows.forEach((r, i) => {
      const ry = py + hh / 2 - 84 - i * 26;   // 首行与技能名拉开 18（用户调整：原太挤）；行距 26 收紧上下留白
      label(this.modalRoot, px - w / 2 + pad + lblW / 2, ry, r[0],
        { size: 15, color: '#CFD6DD', align: 'left', w: lblW, h: 24, shrink: true });
      label(this.modalRoot, px + w / 2 - pad - valW / 2, ry, r[1],
        { size: 15, color: '#FFFFFF', bold: true, align: 'right', w: valW, h: 24, shrink: true });
    });
    label(this.modalRoot, px, py - hh / 2 + 20, '点击空白处关闭', { size: 12, color: '#888888' });   // 贴底 20，与末行拉开 14（原 40 与属性行重叠）
  }
}
