from pathlib import Path

GAME = Path(__file__).resolve().parents[2]
def edit(name, fn):
    path = GAME/name
    path.write_text(fn(path.read_text(encoding='utf-8-sig')), encoding='utf-8')
def sub(s, old, new):
    if old not in s: raise RuntimeError('Source anchor missing: ' + old[:100])
    return s.replace(old, new, 1)

def heroes(s):
    s = sub(s, "import { drawSniperUltimateLock } from './SniperUltimateVFX';", "import { drawSniperUltimateLock } from './SniperUltimateVFX';\nimport { ULT_TIMING, ARCHER_ULT_ROW_GAP, ARCHER_ULT_ROUND_GAP, METEOR_ULT_GAP } from './UltimateTiming';")
    s = sub(s, 'interface PendingVolley { t: number; row: 0 | 1 | 2; }', 'interface PendingVolley { t: number; row: 0 | 1 | 2; first?: boolean; last?: boolean; }')
    s = sub(s, '  private attackPoseT = 0;', '  private attackPoseT = 0;\n  private ultimateT = 0;')
    s = sub(s, 'get ultReady(): boolean { return this.ultUnlocked && this.charge >= this.chargeGoal; }', 'get ultReady(): boolean { return this.ultUnlocked && this.charge >= this.chargeGoal && this.ultimateRemaining <= 0; }')
    s = sub(s, '  get ultShowDuration(): number { return 1.2; }', '''  get ultShowDuration(): number { return ULT_TIMING[this.id].duration; }
  get ultimateRemaining(): number { return this.ultimateT; }
  protected beginUltimate(duration = this.ultShowDuration): void {
    this.ultimateT = duration;
    const windup = ULT_TIMING[this.id].windup;
    bus.emit(EVT.ULTIMATE_BEGIN, { hero: this.id, x: this.x, y: HERO_Y + 60, windup, duration });
    Sfx.prepareUltimate(this.id, windup);
  }
  protected ultimateBeat(x: number, y: number, energy = .5, contact = false): void {
    bus.emit(EVT.ULTIMATE_BEAT, { hero: this.id, x, y, energy, contact });
  }''')
    s = sub(s, '    this.lastDmg = dmg;\n    this.tickPose(dt, mgr);', '''    this.lastDmg = dmg;
    if (this.ultimateT > 0) {
      this.ultimateT = Math.max(0, this.ultimateT - dt);
      if (this.ultimateT === 0 && this.ultReady) {
        bus.emit(EVT.CHARGE_CHANGED, this.chargePct, true); Sfx.play('ready');
      }
    }
    this.tickPose(dt, mgr);''')
    s = sub(s, 'if (!this.ultUnlocked || this.ultReady) return;', 'if (!this.ultUnlocked || this.charge >= this.chargeGoal) return;')
    a, b = s.split('export class SniperHero', 1)
    a = sub(a, 'this.fireFanRow(projs, v.row);', 'this.fireFanRow(projs, v.row, !!v.first, !!v.last);')
    a = sub(a, '    if (!this.ultReady) return false;\n    this.charge = 0;', '    if (!this.ultReady || !_mgr.list.some(m => !m.dead)) return false;\n    this.charge = 0;\n    this.beginUltimate();')
    a = sub(a, 'for (let w = 0; w < rows; w++) this.volleyQueue.push({ t: r * 0.8 + w * 0.35, row: w as 0 | 1 | 2 });', '''for (let w = 0; w < rows; w++) this.volleyQueue.push({
        t: ULT_TIMING.archer.windup + r * ARCHER_ULT_ROUND_GAP + w * ARCHER_ULT_ROW_GAP,
        row: w as 0 | 1 | 2, first: r === 0 && w === 0, last: r === rounds - 1 && w === rows - 1 });''')
    a = sub(a, '    Sfx.cast(this.id, true);\n    void _dmg;', '    void projs; void _dmg;')
    a = sub(a, '  private fireFanRow(projs: ProjectileManager, row: 0 | 1 | 2): void {', '''  get ultShowDuration(): number {
    return ULT_TIMING.archer.duration + (Math.max(1, this.stats.ultRounds || 1) - 1) * ARCHER_ULT_ROUND_GAP
      + (archerUltCfg(this.stats.ultLv).rows - 2) * ARCHER_ULT_ROW_GAP;
  }
  private fireFanRow(projs: ProjectileManager, row: 0 | 1 | 2, first: boolean, last: boolean): void {''')
    a = sub(a, '    Sfx.shoot(this.id);\n    const uc = archerUltCfg', '''    if (first) Sfx.cast(this.id, true); else Sfx.shoot(this.id);
    this.ultimateBeat(this.x, HERO_Y + 60, last ? .8 : .55);
    const uc = archerUltCfg''')
    a = sub(a, '        ability: true,   // 大招箭雨击杀弹 60% 词条', '        ability: true, ult: true,')
    sn, rest = b.split('export class PyroHero', 1)
    sn = sn.replace('0.5s', '1.1s').replace('0.5s', '1.1s')
    sn = sub(sn, '1 - L.t / 0.5', '1 - L.t / ULT_TIMING.sniper.windup')
    sn = sub(sn, '    Sfx.play(\'snipe\');\n  }\n\n  /** 瞬击一发', "    Sfx.cast(this.id, true);\n    this.ultimateBeat(this.x, HERO_Y + 60, .65);\n  }\n\n  /** 瞬击一发")
    sn = sub(sn, '    this.ultLock = { t: 0.5,', '    this.beginUltimate();\n    this.ultLock = { t: ULT_TIMING.sniper.windup,')
    py, rest = rest.split('export class VoltHero', 1)
    py = sub(py, 'private meteorQueue: { t: number; x: number; y: number; fired?: boolean }[]', 'private meteorQueue: { t: number; x: number; y: number; fired?: boolean; first?: boolean; last?: boolean }[]')
    py = sub(py, '          this.meteorQueue.splice(index, 1);', '''          this.meteorQueue.splice(index, 1);
          this.ultimateBeat(q.x, q.y, q.last ? 1 : q.first ? .85 : .35, true);''')
    py = sub(py, '        q.fired = projs.fire(spec);', '''        q.fired = projs.fire(spec);
        if (q.fired) {
          this.animateAttack(true, q.x - this.x, q.y - HERO_Y - 60);
          if (q.first) Sfx.cast(this.id, true);
        }''')
    old = '''    if (!this.meteorQueue.length) return .5 + (uc.meteors - 1) * .32 + (SPAWN_Y + 50 - LINE_Y) / METEOR_SPEED;
    return this.meteorQueue.reduce((last, q) => Math.max(last,
      (q.fired ? 0 : Math.max(0, q.t)) + (SPAWN_Y + 50 - q.y) / METEOR_SPEED), 0);'''
    py = sub(py, old, '''    if (!this.meteorQueue.length) return Math.max(ULT_TIMING.pyro.duration,
      ULT_TIMING.pyro.windup + (uc.meteors - 1) * METEOR_ULT_GAP + (SPAWN_Y + 50 - LINE_Y) / METEOR_SPEED + .8);
    return Math.max(ULT_TIMING.pyro.duration, this.meteorQueue.reduce((last, q) => Math.max(last,
      (q.fired ? 0 : Math.max(0, q.t)) + (SPAWN_Y + 50 - q.y) / METEOR_SPEED), 0) + .8);''')
    py = sub(py, '    this.animateAttack(true, drops[0].x - this.x, drops[0].y - (HERO_Y + 60));\n', '')
    py = sub(py, '    this.meteorQueue.push(...drops);', '''    drops.forEach((q, i) => this.meteorQueue.push({ ...q, first: i === 0, last: i === drops.length - 1 }));
    this.beginUltimate();''')
    py = sub(py, '    Sfx.cast(this.id, true);\n    void _projs;', '    void _projs;')
    py = sub(py, 'const delay = .5 + k * .32;', 'const delay = ULT_TIMING.pyro.windup + k * METEOR_ULT_GAP;')
    vo, fr = rest.split('export class FrostHero', 1)
    vo = sub(vo, 'private strikeQueue: { t: number; target: Monster | null }[]', 'private strikeQueue: { t: number; target: Monster | null; index: number }[]')
    vo = sub(vo, '        this.thunderStrike(t, mgr, projs);', '''        if (q.index === 0) Sfx.cast(this.id, true);
        this.thunderStrike(t, mgr, projs, q.index >= 10 ? 1.16 : 1);
        this.ultimateBeat(t.x, t.depthY, q.index === 14 ? 1 : q.index === 0 ? .85 : .3, true);''')
    vo = sub(vo, 'private thunderStrike(t: Monster, mgr: MonsterManager, projs: ProjectileManager): void', 'private thunderStrike(t: Monster, mgr: MonsterManager, projs: ProjectileManager, power = 1): void')
    vo = sub(vo, 'projs.voltThunder(t.x, t.y, SPAWN_Y + 140, t.depthY, 90 * uc.rMul);', 'projs.voltThunder(t.x, t.y, SPAWN_Y + 140, t.depthY, 90 * uc.rMul, power);')
    vo = sub(vo, '    this.charge = 0;\n    bus.emit(EVT.CHARGE_CHANGED, 0, false);', '    this.charge = 0;\n    this.beginUltimate();\n    bus.emit(EVT.CHARGE_CHANGED, 0, false);')
    vo = sub(vo, '      this.strikeQueue.push({ t: 0.1 + k * 0.08, target: t });', '''      const group = Math.floor(k / 5), within = k % 5;
      this.strikeQueue.push({ t: [.65, 1.95, 3.15][group] + within * [.2, .17, .16][group], target: t, index: k });''')
    vo = sub(vo, '    Sfx.cast(this.id, true);\n    void projs;', '    void projs;')
    fr = sub(fr, '  readonly skillMax = 10;', '  readonly skillMax = 10;\n  private ultimateBurstT = -1;')
    start = fr.index('  /** 大招·极寒领域：')
    fr = fr[:start] + '''  /** Windup ends at the first rain contacts; one real field hit, unchanged multipliers/slow. */
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    if (this.ultimateBurstT < 0) return;
    this.ultimateBurstT -= dt;
    if (this.ultimateBurstT > 0) return;
    this.ultimateBurstT = -1;
    const alive = mgr.list.filter(m => !m.dead);
    projs.frostUltimateBurst(alive.map(m => ({ x: m.x, y: m.depthY, radius: m.def.radius })));
    if (alive[0]) this.animateAttack(true, alive[0].x - this.x, alive[0].y - HERO_Y - 60);
    const uc = moraUltCfg(this.stats.ultLv);
    for (const m of alive) {
      const hpBefore = m.hp, d = this.abilityDamage(uc.boltMul, true);
      m.takeDamage(d, false, this.id, false, 0, -Math.PI / 2, true);
      this.lastDmg?.add(this.id, Math.min(d, hpBefore));
      if (!m.dead) m.applySlow(this.slowR(uc.slowMul), uc.slowDur + (this.stats.ultSlowDur || 0));
    }
    Sfx.cast(this.id, true);
    this.ultimateBeat(this.x, HERO_Y + 60, .8);
    bus.emit(EVT.HIT_STOP);
  }
  protected queuedShotDelay(): number { return this.ultimateBurstT >= 0 ? this.ultimateBurstT : Infinity; }
  castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;
    this.charge = 0; this.lastDmg = dmg;
    this.beginUltimate();
    this.ultimateBurstT = ULT_TIMING.mora.windup;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    projs.frostUltimate(alive.map(m => ({ x: m.x, y: m.depthY, radius: m.def.radius })));
    return true;
  }
}
'''
    return a + 'export class SniperHero' + sn + 'export class PyroHero' + py + 'export class VoltHero' + vo + 'export class FrostHero' + fr

edit('assets/scripts/battle/Hero.ts', heroes)
edit('assets/scripts/core/EventBus.ts', lambda s: sub(s, "  HIT_STOP: 'hit_stop',", "  ULTIMATE_BEGIN: 'ultimate_begin', // (UltimateCue) accepted manual/automatic cast\n  ULTIMATE_BEAT: 'ultimate_beat',   // (UltimateBeat) actual release/contact\n  HIT_STOP: 'hit_stop',"))
edit('assets/scripts/ui/Panels.ts', lambda s: sub(s, "'0.5 秒锁定 → 贯穿弹'", "'1.1 秒锁定 → 重击贯穿弹'"))
