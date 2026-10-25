/**
 * 弹窗面板（UX 线稿 ②~⑤⑧）：三选一 / 暂停 / 胜利结算 / 失败结算(含广告复活) / 伤害统计 / 属性Tips
 * 弹窗内容块均以屏幕垂直中心为重心；三选一期间全场冻结由 BattleDirector 状态控制
 */
import { Graphics, Label, Mask, Node, ScrollView, Sprite, sys, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { CardDef, CardStacks, RARITY_COLOR, archerEmpCfg, archerUltCfg, sniperSkCfg, sniperUltCfg, voltSkCfg, voltUltCfg, pyroSkCfg, pyroUltCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { pyroBlastRadius, pyroBurnMultiplier, pyroBurnDuration, pyroCraterDuration, pyroMeteorCount, pyroMeteorDamage } from '../config/Cards';
import { voltShockDuration, voltShockAmp, voltShockedMultiplier, voltStrikeCount } from '../config/Cards';
import { CANNON, SIPHON_LASER, cannonSkillCfg, cannonUltCfg, siphonSkillCfg, siphonLaserCfg } from '../config/NewHeroConfig';
import { WIND, NINJA, VOLT_FIELD, windSkillCfg, windUltCfg, ninjaSkillCfg, ninjaUltCfg } from '../config/WindNinjaConfig';
import { MORA_ULT_HITS, moraSlowRatio, moraSlowDuration, moraFreezeChance, moraNormalFreezeDuration, moraFieldRadius, moraFieldFreeze, moraUltimateHitDamage } from '../config/Cards';
import { FROST_ULT_RAIN_COUNT, HERO_Y, LO, PAL } from '../config/GameConfig';
import { targetLabel } from '../config/Targeting';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { HeroBase } from '../battle/Hero';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave, saveSave } from '../core/SaveData';
import { HERO_DEFS } from '../core/GameData';
import { StageLootSummary } from '../core/StageLoot';
import { DIFFICULTIES } from '../config/LevelDifficulty';
import { COMIC, comicArt, comicButton, comicButtonControl, comicDialogContent, ComicButtonControl } from './ComicUI';
import { detailSkin } from './DetailDialog';
import { bindButton, ButtonFeedback } from './ButtonFeedback';
import { motionIn, retireChildren, stopMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';
import { PickMotion } from './PickMotion';
import { uiSound } from './UIAudio';
import { pickCardIcon } from './PickArt';
import { C, CA, dimLayer, gcircle, gpanel, label, N, setText, WY, WYB, WX } from './UIKit';
import { battleArtIcon as artIcon, battleArtSprite as artSprite, battleStatBar as gbar } from './BattlePanelSkin';
import { damageStatColors } from './BattleProgressBar';
import { pauseButton, pauseFrame, pauseRow, pauseSwitch, pauseTabFace } from './PausePanelSkin';
import { playSettlement, settlementButton, settlementFrame, settlementRewards } from './SettlementPanelSkin';
import { battleRewardPanel } from './BattleRewardPanel';
import { showCollectedLoot } from './LevelLootPreview';
import { showItemDetails } from './ItemDetails';
import { BuildTeam, cardComboHint, ownedBuildCards } from '../config/Cards';
import { bindBrowserBack } from './BrowserBack';
import { dismissUI } from './UIMotion';

interface PickCallbacks {
  recommendedId?: string;
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
  private buildOverlay: Node | null = null;

  closeAll(animated = false): void {
    const wasPick = this.activeKind === 'pick';
    this.activeKind = '';
    this.settlementKind = null;
    this.picking = false;
    this.pickPending = false;
    this.panelVersion++;
    this.pickMotion = null;
    this.buildOverlay = null;
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
  showPick(cards: CardDef[], stacks: CardStacks, cb: PickCallbacks): void {
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
    const canInteract = (): boolean => version === this.panelVersion && motion.ready && !this.picking && !this.pickPending && !this.buildOverlay?.isValid;
    // Child of the existing title chrome: follows its reveal/refresh/selection lifetime.
    const buildLink = label(titleBg, 174, 66, '本局强化 ›', {
      size: 18, color: '#FFE3A3', w: 172, h: 44,
    });
    buildLink.name = 'pickBuildOverview';
    bindButton(buildLink, () => { if (canInteract()) this.showBuildOverview(); }, { enabled: canInteract });
    const xs = [22, 264, 506];
    const frames: Node[] = [];
    cards.forEach((card, i) => {
      const x = WX(xs[i], 222), y = WY(428, 360);
      // Separate touch/selection shell from the small button compression on its artwork.
      const frame = N('pickSlot:' + card.id, pickRoot, x, y, 222, 360);
      frame.name = 'pickCard:' + card.id;
      frames.push(frame);
      const face = gpanel(frame, 0, 0, 222, 360, '#F5E8CD', undefined, 0, 12);
      this.buildCard(face, card, stacks);
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
        if (version === this.panelVersion) { this.pickAdLeft++; this.showPick(cards, stacks, cb); }
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
    }, undefined, 250);
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
  private buildCard(frame: Node, card: CardDef, _stacks: CardStacks): void {
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
    pickCardIcon(frame, 0, 50, 124, card, [iconLbl]);

    // ③ 右上归属角标：仅英雄专属卡贴头像（用户调整：通用卡不再显示"全"角标）
    if (card.owner !== 'global') {
      const ava = gcircle(frame, 80, 94, 24, CA('#2A3240', 1));
      artSprite(ava, 0, 0, 48, 48, 'ui_avatar_' + card.owner, { sliced: false });
    }

    // Shared concise copy: no stack counters or automatic combo hints on the choice card.
    const description = label(frame, 0, -94, card.desc, {
      size: 18, color: '#4A3214', bold: true, font: 'body', w: 196, h: 112, shrink: true, lineHeight: 25,
    });
    description.name = 'pickDescription:' + card.id;
    description.getComponent(Label)!.enableWrapText = false;
  }

  /** A read-only child overlay keeps the current draw, refresh allowance and battle pause intact. */
  private showBuildOverview(): void {
    if (this.buildOverlay?.isValid || (this.activeKind !== 'pick' && this.activeKind !== 'pause')) return;
    const overlay = dimLayer(this.modalRoot, .66);
    overlay.name = 'battleBuildOverview'; this.buildOverlay = overlay;
    const close = (): void => {
      releaseBack();
      if (overlay.isValid) dismissUI(overlay);
      if (this.buildOverlay === overlay) this.buildOverlay = null;
    };
    const releaseBack = bindBrowserBack(overlay, close);
    overlay.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
      if (e) e.propagationStopped = true;
      close();
    });
    const W = 660, H = Math.min(900, LO.half * 2 - LO.notchTop * 2 - 48);
    const root = comicDialogContent(overlay, W, H, '本局强化', close);
    detailSkin(root, W, H, '本局强化');
    const stacks = this.dir.stacks, team: BuildTeam = this.dir.heroes;
    const groups = [...this.dir.heroes.map(hero => ({
      owner: hero.id, name: hero.name, cards: ownedBuildCards(hero.id, stacks),
    })), { owner: 'global', name: '全队与防线', cards: ownedBuildCards('global', stacks) }];
    const total = groups.reduce((sum, group) => sum + group.cards.reduce((n, card) => n + stacks[card.id], 0), 0);
    label(root, 0, H / 2 - 86, '已选择 ' + total + ' 次强化 · 按英雄查看', {
      size: 19, color: COMIC.sub, w: 580, h: 30,
    });
    const rowHeight = (card: CardDef): number => 42 + card.desc.split('\n').length * 24
      + (cardComboHint(card, stacks, team) ? 28 : 0);
    const contentHeight = groups.reduce((sum, group) => sum + 72 + (group.cards.length
      ? group.cards.reduce((height, card) => height + rowHeight(card), 0) : 40) + 18, 0);
    const top = H / 2 - 112, bottom = -H / 2 + 66, height = top - bottom;
    const view = N('buildListView', root, 0, (top + bottom) / 2, 596, height);
    view.addComponent(Mask);
    const scroll = view.addComponent(ScrollView);
    const content = N('buildListContent', view, 0, height / 2, 596, Math.max(height, contentHeight));
    content.getComponent(UITransform)!.setAnchorPoint(.5, 1);
    scroll.content = content; scroll.horizontal = false; scroll.vertical = contentHeight > height;
    scroll.inertia = true; scroll.elastic = false; scroll.brake = .7; scroll.cancelInnerEvents = true;
    let cursor = 0;
    groups.forEach(group => {
      const selected = group.cards.reduce((sum, card) => sum + stacks[card.id], 0);
      if (group.owner !== 'global')
        artSprite(content, -268, -cursor - 30, 48, 48, 'ui_avatar_' + group.owner, { sliced: false });
      label(content, group.owner === 'global' ? -12 : 16, -cursor - 30,
        group.name + ' · ' + selected + '次', {
          size: 22, color: COMIC.text, bold: true, align: 'left', w: group.owner === 'global' ? 556 : 500, h: 36,
        });
      cursor += 72;
      if (!group.cards.length) {
        label(content, 0, -cursor - 14, group.owner === 'global' ? '尚未选择全局强化' : '尚未选择专属强化 · 基础技能与大招可用', {
          size: 18, color: COMIC.sub, align: 'left', w: 568, h: 28,
        });
        cursor += 40;
      }
      group.cards.forEach(card => {
        pickCardIcon(content, -260, -cursor - 27, 48, card);
        label(content, 28, -cursor - 14, card.name + ' · ' + stacks[card.id] + '/' + card.maxStacks + '层', {
          size: 20, color: COMIC.text, bold: true, align: 'left', w: 480, h: 28,
        });
        const descHeight = card.desc.split('\n').length * 24;
        label(content, 28, -cursor - 32 - descHeight / 2, card.desc, {
          size: 18, color: COMIC.sub, align: 'left', w: 480, h: descHeight, lineHeight: 24,
        });
        const hint = cardComboHint(card, stacks, team);
        if (hint) label(content, 28, -cursor - 46 - descHeight, hint, {
          size: 18, color: COMIC.greenShade, align: 'left', w: 480, h: 28,
        });
        cursor += rowHeight(card);
      });
      cursor += 18;
    });
    label(root, 0, -H / 2 + 32, '同类易伤取最高；感电单独生效。', {
      size: 18, color: COMIC.sub, w: 580, h: 30,
    });
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
      const colors = damageStatColors(r.id);
      const host = N('pauseDamageRow:' + r.id, parent, 0, 158 - i * 66);
      const av = gcircle(host, -282, 0, 26, CA('#2A3240', 1));
      const avLbl = label(av, 0, 0, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      if (HERO_DEFS[r.id])
        artSprite(av, 0, 0, 44, 44, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(host, -93, 9, r.name, { size: 18, color: '#FFFFFF', align: 'left', w: 296, h: 26, shrink: true });
      label(host, 250, 9, fmtWk(r.val),
        { size: 20, color: colors.value, font: 'number', align: 'right', w: 130, h: 24, shrink: true });
      label(host, 250, -10, (r.pct * 100).toFixed(2) + '%',
        { size: 11, color: '#BAC5CD', font: 'number', align: 'right', w: 130, h: 12 });
      const bar = gbar(host, 36, -24, 558, 8, colors.bar);
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
    const buildLink = label(root, 250, 298, '本局强化 ›', {
      size: 18, color: '#FFE3A3', w: 140, h: 44,
    });
    buildLink.name = 'pauseBuildOverview';
    bindButton(buildLink, () => this.showBuildOverview());
    this.tabsBar(root, ['奖励总览', '伤害统计', '设置'], tab, t => this.showPause({ ...o, tab: t }));
    if (tab === 0) {
      battleRewardPanel(root, {
        top: 236, heading: '已获得奖励', gold: this.dir.goldEarned, xp: o.xp, loot: o.loot,
        note: this.dir.isEndless ? '已通过' + this.dir.endlessCleared + '层 · 通层金币即时保存' : '金币为本局累计 · 经验仅用于本局升级选卡',
        detailParent: this.modalRoot, source: '本局奖励总览',
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
    pauseButton(root, -175, -270, 300, 86, this.dir.isEndless ? '结束挑战' : '⏻ 退出', o.onExit, 22, 'gold');
    pauseButton(root, 175, -270, 300, 86, '▶ 继续战斗', o.onResume, 22, 'green');
  }

  showEndless(o: { cleared: number; floor: number; best: number; newBest: boolean; gold: number; loot: StageLootSummary; onExit: () => void }): void {
    this.begin('endless');
    dimLayer(this.modalRoot, .68, false, true);
    const W = 660, H = Math.min(740, LO.half * 2 - LO.notchTop * 2 - 48);
    const root = comicDialogContent(this.modalRoot, W, H, '无尽挑战结算', o.onExit);
    detailSkin(root, W, H, '无尽挑战结算');
    label(root, 0, H / 2 - 116, this.dir.levelDef.name, { size: 27, bold: true, color: COMIC.text, w: 560, h: 40 });
    label(root, 0, H / 2 - 202, '通过 ' + o.cleared + ' 层', { size: 49, bold: true, color: COMIC.text, w: 560, h: 72 });
    label(root, 0, H / 2 - 270, (o.newBest ? '新纪录！' : '历史最高') + ' 第' + o.best + '层',
      { size: 25, bold: true, color: COMIC.greenShade, w: 560, h: 40 });
    label(root, 0, H / 2 - 324, '本次抵达第' + o.floor + '层 · 仅完成的层数计入纪录',
      { size: 19, color: COMIC.sub, w: 580, h: 38 });
    const goldReward = N('endlessGoldReceipt', root, 0, -H / 2 + 247, 360, 60);
    comicArt(goldReward, -120, 0, 58, 58, 'comic_coin_v1');
    label(goldReward, 45, 0, '金币 +' + o.gold, { size: 31, bold: true, color: COMIC.text, w: 260, h: 52 });
    bindButton(goldReward, () => showItemDetails(this.modalRoot, 'coin', { amount: o.gold, source: '无尽挑战结算' }),
      { dragThreshold: 7, sound: false });
    const gearCount = o.loot.equipment.length;
    if (gearCount) comicButton(root, 0, -H / 2 + 180, 410, 48, '已获装备 ×' + gearCount + ' · 查看',
      () => showCollectedLoot(this.modalRoot, o.loot), { tone: 'dark', size: 21 });
    label(root, 0, -H / 2 + 134, '收益已到账 · 下次从第1层重新挑战', { size: 18, color: COMIC.sub, w: 580, h: 30 });
    comicButton(root, 0, -H / 2 + 68, 548, 66, '返回地图', o.onExit,
      { name: 'endlessReturn', tone: 'gold', size: 29 });
  }

  /* ---------- ⑥ 胜利结算：评级、奖励与固定操作区 ---------- */
  showWin(o: {
    stars: 1 | 2 | 3; gold: number; diamonds: number; ratio: number; loot?: StageLootSummary;
    firstWinGold?: number;
    onDouble: (done: (ok: boolean) => void) => void;
    onExit: () => void;
  }): void {
    if (this.doubleKey !== o.onDouble) { this.doubleKey = o.onDouble; this.doubleBusy = false; this.doubleClaimed = false; this.winGoldShown = o.gold; }
    const fresh = this.begin('win');
    this.settlementKind = 'win';
    dimLayer(this.modalRoot, .68, false, fresh);
    const root = settlementFrame(this.modalRoot, 'win', this.dir.levelDef.id + '  ' + this.dir.levelDef.name + ' · ' + DIFFICULTIES[this.dir.levelDef.difficulty].name, o.stars, o.ratio, fresh);
    settlementRewards(root, 'win', o.gold * (this.doubleClaimed ? 2 : 1), o.diamonds,
      o.firstWinGold ? '含首胜加奖 ' + o.firstWinGold * (this.doubleClaimed ? 2 : 1) + ' · '
        + (this.doubleClaimed ? '金币已加倍' : '广告可加倍金币')
        : this.doubleClaimed ? '双倍金币已领取 · 钻石保持原数量' : '金币和钻石已到账 · 广告仅加倍金币', o.loot,
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
    goldFloor: number; reviveRatio: number; loot?: StageLootSummary;
    onRevive: (done: (ok: boolean) => void) => void;
    onReturn: () => void;
  }): void {
    if (this.reviveKey !== o.onRevive) { this.reviveKey = o.onRevive; this.reviveBusy = false; this.reviveHint = ''; }
    const fresh = this.begin('lose');
    this.settlementKind = 'lose';
    dimLayer(this.modalRoot, .72, false, fresh);
    const root = settlementFrame(this.modalRoot, 'lose', this.dir.levelDef.id + '  ' + this.dir.levelDef.name + ' · ' + DIFFICULTIES[this.dir.levelDef.difficulty].name, 0, 0, fresh);
    settlementRewards(root, 'lose', o.goldFloor, 0,
      o.loot?.equipment.length ? '金币和装备已保存 · 复活继续本局 / 返回关卡页'
        : '金币已到账 · 复活恢复 ' + Math.round(o.reviveRatio * 100) + '% 耐久 · 返回关卡页', o.loot, { intro: fresh });
    const returnBtn = settlementButton(root, 153, -353, 286, 78, '返回', 'gold', o.onReturn, !this.reviveBusy, 'battleReturn');
    const rv = settlementButton(root, -153, -353, 286, 78,
      this.reviveBusy ? '复活中…' : this.reviveHint || '▶ 看广告复活', 'teal', () => {
      if (this.reviveBusy) return;
      this.reviveBusy = true;
      this.reviveHint = '';
      rv.setBusy(true, '复活中…'); returnBtn.setEnabled(false);
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
      const colors = damageStatColors(r.id);
      const cyAv = py + hh / 2 - 109 - i * 96;
      const cyTx = py + hh / 2 - 98 - i * 96;
      const cxAv = px - w / 2 + 51;
      gcircle(this.modalRoot, cxAv, cyAv, 35, CA('#2A3240', 1));
      const avLbl = label(this.modalRoot, cxAv, cyAv, r.name.slice(0, 1), { size: 26, color: PAL.gold, bold: true });
      // 74 > 70 座圆：头像盖满整个圆去黑环（用户反馈）
      if (HERO_DEFS[r.id])
        artSprite(this.modalRoot, cxAv, cyAv, 74, 74, 'ui_avatar_' + r.id, { sliced: false, hideOnLoad: [avLbl] });
      label(this.modalRoot, px - w / 2 + 180, cyTx, r.name,
        { size: 18, color: '#FFFFFF', align: 'left', w: 126, h: 30, shrink: true });
      label(this.modalRoot, px + w / 2 - 66, cyTx + 2, fmtWk(r.val),
        { size: 20, color: colors.value, font: 'number', align: 'right', w: 100, h: 26, shrink: true });
      label(this.modalRoot, px + w / 2 - 66, cyTx - 17, (r.pct * 100).toFixed(2) + '%',
        { size: 11, color: '#BAC5CD', font: 'number', align: 'right', w: 100, h: 14 });
      const barX = px - w / 2 + 229.5, barY = py + hh / 2 - 135 - i * 96;
      const bar = gbar(this.modalRoot, barX, barY, 225, 10, colors.bar);
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
    const shockTxt = voltShockAmp(h) > 0 ? '感电+' + Math.round(voltShockAmp(h) * 100) + '% · ' + voltShockDuration(h) + 's' : '';
    const iconY = WYB(126, 46);
    let px: number, py: number, w = 300, hh = 272, title: string;
    let rows: [string, string][];
    if (hero.id === 'wind' || hero.id === 'ninja') {
      const wind = hero.id === 'wind', def = HERO_DEFS[hero.id];
      w = 320;
      if (kind === 'atk') {
        title = wind ? '普攻 · 贯穿风刃' : '普攻 · 影刃投掷';
        rows = [
          ['伤害', String(Math.round(hero.effAtk * h.normalMul))],
          ['攻速', h.aspd.toFixed(2) + ' 次/秒'],
          ['索敌范围', String(Math.round(h.range))],
          ['弹速', String(wind ? WIND.bladeSpeed : NINJA.speed)],
          ['暴击', Math.round(h.critRate * 100) + '% / ' + Math.round(h.critMul * 100) + '%'],
          wind ? ['贯穿', '额外' + (WIND.bladePierce + h.pierce) + '目标 · 后续×' + WIND.bladeFalloff]
            : ['飞刃', '留场待回收 · 上限' + NINJA.markCap + '枚'],
        ];
        px = hero.x - 27 + 23 + 16 + w / 2;
        py = iconY + 23 + 16 + hh / 2;
      } else if (kind === 'skill') {
        const ws = windSkillCfg(h.skillLv), ns = ninjaSkillCfg(h.skillLv);
        title = '技能 · ' + def.skillName;
        rows = wind ? [
          ['每次切割', String(Math.round(hero.abilityDamage(ws.mul)))],
          ['持续时间', ws.duration + '秒 · 每' + WIND.eyeTick + '秒伤害'],
          ['风眼范围', '半径' + Math.round(ws.radius * h.skillRangeMul)],
          ['牵引速度', ws.pull + ' /秒'],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['冷却', cdTotal + ' · 自动'],
        ] : [
          ['每刃回收伤害', String(Math.round(hero.abilityDamage(ns.mul)))],
          ['回收速度', String(Math.round(ns.speed))],
          ['额外穿透', ns.pierce + ' 个目标'],
          ['飞刃上限', NINJA.markCap + '枚'],
          ['冷却', cdTotal],
          ['释放', '自动 · 需场上飞刃'],
        ];
        px = hero.x + 27 + 23 + 16 + w / 2;
        py = iconY + 23 + 16 + hh / 2;
      } else {
        const wu = windUltCfg(h.ultLv), nu = ninjaUltCfg(h.ultLv);
        title = '大招 · ' + def.ultName;
        rows = wind ? [
          ['每段伤害', String(Math.round(hero.abilityDamage(wu.mul, true)))],
          ['持续时间', wu.duration + '秒 · 每' + WIND.tornadoTick + '秒伤害'],
          ['龙卷范围', '半径' + Math.round(wu.radius * h.skillRangeMul)],
          ['移速 / 牵引', WIND.tornadoSpeed + ' / ' + WIND.tornadoPull],
          ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
          ['释放', hero.ultReady ? '手动 · 已就绪' : '未充满·不可释放'],
        ] : [
          ['每段伤害', String(Math.round(hero.abilityDamage(nu.mul, true)))],
          ['持续时间', nu.duration + '秒 · 每' + NINJA.ultTick + '秒伤害'],
          ['旋刃范围', '半径' + Math.round(nu.radius * h.skillRangeMul)],
          ['伤害类型', '物理伤害'],
          ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
          ['释放', hero.ultReady ? '手动 · 已就绪' : '未充满·不可释放'],
        ];
        px = WX(636, 90) - 45 - 16 - w / 2;
        py = WYB(240 + ultIdx * 110, 90);
      }
    } else if (hero.id === 'cannon' || hero.id === 'siphon') {
      const cannon = hero.id === 'cannon';
      w = 320;
      if (kind === 'atk') {
        title = cannon ? '普攻 · 爆裂炮弹' : '普攻 · 生命虹吸';
        rows = cannon ? [
          ['伤害', Math.round(hero.effAtk * h.normalMul) + (h.cannonCenter ? ' · 爆心+30%' : ' · 中心全额')],
          ['攻速', h.aspd.toFixed(2) + ' 次/秒'],
          ['爆破', '半径90 · 周围伤害70%'],
          ['弹道强化', [h.cannonPierce?'穿透+'+h.cannonPierce:'',h.cannonFragments?'破片3枚':''].filter(Boolean).join(' · ') || '无'],
          ['追加攻击', [h.cannonEcho?'二段40%':'',h.cannonLoader?'4轮追加炮弹':'',h.cannonHeavy?'3轮减速重弹':''].filter(Boolean).join(' · ') || '无'],
          ['索敌范围', String(Math.round(h.range))],
        ] : [
          ['伤害/秒', String(Math.round(hero.effAtk * h.aspd * h.normalMul))],
          ['结算', '每0.25秒 · 持续追踪至阵亡'],
          ['虹吸增伤', '每秒+10% · 最高+50%'],
          ['索敌范围', String(Math.round(h.range))],
          ['副光束', [h.siphonTwin?'副束1道·50%':'',h.siphonRelay?'接力1道·25%':''].filter(Boolean).join(' · ') || '未获得'],
          ['持续强化', [h.siphonShred?'削弱法抗15%':'',h.siphonSlow?'减速'+Math.round(h.siphonSlow*100)+'%':'',h.siphonHeavyGrip?'4秒后强吸重击':''].filter(Boolean).join(' · ') || '未获得'],
        ];
        px = hero.x - 27 + 23 + 16 + w / 2;
        py = iconY + 23 + 16 + hh / 2;
      } else if (kind === 'skill') {
        const cs = cannonSkillCfg(h.skillLv), vs = siphonSkillCfg(h.skillLv);
        title = cannon ? '技能 · 破城重炮' : '技能 · 灵魂分流';
        rows = cannon ? [
          ['中心伤害', String(Math.round(hero.abilityDamage(cs.mul)))],
          ['爆炸范围', '半径' + Math.round(CANNON.skillBlast * cs.radiusMul * h.skillRangeMul)],
          ['破甲', '物抗降低15个百分点 · ' + cs.shredSeconds + '秒'],
          ['追加效果', [h.cannonCluster?'榴弹3枚':'',h.cannonWave?'震波50%':'',h.cannonCharges?'诱爆80%':''].filter(Boolean).join(' · ') || '无'],
          ['控制', [h.cannonKnockback?'击退':'',h.cannonInterrupt?'打断·普通眩晕0.5秒':''].filter(Boolean).join(' · ') || '无'],
          ['冷却', cdTotal+(h.cannonRefund?' · 命中7敌返还25%':'')],
        ] : [
          ['每束伤害/秒', String(Math.round(hero.abilityDamage(vs.mul)))],
          ['分流目标', '+' + (vs.branches + (h.siphonBranches || 0) + (h.siphonSkillTargets || 0)) + ' 个敌人'],
          ['持续时间', vs.duration + ' 秒'+(h.siphonExtendOnKill?' · 击杀最多延长2秒':'')],
          ['目标', h.siphonHealCut?'受到治疗降低'+Math.round(h.siphonHealCut*100)+'%':'主目标附近 · 分流独立锁定'],
          ['冷却', cdTotal], ['释放', '自动'],
        ];
        px = hero.x + 27 + 23 + 16 + w / 2;
        py = iconY + 23 + 16 + hh / 2;
      } else {
        const cu = cannonUltCfg(h.ultLv), vu = siphonLaserCfg(h.ultLv,h.siphonUltDuration || 0,h.siphonUltTicks || 0);
        title = cannon ? '大招 · 导弹轰炸' : '大招 · 生命洪流';
        rows = cannon ? [
          ['每弹中心伤害', String(Math.round(hero.abilityDamage(cu.mul, true)*(1+(h.cannonUltCenter || 0))))],
          ['轰炸导弹', (cu.shots + (h.cannonUltShots || 0)) + ' 发 · 错峰落下'],
          ['爆炸范围', '半径' + Math.round(cu.radius * h.skillRangeMul*(1+(h.cannonUltRadius || 0)))],
          ['附加效果', h.cannonUltStun?'眩晕2秒 · 首领免疫':'无'],
          ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
          ['释放', hero.ultReady ? '手动 · 已就绪' : '未充满·不可释放'],
        ] : [
          ['沿线伤害/秒', String(Math.round(hero.abilityDamage(vu.mul, true)*SIPHON_LASER.tick/vu.interval))],
          ['激光宽度', String(Math.round((vu.halfWidth + (h.siphonBranches || 0) * 6) * 2 * h.skillRangeMul))],
          ['持续时间', vu.duration + ' 秒 · '+vu.ticks+'次伤害'],
          ['穿透', h.siphonFork?'主束+2道分叉 · 分叉伤害35%':'沿线全部敌人 · 伤害不衰减'],
          ['充能', Math.floor(hero.charge) + ' / ' + goalTxt], ['释放', '手动 · 聚能' + SIPHON_LASER.windup + '秒'],
        ];
        px = WX(636, 90) - 45 - 16 - w / 2;
        py = WYB(240 + ultIdx * 110, 90);
      }
    } else if (kind === 'atk') {
      const atkTitle: Record<string, string> = { archer: '普攻 · 风刃射击', sniper: '普攻 · 重弩狙击', pyro: '普攻 · 烈焰火球', volt: '普攻 · 雷电球', mora: '普攻 · 冰棱' };
      title = atkTitle[hero.id] || '普攻';
      rows = [
        ['伤害', String(Math.round(hero.effAtk * (h.normalMul || 1)))],
        ['攻速', h.aspd.toFixed(1) + ' 次/秒'],
        ['索敌范围', String(Math.round(h.range))],
        hero.id === 'pyro' ? ['爆炸半径', String(Math.round(pyroBlastRadius(h, Math.max(60, h.explodeR))))]
          : hero.id === 'mora' ? ['减速', Math.round(moraSlowRatio(h, h.slowOnHit || 0) * 100) + '% · ' + moraSlowDuration(h, h.slowDur || 2) + 's']
          : ['弹道', (h.fan + h.serial > 0 ? (1 + h.fan) + '×' + (1 + h.serial) + ' 弹幕' : '1 支')],
        ['暴击', Math.round(h.critRate * 100) + '% / ' + Math.round(h.critMul * 100) + '%'],
        hero.id === 'pyro' ? ['灼烧', h.burnOnHit ? `${Math.round(hero.effAtk * h.burnOnHit * pyroBurnMultiplier(h))}/秒 · ${pyroBurnDuration(h)}秒` : '未获得普攻灼烧']
          : hero.id === 'volt' ? ['感电', (shockTxt || '未获得') + (voltShockedMultiplier(h, true) > 1 ? ' · 对感电伤害+' + Math.round((voltShockedMultiplier(h, true) - 1) * 100) + '%' : '')]
          : hero.id === 'mora' ? ['命中特性', (moraFreezeChance(h) ? Math.round(moraFreezeChance(h) * 100) + '%冰冻' + moraNormalFreezeDuration(h) + 's' : '最靠下目标') + (h.moraColdBonus ? ' · 碎冰+' + Math.round(h.moraColdBonus * 100) + '%' : '')]
          : ['目标', '最靠下'],
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
          ['效果', '锁定最密集敌群 · 连续发射 ' + Math.round(h.skillShots || 3) + ' 颗爆裂火球'],
          ['每发伤害', Math.round(hero.abilityDamage(pc.mul)) + '（技×' + pc.mul.toFixed(2) + '）'],
          ['特性', `爆炸半径 ${Math.round(pyroBlastRadius(h, 110 * (h.skillRangeMul || 1)))} · 灼烧${pyroBurnDuration(h)}秒`],
          ['冷却时间', cdTotal],
          ['索敌范围', String(Math.round(h.skillRange))],
          ['释放', '自动'],
        ];
      } else if (hero.id === 'mora') {
        title = '技能 · 冰霜领域';
        const mc = moraSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '密集区冰封 ' + moraFieldFreeze(h).toFixed(1) + 's · Boss免疫'],
          ['范围伤害', Math.round(hero.abilityDamage(mc.mul)) + '（技×' + mc.mul.toFixed(2) + '）'],
          ['特性', '解冻后减速 ' + Math.round(moraSlowRatio(h, .5) * 100) + '% · ' + moraSlowDuration(h, 2) + 's'],
          ['冷却时间', cdTotal],
          ['领域半径', String(Math.round(moraFieldRadius(h)))],
          ['释放', '自动' + (h.moraColdBonus ? ' · 对减速/冰封+' + Math.round(h.moraColdBonus * 100) + '%' : ' · 小怪/精英可冰封')],
        ];
      } else {
        title = '技能 · 连锁闪电';
        const vc = voltSkCfg(h.skillLv || 1);
        rows = [
          ['效果', '连锁 ' + Math.round(h.skillShots || 5) + ' 目标 · 跳距 ' + Math.round(260 * (h.skillRangeMul || 1))],
          ['每跳伤害', Math.round(hero.abilityDamage(vc.mul)) + '（技×' + vc.mul.toFixed(2) + '）'],
          ['特性', (shockTxt || '同次不重复命中') + (h.voltShockBonus ? ' · 对感电+' + Math.round(h.voltShockBonus * 100) + '%' : '') + (vc.chainInc ? ' · 每跳+' + Math.round(vc.chainInc * 100) + '%' : '')],
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
        ['伤害', Math.round(pyroMeteorDamage(h)) + ' × 每颗'],
        ['索敌', '不同怪群 · 爆炸半径 ' + Math.round(pyroBlastRadius(h, 140))],
        ['形态', '分散轰炸 ' + pyroMeteorCount(h) + ' 颗陨石'],
        ['陨石坑', '燃烧 ' + pyroCraterDuration(h) + ' 秒：灼烧 + 易伤 ' + Math.round((h.pitVuln || 0.25) * 100) + '%' + (pu.craterMul > 1 ? ' · 坑范围+' + Math.round((pu.craterMul - 1) * 100) + '%' : '')],
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
        ['每段伤害', moraUltimateHitDamage(h).toFixed(1) + ' × ' + MORA_ULT_HITS + '段 · 全场'],
        ['形态', FROST_ULT_RAIN_COUNT + '颗冰晶雨 · 持续随机落下'],
        ['特性', (h.moraUltFreeze ? '冰封' + h.moraUltFreeze + 's→' : '') + '减速 ' + Math.round(moraSlowRatio(h, mu.slowMul) * 100)
          + '% · ' + moraSlowDuration(h, mu.slowDur + (h.ultSlowDur || 0)) + 's'],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', '手动点击' + (h.moraColdBonus ? ' · 碎冰+' + Math.round(h.moraColdBonus * 100) + '%' : '')],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    } else {
      title = '大招 · 天雷灭世';
      w = 280; hh = 272;
      const vu = voltUltCfg(h.ultLv || 1);
      rows = [
        ['伤害', Math.round(hero.abilityDamage(vu.boltMul, true)) + ' × 每道'],
        ['形态', voltStrikeCount(h) + ' 道天雷 · 半径 ' + Math.round(90 * vu.rMul)],
        ['特性', '眩晕 ' + (h.ultStun || 1).toFixed(1) + 's' + (voltShockAmp(h, true) ? ' · 感电+' + Math.round(voltShockAmp(h, true) * 100) + '% ' + voltShockDuration(h) + 's' : '') + (h.voltShockBonus ? ' · 对感电+' + Math.round(h.voltShockBonus * 100) + '%' : '')],
        ['充能', Math.floor(hero.charge) + ' / ' + goalTxt],
        ['状态', hero.ultReady ? '就绪' : '未充满·不可释放'],
        ['释放', h.voltField ? '手动 · 雷电领域' + VOLT_FIELD.duration + '秒' : '手动点击'],
      ];
      px = WX(636, 90) - 45 - 16 - w / 2;
      py = WYB(240 + ultIdx * 110, 90);
    }
    // Keep the existing six-row geometry while exposing the battle's new rules.
    if (kind === 'atk') {
      if (hero.id !== 'siphon') rows[0][0] = ['archer', 'sniper', 'cannon', 'ninja'].includes(hero.id) ? '物理伤害' : '法术伤害';
      if ((hero.id === 'archer' || hero.id === 'sniper') && h.pierce) rows[5] = ['贯穿', '额外命中 ' + h.pierce + ' 个目标'];
      if (hero.id === 'pyro' && h.pyroBurnBurst) rows[5] = ['余烬爆破', '点燃后阵亡爆炸 · 半径100'];
      if (hero.id === 'mora' && h.moraTeamVuln) rows[5] = ['冰裂印记', '全队易伤+15% · 3秒'];
    } else if (kind === 'ult') {
      const charge = rows.find(row => row[0] === '充能');
      if (charge) charge[1] = Math.floor(hero.charge) + ' / ' + goalTxt + ' · ' + Math.floor(hero.charge / hero.chargeGoal * 100) + '%';
    }
    // 面板整体收敛进可视区
    px = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, px));
    py = Math.max(-LO.half + hh / 2 + 8, Math.min(LO.half - hh / 2 - 8, py));

    // 底板 0.78（用户调整：Tips 再增加一点透明度，战斗画面更可见）；点空白关闭不受影响
    const tipsPanel = gpanel(this.modalRoot, px, py, w, hh, CA('#14181E', 0.78), undefined, 0, 12);
    if (hero.targetLayer(kind) === 'ground') title += ' · ' + targetLabel('ground');
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
