/**
 * 战斗总控（§3.2 状态机）：PREPARE → WAVE_RUNNING ⇄ LEVEL_UP_PAUSE → VICTORY / LINE_BROKEN→失败结算(内含广告复活)
 * dt×倍速步进；暂停/三选一期间全场冻结（§3.2）
 */
import { _decorator, Canvas, Component, director, isValid, Layers, Node } from 'cc';
import { MobDef, MOBS, heroSlots } from '../config/Mobs';
import { ChallengeDef, DIFFICULTIES, getChallengeDef } from '../config/LevelDifficulty';
import { CardCtx, CardDef, CardStacks, canTakeCard, draw3, GlobalStats, M0_POOL, baseArcherStats, baseSniperStats, basePyroStats, baseVoltStats, baseMoraStats, HeroStats, archerAtkCfg, sniperAtkCfg, sniperSkCfg, voltAtkCfg, voltSkCfg, voltUltCfg, pyroAtkCfg, pyroSkCfg, pyroUltCfg, moraAtkCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { expNeed, LO, PASSIVE_XP_INTERVAL, passiveXpGain, REVIVE_RATIO, starOf, ULT_INITIAL_CHARGE, SHARED_KILL_CHARGE } from '../config/GameConfig';
import { bus, EVT, WaveThreat } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { GameAudio } from '../core/GameAudio';
import { CAMPAIGN_STAGES, campaignChapter, campaignLevelOpen, campaignStage } from '../config/Campaign';
import { endlessWave } from '../config/Endless';
import { endlessBest, recordEndlessFloor } from '../core/EndlessProgress';
import { loadSave, saveSave } from '../core/SaveData';
import { firstLevelVictory, pendingBowLesson, skipBattleTeaching, teachingBattle } from '../core/FirstJourney';
import { pendingPyroSquadLesson, secondLevelVictory, secondTeachingBattle, skipSecondBattleTeaching } from '../core/SecondJourney';
import { thirdLevelVictory, thirdTeachingBattle, skipThirdBattleTeaching } from '../core/ThirdJourney';
import { fifthLevelVictory } from '../core/FifthLevelRewards';
import { claimEarlyFirstWinGold } from '../core/EarlyEconomy';
import { tutorialFocus } from '../ui/TutorialFocus';
import { starKey, squadList, unlockCodex, advanceUnlock, equipAgg, heroState, heroStats, heroBtAgg, keepHp, keepShield } from '../core/GameData';
import { BattleLoot, DeathPosition } from './BattleLoot';
import { flow } from '../core/Flow';
import { MonsterManager } from './Monster';
import { ArcherHero, HeroBase, SniperHero, PyroHero, VoltHero, FrostHero } from './Hero';
import { LineDefense } from './LineDefense';
import { WaveManager } from './WaveManager';
import { ProjectileManager } from './Projectile';
import { Particles } from './Particles';
import { DamageService, DamageRow } from './DamageService';
import { FloatEvent, FloatText } from './FloatText';
import { ComicPop } from './ComicPop';
import { ImpactFX } from './ImpactFX';
import { BattleAmbience } from './BattleAmbience';
import { UltimatePresentation } from './UltimatePresentation';
import { UltimateCue, UltimateBeat } from './UltimateTiming';
import { AdService } from '../platform/AdService';
import { HUD } from '../ui/HUD';
import { Panels } from '../ui/Panels';
import { GmPanel } from '../ui/GmPanel';
import { setLayerDeep } from '../ui/UIKit';
import { battleEntryReady, enteringBattle, leaveBattle } from '../ui/BattleEntry';
import { warmPickArt } from '../ui/PickArt';
import { BossWarning } from '../ui/BossWarning';

const { ccclass } = _decorator;

export type BattleState = 'prepare' | 'running' | 'pick' | 'paused' | 'tutorial' | 'win' | 'lose';

export interface PickOpts {
  recommendedId?: string;
  onSkipTeaching?: () => void;
  onPick: (card: CardDef) => void;
  onRefreshRequest: () => void;
}

@ccclass('BattleDirector')
export class BattleDirector extends Component {
  levelDef: ChallengeDef = getChallengeDef('1-1', 0);
  endlessChapter = 0;
  endlessFloor = 1;
  endlessCleared = 0;
  private endlessRest = -1;
  private endlessStartingBest = 0;
  private endlessCardsComplete = false;
  get isEndless(): boolean { return this.endlessChapter > 0; }
  get battleSceneId(): string { return this.isEndless ? this.endlessChapter + '-10' : this.levelDef.id; }
  get battleTitle(): string { return this.isEndless ? this.levelDef.name : this.levelDef.id + ' ' + this.levelDef.name; }
  state: BattleState = 'prepare';
  /** 未查看的新怪种队列（新怪通知钮 → 介绍弹窗逐个消费） */
  private newMobQueue: string[] = [];
  private mobIntroOpen = false;   // 新怪弹窗防重入（触控双发时只开一个）
  speed: 1 | 1.5 = 1;
  /** GM 开关：技能无冷却 / 大招常满（读自存档，GmPanel 切换；每帧在英雄 tick 后强制生效） */
  gmNoSkillCd = !!loadSave().gmNoSkillCd;
  gmUltFull = !!loadSave().gmUltFull;

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
  impacts!: ImpactFX;
  private field!: Node;
  private ambience!: BattleAmbience;
  private ultPresentation!: UltimatePresentation;
  private bossWarning!: BossWarning;
  private loot!: BattleLoot;
  private pendingWin = false;
  private leaving = false;
  private coachRoot!: Node;
  private pickNumber = 0;
  private killBeatAge = 0;
  private killBeatCount = 0;
  private killBeatX = 0;
  private killBeatY = 0;
  private killBeatCooldown = 0;
  private roleHints = new Set<string>();
  private ultFocusShown = false;
  private get teaching(): boolean { return teachingBattle(this.levelDef.id, this.levelDef.difficulty); }
  private get secondTeaching(): boolean { return secondTeachingBattle(this.levelDef.id, this.levelDef.difficulty); }
  private get thirdTeaching(): boolean {
    return thirdTeachingBattle(this.levelDef.id, this.levelDef.difficulty) && this.heroes.some(h => h.id === 'pyro');
  }

  global: GlobalStats = { xpMul: 1, goldMul: 1, lineRegenPct: 0 };
  stacks: CardStacks = {};
  /** 战局内金币（击杀累积，§3.10 只计不显） */
  goldEarned = 0;
  /** Cumulative target paid this run, shared by defeats, revival and eventual victory. */
  private goldSettled = 0;
  private doubleRewarded = false;
  private xpEarned = 0;
  /** 关卡计时（游戏秒：只在 running 累计，暂停/三选一冻结，随倍速加快） */
  elapsed = 0;
  heroLevel = 1;
  xp = 0;
  private passiveXpElapsed = 0;
  private pickQueue = 0;
  /** 大招演出锁：期间三选一不弹（用户要求演出完整），走完后自动补弹 */
  private ultShowT = 0;
  private pickOpts: PickOpts | null = null;
  private prepareT = 1;   // 进关 1 秒即出怪（用户反馈：3 秒等待太久）
  private fpsAcc = 0;
  private fpsN = 0;

  start(): void {
    if (this.isEndless) this.endlessStartingBest = endlessBest(this.endlessChapter);
    GameAudio.enter('battle', campaignChapter(flow.levelId).number);
    const field = new Node('Field');
    field.setParent(this.node);
    this.field = field;
    this.ambience = new BattleAmbience(field);
    const uiRoot = new Node('UIRoot');
    uiRoot.setParent(this.node);

    // 渲染分层（稳定遮挡：防线 < 怪 < 弹道 < 飘字；英雄夹在怪与弹道间）
    const groundFxLayer = new Node('GroundFxLayer');
    groundFxLayer.setParent(field);
    // Snapshot the current keep for every new battle, including direct next-level navigation.
    const keepLv = loadSave().keepLv;
    this.line = new LineDefense(field, keepHp(keepLv), keepShield(keepLv));
    const mobLayer = new Node('MobLayer');
    mobLayer.setParent(field);
    const heroLayer = new Node('HeroLayer');
    heroLayer.setParent(field);
    const projLayer = new Node('ProjLayer');
    projLayer.setParent(field);
    const fxLayer = new Node('FxLayer');
    fxLayer.setParent(field);
    const textLayer = new Node('TextLayer');
    textLayer.setParent(field);
    this.impacts = new ImpactFX(fxLayer, groundFxLayer, projLayer, mobLayer);
    this.ultPresentation = new UltimatePresentation(field, fxLayer, groundFxLayer);

    const hitCtx = {
      floatParent: textLayer,
      dmgNumber: (x: number, y: number, text: string, color: string, big?: boolean, event?: FloatEvent) =>
        this.float.spawn(x, y, text, color, big, event),
      impact: (x: number, y: number, hero: string, heavy: boolean, angle?: number) => this.impacts.hit(x, y, hero, heavy, angle),
      combatFeedback: (kind: string, x: number, y: number, radius: number, tx?: number, ty?: number) =>
        this.impacts.combatFeedback(kind, x, y, radius, tx, ty),
      damage: (hero: string, amount: number) => this.dmgSvc.add(hero, amount),
    };
    this.float = new FloatText(textLayer);
    this.pops = new ComicPop(textLayer);
    this.mgr = new MonsterManager(mobLayer, hitCtx);
    this.mgr.statMul = DIFFICULTIES[this.levelDef.difficulty].statMul * (this.levelDef.statMul || 1);
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
      return hid === 'sniper' ? new SniperHero(heroLayer, slots[i], st)
        : hid === 'pyro' ? new PyroHero(heroLayer, slots[i], st)
          : hid === 'volt' ? new VoltHero(heroLayer, slots[i], st)
            : hid === 'mora' ? new FrostHero(heroLayer, slots[i], st)
              : new ArcherHero(heroLayer, slots[i], st);
    });
    // Abilities are part of the hero. Seed legacy prerequisites locally; never write them to the save.
    this.heroes.forEach((h, i) => {
      this.stacks[h.id + '_unlock_skill'] = 1;
      this.stacks[h.id + '_unlock_ult'] = 1;
      h.charge = h.chargeGoal * Math.max(.1, ULT_INITIAL_CHARGE - i * .025);
      h.skillCd = i * .8;
    });
    this.parts = new Particles(fxLayer);
    this.projs = new ProjectileManager(projLayer, this.mgr, this.dmgSvc, this.parts, this.impacts);
    this.waves = new WaveManager(this.levelDef, this.mgr);
    for (const h of this.heroes) this.dmgSvc.register(h.id, h.name);

    this.hud = new HUD(uiRoot, this, field);
    const lootLayer = new Node('EquipmentDrops');
    lootLayer.setParent(field);
    lootLayer.setSiblingIndex(textLayer.getSiblingIndex());
    this.loot = new BattleLoot(lootLayer, uiRoot, this.levelDef,
      () => !this.leaving && this.state === 'running' && !this.gm?.panelOpen && !this.mobIntroOpen,
      text => this.hud.showBanner(text, 2.6));
    this.bossWarning = new BossWarning(uiRoot);
    this.panels = new Panels(uiRoot, this);
    this.gm = new GmPanel(uiRoot, this);
    this.coachRoot = new Node('FirstBattleCoach');
    this.coachRoot.setParent(uiRoot);

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
    bus.on(EVT.WAVE_THREAT, this.onWaveThreat, this);
    bus.on(EVT.COMIC_POP, this.onComicPop, this);
    bus.on(EVT.HIT_STOP, this.onHitStop, this);
    bus.on(EVT.ULTIMATE_BEGIN, this.onUltimateBegin, this);
    bus.on(EVT.ULTIMATE_BEAT, this.onUltimateBeat, this);

    this.hud.showBanner('敌军来袭！', 2);
    this.state = 'prepare';
    void warmPickArt(ids); // Also covers direct next-level navigation without a lobby visit.
    battleEntryReady(this.node);
  }

  onDestroy(): void {
    this.leaving = true;
    bus.off(EVT.MOB_KILLED, this.onMobKilled, this);
    bus.off(EVT.LINE_BROKEN, this.onLineBroken, this);
    bus.off(EVT.ALL_WAVES_CLEARED, this.onAllCleared, this);
    bus.off(EVT.WAVE_CHANGED, this.onWaveChanged, this);
    bus.off(EVT.WAVE_THREAT, this.onWaveThreat, this);
    bus.off(EVT.COMIC_POP, this.onComicPop, this);
    bus.off(EVT.HIT_STOP, this.onHitStop, this);
    bus.off(EVT.ULTIMATE_BEGIN, this.onUltimateBegin, this);
    bus.off(EVT.ULTIMATE_BEAT, this.onUltimateBeat, this);
    this.mgr?.destroy();
    this.ultPresentation?.clear();
  }

  /** 漫画拟声词条（各战斗模块 emit，词表/概率/主题色在 ComicPop.POP_DEFS） */
  private onComicPop(x: unknown, y: unknown, kind: unknown): void {
    this.pops.pop(x as number, y as number, kind as string);
  }

  private onUltimateBegin(value: unknown): void {
    const cue = value as UltimateCue;
    this.ultPresentation.begin(cue);
    this.ultShowT = Math.max(this.ultShowT, cue.duration + 2);
  }
  private onUltimateBeat(value: unknown): void {
    if (this.state === 'running') this.ultPresentation.beat(value as UltimateBeat);
  }
  private get ultimateActive(): boolean {
    return this.ultPresentation.active || this.heroes.some(h => h.ultimateRemaining > 0) || this.projs.ultimateInFlight;
  }
  // Only meaningful heavy contacts get a short accent; ultimate peaks add a bounded world kick.
  private hitStopT = 0;
  private hitStopCd = 0;

  private onHitStop(): void {
    if (this.hitStopCd > 0) return;
    this.hitStopT = Math.max(this.hitStopT, 0.032);
    this.hitStopCd = 0.65;
  }

  update(rawDt: number): void {
    if (this.leaving) return;
    // Prepare countdown and combat begin only after the full-screen flags have cleared.
    if (enteringBattle()) return;
    GameAudio.battleState(this.state);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.hud.setFps(Math.round(this.fpsN / this.fpsAcc));
      this.fpsAcc = 0; this.fpsN = 0;
    }

    // 掉帧毛刺不得放大模拟步长（2x 死亡螺旋根因）；超 1/30s 的模拟步拆细步防子弹穿模
    const dt = Math.min(rawDt, 1 / 30);

    // 微顿帧计时走真实时间（顿帧本身不该被自己拖长）
    const hitStopActive = this.hitStopT > 0;
    this.hitStopCd = Math.max(0, this.hitStopCd - rawDt);
    this.hitStopT = Math.max(0, this.hitStopT - rawDt);

    this.gm.syncVisibility(); // 所有状态下都要同步 GM 浮钮（三选一/结算期间隐藏）

    if (this.state === 'prepare') {
      this.ambience.tick(dt);
      for (const h of this.heroes) h.tickIdle(dt);
      this.prepareT -= dt;
      if (this.prepareT <= 0) {
        this.state = 'running';
        this.waves.start();
        if (this.teaching) this.hud.showBanner('英雄会自动攻击，守住底部防线！', 5);
        if (this.pickQueue > 0) this.openPick(); // GM 期间升级的排队三选一
      }
      return;
    }
    if (this.state !== 'running') {
      this.loot.suspend();
      this.bossWarning.tick(0, false);
      this.ultPresentation.suspend();
      if (this.state === 'win' || this.state === 'lose') this.mgr.tickDeaths(dt);
      return;
    }

    // Sample before decrement: a 32ms accent must still render one frame at 30fps.
    const readableSpeed = Math.min(this.speed, this.ultPresentation.windupSpeedLimit);
    const sdt = dt * readableSpeed * (hitStopActive ? 0.12 : 1);
    this.ambience.tick(sdt);
    this.elapsed += sdt;
    this.killBeatAge += sdt;
    this.killBeatCooldown = Math.max(0, this.killBeatCooldown - sdt);
    if (this.killBeatAge > .35) this.killBeatCount = this.killBeatX = this.killBeatY = 0;
    if (!this.pendingWin && (!this.isEndless || this.endlessRest < 0)) this.passiveXpElapsed += sdt;
    const steps = sdt > 1 / 30 ? 2 : 1;
    const sub = sdt / steps;
    for (let i = 0; i < steps; i++) {
      this.waves.tick(sub);
      this.mgr.tick(sub, this.line);
      for (const h of this.heroes) h.tick(sub, this.mgr, this.projs, this.dmgSvc);
      // GM 常开开关：tick 可能重置 CD/扣充能，故 tick 后强制。
      // 无冷却并非零 CD：压到 1s 内置冷却，避免技能每帧连发（用户反馈）。
      if (this.gmNoSkillCd) for (const h of this.heroes) h.skillCd = Math.min(h.skillCd, 1);
      if (this.gmUltFull) for (const h of this.heroes) h.charge = h.ultUnlocked ? h.chargeGoal : 0;
      this.projs.tick(sub, this.line);
      this.parts.tick(sub);
      this.impacts.syncBurns(this.mgr.list, sub);
      this.impacts.tick(sub);
      this.ultPresentation.tick(sub);
      this.line.regenPct = this.global.lineRegenPct;
      this.line.tick(sub);
    }
    if (this.state === 'running') this.loot.tick(sdt);
    // 大招演出锁倒计时；期间排队的升级三选一挂起，锁走完自动补弹
    if (this.ultShowT > 0) this.ultShowT = Math.max(0, this.ultShowT - sdt);
    if (this.ultimateActive) this.ultShowT = Math.max(this.ultShowT, 2);
    if (this.pendingWin && !this.ultimateActive && this.state === 'running') {
      if (this.isEndless) this.completeEndlessFloor(); else this.onAllCleared();
    }
    // Grant after combat steps: a timed level-up must not interrupt a simulation substep.
    this.grantTimeXp();
    if (this.pickQueue > 0 && !this.pendingWin && this.ultShowT <= 0 && !this.gm.panelOpen && this.state === 'running') this.openPick();
    if (this.isEndless && this.endlessRest >= 0 && this.state === 'running') {
      this.endlessRest = Math.max(0, this.endlessRest - sdt);
      if (this.endlessRest === 0 && !this.pickQueue && this.ultShowT <= 0 && !this.gm.panelOpen) {
        this.endlessFloor++; this.endlessRest = -1;
        this.levelDef.waves = [endlessWave(this.endlessChapter, this.endlessFloor)];
        this.waves = new WaveManager(this.levelDef, this.mgr);
        this.waves.start();
        this.hud.showBanner('第' + this.endlessFloor + '层' + (this.endlessFloor % 5 === 0 ? ' · 首领层' : ' · 敌军来袭'), 2);
      }
    }
    this.float.tick(rawDt);
    this.pops.tick(rawDt);
    this.hud.sync(rawDt);
    this.bossWarning.tick(rawDt, this.state === 'running' && !this.gm.panelOpen);
    this.offerUltimateLesson();
  }

  /** Event/state driven: never pause inside damage, picking, loading or an ultimate presentation. */
  private offerUltimateLesson(): void {
    const second = this.secondTeaching, third = this.thirdTeaching;
    const journey = third ? loadSave().thirdJourney! : second ? loadSave().secondJourney! : loadSave().firstJourney!;
    if ((!this.teaching && !second && !third) || this.ultFocusShown || journey.ultCast
      || this.state !== 'running' || this.pickQueue > 0 || this.pendingWin || this.ultShowT > 0
      || this.ultimateActive || this.gm.panelOpen || this.mobIntroOpen || this.mgr.aliveCount < 1) return;
    const index = this.heroes.findIndex(h => h.id === (third ? 'pyro' : second ? 'sniper' : 'archer'));
    if (index < 0 || !this.heroes[index].ultReady) return;
    const target = this.hud.ultimateTarget(index);
    if (!target) return;
    const focus = tutorialFocus(this.coachRoot, target,
      third ? '陨石天降已就绪！点击火法师大招，轰击敌群并留下灼烧区域。'
        : second ? '猎杀时刻已就绪！点击重弩手大招，穿透前方敌群。' : '箭雨已就绪！点击发光的大招按钮，清扫敌群。',
      () => { this.state = 'running'; this.hud.activateUltimate(index); },
      () => {
        if (third) skipThirdBattleTeaching(); else if (second) skipSecondBattleTeaching(); else skipBattleTeaching();
        this.state = 'running';
      });
    if (focus) { this.panels.closeAll(); this.ultFocusShown = true; this.state = 'tutorial'; }
  }

  /* ---------- 击杀 → 金币/经验/充能（§3.7/§3.8/§3.10） ---------- */
  private onMobKilled(def: unknown, killerId: unknown, position: unknown): void {
    if (this.isEndless && (this.state === 'win' || this.state === 'lose')) return;
    const d = def as MobDef;
    if (d.offspring) return;
    this.goldEarned += d.gold * this.global.goldMul * DIFFICULTIES[this.levelDef.difficulty].goldMul;
    if (killerId !== 'gm' && position && this.state === 'running') this.loot.onKill(d, position as DeathPosition);
    if (killerId !== 'gm') {
      const share = d.charge * SHARED_KILL_CHARGE / Math.max(1, this.heroes.length);
      for (const hero of this.heroes) hero.chargeKill(share * (1 + (hero.stats.chargeEff || 0)));
      if (position && this.state === 'running' && this.killBeatCooldown <= 0) {
        const p = position as DeathPosition;
        if (!this.killBeatCount) this.killBeatAge = 0;
        this.killBeatCount++; this.killBeatX += p.x; this.killBeatY += p.y;
        if (this.killBeatCount >= 5) {
          this.impacts.combatFeedback('groupKill', this.killBeatX / this.killBeatCount, this.killBeatY / this.killBeatCount, 52);
          bus.emit(EVT.HIT_STOP);
          this.killBeatCount = this.killBeatX = this.killBeatY = 0;
          this.killBeatCooldown = .9;
        }
      }
    }
    this.gainXp(d.exp * this.global.xpMul);
  }

  private onWaveChanged(cur: unknown, total: unknown, surge: unknown): void {
    this.hud.setWave(cur as number, total as number);
    const wave = this.levelDef.waves[(cur as number) - 1];
    const enemies = (wave?.groups || []).map(g => MOBS[g.mob]).filter(Boolean);
    const hints: [string, boolean, string][] = [
      ['armor', enemies.some(d => !!d.physRes), '重甲来袭：法术绕过物抗，物理集火可破甲'],
      ['rush', enemies.some(d => !!d.rush), '冲锋来袭：冰封、眩晕可打断，减速可延缓'],
      ['heal', enemies.some(d => d.kind === 'heal'), '治疗单位来袭：用大招覆盖后排，阻断续航'],
    ];
    const hint = hints.find(([id, present]) => present && !this.roleHints.has(id));
    if (hint) {
      this.roleHints.add(hint[0]); this.hud.showBanner(hint[2], 3);
    } else if (surge && !this.waves.hasThreat) {
      this.hud.showBanner('敌军大部队来袭！', 2);
    }
  }

  private onWaveThreat(threat: unknown): void {
    const value = threat as WaveThreat;
    this.bossWarning.show(this.isEndless ? { ...value, floor: this.endlessFloor } : value);
  }

  private gainXp(v: number): void {
    this.xpEarned += v;
    this.xp += v;
    let need = this.expNeed(this.heroLevel);
    while (this.xp >= need) {
      this.xp -= need;
      this.heroLevel++;
      for (const hero of this.heroes) { hero.stats.atkMul *= 1.025; hero.stats.skillMul *= 1.025; }
      if (!this.endlessCardsComplete) this.pickQueue++;
      Sfx.play('levelup');
      need = this.expNeed(this.heroLevel);
      bus.emit(EVT.LEVEL_UP, this.heroLevel);
    }
    // update() drains this queue after combat substeps; never build a modal inside a hit/death callback.
  }

  private expNeed(l: number): number {
    return expNeed(l);
  }

  private grantTimeXp(): void {
    if (this.leaving || this.state !== 'running' || this.pendingWin) return;
    // Carry the fraction across pauses; no wall-clock timers or background catch-up.
    while (this.passiveXpElapsed + 1e-8 >= PASSIVE_XP_INTERVAL && this.state === 'running') {
      this.passiveXpElapsed = Math.max(0, this.passiveXpElapsed - PASSIVE_XP_INTERVAL);
      this.gainXp(passiveXpGain(this.heroLevel) * this.global.xpMul);
    }
  }

  /* ---------- 三选一（§3.8：全场冻结，连升排队；广告刷新×1+钻石刷新×1） ---------- */
  private openPick(): void {
    if (this.state !== 'running' || this.pendingWin || this.ultShowT > 0) return;
    if (!M0_POOL.some(c => (c.owner === 'global' || this.heroes.some(h => h.id === c.owner)) && canTakeCard(c, this.stacks))) {
      this.pickQueue = 0; this.endlessCardsComplete = true;
      this.panels.closeAll(true);
      this.hud.showBanner('本局可选强化已全部学满，继续挑战！', 3);
      return;
    }
    this.state = 'pick';
    // §3.8：三选一 = 上阵英雄卡池混合 + 全局卡（未上阵英雄的卡不出现；首抽与刷新共用同一过滤池）
    const pool = M0_POOL.filter(c => c.owner === 'global' || this.heroes.some(h => h.id === c.owner));
    this.pickNumber++;
    const opts: PickOpts = {
      onPick: (card: CardDef) => {
        if (this.state !== 'pick' || !this.applyCard(card)) return;
        // PickMotion owns the single confirmation at the selected card's landing.
        this.stacks[card.id] = (this.stacks[card.id] || 0) + 1;
        if (this.teaching && !loadSave().firstJourney!.freeChargeUsed) {
          const archer = this.heroes.find(h => h.id === 'archer');
          if (archer) {
            archer.charge = archer.chargeGoal;
            loadSave().firstJourney!.freeChargeUsed = true;
          }
        }
        if (this.secondTeaching && !loadSave().secondJourney!.freeChargeUsed) {
          const sniper = this.heroes.find(h => h.id === 'sniper');
          if (sniper) { sniper.charge = sniper.chargeGoal; loadSave().secondJourney!.freeChargeUsed = true; }
        }
        if (this.thirdTeaching && !loadSave().thirdJourney!.freeChargeUsed) {
          const pyro = this.heroes.find(h => h.id === 'pyro');
          if (pyro) { pyro.charge = pyro.chargeGoal; loadSave().thirdJourney!.freeChargeUsed = true; }
        }
        this.pickQueue--;
        saveSave();
        this.hud.sync(); // 强化后立即刷新状态，即使后面还有排队三选一。
        this.state = 'running';
        if (this.pickQueue > 0) this.openPick();
        else { this.panels.closeAll(true); this.state = 'running'; }
        if (this.teaching && card.id === 'serial')
          this.hud.showBanner('连射已强化！技能自动释放，大招充满后点击使用。', 5);
        if (this.thirdTeaching && card.id === 'pyro_shards')
          this.hud.showBanner('爆裂火球增加！基础技能开场即可使用。', 5);
      },
      onRefreshRequest: () => {
        showOffer();
      },
    };
    const showOffer = (): void => {
      const lessons = this.thirdTeaching ? ['pyro_shards', 'pyro_burn']
        : this.secondTeaching ? ['sniper_pierce', 'multi_lock'] : ['serial', 'fan'];
      const desired = lessons[Math.min(this.pickNumber - 1, lessons.length - 1)];
      const missing = lessons.filter(id => !(this.stacks[id] > 0));
      const lessonId = missing.includes(desired) ? desired : missing[0];
      const lesson = (this.teaching || this.secondTeaching || this.thirdTeaching) && pool.find(c => c.id === lessonId && canTakeCard(c, this.stacks));
      const cards = draw3(pool, this.stacks);
      opts.recommendedId = lesson ? lesson.id : undefined;
      opts.onSkipTeaching = (this.teaching || this.secondTeaching || this.thirdTeaching) ? () => {
        if (this.thirdTeaching) skipThirdBattleTeaching(); else if (this.secondTeaching) skipSecondBattleTeaching(); else skipBattleTeaching();
        showOffer();
      } : undefined;
      this.panels.showPick(lesson ? [lesson, ...cards.filter(c => c.id !== lesson.id)].slice(0, 3) : cards, this.stacks, opts);
    };
    this.pickOpts = opts;
    this.hud.sync(); // 冻结期间 HUD 不轮询，升级瞬间把经验条/等级刷到位
    this.panels.resetPickRefresh();
    showOffer();
  }

  /** Panels 回调入口：广告/钻石刷新（次数限制在 Panels 内部控制） */
  requestRefresh(): void {
    if (this.pickOpts) this.pickOpts.onRefreshRequest();
  }

  private applyCard(card: CardDef): boolean {
    // 卡按归属路由：'archer'/'sniper' 改写对应英雄属性，'global' 不触及英雄数值
    const owner = this.heroes.find(h => h.id === card.owner);
    if ((!owner && card.owner !== 'global') || !canTakeCard(card, this.stacks)) return false;
    const ctx: CardCtx = {
      hero: owner ? owner.stats : this.heroes[0].stats,
      global: this.global,
      line: {
        healPct: p => this.line.healPct(p),
        addMaxMul: m => this.line.addMaxMul(m),
      },
    };
    card.apply(ctx);
    if (owner) {
      owner.charge = Math.min(owner.charge, owner.chargeGoal);
      owner.skillCd = Math.min(owner.skillCd, owner.skillCdTotal);
    }
    if (owner && card.unlocks === 'skill') owner.skillCd = 0;
    if (owner && card.unlocks === 'ult') owner.charge = 0;
    return true;
  }

  /* ---------- 大招（手动，充能满可放；未满点图标→Tips） ---------- */
  tryCastUlt(idx = 0): 'ok' | 'charging' | 'locked' {
    if (this.state !== 'running' || this.pendingWin) return 'charging';
    const h = this.heroes[idx];
    if (!h?.ultUnlocked) return 'locked';
    if (h && h.ultReady && h.castUlt(this.mgr, this.projs, this.dmgSvc)) {
      // Each hero owns its actual release cue; tapping starts only its windup.
      // 演出锁：大招期间三选一挂起（时长由各英雄自报），结束后再等 2s 缓冲补弹（用户要求：一结束就弹太突兀）
      this.ultShowT = Math.max(this.ultShowT, h.ultShowDuration + 2);
      if (this.teaching && h.id === 'archer') {
        loadSave().firstJourney!.ultCast = true; saveSave();
      }
      if (this.secondTeaching && h.id === 'sniper') {
        loadSave().secondJourney!.ultCast = true; saveSave();
      }
      if (this.thirdTeaching && h.id === 'pyro') {
        loadSave().thirdJourney!.ultCast = true; saveSave();
      }
      return 'ok';
    }
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
        onResume: () => { this.panels.closeAll(true); this.state = 'running'; },
        onExit: () => this.exitBattle(),
        music: sv.music,
        sfx: sv.sfx,
        onToggle: (k: 'music' | 'sfx', v: boolean) => { const s2 = loadSave(); s2[k] = v; saveSave(); GameAudio.settingsChanged(); },
        tab: 0,
        speed: this.speed,
        speedUnlocked: !!(sv.speedUnlocked || sv.debug),
        xp: Math.floor(this.xpEarned),
        loot: this.loot.summary(),
      });
    } else if (this.state === 'paused') {
      this.panels.closeAll(true);
      this.state = 'running';
    }
  }

  showStats(): void {
    this.panels.showStats(this.dmgSvc.rows());
  }

  showTips(kind: 'atk' | 'skill' | 'ult', idx = 0): void {
    const hero = this.heroes[idx] || this.heroes[0];
    if (!hero || (kind === 'skill' && !hero.skillUnlocked) || (kind === 'ult' && !hero.ultUnlocked)) return;
    this.panels.showTips(kind, hero, this.line, idx);
  }

  /* ---------- 失败 → 复活留在本局，重试先回当前关卡页 ---------- */
  private onLineBroken(): void {
    if (this.state === 'win' || this.state === 'lose') return;
    if (this.isEndless) { this.finishEndless(); return; }
    this.state = 'lose'; this.pendingWin = false;
    this.bossWarning.clear();
    this.ultPresentation.clear();
    const goldFloor = Math.floor((this.levelDef.baseGold + this.goldEarned) * .3);
    this.creditBattleGold(goldFloor);
    const loot = this.loot.collectAll();
    this.panels.showLose({
      goldFloor,
      loot,
      reviveRatio: REVIVE_RATIO,
      onRevive: (done: (ok: boolean) => void) => {
        AdService.showRewarded('revive', () => {
          if (this.leaving || !isValid(this, true)) return;
          this.line.revive();
          this.panels.closeAll(true);
          this.state = 'running';
          done(true);
        }, () => { if (!this.leaving && isValid(this, true)) done(false); });
      },
      onRetry: () => this.exitBattle(),
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
    // Drain after the combat substeps and the final ultimate have finished.
    if (this.isEndless) {
      if (this.endlessCleared < this.endlessFloor) this.pendingWin = true;
      return;
    }
    if (this.ultimateActive) { this.pendingWin = true; return; }
    this.pendingWin = false; this.ultPresentation.clear();
    this.state = 'win';
    this.bossWarning.clear();
    const stars = starOf(this.line.ratio);
    const battleGold = Math.floor(this.goldEarned + this.levelDef.baseGold * (1 + stars * 0.1));
    const sv = loadSave();
    const loot = this.loot.collectAll();
    const sk = starKey(this.levelDef.id, this.levelDef.difficulty);
    const firstWinGold = claimEarlyFirstWinGold(this.levelDef.id, this.levelDef.difficulty, sv.stars[sk] || 0);
    const reward = battleGold + firstWinGold;
    const firstGift = firstLevelVictory(this.levelDef.id, this.levelDef.difficulty, sv.stars[sk] || 0);
    if (firstGift) loot.equipment.push(firstGift);
    if (secondLevelVictory(this.levelDef.id, this.levelDef.difficulty)) loot.heroes = ['pyro'];
    const thirdGift = thirdLevelVictory(this.levelDef.id, this.levelDef.difficulty, sv.stars[sk] || 0);
    if (thirdGift) loot.equipment.push(thirdGift);
    loot.equipment.push(...fifthLevelVictory(this.levelDef.id, this.levelDef.difficulty, sv.stars[sk] || 0));
    sv.stars[sk] = Math.max(sv.stars[sk] || 0, stars);
    if (this.levelDef.id === '1-2') sv.speedUnlocked = true;
    // Only this guarded win transition grants diamonds; panel redraws and ads never grant them again.
    sv.diamonds += this.levelDef.baseDiamonds;
    // Diamonds/first-win receipts/stars/equipment share this write; gold keeps its existing delta guard.
    this.creditBattleGold(reward);
    saveSave();
    advanceUnlock(this.levelDef.id);   // 通关推进主线解锁（商店英雄/装备的"通关 X 解锁"）

    this.panels.showWin({
      stars,
      loot,
      gold: reward,
      diamonds: this.levelDef.baseDiamonds,
      firstWinGold,
      ratio: this.line.ratio,
      onDouble: (done: (ok: boolean) => void) => {
        AdService.showRewarded('double', () => {
          if (this.leaving || !isValid(this, true) || this.doubleRewarded) return;
          this.doubleRewarded = true;
          this.creditBattleGold(reward * 2);
          done(true);
        }, () => { if (!this.leaving && isValid(this, true)) done(false); });
      },
      onExit: () => this.exitBattle(),
    });
  }

  private completeEndlessFloor(): void {
    if (!this.isEndless || this.endlessCleared >= this.endlessFloor) return;
    this.pendingWin = false; this.endlessCleared = this.endlessFloor; this.endlessRest = 3;
    this.bossWarning.clear();
    // Delta payment and a per-chapter best survive leaving or refreshing between floors.
    this.creditBattleGold(this.goldEarned);
    recordEndlessFloor(this.endlessChapter, this.endlessCleared);
    this.loot.collectAll();
    this.hud.showBanner('第' + this.endlessCleared + '层通过 · 3秒后继续', 2.8);
  }

  private finishEndless(): void {
    if (!this.isEndless || this.state === 'lose' || this.state === 'win' || this.leaving) return;
    this.state = 'lose'; this.pendingWin = false; this.endlessRest = -1;
    this.bossWarning.clear(); this.ultPresentation.clear();
    this.creditBattleGold(this.goldEarned);
    const loot = this.loot.collectAll();
    this.panels.showEndless({ cleared: this.endlessCleared, floor: this.endlessFloor,
      best: endlessBest(this.endlessChapter), newBest: this.endlessCleared > this.endlessStartingBest,
      gold: Math.floor(this.goldEarned), loot, onExit: () => this.changeScene('main', this.battleSceneId, 0) });
  }

  /* ---------- GM 后台（GmPanel 专用入口） ---------- */
  /** 面板关闭：恢复战斗；升级队列待处理则弹三选一 */
  gmResume(): void {
    if (this.state === 'paused') this.state = 'running';
    if (this.pickQueue > 0 && this.ultShowT <= 0) this.openPick();
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
      if (!this.applyCard(def)) break;
      this.stacks[id] = (this.stacks[id] || 0) + 1;
    }
    this.hud.sync();
  }

  gmUltCharge(v: number): void {
    for (const h of this.heroes) h.charge = h.ultUnlocked ? Math.min(h.chargeGoal, v) : 0;
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
    if (this.isEndless && this.state !== 'lose' && this.state !== 'win') { this.finishEndless(); return; }
    // After a chapter-ending victory, focus the newly available chapter without starting battle.
    const completed = campaignStage(this.levelDef.id);
    const next = completed && CAMPAIGN_STAGES[completed.order + 1];
    if (!this.isEndless && this.state === 'win' && completed && next && next.chapter !== completed.chapter
      && campaignLevelOpen(next.id, loadSave().stars)) {
      this.changeScene('main', next.id, 0);
      return;
    }
    this.changeScene('main', this.levelDef.id, flow.diff);
  }

  /** Pay only the unpaid difference; UI rebuilds and repeated losses cannot mint the same reward twice. */
  private creditBattleGold(total: number): void {
    const target = Math.max(0, Math.floor(total)), amount = Math.max(0, target - this.goldSettled);
    if (!amount) return;
    loadSave().gold += amount;
    this.goldSettled = target;
    saveSave();
  }

  /** One pending navigation per battle, including settlement double taps. */
  private changeScene(mode: 'main' | 'battle', levelId = flow.levelId, diff = flow.diff): void {
    if (this.leaving || enteringBattle() || !isValid(this, true)) return;
    this.loot.collectAll();
    const previous = { ...flow };
    this.leaving = true;
    GameAudio.battleState('leaving');
    flow.mode = mode; flow.levelId = levelId; flow.diff = diff;
    if (mode === 'main') {
      const bowLesson = !this.isEndless && pendingBowLesson();
      flow.mainTab = bowLesson ? 1 : 2;
      flow.levelReturn = bowLesson ? null : { id: levelId, diff };
      if (!this.isEndless && !bowLesson && pendingPyroSquadLesson()) flow.levelReturn = { id: '1-3', diff: 0 };
      if (bowLesson) { loadSave().curHero = 'archer'; saveSave(); }
      flow.endlessPage = this.isEndless;
      if (this.isEndless) { flow.mainTab = 4; flow.levelReturn = null; }
      flow.endlessChapter = 0;
    }
    const failed = (error?: Error | null): void => {
      if (!error || !isValid(this, true)) return;
      Object.assign(flow, previous); this.leaving = false;
      GameAudio.battleState(this.state);
      this.hud.showBanner('切换失败，请重试', 2);
      console.warn('[Battle] Scene navigation failed', error);
    };
    if (mode === 'main') {
      leaveBattle(done => director.loadScene('Main', done),
        () => failed(new Error('Scene return transition failed')));
    } else if (!director.loadScene('Main', failed)) failed(new Error('Scene request rejected'));
  }
}

/** 伤害统计行透出（HUD/Panels 用） */
export type { DamageRow };

/** 基础数值由 heroStats 聚合；这里仅补齐范围、暴击、充能等装备词条。 */
function applyEquipAffixes(s: HeroStats, hid: string): void {
  const a = equipAgg(hid);
  // 攻击、技能伤害和攻速已由 heroStats 聚合，避免装备被算两次。
  s.range += a.rangeFlat;
  s.critRate = Math.min(1, s.critRate + a.critRate);
  s.critMul += a.critDmg;
  s.chargeEff += a.chargeEff;
}

/** 两项基础值沿用面板的定位成长、武器成长及装备聚合；机制突破在下方应用。 */
function applyHeroGrowth(s: HeroStats, hid: string): void {
  const hs = heroState(hid);
  const bt = heroBtAgg(hid, hs.lv);
  const basis = heroStats(hid);
  s.atk = basis.atk; s.skillDmg = basis.skillDmg; s.aspd = basis.atkSpd;
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
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.rangeOn) s.range = Math.round(s.range * 1.08);   // 15级 普攻索敌范围+8%（技能索敌不动）
    if (hs.skillLv >= 5) s.skillCdFlat += 1;          // 技能5级 冷却-1s
    if (hs.ultLv >= 15) s.chargeMul *= 0.9;           // 大招15级 充能-10%
  } else if (hid === 'sniper') {
    const ac = sniperAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.fullHpOn) s.fullHpBonus = 0.25;            // 15级 对满血目标+25%
    if (hs.skillLv >= 5) s.skillCdFlat += 1;          // 技能5级 冷却-1s
    if (hs.ultLv >= 15) s.chargeMul *= 0.9;           // 大招15级 充能-10%
    s.skillShots += sniperSkCfg(hs.skillLv).shots - 6;   // 技能10级 连狙+2发（折进 stats，与多目标锁定卡同字段——面板/战斗共用）
  } else if (hid === 'volt') {
    const ac = voltAtkCfg(hs.atkLv);
    s.normalMul = ac.normalMul;                       // 普攻伤害：每级+8%、20级再+20%
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
    if (ac.critOn) s.critRate = Math.min(1, s.critRate + 0.05);   // 10级 暴击率+5%
    if (ac.slowedOn) s.slowedBonus = 0.25;            // 15级 对减速目标+25%
    if (moraSkCfg(hs.skillLv).cdOn) s.skillCdFlat += 1;   // 技能5级 冷却-1s
    if (moraUltCfg(hs.ultLv).chargeOn) s.chargeMul *= 0.9;   // 大招15级 充能-10%
    if (bt.slowMul !== 1) s.slowOnHit = (s.slowOnHit || 0) * bt.slowMul;   // 30级 冰寒刺骨
    if (bt.novaR) s.novaR = Math.max(s.novaR, bt.novaR);   // 60级 领域范围150→190
    if (bt.freezeProc) s.freezeProc = bt.freezeProc;       // 70级 普攻概率冰冻
    if (bt.stunBonus) s.novaStun += bt.stunBonus;          // 80级 冻结+0.4s
    if (bt.slowOnAtk) s.slowOnHit = Math.max(s.slowOnHit || 0, bt.slowOnAtk);   // 90级 冰寒之躯
  }
}
