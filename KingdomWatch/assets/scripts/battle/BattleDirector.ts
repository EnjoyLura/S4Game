/**
 * 战斗总控（§3.2 状态机）：PREPARE → WAVE_RUNNING ⇄ LEVEL_UP_PAUSE → VICTORY / LINE_BROKEN→失败结算(内含广告复活)
 * dt×倍速步进；暂停/三选一期间全场冻结（§3.2）
 */
import { _decorator, Component, director, Layers, Node } from 'cc';
import { LEVEL_1_1, LevelDef, MOBS, heroSlots } from '../config/Mobs';
import { CardCtx, CardDef, CardStacks, draw3, GlobalStats, M0_POOL, baseArcherStats, baseSniperStats } from '../config/Cards';
import { REVIVE_RATIO, starOf } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { loadSave, saveSave } from '../core/SaveData';
import { flow } from '../core/Flow';
import { MonsterManager } from './Monster';
import { ArcherHero, HeroBase, SniperHero } from './Hero';
import { LineDefense } from './LineDefense';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './Projectile';
import { Particles } from './Particles';
import { DamageService, DamageRow } from './DamageService';
import { FloatText } from './FloatText';
import { AdService } from '../platform/AdService';
import { HUD } from '../ui/HUD';
import { Panels } from '../ui/Panels';
import { GmPanel } from '../ui/GmPanel';
import { setLayerDeep } from '../ui/UIKit';

const { ccclass } = _decorator;

export type BattleState = 'prepare' | 'running' | 'pick' | 'paused' | 'win' | 'lose';

export interface PickOpts {
  onPick: (card: CardDef) => void;
  onRefreshRequest: () => void;
}

@ccclass('BattleDirector')
export class BattleDirector extends Component {
  levelDef: LevelDef = LEVEL_1_1;
  state: BattleState = 'prepare';
  speed: 1 | 2 = 1;

  mgr!: MonsterManager;
  /** 上场英雄（双英雄同场：艾拉·风羽 + 凯尔·鹰眼；编队系统后再做槽位解锁） */
  heroes: HeroBase[] = [];
  /** 主英雄（兼容旧引用：GM/统计等以第一名英雄为准） */
  get hero(): HeroBase { return this.heroes[0]; }
  line!: LineDefense;
  waves!: WaveManager;
  projs!: ProjectileManager;
  parts!: Particles;
  dmgSvc = new DamageService();
  float!: FloatText;
  hud!: HUD;
  panels!: Panels;
  gm!: GmPanel;

  global: GlobalStats = { xpMul: 1, goldMul: 1, lineRegenPct: 0 };
  stacks: CardStacks = {};
  /** 战局内金币（击杀累积，§3.10 只计不显） */
  goldEarned = 0;
  /** 关卡计时（游戏秒：只在 running 累计，暂停/三选一冻结，随倍速加快） */
  elapsed = 0;
  heroLevel = 1;
  xp = 0;
  private pickQueue = 0;
  private pickOpts: PickOpts | null = null;
  private prepareT = 3;
  private fpsAcc = 0;
  private fpsN = 0;

  start(): void {
    const field = new Node('Field');
    field.setParent(this.node);
    const uiRoot = new Node('UIRoot');
    uiRoot.setParent(this.node);

    // 渲染分层（稳定遮挡：防线 < 怪 < 弹道 < 飘字；英雄夹在怪与弹道间）
    this.line = new LineDefense(field, this.levelDef.lineHp);
    const mobLayer = new Node('MobLayer');
    mobLayer.setParent(field);
    const projLayer = new Node('ProjLayer');
    projLayer.setParent(field);
    const fxLayer = new Node('FxLayer');
    fxLayer.setParent(field);

    const hitCtx = {
      floatParent: fxLayer,
      dmgNumber: (x: number, y: number, text: string, color: string, big?: boolean) =>
        this.float.spawn(x, y, text, color, big),
    };
    this.float = new FloatText(fxLayer);
    this.mgr = new MonsterManager(mobLayer, hitCtx);
    // 双英雄同场（§4 站位表 2 人 = ±160）：艾拉·风羽（弓）左槽，凯尔·鹰眼（狙）右槽
    const slots = heroSlots(2);
    this.heroes = [
      new ArcherHero(field, slots[0], baseArcherStats()),
      new SniperHero(field, slots[1], baseSniperStats()),
    ];
    this.parts = new Particles(fxLayer);
    this.projs = new ProjectileManager(projLayer, this.mgr, this.dmgSvc, this.parts);
    this.waves = new WaveManager(this.levelDef, this.mgr);
    for (const h of this.heroes) this.dmgSvc.register(h.id, h.name);

    this.hud = new HUD(uiRoot, this, field);
    this.panels = new Panels(uiRoot, this);
    this.gm = new GmPanel(uiRoot, this);

    // 兜底：初始构建树（Field/UIRoot/HUD/Panels）全部置于 UI_2D 层，相机才会渲染
    setLayerDeep(this.node, Layers.Enum.UI_2D);

    bus.on(EVT.MOB_KILLED, this.onMobKilled, this);
    bus.on(EVT.LINE_BROKEN, this.onLineBroken, this);
    bus.on(EVT.ALL_WAVES_CLEARED, this.onAllCleared, this);
    bus.on(EVT.WAVE_CHANGED, this.onWaveChanged, this);

    this.hud.showBanner('敌军来袭！', 2);
    this.state = 'prepare';
  }

  onDestroy(): void {
    bus.off(EVT.MOB_KILLED, this.onMobKilled, this);
    bus.off(EVT.LINE_BROKEN, this.onLineBroken, this);
    bus.off(EVT.ALL_WAVES_CLEARED, this.onAllCleared, this);
    bus.off(EVT.WAVE_CHANGED, this.onWaveChanged, this);
  }

  update(rawDt: number): void {
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.hud.setFps(Math.round(this.fpsN / this.fpsAcc));
      this.fpsAcc = 0; this.fpsN = 0;
    }

    // 掉帧毛刺不得放大模拟步长（2x 死亡螺旋根因）；超 1/30s 的模拟步拆细步防子弹穿模
    const dt = Math.min(rawDt, 1 / 30);

    this.gm.syncVisibility(); // 所有状态下都要同步 GM 浮钮（三选一/结算期间隐藏）

    if (this.state === 'prepare') {
      this.prepareT -= dt;
      if (this.prepareT <= 0) {
        this.state = 'running';
        this.waves.start();
        if (this.pickQueue > 0) this.openPick(); // GM 期间升级的排队三选一
      }
      return;
    }
    if (this.state !== 'running') return;

    const sdt = dt * this.speed;
    this.elapsed += sdt;
    const steps = sdt > 1 / 30 ? 2 : 1;
    const sub = sdt / steps;
    for (let i = 0; i < steps; i++) {
      this.waves.tick(sub);
      this.mgr.tick(sub, this.line);
      for (const h of this.heroes) h.tick(sub, this.mgr, this.projs, this.dmgSvc);
      this.projs.tick(sub, this.line);
      this.parts.tick(sub);
      this.line.regenPct = this.global.lineRegenPct;
      this.line.tick(sub);
    }
    this.hud.sync(rawDt);
  }

  /* ---------- 击杀 → 金币/经验/充能（§3.7/§3.8/§3.10） ---------- */
  private onMobKilled(def: unknown, killerId: unknown): void {
    const d = def as { gold: number; exp: number; charge: number };
    this.goldEarned += d.gold * this.global.goldMul;
    Sfx.play('kill');
    const killer = this.heroes.find(h => h.id === killerId);
    if (killer) killer.chargeKill(d.charge);
    this.gainXp(d.exp * this.global.xpMul);
  }

  private onWaveChanged(cur: unknown, total: unknown, surge: unknown): void {
    this.hud.setWave(cur as number, total as number);
    if (surge) this.hud.showBanner('敌军大部队来袭！', 2);
  }

  private gainXp(v: number): void {
    this.xp += v;
    let need = this.expNeed(this.heroLevel);
    while (this.xp >= need) {
      this.xp -= need;
      this.heroLevel++;
      this.pickQueue++;
      Sfx.play('levelup');
      need = this.expNeed(this.heroLevel);
      bus.emit(EVT.LEVEL_UP, this.heroLevel);
    }
    if (this.pickQueue > 0 && this.state === 'running') this.openPick();
  }

  private expNeed(l: number): number {
    return Math.floor(50 * Math.pow(1.35, l - 1));
  }

  /* ---------- 三选一（§3.8：全场冻结，连升排队；广告刷新×1+钻石刷新×1） ---------- */
  private openPick(): void {
    if (this.state !== 'running') return;
    this.state = 'pick';
    const opts: PickOpts = {
      onPick: (card: CardDef) => {
        this.applyCard(card);
        this.stacks[card.id] = (this.stacks[card.id] || 0) + 1;
        this.pickQueue--;
        saveSave();
        if (this.pickQueue > 0) this.openPick();
        else { this.panels.closeAll(); this.state = 'running'; }
      },
      onRefreshRequest: () => {
        this.panels.showPick(draw3(M0_POOL, this.stacks), this.stacks, opts);
      },
    };
    this.pickOpts = opts;
    this.hud.sync(); // 冻结期间 HUD 不轮询，升级瞬间把经验条/等级刷到位
    this.panels.resetPickRefresh();
    this.panels.showPick(draw3(M0_POOL, this.stacks), this.stacks, opts);
  }

  /** Panels 回调入口：广告/钻石刷新（次数限制在 Panels 内部控制） */
  requestRefresh(): void {
    if (this.pickOpts) this.pickOpts.onRefreshRequest();
  }

  private applyCard(card: CardDef): void {
    // 卡按归属路由：'archer'/'sniper' 改写对应英雄属性，'global' 不触及英雄数值
    const owner = this.heroes.find(h => h.id === card.owner);
    const ctx: CardCtx = {
      hero: owner ? owner.stats : this.heroes[0].stats,
      global: this.global,
      line: {
        healPct: p => this.line.healPct(p),
        addMaxMul: m => this.line.addMaxMul(m),
      },
    };
    card.apply(ctx);
  }

  /* ---------- 大招（手动，充能满可放；未满点图标→Tips） ---------- */
  tryCastUlt(idx = 0): 'ok' | 'charging' {
    const h = this.heroes[idx];
    if (h && h.ultReady && h.castUlt(this.mgr, this.projs, this.dmgSvc)) return 'ok';
    return 'charging';
  }

  toggleSpeed(): void {
    const s = loadSave();
    if (!s.speedUnlocked && !s.debug) return;
    this.speed = this.speed === 1 ? 2 : 1;
    this.hud.setSpeed(this.speed);
  }

  togglePause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      const sv = loadSave();
      this.panels.showPause({
        onResume: () => { this.panels.closeAll(); this.state = 'running'; },
        onExit: () => this.exitBattle(),
        music: sv.music,
        sfx: sv.sfx,
        onToggle: (k: 'music' | 'sfx', v: boolean) => { const s2 = loadSave(); s2[k] = v; saveSave(); },
        tab: 0,
        speed: this.speed,
        speedUnlocked: !!(sv.speedUnlocked || sv.debug),
        xp: Math.floor(this.xp),
      });
    } else if (this.state === 'paused') {
      this.panels.closeAll();
      this.state = 'running';
    }
  }

  showStats(): void {
    this.panels.showStats(this.dmgSvc.rows());
  }

  showTips(kind: 'atk' | 'skill' | 'ult', idx = 0): void {
    this.panels.showTips(kind, this.heroes[idx] || this.heroes[0], this.line, idx);
  }

  /* ---------- 失败 → 失败结算（广告复活按钮与胜利双倍按钮同位 §3.9） ---------- */
  private onLineBroken(): void {
    if (this.state === 'win' || this.state === 'lose') return;
    this.state = 'lose';
    const goldFloor = Math.floor(this.goldEarned * 0.3);
    this.panels.showLose({
      goldFloor,
      reviveRatio: REVIVE_RATIO,
      xp: Math.floor(this.xp),
      tab: 0,
      onRevive: (done: (ok: boolean) => void) => {
        AdService.showRewarded('revive', () => {
          this.line.revive();
          this.panels.closeAll();
          this.state = 'running';
          done(true);
        }, () => done(false));
      },
      onRetry: () => this.exitBattle(),
      onExit: () => this.exitBattle(),
    });
  }

  /* ---------- 胜利结算（§3.9 星级 / §3.10 金币） ---------- */
  private onAllCleared(): void {
    if (this.state !== 'running') return;
    this.state = 'win';
    const stars = starOf(this.line.ratio);
    const reward = Math.floor(this.goldEarned + this.levelDef.baseGold * (1 + stars * 0.1));
    const sv = loadSave();
    sv.gold += reward;
    sv.stars[this.levelDef.id] = Math.max(sv.stars[this.levelDef.id] || 0, stars);
    if (this.levelDef.id === '1-2') sv.speedUnlocked = true;
    saveSave();

    this.panels.showWin({
      stars,
      gold: reward,
      ratio: this.line.ratio,
      xp: Math.floor(this.xp),
      tab: 0,
      onDouble: (done: (ok: boolean) => void) => {
        AdService.showRewarded('double', () => {
          sv.gold += reward;
          saveSave();
          done(true);
        }, () => done(false));
      },
      onNext: () => this.exitBattle(),
      onExit: () => this.exitBattle(),
    });
  }

  /* ---------- GM 后台（GmPanel 专用入口） ---------- */
  /** 面板关闭：恢复战斗；升级队列待处理则弹三选一 */
  gmResume(): void {
    if (this.state === 'paused') this.state = 'running';
    if (this.pickQueue > 0) this.openPick();
  }

  gmSpawn(n: number): void {
    const defs = Object.values(MOBS);
    for (let i = 0; i < n; i++) {
      this.mgr.spawn(defs[Math.floor(Math.random() * defs.length)]);
    }
    this.hud.sync();
  }

  gmKillAll(): void {
    for (const m of [...this.mgr.list]) if (!m.dead) m.takeDamage(1e12, false, 'gm');
  }

  gmSkipWave(): void {
    this.waves.gmSkip();
  }

  /** 每次补齐整级经验（走真实升级+三选一队列） */
  gmLevelUp(n: number): void {
    for (let i = 0; i < n; i++) this.gainXp(this.expNeed(this.heroLevel) - this.xp);
  }

  gmLearnCard(id: string, times: number): void {
    const def = M0_POOL.find(c => c.id === id);
    if (!def) return;
    for (let i = 0; i < times; i++) {
      this.applyCard(def);
      this.stacks[id] = (this.stacks[id] || 0) + 1;
    }
    this.hud.sync();
  }

  gmUltCharge(v: number): void {
    for (const h of this.heroes) h.charge = v;
    this.hud.sync();
  }

  gmSkillReady(): void {
    for (const h of this.heroes) h.skillCd = 0;
    this.hud.sync();
  }

  gmAddGold(n: number): void {
    const sv = loadSave();
    sv.gold += n;
    saveSave();
  }

  gmAddDiamond(n: number): void {
    const sv = loadSave();
    sv.diamonds += n;
    saveSave();
  }

  gmHealLine(): void {
    this.line.hp = this.line.maxHp;
    bus.emit(EVT.LINE_DAMAGED, this.line.hp, this.line.maxHp, this.line.shield);
  }

  gmShield(v: number): void {
    if (v > 0) this.line.addShield(v);
    else this.line.shield = 0;
    bus.emit(EVT.LINE_DAMAGED, this.line.hp, this.line.maxHp, this.line.shield);
  }

  gmWin(): void {
    if (this.state === 'running') bus.emit(EVT.ALL_WAVES_CLEARED);
  }

  gmLose(): void {
    if (this.state === 'running') bus.emit(EVT.LINE_BROKEN);
  }

  gmExit(): void {
    this.exitBattle();
  }

  private exitBattle(): void {
    flow.mode = 'main';   // 回主城（停留在关卡页）
    director.loadScene('Main');
  }
}

/** 伤害统计行透出（HUD/Panels 用） */
export type { DamageRow };
