/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Graphics, Node, tween, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR } from '../config/Cards';
import { HERO_Y, LO, PAL } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroUnit } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave } from '../core/SaveData';
import { btn, CA, dimLayer, gcircle, gpanel, label, N, setText, WY, WYB, WX } from './UIKit';

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

  closeAll(): void {
    this.modalRoot.destroyAllChildren();
  }

  /** 新的三选一弹窗打开时重置刷新次数（跨弹窗不共享 §3.8） */
  resetPickRefresh(): void {
    this.pickAdLeft = 1;
    this.pickDiaLeft = 1;
  }

  /* ---------- ② 三选一 ---------- */
  showPick(cards: CardDef[], stacks: CardStacks, cb: PickCallbacks): void {
    this.closeAll();
    dimLayer(this.modalRoot);
    gpanel(this.modalRoot, 0, WY(308, 88), 520, 88, CA(PAL.wood, 0.95), PAL.gold, 2.5, 14);
    label(this.modalRoot, 0, WY(308, 88), '选择强化', { size: 34, color: PAL.gold, bold: true });

    const xs = [32, 275, 518];
    cards.forEach((card, i) => {
      const x = WX(xs[i], 200), y = WY(428, 360);
      const rarity = RARITY_COLOR[card.rarity];
      const frame = gpanel(this.modalRoot, x, y, 200, 360, CA('#14181E', 0.94), rarity, 2.5, 12);
      this.buildCard(frame, card, stacks);
      frame.on(Node.EventType.TOUCH_END, e => {
        e.propagationStopped = true;
        cb.onPick(card);
      });
    });

    label(this.modalRoot, 0, WY(818, 40),
      '当局剩余刷新：广告 ' + this.pickAdLeft + ' 次 · 钻石 ' + this.pickDiaLeft + ' 次',
      { size: 18, color: '#CFE3FF' });

    btn(this.modalRoot, WX(130, 300), WY(862, 76), 300, 76,
      '▶ 广告刷新', this.pickAdLeft > 0 ? PAL.green : '#5A6472', () => {
        if (this.pickAdLeft <= 0) return;
        this.pickAdLeft--;
        AdService.showRewarded('pick_refresh', () => cb.onRefreshRequest(), () => { this.pickAdLeft++; });
      }, 24);
    btn(this.modalRoot, WX(460, 180), WY(862, 76), 180, 76,
      '💎2 钻石刷新', this.pickDiaLeft > 0 ? PAL.gold : '#5A6472', () => {
        if (this.pickDiaLeft <= 0) return;
        const sv = loadSave();
        if (sv.diamonds < 2) return;
        sv.diamonds -= 2;
        this.pickDiaLeft--;
        cb.onRefreshRequest();
      }, 22);
  }

  /** 卡面布局严格对齐线稿②：顶部稀有度通栏色带 → 120齿轮环内96图标 → 右上56英雄角标 →
   *  左上56『新』绿角标(骑角突出卡外) → 底部描述两行 + 稀有度·定位小字（层数并入该行） */
  private buildCard(frame: Node, card: CardDef, stacks: CardStacks): void {
    const rarity = RARITY_COLOR[card.rarity];
    const rName = card.rarity === 'white' ? '白' : card.rarity === 'blue' ? '蓝' : '紫';
    const used = stacks[card.id] || 0;

    // ① 卡头稀有度色带（200×52 通栏）
    const header = gpanel(frame, 0, 154, 200, 52, CA(rarity, 0.2), rarity, 2, 0);
    label(header, 0, 0, card.name, { size: 20, color: rarity, bold: true, w: 186, h: 40, shrink: true });

    // ② 齿轮环 120×120 + 内嵌图标 96×96（环中心卡内 y130）
    gcircle(frame, 0, 50, 60, CA('#2A3240', 1), rarity, 2);
    const icon = gcircle(frame, 0, 50, 48, CA(rarity, 0.14), rarity, 1.5);
    label(icon, 0, 0, card.id.slice(0, 2).toUpperCase(), { size: 24, color: rarity, bold: true });

    // ③ 右上英雄归属角标 56×56 金圈（全局卡绿色）
    const ava = gcircle(frame, 68, 144, 28, CA('#2A3240', 1), card.owner === 'global' ? PAL.green : PAL.gold, 2.5);
    label(ava, 0, 0, card.owner === 'global' ? '全' : '弓',
      { size: 20, color: card.owner === 'global' ? PAL.green : PAL.gold, bold: true });

    // ④ 左上『新』角标 56×56 绿圆，骑在卡角上（首次出现）
    if (used === 0) {
      const badge = gcircle(frame, -88, 168, 28, PAL.green, PAL.ink, 2);
      label(badge, 0, 0, '新', { size: 20, color: PAL.ink, bold: true });
    }

    // ⑤ 描述两行 + ⑥ 底部"稀有度·定位"小字（已学层数并入文案，线稿不设层数行）
    label(frame, 0, -105, card.desc, { size: 15, color: PAL.parch, w: 184, h: 56, shrink: true, lineHeight: 20 });
    const tag = rName + ' · ' + (card.owner === 'global' ? '全局' : '弓手') + (used > 0 ? ' · 已学 ' + used + ' 层' : '');
    label(frame, 0, -140, tag, { size: 13, color: '#BFB392', w: 190, h: 24, shrink: true });
  }

  /* ---------- ④ 暂停 ---------- */
  showPause(o: {
    onResume: () => void; onExit: () => void;
    music: boolean; sfx: boolean;
    onToggle: (k: 'music' | 'sfx', v: boolean) => void;
  }): void {
    this.closeAll();
    dimLayer(this.modalRoot);
    label(this.modalRoot, 0, WY(400, 90), '暂 停', { size: 46, color: '#FFFFFF', bold: true });
    label(this.modalRoot, 0, WY(516, 50), '— 本局金币 ' + Math.floor(this.dir.goldEarned) + ' —',
      { size: 22, color: '#FFE08A' });
    // 页签：奖励总览 / 伤害统计 / 设置（问题上报已移除）
    const tabs = ['奖励总览', '伤害统计', '设置'];
    tabs.forEach((t, i) => {
      const x = WX(25 + i * 235, 225);
      gpanel(this.modalRoot, x, WY(780, 72), 225, 72, i === 0 ? CA(PAL.gold, 0.25) : CA('#14181E', 0.85),
        i === 0 ? PAL.gold : '#FFFFFF44', 1.5, 12);
      label(this.modalRoot, x, WY(780, 72), t, { size: 20, color: i === 0 ? PAL.gold : '#FFFFFF' });
    });
    // 设置开关（音乐/音效）——置于标题与页签之间的空档，避免压住底部按钮
    const mkToggle = (x: number, name: string, key: 'music' | 'sfx', on: boolean) => {
      btn(this.modalRoot, x, WY(660, 60), 200, 60, name + '：' + (on ? '开' : '关'),
        on ? PAL.green : '#5A6472', () => {
          o.onToggle(key, !on);
          this.showPause({ ...o, [key]: !on } as typeof o);
        }, 19);
    };
    mkToggle(WX(50, 200), '音乐', 'music', o.music);
    mkToggle(WX(500, 200), '音效', 'sfx', o.sfx);
    btn(this.modalRoot, WX(50, 300), WY(880, 88), 300, 88, '⏻ 退出', PAL.gold, o.onExit);
    btn(this.modalRoot, WX(400, 300), WY(880, 88), 300, 88, '▶ 继续战斗', PAL.green, o.onResume);
  }

  /* ---------- ⑥ 胜利结算 ---------- */
  showWin(o: {
    stars: 1 | 2 | 3; gold: number; ratio: number;
    onDouble: (done: (ok: boolean) => void) => void;
    onNext: () => void; onExit: () => void;
  }): void {
    this.closeAll();
    dimLayer(this.modalRoot);
    label(this.modalRoot, 0, WY(340, 90), '挑战成功！', { size: 42, color: '#FFD45E', bold: true });
    for (let i = 0; i < 3; i++) {
      const x = WX(217 + i * 110, 96);
      gcircle(this.modalRoot, x, WY(450, 96), 44,
        i < o.stars ? CA(PAL.gold, 0.35) : CA('#FFFFFF', 0.06),
        i < o.stars ? PAL.gold : '#FFFFFF33', 2.5);
      label(this.modalRoot, x, WY(450, 96), '★', { size: 44, color: i < o.stars ? PAL.gold : '#666C77' });
    }
    label(this.modalRoot, 0, WY(558, 44), '— 已获得奖励 —', { size: 22, color: '#FFE08A' });
    const coin = gcircle(this.modalRoot, WX(117, 96), WY(606, 96), 42, CA(PAL.gold, 0.25), PAL.gold, 2);
    label(coin, 0, 0, '🪙', { size: 34 });
    label(this.modalRoot, WX(117, 96), WY(676, 36), String(o.gold), { size: 20, color: '#FFFFFF' });

    // 双倍广告按钮（与失败页复活按钮同位 580,714 120×120）
    const dbl = gcircle(this.modalRoot, WX(580, 120), WY(714, 120), 58, CA(PAL.green, 0.3), PAL.green, 3);
    const dblTxt = label(dbl, 0, 0, '▶\n双倍', { size: 24, color: PAL.green, bold: true });
    dbl.on(Node.EventType.TOUCH_END, e => {
      e.propagationStopped = true;
      o.onDouble(ok => {
        if (ok) {
          dbl.off(Node.EventType.TOUCH_END);
          setText(dblTxt, '已\n领取');
        }
      });
    });

    const tabs = ['奖励总览', '伤害统计'];
    tabs.forEach((t, i) => {
      const x = WX(40 + i * 340, 330);
      gpanel(this.modalRoot, x, WY(840, 72), 330, 72, i === 0 ? CA(PAL.gold, 0.25) : CA('#14181E', 0.85),
        i === 0 ? PAL.gold : '#FFFFFF44', 1.5, 12);
      label(this.modalRoot, x, WY(840, 72), t, { size: 20, color: i === 0 ? PAL.gold : '#FFFFFF' });
    });
    btn(this.modalRoot, WX(50, 300), WY(940, 88), 300, 88, '下一关 ▶', PAL.green, o.onNext);
    btn(this.modalRoot, WX(400, 300), WY(940, 88), 300, 88, '返回', PAL.gold, o.onExit);
  }

  /* ---------- ⑤ 失败结算（含广告复活，与胜利双倍按钮同位） ---------- */
  showLose(o: {
    goldFloor: number; reviveRatio: number;
    onRevive: (done: (ok: boolean) => void) => void;
    onRetry: () => void; onExit: () => void;
  }): void {
    this.closeAll();
    dimLayer(this.modalRoot, 0.7, true);
    gpanel(this.modalRoot, 0, WY(340, 100), 590, 100, CA(PAL.red, 0.18), PAL.red, 2.5, 10);
    label(this.modalRoot, 0, WY(350, 80), '挑战失败', { size: 40, color: '#FFFFFF', bold: true });
    label(this.modalRoot, 0, WY(480, 44), '— 已获得奖励（保底 30%）—', { size: 20, color: '#FFB0A0' });
    const coin = gcircle(this.modalRoot, WX(167, 96), WY(528, 96), 42, CA(PAL.gold, 0.25), PAL.gold, 2);
    label(coin, 0, 0, '🪙', { size: 34 });
    label(this.modalRoot, WX(167, 96), WY(598, 36), String(o.goldFloor), { size: 20, color: '#FFFFFF' });

    label(this.modalRoot, 0, WY(668, 30),
      '复活：耐久 +30% · 不限次 · 不看广告即接受失败', { size: 16, color: '#CCCCCC' });
    const rv = gcircle(this.modalRoot, WX(580, 120), WY(700, 120), 58, CA(PAL.green, 0.3), PAL.green, 3);
    const rvTxt = label(rv, 0, 0, '▶\n复活\n+' + Math.round(o.reviveRatio * 100) + '%', { size: 20, color: PAL.green, bold: true });
    rv.on(Node.EventType.TOUCH_END, e => {
      e.propagationStopped = true;
      o.onRevive(ok => {
        if (!ok) {
          setText(rvTxt, '稍后\n重试');
          tween(rv).to(0.3, { scale: new Vec3(0.92, 0.92, 1) }).to(0.3, { scale: new Vec3(1, 1, 1) }).start();
        }
      });
    });

    const tabs = ['奖励总览', '伤害统计'];
    tabs.forEach((t, i) => {
      const x = WX(40 + i * 340, 330);
      gpanel(this.modalRoot, x, WY(840, 72), 330, 72, i === 0 ? CA(PAL.gold, 0.25) : CA('#14181E', 0.85),
        i === 0 ? PAL.gold : '#FFFFFF44', 1.5, 12);
      label(this.modalRoot, x, WY(840, 72), t, { size: 20, color: i === 0 ? PAL.gold : '#FFFFFF' });
    });
    btn(this.modalRoot, WX(50, 300), WY(940, 88), 300, 88, '↻ 再来一次', PAL.green, o.onRetry);
    btn(this.modalRoot, WX(400, 300), WY(940, 88), 300, 88, '返回', PAL.gold, o.onExit);
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

    gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.94), CA('#FFFFFF', 0.3), 1.5, 14);
    label(this.modalRoot, px, py + hh / 2 - 30, '— 伤害统计 —', { size: 22, color: '#FFE08A' });
    rows.slice(0, 4).forEach((r, i) => {
      const y = py + hh / 2 - 66 - i * 100;
      const cx = px - w / 2 + 46;
      gcircle(this.modalRoot, cx, y, 32, CA('#2A3240', 1), '#FFFFFF55', 1.5);
      label(this.modalRoot, cx, y, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      label(this.modalRoot, px - w / 2 + 156, y, r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 130, h: 40, shrink: true });
      label(this.modalRoot, px + w / 2 - 14 - 45, y, (r.pct * 100).toFixed(2) + '%',
        { size: 18, color: PAL.orange, align: 'right', w: 90, h: 40, shrink: true });
      const barX = px - w / 2 + 14 + 112.5, barY = y - 46;
      gpanel(this.modalRoot, barX, barY, 225, 16, CA('#000000', 0.4), undefined, 0, 8);
      if (r.val > 0) {
        const fw = Math.max(6, 225 * r.pct);
        gpanel(this.modalRoot, barX - 112.5 + fw / 2, barY, fw, 16, CA(PAL.orange, 0.9), undefined, 0, 8);
      }
      label(this.modalRoot, barX, barY, fmtWk(r.val), { size: 14, color: '#FFFFFF', bold: true });
    });
    label(this.modalRoot, px, py - hh / 2 + 14, '点击空白处关闭', { size: 12, color: '#888888' });
  }

  /* ---------- ⑧ 属性Tips：无遮罩、贴图标侧、点空白关闭、带索敌范围圈（线稿⑧⑦） ---------- */
  showTips(kind: 'atk' | 'skill' | 'ult', hero: HeroUnit, line: { maxHp: number }): void {
    void line;
    this.closeAll();
    // 全屏透明捕获层：点任意空白处关闭（不加变暗遮罩，§3.11 战斗不暂停）
    const catcher = N('tipsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll());

    // 索敌范围圈：以英雄为圆心，半透明填充 + 圈线（线稿⑦）
    const R = kind === 'atk' ? hero.stats.range : kind === 'skill' ? hero.stats.skillRange : 0;
    if (R > 0) {
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
    const iconY = WYB(126, 46);
    let px: number, py: number, w = 300, hh = 300, title: string;
    let rows: [string, string][];
    if (kind === 'atk') {
      title = '🏹 普攻 · 风刃射击';
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
      title = '⚡ 技能 · 穿云箭';
      rows = [
        ['伤害', String(Math.round(h.atk * h.atkMul * 5.2))],
        ['冷却时间', hero.skillCd > 0 ? hero.skillCd.toFixed(1) + ' 秒' : '就绪'],
        ['索敌范围', String(Math.round(h.skillRange))],
        ['生效范围', '直线穿透'],
        ['释放', '自动'],
      ];
      px = hero.x + 27 + 23 + 16 + w / 2;
      py = iconY + 23 + 16 + hh / 2;
    } else {
      title = '✦ 大招 · 箭雨风暴';
      w = 280; hh = 270;
      rows = [
        ['伤害', Math.round(h.atk * h.atkMul * 0.55) + ' × 36'],
        ['充能', Math.floor(hero.charge) + ' / ' + hero.chargeMax],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['生效范围', '全屏 3 轮 × 12 箭'],
        ['释放', '手动点击'],
      ];
      // 大招图标半径 45：面板右缘 = 图标圆心 - 45(半径) - 16(间距)
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(504, 90);
    }
    // 面板整体收敛进可视区
    px = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, px));
    py = Math.max(-LO.half + hh / 2 + 8, Math.min(LO.half - hh / 2 - 8, py));

    gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.94), CA('#FFFFFF', 0.3), 1.5, 12);
    const colW = w * 0.44;
    // 注意：label 节点锚点在盒子中心，左/右对齐文本需按"边缘±colW/2"定位
    label(this.modalRoot, px - w / 2 + 14 + (w - 28) / 2, py + hh / 2 - 26, title,
      { size: 18, color: '#FFE08A', bold: true, align: 'left', w: w - 28, h: 26, shrink: true });
    rows.forEach((r, i) => {
      const ry = py + hh / 2 - 60 - i * 30;
      label(this.modalRoot, px - w / 2 + 14 + colW / 2, ry, r[0],
        { size: 15, color: '#CFD6DD', align: 'left', w: colW, h: 24, shrink: true });
      label(this.modalRoot, px + w / 2 - 14 - colW / 2, ry, r[1],
        { size: 15, color: '#FFFFFF', bold: true, align: 'right', w: colW, h: 24, shrink: true });
    });
    label(this.modalRoot, px, py - hh / 2 + 14, '点击空白处关闭', { size: 12, color: '#888888' });
  }
}
