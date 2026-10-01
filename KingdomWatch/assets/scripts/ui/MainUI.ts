/**
 * 主城母界面（§UX 五主界面）：底部导航 商店/英雄/关卡/升级/基地（左→右）
 * 页签内容按需构建；关卡页承载进入战斗入口（连通 §3.2 战斗流程）。
 * 背景：战场场景图 + 深色压暗，作为主城底图（M2 换专属主城图，同 ID 直接覆盖）。
 */
import { _decorator, Component, director, Label, Node } from 'cc';
import { LO, PAL } from '../config/GameConfig';
import { loadSave } from '../core/SaveData';
import { flow } from '../core/Flow';
import { btn, C, CA, gpanel, label, N, WX, WY, WYB } from './UIKit';
import { artSprite } from './Ux';

const { ccclass } = _decorator;

/** 底部页签定义（左→右） */
const TABS: { name: string; icon: string }[] = [
  { name: '商店', icon: '🛒' },
  { name: '英雄', icon: '🦸' },
  { name: '关卡', icon: '⚔️' },
  { name: '升级', icon: '⬆️' },
  { name: '基地', icon: '🏰' },
];

/** 关卡目录（M0 仅 1-1；后续关卡加进表即可） */
const LEVELS: { id: string; name: string; desc: string; open: boolean }[] = [
  { id: '1-1', name: '1-1 腐朽森林·前哨', desc: '10 波 · 哥布林军团', open: true },
  { id: '1-2', name: '1-2 腐朽森林·深林', desc: '通关 1-1 解锁', open: false },
];

const NAV_H = 122;

@ccclass('MainUI')
export class MainUI extends Component {
  private screens!: Node;
  private navItems: { slot: Node; icon: Node; txt: Node }[] = [];
  private tab = flow.mainTab;

  start(): void {
    const root = this.node;

    // 背景：场景图压暗当主城底图（后续换专属主城图时同 ID 覆盖即可）
    const bg = artSprite(root, 0, 0, 750, LO.half * 2 + 240, 'scenes/scene_1_1', { sliced: false, cover: true });
    bg.setSiblingIndex(0);
    const dim = gpanel(root, 0, 0, 750, LO.half * 2 + 240, CA('#10141A', 0.62), undefined, 0, 0);
    dim.setSiblingIndex(1);

    this.buildTopBar(root);
    this.buildNavBar(root);

    this.screens = N('Screens', root, 0, 0, 750, LO.half * 2);
    this.switchTab(this.tab);
  }

  /* ---------- 顶栏：标题 + 金币/钻石 ---------- */
  private buildTopBar(root: Node): void {
    const bar = gpanel(root, 0, WY(0, 90), 750, 90, CA('#14181E', 0.9), CA(PAL.gold, 0.9), 1.5, 10);
    artSprite(bar, 0, 0, 750, 90, 'ui_panel_dark_gold', { belowIdx: 0 });
    label(bar, 0, 0, '王 国 守 望', { size: 30, color: PAL.gold, bold: true });

    const sv = loadSave();
    const goldRow = N('gold', bar, -268, 0, 180, 44);
    const goldSeat = gpanel(goldRow, -56, 0, 44, 44, CA(PAL.gold, 0.2), PAL.gold, 2, 22);
    artSprite(goldSeat, 0, 0, 44, 44, 'ui_circ_icon_gold', { belowIdx: 0 });
    artSprite(goldSeat, 0, 0, 32, 32, 'ui_icon_coin', { sliced: false });
    label(goldRow, 24, 0, String(Math.floor(sv.gold)), { size: 22, color: '#FFF3D6', bold: true, align: 'left', w: 130, h: 30 });

    const diaRow = N('dia', bar, 268, 0, 180, 44);
    const diaSeat = gpanel(diaRow, -56, 0, 44, 44, CA(PAL.blue, 0.2), PAL.blue, 2, 22);
    artSprite(diaSeat, 0, 0, 44, 44, 'ui_circ_icon_gold', { belowIdx: 0 });
    artSprite(diaSeat, 0, 0, 30, 30, 'ui_icon_diamond', { sliced: false });
    label(diaRow, 24, 0, String(sv.diamonds), { size: 22, color: '#CFE3FF', bold: true, align: 'left', w: 130, h: 30 });
  }

  /* ---------- 底部导航（5 页签，美术页签框 + 图标/文字） ---------- */
  private buildNavBar(root: Node): void {
    const bar = gpanel(root, 0, WYB(0, NAV_H), 750, NAV_H, CA('#14181E', 0.94), CA(PAL.gold, 0.9), 1.5, 10);
    artSprite(bar, 0, 0, 750, NAV_H, 'ui_panel_dark_gold', { belowIdx: 0 });

    const w = 132, gap = 8;
    const x0 = (750 - (TABS.length * w + (TABS.length - 1) * gap)) / 2;
    TABS.forEach((t, i) => {
      const cx = WX(x0 + i * (w + gap) + w / 2, 0);
      const slot = N('tab' + i, root, cx, WYB(10, 102), w, 102);
      gpanel(slot, 0, 0, w, 102, CA('#0B0F16', 0.5), undefined, 0, 12);  // 美术加载失败的兜底
      artSprite(slot, 0, 0, w, 102, 'ui_tab_item', { belowIdx: 0 });
      const icon = label(slot, 0, 18, t.icon, { size: 34 });
      const txt = label(slot, 0, -26, t.name, { size: 20, color: '#FFFFFF', bold: true });
      slot.on(Node.EventType.TOUCH_END, () => this.switchTab(i));
      this.navItems.push({ slot, icon, txt });
    });
  }

  /** 页签高亮：激活金框金字 / 未激活银框白字（两套美术同位切换，按需补建） */
  private highlightTabs(): void {
    this.navItems.forEach((it, k) => {
      const active = k === this.tab;
      const want = 'art:ui_tab_item' + (active ? '_active' : '');
      const other = 'art:ui_tab_item' + (active ? '' : '_active');
      const otherNode = it.slot.getChildByName(other);
      if (otherNode) otherNode.active = false;
      const wantNode = it.slot.getChildByName(want);
      if (wantNode) {
        wantNode.active = true;
      } else {
        artSprite(it.slot, 0, 0, 132, 102, active ? 'ui_tab_item_active' : 'ui_tab_item', { belowIdx: 0 });
      }
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
    this.screens.destroyAllChildren();
    this.highlightTabs();
    switch (i) {
      case 0: this.buildShop(); break;
      case 1: this.buildHeroes(); break;
      case 2: this.buildLevels(); break;
      case 3: this.buildUpgrade(); break;
      case 4: this.buildBase(); break;
    }
  }

  /** 页头：撕纸标题横幅 */
  private pageTitle(parent: Node, text: string, y: number): void {
    const banner = gpanel(parent, 0, WY(y, 88), 520, 88, CA(PAL.wood, 0.95), PAL.gold, 2.5, 14);
    artSprite(banner, 0, 0, 520, 88, 'ui_banner_title', { belowIdx: 0 });
    label(banner, 0, 0, text, { size: 34, color: '#4A3214', bold: true });
  }

  /** 占位页通用：标题 + 圆座图标 + 施工提示 */
  private buildPlaceholder(title: string, icon: string, hint: string): void {
    this.pageTitle(this.screens, title, 190);
    const seat = gpanel(this.screens, 0, WY(470, 120), 120, 120, CA('#14181E', 0.8), '#FFFFFF33', 1.5, 24);
    artSprite(seat, 0, 0, 120, 120, 'ui_circ_icon_gold', { belowIdx: 0 });
    label(seat, 0, 0, icon, { size: 56 });
    label(this.screens, 0, WY(620, 40), hint, { size: 22, color: '#CDC2A2' });
  }

  /* ---------- ① 商店（占位） ---------- */
  private buildShop(): void {
    this.buildPlaceholder('商 店', '🛒', '商店施工中 · 敬请期待');
  }

  /* ---------- ② 英雄（已上阵双英雄展示） ---------- */
  private buildHeroes(): void {
    this.pageTitle(this.screens, '英 雄', 190);
    const heroes = [
      { avatar: 'ui_avatar_archer', name: '艾拉·风羽', job: '弓手 · 风刃射击' },
      { avatar: 'ui_avatar_sniper', name: '凯尔·鹰眼', job: '狙击 · 穿颅射击' },
    ];
    heroes.forEach((h, i) => {
      const y = 400 + i * 190;
      const card = gpanel(this.screens, 0, WY(y, 160), 670, 160, CA('#14181E', 0.9), '#FFFFFF33', 1.5, 14);
      artSprite(card, 0, 0, 670, 160, 'ui_panel_dark_white', { belowIdx: 0 });
      const ava = gpanel(card, -252, 0, 116, 116, CA('#2A3240', 1), PAL.gold, 2.5, 58);
      artSprite(ava, 0, 0, 116, 116, 'ui_circ_icon_gold', { belowIdx: 0 });
      artSprite(ava, 0, 0, 96, 96, h.avatar, { sliced: false });
      label(card, -100, 22, h.name, { size: 26, color: '#FFF3D6', bold: true, h: 36 });
      label(card, -100, -20, h.job, { size: 18, color: '#AAB2BD', h: 28 });
      label(card, 268, 0, 'Lv.1', { size: 24, color: PAL.gold, bold: true, w: 100, h: 34 });
    });
    label(this.screens, 0, WY(880, 36), '编队槽位 · 英雄升级（后续版本开放）', { size: 18, color: '#889099' });
  }

  /* ---------- ③ 关卡（战斗入口） ---------- */
  private buildLevels(): void {
    this.pageTitle(this.screens, '选 择 关 卡', 190);
    const sv = loadSave();
    LEVELS.forEach((lv, i) => {
      const y = 390 + i * 210;
      const card = gpanel(this.screens, 0, WY(y, 180), 670, 180,
        CA('#14181E', 0.9), lv.open ? CA(PAL.gold, 0.7) : '#FFFFFF22', 2, 14);
      artSprite(card, 0, 0, 670, 180, lv.open ? 'ui_panel_dark_gold' : 'ui_panel_dark_white', { belowIdx: 0 });
      label(card, -110, 42, lv.name, { size: 26, color: lv.open ? '#FFF3D6' : '#889099', bold: true, align: 'left', w: 400, h: 36 });
      label(card, -110, -2, lv.desc, { size: 18, color: lv.open ? '#AAB2BD' : '#5F6873', align: 'left', w: 400, h: 28 });
      // 星级（通关存档，§3.9）
      const stars = sv.stars[lv.id] || 0;
      for (let s = 0; s < 3; s++) {
        const star = gpanel(card, -172 + s * 52, -52, 44, 44, CA('#000000', 0.25), undefined, 0, 22);
        artSprite(star, 0, 0, 44, 44, s < stars ? 'ui_star' : 'ui_star_gray', { sliced: false });
      }
      if (lv.open) {
        // 连通战斗：标记战斗模式后经 loadScene 重建进入 §3.2
        btn(card, 232, 0, 190, 76, '▶ 进入战斗', PAL.green, () => {
          flow.mode = 'battle';
          flow.levelId = lv.id;
          director.loadScene('Main');
        }, 24);
      } else {
        btn(card, 232, 0, 190, 76, '🔒 未开放', '#5A6472', () => {}, 22);
      }
    });
    label(this.screens, 0, WY(880, 36), '更多关卡（后续版本开放）', { size: 18, color: '#889099' });
  }

  /* ---------- ④ 升级（占位） ---------- */
  private buildUpgrade(): void {
    this.buildPlaceholder('升 级', '⬆️', '强化升级施工中 · 敬请期待');
  }

  /* ---------- ⑤ 基地（占位） ---------- */
  private buildBase(): void {
    this.buildPlaceholder('基 地', '🏰', '基地建设施工中 · 敬请期待');
  }
}
