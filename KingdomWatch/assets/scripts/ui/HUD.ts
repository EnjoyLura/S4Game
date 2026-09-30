/**
 * 战斗 HUD（UX 线稿 ①）：顶栏(暂停/关卡名/波次) + 经验条(Lv骑条居中) + 预警横幅
 * + 左列(倍速/统计/FPS) + 右侧大招纵列 + 防线耐久条(盾值胶囊/百分比) + 头顶普攻技能图标(CD环)
 * 点击普攻/技能/未充满大招图标 → 属性Tips（§3.11）
 */
import { Graphics, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { expNeed, LO, PAL } from '../config/GameConfig';
import { gbar, gcircle, gpanel, gring, label, setText, WY, WYB, WX, Bar, Ring, CA } from './UIKit';
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
  private chargeRing!: Ring;
  private chargeTxt!: Node;
  private ultBtn!: Node;
  private skillRing!: Ring;
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
  private lastSkillKey = -1;

  constructor(parent: Node, private dir: BattleDirector, bgParent?: Node) {
    this.build(parent, bgParent);
  }

  private build(parent: Node, bgParent?: Node): void {
    const top = new Node('HUD');
    top.setParent(parent);

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

    /* 右侧大招按钮（4×1 纵列右对齐、底基锚定；M0 单英雄=第1钮） */
    const ux = WX(636, 90), uy = WYB(504, 90);
    this.ultBtn = gcircle(top, ux, uy, 45, CA(PAL.gold, 0.25), PAL.gold, 2.5);
    this.chargeTxt = label(this.ultBtn, 0, 0, '大招\n0%', { size: 18, color: '#FFFFFF', bold: true });
    this.chargeRing = gring(top, ux, uy, 45, CA('#FFFFFF', 0.2));
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

    /* 英雄头顶 普攻/技能 图标（耐久条正下方，压墙顶，不遮挡耐久条） */
    const heroX = this.dir.hero.x;
    const atkIcon = gcircle(top, heroX - 27, WYB(126, 46), 23, CA(PAL.gold, 0.3), PAL.gold, 2);
    label(atkIcon, 0, 0, '攻', { size: 18, color: PAL.gold, bold: true });
    atkIcon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('atk'));
    const skillIcon = gcircle(top, heroX + 27, WYB(126, 46), 23, CA(PAL.blue, 0.3), PAL.blue, 2);
    label(skillIcon, 0, 0, '技', { size: 18, color: PAL.blue, bold: true });
    this.skillRing = gring(top, heroX + 27, WYB(126, 46), 23, CA('#FFFFFF', 0.13));
    skillIcon.on(Node.EventType.TOUCH_END, () => this.dir.showTips('skill'));
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
    // 大招充能
    const ready = d.hero.ultReady;
    if (ready !== this.lastReady) {
      this.lastReady = ready;
      if (ready) {
        this.lastChargeKey = 50;
        this.chargeRing.set(1, PAL.gold);
        Tween.stopAllByTarget(this.ultBtn);
        tween(this.ultBtn).repeatForever(
          tween(this.ultBtn).to(0.5, { scale: new Vec3(1.08, 1.08, 1) }).to(0.5, { scale: new Vec3(1, 1, 1) })
        ).start();
        setText(this.chargeTxt, '大招\n就绪');
      } else {
        Tween.stopAllByTarget(this.ultBtn);
        this.ultBtn.setScale(1, 1, 1);
        this.lastChargeKey = -1; // 复位后强制重绘充能
      }
    }
    if (!ready) {
      // 2% 步进重绘：充能期从每帧 Graphics 重建 + Label 重排降到最多 50 次/整圈
      const cp = d.hero.chargePct;
      const key = Math.round(cp * 50);
      if (key !== this.lastChargeKey) {
        this.lastChargeKey = key;
        this.chargeRing.set(cp, PAL.blue);
        setText(this.chargeTxt, '大招\n' + Math.round(cp * 100) + '%');
      }
    }
    // 技能CD环（同 2% 步进，满CD时零重绘）
    const sk = Math.max(0, Math.min(1, d.hero.skillPct));
    const skKey = Math.round(sk * 50);
    if (skKey !== this.lastSkillKey) {
      this.lastSkillKey = skKey;
      this.skillRing.set(sk, PAL.blue);
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
