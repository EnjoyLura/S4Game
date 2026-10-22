/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Graphics, Label, Node, Sprite, sys, tween, UIOpacity, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR, archerEmpCfg, archerUltCfg, sniperSkCfg, sniperUltCfg, voltSkCfg, voltUltCfg, pyroSkCfg, pyroUltCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { FROST_ULT_RAIN_COUNT, HERO_Y, LO, PAL } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroBase } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave, saveSave } from '../core/SaveData';
import { StageLootSummary } from '../core/StageLoot';
import { DIFFICULTIES } from '../config/LevelDifficulty';
import { COMIC, comicButtonControl, ComicButtonControl } from './ComicUI';
import { bindButton, ButtonFeedback } from './ButtonFeedback';
import { motionIn, retireChildren, stopMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';
import { PickMotion } from './PickMotion';
import { uiSound } from './UIAudio';
import { pickCardArt } from './PickArt';
import { C, CA, dimLayer, gcircle, gpanel, label, N, setText, WY, WYB, WX } from './UIKit';
import { battleArtIcon as artIcon, battleArtSprite as artSprite, battleStatBar as gbar } from './BattlePanelSkin';
import { pauseButton, pauseFrame, pauseRow, pauseSwitch, pauseTabFace } from './PausePanelSkin';
import { playSettlement, settlementButton, settlementFrame, settlementRewards } from './SettlementPanelSkin';
import { battleRewardPanel } from './BattleRewardPanel';
import { showCollectedLoot } from './LevelLootPreview';

interface PickCallbacks {
  recommendedId?: string;
  onSkipTeaching?: () => void;
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
  private pickPending = false;
  private panelVersion = 0;
  private doubleKey?: object;
  private doubleBusy = false;
  private doubleClaimed = false;
  private winGoldShown = 0;
  private reviveKey?: object;
  private reviveBusy = false;
  private settlementKind: 'win' | 'lose' | null = null;
  private reviveHint = '';
  private activeKind = '';
  private pickMotion: PickMotion | null = null;

  closeAll(animated = false): void {
    const wasPick = this.activeKind === 'pick';
    this.activeKind = '';
    this.settlementKind = null;
    this.picking = false;
    this.pickPending = false;
    this.panelVersion++;
    this.pickMotion = null;
    stopMotion(this.modalRoot);
    if (animated && !wasPick) retireChildren(this.modalRoot);
    else {
      if (wasPick) this.modalRoot.children.forEach(c => { c.active = false; });
      this.modalRoot.destroyAllChildren();
    }
  }

  private begin(kind: string): boolean {
    const fresh = kind !== this.activeKind;
    this.closeAll(); this.activeKind = kind;
    if (kind !== 'pick') motionIn(this.modalRoot, fresh && kind !== 'win' && kind !== 'lose' ? 'fade' : 'refresh');
    if (fresh && kind !== 'win' && kind !== 'lose' && kind !== 'pick') uiSound('open');
    return fresh;
  }

  /** 新的三选一弹窗打开时重置刷新次数（跨弹窗不共享 §3.8） */
  resetPickRefresh(): void {
    this.pickAdLeft = 1;
    this.pickDiaLeft = 1;
  }

  /* ---------- ② 三选一 ---------- */
  showPick(cards: CardDef[], _stacks: CardStacks, cb: PickCallbacks): void {
    const previous = this.activeKind === 'pick' && this.pickMotion?.node.isValid ? this.pickMotion : null;
    if (previous) ++this.panelVersion;
    else { this.begin('pick'); dimLayer(this.modalRoot, .68, false, false); }
    const version = this.panelVersion;
    this.picking = false; this.pickPending = true;
    // Move the complete original layout down together; keep the footer inside short screens.
    const shift = Math.min(56, Math.max(0, LO.half * 2 - LO.safeTop - LO.safeBottom - 938 - 40));
    const pickRoot = N('pickRoot', this.modalRoot, 0, -shift);
    // Original paper/title layout; one dedicated controller owns the complete motion.
    const titleBg = gpanel(pickRoot, 0, WY(308, 88), 520, 88, CA(PAL.parch, 0.95), PAL.gold, 2.5, 14);
    artSprite(titleBg, 0, 0, 520, 88, 'pick_comic_v1/title_plate', { belowIdx: 0 });
    label(titleBg, 0, 0, '选择强化', { size: 34, color: '#4A3214', bold: true });
    const motion = pickRoot.addComponent(PickMotion);
    const canInteract = (): boolean => version === this.panelVersion && motion.ready && !this.picking && !this.pickPending;
    const xs = [22, 264, 506];
    const frames: Node[] = [];
    cards.forEach((card, i) => {
      const x = WX(xs[i], 222), y = WY(428, 360);
      // Separate touch/selection shell from the small button compression on its artwork.
      const frame = N('pickSlot:' + card.id, pickRoot, x, y, 222, 360);
      frame.name = 'pickCard:' + card.id;
      frames.push(frame);
      const face = gpanel(frame, 0, 0, 222, 360, '#F5E8CD', undefined, 0, 12);
      this.buildCard(face, card);
      if (card.id === cb.recommendedId) {
        const badge = gpanel(face, 0, 196, 200, 28, '#F6D57A', '#765927', 1, 8);
        label(badge, 0, 0, '新手推荐 · 可自由选', { size: 16, color: '#49371D', bold: true, w: 190, h: 24 });
      }
      bindButton(frame, () => {
        if (!canInteract()) return;
        this.picking = true;
        frames.forEach(f => f.getComponent(ButtonFeedback)?.reset());
        if (!motion.choose(i, () => {
          if (version !== this.panelVersion || !pickRoot.isValid) return;
          cb.onPick(card);
          if (version === this.panelVersion && pickRoot.isValid) { this.picking = false; motion.restore(); }
        })) this.picking = false;
      }, { visual: face, scale: .955, shift: 1, releaseMotion: false, sound: false, enabled: canInteract });
    });

    const footer = N('pickRefreshFooter', pickRoot);
    if (cb.onSkipTeaching) {
      const skip = label(footer, 0, WY(778, 36), '跳过新手引导', { size: 18, color: '#FFE3A3', w: 280, h: 36 });
      bindButton(skip, () => { if (canInteract()) cb.onSkipTeaching?.(); }, { sound: 'select' });
    }
    const refreshNote = label(footer, 0, WY(818, 40),
      '当局剩余刷新：广告 ' + this.pickAdLeft + ' 次 · 钻石 ' + this.pickDiaLeft + ' 次',
      { size: 18, color: '#CFE3FF' });

    // 复用主界面按钮；沿用广告／钻石刷新不同宽度与原回调。
    const requestAd = (): void => {
      if (!canInteract() || this.pickAdLeft <= 0) return;
      this.pickPending = true;
      adRefresh.setBusy(true, '刷新中…'); diamondRefresh.setEnabled(false);
      this.pickAdLeft--;
      AdService.showRewarded('pick_refresh', () => {
        if (version === this.panelVersion) cb.onRefreshRequest();
      }, () => {
        if (version === this.panelVersion) { this.pickAdLeft++; this.showPick(cards, _stacks, cb); }
      });
    };
    const adRefresh = this.pickBtn(footer, WX(130, 300), WY(862, 76), 300, 76, '▶ 广告刷新', 24,
      this.pickAdLeft > 0 ? PAL.green : '#5A6472',
      this.pickAdLeft > 0 ? '#5E8F2E' : '#454E59',
      this.pickAdLeft > 0 ? '#20240F' : '#DCE2EA',
      requestAd);
    const requestDiamond = (): void => {
      if (!canInteract() || this.pickDiaLeft <= 0) return;
      const sv = loadSave();
      if (sv.diamonds < 2) { setText(refreshNote, '钻石不足，需要 2 钻石'); uiSound('warning'); return; }
      sv.diamonds -= 2; saveSave(); this.pickDiaLeft--; this.pickPending = true;
      diamondRefresh.setBusy(true, '刷新中…'); adRefresh.setEnabled(false);
      cb.onRefreshRequest();
    };
    const diamondRefresh = this.pickBtn(footer, WX(460, 180), WY(862, 76), 180, 76, '💎2 钻石刷新', 22,
      this.pickDiaLeft > 0 ? PAL.gold : '#5A6472',
      this.pickDiaLeft > 0 ? '#C98A1A' : '#454E59',
      this.pickDiaLeft > 0 ? '#3A2A10' : '#DCE2EA',
      requestDiamond);
    bindButton(adRefresh.node, requestAd, { enabled: () => canInteract() && this.pickAdLeft > 0 });
    bindButton(diamondRefresh.node, requestDiamond, { enabled: () => canInteract() && this.pickDiaLeft > 0 });
    motion.configure(titleBg, footer, frames);
    if (!previous) motion.previewTitle();
    whenUIArtReady(pickRoot, () => {
      if (version !== this.panelVersion || !pickRoot.isValid) return;
      this.pickMotion = motion;
      motion.reveal(previous, () => { if (version === this.panelVersion) this.pickPending = false; });
    });
  }

  /** Lobby buttons in the existing refresh geometry; availability checks stay in the callbacks. */
  private pickBtn(parent: Node, x: number, y: number, w: number, h: number, text: string,
    size: number, base: string, edge: string, txt: string, cb: () => void): ComicButtonControl {
    const tone = base === '#5A6472' ? 'muted' : text.startsWith('▶') ? 'green' : 'gold';
    return comicButtonControl(parent, x, y, w, h, text, cb, {
      tone, size, enabled: tone !== 'muted', color: tone === 'muted' ? COMIC.text : undefined,
      name: text.startsWith('▶') ? 'pickAdRefresh' : 'pickDiamondRefresh',
    });
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
    label(header, 0, 0, card.name, { size: 22, color: card.rarity === 'white' || card.rarity === 'gold' ? '#4A3214' : '#FFFFFF', bold: true, w: 188, h: 40, shrink: true });

    // ② 图标座 120 圆 + 内嵌 96 圆（卡面美术图 ui_card_<id>；缺图回退首字母——用户要求：卡面用图标资源）
    const gear = gcircle(frame, 0, 50, 60, CA('#2A3240', 1));
    const icon = gcircle(frame, 0, 50, 48, CA(rarity, 0.16));
    const iconLbl = label(icon, 0, 0, card.id.slice(0, 2).toUpperCase(), { size: 26, color: card.rarity === 'white' ? '#E8E0C8' : rarity, bold: true });
    artSprite(frame, 0, 50, 124, 124, pickCardArt(card), { sliced: false, hideOnLoad: [iconLbl] });

    // ③ 右上归属角标：仅英雄专属卡贴头像（用户调整：通用卡不再显示"全"角标）
    if (card.owner !== 'global') {
      const ava = gcircle(frame, 80, 94, 24, CA('#2A3240', 1));
      artSprite(ava, 0, 0, 48, 48, 'ui_avatar_' + card.owner, { sliced: false });
    }

    // Explicit semantic lines preserve phrases, conditions and units; shrink only guards unusually long new copy.
    const description = label(frame, 0, -94, card.desc, {
      size: 18, color: '#4A3214', bold: true, font: 'body', w: 196, h: 112, shrink: true, lineHeight: 25,
    });
    description.name = 'pickDescription:' + card.id;
    description.getComponent(Label)!.enableWrapText = false;
  }

  /** Pause tabs own a fixed footer band, separate from settings and the credits link. */
  private tabsBar(parent: Node, tabs: string[], active: number, onSel: (i: number) => void): void {
    const n = tabs.length, segW = 690 / n, segH = 58;
    tabs.forEach((t, i) => {
      const seg = N('tabseg' + i, parent, (i - (n - 1) / 2) * segW, -170, segW, segH);
      pauseTabFace(seg, i, n, segW, segH, i === active);
      label(seg, 0, 0, t, { size: 22, color: i === active ? COMIC.text : COMIC.cream,
        bold: true, w: segW - 16, h: 38, shrink: true });
      bindButton(seg, () => { if (i !== active) onSel(i); }, { scale: .97, shift: 1, sound: 'select' });
    });
  }

  /** Four squad members fit above the reserved credits / tabs / action bands. */
  private statsRows(parent: Node, rows: DamageRow[]): void {
    const shown = rows.slice(0, 4);
    const leader = Math.max(1, ...rows.map(r => r.val));
    shown.forEach((r, i) => {
      const host = N('pauseDamageRow:' + r.id, parent, 0, 158 - i * 66);
      const av = gcircle(host, -282, 0, 26, CA('#2A3240', 1));
      const avLbl = label(av, 0, 0, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      if (r.id === 'archer' || r.id === 'sniper' || r.id === 'pyro' || r.id === 'volt' || r.id === 'mora')
        artSprite(av, 0, 0, 44, 44, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(host, -93, 9, r.name, { size: 18, color: '#FFFFFF', align: 'left', w: 296, h: 26, shrink: true });
      label(host, 250, 9, fmtWk(r.val),
        { size: 20, color: '#FFE27A', font: 'number', align: 'right', w: 130, h: 24, shrink: true });
      label(host, 250, -10, (r.pct * 100).toFixed(2) + '%',
        { size: 11, color: '#BAC5CD', font: 'number', align: 'right', w: 130, h: 12 });
      const bar = gbar(host, 36, -24, 558, 8, '#F0793D');
      bar.set(r.val > 0 ? r.val / leader : 0);
    });
  }

  /* ---------- ④ 暂停（页签：奖励总览/伤害统计/设置，线稿④/④-1/④-2） ---------- */
  showPause(o: {
    onResume: () => void; onExit: () => void;
    music: boolean; sfx: boolean;
    onToggle: (k: 'music' | 'sfx', v: boolean) => void;
    tab?: number; speed: number; speedUnlocked: boolean; xp: number; loot?: StageLootSummary;
  }): void {
    const tab = o.tab ?? 0;
    const fresh = this.begin('pause');
    dimLayer(this.modalRoot, .68, false, fresh);
    const root = pauseFrame(this.modalRoot);
    artSprite(root, 0, 298, 360, 68, 'pause_comic_v1/title_ribbon');
    label(root, 0, 298, '暂 停', { size: 46, color: '#FFFFFF', bold: true, w: 320, h: 62 });
    this.tabsBar(root, ['奖励总览', '伤害统计', '设置'], tab, t => this.showPause({ ...o, tab: t }));
    if (tab === 0) {
      battleRewardPanel(root, {
        top: 236, heading: '已获得奖励', gold: this.dir.goldEarned, xp: o.xp, loot: o.loot,
        note: '金币与经验为本局累计',
        onInspect: o.loot ? () => showCollectedLoot(this.modalRoot, o.loot!) : undefined,
      });
    } else if (tab === 1) {
      label(root, 0, 216, '— 伤害统计（本局） —', { size: 22, color: '#FFE08A', w: 560, h: 32 });
      this.statsRows(root, this.dir.dmgSvc.rows());
    } else {
      // 设置页签：左右旋钮开关（线稿④-2）；音乐/音效切换即时生效并写存档；振动随战斗手感批次实装
      const mkRow = (y: number, name: string, gray: boolean, sw?: { on: boolean; onChange: (v: boolean) => void }) => {
        pauseRow(root, 0, y, 670, 60);
        label(root, -140, y, name,
          { size: 20, color: gray ? '#889099' : '#FFFFFF', align: 'left', w: 350, h: 40, shrink: true });
        pauseSwitch(root, 265, y, 100, 44, sw ? sw.on : false,
          sw ? sw.onChange : undefined, !sw);
      };
      mkRow(202, '🎵 音乐', false, { on: o.music, onChange: v => { o.music = v; o.onToggle('music', v); } });
      mkRow(126, '🔊 音效', false, { on: o.sfx, onChange: v => { o.sfx = v; o.onToggle('sfx', v); } });
      mkRow(50, '📳 振动（未开放）', true);
      // 倍速行：循环按钮 1x/2x（非开关形态）
      pauseRow(root, 0, -26, 670, 60);
      label(root, -140, -26, '⏩ 战斗倍速' + (o.speedUnlocked ? '' : '（1-2 通关解锁）'),
        { size: 20, color: o.speedUnlocked ? '#FFFFFF' : '#889099', align: 'left', w: 350, h: 40, shrink: true });
      if (o.speedUnlocked) {
        pauseButton(root, 265, -26, 100, 44, o.speed === 1.5 ? '1.5x' : '1x',
          () => { this.dir.toggleSpeed(); this.showPause({ ...o, tab: 2, speed: this.dir.speed }); }, 18,
          o.speed === 1.5 ? 'green' : 'muted');
      } else {
        pauseSwitch(root, 265, -26, 100, 44, false, undefined, true);
      }
      const credits = label(root, 0, -100, '音乐与音效鸣谢 ↗', {
        size: 17, color: '#B9D8EA', w: 300, h: 44,
      });
      credits.name = 'pauseAudioCredits';
      bindButton(credits, () => {
        sys.openURL(new URL('audio-credits.html', window.location.href).href);
      });
    }
    pauseButton(root, -175, -270, 300, 86, '⏻ 退出', o.onExit, 22, 'gold');
    pauseButton(root, 175, -270, 300, 86, '▶ 继续战斗', o.onResume, 22, 'green');
  }

  /* ---------- ⑥ 胜利结算：评级、奖励与固定操作区 ---------- */
  showWin(o: {
    stars: 1 | 2 | 3; gold: number; ratio: number; xp: number; loot?: StageLootSummary;
    onDouble: (done: (ok: boolean) => void) => void;
    onExit: () => void;
  }): void {
    if (this.doubleKey !== o.onDouble) { this.doubleKey = o.onDouble; this.doubleBusy = false; this.doubleClaimed = false; this.winGoldShown = o.gold; }
    const fresh = this.begin('win');
    this.settlementKind = 'win';
    dimLayer(this.modalRoot, .68, false, fresh);
    const root = settlementFrame(this.modalRoot, 'win', this.dir.levelDef.id + '  ' + this.dir.levelDef.name + ' · ' + DIFFICULTIES[this.dir.levelDef.difficulty].name, o.stars, o.ratio, fresh);
    settlementRewards(root, 'win', o.gold * (this.doubleClaimed ? 2 : 1), o.xp,
      this.doubleClaimed ? '双倍金币已领取 · 战利品保持原数量' : '本局累计金币已到账 · 广告仅加倍金币', o.loot,
      { intro: fresh, goldFrom: fresh ? 0 : this.winGoldShown });
    this.winGoldShown = o.gold * (this.doubleClaimed ? 2 : 1);
    const back = settlementButton(root, 153, -353, 286, 78, '返回', 'gold', o.onExit, !this.doubleBusy, 'battleReturn');
    const dbl = settlementButton(root, -153, -353, 286, 78,
      this.doubleClaimed ? '已领取' : this.doubleBusy ? '领取中…' : '金币x2',
      this.doubleClaimed ? 'muted' : 'teal', () => {
      if (this.doubleBusy || this.doubleClaimed) return;
      this.doubleBusy = true;
      const playIcon = dbl.node.getChildByName('buttonFace')?.getChildByName('doubleGoldPlayIcon');
      if (playIcon) playIcon.active = false;
      dbl.setBusy(true, '领取中…'); back.setEnabled(false);
      o.onDouble(ok => {
        if (this.doubleKey !== o.onDouble) return;
        this.doubleBusy = false;
        if (ok) this.doubleClaimed = true;
        if (this.settlementKind === 'win') this.showWin(o);
      });
    }, !this.doubleBusy && !this.doubleClaimed, 'battleDouble');
    if (!this.doubleBusy && !this.doubleClaimed) {
      const face = dbl.node.getChildByName('buttonFace')!;
      const caption = face.children.find(child => !!child.getComponent(Label));
      if (caption) caption.setPosition(15, 1, 0);
      // Draw the play symbol independently of font glyph coverage.
      const play = N('doubleGoldPlayIcon', face, -59, 1, 22, 26).addComponent(Graphics);
      play.fillColor = C('#FFF3D5');
      play.moveTo(-9, -12); play.lineTo(11, 0); play.lineTo(-9, 12); play.close(); play.fill();
    }
    if (this.doubleBusy) dbl.setBusy(true);
    playSettlement(root);
  }

  /* ---------- ⑤ 失败结算：蓝灰破损皇冠与复活操作 ---------- */
  showLose(o: {
    goldFloor: number; reviveRatio: number; xp: number; loot?: StageLootSummary;
    onRevive: (done: (ok: boolean) => void) => void;
    onRetry: () => void;
  }): void {
    if (this.reviveKey !== o.onRevive) { this.reviveKey = o.onRevive; this.reviveBusy = false; this.reviveHint = ''; }
    const fresh = this.begin('lose');
    this.settlementKind = 'lose';
    dimLayer(this.modalRoot, .72, false, fresh);
    const root = settlementFrame(this.modalRoot, 'lose', this.dir.levelDef.id + '  ' + this.dir.levelDef.name + ' · ' + DIFFICULTIES[this.dir.levelDef.difficulty].name, 0, 0, fresh);
    settlementRewards(root, 'lose', o.goldFloor, o.xp,
      o.loot?.equipment.length ? '金币和装备已保存 · 复活继续本局 / 重试返回关卡页'
        : '金币已到账 · 复活恢复 ' + Math.round(o.reviveRatio * 100) + '% 耐久 · 重试返回当前关卡', o.loot, { intro: fresh });
    const retry = settlementButton(root, 153, -353, 286, 78, '↻ 再来一次', 'gold', o.onRetry, !this.reviveBusy, 'battleRetry');
    const rv = settlementButton(root, -153, -353, 286, 78,
      this.reviveBusy ? '复活中…' : this.reviveHint || '▶ 看广告复活', 'teal', () => {
      if (this.reviveBusy) return;
      this.reviveBusy = true;
      this.reviveHint = '';
      rv.setBusy(true, '复活中…'); retry.setEnabled(false);
      o.onRevive(ok => {
        if (this.reviveKey !== o.onRevive) return;
        this.reviveBusy = false;
        // Successful revival already closes this panel and resumes the battle.
        if (!ok && this.settlementKind === 'lose') {
          this.reviveHint = '广告未完成 · 重试';
          this.showLose(o);
        }
      });
    }, !this.reviveBusy, 'battleRevive');
    if (this.reviveBusy) rv.setBusy(true);
    playSettlement(root);
  }

  /* ---------- ③ 伤害统计（不暂停；无遮罩、贴统计图标右侧、点空白关闭，与属性Tips同规范） ---------- */
  showStats(rows: DamageRow[]): void {
    this.begin('stats');
    // 全屏透明捕获层：点任意空白处关闭（不加变暗遮罩）
    const catcher = N('statsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll(true));

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
    this.begin('tips');
    // 全屏透明捕获层：点任意空白处关闭（不加变暗遮罩，§3.11 战斗不暂停）
    const catcher = N('tipsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll(true));

    // Match the actual distance check at (hero.x, HERO_Y); unlimited range needs no circle.
    const R = kind === 'atk' ? hero.stats.range : kind === 'skill' ? hero.stats.skillRange : 0;
    if (R > 0 && R < 2000) {
      const rc = N('range', this.modalRoot, hero.x, HERO_Y, R * 2, R * 2);
      const rg = rc.addComponent(Graphics);
      const col = kind === 'atk' ? '#FFD16A' : '#79D4FF';
      const core = kind === 'atk' ? '#FFF0C2' : '#E0F8FF';
      // A quiet wash preserves enemy readability; the contrast keyline survives yellow terrain.
      rg.fillColor = CA(col, 0.10);
      rg.circle(0, 0, R);
      rg.fill();
      for (const [width, color, alpha] of [
        [17, col, .14], [8, '#302D27', .78], [4.5, col, 1], [1.25, core, .95],
      ] as [number, string, number][]) {
        rg.lineWidth = width; rg.strokeColor = CA(color, alpha);
        rg.circle(0, 0, R); rg.stroke();
      }
      rc.on(Node.EventType.TOUCH_END, () => this.closeAll(true)); // 圈内点按同样视为"空白处"
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
        ['伤害', String(Math.round(hero.effAtk * (h.normalMul || 1)))],
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
          ['强化伤害', Math.round(hero.abilityDamage(ec.mult)) + `（技×${ec.mult.toFixed(2)}）`],
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
          ['每发伤害', Math.round(hero.abilityDamage(sc.mul)) + `（技×${sc.mul.toFixed(2)}）`],
          ['特性', '持续索敌 · 独立暴击' + (h.skillPierce ? ` · 穿透+${h.skillPierce}` : '')],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else if (hero.id === 'pyro') {
        title = '技能 · 烈焰爆裂';
        const pc = pyroSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '锁定最密集敌群 · 齐射 ' + Math.round(h.skillShots || 3) + ' 颗爆裂火球'],
          ['每发伤害', Math.round(hero.abilityDamage(pc.mul)) + '（技×' + pc.mul.toFixed(2) + '）'],
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
          ['范围伤害', Math.round(hero.abilityDamage(mc.mul)) + '（技×' + mc.mul.toFixed(2) + '）'],
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
          ['每跳伤害', Math.round(hero.abilityDamage(vc.mul)) + '（技×' + vc.mul.toFixed(2) + '）'],
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
        ['伤害', Math.round(hero.abilityDamage(uc.coeff, true)) + ` × 每箭（技×${uc.coeff.toFixed(2)}）`],
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
      const markAmp = Math.max(uc2.markAmp, h.ultMarkAmp || 0);
      rows = [
        ['伤害', Math.round(hero.abilityDamage(uc2.boltMul, true)) + ' · 必定暴击'],
        ['形态', '1.1 秒锁定 → 重击贯穿弹' + (Math.round(h.ultBolts || 1) > 1 ? ' × ' + Math.round(h.ultBolts) + ' 线' : '') + (uc2.rMul > 1 ? ' · 弹体+' + Math.round((uc2.rMul - 1) * 100) + '%' : '')],
        ['特性', '无限贯穿 · 无视物抗' + (markAmp ? ` · 标记受伤+${Math.round(markAmp * 100)}% ${uc2.markDur}s` : '')],
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
        ['伤害', Math.round(hero.abilityDamage(pu.boltMul, true)) + ' × 每颗'],
        ['索敌', '优先不同怪群 · 预警后固定落点'],
        ['形态', '分散轰炸 ' + pu.meteors + ' 颗陨石' + (h.ultHaste ? ' · 放后攻速提升 5 秒' : '')],
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
        ['伤害', Math.round(hero.abilityDamage(mu.boltMul, true)) + ' × 全场'],
        ['形态', FROST_ULT_RAIN_COUNT + '颗冰晶雨 · 全场'],
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
        ['伤害', Math.round(hero.abilityDamage(vu.boltMul, true)) + ' × 每道'],
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
