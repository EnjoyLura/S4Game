/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Node, tween, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR } from '../config/Cards';
import { PAL } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroUnit } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave } from '../core/SaveData';
import { btn, CA, dimLayer, gcircle, gpanel, label, setText, WY, WX } from './UIKit';

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
        e.propagationStopped();
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

  private buildCard(frame: Node, card: CardDef, stacks: CardStacks): void {
    const rarity = RARITY_COLOR[card.rarity];
    const rName = card.rarity === 'white' ? '白' : card.rarity === 'blue' ? '蓝' : '紫';
    const tag = card.owner === 'global' ? '全局' : '弓手';
    const used = stacks[card.id] || 0;
    label(frame, 0, 154, card.name + ' · ' + rName + ' · ' + tag, { size: 19, color: rarity, bold: true, w: 190, h: 44 });
    gcircle(frame, 0, 44, 55, CA('#2A3240', 1), rarity, 2);
    label(frame, 0, 44, card.id.slice(0, 2).toUpperCase(), { size: 30, color: rarity, bold: true });
    label(frame, 0, -60, card.desc, { size: 17, color: PAL.parch, w: 180, h: 90 });
    if (used > 0) label(frame, 0, -130, '已学习 ' + used + ' 层', { size: 15, color: '#9FB59F' });
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
    // 设置开关（音乐/音效）
    const mkToggle = (x: number, name: string, key: 'music' | 'sfx', on: boolean) => {
      btn(this.modalRoot, x, WY(860, 60), 200, 60, name + '：' + (on ? '开' : '关'),
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
      e.propagationStopped();
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
      e.propagationStopped();
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

  /* ---------- ③ 伤害统计（不暂停，浮层） ---------- */
  showStats(rows: DamageRow[]): void {
    this.closeAll();
    const dim = dimLayer(this.modalRoot, 0.4);
    dim.on(Node.EventType.TOUCH_END, () => this.closeAll());
    gpanel(this.modalRoot, WX(135, 360), WY(440, 470), 360, 470, CA('#14181E', 0.92), CA('#FFFFFF', 0.25), 1.5, 14);
    label(this.modalRoot, WX(135, 360), WY(452, 50), '— 伤害统计 —', { size: 22, color: '#FFE08A' });
    rows.slice(0, 4).forEach((r, i) => {
      const y = 510 + i * 100;
      const cx = WX(155, 70), cy = WY(y, 70);
      gcircle(this.modalRoot, cx, cy, 32, CA('#2A3240', 1), '#FFFFFF55', 1.5);
      label(this.modalRoot, cx, cy, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      label(this.modalRoot, WX(240, 150), WY(y + 2, 40), r.name, { size: 18, color: '#FFFFFF', align: 'left', w: 150, h: 40 });
      label(this.modalRoot, WX(380, 100), WY(y + 2, 40), (r.pct * 100).toFixed(2) + '%',
        { size: 18, color: PAL.orange, align: 'right', w: 100, h: 40 });
      const barX = WX(240, 225), barY = WY(y + 48, 16);
      gpanel(this.modalRoot, barX, barY, 225, 16, CA('#000000', 0.4), undefined, 0, 8);
      if (r.val > 0) {
        gpanel(this.modalRoot, barX - 225 * (1 - r.pct) / 2, barY, Math.max(6, 225 * r.pct), 16, CA(PAL.orange, 0.9), undefined, 0, 8);
      }
      label(this.modalRoot, barX, barY, fmtWk(r.val), { size: 14, color: '#FFFFFF', bold: true });
    });
  }

  /* ---------- ⑧ 属性Tips（点击普攻/技能/未充满大招图标弹出，两列布局） ---------- */
  showTips(kind: 'atk' | 'skill' | 'ult', hero: HeroUnit, line: { maxHp: number }): void {
    void line;
    this.closeAll();
    const dim = dimLayer(this.modalRoot, 0.35);
    dim.on(Node.EventType.TOUCH_END, () => this.closeAll());

    const h = hero.stats;
    const panel = (
      x: number, y: number, w: number, hh: number, title: string,
      rows: [string, string][], anchor: string) => {
      const px = WX(x, w), py = WY(y, hh);
      label(this.modalRoot, px, py + hh / 2 + 16, anchor, { size: 14, color: '#8899FF' });
      gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.94), CA('#FFFFFF', 0.3), 1.5, 12);
      label(this.modalRoot, px - w / 2 + 14, py + hh / 2 - 26, title, { size: 18, color: '#FFE08A', bold: true, align: 'left' });
      rows.forEach((r, i) => {
        const ry = py + hh / 2 - 60 - i * 30;
        label(this.modalRoot, px - w / 2 + 14, ry, r[0], { size: 15, color: '#CFD6DD', align: 'left' });
        label(this.modalRoot, px + w / 2 - 14, ry, r[1], { size: 15, color: '#FFFFFF', bold: true, align: 'right' });
      });
      label(this.modalRoot, px, py - hh / 2 + 14, '点击空白处关闭', { size: 12, color: '#888888' });
    };

    if (kind === 'atk') {
      panel(16, 560, 300, 300, '🏹 普攻 · 风刃射击', [
        ['伤害', String(Math.round(h.atk * h.atkMul))],
        ['攻速', h.aspd.toFixed(1) + ' 次/秒'],
        ['索敌范围', String(Math.round(h.range))],
        ['弹道', (1 + h.serial) + ' 支' + (h.fan > 0 ? ' +' + h.fan + ' 齐射' : '')],
        ['暴击', Math.round(h.critRate * 100) + '% / ' + Math.round(h.critMul * 100) + '%'],
        ['目标', '最靠下'],
      ], '▼ 锚点：头顶普攻图标');
    } else if (kind === 'skill') {
      panel(330, 330, 300, 300, '⚡ 技能 · 穿云箭', [
        ['伤害', String(Math.round(h.atk * h.atkMul * 5.2))],
        ['冷却时间', hero.skillCd > 0 ? hero.skillCd.toFixed(1) + ' 秒' : '就绪'],
        ['索敌范围', String(Math.round(h.skillRange))],
        ['生效范围', '直线穿透'],
        ['释放', '自动'],
      ], '▼ 锚点：头顶技能图标');
    } else {
      panel(340, 700, 280, 270, '✦ 大招 · 箭雨风暴', [
        ['伤害', Math.round(h.atk * h.atkMul * 0.55) + ' × 36'],
        ['充能', Math.floor(hero.charge) + ' / ' + hero.chargeMax],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['生效范围', '全屏 3 轮 × 12 箭'],
        ['释放', '手动点击'],
      ], '◀ 锚点：右侧大招按钮');
    }
  }
}
