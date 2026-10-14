/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Graphics, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR, archerEmpCfg, archerUltCfg, sniperSkCfg, sniperUltCfg, voltSkCfg, voltUltCfg, pyroSkCfg, pyroUltCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { HERO_Y, LO, PAL } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroBase } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave, saveSave } from '../core/SaveData';
import { C, CA, dimLayer, gcircle, gpanel, label, N, setText, WY, WYB, WX } from './UIKit';
import { battleArtIcon as artIcon, battleArtSprite as artSprite, battleButton as btn,
  battleConfirm as dlgConfirm, battleStatBar as gbar } from './BattlePanelSkin';
import { pauseButton, pauseRow, pauseSwitch, pauseTabFace } from './PausePanelSkin';
import { settlementButton, settlementFrame, settlementRewards, settlementStats, settlementTabs } from './SettlementPanelSkin';

/** 奖励行文字兜底 → A2 图标（有美术时整座替换，失败保持 emoji） */
const REWARD_ICON: Record<string, string> = {
  '🪙': 'ui_icon_coin', 'EXP': 'ui_icon_exp', '💎': 'ui_icon_diamond',
  '🎁': 'ui_icon_chest', '🛡': 'ui_icon_equip',
};

interface PickCallbacks {
  onPick: (card: CardDef) => void;
  onRefreshRequest: () => void;
}

/** 卡面图标复用表（用户调整：狙击手普攻系六卡复用弓箭手同款图标；未列出的卡仍走 ui_card_<id>） */
const CARD_ART: Record<string, string> = {
  heavy_head: 'ui_card_sharp',        // 重弹头 ← 攻击力（剑+绿箭头）
  fast_load: 'ui_card_swift',         // 快速装填 ← 攻速（弩+绿箭头）
  steady_rest: 'ui_card_crit_rate',   // 稳定枪架 ← 暴击率（准星）
  lethal_aim: 'ui_card_crit_dmg',     // 致命瞄准 ← 暴击伤害（骷髅）
  instinct_s: 'ui_card_instinct_a',   // 猎手本能 ← 猎手本能（猎物）
  fast_charge_s: 'ui_card_fast_charge_a', // 快速充能 ← 快速充能（能量体）
  pyro_cd: 'ui_card_cd_cut',          // 火法·冷却缩减 ← 冷却缩减（沙漏）
  pyro_eager: 'ui_card_fast_charge_a', // 火法·激昂 ← 快速充能（能量体）
  volt_cd: 'ui_card_cd_cut',          // 雷法·冷却缩减 ← 冷却缩减（沙漏）
  volt_eager: 'ui_card_fast_charge_a',// 雷法·激昂 ← 快速充能（能量体）
  mora_cd: 'ui_card_cd_cut',          // 冰法·冷却缩减 ← 冷却缩减（沙漏）
  mora_eager: 'ui_card_fast_charge_a',// 冰法·激昂 ← 快速充能（能量体）
  mora_linger: 'ui_card_cd_cut',       // 冰法·寒冬延续：复用沙漏，表达持续时间
};

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
  private pickPending = false;
  private panelVersion = 0;
  private doubleKey?: object;
  private doubleBusy = false;
  private doubleClaimed = false;
  private reviveKey?: object;
  private reviveBusy = false;
  private settlementKind: 'win' | 'lose' | null = null;
  private settlementTab = 0;
  private reviveHint = '';

  closeAll(): void {
    this.settlementKind = null;
    this.picking = false;
    this.pickPending = false;
    this.panelVersion++;
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
    const version = this.panelVersion;
    dimLayer(this.modalRoot);
    // Move the complete original layout down together; keep the footer inside short screens.
    const shift = Math.min(56, Math.max(0, LO.half * 2 - LO.safeTop - LO.safeBottom - 938 - 40));
    const pickRoot = N('pickRoot', this.modalRoot, 0, -shift);
    // 原创纸纹标题，文字和标题淡入保留。
    const titleBg = gpanel(pickRoot, 0, WY(308, 88), 520, 88, CA(PAL.parch, 0.95), PAL.gold, 2.5, 14);
    artSprite(titleBg, 0, 0, 520, 88, 'pick_comic_v1/title_plate', { belowIdx: 0 });
    label(titleBg, 0, 0, '选择强化', { size: 34, color: '#4A3214', bold: true });
    const titleOp = titleBg.getComponent(UIOpacity) || titleBg.addComponent(UIOpacity);
    titleOp.opacity = 0;
    tween(titleOp).to(0.25, { opacity: 255 }).start();

    const xs = [22, 264, 506];
    const frames: Node[] = [];
    cards.forEach((card, i) => {
      const x = WX(xs[i], 222), y = WY(428, 360);
      const frame = gpanel(pickRoot, x, y, 222, 360, CA('#E9DFC2', 0.96), undefined, 0, 12);
      frame.name = 'pickCard:' + card.id;
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

    label(pickRoot, 0, WY(818, 40),
      '当局剩余刷新：广告 ' + this.pickAdLeft + ' 次 · 钻石 ' + this.pickDiaLeft + ' 次',
      { size: 18, color: '#CFE3FF' });

    // 刷新按钮（参考版式：无边框扁平圆角板 + 底缘厚度 + 粗体字；绿=广告 金=钻石 灰=次数用尽）
    this.pickBtn(pickRoot, WX(130, 300), WY(862, 76), 300, 76, '▶ 广告刷新', 24,
      this.pickAdLeft > 0 ? PAL.green : '#5A6472',
      this.pickAdLeft > 0 ? '#5E8F2E' : '#454E59',
      this.pickAdLeft > 0 ? '#20240F' : '#DCE2EA',
      () => {
        if (this.picking || this.pickPending || this.pickAdLeft <= 0) return;
        this.pickPending = true;
        this.pickAdLeft--;
        AdService.showRewarded('pick_refresh', () => {
          if (version === this.panelVersion) { this.pickPending = false; cb.onRefreshRequest(); }
        }, () => {
          if (version === this.panelVersion) { this.pickAdLeft++; this.showPick(cards, _stacks, cb); }
        });
      });
    this.pickBtn(pickRoot, WX(460, 180), WY(862, 76), 180, 76, '💎2 钻石刷新', 22,
      this.pickDiaLeft > 0 ? PAL.gold : '#5A6472',
      this.pickDiaLeft > 0 ? '#C98A1A' : '#454E59',
      this.pickDiaLeft > 0 ? '#3A2A10' : '#DCE2EA',
      () => {
        if (this.picking || this.pickPending || this.pickDiaLeft <= 0) return;
        const sv = loadSave();
        if (sv.diamonds < 2) return;
        sv.diamonds -= 2;
        saveSave();
        this.pickDiaLeft--;
        this.pickPending = true;
        cb.onRefreshRequest();
      });
  }

  /** 保留刷新按钮的宽度和回调，复用项目金／绿纸纹按钮。 */
  private pickBtn(parent: Node, x: number, y: number, w: number, h: number, text: string,
    size: number, base: string, edge: string, txt: string, cb: () => void): Node {
    const n = gpanel(parent, x, y, w, h, CA(edge, 1), undefined, 0, 14);
    const face = gpanel(n, 0, 3, w, h - 6, CA(base, 1), undefined, 0, 14);
    n.name = text.startsWith('▶') ? 'pickAdRefresh' : 'pickDiamondRefresh';
    label(face, 0, 0, text, { size, color: txt, bold: true, w: w - 16, h: h - 6, shrink: true });
    const tone = base === '#5A6472' ? 'muted' : text.startsWith('▶') ? 'green' : 'gold';
    let sprite: Sprite | null = null;
    artSprite(n, 0, 0, w, h, 'pause_comic_v1/button_' + tone, {
      belowIdx: 0, onLoaded: art => { sprite = art.getComponent(Sprite); face.getComponent(Graphics)!.enabled = false; },
    });
    n.on(Node.EventType.TOUCH_START, () => { if (sprite) sprite.color = C('#D7D7D7'); });
    n.on(Node.EventType.TOUCH_CANCEL, () => { if (sprite) sprite.color = C('#FFFFFF'); });
    n.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: boolean };
      if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;
      if (sprite) sprite.color = C('#FFFFFF');
      cb();
    });
    return n;
  }

  /** 选择动画：选中卡弹跳、其余卡淡出，随后真实回调（三选一冻结期间 tween 仍走主循环时钟） */
  private pickChoose(chosen: Node, others: Node[], card: CardDef, cb: PickCallbacks): void {
    if (this.picking || this.pickPending) return;
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

  /** 卡面布局（羊皮纸底；去「新」标与稀有度小字——用户要求：卡面只留 名称/图标/归属/描述）：
   *  顶部稀有度通栏色带 → 圆形图标座 → 右上归属角标（避开色带与图标座）→ 下半区大号加粗描述（shrink 防超框） */
  private buildCard(frame: Node, card: CardDef): void {
    const rarity = RARITY_COLOR[card.rarity];

    // ⓪ 共用原创纸纹底板，细线与角饰留在边缘，中心供原图标和描述使用。
    artSprite(frame, 0, 0, 222, 360, 'pick_comic_v1/card_base', {
      belowIdx: 0,
      onLoaded: () => { frame.getComponent(Graphics)?.clear(); },
    });

    // ① 全宽品质色带，与卡片左右缘对齐；仅保留顶角，下沿连成通栏。
    const header = gpanel(frame, 0, 154, 222, 52, CA(rarity, 0.92), undefined, 0, 12);
    const headerInk = header.getComponent(Graphics)!;
    headerInk.rect(-111, -26, 222, 12);
    headerInk.fill();
    const headerArt = artSprite(header, 0, 0, 222, 52, 'pick_comic_v1/header_strip', { belowIdx: 0 });
    headerArt.getComponent(Sprite)!.color = C(rarity);
    label(header, 0, 0, card.name, { size: 22, color: card.rarity === 'white' ? '#4A3214' : '#FFFFFF', bold: true, w: 188, h: 40, shrink: true });

    // ② 图标座 120 圆 + 内嵌 96 圆（卡面美术图 ui_card_<id>；缺图回退首字母——用户要求：卡面用图标资源）
    const gear = gcircle(frame, 0, 50, 60, CA('#2A3240', 1));
    const icon = gcircle(frame, 0, 50, 48, CA(rarity, 0.16));
    const iconLbl = label(icon, 0, 0, card.id.slice(0, 2).toUpperCase(), { size: 26, color: card.rarity === 'white' ? '#E8E0C8' : rarity, bold: true });
    artSprite(frame, 0, 50, 124, 124, card.unlocks ? 'ui_icon_' + card.unlocks + '_' + card.owner : CARD_ART[card.id] || ('ui_card_' + card.id), { sliced: false, hideOnLoad: [iconLbl] });

    // ③ 右上归属角标：仅英雄专属卡贴头像（用户调整：通用卡不再显示"全"角标）
    if (card.owner !== 'global') {
      const ava = gcircle(frame, 80, 94, 24, CA('#2A3240', 1));
      artSprite(ava, 0, 0, 48, 48, 'ui_avatar_' + card.owner, { sliced: false });
    }

    // ④ 描述（18 号加粗，shrink 保证不超框）
    label(frame, 0, -95, card.desc, { size: 18, color: '#4A3214', bold: true, w: 196, h: 90, shrink: true, lineHeight: 26 });
  }

  /* ---------- 页签条（线稿④-1/④-2/⑤-1/⑥-1）：点页签本地重渲染当前面板（无边框规范：纯色板） ---------- */
  /** 页签栏（用户调整：与主界面背包页签同版式）：整条连体无缝分段——激活段金底、未激活灰蓝底，
   *  段内直角仅首段左侧/末段右侧留圆弧，深色粗体字；总宽沿用调用方参数（gap 摊入段宽） */
  private tabsBar(tabs: string[], active: number, y: number, x0: number, w: number, gap: number, onSel: (i: number) => void, pauseSkin = false): void {
    const n = tabs.length;
    const segW = (n * w + (n - 1) * gap) / n, segH = 58, segR = 14;
    tabs.forEach((t, i) => {
      const x = WX(x0 + i * segW, segW), cy = WY(y, segH);
      const seg = N('tabseg' + i, this.modalRoot, x, cy, segW, segH);
      const g = seg.addComponent(Graphics);
      g.fillColor = C(i === active ? PAL.gold : '#5A6472');
      g.roundRect(-segW / 2, -segH / 2, segW, segH, i === 0 || i === n - 1 ? segR : 0);
      if (i === 0) g.rect(segW / 2 - segR, -segH / 2, segR, segH);            // 首段盖平右侧两角
      if (i === n - 1 && n > 1) g.rect(-segW / 2, -segH / 2, segR, segH);     // 末段盖平左侧两角
      g.fill();
      label(seg, 0, 0, t, { size: 22, color: '#241C12', bold: true, w: segW, h: segH });
      // 页签段美术（用户反馈：段间不得有间隔、选中不得露圆弧）——三段式生图：
      // 首段 ui_tab_l 左圆右平 / 中段 ui_tab_m 双平 / 末段 ui_tab_r 左平右圆，平铺即无缝，圆弧只在整栏两端
      const artId = i === 0 ? 'ui_tab_l' : i === n - 1 ? 'ui_tab_r' : 'ui_tab_m';
      if (pauseSkin) pauseTabFace(seg, i, n, segW, segH, i === active);
      else {
        const art = artSprite(seg, 0, 0, segW, segH, artId, { belowIdx: 0 });
        if (i === active) art.getComponent(Sprite)!.color = C('#F2B23E');
      }
      if (i !== active) {
        seg.on(Node.EventType.TOUCH_END, e => { e.propagationStopped = true; onSel(i); });
      }
    });
  }

  /** 伤害数值在条外，贡献百分比另列；条宽以本局最高伤害为满格，方便比较。 */
  private statsRows(rows: DamageRow[], t0: number, step: number, compact = false): void {
    const shown = rows.slice(0, compact ? 4 : 3);
    const leader = Math.max(1, ...rows.map(r => r.val));
    // Pause has a fixed 520..764 content area, independent of the footer controls.
    // Keep the other settlement layouts unchanged.
    const pitch = compact ? Math.min(90, 244 / Math.max(1, shown.length)) : step;
    const avatarSize = compact ? Math.min(70, pitch - 8) : 70;
    const barOffset = compact && avatarSize < 60 ? 36 : 44;
    shown.forEach((r, i) => {
      const host = compact ? N('pauseDamageRow:' + r.id, this.modalRoot) : this.modalRoot;
      const t = t0 + i * pitch;
      const av = gcircle(host, WX(40, 70), WY(t, avatarSize), avatarSize / 2, CA('#2A3240', 1));
      const avLbl = label(av, 0, 0, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      if (r.id === 'archer' || r.id === 'sniper' || r.id === 'pyro' || r.id === 'volt' || r.id === 'mora')
        artSprite(av, 0, 0, avatarSize - 12, avatarSize - 12, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(host, WX(130, 220), WY(t + 2, compact && avatarSize < 60 ? 32 : 40), r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 220, h: 40, shrink: true });
      label(host, WX(570, 140), WY(t + 1, 24), fmtWk(r.val),
        { size: 20, color: '#FFE27A', font: 'number', align: 'right', w: 140, h: 24, shrink: true });
      label(host, WX(570, 140), WY(t + 23, 12), (r.pct * 100).toFixed(2) + '%',
        { size: 11, color: '#BAC5CD', font: 'number', align: 'right', w: 140, h: 12 });
      const barX = WX(130, 580);
      const bar = gbar(host, barX, WY(t + barOffset, 10), 580, 10, '#F0793D');
      bar.set(r.val > 0 ? r.val / leader : 0);
    });
  }

  /** 奖励图标行（整组水平居中，pitch 160）：[底色, 图标文字, 数值]（扁平无框——用户要求：有色圆座 + 图标/文字兜底） */
  private rewardIcons(y: number, items: [string, string, string][], pauseSkin = false): void {
    const pitch = 160, s = 96;
    items.forEach((it, i) => {
      const x = (i - (items.length - 1) / 2) * pitch;
      const c = gcircle(this.modalRoot, x, WY(y, s), 42, CA(it[0], 0.25));
      if (pauseSkin) artSprite(c, 0, 0, 84, 84, 'pause_comic_v1/reward_socket', { sliced: false, belowIdx: 0 });
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
    artSprite(this.modalRoot, 0, WY(400, 90), 360, 68, 'pause_comic_v1/title_ribbon');
    label(this.modalRoot, 0, WY(400, 90), '暂 停', { size: 46, color: '#FFFFFF', bold: true });
    this.tabsBar(['奖励总览', '伤害统计', '设置'], tab, 780, 25, 225, 10, t => this.showPause({ ...o, tab: t }), true);
    if (tab === 0) {
      label(this.modalRoot, 0, WY(470, 44), '— 已获得奖励 —', { size: 22, color: '#FFE08A' });
      this.rewardIcons(530, [
        [PAL.gold, '🪙', String(Math.floor(this.dir.goldEarned))],
        [PAL.green, 'EXP', String(o.xp)],
      ], true);
    } else if (tab === 1) {
      label(this.modalRoot, 0, WY(470, 44), '— 伤害统计（本局） —', { size: 22, color: '#FFE08A' });
      this.statsRows(this.dir.dmgSvc.rows(), 520, 115, true);
    } else {
      // 设置页签：左右旋钮开关（线稿④-2）；音乐/音效切换即时生效并写存档；振动随战斗手感批次实装
      const mkRow = (y: number, name: string, gray: boolean, sw?: { on: boolean; onChange: (v: boolean) => void }) => {
        pauseRow(this.modalRoot, WX(40, 670), WY(y, 60), 670, 60);
        label(this.modalRoot, WX(60, 380), WY(y, 60), name,
          { size: 20, color: gray ? '#889099' : '#FFFFFF', align: 'left', w: 380, h: 40, shrink: true });
        pauseSwitch(this.modalRoot, WX(590, 100), WY(y + 8, 44), 100, 44, sw ? sw.on : false,
          sw ? sw.onChange : undefined, !sw);
      };
      mkRow(496, '🎵 音乐', false, { on: o.music, onChange: v => { o.music = v; o.onToggle('music', v); } });
      mkRow(570, '🔊 音效', false, { on: o.sfx, onChange: v => { o.sfx = v; o.onToggle('sfx', v); } });
      mkRow(644, '📳 振动（未开放）', true);
      // 倍速行：循环按钮 1x/2x（非开关形态）
      pauseRow(this.modalRoot, WX(40, 670), WY(718, 60), 670, 60);
      label(this.modalRoot, WX(60, 380), WY(718, 60), '⏩ 战斗倍速' + (o.speedUnlocked ? '' : '（1-2 通关解锁）'),
        { size: 20, color: o.speedUnlocked ? '#FFFFFF' : '#889099', align: 'left', w: 380, h: 40, shrink: true });
      if (o.speedUnlocked) {
        pauseButton(this.modalRoot, WX(590, 100), WY(726, 44), 100, 44, o.speed === 1.5 ? '1.5x' : '1x',
          () => { this.dir.toggleSpeed(); this.showPause({ ...o, tab: 2, speed: this.dir.speed }); }, 18,
          o.speed === 1.5 ? 'green' : 'muted');
      } else {
        pauseSwitch(this.modalRoot, WX(590, 100), WY(726, 44), 100, 44, false, undefined, true);
      }
    }
    pauseButton(this.modalRoot, WX(50, 300), WY(880, 88), 300, 88, '⏻ 退出', o.onExit, 22, 'gold');
    pauseButton(this.modalRoot, WX(400, 300), WY(880, 88), 300, 88, '▶ 继续战斗', o.onResume, 22, 'green');
  }

  /* ---------- ⑥ 胜利结算：皇冠横幅、奖励／统计与固定操作区 ---------- */
  showWin(o: {
    stars: 1 | 2 | 3; gold: number; ratio: number; xp: number;
    onDouble: (done: (ok: boolean) => void) => void;
    onNext: () => void; onExit: () => void;
    tab?: number;
  }): void {
    const tab = o.tab === 1 ? 1 : 0;
    if (this.doubleKey !== o.onDouble) { this.doubleKey = o.onDouble; this.doubleBusy = false; this.doubleClaimed = false; }
    this.closeAll();
    this.settlementKind = 'win';
    this.settlementTab = tab;
    dimLayer(this.modalRoot);
    const root = settlementFrame(this.modalRoot, 'win', this.dir.levelDef.id + '  ' + this.dir.levelDef.name, o.stars, o.ratio);
    settlementTabs(root, tab, t => this.showWin({ ...o, tab: t }));
    if (tab === 0) {
      settlementRewards(root, 'win', o.gold * (this.doubleClaimed ? 2 : 1), o.xp,
        this.doubleClaimed ? '双倍金币已领取 · 经验保持原奖励' : '奖励已到账 · 看广告可再领取一份金币');
    } else {
      settlementStats(root, this.dir.dmgSvc.rows());
    }
    const back = settlementButton(root, -153, -353, 286, 78, '返回', 'gold', o.onExit, !this.doubleBusy);
    const next = settlementButton(root, 153, -353, 286, 78, '下一关 ▶', 'green', o.onNext, !this.doubleBusy);
    const dbl = settlementButton(root, 0, -261, 610, 74,
      this.doubleClaimed ? '双倍金币已领取' : this.doubleBusy ? '领取中…' : '▶ 看广告 · 双倍金币',
      this.doubleClaimed ? 'muted' : 'teal', () => {
      if (this.doubleBusy || this.doubleClaimed) return;
      this.doubleBusy = true;
      dbl.setText('领取中…');
      dbl.setEnabled(false); back.setEnabled(false); next.setEnabled(false);
      o.onDouble(ok => {
        if (this.doubleKey !== o.onDouble) return;
        this.doubleBusy = false;
        if (ok) this.doubleClaimed = true;
        if (this.settlementKind === 'win') this.showWin({ ...o, tab: this.settlementTab });
      });
    }, !this.doubleBusy && !this.doubleClaimed, 'battleDouble');
  }

  /* ---------- ⑤ 失败结算：蓝灰破损皇冠与复活操作 ---------- */
  showLose(o: {
    goldFloor: number; reviveRatio: number; xp: number;
    onRevive: (done: (ok: boolean) => void) => void;
    onRetry: () => void; onExit: () => void;
    tab?: number;
  }): void {
    const tab = o.tab === 1 ? 1 : 0;
    if (this.reviveKey !== o.onRevive) { this.reviveKey = o.onRevive; this.reviveBusy = false; this.reviveHint = ''; }
    this.closeAll();
    this.settlementKind = 'lose';
    this.settlementTab = tab;
    dimLayer(this.modalRoot, .72);
    const root = settlementFrame(this.modalRoot, 'lose', this.dir.levelDef.id + '  ' + this.dir.levelDef.name);
    settlementTabs(root, tab, t => this.showLose({ ...o, tab: t }));
    if (tab === 0) {
      settlementRewards(root, 'lose', o.goldFloor, o.xp,
        '复活恢复 ' + Math.round(o.reviveRatio * 100) + '% 耐久 · 不限次 · 返回结算本局');
    } else {
      settlementStats(root, this.dir.dmgSvc.rows());
    }
    const back = settlementButton(root, -153, -353, 286, 78, '返回', 'muted', o.onExit, !this.reviveBusy);
    const retry = settlementButton(root, 153, -353, 286, 78, '↻ 再来一次', 'gold', o.onRetry, !this.reviveBusy);
    const rv = settlementButton(root, 0, -261, 610, 74,
      this.reviveBusy ? '复活中…' : this.reviveHint || '▶ 看广告复活 · +' + Math.round(o.reviveRatio * 100) + '% 耐久', 'teal', () => {
      if (this.reviveBusy) return;
      this.reviveBusy = true;
      this.reviveHint = '';
      rv.setText('复活中…');
      rv.setEnabled(false); back.setEnabled(false); retry.setEnabled(false);
      o.onRevive(ok => {
        if (this.reviveKey !== o.onRevive) return;
        this.reviveBusy = false;
        // Successful revival already closes this panel and resumes the battle.
        if (!ok && this.settlementKind === 'lose') {
          this.reviveHint = '暂未完成 · 点击重试复活';
          this.showLose({ ...o, tab: this.settlementTab });
        }
      });
    }, !this.reviveBusy, 'battleRevive');
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
    // 保留原面板与头像；数值移到条外，并给末行与关闭提示留出间距。
    const leader = Math.max(1, ...rows.map(r => r.val));
    rows.slice(0, 4).forEach((r, i) => {
      const cyAv = py + hh / 2 - 109 - i * 96;
      const cyTx = py + hh / 2 - 98 - i * 96;
      const cxAv = px - w / 2 + 51;
      gcircle(this.modalRoot, cxAv, cyAv, 35, CA('#2A3240', 1));
      const avLbl = label(this.modalRoot, cxAv, cyAv, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      // 74 > 70 座圆：头像盖满整个圆去黑环（用户反馈）
      if (r.id === 'archer' || r.id === 'sniper' || r.id === 'pyro' || r.id === 'volt' || r.id === 'mora')
        artSprite(this.modalRoot, cxAv, cyAv, 74, 74, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(this.modalRoot, px - w / 2 + 180, cyTx, r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 126, h: 30, shrink: true });
      label(this.modalRoot, px + w / 2 - 66, cyTx + 2, fmtWk(r.val),
        { size: 20, color: '#FFE27A', font: 'number', align: 'right', w: 100, h: 26, shrink: true });
      label(this.modalRoot, px + w / 2 - 66, cyTx - 17, (r.pct * 100).toFixed(2) + '%',
        { size: 11, color: '#BAC5CD', font: 'number', align: 'right', w: 100, h: 14 });
      const barX = px - w / 2 + 229.5, barY = py + hh / 2 - 135 - i * 96;
      const bar = gbar(this.modalRoot, barX, barY, 225, 10, '#F0793D');
      bar.set(r.val > 0 ? r.val / leader : 0);
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
    const cdTotal = hero.skillCdTotal + ' 秒';
    const goalTxt = String(Math.round(hero.chargeGoal * 10) / 10);
    const shockTxt = (h.shockOnHit || 0) > 0 ? '感电：受伤 +' + Math.round(h.shockOnHit * (h.shockAmpMul || 1) * 100) + '%' : '';
    const iconY = WYB(126, 46);
    let px: number, py: number, w = 300, hh = 272, title: string;
    let rows: [string, string][];
    if (kind === 'atk') {
      const atkTitle: Record<string, string> = { archer: '普攻 · 风刃射击', sniper: '普攻 · 重弩狙击', pyro: '普攻 · 烈焰火球', volt: '普攻 · 雷电球' };
      title = atkTitle[hero.id] || '普攻';
      rows = [
        ['伤害', String(Math.round(h.atk * h.atkMul))],
        ['攻速', h.aspd.toFixed(1) + ' 次/秒'],
        ['索敌范围', String(Math.round(h.range))],
        ['弹道', (h.fan + h.serial > 0 ? (1 + h.fan) + '×' + (1 + h.serial) + ' 弹幕' : '1 支')],
        ['暴击', Math.round(h.critRate * 100) + '% / ' + Math.round(h.critMul * 100) + '%'],
        ['目标', '最靠下'],
      ];
      px = hero.x - 27 + 23 + 16 + w / 2;
      py = iconY + 23 + 16 + hh / 2;
    } else if (kind === 'skill') {
      if (isArcher) {
        title = '技能 · 强化箭矢';
        const ec = archerEmpCfg(h.skillLv || 1);
        rows = [
          ['效果', `窗口 ${ec.dur}s · 接下来 ${ec.arrows} 次普攻强化`],
          ['强化伤害', Math.round(h.atk * h.atkMul * (h.normalMul || 1) * ec.mult) + `（×${ec.mult.toFixed(2)}）`],
          ['强化特性', '金色贯穿 · 攻速+30%'],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else if (hero.id === 'sniper') {
        title = '技能 · 穿颅射击';
        const sc = sniperSkCfg(h.skillLv || 1);
        rows = [
          ['效果', `锁定离防线最近 · 连续 ${Math.round(h.skillShots || 6)} 狙（${sc.window}s 窗口）`],
          ['每发伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * sc.mul) + `（×${sc.mul.toFixed(2)}）`],
          ['特性', '持续索敌 · 独立暴击'],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else if (hero.id === 'pyro') {
        title = '技能 · 烈焰爆裂';
        const pc = pyroSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '锁定最密集敌群 · 齐射 ' + Math.round(h.skillShots || 3) + ' 颗爆裂火球'],
          ['每发伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * pc.mul) + '（×' + pc.mul.toFixed(2) + '）'],
          ['特性', '大范围爆炸 + 灼烧' + (pc.boomMul > 0.4 ? ' · 溅射 +' + Math.round((pc.boomMul - 0.4) * 100) + '%' : '')],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else if (hero.id === 'mora') {
        title = '技能 · 冰霜领域';
        const mc = moraSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '密集区冰封 ' + ((h.novaStun || 1.5) + mc.stunBonus).toFixed(1) + 's · Boss免疫'],
          ['范围伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * mc.mul) + '（×' + mc.mul.toFixed(2) + '）'],
          ['特性', '解冻后减速 ' + Math.round(Math.min(0.9, 0.5 + (h.slowAmpBonus || 0)) * 100) + '% · 2s'],
          ['冷却时间', cdTotal],
          ['领域半径', String(Math.round((h.novaR || 150) * mc.rMul * (h.skillRangeMul || 1)))],
          ['释放', '自动 · 小怪/精英可冰封'],
        ];
      } else {
        title = '技能 · 连锁闪电';
        const vc = voltSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '最多连锁 ' + Math.round(h.skillShots || 5) + ' 个目标'],
          ['每跳伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * vc.mul) + '（×' + vc.mul.toFixed(2) + '）'],
          ['特性', (vc.chainInc ? '每跳递增 +' + Math.round(vc.chainInc * 100) + '% · ' : '') + (shockTxt || '跳距 ' + Math.round(260 * (h.skillRangeMul || 1)))],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      }
      px = hero.x + 27 + 23 + 16 + w / 2;
      py = iconY + 23 + 16 + hh / 2;
    } else if (isArcher) {
      title = '大招 · 扇形箭雨';
      w = 280; hh = 272;
      const uc = archerUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * uc.coeff) + ` × 每箭（×${uc.coeff.toFixed(2)}）`],
        ['形态', (Math.round(h.ultRounds || 1) > 1 ? Math.round(h.ultRounds) + ' 轮 × ' : '') + `${uc.rows} 排扇形 · 每排 ${uc.arrows} 箭`],
        ['特性', '无限贯穿'],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', '手动点击'],
      ];
      // 大招图标半径 45：面板右缘 = 图标圆心 - 45(半径) - 16(间距)
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    } else if (hero.id === 'sniper') {
      title = '大招 · 猎杀时刻';
      w = 280; hh = 272;
      const uc2 = sniperUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', `×${uc2.boltMul.toFixed(2)} 必定暴击`],
        ['形态', '0.5 秒锁定 → 贯穿弹' + (Math.round(h.ultBolts || 1) > 1 ? ' × ' + Math.round(h.ultBolts) + ' 线' : '') + (uc2.rMul > 1 ? ' · 弹体+' + Math.round((uc2.rMul - 1) * 100) + '%' : '')],
        ['特性', '无限贯穿 · 无视物抗' + (uc2.markAmp ? ` · 标记受伤+${Math.round(uc2.markAmp * 100)}% ${uc2.markDur}s` : '')],
        ['目标', (Math.round(h.ultBolts || 1) > 1 ? '全场血量最高的前 ' + Math.round(h.ultBolts) + ' 个' : '全场血量最高')],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    } else if (hero.id === 'pyro') {
      title = '大招 · 陨石天降';
      w = 280; hh = 272;
      const pu = pyroUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * pu.boltMul) + ' × 每颗'],
        ['索敌', '锁定怪群最密集处·固定范围'],
        ['形态', (pu.meteors > 5 ? '梅花五点+对角 · ' : '梅花五点砸落 ') + pu.meteors + ' 颗陨石' + (h.ultHaste ? ' · 放后攻速提升 5 秒' : '')],
        ['陨石坑', '燃烧 4 秒：灼烧 + 易伤 ' + Math.round((h.pitVuln || 0.25) * 100) + '%' + (pu.craterMul > 1 ? ' · 坑范围+' + Math.round((pu.craterMul - 1) * 100) + '%' : '')],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['释放', '手动点击'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    } else if (hero.id === 'mora') {
      title = '大招 · 极寒领域';
      w = 280; hh = 272;
      const mu = moraUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * mu.boltMul) + ' × 全场'],
        ['形态', '全屏冰暴 · 一次结算'],
        ['特性', '深度减速 ' + Math.round(Math.min(0.9, mu.slowMul + (h.slowAmpBonus || 0)) * 100)
          + '% · ' + (mu.slowDur + (h.ultSlowDur || 0)) + 's'],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', '手动点击'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    } else {
      title = '大招 · 天雷灭世';
      w = 280; hh = 272;
      const vu = voltUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', Math.round((h.atk * h.atkMul + (h.skillDmgFlat || 0)) * vu.boltMul) + ' × 每道'],
        ['形态', '15 道天雷轰炸全场' + (vu.rMul > 1 ? ' · 爆炸范围+' + Math.round((vu.rMul - 1) * 100) + '%' : '')],
        ['特性', '范围爆炸 · 眩晕 ' + (h.ultStun || 1).toFixed(1) + 's' + (vu.shockOn ? ' · 落雷感电' : shockTxt ? ' · ' + shockTxt : '')],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', '手动点击'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    }
    // 面板整体收敛进可视区
    px = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, px));
    py = Math.max(-LO.half + hh / 2 + 8, Math.min(LO.half - hh / 2 - 8, py));

    // 底板 0.78（用户调整：Tips 再增加一点透明度，战斗画面更可见）；点空白关闭不受影响
    const tipsPanel = gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.78), undefined, 0, 12);
    // 左右内边距 16（用户调整：原 30 过大）；左列固定 90 + 间距 12，剩余全给数值列（过长 shrink 而非压得过小）
    const pad = 16, lblW = 90, gap = 12;
    const valW = w - pad * 2 - lblW - gap;
    // 标题行：普攻/技能/大招用真图标资源（用户调整：去 emoji 字符），36 号略大盖过行高
    artSprite(tipsPanel, -w / 2 + pad + 18, hh / 2 - 41, 36, 36, 'ui_icon_' + kind + '_' + hero.id, { sliced: false });
    label(this.modalRoot, px - w / 2 + pad + 44 + (w - pad * 2 - 44) / 2, py + hh / 2 - 41, title,
      { size: 18, color: '#FFFFFF', bold: true, align: 'left', w: w - pad * 2 - 44, h: 26, shrink: true });
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
