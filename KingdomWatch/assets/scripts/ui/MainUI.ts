/**
 * 主城母界面（§UX 五主界面）：底部导航 商店/英雄/关卡/升级/基地（左→右）
 * 统一顶栏、资源芯片和底部导航；五页使用相同内容边距与安全区。
 * 页签内容整屏重建（PageKit.ctx.refresh）；各页实现见 ui/pages/*（线稿一一对应）。
 */
import { _decorator, Component, Graphics, Label, Node, Sprite, UITransform, view } from 'cc';
import { initLayout, LO, PAL } from '../config/GameConfig';
import { flow } from '../core/Flow';
import { btn, C, CA, gpanel, N, setText, WX, WY, WYB } from './UIKit';
import { artSprite } from './Ux';
import { mainLabel, MAIN_NAV_H, MAIN_W, MAIN_RESOURCE_H, mainLayout, modal, PageCtx, setGlobalRoot } from './PageKit';
import { ResourceBar, ResourceCurrency } from './ResourceBar';
import { buildShop } from './pages/ShopPage';
import { buildHeroes } from './pages/HeroPage';
import { buildLevels } from './pages/LevelsPage';
import { buildUpgrade } from './pages/UpgradePage';
import { buildBase } from './pages/BasePage';

const { ccclass } = _decorator;

/** 底部页签定义（左→右） */
const TABS: { name: string; icon: string; art: string }[] = [
  { name: '商店', icon: '🛒', art: 'ui_nav_shop' },
  { name: '英雄', icon: '🦸', art: 'ui_nav_heroes' },
  { name: '关卡', icon: '⚔️', art: 'ui_nav_levels' },
  { name: '升级', icon: '⬆️', art: 'ui_nav_upgrade' },
  { name: '基地', icon: '🏰', art: 'ui_nav_base' },
];

const PAGE_NOTES = ['为英雄挑选下一场战斗的补给', '整理装备，打造你的主力英雄', '选择战场，带领编队守住防线', '培养英雄，解锁更强的战斗能力', '建设主城，记录远征中的发现'];

@ccclass('MainUI')
export class MainUI extends Component {
  private screens!: Node;
  private navItems: { slot: Node; icon: Node; art: Node | null; txt: Node; idle: Node; act: Node }[] = [];
  private resourceBar: ResourceBar | null = null;
  private resourceDialog: Node | null = null;
  private pageTitle: Node | null = null;
  private pageNote: Node | null = null;
  private standardHeader: Node | null = null;
  private navBar: Node | null = null;
  private tab = flow.mainTab;

  start(): void {
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

    // 背景：页签专属底图，不再整体置暗（用户确认）——前景可读性由各页面自身面板保证
    this.bgNode = null; this.bgId = '';
    this.applyPageBg(flow.mainTab);

    this.buildTopBar(root);
    this.buildNavBar(root);

    this.screens = N('Screens', root, 0, 0, 750, LO.half * 2);
    setGlobalRoot(root);
    this.tab = flow.mainTab;
    this.switchTab(this.tab);
    // 资源栏恒在页面内容上层。
    ['resBar'].forEach(nm => { const n = root.getChildByName(nm); if (n) n.setSiblingIndex(root.children.length - 1); });
  }

  /* ---------- 统一页名与资源栏 ---------- */
  private buildTopBar(root: Node): void {
    const { headerTop } = mainLayout();
    const bar = N('resBar', root);
    this.resourceBar = new ResourceBar(bar, currency => this.openResourceSources(currency));
    const plate = gpanel(bar, 0, WY(headerTop + MAIN_RESOURCE_H + 18, 64), MAIN_W, 64, CA('#15221F', 0.94), undefined, 0, 18);
    this.standardHeader = plate;
    this.pageTitle = mainLabel(plate, -4, 12, '', { size: 28, color: '#FFF0CD', font: 'title', align: 'left', w: 638, h: 36 });
    this.pageNote = mainLabel(plate, -4, -18, '', { size: 16, color: '#AEBDA9', align: 'left', w: 638, h: 24 });
  }

  /** 货币刷新（购买/升级后同步） */
  private updateWallet(): void {
    this.resourceBar?.refresh();
  }

  /** The plus buttons lead to existing resource sources, without introducing a purchase system. */
  private openResourceSources(currency: ResourceCurrency): void {
    if (this.resourceDialog?.isValid) return;
    const gold = currency === 'gold';
    const ctx: PageCtx = { screens: this.screens, refresh: () => this.switchTab(this.tab) };
    const panel = modal(ctx, 540, 340, gold ? '获取金币' : '获取钻石', true);
    this.resourceDialog = panel.parent;
    artSprite(panel, -186, 25, 60, 60, gold ? 'ui_icon_coin' : 'ui_icon_diamond', { sliced: false });
    mainLabel(panel, 32, 30, gold ? '通关战斗 · 领取星级宝箱' : '星级宝箱 · 怪物图鉴奖励',
      { size: 23, color: '#FFF0CD', w: 328, h: 36 });
    mainLabel(panel, 0, -30, gold ? '闲置装备也可以在英雄页出售换取金币' : '首次查看已解锁的怪物图鉴可领取钻石',
      { size: 18, color: '#C2CEB7', w: 474, h: 40 });
    btn(panel, 0, -111, 330, 64, gold ? '前往关卡' : '前往基地', '#69C238', () => {
      const dim = panel.parent;
      this.resourceDialog = null;
      dim?.destroy();
      this.switchTab(gold ? 2 : 4);
    }, 23, true);
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
      const icon = mainLabel(slot, 0, 17, t.icon, { size: 30 });
      const art = artSprite(slot, 0, 17, 54, 54, t.art, { hideOnLoad: [icon] });
      const txt = mainLabel(slot, 0, -27, t.name, { size: 20, color: '#FFFFFF', bold: true });
      slot.on(Node.EventType.TOUCH_END, () => this.switchTab(i));
      this.navItems.push({ slot, icon, art, txt, idle, act });
    });
  }

  /** 页签高亮：激活金板金字 / 未激活暗板白字（无边框规范：纯色板，无页签框美术） */
  private highlightTabs(): void {
    const shopStyle = this.tab <= 2;
    if (this.navBar) {
      const bg = this.navBar.getComponent(Graphics)!;
      bg.clear();
      bg.fillColor = C(shopStyle ? '#3C291C' : '#101D17');
      bg.rect(-375, -MAIN_NAV_H / 2, 750, MAIN_NAV_H); bg.fill();
      if (shopStyle) {
        bg.fillColor = C('#B8803D');
        bg.rect(-375, MAIN_NAV_H / 2 - 3, 750, 3); bg.fill();
      }
    }
    this.navItems.forEach((it, k) => {
      const active = k === this.tab;
      it.idle.active = !active;
      it.act.active = active;
      const iconLbl = it.icon.getComponent(Label);
      const txtLbl = it.txt.getComponent(Label);
      const ag = it.act.getComponent(Graphics)!;
      ag.clear();
      ag.fillColor = shopStyle ? C('#FFC54C') : CA('#E8BA60', 0.16);
      ag.roundRect(-63, -52, 126, 104, 18); ag.fill();
      const mark = it.act.children[0];
      if (mark) mark.active = !shopStyle;
      if (txtLbl) {
        txtLbl.color = C(shopStyle ? active ? '#442B12' : '#EAD6B6' : active ? PAL.gold : '#FFFFFF');
        txtLbl.fontSize = shopStyle ? 24 : 20;
      }
      if (iconLbl) iconLbl.color = C(active ? '#FFE08A' : '#FFFFFF');
      const artSp = it.art ? it.art.getComponent(Sprite) : null;
      if (artSp) artSp.color = C(active ? '#FFFFFF' : '#AEB6C2');
      if (it.art) it.art.getComponent(UITransform)!.setContentSize(shopStyle ? 62 : 54, shopStyle ? 62 : 54);
    });
  }

  /* ---------- 页签切换：内容整屏重建 ---------- */
  switchTab(i: number): void {
    this.tab = i;
    flow.mainTab = i;
    if (this.standardHeader) this.standardHeader.active = i > 2;
    if (this.pageNote) this.pageNote.active = i > 2;
    if (this.pageTitle) setText(this.pageTitle, TABS[i].name);
    if (this.pageNote) setText(this.pageNote, PAGE_NOTES[i]);
    this.highlightTabs();
    this.applyPageBg(i);
    this.rebuildScreen();
  }

  /** 页签专属背景（商店内景 / 基地庭院；无专属的页签沿用主城场景占位图） */
  private static BG_BY_TAB: Record<number, string> = { 0: 'scenes/bg_shop', 1: 'scenes/bg_heroes', 2: 'scenes/bg_level', 3: 'scenes/bg_upgrade', 4: 'scenes/bg_base' };
  private bgId = '';
  private bgNode: Node | null = null;

  private bgForTab(i: number): string {
    return MainUI.BG_BY_TAB[i] || 'scenes/scene_1_1';
  }

  /** 背景切换：整节点重建（复用 artSprite 的 cover 裁剪与缓存加载），保持垫底层级 */
  private applyPageBg(i: number): void {
    const id = this.bgForTab(i);
    if (id === this.bgId && this.bgNode && this.bgNode.isValid) return;
    this.bgId = id;
    // 销毁上一张的整个裁剪壳：artSprite cover 返回的是壳内美术节点，只销毁它会留下空壳累积在树上
    if (this.bgNode && this.bgNode.isValid) {
      const oldHolder = this.bgNode.parent && this.bgNode.parent !== this.node ? this.bgNode.parent : this.bgNode;
      oldHolder.destroy();
    }
    this.bgNode = artSprite(this.node, 0, 0, 750, LO.half * 2 + 240, id, { sliced: false, cover: true });
    // cover 模式下 artSprite 返回裁剪壳内的美术节点：垫底要挪的是外面的裁剪壳，否则壳盖在 UI 之上
    const holder = this.bgNode.parent && this.bgNode.parent !== this.node ? this.bgNode.parent : this.bgNode;
    holder.setSiblingIndex(0);
  }

  /** 页面刷新入口（购买/升级/穿戴后）：整屏重建 + 货币同步 */
  private rebuildScreen(): void {
    this.screens.destroyAllChildren();
    const ctx: PageCtx = { screens: this.screens, refresh: () => this.switchTab(this.tab) };
    switch (this.tab) {
      case 0: buildShop(ctx); break;
      case 1: buildHeroes(ctx); break;
      case 2: buildLevels(ctx); break;
      case 3: buildUpgrade(ctx); break;
      case 4: buildBase(ctx); break;
    }
    this.updateWallet();
  }
}
