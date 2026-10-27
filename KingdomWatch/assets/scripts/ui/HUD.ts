import { enemyArtRef } from '../config/ChapterContent';
/**
 * 战斗 HUD（UX 线稿 ①）：顶栏(暂停/关卡名/波次) + 经验条(无背板Lv居中) + 预警横幅
 * + 左列(倍速/统计/FPS) + 右侧大招纵列(每英雄一钮) + 防线耐久/蓝色外层护盾 + 头顶普攻技能图标(CD环)
 * 点击普攻/技能/未充满大招图标 → 属性Tips（§3.11）
 */
import { Graphics, Label, Layers, Mask, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { expNeed, LO, PAL } from '../config/GameConfig';
import { battleSceneKey } from '../config/Campaign';
import { gcircle, gpanel, label, noticeBtn, setText, WY, WYB, WX, Bar, CA, N } from './UIKit';
import { artAtlasSprite, artSprite } from './Ux';
import { comicButton, comicPlate } from './ComicUI';
import { detailSkin } from './DetailDialog';
import { BattleDirector } from '../battle/BattleDirector';
import { HeroBase } from '../battle/Hero';
import { CODEX } from '../core/GameData';
import { UltEnergyFx } from './UltEnergyFx';
import { battleProgressBar, battleShieldOutline, battleStatusIcon } from './BattleProgressBar';
import { bindButton } from './ButtonFeedback';

const LINE_HP_BOTTOM = 212; // Raised 14 design pixels from the previous bar.
const ULT_BOTTOM = 340; // Leaves room for the two value rows and the ultimate energy halo.
const ULT_STEP = 110;

/** 每英雄一套的大招按钮状态（右侧纵列，底基锚定向上叠放） */
interface UltUI {
  root: Node; baseY: number;
  ux: number; uy: number;
  glow: Node;         // 就绪光晕（呼吸）
  btn: Node;
  bright: Node;       // 就绪增亮层
  gray: Node;         // 充能中灰化杯体
  mask: Node;         // 冷却置灰遮罩：盖住整个图标（头像之上、能量与文字之下）
  color: string;      // 充能能量色（英雄主色：弓=绿 狙=蓝）
  fx: string;         // 就绪特效主色（淡色：弓=淡绿 狙=淡蓝，用户调整）
  water: Node;        // 能量水（圆杯液面上涨，半透明可透出图标）
  waterG: Graphics;
  waterR: number;     // 能量水半径
  orbit: Node;        // 就绪环绕粒子
  chargeTxt: Node;
  ready: boolean | null;
  shown: number;      // 液面平滑逼近
  flash: number;      // 获得充能闪光
  lastChargeKey: number;
  lastTarget: number;
  energy?: UltEnergyFx;
  energyActive?: boolean;
}

/** 每英雄一套的头顶技能图标状态 */
interface SkillUI {
  root: Node; atkIcon: Node; unlocked: boolean;
  cx: number; cy: number;
  icon: Node;
  glyph: Node;
  gray: Node;
  pie: Node;
  pieG: Graphics;
  cdTxt: Node;
  cooling: boolean | null;
  lastCdKey: number;
  energy: UltEnergyFx;
  lastCastSerial: number;
}

/** Share the established ultimate palette with the smaller automatic-skill feedback. */
const HERO_ENERGY_COLOR: Record<string, string> = {
  arcane:'#69BFFF',
  lance:'#FFD34F',
  space:'#BB63D8', sword:'#63D2A4',
  wind: '#55D8C3', ninja: '#4559A8', cannon: '#D5A641', siphon: '#963657',
  archer: PAL.green, sniper: '#1F9EFF', pyro: PAL.orange, volt: '#B96BFF', mora: '#6FCFEA',
};

export class HUD {
  private waveTxt!: Node;
  private xpBar!: Bar;
  private hpBar!: Bar;
  private hpVal!: Node;
  private shieldNode!: Node;
  private shieldBar!: Bar;
  private shieldVal!: Node;
  private ults: UltUI[] = [];
  ultimateTarget(index: number): Node | null { return this.ults[index]?.btn || null; }
  /** Artwork is clipped independently of the button/charge rings; opaque source corners cannot escape. */
  private iconViewport(parent: Node, x: number, y: number, diameter: number): Node {
    const clip=N('heroIconViewport',parent,x,y,diameter,diameter);
    const mask=clip.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_ELLIPSE;mask.segments=96;
    return clip;
  }
  activateUltimate(index: number): void {
    const result = this.dir.tryCastUlt(index);
    if (result === 'locked' || result === 'blocked' || result === 'no-target') return;
    if (result === 'charging') this.dir.showTips('ult', index);
    else this.ults[index]?.energy?.release();
  }
  private skills: SkillUI[] = [];
  private hudNode!: Node;
  private banner!: Node;
  private bannerTxt!: Node;
  private newMobBtn!: Node;
  private fpsTxt!: Node;
  private speedTxt!: Node;
  private timeTxt!: Node;
  private lvTxt!: Node;
  private lastWave = '';
  private lastSec = -1;
  private lastLv = -1;
  private lastHp = '';
  private lastShield = '';
  // 经验条只平滑改变长度，增长时保持原色。
  private xpShown = 0;
  private xpTarget0 = 0;

  constructor(parent: Node, private dir: BattleDirector, bgParent?: Node) {
    this.build(parent, bgParent);
    this.sync(); // The entry reveal and prepare countdown must already show the actual keep values.
  }

  private build(parent: Node, bgParent?: Node): void {
    const top = new Node('HUD');
    top.setParent(parent);
    this.hudNode = top;
    // 顶栏簇避让刘海：notchTop 为真实顶部内缩（设计单位），桌面/无刘海=0 无副作用
    const nt = LO.notchTop;
    const WYN = (t: number, h = 0): number => WY(t + nt, h);

    /* 背景：战场底色（占位）——必须画在 Field 里（mobs 之前）；高度盖满可视区防黑边
       美术：scene_1_1 竖版战场（1152×2048 ≈ 9:16 视口，近零变形），加载成功后盖掉底色。
       cover:true 时 artSprite 返回的是 Mask 裁剪节点内部的 sprite，不能拿它排兄弟序；
       必须用 belowIdx 让加载回调把裁剪节点本身插到 Field 下标 1（底色之上、防线/怪/英雄之下），
       否则异步加载完成后 clip 落在 Field 末尾，整张不透明场景图盖住全部战场实体 */
    const bgFlat = gpanel(bgParent || top, 0, 0, 750, LO.half * 2 + 240, '#2E4034', undefined, 0, 0);
    bgFlat.setSiblingIndex(0);
    const sceneId = battleSceneKey(this.dir.battleSceneId);
    artSprite(bgParent || top, 0, 0, 750, LO.half * 2 + 240, sceneId,
      { sliced: false, cover: true, belowIdx: 1, hideOnLoad: [bgFlat] });

    /* 顶栏（用户调整：大背板整条去除，只留暂停钮/波次签半透小板，文字直接浮于场景） */
    // 暂停/倍速/统计（用户调整：去金环美术资源，与计时/关名胶囊同款半透底板 + 程序简约白图标）
    const pauseBtn = gpanel(top, WX(30, 60), WYN(24, 60), 60, 60, CA('#151C19', 0.58), undefined, 0, 14);
    const pico = new Node('pauseIco');   // 图标画在子节点：gpanel 自带 Graphics，同节点再加会渲染冲突
    pico.setParent(pauseBtn);
    const pg = pico.addComponent(Graphics);
    pg.fillColor = CA('#FFFFFF', 1);
    pg.roundRect(-9, -11, 7, 22, 2);
    pg.roundRect(2, -11, 7, 22, 2);
    pg.fill();
    bindButton(pauseBtn, () => this.dir.togglePause());
    // 计时/关名：半透小板（与暂停钮/波次签同款，用户调整）
    gpanel(top, WX(106, 110), WYN(32, 44), 110, 44, CA('#151C19', 0.58), undefined, 0, 22);
    this.timeTxt = label(top, WX(106, 110), WYN(32, 44), '00:00', { size: 24, color: '#FFF6DC', font: 'number', align: 'center', w: 110, h: 44 });
    gpanel(top, WX(230, 290), WYN(31, 48), 290, 48, CA('#151C19', 0.5), undefined, 0, 24);
    label(top, WX(230, 290), WYN(31, 48), this.dir.battleTitle, { size: 23, color: '#FFF3C7', font: 'title', w: 290, h: 48, shrink: true });
    gpanel(top, WX(560, 150), WYN(24, 60), 150, 60, CA('#151C19', 0.58), undefined, 0, 30);
    this.waveTxt = label(top, WX(560, 150), WYN(24, 60), this.dir.isEndless ? '第1层' : '波次 0/10', { size: 22, color: '#FFF3DC', bold: true, w: 140, h: 38, shrink: true });

    /* 经验条 + 无背板的居中等级文字，细描边保证战场上可读。 */
    this.xpBar = battleProgressBar(top, WX(30, 690), WYN(100, 12), 690, 12, 'xp');
    this.xpBar.set(0);
    this.lvTxt = label(top, WX(330, 90), WYN(91, 30), 'Lv.1', {
      size: 20, color: '#FFE08A', font: 'number', outline: '#17251D', outlineW: 2, w: 90, h: 30,
    });
    this.lvTxt.name = 'stageLevelText';

    /* Match the current paper/chrome art instead of the old translucent brown slab. */
    this.banner = comicPlate(top, WX(145, 460), WYN(142, 60), 460, 60, 'paper', { name: 'battleNoticeBanner', cut: 10 });
    artSprite(this.banner, 0, 0, 460, 60, 'pick_comic_v1/title_plate', {
      sliced: false, belowIdx: 0, onLoaded: () => this.banner.getComponent(Graphics)?.clear(),
    });
    this.bannerTxt = label(this.banner, 0, 0, '敌军来袭！', { size: 26, color: '#4A3214', font: 'title', bold: true, w: 386, h: 44, shrink: true });
    this.banner.active = false;

    // 左列：FPS / 倍速 / 伤害统计（FPS 与倍速按钮左缘对齐 = 设计 x24，需固定宽 + shrink 让 left 对齐生效）
    this.fpsTxt = label(top, WX(24, 120), WYN(124, 20), 'FPS:60', { size: 15, color: '#7EE787', align: 'left', w: 120, h: 20, shrink: true });
    this.fpsTxt.active = /[?&](perf|gm)=1(?:&|$)/.test(typeof location === 'undefined' ? '' : location.search);
    const speedBtn = gpanel(top, WX(24, 60), WYN(160, 60), 60, 60, CA('#151C19', 0.5), undefined, 0, 14);
    this.speedTxt = label(speedBtn, 0, 0, 'X1', { size: 18, color: '#FFFFFF', bold: true });
    bindButton(speedBtn, () => this.dir.toggleSpeed());
    const statsBtn = gpanel(top, WX(24, 60), WYN(240, 60), 60, 60, CA('#151C19', 0.5), undefined, 0, 14);
    const sico = new Node('statsIco');   // 同暂停钮：图标画在子节点
    sico.setParent(statsBtn);
    const sg = sico.addComponent(Graphics);
    sg.fillColor = CA('#FFFFFF', 1);
    sg.roundRect(-14, -11, 6, 10, 1);    // 三根底对齐白柱（简约柱状图标，用户反馈：别倒挂）
    sg.roundRect(-3, -11, 6, 16, 1);
    sg.roundRect(8, -11, 6, 22, 1);
    sg.fill();
    bindButton(statsBtn, () => this.dir.showStats(), { enabled: () => this.dir.canUseBattleHud });

    /* First-seen enemy notice uses the existing comic field-guide illustration. */
    this.newMobBtn = noticeBtn(top, WX(24, 60), WYN(480, 60), 64, () => this.dir.showNewMobIntro());
    this.newMobBtn.active = false;

    /* 右侧大招纵列：每英雄一钮，底基锚定向上叠放（线稿① 4×1 纵列右对齐）
       充能中：置灰遮罩盖图标 + 主色能量水上涨（2% 步进）；就绪：高亮 + 光晕呼吸 + 粒子环绕 */
    this.dir.heroes.forEach((h, i) => this.ults.push(this.buildUlt(top, i, h)));

    /* 防线：绿色耐久在内、蓝色盾量包在外；右上两行生命／护盾数值。 */
    const hpBottom = LINE_HP_BOTTOM;
    this.hpBar = battleProgressBar(top, 0, WYB(hpBottom, 18), 640, 18, 'health');
    this.hpBar.node.name = 'lineHealthBar';
    const valueY = WYB(hpBottom + 46, 24);
    this.hpVal = label(top, 320, valueY, '1000/1000', { size: 20, color: '#FFFFFF', font: 'number', outline: '#17251D', outlineW: 1.8, align: 'right' });
    this.hpVal.name = 'lineHealthValue';
    this.attachLineValueIcon(this.hpVal, 'heart');
    this.shieldNode = N('lineShield', top);
    this.shieldBar = battleShieldOutline(this.shieldNode, 0, WYB(hpBottom, 18), 640, 18);
    const shieldValueY = valueY - 23;
    this.shieldVal = label(this.shieldNode, 320, shieldValueY, '0', { size: 18, color: '#BCEFFF', font: 'number', outline: '#102A36', outlineW: 1.5, align: 'right' });
    this.shieldVal.name = 'lineShieldValue';
    this.attachLineValueIcon(this.shieldVal, 'shield');

    /* 英雄头顶 普攻/技能 图标（耐久条正下方，压墙顶，不遮挡耐久条；每英雄一套）
       技能 CD 中：灰化 + 扇形冷却遮罩 + 中心倒计时；就绪：高饱和 + 弹跳过渡 */
    this.dir.heroes.forEach((h, i) => this.skills.push(this.buildSkillBadge(top, i, h)));
  }

  /** 第 i 钮：上移避让生命／护盾两行数值，向上每钮 +110；从下到上 = 英雄位从左到右。点击就绪即施放，未满→Tips
   *  无边框规范：纯色圆板三态（充能灰/常态金/就绪亮金），不加座环美术
   *  充能表现（用户调整）：水位上涨——液面上灰罩/液面下英雄主色能量水（无白色分割线），中心只显示百分比；就绪亮金+光晕粒子、无文字 */
  private buildUlt(top: Node, i: number, hero: HeroBase): UltUI {
    const ux = WX(636, 90), uy = WYB(ULT_BOTTOM + i * ULT_STEP, 90);
    const root = new Node('heroUlt:' + hero.id);
    root.setParent(top); root.active = hero.ultUnlocked;
    // Scale the complete illustration around its own centre, including energy and percentage.
    const pressPivot = N('ultPressFace', root, ux, uy, 112, 112);
    top = N('ultContents', pressPivot, -ux, -uy);
    // 就绪特效/能量水按英雄主色（用户调整：火橘/雷紫，不再只分狙击蓝/其他绿）
    const ULT_FX: Record<string, [string, string, string]> = {
      arcane:['#528FE3','#9CD7FF','#F0FAFF'],
      lance:['#DCA329','#FFD958','#FFF9CE'],
      space:['#BB63D8','#DFA7F0','#FFF0FF'],
      sword:['#63D2A4','#B2E7CD','#FFF6D6'],
      wind: ['#55D8C3', '#9DE9D7', '#FFF9EC'],
      ninja: ['#4559A8', '#69DCEC', '#E2E8F0'],
      cannon: ['#D5A641', '#ECC66A', '#FFF0BF'],
      siphon: ['#963657', '#F06C9B', '#FFD2E3'],
      archer: [PAL.green, '#9FDB8C', '#D6F2C9'],
      sniper: [PAL.blue, '#8FC7F2', '#CFE9FB'],
      pyro: [PAL.orange, '#F2A05A', '#F8CFA0'],
      volt: ['#B96BFF', '#C89AF5', '#E3CCFA'],
      mora: ['#6FCFEA', '#A0DFF0', '#E4FAFF'],
    };
    const [color, fx, fxHi] = ULT_FX[hero.id] || ULT_FX.archer;
    const glow = gcircle(top, ux, uy, 56, CA(fx, 0.16));
    const glowOp = glow.addComponent(UIOpacity);
    glowOp.opacity = 130;
    glow.active = false;
    const btn = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.25));
    const bright = gcircle(top, ux, uy, 45, CA(fx, 0.42));
    bright.active = false;
    const gray = gcircle(top, ux, uy, 45, CA('#3A4250', 0.9));
    gray.active = false;   // 用户调整：图标占满钮面后不再整体置灰，灰罩只走未充能扇形
    // Fetch the actual face once; a portrait is needed only when that resource fails.
    const faceClip=this.iconViewport(top,ux,uy,90);
    const face = artSprite(faceClip, 0, 0, 92, 92, 'ui_icon_ult_' + hero.id, { sliced: false,
      onFailed: () => {
        if (!top.isValid || !face.isValid) return;
        const fallback = artSprite(faceClip, 0, 0, 92, 92, 'ui_avatar_' + hero.id, { sliced: false });
        fallback.setSiblingIndex(face.getSiblingIndex());
      },
    });
    // 旧整圆置灰罩已弃用（被未充能扇形替代），保留节点占位不再激活
    const mask = gcircle(top, ux, uy, 46, CA('#3A4250', 0.7));
    mask.active = false;
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
      og.fillColor = CA(k % 2 ? fxHi : fx, 0.95);
      og.circle(Math.cos(a) * rr, Math.sin(a) * rr, 2 + (k % 3) * 0.9);
      og.fill();
    }
    orbit.addComponent(UIOpacity);
    orbit.active = false;
    // 充能百分比：单行居中（用户调整：去掉"大招"前缀与"就绪"文案，就绪时整行隐藏）
    const chargeTxt = label(top, ux, uy, '0%', { size: 27, color: '#FFF7E8', font: 'number', w: 90, h: 38, outline: '#1D2632', outlineW: 2.2 });
    bindButton(btn, () => {
      this.activateUltimate(i);
    }, { visual: pressPivot, scale: .94, shift: 1,
      enabled: () => hero.ultUnlocked && this.dir.canUseBattleHud });
    const ui: UltUI = { root, baseY: uy, ux, uy, glow, btn, bright, gray, mask, color, fx, water, waterG, waterR: 46, orbit, chargeTxt, ready: null, shown: 0, flash: 0, lastChargeKey: -1, lastTarget: -1 };
    // All heroes share the charge, completion, ready and release animation.
    {
      // Keep all charge information inside the illustration, with no outer seat.
      const g = mask.getComponent(Graphics)!;
      g.clear();
      g.fillColor = CA('#102235', 0.7);
      g.circle(0, 0, 46);
      g.fill();
      mask.addComponent(UIOpacity);
      water.addComponent(UIOpacity);
      chargeTxt.addComponent(UIOpacity);
      ui.energy = new UltEnergyFx(top, ux, uy, hero.id === 'sniper' ? '#1F9EFF' : color);
    }
    return ui;
  }

  /** 初始只有居中普攻；学习技能后才展开为普攻/技能两个脚底图标。 */
  private buildSkillBadge(top: Node, i: number, hero: HeroBase): SkillUI {
    const cy = hero.node.position.y - 82;
    const atkX = hero.x - (hero.skillUnlocked ? 40 : 0), cx = hero.x + 40;
    const atkIcon = gcircle(top, atkX, cy, 28, CA(PAL.gold, 0.3));
    atkIcon.name = 'heroAtk:' + hero.id;
    const atkGlyph = label(atkIcon, 0, 0, '攻', { size: 18, color: PAL.gold, bold: true });
    // 普攻/技能图标（58 > 底板圆 56：美术圆完全盖住底板，杜绝露出黄/蓝边——用户反馈）
    artSprite(this.iconViewport(atkIcon,0,0,56), 0, 0, 58, 58, 'ui_icon_atk_' + hero.id, { sliced: false, hideOnLoad: [atkGlyph] });
    bindButton(atkIcon, () => this.dir.showTips('atk', i), { circle: true, enabled: () => this.dir.canUseBattleHud });
    const root = new Node('heroSkill:' + hero.id);
    root.setParent(top); root.active = hero.skillUnlocked;
    top = root;
    const icon = gcircle(top, cx, cy, 28, CA(PAL.blue, 0.3));
    icon.name = 'heroSkillIcon:' + hero.id;
    const glyph = label(icon, 0, 0, '技', { size: 18, color: PAL.blue, bold: true });
    // 技能图标（同上）
    artSprite(this.iconViewport(icon,0,0,56), 0, 0, 58, 58, 'ui_icon_skill_' + hero.id, { sliced: false, hideOnLoad: [glyph] });
    bindButton(icon, () => this.dir.showTips('skill', i), { circle: true, enabled: () => this.dir.canUseBattleHud });
    const gray = gcircle(top, cx, cy, 28, CA('#3A4250', 0.55));   // 冷却遮罩（用户调整：半透明，隐约透出技能图标）
    gray.active = false;
    const pie = new Node('skillPie' + i);
    pie.setParent(top);
    pie.setPosition(cx, cy, 0);
    const pieG = pie.addComponent(Graphics);
    pie.active = false;
    const cdTxt = label(top, cx, cy, '', { size: 19, color: '#FFF7E8', font: 'number', w: 56, h: 28, outline: '#1D2632', outlineW: 1.8 });
    cdTxt.active = false;
    const energy = new UltEnergyFx(root, cx, cy, HERO_ENERGY_COLOR[hero.id] || PAL.blue, 56);
    return { root, atkIcon, unlocked: hero.skillUnlocked, cx, cy, icon, glyph, gray, pie, pieG, cdTxt,
      cooling: null, lastCdKey: -1, energy, lastCastSerial: hero.skillCastSerial };
  }

  setWave(cur: number, total: number): void {
    const t = this.dir.isEndless ? '第' + this.dir.endlessFloor + '层' : '波次 ' + cur + '/' + total;
    if (t !== this.lastWave) { setText(this.waveTxt, t); this.lastWave = t; }
  }

  setFps(n: number): void {
    setText(this.fpsTxt, 'FPS:' + n);
  }

  setSpeed(s: 1 | 1.5): void {
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

  /** 新怪通知钮显隐（有未查看的新怪种时亮出） */
  showNewMob(v: boolean): void { this.newMobBtn.active = v; }

  /** Monster discovery uses the same modal paper and title as shop/hero details. */
  showMobIntro(id: string, onOk: () => void): void {
    const c = CODEX.find(x => x.id === id);
    if (!c) { onOk(); return; }
    const H = 460;
    const dim = gpanel(this.hudNode, 0, 0, 750, LO.half * 2 + 240, CA('#000000', 0.55), undefined, 0, 0);
    dim.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: boolean };
      if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;  // 挡住战斗 UI 误触
    });
    const card = comicPlate(dim, 0, -40, 640, H, 'paper', { name: 'newEnemyCommonPanel' });
    detailSkin(card, 640, H, '新敌人');
    // The common title sits inside the paper; leave its lower edge clear.
    const content = N('newEnemyContent', card, 0, -16);
    const iconPlate = gpanel(content, -195, 40, 170, 170, '#E3EAD8', undefined, 0, 12);
    // Same keyed monster artwork and proportional fit as the research codex.
    const image = enemyArtRef(c.id, true);
    const portrait = artAtlasSprite(iconPlate, 0, 0, 150, 150,
      image.atlas, image.frame);
    portrait.name = 'newEnemyPortrait:' + c.id;
    label(content, 50, 150, c.name, { size: 30, color: '#4A3214', bold: true, align: 'left', w: 300, h: 40 });
    label(content, 65, 92, c.desc, { size: 18, color: '#4A3214', w: 330, h: 64, shrink: true });
    c.traits.forEach((t, i) =>
      label(content, 65, 40 - i * 30, '- ' + t, { size: 18, color: '#B03A2E', bold: true, align: 'left', w: 330, h: 28 }));
    let closed = false;
    comicButton(dim, 170, -40 - H / 2 + 64, 200, 64, '好的！', () => {
      if (closed) return;
      closed = true; dim.active = false; dim.destroy(); onOk();
    }, { tone: 'gold', size: 26, name: 'newEnemyConfirm', sound: 'confirm' });
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
    // 等级文字保持原位置，无独立背板。
    const levelChanged = d.heroLevel !== this.lastLv;
    if (levelChanged) {
      this.lastLv = d.heroLevel;
      setText(this.lvTxt, 'Lv.' + d.heroLevel);
    }
    // 经验：固定青蓝色平滑上涨，升级直接交接剩余经验，避免倒退和变白。
    const need = expNeed(d.heroLevel);
    const xpTarget = Math.min(1, d.xp / need);
    if (levelChanged || xpTarget < this.xpShown - 0.25) this.xpShown = xpTarget;
    this.xpShown += (xpTarget - this.xpShown) * Math.min(1, dt * (xpTarget > this.xpShown ? 6 : 4));
    if (Math.abs(xpTarget - this.xpShown) < 0.0015) this.xpShown = xpTarget;
    if (this.xpShown !== this.xpTarget0) {
      this.xpBar.set(this.xpShown);
      this.xpTarget0 = this.xpShown;
    }
    // 耐久 + 盾
    const hpKey = Math.ceil(d.line.hp) + '/' + Math.round(d.line.maxHp);
    if (hpKey !== this.lastHp) {
      this.lastHp = hpKey;
      this.hpBar.set(d.line.ratio, d.line.lowRatio ? '#E64D45' : '#2ACB1D');
      setText(this.hpVal, hpKey);
    }
    const shieldKey = d.line.shield + '/' + d.line.maxHp;
    if (shieldKey !== this.lastShield) {
      this.lastShield = shieldKey;
      this.redrawShield(d.line.shield);
    }
    // 每英雄：大招充能/就绪 + 技能CD
    let ultSlot = 0;
    d.heroes.forEach((h, i) => {
      const ult = this.ults[i];
      ult.root.active = h.ultUnlocked;
      if (h.ultUnlocked) {
        const uy = WYB(ULT_BOTTOM + ultSlot++ * ULT_STEP, 90);
        if (ult.uy !== uy) { ult.uy = uy; ult.root.setPosition(0, uy - ult.baseY, 0); }
        this.syncUlt(h, ult, dt);
      }
      this.syncSkillCd(h, this.skills[i], dt);
    });
  }

  /* ---------- 大招图标：水杯充能 / 就绪光效（每英雄） ---------- */

  private syncUlt(hero: HeroBase, u: UltUI, dt: number): void {
    if (!u) return;
    if (u.energy?.loaded) {
      if (!u.energyActive) {
        u.energyActive = true;
        u.lastChargeKey = -1;
        Tween.stopAllByTarget(u.btn);
        Tween.stopAllByTarget(u.glow.getComponent(UIOpacity)!);
        Tween.stopAllByTarget(u.orbit);
        u.btn.setScale(1, 1, 1);
      }
      u.energy.sync(dt, hero.chargePct, hero.ultReady);
      u.glow.active = u.bright.active = u.orbit.active = false;
      u.water.active = false;
      u.mask.active = !hero.ultReady;
      const visibility = u.energy.chargeVisibility;
      u.mask.getComponent(UIOpacity)!.opacity = Math.round(255 * visibility);
      u.water.getComponent(UIOpacity)!.opacity = Math.round(255 * visibility);
      u.chargeTxt.getComponent(UIOpacity)!.opacity = Math.round(255 * visibility);
      u.chargeTxt.active = !hero.ultReady && visibility > 0;
    }
    const ready = hero.ultReady;
    if (ready !== u.ready) {
      u.ready = ready;
      this.applyUltReady(u, ready);
    }
    if (!ready) {
      // 水位平滑上涨，百分比与水位同步（用户调整：只显示居中百分比）
      const cp = Math.max(0, Math.min(1, hero.chargePct));
      u.shown += (cp - u.shown) * Math.min(1, dt * 5);
      if (Math.abs(cp - u.shown) < 0.002) u.shown = cp;
      // A full reservoir may briefly wait for its own previous cast; never label it 99%.
      const full = cp >= 1;
      const key = full ? 101 : Math.round(u.shown * 100);
      if (key !== u.lastChargeKey) {
        u.lastChargeKey = key;
        if (u.energyActive) this.redrawUltEnergyCharge(u, u.shown);
        else this.redrawUltWater(u, u.shown);
        setText(u.chargeTxt, full ? '施放中' : Math.min(99, Math.round(u.shown * 100)) + '%');
      }
    }
  }

  /** 遮罩随蓄能减轻，仅显示百分比。 */
  private redrawUltEnergyCharge(u: UltUI, pct: number): void {
    const maskG = u.mask.getComponent(Graphics)!;
    maskG.clear();
    maskG.fillColor = CA('#102235', 0.7 - pct * 0.32);
    maskG.circle(0, 0, 46);
    maskG.fill();
    const g = u.waterG;
    g.clear();
  }

  /** 水杯充能（用户反馈：保留水位上涨效果，只去掉白色液面分割线）
   *  异步特效未就绪时也沿用深色充能罩，避免入场先出现旧版灰白遮罩。 */
  private redrawUltWater(u: UltUI, pct: number): void {
    const g = u.waterG;
    g.clear();
    const R = u.waterR;
    if (pct >= 0.995) {
      g.fillColor = CA(u.color, 0.18);   // 用户调整：能量水透明度
      g.circle(0, 0, R);
      g.fill();
      return;
    }
    if (pct <= 0.004) {
      g.fillColor = CA('#102235', 0.7 - pct * 0.32);
      g.circle(0, 0, R);
      g.fill();
      return;
    }
    const yc = -R + 2 * R * pct;
    const a = Math.asin(Math.max(-1, Math.min(1, yc / R)));
    const steps = 28;
    // Match the loaded energy effect's dimming while its material is still loading.
    g.fillColor = CA('#102235', 0.7 - pct * 0.32);
    g.moveTo(R * Math.cos(a), yc);
    g.lineTo(-R * Math.cos(a), yc);
    for (let i = 0; i <= steps; i++) {
      const th = Math.PI - a - ((Math.PI - 2 * a) * i) / steps;
      g.lineTo(R * Math.cos(th), R * Math.sin(th));
    }
    g.close();
    g.fill();
    // 液面以下：能量水（弦 + 下弧采样，避免 arc 方向歧义）
    g.fillColor = CA(u.color, 0.18);
    g.moveTo(R * Math.cos(a), yc);
    g.lineTo(-R * Math.cos(a), yc);
    const thA = Math.PI - a, thB = Math.PI * 2 + a;
    for (let i = 0; i <= steps; i++) {
      const th = thA + ((thB - thA) * i) / steps;
      g.lineTo(R * Math.cos(th), R * Math.sin(th));
    }
    g.close();
    g.fill();
  }

  /** 充能→就绪 状态切换：进度灰罩 ↔ 高亮 + 光晕呼吸 + 粒子环绕（就绪时隐藏百分比，不显示"就绪"文案） */
  private applyUltReady(u: UltUI, ready: boolean): void {
    u.water.active = !ready;
    if (u.energy?.loaded) {
      u.water.active = false;
      u.mask.active = !ready;
      u.bright.active = u.glow.active = u.orbit.active = false;
      u.chargeTxt.active = !ready && u.energy.chargeVisibility > 0;
      u.lastChargeKey = -1;
      if (!ready) { u.shown = 0; setText(u.chargeTxt, '0%'); }
      return;
    }
    u.bright.active = ready;
    if (!ready) {
      u.lastChargeKey = -1;
      u.shown = 0;
      u.lastTarget = -1;
      u.chargeTxt.active = true;
      setText(u.chargeTxt, '0%');
      Tween.stopAllByTarget(u.btn);
      Tween.stopAllByTarget(u.glow);
      Tween.stopAllByTarget(u.orbit);
      u.btn.setScale(1, 1, 1);
      u.glow.active = false;
      u.orbit.active = false;
      return;
    }
    u.chargeTxt.active = false;
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
    bg.strokeColor = CA(u.fx, 0.9);
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

  private syncSkillCd(hero: HeroBase, s: SkillUI, dt: number): void {
    if (!s) return;
    if (s.unlocked !== hero.skillUnlocked) {
      s.unlocked = hero.skillUnlocked;
      s.root.active = s.unlocked;
      s.atkIcon.setPosition(hero.x - (s.unlocked ? 40 : 0), s.cy, 0);
      s.cooling = null; s.lastCdKey = -1;
    }
    if (!s.unlocked) return;
    const cdLeft = Math.max(0, hero.skillCd);
    const cooling = cdLeft > 0;
    const cast = s.lastCastSerial !== hero.skillCastSerial;
    s.lastCastSerial = hero.skillCastSerial;
    if (cast) {
      s.energy.release();
      this.pulseSkillIcon(s, true);
    }
    s.energy.sync(dt, hero.skillPct, !cooling);
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
        this.redrawSkillPie(s, cdLeft / hero.skillCdTotal);
      }
    }
  }

  /** 扇形冷却遮罩（用户校准：像时钟——时针固定在12点，分针顺时针转一圈）
   *  亮区=分针已扫过的 12点→分针（顺时针生长）；暗遮罩=分针→12点 的未恢复区，随 CD 恢复收缩。
   *  显式采样画扇形（不用引擎 arc，规避方向语义歧义） */
  private redrawSkillPie(s: SkillUI, f: number): void {
    const g = s.pieG;
    g.clear();
    if (f <= 0.004) return;
    g.fillColor = CA('#C6CBD3', 0.62);   // 与大招遮罩同款灰白（用户调整）
    if (f >= 0.996) {
      g.circle(0, 0, 27);
      g.fill();
      return;
    }
    const hand = Math.PI / 2 - (1 - f) * Math.PI * 2;   // 分针角：12点起顺时针扫过 (1-f)·360°
    const R = 27, steps = 40;
    g.moveTo(0, 0);
    g.lineTo(R * Math.cos(hand), R * Math.sin(hand));
    for (let i = 1; i <= steps; i++) {                  // 从分针继续顺时针采样回 12点
      const th = hand - (f * Math.PI * 2 * i) / steps;
      g.lineTo(R * Math.cos(th), R * Math.sin(th));
    }
    g.close();
    g.fill();
  }

  private applySkillCooling(s: SkillUI, cooling: boolean, first: boolean): void {
    s.gray.active = cooling;
    s.pie.active = cooling;
    s.cdTxt.active = cooling;
    // The artwork loader owns the fallback glyph; readiness must not reveal it over a loaded icon.
    s.lastCdKey = -1;
    if (!cooling && !first && s.energy.loaded) this.pulseSkillIcon(s, false);
    if (!cooling && !first && !s.energy.loaded) {
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

  /** A brief compression/rebound confirms actual use; completion gets a lighter pop. */
  private pulseSkillIcon(s: SkillUI, cast: boolean): void {
    Tween.stopAllByTarget(s.icon);
    s.icon.setScale(1, 1, 1);
    if (cast) tween(s.icon).to(.07, { scale: new Vec3(.87, .87, 1) })
      .to(.12, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'quadOut' })
      .to(.16, { scale: new Vec3(1, 1, 1) }).start();
    else tween(s.icon).to(.15, { scale: new Vec3(1.16, 1.16, 1) }, { easing: 'backOut' })
      .to(.16, { scale: new Vec3(1, 1, 1) }).start();
  }

  /** Follow measured glyph width, including asynchronous font installation and digit changes. */
  private attachLineValueIcon(value: Node, kind: 'heart' | 'shield'): void {
    const ui = value.getComponent(UITransform)!, text = value.getComponent(Label)!;
    ui.setAnchorPoint(1, .5);
    text.enableWrapText = false;
    const icon = battleStatusIcon(value, 0, 0, kind);
    const align = (): void => { icon.setPosition(-ui.width - 16, 0, 0); };
    value.on(Node.EventType.SIZE_CHANGED, align);
    text.updateRenderData(true);
    align();
  }

  /** 盾量/耐久上限决定右侧外层蓝框的长度；零盾只隐藏蓝框，数值保留 0。 */
  private redrawShield(shield: number): void {
    this.shieldBar.set(shield / Math.max(1, this.dir.line.maxHp));
    setText(this.shieldVal, String(Math.max(0, Math.ceil(shield))));
  }
}
