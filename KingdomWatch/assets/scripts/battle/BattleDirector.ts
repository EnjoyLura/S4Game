/**
 * 战斗总控（§3.2 状态机）：PREPARE → WAVE_RUNNING ⇄ LEVEL_UP_PAUSE → VICTORY / LINE_BROKEN→失败结算(内含广告复活)
 * dt×倍速步进；暂停/三选一期间全场冻结（§3.2）
 */
import { _decorator, Canvas, Component, director, Layers, Node } from 'cc';
import { LEVEL_1_1, LevelDef, MOBS, heroSlots, nextLevelId } from '../config/Mobs';
import { CardCtx, CardDef, CardStacks, draw3, GlobalStats, M0_POOL, baseArcherStats, baseSniperStats, basePyroStats, baseVoltStats, baseMoraStats, HeroStats, archerAtkCfg, sniperAtkCfg, voltAtkCfg, voltSkCfg, voltUltCfg, pyroAtkCfg, pyroSkCfg, pyroUltCfg, moraAtkCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { LO, REVIVE_RATIO, starOf } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { loadSave, saveSave } from '../core/SaveData';
import { DIFF_MUL, starKey, squadList, unlockCodex, advanceUnlock, equipAgg, heroState, heroBtAgg } from '../core/GameData';
import { flow } from '../core/Flow';
import { MonsterManager } from './Monster';
import { ArcherHero, HeroBase, SniperHero, PyroHero, VoltHero, FrostHero } from './Hero';
import { LineDefense } from './LineDefense';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './Projectile';
import { Particles } from './Particles';
import { DamageService, DamageRow } from './DamageService';
import { FloatText } from './FloatText';
import { ComicPop } from './ComicPop';
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
  /** 未查看的新怪种队列（新怪通知钮 → 介绍弹窗逐个消费） */
  private newMobQueue: string[] = [];
  private mobIntroOpen = false;   // 新怪弹窗防重入（触控双发时只开一个）
  speed: 1 | 1.5 = 1;

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
  pops!: ComicPop;
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
    this.pops = new ComicPop(fxLayer);
    this.mgr = new MonsterManager(mobLayer, hitCtx);
    this.mgr.statMul = DIFF_MUL[Math.min(flow.diff, 2)] || 1;
    // 首次遭遇新怪种 → 解锁图鉴 + 横幅 + 新怪通知钮（介绍弹窗待玩家点击查看）
    this.mgr.onFirstEncounter = def => {
      if (unlockCodex(def.id)) {
        this.hud.showBanner(`图鉴解锁：${def.name}`, 1.6);
        this.newMobQueue.push(def.id);
        this.hud.showNewMob(true);
      }
    };
    // 编队上阵（§编队）：按存档上阵顺序从左到右站位（2 人 = ±160 与旧版一致）；空编队兜底双英雄
    const squad = squadList();
    const ids = squad.length ? squad : ['archer', 'sniper'];
    const slots = heroSlots(ids.length);
    this.heroes = ids.map((hid, i) => {
      const st = hid === 'sniper' ? baseSniperStats()
        : hid === 'pyro' ? basePyroStats()
          : hid === 'volt' ? baseVoltStats()
            : hid === 'mora' ? baseMoraStats() : baseArcherStats();
      applyHeroGrowth(st, hid);     // 英雄等级成长+阶段性突破上场（每级成长按存档等级）
      applyEquipAffixes(st, hid);   // 穿戴词条上场即生效（用户确认的词条体系）
      return hid === 'sniper' ? new SniperHero(field, slots[i], st)
        : hid === 'pyro' ? new PyroHero(field, slots[i], st)
          : hid === 'volt' ? new VoltHero(field, slots[i], st)
            : hid === 'mora' ? new FrostHero(field, slots[i], st)
              : new ArcherHero(field, slots[i], st);
    });
    this.parts = new Particles(fxLayer);
    this.projs = new ProjectileManager(projLayer, this.mgr, this.dmgSvc, this.parts);
    this.waves = new WaveManager(this.levelDef, this.mgr);
    for (const h of this.heroes) this.dmgSvc.register(h.id, h.name);

    this.hud = new HUD(uiRoot, this, field);
    this.panels = new Panels(uiRoot, this);
    this.gm = new GmPanel(uiRoot, this);

    // 兜底：初始构建树（Field/UIRoot/HUD/Panels）全部置于 UI_2D 层，相机才会渲染
    setLayerDeep(this.node, Layers.Enum.UI_2D);

    // 真机自检：相机可视半高必须等于布局半高，战场实体才会落在视野内
    //（真机曾出现“防线/英雄/怪物全不可见”，桌面与模拟均无法复现；不一致时修正并留痕错误浮层）
    const cam = director.getScene()?.getChildByName('Canvas')?.getComponent(Canvas)?.cameraComponent;
    if (cam && Math.abs(cam.orthoHeight - LO.half) > 2) {
      console.error(`[KW] 相机 ortho ${cam.orthoHeight.toFixed(1)} ≠ 布局半高 ${LO.half.toFixed(1)}，已修正`);
      cam.orthoHeight = LO.half;
    }

    bus.on(EVT.MOB_KILLED, this.onMobKilled, this);
    bus.on(EVT.LINE_BROKEN, this.onLineBroken, this);
    bus.on(EVT.ALL_WAVES_CLEARED, this.onAllCleared, this);
    bus.on(EVT.WAVE_CHANGED, this.onWaveChanged, this);
    bus.on(EVT.COMIC_POP, this.onComicPop, this);
    bus.on(EVT.HIT_STOP, this.onHitStop, this);

    this.hud.showBanner('敌军来袭！', 2);
    this.state = 'prepare';
  }

  onDestroy(): void {
    bus.off(EVT.MOB_KILLED, this.onMobKilled, this);
    bus.off(EVT.LINE_BROKEN, this.onLineBroken, this);
    bus.off(EVT.ALL_WAVES_CLEARED, this.onAllCleared, this);
    bus.off(EVT.WAVE_CHANGED, this.onWaveChanged, this);
    bus.off(EVT.COMIC_POP, this.onComicPop, this);
    bus.off(EVT.HIT_STOP, this.onHitStop, this);
  }

  /** 漫画拟声词条（各战斗模块 emit，词表/概率/主题色在 ComicPop.POP_DEFS） */
  private onComicPop(x: unknown, y: unknown, kind: unknown): void {
    this.pops.pop(x as number, y as number, kind as string);
  }

  // 微顿帧：暴击/击杀瞬间全场时间短暂放缓制造打击感（冷却限频防连发变成卡顿）
  private hitStopT = 0;
  private hitStopCd = 0;

  private onHitStop(): void {
    if (this.hitStopCd > 0) return;
    this.hitStopT = Math.max(this.hitStopT, 0.07);
    this.hitStopCd = 0.35;
  }

  update(rawDt: number): void {
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.hud.setFps(Math.round(this.fpsN / this.fpsAcc));
      this.fpsAcc = 0; this.fpsN = 0;
    }

    // 掉帧毛刺不得放大模拟步长（2x 死亡螺旋根因）；超 1/30s 的模拟步拆细步防子弹穿模
    const dt = Math.min(rawDt, 1 / 30);

    // 微顿帧计时走真实时间（顿帧本身不该被自己拖长）
    this.hitStopCd -= dt;
    if (this.hitStopT > 0) this.hitStopT -= dt;

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

    const sdt = dt * this.speed * (this.hitStopT > 0 ? 0.12 : 1);
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
    if (killer) killer.chargeKill(d.charge * (1 + (killer.stats.chargeEff || 0)));   // 充能效率：击杀充能加成（呼吸回能不受加成）
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
    // §3.8：三选一 = 上阵英雄卡池混合 + 全局卡（未上阵英雄的卡不出现；首抽与刷新共用同一过滤池）
    const pool = M0_POOL.filter(c => c.owner === 'global' || this.heroes.some(h => h.id === c.owner));
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
        this.panels.showPick(draw3(pool, this.stacks), this.stacks, opts);
      },
    };
    this.pickOpts = opts;
    this.hud.sync(); // 冻结期间 HUD 不轮询，升级瞬间把经验条/等级刷到位
    this.panels.resetPickRefresh();
    this.panels.showPick(draw3(pool, this.stacks), this.stacks, opts);
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
    this.speed = this.speed === 1 ? 1.5 : 1;
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
  /** 新怪通知钮点击：逐个弹出介绍弹窗，看完队列清空再收钮 */
  showNewMobIntro(): void {
    if (this.mobIntroOpen) return;
    const id = this.newMobQueue[0];
    if (!id) { this.hud.showNewMob(false); return; }
    this.mobIntroOpen = true;
    this.hud.showMobIntro(id, () => {
      this.mobIntroOpen = false;
      this.newMobQueue.shift();
      this.hud.showNewMob(this.newMobQueue.length > 0);
    });
  }

  private onAllCleared(): void {
    if (this.state !== 'running') return;
    this.state = 'win';
    const stars = starOf(this.line.ratio);
    const reward = Math.floor(this.goldEarned + this.levelDef.baseGold * (1 + stars * 0.1));
    const sv = loadSave();
    sv.gold += reward;
    const sk = starKey(this.levelDef.id, flow.diff);
    sv.stars[sk] = Math.max(sv.stars[sk] || 0, stars);
    if (this.levelDef.id === '1-2') sv.speedUnlocked = true;
    saveSave();
    advanceUnlock(this.levelDef.id);   // 通关推进主线解锁（商店英雄/装备的"通关 X 解锁"）

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
      onNext: () => {
        // 直进下一关（用户调整：不回主城）；无下一关回关卡页，同难度未解锁降回普通
        const nid = nextLevelId(this.levelDef.id);
        if (!nid) { this.exitBattle(); return; }
        const d = flow.diff > 0 && (loadSave().stars[starKey(nid, flow.diff - 1)] || 0) < 1 ? 0 : flow.diff;
        flow.mode = 'battle'; flow.levelId = nid; flow.diff = d;
        director.loadScene('Main');
      },
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

/** 穿戴词条 → 战斗属性（用户确认的部位归属）：攻击=平加+加成累乘，攻速/暴击/充能同理，范围平加 */
function applyEquipAffixes(s: HeroStats, hid: string): void {
  const a = equipAgg(hid);
  s.atk += a.atkFlat;
  s.atkMul *= 1 + a.atkPct;
  s.aspd *= 1 + a.atkSpd;
  s.range += a.rangeFlat;
  s.critRate = Math.min(1, s.critRate + a.critRate);
  s.critMul += a.critDmg;
  s.skillDmgFlat += a.skillDmgFlat;
  s.chargeEff += a.chargeEff;
}

/** 英雄等级成长（外线养成→战斗）：每级 +8% 基础攻击、技能伤害平加 +5%基础攻击/级；
 *  阶段性突破按英雄表生效（弓/狙专属表——用户定稿；其余英雄通用攻/技档） */
function applyHeroGrowth(s: HeroStats, hid: string): void {
  const hs = heroState(hid);
  const bt = heroBtAgg(hid, hs.lv);
  const base = s.atk;
  s.atk = Math.round(base * (1 + (hs.lv - 1) * 0.08) * (1 + bt.atkPct));
  s.skillDmgFlat += Math.round(base * (hs.lv - 1) * 0.05);
  s.aspd *= 1 + bt.aspdPct;
  s.range = Math.round(s.range * (1 + bt.rangePct));
  s.skillRange = Math.round(s.skillRange * (1 + bt.rangePct));
  s.pierceChance += bt.pierce;
  s.defIgnore += bt.defIgnore;
  s.critMul += bt.critDmg;
  s.ultBolts += bt.ultBolts;
  s.ultAutoCd = bt.ultAutoCd;
  s.atkLv = hs.atkLv; s.skillLv = hs.skillLv; s.ultLv = hs.ultLv;   // 技能升级里程碑（弓箭手类内读取）
  if (hid === 'archer') {
    const ac = archerAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%（技能/大招不吃）
    if (ac.aspdOn) s.aspd *= 1.06;                    // 5级 攻速+6%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.rangeOn) s.range = Math.round(s.range * 1.08);   // 15级 普攻索敌范围+8%（技能索敌不动）
    if (hs.skillLv >= 5) s.skillCdFlat += 1;          // 技能5级 冷却-1s
    if (hs.ultLv >= 15) s.chargeMul *= 0.9;           // 大招15级 充能-10%
  } else if (hid === 'sniper') {
    const ac = sniperAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
    if (ac.aspdOn) s.aspd *= 1.06;                    // 5级 攻速+6%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.fullHpOn) s.fullHpBonus = 0.25;            // 15级 对满血目标+25%
    if (hs.skillLv >= 5) s.skillCdFlat += 1;          // 技能5级 冷却-1s
    if (hs.ultLv >= 15) s.chargeMul *= 0.9;           // 大招15级 充能-10%
  } else if (hid === 'volt') {
    const ac = voltAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
    if (ac.aspdOn) s.aspd *= 1.06;                    // 5级 攻速+6%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.shockedOn) s.shockedBonus = 0.25;          // 15级 对感电目标+25%
    const sc = voltSkCfg(hs.skillLv);
    if (sc.cdOn) s.skillCdFlat += 1;                  // 技能5级 冷却-1s
    if (sc.targetsOn) s.skillShots += 1;              // 技能10级 连锁+1目标
    if (voltUltCfg(hs.ultLv).chargeOn) s.chargeMul *= 0.9;   // 大招15级 充能-10%
    if (bt.shockAmpMul !== 1) s.shockAmpMul = bt.shockAmpMul;   // 30级 感电加深
    if (bt.shotsBonus) s.skillShots += bt.shotsBonus;           // 60级 连锁+2目标
    if (bt.skillProc) s.skillProc = bt.skillProc;               // 70级 普攻概率施法
    if (bt.ultStunBonus) s.ultStun += bt.ultStunBonus;          // 80级 大招眩晕+0.5s
    if (bt.shockOnAtk) s.shockOnHit = Math.max(s.shockOnHit || 0, bt.shockOnAtk);  // 90级 雷霆之躯
  } else if (hid === 'pyro') {
    const ac = pyroAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
    if (ac.aspdOn) s.aspd *= 1.06;                    // 5级 攻速+6%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.burnedOn) s.burnedBonus = 0.25;            // 15级 对灼烧目标+25%
    const pc = pyroSkCfg(hs.skillLv);
    if (pc.cdOn) s.skillCdFlat += 1;                  // 技能5级 冷却-1s
    if (pc.shotsOn) s.skillShots += 1;                // 技能10级 火球+1
    if (pyroUltCfg(hs.ultLv).chargeOn) s.chargeMul *= 0.9;   // 大招15级 充能-10%
    if (bt.burnMul !== 1) s.burnMul *= bt.burnMul;              // 30级 火势加深
    if (bt.explodeR) s.explodeR = Math.max(s.explodeR || 0, bt.explodeR);   // 60级 普攻爆炸范围60→90
    if (bt.shotsBonus) s.skillShots += bt.shotsBonus;           // 70级 技能火球+1
    if (bt.vulnBonus) s.pitVuln += bt.vulnBonus;                // 80级 陨石坑易伤加深
    if (bt.burnOnAtk) s.burnOnHit = Math.max(s.burnOnHit || 0, bt.burnOnAtk);   // 90级 烈焰之躯
  } else if (hid === 'mora') {
    const ac = moraAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
    if (ac.aspdOn) s.aspd *= 1.06;                    // 5级 攻速+6%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.slowedOn) s.slowedBonus = 0.25;            // 15级 对减速目标+25%
    if (moraSkCfg(hs.skillLv).cdOn) s.skillCdFlat += 1;   // 技能5级 冷却-1s
    if (moraUltCfg(hs.ultLv).chargeOn) s.chargeMul *= 0.9;   // 大招15级 充能-10%
    if (bt.slowMul !== 1) s.slowOnHit = (s.slowOnHit || 0) * bt.slowMul;   // 30级 冰寒刺骨
    if (bt.novaR) s.novaR = Math.max(s.novaR, bt.novaR);   // 60级 新星范围150→190
    if (bt.freezeProc) s.freezeProc = bt.freezeProc;       // 70级 普攻概率冰冻
    if (bt.stunBonus) s.novaStun += bt.stunBonus;          // 80级 冻结+0.4s
    if (bt.slowOnAtk) s.slowOnHit = Math.max(s.slowOnHit || 0, bt.slowOnAtk);   // 90级 冰寒之躯
  }
}
