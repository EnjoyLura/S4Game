/**
 * 战斗 HUD（UX 线稿 ①）：顶栏(暂停/关卡名/波次) + 经验条(Lv骑条居中) + 预警横幅
 * + 左列(倍速/统计/FPS) + 右侧大招纵列(每英雄一钮) + 防线耐久条(盾值胶囊/百分比) + 头顶普攻技能图标(CD环)
 * 点击普攻/技能/未充满大招图标 → 属性Tips（§3.11）
 */
import { Graphics, Label, Layers, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { expNeed, LO, PAL } from '../config/GameConfig';
import { gbar, gcircle, gpanel, label, setText, WY, WYB, WX, Bar, CA } from './UIKit';
import { artSprite, uxFrame } from './Ux';
import { BattleDirector } from '../battle/BattleDirector';
import { HeroBase } from '../battle/Hero';

/** 每英雄一套的大招按钮状态（右侧纵列，底基锚定向上叠放） */
interface UltUI {
  ux: number; uy: number;
  glow: Node;         // 就绪光晕（呼吸）
  btn: Node;
  bright: Node;       // 就绪增亮层
  gray: Node;         // 充能中灰化杯体
  water: Node;        // 金水（圆杯液面上涨）
  waterG: Graphics;
  waterR: number;     // 金水半径（美术座内孔更小，加载后收半径）
  orbit: Node;        // 就绪环绕粒子
  chargeTxt: Node;
  ready: boolean | null;
  shown: number;      // 金水平滑逼近
  flash: number;      // 获得充能闪光
  lastChargeKey: number;
  lastTarget: number;
}

/** 每英雄一套的头顶技能图标状态 */
interface SkillUI {
  cx: number; cy: number;
  icon: Node;
  glyph: Node;
  gray: Node;
  pie: Node;
  pieG: Graphics;
  cdTxt: Node;
  cooling: boolean | null;
  lastCdKey: number;
}

export class HUD {
  private waveTxt!: Node;
  private xpBar!: Bar;
  private hpBar!: Bar;
  private hpVal!: Node;
  private pctTxt!: Node;
  private shieldNode!: Node;
  private shieldG!: Graphics;
  private shieldVal!: Node;
  private shieldArt!: Node;
  private shieldArtOk = false;
  private ults: UltUI[] = [];
  private skills: SkillUI[] = [];
  private hudNode!: Node;
  private banner!: Node;
  private bannerTxt!: Node;
  private fpsTxt!: Node;
  private speedTxt!: Node;
  private timeTxt!: Node;
  private lvTxt!: Node;
  private lastWave = '';
  private lastSec = -1;
  private lastLv = -1;
  private lastHp = -1;
  private lastShield = -1;
  // 经验条上涨动画状态（平滑逼近 + 获得时闪光）
  private xpShown = 0;
  private xpTarget0 = 0;
  private xpFlash = 0;
  private lastXpTarget = 0;

  constructor(parent: Node, private dir: BattleDirector, bgParent?: Node) {
    this.build(parent, bgParent);
  }

  private build(parent: Node, bgParent?: Node): void {
    const top = new Node('HUD');
    top.setParent(parent);
    this.hudNode = top;

    /* 背景：战场底色（占位）——必须画在 Field 里（mobs 之前）；高度盖满可视区防黑边
       美术：scene_1_1 竖版战场（1152×2048 ≈ 9:16 视口，近零变形），加载成功后盖掉底色 */
    const bgFlat = gpanel(bgParent || top, 0, 0, 750, LO.half * 2 + 240, '#2E4034', undefined, 0, 0);
    bgFlat.setSiblingIndex(0);
    artSprite(bgParent || top, 0, 0, 750, LO.half * 2 + 240, 'scenes/scene_1_1',
      { sliced: false, hideOnLoad: [bgFlat] }).setSiblingIndex(1);

    /* 顶栏 */
    const topBar = gpanel(top, 0, WY(100, 70), 718, 70, CA('#14181E', 0.72), CA(PAL.gold, 0.9), 1.5, 10);
    artSprite(topBar, 0, 0, 718, 70, 'ui_panel_dark_gold', { belowIdx: 0 });
    const pauseBtn = gpanel(top, WX(30, 60), WY(105, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    label(pauseBtn, 0, 0, '⏸', { size: 26, color: PAL.gold, bold: true });
    artSprite(pauseBtn, 0, 0, 60, 60, 'ui_icon_pause', { sliced: false });
    pauseBtn.on(Node.EventType.TOUCH_END, () => this.dir.togglePause());
    // 关卡计时（线稿①：暂停键右侧 00:36）
    this.timeTxt = label(top, WX(110, 140), WY(114, 40), '00:00', { size: 20, color: '#CDC2A2', align: 'left', w: 140, h: 40 });
    label(top, 0, WY(110, 50), this.dir.levelDef.id + ' ' + this.dir.levelDef.name, { size: 22, color: PAL.parch, bold: true, w: 400, h: 50 });
    const wavePill = gpanel(top, WX(560, 150), WY(105, 60), 150, 60, CA('#FFFFFF', 0.08), CA('#FFFFFF', 0.27), 1.5, 30);
    artSprite(wavePill, 0, 0, 150, 60, 'ui_wave_pill', { belowIdx: 0 });
    this.waveTxt = label(top, WX(560, 150), WY(105, 60), '波次 0/10', { size: 20, color: '#FFFFFF', bold: true });

    /* 经验条（下移与顶栏留出间距）+ 居中 Lv 徽章骑条（线稿 ui_lv_badge） */
    this.xpBar = gbar(top, WX(30, 690), WY(184, 14), 690, 14, PAL.blue);
    const lvBadge = gpanel(top, WX(330, 90), WY(175, 32), 90, 32, CA('#14181E', 0.92), CA('#FFFFFF', 0.3), 1.5, 10);
    // ui_lv_badge 美术暂不接：切片烤死了"Lv.1"文字，与动态等级冲突（第二批出无字版再换）
    this.lvTxt = label(lvBadge, 0, 0, 'Lv.1', { size: 16, color: '#FFE08A', bold: true });

    /* 预警横幅 */
    this.banner = gpanel(top, WX(115, 520), WY(226, 72), 520, 72, CA(PAL.gold, 0.22), PAL.gold, 2, 12);
    artSprite(this.banner, 0, 0, 520, 72, 'ui_banner_warn', { belowIdx: 0 });
    this.bannerTxt = label(this.banner, 0, 0, '敌军来袭！', { size: 28, color: PAL.gold, bold: true });
    this.banner.active = false;

    // 左列：FPS / 倍速 / 伤害统计（FPS 与倍速按钮左缘对齐 = 设计 x24，需固定宽 + shrink 让 left 对齐生效）
    this.fpsTxt = label(top, WX(24, 120), WY(210, 30), 'FPS:60', { size: 15, color: '#7EE787', align: 'left', w: 120, h: 30, shrink: true });
    const speedBtn = gpanel(top, WX(24, 60), WY(240, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    artSprite(speedBtn, 0, 0, 60, 60, 'ui_icon_speed', { sliced: false, belowIdx: 0 });
    this.speedTxt = label(speedBtn, 0, 0, 'X1', { size: 18, color: '#FFFFFF', bold: true });
    speedBtn.on(Node.EventType.TOUCH_END, () => this.dir.toggleSpeed());
    const statsBtn = gpanel(top, WX(24, 60), WY(320, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    const statsGlyph = label(statsBtn, 0, 0, '📊', { size: 24 });
    artSprite(statsBtn, 0, 0, 60, 60, 'ui_icon_stats', { sliced: false, hideOnLoad: [statsGlyph] });
    statsBtn.on(Node.EventType.TOUCH_END, () => this.dir.showStats());

    /* 右侧大招纵列：每英雄一钮，底基锚定向上叠放（线稿① 4×1 纵列右对齐）
       充能中：灰化杯体 + 金水上涨（2% 步进）；就绪：高亮 + 光晕呼吸 + 粒子环绕 */
    this.dir.heroes.forEach((h, i) => this.ults.push(this.buildUlt(top, i, h)));

    /* 防线耐久条（贴屏底、在墙上方）：条内居中耐久值 + 盾值胶囊(右→左) + 右侧百分比 */
    this.hpBar = gbar(top, WX(55, 640), WYB(176, 20), 640, 22, PAL.green);
    this.hpVal = label(top, WX(55, 640), WYB(176, 20), '1000/1000', { size: 15, color: '#FFFFFF', bold: true });
    this.shieldNode = new Node('shield');
    this.shieldNode.setParent(top);
    this.shieldNode.setPosition(0, WYB(176, 24), 0);
    this.shieldG = this.shieldNode.addComponent(Graphics);
    this.shieldNode.active = false;
    this.shieldVal = label(top, 0, WYB(176, 24), '100', { size: 14, color: '#FFFFFF', bold: true });
    this.shieldVal.active = false;
    // 盾值美术胶囊（右缘锚点，自耐久条右端向左伸展），加载后接管程序绘制
    this.shieldArt = artSprite(top, 345.5, WYB(176, 24), 40, 24, 'ui_bar_shield', { onLoaded: () => {
      this.shieldArtOk = true;
      this.shieldArt.getComponent(UITransform)!.setAnchorPoint(1, 0.5);
      if (this.lastShield >= 0) this.redrawShield(this.lastShield);
    }});
    this.shieldArt.active = false;
    this.pctTxt = label(top, WX(698, 48), WYB(176, 24), '100%', { size: 16, color: '#9FE08A', bold: true });

    /* 英雄头顶 普攻/技能 图标（耐久条正下方，压墙顶，不遮挡耐久条；每英雄一套）
       技能 CD 中：灰化 + 扇形冷却遮罩 + 中心倒计时；就绪：高饱和 + 弹跳过渡 */
    this.dir.heroes.forEach((h, i) => this.skills.push(this.buildSkillBadge(top, i, h)));
  }

  /** 第 i 钮：底基 504，向上每钮 +110；点击就绪即施放，未满→Tips
   *  美术：金座/激活座/灰座三态贴图（u.waterR 在美术到位后收小到内孔） */
  private buildUlt(top: Node, i: number, hero: HeroBase): UltUI {
    const ux = WX(636, 90), uy = WYB(504 + i * 110, 90);
    const glow = gcircle(top, ux, uy, 56, CA(PAL.gold, 0.16));
    const glowOp = glow.addComponent(UIOpacity);
    glowOp.opacity = 130;
    glow.active = false;
    const btn = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.25), PAL.gold, 2.5);
    const bright = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.42));
    bright.active = false;
    const gray = gcircle(top, ux, uy, 45, CA('#3A4250', 0.9), '#77808E', 1.5);
    artSprite(btn, 0, 0, 90, 90, 'ui_circ_icon_gold', { belowIdx: 0 });
    artSprite(bright, 0, 0, 90, 90, 'ui_circ_icon_gold_active', { belowIdx: 0 });
    artSprite(gray, 0, 0, 90, 90, 'ui_circ_icon_gray', { belowIdx: 0 });
    const water = new Node('ultWater' + i);
    water.setParent(top);
    water.setPosition(ux, uy, 0);
    const waterG = water.addComponent(Graphics);
    const orbit = new Node('ultOrbit' + i);
    orbit.setParent(top);
    orbit.setPosition(ux, uy, 0);
    const og = orbit.addComponent(Graphics);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rr = 54 + (k % 3) * 5;
      og.fillColor = CA(k % 2 ? '#FFE08A' : PAL.gold, 0.95);
      og.circle(Math.cos(a) * rr, Math.sin(a) * rr, 2 + (k % 3) * 0.9);
      og.fill();
    }
    orbit.addComponent(UIOpacity);
    orbit.active = false;
    const chargeTxt = label(top, ux, uy, '大招\n0%', { size: 18, color: '#FFFFFF', bold: true, w: 90, h: 50 });
    // 钮下英雄名：双英雄时代区分归属（艾拉/凯尔）
    label(top, ux, uy - 58, hero.name.slice(0, 2), { size: 13, color: '#CDC2A2', bold: true, w: 90, h: 20 });
    btn.on(Node.EventType.TOUCH_END, () => {
      if (this.dir.tryCastUlt(i) === 'charging') this.dir.showTips('ult', i);
    });
    const ui: UltUI = { ux, uy, glow, btn, bright, gray, water, waterG, waterR: 43, orbit, chargeTxt, ready: null, shown: 0, flash: 0, lastChargeKey: -1, lastTarget: -1 };
    // 美术金座内孔小于程序圆：到位后收金水半径（缓存命中时同步回调，ui 已就绪）
    uxFrame('ui_circ_icon_gold', sf => { if (sf) ui.waterR = 27; });
    return ui;
  }

  /** 头顶图标对：普攻(-27)/技能(+27)，锚定各自英雄（美术：金/蓝座 + 灰化座） */
  private buildSkillBadge(top: Node, i: number, hero: HeroBase): SkillUI {
    const cy = WYB(126, 46);
    const atkX = hero.x - 27, cx = hero.x + 27;
    const atkIcon = gcircle(top, atkX, cy, 23, CA(PAL.gold, 0.3), PAL.gold, 2);
    label(atkIcon, 0, 0, '攻', { size: 18, color: PAL.gold, bold: true });
    artSprite(atkIcon, 0, 0, 46, 46, 'ui_circ_icon_gold', { belowIdx: 0 });
    atkIcon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('atk', i));
    const icon = gcircle(top, cx, cy, 23, CA(PAL.blue, 0.3), PAL.blue, 2);
    const glyph = label(icon, 0, 0, '技', { size: 18, color: PAL.blue, bold: true });
    artSprite(icon, 0, 0, 46, 46, 'ui_circ_icon_blue', { belowIdx: 0 });
    icon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('skill', i));
    const gray = gcircle(top, cx, cy, 23, CA('#3A4250', 0.9), '#77808E', 1.5);
    artSprite(gray, 0, 0, 46, 46, 'ui_circ_icon_gray', { belowIdx: 0 });
    gray.active = false;
    const pie = new Node('skillPie' + i);
    pie.setParent(top);
    pie.setPosition(cx, cy, 0);
    const pieG = pie.addComponent(Graphics);
    pie.active = false;
    const cdTxt = label(top, cx, cy, '', { size: 13, color: '#FFFFFF', bold: true, w: 48, h: 20 });
    cdTxt.active = false;
    return { cx, cy, icon, glyph, gray, pie, pieG, cdTxt, cooling: null, lastCdKey: -1 };
  }

  setWave(cur: number, total: number): void {
    const t = '波次 ' + cur + '/' + total;
    if (t !== this.lastWave) { setText(this.waveTxt, t); this.lastWave = t; }
  }

  setFps(n: number): void {
    setText(this.fpsTxt, 'FPS:' + n);
  }

  setSpeed(s: 1 | 2): void {
    setText(this.speedTxt, 'X' + s);
  }

  showBanner(text: string, dur: number): void {
    setText(this.bannerTxt, text);
    this.banner.active = true;
    Tween.stopAllByTarget(this.banner);
    let op = this.banner.getComponent(UIOpacity) || this.banner.addComponent(UIOpacity);
    op.opacity = 255;
    this.banner.setScale(0.6, 0.6, 1);
    tween(this.banner)
      .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .delay(dur)
      .call(() => { tween(op).to(0.3, { opacity: 0 }).call(() => { this.banner.active = false; }).start(); })
      .start();
  }

  /** 每帧轮询；dt 用于经验/充能的上涨动画（只在值变化或动画未收敛时重绘） */
  sync(dt = 0): void {
    const d = this.dir;
    // 关卡计时（整秒变化才重排 Label）
    const sec = Math.floor(d.elapsed);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      setText(this.timeTxt, String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'));
    }
    // Lv 徽章
    if (d.heroLevel !== this.lastLv) {
      this.lastLv = d.heroLevel;
      setText(this.lvTxt, 'Lv.' + d.heroLevel);
    }
    // 经验：平滑上涨 + 获得时闪光（升级重置时快速回落）
    const need = expNeed(d.heroLevel);
    const xpTarget = Math.min(1, d.xp / need);
    if (xpTarget > this.lastXpTarget + 0.0001) this.xpFlash = 0.35;
    this.lastXpTarget = xpTarget;
    if (xpTarget < this.xpShown - 0.25) this.xpShown = 0;
    this.xpShown += (xpTarget - this.xpShown) * Math.min(1, dt * (xpTarget > this.xpShown ? 6 : 4));
    if (Math.abs(xpTarget - this.xpShown) < 0.0015) this.xpShown = xpTarget;
    this.xpFlash = Math.max(0, this.xpFlash - dt);
    if (this.xpShown !== this.xpTarget0 || this.xpFlash > 0) {
      this.xpBar.set(this.xpShown, this.xpFlash > 0 ? '#BFE9FF' : PAL.blue);
      this.xpTarget0 = this.xpShown;
    }
    // 耐久 + 盾
    const hpKey = Math.round(d.line.hp) * 4 + Math.round(d.line.maxHp);
    if (hpKey !== this.lastHp) {
      this.lastHp = hpKey;
      this.hpBar.set(d.line.ratio, d.line.lowRatio ? PAL.red : PAL.green);
      setText(this.hpVal, Math.ceil(d.line.hp) + '/' + Math.round(d.line.maxHp));
      setText(this.pctTxt, Math.round(d.line.ratio * 100) + '%');
    }
    const sh = Math.round(d.line.shield);
    if (sh !== this.lastShield) {
      this.lastShield = sh;
      this.redrawShield(sh);
    }
    // 每英雄：大招充能/就绪 + 技能CD
    d.heroes.forEach((h, i) => {
      this.syncUlt(h, this.ults[i], dt);
      this.syncSkillCd(h, this.skills[i]);
    });
  }

  /* ---------- 大招图标：水杯充能 / 就绪光效（每英雄） ---------- */

  private syncUlt(hero: HeroBase, u: UltUI, dt: number): void {
    if (!u) return;
    const ready = hero.ultReady;
    if (ready !== u.ready) {
      u.ready = ready;
      this.applyUltReady(u, ready);
    }
    if (!ready) {
      // 金水液面平滑上涨；获得充能时水面高光闪亮
      const cp = hero.chargePct;
      if (cp > u.lastTarget + 0.0001) u.flash = 0.35;
      u.lastTarget = cp;
      u.shown += (cp - u.shown) * Math.min(1, dt * 5);
      if (cp - u.shown < 0.002) u.shown = cp;
      u.flash = Math.max(0, u.flash - dt);
      const key = Math.round(u.shown * 60);
      if (key !== u.lastChargeKey || u.flash > 0) {
        u.lastChargeKey = key;
        this.redrawUltWater(u, u.shown, u.flash > 0);
        setText(u.chargeTxt, '大招\n' + Math.round(cp * 100) + '%');
      }
    }
  }

  /** 金水上涨：圆杯内液面以下的圆缺面（弦 + 下弧采样，避免 arc 方向歧义）；flash=获得瞬间水面高光 */
  private redrawUltWater(u: UltUI, pct: number, flash = false): void {
    const g = u.waterG;
    g.clear();
    if (pct <= 0.01) return;
    const R = u.waterR;
    if (pct >= 0.995) {
      g.fillColor = CA(PAL.gold, flash ? 0.98 : 0.9);
      g.circle(0, 0, R);
      g.fill();
      return;
    }
    const yc = -R + 2 * R * pct;
    const a = Math.asin(Math.max(-1, Math.min(1, yc / R)));
    const xr = R * Math.cos(a);
    g.fillColor = CA(PAL.gold, flash ? 0.95 : 0.88);
    g.moveTo(xr, yc);
    g.lineTo(-xr, yc);
    const thA = Math.PI - a, thB = Math.PI * 2 + a;
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const th = thA + ((thB - thA) * i) / steps;
      g.lineTo(R * Math.cos(th), R * Math.sin(th));
    }
    g.close();
    g.fill();
    g.strokeColor = CA(flash ? '#FFF6D0' : '#FFE08A', 0.95);   // 水面高光
    g.lineWidth = flash ? 3.5 : 2.5;
    g.moveTo(-xr + 4, yc);
    g.lineTo(xr - 4, yc);
    g.stroke();
  }

  /** 充能→就绪 状态切换：图标弹跳 + 扩散冲击环 + 光晕呼吸 + 粒子环绕 */
  private applyUltReady(u: UltUI, ready: boolean): void {
    u.gray.active = !ready;
    u.water.active = !ready;
    u.bright.active = ready;
    if (!ready) {
      u.lastChargeKey = -1;
      u.shown = 0;
      u.lastTarget = -1;
      setText(u.chargeTxt, '大招\n0%');
      Tween.stopAllByTarget(u.btn);
      Tween.stopAllByTarget(u.glow);
      Tween.stopAllByTarget(u.orbit);
      u.btn.setScale(1, 1, 1);
      u.glow.active = false;
      u.orbit.active = false;
      return;
    }
    setText(u.chargeTxt, '大招\n就绪');
    u.glow.active = true;
    u.orbit.active = true;
    // 一次性过渡：弹跳 + 扩散环
    Tween.stopAllByTarget(u.btn);
    u.btn.setScale(1, 1, 1);
    tween(u.btn)
      .to(0.18, { scale: new Vec3(1.22, 1.22, 1) }, { easing: 'backOut' })
      .to(0.16, { scale: new Vec3(1, 1, 1) })
      .start();
    const burst = new Node('ultBurst');
    burst.layer = Layers.Enum.UI_2D;
    burst.setParent(this.hudNode);
    burst.setPosition(u.ux, u.uy, 0);
    const bg = burst.addComponent(Graphics);
    bg.strokeColor = CA(PAL.gold, 0.9);
    bg.lineWidth = 4;
    bg.circle(0, 0, 45);
    bg.stroke();
    const bop = burst.addComponent(UIOpacity);
    tween(burst).to(0.42, { scale: new Vec3(1.55, 1.55, 1) }).start();
    tween(bop).to(0.42, { opacity: 0 }).call(() => burst.destroy()).start();
    // 持续：光晕呼吸 + 粒子逆时针环绕
    const gop = u.glow.getComponent(UIOpacity)!;
    Tween.stopAllByTarget(gop);
    tween(gop).repeatForever(tween(gop).to(0.9, { opacity: 225 }).to(0.9, { opacity: 130 })).start();
    Tween.stopAllByTarget(u.orbit);
    tween(u.orbit).repeatForever(tween(u.orbit).by(4.5, { angle: -360 })).start();
  }

  /* ---------- 技能图标：CD 遮罩 / 就绪过渡（每英雄） ---------- */

  private syncSkillCd(hero: HeroBase, s: SkillUI): void {
    if (!s) return;
    const cdLeft = Math.max(0, hero.skillCd);
    const cooling = cdLeft > 0.05;
    if (cooling !== s.cooling) {
      const first = s.cooling === null;
      s.cooling = cooling;
      this.applySkillCooling(s, cooling, first);
    }
    if (cooling) {
      const key = Math.floor(cdLeft * 10);   // 0.1s 步进：遮罩重绘 + 倒计时跳动一致
      if (key !== s.lastCdKey) {
        s.lastCdKey = key;
        setText(s.cdTxt, cdLeft.toFixed(1) + 's');
        this.redrawSkillPie(s, cdLeft / hero.skillMax);
      }
    }
  }

  /** 扇形冷却遮罩：覆盖剩余 CD 比例，指针从 12 点顺时针扫过（随 CD 流逝遮罩收缩） */
  private redrawSkillPie(s: SkillUI, f: number): void {
    const g = s.pieG;
    g.clear();
    if (f <= 0.004) return;
    g.fillColor = CA('#0B0F16', 0.62);
    if (f >= 0.996) {
      g.circle(0, 0, 22);
      g.fill();
      return;
    }
    g.moveTo(0, 0);
    // Graphics 局部坐标 y 向上：π/2=12点、0=3点；ccw=false 按角度递减 = 屏幕顺时针。
    // 暗遮罩从"指针位"顺时针铺回12点：指针=f·360°处，随CD流逝像时针一样顺时针旋转（12→3→6→9），亮区在12点后顺时针生长
    g.arc(0, 0, 22, Math.PI / 2 - (1 - f) * Math.PI * 2, Math.PI / 2, false);
    g.close();
    g.fill();
  }

  private applySkillCooling(s: SkillUI, cooling: boolean, first: boolean): void {
    s.gray.active = cooling;
    s.pie.active = cooling;
    s.cdTxt.active = cooling;
    s.glyph.active = !cooling;
    s.lastCdKey = -1;
    if (!cooling && !first) {
      // 就绪过渡：弹跳 + 扩散环
      Tween.stopAllByTarget(s.icon);
      s.icon.setScale(1, 1, 1);
      tween(s.icon)
        .to(0.15, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'backOut' })
        .to(0.13, { scale: new Vec3(1, 1, 1) })
        .start();
      const burst = new Node('skillBurst');
      burst.layer = Layers.Enum.UI_2D;
      burst.setParent(this.hudNode);
      burst.setPosition(s.cx, s.cy, 0);
      const bg = burst.addComponent(Graphics);
      bg.strokeColor = CA(PAL.blue, 0.9);
      bg.lineWidth = 3;
      bg.circle(0, 0, 23);
      bg.stroke();
      const bop = burst.addComponent(UIOpacity);
      tween(burst).to(0.32, { scale: new Vec3(1.5, 1.5, 1) }).start();
      tween(bop).to(0.32, { opacity: 0 }).call(() => burst.destroy()).start();
    }
  }

  /** 盾值胶囊：从耐久条右端向左覆盖，宽度=盾值/耐久上限（§3.11）；美术条优先 */
  private redrawShield(shield: number): void {
    const g = this.shieldG;
    if (shield <= 0) {
      this.shieldNode.active = false;
      this.shieldArt.active = false;
      this.shieldVal.active = false;
      return;
    }
    this.shieldVal.active = true;
    const barW = 640, barH = 24;
    const w = Math.max(40, Math.min(barW - 4, (shield / this.dir.line.maxHp) * barW));
    const cx = 347.5 - 2 - w / 2;   // 耐久条右端(画布 x=347.5) 向左收
    if (this.shieldArtOk) {
      this.shieldNode.active = false;
      this.shieldArt.active = true;
      this.shieldArt.getComponent(UITransform)!.setContentSize(w, barH);
    } else {
      this.shieldArt.active = false;
      this.shieldNode.active = true;
      g.clear();
      g.fillColor = CA(PAL.blue, 0.55);
      g.roundRect(-w / 2, -barH / 2, w, barH, barH / 2);
      g.fill();
      this.shieldNode.setPosition(cx, WYB(176, 24), 0);
    }
    this.shieldVal.setPosition(cx, WYB(176, 24), 0);
    setText(this.shieldVal, String(shield));
  }
}
