/**
 * 战斗 HUD（UX 线稿 ①）：顶栏(暂停/关卡名/波次) + 经验条(Lv骑条居中) + 预警横幅
 * + 左列(倍速/统计/FPS) + 右侧大招纵列 + 防线耐久条(盾值胶囊/百分比) + 头顶普攻技能图标(CD环)
 * 点击普攻/技能/未充满大招图标 → 属性Tips（§3.11）
 */
import { Graphics, Label, Layers, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { expNeed, LO, PAL } from '../config/GameConfig';
import { gbar, gcircle, gpanel, label, setText, WY, WYB, WX, Bar, CA } from './UIKit';
import { BattleDirector } from '../battle/BattleDirector';

export class HUD {
  private waveTxt!: Node;
  private xpBar!: Bar;
  private hpBar!: Bar;
  private hpVal!: Node;
  private pctTxt!: Node;
  private shieldNode!: Node;
  private shieldG!: Graphics;
  private shieldVal!: Node;
  private chargeTxt!: Node;
  private ultBtn!: Node;
  private ultGlow!: Node;       // 就绪光晕（呼吸）
  private ultBright!: Node;     // 就绪增亮层
  private ultGray!: Node;       // 充能中灰化杯体
  private ultWater!: Node;      // 金水（圆杯液面上涨）
  private ultWaterG!: Graphics;
  private ultOrbit!: Node;      // 就绪环绕粒子
  private skillIcon!: Node;
  private skillGlyph!: Node;
  private skillGray!: Node;     // CD 中灰化
  private skillPie!: Node;      // 扇形冷却遮罩
  private skillPieG!: Graphics;
  private skillCdTxt!: Node;    // 中心倒计时
  private hudNode!: Node;
  private ux = 0; private uy = 0;
  private scx = 0; private scy = 0;
  private banner!: Node;
  private bannerTxt!: Node;
  private fpsTxt!: Node;
  private speedTxt!: Node;
  private timeTxt!: Node;
  private lastWave = '';
  private lastSec = -1;
  private lastHp = -1;
  private lastShield = -1;
  private lastXp = -1;
  private lastReady = false;
  private lastChargeKey = -1;
  private skillCooling: boolean | null = null;
  private lastCdKey = -1;

  constructor(parent: Node, private dir: BattleDirector, bgParent?: Node) {
    this.build(parent, bgParent);
  }

  private build(parent: Node, bgParent?: Node): void {
    const top = new Node('HUD');
    top.setParent(parent);
    this.hudNode = top;

    /* 背景：战场底色（占位）——必须画在 Field 里（mobs 之前）；高度盖满可视区防黑边 */
    gpanel(bgParent || top, 0, 0, 750, LO.half * 2 + 240, '#2E4034', undefined, 0, 0).setSiblingIndex(0);

    /* 顶栏 */
    gpanel(top, 0, WY(100, 70), 718, 70, CA('#14181E', 0.72), CA(PAL.gold, 0.9), 1.5, 10);
    const pauseBtn = gpanel(top, WX(30, 60), WY(105, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    label(pauseBtn, 0, 0, '⏸', { size: 26, color: PAL.gold, bold: true });
    pauseBtn.on(Node.EventType.TOUCH_END, () => this.dir.togglePause());
    // 关卡计时（线稿①：暂停键右侧 00:36）
    this.timeTxt = label(top, WX(110, 140), WY(114, 40), '00:00', { size: 16, color: '#CDC2A2', align: 'left', w: 140, h: 40 });
    label(top, 0, WY(110, 50), this.dir.levelDef.id + ' ' + this.dir.levelDef.name, { size: 22, color: PAL.parch, bold: true, w: 400, h: 50 });
    gpanel(top, WX(560, 150), WY(105, 60), 150, 60, CA('#FFFFFF', 0.08), CA('#FFFFFF', 0.27), 1.5, 30);
    this.waveTxt = label(top, WX(560, 150), WY(105, 60), '波次 0/10', { size: 20, color: '#FFFFFF', bold: true });

    /* 经验条（用户确认：去掉屏幕中央的 Lv 标签） */
    this.xpBar = gbar(top, WX(30, 690), WY(176, 12), 690, 14, PAL.blue);

    /* 预警横幅 */
    this.banner = gpanel(top, WX(115, 520), WY(226, 72), 520, 72, CA(PAL.gold, 0.22), PAL.gold, 2, 12);
    this.bannerTxt = label(this.banner, 0, 0, '敌军来袭！', { size: 28, color: PAL.gold, bold: true });
    this.banner.active = false;

    /* 左列：FPS / 倍速 / 伤害统计 */
    this.fpsTxt = label(top, WX(24, 120), WY(210, 30), 'FPS:60', { size: 15, color: '#7EE787', align: 'left' });
    const speedBtn = gpanel(top, WX(24, 60), WY(240, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    this.speedTxt = label(speedBtn, 0, 0, 'X1', { size: 20, color: PAL.gold, bold: true });
    speedBtn.on(Node.EventType.TOUCH_END, () => this.dir.toggleSpeed());
    const statsBtn = gpanel(top, WX(24, 60), WY(320, 60), 60, 60, CA(PAL.gold, 0.2), PAL.gold, 2, 12);
    label(statsBtn, 0, 0, '📊', { size: 24 });
    statsBtn.on(Node.EventType.TOUCH_END, () => this.dir.showStats());

    /* 右侧大招按钮（4×1 纵列右对齐、底基锚定；M0 单英雄=第1钮）
       充能中：灰化杯体 + 金水上涨（2% 步进）；就绪：高亮 + 光晕呼吸 + 粒子环绕 */
    const ux = WX(636, 90), uy = WYB(504, 90);
    this.ux = ux; this.uy = uy;
    this.ultGlow = gcircle(top, ux, uy, 56, CA(PAL.gold, 0.16));
    const glowOp = this.ultGlow.addComponent(UIOpacity);
    glowOp.opacity = 130;
    this.ultGlow.active = false;
    this.ultBtn = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.25), PAL.gold, 2.5);
    this.ultBright = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.42));
    this.ultBright.active = false;
    this.ultGray = gcircle(top, ux, uy, 45, CA('#3A4250', 0.9), '#77808E', 1.5);
    this.ultWater = new Node('ultWater');
    this.ultWater.setParent(top);
    this.ultWater.setPosition(ux, uy, 0);
    this.ultWaterG = this.ultWater.addComponent(Graphics);
    this.ultOrbit = new Node('ultOrbit');
    this.ultOrbit.setParent(top);
    this.ultOrbit.setPosition(ux, uy, 0);
    const og = this.ultOrbit.addComponent(Graphics);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = 54 + (i % 3) * 5;
      og.fillColor = CA(i % 2 ? '#FFE08A' : PAL.gold, 0.95);
      og.circle(Math.cos(a) * rr, Math.sin(a) * rr, 2 + (i % 3) * 0.9);
      og.fill();
    }
    this.ultOrbit.addComponent(UIOpacity);
    this.ultOrbit.active = false;
    this.chargeTxt = label(top, ux, uy, '大招\n0%', { size: 18, color: '#FFFFFF', bold: true, w: 90, h: 50 });
    this.ultBtn.on(Node.EventType.TOUCH_END, () => {
      if (this.dir.tryCastUlt() === 'charging') this.dir.showTips('ult');
    });

    /* 防线耐久条（贴屏底、在墙上方）：条内居中耐久值 + 盾值胶囊(右→左) + 右侧百分比 */
    this.hpBar = gbar(top, WX(55, 640), WYB(176, 20), 640, 22, PAL.green);
    this.hpVal = label(top, WX(55, 640), WYB(176, 20), '1000/1000', { size: 15, color: '#FFFFFF', bold: true });
    this.shieldNode = new Node('shield');
    this.shieldNode.setParent(top);
    this.shieldNode.setPosition(0, WYB(176, 24), 0);
    this.shieldG = this.shieldNode.addComponent(Graphics);
    this.shieldVal = label(this.shieldNode, 0, 0, '100', { size: 14, color: '#FFFFFF', bold: true });
    this.shieldNode.active = false;
    this.pctTxt = label(top, WX(698, 48), WYB(176, 24), '100%', { size: 16, color: '#9FE08A', bold: true });

    /* 英雄头顶 普攻/技能 图标（耐久条正下方，压墙顶，不遮挡耐久条）
       技能 CD 中：灰化 + 扇形冷却遮罩 + 中心倒计时；就绪：高饱和 + 弹跳过渡 */
    const heroX = this.dir.hero.x;
    this.scx = heroX + 27; this.scy = WYB(126, 46);
    const atkIcon = gcircle(top, heroX - 27, this.scy, 23, CA(PAL.gold, 0.3), PAL.gold, 2);
    label(atkIcon, 0, 0, '攻', { size: 18, color: PAL.gold, bold: true });
    atkIcon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('atk'));
    this.skillIcon = gcircle(top, this.scx, this.scy, 23, CA(PAL.blue, 0.3), PAL.blue, 2);
    this.skillGlyph = label(this.skillIcon, 0, 0, '技', { size: 18, color: PAL.blue, bold: true });
    this.skillIcon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('skill'));
    this.skillGray = gcircle(top, this.scx, this.scy, 23, CA('#3A4250', 0.9), '#77808E', 1.5);
    this.skillGray.active = false;
    this.skillPie = new Node('skillPie');
    this.skillPie.setParent(top);
    this.skillPie.setPosition(this.scx, this.scy, 0);
    this.skillPieG = this.skillPie.addComponent(Graphics);
    this.skillPie.active = false;
    this.skillCdTxt = label(top, this.scx, this.scy, '', { size: 13, color: '#FFFFFF', bold: true, w: 48, h: 20 });
    this.skillCdTxt.active = false;
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

  /** 每帧轮询（只在值变化时重绘） */
  sync(): void {
    const d = this.dir;
    // 关卡计时（整秒变化才重排 Label）
    const sec = Math.floor(d.elapsed);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      setText(this.timeTxt, String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'));
    }
    // 经验
    const need = expNeed(d.heroLevel);
    const xpPct = Math.min(1, d.xp / need);
    const xpKey = Math.floor(xpPct * 100) * 1000 + d.heroLevel;
    if (xpKey !== this.lastXp) {
      this.lastXp = xpKey;
      this.xpBar.set(xpPct);
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
    // 大招充能/就绪（水杯填充 → 就绪光效过渡）
    const ready = d.hero.ultReady;
    if (ready !== this.lastReady) {
      this.lastReady = ready;
      this.applyUltReady(ready);
    }
    if (!ready) {
      // 2% 步进重绘：金水液面上涨，整圈最多 50 次 Graphics 重建
      const cp = d.hero.chargePct;
      const key = Math.round(cp * 50);
      if (key !== this.lastChargeKey) {
        this.lastChargeKey = key;
        this.redrawUltWater(cp);
        setText(this.chargeTxt, '大招\n' + Math.round(cp * 100) + '%');
      }
    }
    // 技能CD（灰化 + 扇形遮罩 + 中心倒计时）
    const cdLeft = Math.max(0, d.hero.skillCd);
    const cooling = cdLeft > 0.05;
    if (cooling !== this.skillCooling) {
      const first = this.skillCooling === null;
      this.skillCooling = cooling;
      this.applySkillCooling(cooling, first);
    }
    if (cooling) {
      const key = Math.floor(cdLeft * 10);   // 0.1s 步进：遮罩重绘 + 倒计时跳动一致
      if (key !== this.lastCdKey) {
        this.lastCdKey = key;
        setText(this.skillCdTxt, cdLeft.toFixed(1) + 's');
        this.redrawSkillPie(cdLeft / d.hero.skillMax);
      }
    }
  }

  /* ---------- 大招图标：水杯充能 / 就绪光效 ---------- */

  /** 金水上涨：圆杯内液面以下的圆缺面（弦 + 下弧采样，避免 arc 方向歧义） */
  private redrawUltWater(pct: number): void {
    const g = this.ultWaterG;
    g.clear();
    if (pct <= 0.01) return;
    const R = 43;
    if (pct >= 0.995) {
      g.fillColor = CA(PAL.gold, 0.9);
      g.circle(0, 0, R);
      g.fill();
      return;
    }
    const yc = -R + 2 * R * pct;
    const a = Math.asin(Math.max(-1, Math.min(1, yc / R)));
    const xr = R * Math.cos(a);
    g.fillColor = CA(PAL.gold, 0.88);
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
    g.strokeColor = CA('#FFE08A', 0.95);   // 水面高光
    g.lineWidth = 2.5;
    g.moveTo(-xr + 4, yc);
    g.lineTo(xr - 4, yc);
    g.stroke();
  }

  /** 充能→就绪 状态切换：图标弹跳 + 冲击扩散环 + 光晕呼吸 + 粒子环绕 */
  private applyUltReady(ready: boolean): void {
    this.ultGray.active = !ready;
    this.ultWater.active = !ready;
    this.ultBright.active = ready;
    if (!ready) {
      this.lastChargeKey = -1;
      setText(this.chargeTxt, '大招\n0%');
      Tween.stopAllByTarget(this.ultBtn);
      Tween.stopAllByTarget(this.ultGlow);
      Tween.stopAllByTarget(this.ultOrbit);
      this.ultBtn.setScale(1, 1, 1);
      this.ultGlow.active = false;
      this.ultOrbit.active = false;
      return;
    }
    setText(this.chargeTxt, '大招\n就绪');
    this.ultGlow.active = true;
    this.ultOrbit.active = true;
    // 一次性过渡：弹跳 + 扩散环
    Tween.stopAllByTarget(this.ultBtn);
    this.ultBtn.setScale(1, 1, 1);
    tween(this.ultBtn)
      .to(0.18, { scale: new Vec3(1.22, 1.22, 1) }, { easing: 'backOut' })
      .to(0.16, { scale: new Vec3(1, 1, 1) })
      .start();
    const burst = new Node('ultBurst');
    burst.layer = Layers.Enum.UI_2D;
    burst.setParent(this.hudNode);
    burst.setPosition(this.ux, this.uy, 0);
    const bg = burst.addComponent(Graphics);
    bg.strokeColor = CA(PAL.gold, 0.9);
    bg.lineWidth = 4;
    bg.circle(0, 0, 45);
    bg.stroke();
    const bop = burst.addComponent(UIOpacity);
    tween(burst).to(0.42, { scale: new Vec3(1.55, 1.55, 1) }).start();
    tween(bop).to(0.42, { opacity: 0 }).call(() => burst.destroy()).start();
    // 持续：光晕呼吸 + 粒子逆时针环绕
    const gop = this.ultGlow.getComponent(UIOpacity)!;
    Tween.stopAllByTarget(gop);
    tween(gop).repeatForever(tween(gop).to(0.9, { opacity: 225 }).to(0.9, { opacity: 130 })).start();
    Tween.stopAllByTarget(this.ultOrbit);
    tween(this.ultOrbit).repeatForever(tween(this.ultOrbit).by(4.5, { angle: -360 })).start();
  }

  /* ---------- 技能图标：CD 遮罩 / 就绪过渡 ---------- */

  /** 扇形冷却遮罩：覆盖剩余 CD 比例，指针从 12 点顺时针扫过（随 CD 流逝遮罩收缩） */
  private redrawSkillPie(f: number): void {
    const g = this.skillPieG;
    g.clear();
    if (f <= 0.004) return;
    g.fillColor = CA('#0B0F16', 0.62);
    if (f >= 0.996) {
      g.circle(0, 0, 22);
      g.fill();
      return;
    }
    g.moveTo(0, 0);
    g.arc(0, 0, 22, Math.PI / 2, Math.PI / 2 + f * Math.PI * 2, false);
    g.close();
    g.fill();
  }

  private applySkillCooling(cooling: boolean, first: boolean): void {
    this.skillGray.active = cooling;
    this.skillPie.active = cooling;
    this.skillCdTxt.active = cooling;
    this.skillGlyph.active = !cooling;
    this.lastCdKey = -1;
    if (!cooling && !first) {
      // 就绪过渡：弹跳 + 扩散环
      Tween.stopAllByTarget(this.skillIcon);
      this.skillIcon.setScale(1, 1, 1);
      tween(this.skillIcon)
        .to(0.15, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'backOut' })
        .to(0.13, { scale: new Vec3(1, 1, 1) })
        .start();
      const burst = new Node('skillBurst');
      burst.layer = Layers.Enum.UI_2D;
      burst.setParent(this.hudNode);
      burst.setPosition(this.scx, this.scy, 0);
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

  /** 盾值胶囊：从耐久条右端向左覆盖，宽度=盾值/耐久上限（§3.11） */
  private redrawShield(shield: number): void {
    const g = this.shieldG;
    g.clear();
    if (shield <= 0) { this.shieldNode.active = false; return; }
    this.shieldNode.active = true;
    const barW = 640, barH = 24;
    const w = Math.max(40, Math.min(barW - 4, (shield / this.dir.line.maxHp) * barW));
    g.fillColor = CA(PAL.blue, 0.55);
    g.roundRect(-w / 2, -barH / 2, w, barH, barH / 2);
    g.fill();
    // 耐久条右端(画布 x=27.5+320=347.5) 向左收
    this.shieldNode.setPosition(347.5 - 2 - w / 2, WYB(176, 24), 0);
    setText(this.shieldVal, String(shield));
  }
}
