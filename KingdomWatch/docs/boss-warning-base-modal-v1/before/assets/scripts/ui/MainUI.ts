/**
 * 主城母界面（§UX 五主界面）：底部导航 商店/英雄/关卡/升级/基地（左→右）
 * 统一顶栏、资源芯片和底部导航；五页使用相同内容边距与安全区。
 * 页签内容整屏重建（PageKit.ctx.refresh）；各页实现见 ui/pages/*（线稿一一对应）。
 */
import { _decorator, Component, Graphics, Label, Node, Sprite, UITransform, view } from 'cc';
import { initLayout, LO, PAL } from '../config/GameConfig';
import { flow } from '../core/Flow';
import { GameAudio } from '../core/GameAudio';
import { bindButton } from './ButtonFeedback';
import { dismissUI, refreshUI } from './UIMotion';
import { C, CA, gpanel, N, WX, WYB } from './UIKit';
import { artSprite } from './Ux';
import { mainLabel, MAIN_NAV_H, PageCtx, setGlobalRoot } from './PageKit';
import { COMIC, comicArt, comicButton, comicDialog, comicMark } from './ComicUI';
import { ResourceBar, ResourceCurrency } from './ResourceBar';
import { buildShop } from './pages/ShopPage';
import { buildHeroes } from './pages/HeroPage';
import { buildLevels } from './pages/LevelsPage';
import { buildUpgrade } from './pages/UpgradePage';
import { buildBase } from './pages/BasePage';

const { ccclass } = _decorator;

/** 底部页签定义（左→右） */
const TABS: { name: string; icon: string; art: string }[] = [
  { name: '商店', icon: '🛒', art: 'comic_nav_shop_v1' },
  { name: '英雄', icon: '🦸', art: 'comic_helm_falcon_v1' },
  { name: '关卡', icon: '⚔️', art: 'comic_nav_map_v1' },
  { name: '升级', icon: '⬆️', art: 'upgrade_comic_v1/comic_training_hammer_v1' },
  { name: '基地', icon: '🏰', art: 'comic_nav_castle_v1' },
];

@ccclass('MainUI')
export class MainUI extends Component {
  private screens!: Node;
  private navItems: { slot: Node; icon: Node; art: Node | null; txt: Node; idle: Node; act: Node }[] = [];
  private resourceBar: ResourceBar | null = null;
  private resourceDialog: Node | null = null;
  private navBar: Node | null = null;
  private tab = flow.mainTab;

  start(): void {
    GameAudio.enter('camp');
    // 视口变化（手机地址栏收起/展开、旋转等）：LO.half 只在启动时算过一次，画布被
    // Cocos 自动重适配后旧值全部失锚 → 重算 initLayout 并整屏重建，布局始终贴合当前可视区
    view.on('canvas-resize', this.queueRelayout, this);
    view.on('design-resolution-changed', this.queueRelayout, this);
    this.rebuildAll();
  }

  onDestroy(): void {
    view.off('canvas-resize', this.queueRelayout, this);
    view.off('design-resolution-changed', this.queueRelayout, this);
  }

  /** 连续 resize 防抖：0.2s 内只重建一次 */
  private queueRelayout = (): void => {
    this.unschedule(this.doRelayout);
    this.scheduleOnce(this.doRelayout, 0.2);
  };

  private doRelayout(): void {
    initLayout();
    this.rebuildAll();
  }

  /** 整体重建：背景/顶栏/导航/当前页全部按最新可视区重摆 */
  private rebuildAll(): void {
    const root = this.node;
    root.destroyAllChildren();
    this.navItems = [];
    this.resourceBar = null;
    this.resourceDialog = null;

    this.buildTopBar(root);
    this.buildNavBar(root);

    this.screens = N('Screens', root, 0, 0, 750, LO.half * 2);
    // Backgrounds now belong to their page; the shared chrome stays above both page layers.
    this.screens.setSiblingIndex(0);
    setGlobalRoot(root);
    this.tab = flow.mainTab;
    this.switchTab(this.tab);
    // 资源栏恒在页面内容上层。
    ['resBar'].forEach(nm => { const n = root.getChildByName(nm); if (n) n.setSiblingIndex(root.children.length - 1); });
  }

  /* ---------- 五页共用资源栏；页内标题由场景布局负责 ---------- */
  private buildTopBar(root: Node): void {
    const bar = N('resBar', root);
    this.resourceBar = new ResourceBar(bar, currency => this.openResourceSources(currency));
  }

  /** 货币刷新（购买/升级后同步） */
  private updateWallet(): void {
    this.resourceBar?.refresh();
  }

  /** The plus buttons lead to existing resource sources, without introducing a purchase system. */
  private openResourceSources(currency: ResourceCurrency): void {
    if (this.resourceDialog?.isValid) return;
    const gold = currency === 'gold';
    const panel = comicDialog(this.node, 540, 340, gold ? '获取金币' : '获取钻石');
    this.resourceDialog = panel.parent;
    comicArt(panel, -186, 25, 60, 60, gold ? 'comic_coin_v1' : 'comic_diamond_v1');
    mainLabel(panel, 32, 30, gold ? '通关战斗 · 领取星级宝箱' : '星级宝箱 · 怪物图鉴奖励',
      { size: 23, font: 'body', color: COMIC.text, w: 328, h: 36 });
    mainLabel(panel, 0, -30, gold ? '闲置装备也可以在英雄页出售换取金币' : '首次查看已解锁的怪物图鉴可领取钻石',
      { size: 18, font: 'body', color: COMIC.sub, w: 474, h: 40 });
    comicButton(panel, 0, -111, 330, 64, gold ? '前往关卡' : '前往基地', () => {
      const dim = panel.parent;
      this.resourceDialog = null;
      dismissUI(dim, () => this.switchTab(gold ? 2 : 4));
    }, { tone: 'green', size: 23 });
  }

  /* ---------- 底部导航（5 页签；用户确认：导航栏不要边框——平板底 + 高亮板，无页签框美术） ---------- */
  private buildNavBar(root: Node): void {
    this.navBar = gpanel(root, 0, WYB(0, MAIN_NAV_H), 750, MAIN_NAV_H, CA('#101D17', 0.98), undefined, 0, 0);
    const w = 138;
    const x0 = (750 - TABS.length * w) / 2;
    TABS.forEach((t, i) => {
      const cx = WX(x0 + i * w + w / 2, 0);
      const slot = N('tab' + i, root, cx, WYB(12, 104), w, 104);
      const idle = gpanel(slot, 0, 0, 126, 104, CA('#FFFFFF', 0), undefined, 0, 18);
      const act = gpanel(slot, 0, 0, 126, 104, CA('#E8BA60', 0.16), undefined, 0, 18);
      gpanel(act, 0, -48, 32, 3, '#E8BA60', undefined, 0, 1);
      act.active = false;
      const icon = N('navigationGlyph', slot, 0, 17, 60, 60);
      const art = t.art ? comicArt(slot, 0, 17, 64, 64, t.art) : null;
      if (!t.art) comicMark(icon, 0, 0, 'upgrade', 52);
      const txt = mainLabel(slot, 0, -27, t.name, { size: 24, font: 'body', color: COMIC.cream, bold: true });
      bindButton(slot, () => { if (this.tab !== i) this.switchTab(i); }, { scale: .975, radius: 12, sound: 'select' });
      this.navItems.push({ slot, icon, art, txt, idle, act });
    });
  }

  /** 页签高亮：激活金板金字 / 未激活暗板白字（无边框规范：纯色板，无页签框美术） */
  private highlightTabs(): void {
    if (this.navBar) {
      const bg = this.navBar.getComponent(Graphics)!;
      bg.clear();
      bg.fillColor = C(COMIC.dark);
      bg.rect(-375, -MAIN_NAV_H / 2, 750, MAIN_NAV_H); bg.fill();
      bg.fillColor = C(COMIC.darkLight);
      bg.rect(-375, MAIN_NAV_H / 2 - 3, 750, 3); bg.fill();
    }
    this.navItems.forEach((it, k) => {
      const active = k === this.tab;
      it.idle.active = !active;
      it.act.active = active;
      const iconLbl = it.icon.getComponent(Label);
      const txtLbl = it.txt.getComponent(Label);
      const ag = it.act.getComponent(Graphics)!;
      ag.clear();
      ag.fillColor = C(COMIC.gold);
      ag.roundRect(-63, -50, 126, 104, 12); ag.fill();
      ag.fillColor = C(COMIC.goldLight);
      ag.roundRect(-50, 47, 100, 3, 1); ag.fill();
      const mark = it.act.children[0];
      if (mark) mark.active = false;
      if (txtLbl) {
        txtLbl.color = C(active ? COMIC.text : COMIC.cream);
        txtLbl.fontSize = 24;
      }
      if (iconLbl) iconLbl.color = C(active ? '#FFE08A' : '#FFFFFF');
      const artSp = it.art ? it.art.getComponent(Sprite) : null;
      if (artSp) artSp.color = C(active ? '#FFFFFF' : '#D5DCE0');
    });
  }

  /* ---------- 页签切换：内容整屏重建 ---------- */
  switchTab(i: number): void {
    const previous = this.tab;
    this.tab = i;
    flow.mainTab = i;
    this.highlightTabs();
    this.rebuildScreen(i === previous ? 0 : i > previous ? 1 : -1);
  }

  /** 页签专属背景（商店内景 / 基地庭院；无专属的页签沿用主城场景占位图） */
  private static BG_BY_TAB: Record<number, string> = { 0: 'scenes/bg_shop_comic_v1', 2: 'scenes/bg_level', 3: 'scenes/bg_upgrade', 4: 'scenes/bg_base_lobby_v1' };

  private bgForTab(i: number): string {
    return MainUI.BG_BY_TAB[i] || 'scenes/scene_1_1';
  }

  /** Background and content are retained/replaced together, with no exposed paper interval. */
  private applyPageBg(i: number): void {
    const id = i === 1 ? 'heroPaperBackdrop' : i === 2 ? 'levelPaperBackdrop' : i === 3 ? 'trainingPaperBackdrop' : i === 4 ? 'basePaperBackdrop' : this.bgForTab(i);
    const parent = this.screens;
    let bg: Node;
    if (i === 1 || i === 2 || i === 3 || i === 4) {
      bg = gpanel(parent, 0, 0, 750, LO.half * 2 + 240, COMIC.paper, undefined, 0, 0);
      bg.name = i === 1 ? 'heroPageBackdrop' : i === 2 ? 'levelPageBackdrop' : i === 3 ? 'trainingPageBackdrop' : 'basePageBackdrop';
    } else bg = artSprite(parent, 0, 0, 750, LO.half * 2 + 240, id, { sliced: false, cover: true });
    const holder = bg.parent && bg.parent !== parent ? bg.parent : bg;
    holder.setSiblingIndex(0);
  }

  /** 页面刷新入口（购买/升级/穿戴后）：整屏重建 + 货币同步 */
  private rebuildScreen(direction = 0): void {
    refreshUI(this.screens, () => {
      this.applyPageBg(this.tab);
      const ctx: PageCtx = { screens: this.screens, refresh: () => this.switchTab(this.tab) };
      switch (this.tab) {
        case 0: buildShop(ctx); break;
        case 1: buildHeroes(ctx); break;
        case 2: buildLevels(ctx); break;
        case 3: buildUpgrade(ctx); break;
        case 4: buildBase(ctx); break;
      }
      this.updateWallet();
    }, direction);
  }
}
