/**
 * 主城母界面（§UX 五主界面）：底部导航 商店/英雄/关卡/升级/基地（左→右）
 * 顶栏：刘海预留区下方 y100 起，无标题，金币/钻石双货币靠右（§已确认）。
 * 页签内容整屏重建（PageKit.ctx.refresh）；各页实现见 ui/pages/*（线稿一一对应）。
 */
import { _decorator, Color, Component, Graphics, Label, Node, view } from 'cc';
import { initLayout, LO, PAL } from '../config/GameConfig';
import { loadSave } from '../core/SaveData';
import { flow } from '../core/Flow';
import { btn, C, CA, gpanel, label, N, setText, WX, WY, WYB } from './UIKit';
import { artSprite } from './Ux';
import { PageCtx, setGlobalRoot } from './PageKit';
import { buildShop } from './pages/ShopPage';
import { buildHeroes } from './pages/HeroPage';
import { buildLevels } from './pages/LevelsPage';
import { buildUpgrade } from './pages/UpgradePage';
import { buildBase } from './pages/BasePage';

const { ccclass } = _decorator;

/** 底部页签定义（左→右） */
const TABS: { name: string; icon: string }[] = [
  { name: '商店', icon: '🛒' },
  { name: '英雄', icon: '🦸' },
  { name: '关卡', icon: '⚔️' },
  { name: '升级', icon: '⬆️' },
  { name: '基地', icon: '🏰' },
];

const NAV_H = 148;

@ccclass('MainUI')
export class MainUI extends Component {
  private screens!: Node;
  private navItems: { slot: Node; icon: Node; txt: Node; idle: Node; act: Node }[] = [];
  private goldLbl: Node | null = null;
  private diaLbl: Node | null = null;
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
    this.goldLbl = null;
    this.diaLbl = null;

    // 背景：场景图压暗当主城底图（后续换专属主城图时同 ID 覆盖即可）
    const bg = artSprite(root, 0, 0, 750, LO.half * 2 + 240, 'scenes/scene_1_1', { sliced: false, cover: true });
    bg.setSiblingIndex(0);
    const dim = gpanel(root, 0, 0, 750, LO.half * 2 + 240, CA('#10141A', 0.62), undefined, 0, 0);
    dim.setSiblingIndex(1);

    this.buildTopBar(root);
    this.buildNavBar(root);

    this.screens = N('Screens', root, 0, 0, 750, LO.half * 2);
    setGlobalRoot(root);
    this.tab = flow.mainTab;
    this.switchTab(this.tab);
    // 资源栏恒在页面内容上层（英雄页大背板延伸到屏顶，会盖住先建的货币芯片）
    ['resBar'].forEach(nm => { const n = root.getChildByName(nm); if (n) n.setSiblingIndex(root.children.length - 1); });
  }

  /* ---------- 顶栏：双货币靠右（用户确认：半透明底板 + 资源图标不加边框——无描边、无带环座美术） ---------- */
  private buildTopBar(root: Node): void {
    const sv = loadSave();
    const bar = N('resBar', root, 0, 0, 750, 120);
    // 半透明药丸底板（垫在两组货币芯片下）
    gpanel(bar, WX(420, 325), WY(145, 0), 325, 72, CA('#10141A', 0.55), undefined, 0, 36);
    // 金币（左）+ 钻石（右）并排靠右（与原背板中线同高：WY(145,0) = WY(100,90) 中心线）
    const goldRow = N('gold', bar, WX(430, 150), WY(145, 0), 150, 50);
    const goldSeat = gpanel(goldRow, -50, 0, 50, 50, CA(PAL.gold, 0.2), undefined, 0, 25);
    artSprite(goldSeat, 0, 0, 36, 36, 'ui_icon_coin', { sliced: false });
    this.goldLbl = label(goldRow, 32, 0, String(Math.floor(sv.gold)), { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 90, h: 34 });

    const diaRow = N('dia', bar, WX(600, 140), WY(145, 0), 140, 50);
    const diaSeat = gpanel(diaRow, -50, 0, 50, 50, CA(PAL.blue, 0.2), undefined, 0, 25);
    artSprite(diaSeat, 0, 0, 34, 34, 'ui_icon_diamond', { sliced: false });
    this.diaLbl = label(diaRow, 32, 0, String(sv.diamonds), { size: 24, color: '#CFE3FF', bold: true, align: 'left', w: 80, h: 34 });
  }

  /** 货币刷新（购买/升级后同步） */
  private updateWallet(): void {
    const sv = loadSave();
    if (this.goldLbl) setText(this.goldLbl, String(Math.floor(sv.gold)));
    if (this.diaLbl) setText(this.diaLbl, String(sv.diamonds));
  }

  /* ---------- 底部导航（5 页签；用户确认：导航栏不要边框——平板底 + 高亮板，无页签框美术） ---------- */
  private buildNavBar(root: Node): void {
    const bar = gpanel(root, 0, WYB(0, NAV_H), 750, NAV_H, CA('#14181E', 0.94), undefined, 0, 0);

    const w = 138, gap = 0;   // 连体无间隔（用户确认与页签栏同做法）
    const x0 = (750 - TABS.length * w) / 2;
    TABS.forEach((t, i) => {
      const cx = WX(x0 + i * w + w / 2, 0);
      const slot = N('tab' + i, root, cx, WYB(12, 124), w, 124);
      const idle = this.segPlate(slot, w, 124, i, TABS.length, CA('#0B0F16', 0.5));  // 未激活底板
      const act = this.segPlate(slot, w, 124, i, TABS.length, CA(PAL.gold, 0.25));   // 激活高亮板
      act.active = false;
      const icon = label(slot, 0, 22, t.icon, { size: 34 });
      const txt = label(slot, 0, -34, t.name, { size: 20, color: '#FFFFFF', bold: true });
      slot.on(Node.EventType.TOUCH_END, () => this.switchTab(i));
      this.navItems.push({ slot, icon, txt, idle, act });
    });
  }

  /** 连体段板：段内直角，仅首段左侧/末段右侧留圆弧（与页签栏同做法的并集画法） */
  private segPlate(parent: Node, w: number, h: number, i: number, n: number, fill: Color): Node {
    const s = N('plate', parent, 0, 0, w, h);
    const g = s.addComponent(Graphics);
    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, i === 0 || i === n - 1 ? 12 : 0);
    if (i === 0) g.rect(w / 2 - 12, -h / 2, 12, h);
    else if (i === n - 1) g.rect(-w / 2, -h / 2, 12, h);
    g.fill();
    return s;
  }

  /** 页签高亮：激活金板金字 / 未激活暗板白字（无边框规范：纯色板，无页签框美术） */
  private highlightTabs(): void {
    this.navItems.forEach((it, k) => {
      const active = k === this.tab;
      it.idle.active = !active;
      it.act.active = active;
      const iconLbl = it.icon.getComponent(Label);
      const txtLbl = it.txt.getComponent(Label);
      if (txtLbl) txtLbl.color = C(active ? PAL.gold : '#FFFFFF');
      if (iconLbl) iconLbl.color = C(active ? '#FFE08A' : '#FFFFFF');
    });
  }

  /* ---------- 页签切换：内容整屏重建 ---------- */
  switchTab(i: number): void {
    this.tab = i;
    flow.mainTab = i;
    this.highlightTabs();
    this.rebuildScreen();
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
