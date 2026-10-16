from pathlib import Path
import json, uuid
GAME = Path(__file__).resolve().parents[2]
def sub(s, old, new):
    if old not in s: raise RuntimeError('Source anchor missing: ' + old[:110])
    return s.replace(old, new, 1)
def edit(name, fn):
    path = GAME/name
    path.write_text(fn(path.read_text(encoding='utf-8-sig')), encoding='utf-8')

def audio(s):
    s = sub(s, 'interface Voice {', 'interface PlaybackShape { preparing?: boolean; gain?: number; rate?: number; fadeIn?: number; duration?: number; lowpass?: number; }\ninterface Voice {')
    s = sub(s, '  private duckUntil = 0;', '  private duckUntil = 0;\n  private duckGain = 1;')
    s = sub(s, "    if (state !== 'running' && state !== 'prepare') this.stopVoices(true);", "    if (state !== 'running' && state !== 'prepare') {\n      this.stopVoices(true); this.duckUntil = 0; this.duckGain = 1;\n      if (this.duckTimer !== null) { clearTimeout(this.duckTimer); this.duckTimer = null; }\n    }")
    s = sub(s, '  play(name: SfxName): void {', '''  prepareUltimate(hero: string, seconds: number): void {
    const names: Record<string, SfxName> = { archer: 'skill', sniper: 'crossbow', pyro: 'fireSkill', volt: 'thunderSkill', mora: 'frostSkill' };
    if (this.ctx && this.scene === 'battle' && this.state === 'running') this.duck(seconds, .74);
    this.play(names[hero] || 'skill', { preparing: true, gain: .34, rate: .78,
      fadeIn: .13, duration: seconds, lowpass: 1800 });
  }
  play(name: SfxName, shape: PlaybackShape = {}): void {''')
    s = sub(s, '    if (cue.priority >= 3) {', '    if (cue.priority >= 3 && !shape.preparing) {')
    s = sub(s, 'this.duck(Math.min(2.6, buffer.duration));', 'this.duck(Math.min(1.4, buffer.duration), combat ? .62 : .43);')
    s = sub(s, "source.playbackRate.value = rate * (vary ? .9875 + Math.random() * .025 : 1);", "source.playbackRate.value = rate * (shape.rate ?? 1) * (vary ? .9875 + Math.random() * .025 : 1);")
    s = sub(s, 'gain.gain.value = cue.gain * density * underAccent * (vary ? .96 + Math.random() * .04 : 1);\n    source.connect(gain);', '''const level = cue.gain * density * underAccent * (shape.gain ?? 1) * (vary ? .96 + Math.random() * .04 : 1);
    const playDuration = Math.min(buffer.duration / source.playbackRate.value, shape.duration ?? Infinity);
    if (shape.fadeIn) {
      const nowAudio = this.ctx.currentTime, attack = Math.min(shape.fadeIn, playDuration * .3);
      gain.gain.setValueAtTime(0, nowAudio);
      gain.gain.linearRampToValueAtTime(level, nowAudio + attack);
      gain.gain.setValueAtTime(level, nowAudio + Math.max(attack, playDuration - .08));
      gain.gain.linearRampToValueAtTime(0, nowAudio + playDuration);
    } else gain.gain.value = level;
    const filter = shape.lowpass ? this.ctx.createBiquadFilter() : null;
    if (filter) { filter.type = 'lowpass'; filter.frequency.value = shape.lowpass!; filter.Q.value = .6; source.connect(filter); filter.connect(gain); }
    else source.connect(gain);''')
    s = sub(s, '      source.disconnect(); gain.disconnect();', '      source.disconnect(); gain.disconnect(); filter?.disconnect();')
    s = sub(s, '    source.start();\n  }', '    source.start();\n    if (shape.duration) source.stop(this.ctx.currentTime + playDuration + .005);\n  }')
    s = sub(s, 'const duck = performance.now() < this.duckUntil ? .43 : 1;', 'const duck = performance.now() < this.duckUntil ? this.duckGain : 1;')
    s = sub(s, '  private duck(seconds: number): void {\n    this.duckUntil', '''  private duck(seconds: number, gain = .43): void {
    this.duckGain = performance.now() < this.duckUntil ? Math.min(this.duckGain, gain) : gain;
    this.duckUntil''')
    return s
edit('assets/scripts/core/GameAudio.ts', audio)
edit('assets/scripts/core/Sfx.ts', lambda s: sub(s, '  play(name: SfxName): void', '  prepareUltimate(heroId: string, seconds: number): void { GameAudio.prepareUltimate(heroId, seconds); },\n  play(name: SfxName): void'))

def projectile(s):
    s = sub(s, '  fxSeed: number;', '  fxSeed: number;\n  ultContact: boolean;')
    s = sub(s, '    a.age = 0;', '    a.age = 0; a.ultContact = false;')
    s = sub(s, 'trailMax: 0, fxSeed: 0 }', 'trailMax: 0, fxSeed: 0, ultContact: false }')
    s = sub(s, '  get hasCapacity(): boolean', '  get ultimateInFlight(): boolean { return this.active.some(a => !!a.spec.ult); }\n  get hasCapacity(): boolean')
    s = sub(s, '  frostUltimate(targets: readonly FrostUltTarget[]): void { this.impacts?.frostUlt(targets); }', '''  frostUltimate(targets: readonly FrostUltTarget[]): void { this.impacts?.frostUlt(targets); }
  frostUltimateBurst(targets: readonly FrostUltTarget[]): void { this.impacts?.frostUltBurst(targets); }''')
    s = sub(s, 'voltThunder(x: number, y: number, top: number, footY: number, radius: number): void {\n    this.impacts?.voltThunder(x, y, top, footY, radius);', 'voltThunder(x: number, y: number, top: number, footY: number, radius: number, power = 1): void {\n    this.impacts?.voltThunder(x, y, top, footY, radius, power);')
    s = sub(s, '    if (sp.heroId === \'sniper\' && sp.ult) this.impacts?.sniperUltimateHit(m.x, m.y, angle);', '''    if (sp.heroId === 'sniper' && sp.ult) {
      this.impacts?.sniperUltimateHit(m.x, m.y, angle);
      if (!a.ultContact) {
        a.ultContact = true;
        bus.emit(EVT.ULTIMATE_BEAT, { hero: sp.heroId, x: sp.x, y: sp.y, energy: 1, contact: true });
      }
    }''')
    return s
edit('assets/scripts/battle/Projectile.ts', projectile)
edit('assets/scripts/battle/ImpactFX.ts', lambda s: sub(sub(s,
    'voltThunder(x: number, y: number, top: number, footY: number, radius: number): void {\n    this.voltUltimate.strike(x, y, top, footY, radius);',
    'voltThunder(x: number, y: number, top: number, footY: number, radius: number, power = 1): void {\n    this.voltUltimate.strike(x, y, top, footY, radius, power);'),
    '  frostUlt(targets: readonly FrostUltTarget[]): void { this.frostUltimate.cast(targets); }',
    '  frostUlt(targets: readonly FrostUltTarget[]): void { this.frostUltimate.cast(targets); }\n  frostUltBurst(targets: readonly FrostUltTarget[]): void { this.frostUltimate.burst(targets); }'))

def frost(s):
    s = sub(s, "import { LINE_Y", "import { Sfx } from '../core/Sfx';\nimport { LINE_Y")
    s = sub(s, 'const DURATION = 2, HIT_SECONDS', 'const DURATION = 4.2, HIT_SECONDS')
    s = sub(s, '  private age = 0;', '  private age = 0;\n  private contactAt = -10;\n  private nextAudio = 0;')
    s = sub(s, '    this.hide(); this.age = 0; this.running = true;', '    this.hide(); this.age = 0; this.running = true; this.contactAt = -10; this.nextAudio = .8;')
    s = sub(s, 'd.start = 0.045 + i / Math.max(1, this.rainCount - 1) * 0.94', 'd.start = .2 + i / Math.max(1, this.rainCount - 1) * 2.8')
    s = sub(s, '  tick(dt: number): void {', '''  burst(targets: readonly FrostUltTarget[]): void {
    this.targets = targets; this.contactAt = this.age;
  }
  tick(dt: number): void {''')
    s = sub(s, '    this.age += dt;', '''    const before = this.age;
    this.age += dt;
    for (const hit of this.hits) {
      if (hit.start > before && hit.start <= this.age && this.age >= this.nextAudio) {
        Sfx.impact('mora', true); this.nextAudio = this.age + .45; break;
      }
    }''')
    s = sub(s, '    if (t < 0.22) {\n      this.tint.set(170, 231, 255, Math.round(62 * Math.pow(1 - t / 0.22, 1.5)));', '''    const contactAge = t - this.contactAt;
    if (contactAge >= 0 && contactAge < .22) {
      this.tint.set(170, 231, 255, Math.round(62 * Math.pow(1 - contactAge / .22, 1.5)));''')
    return s
edit('assets/scripts/battle/FrostUltimateVFX.ts', frost)

def volt(s):
    s = sub(s, 'age: number; seed: number; shader: boolean;', 'age: number; seed: number; shader: boolean; power: number;')
    s = sub(s, 'seed: 0, shader: false,', 'seed: 0, shader: false, power: 1,')
    s = sub(s, 'strike(x: number, _hitY: number, top: number, footY: number, radius: number): void', 'strike(x: number, _hitY: number, top: number, footY: number, radius: number, power = 1): void')
    s = sub(s, 's.radius = Math.max(60, Math.min(145, radius));', 's.power = Math.max(.6, Math.min(1.2, power));\n    s.radius = Math.max(60, Math.min(145, radius));')
    s = sub(s, '1 / Math.sqrt(1 + nearbySky * .8)', 's.power / Math.sqrt(1 + nearbySky * .8)')
    s = sub(s, 'const floorStrength = 1 / (1 + nearbyFloor * .75);', 'const floorStrength = s.power / (1 + nearbyFloor * .75);')
    return s
edit('assets/scripts/battle/VoltUltimateVFX.ts', volt)
edit('assets/scripts/battle/SniperUltimateVFX.ts', lambda s: sub(sub(s,
    'The existing half-second lock owns the clock and moving target. No extra gameplay delay.',
    'The shared 1.1-second lock owns the clock and moving targets.'),
    "a.life = mode ? .28 : .32;", "a.life = mode ? .5 : .38;"))
edit('assets/resources/fx/sniper-ultimate-procedural.effect', lambda s: s.replace('age / 0.32', 'age / 0.38').replace('age / 0.28', 'age / 0.5'))

def director(s):
    s = sub(s, "import { BattleAmbience } from './BattleAmbience';", "import { BattleAmbience } from './BattleAmbience';\nimport { UltimatePresentation } from './UltimatePresentation';\nimport { UltimateCue, UltimateBeat } from './UltimateTiming';")
    s = sub(s, '  private ambience!: BattleAmbience;', '  private ambience!: BattleAmbience;\n  private ultPresentation!: UltimatePresentation;\n  private pendingWin = false;')
    s = sub(s, '    this.impacts = new ImpactFX(fxLayer, groundFxLayer, projLayer, mobLayer);', '    this.impacts = new ImpactFX(fxLayer, groundFxLayer, projLayer, mobLayer);\n    this.ultPresentation = new UltimatePresentation(field, fxLayer, groundFxLayer);')
    s = sub(s, '    bus.on(EVT.HIT_STOP, this.onHitStop, this);', '    bus.on(EVT.HIT_STOP, this.onHitStop, this);\n    bus.on(EVT.ULTIMATE_BEGIN, this.onUltimateBegin, this);\n    bus.on(EVT.ULTIMATE_BEAT, this.onUltimateBeat, this);')
    s = sub(s, '    bus.off(EVT.HIT_STOP, this.onHitStop, this);', '    bus.off(EVT.HIT_STOP, this.onHitStop, this);\n    bus.off(EVT.ULTIMATE_BEGIN, this.onUltimateBegin, this);\n    bus.off(EVT.ULTIMATE_BEAT, this.onUltimateBeat, this);\n    this.ultPresentation?.clear();')
    s = sub(s, '  // Only meaningful heavy contacts get a short accent; the battlefield never shakes.', '''  private onUltimateBegin(value: unknown): void {
    const cue = value as UltimateCue;
    this.ultPresentation.begin(cue);
    this.ultShowT = Math.max(this.ultShowT, cue.duration + 2);
  }
  private onUltimateBeat(value: unknown): void { this.ultPresentation.beat(value as UltimateBeat); }
  private get ultimateActive(): boolean {
    return this.heroes.some(h => h.ultimateRemaining > 0) || this.projs.ultimateInFlight;
  }
  // Only meaningful heavy contacts get a short accent; ultimate peaks add a bounded world kick.''')
    s = sub(s, "    if (this.state !== 'running') {\n      if (this.state === 'win'", "    if (this.state !== 'running') {\n      this.ultPresentation.suspend();\n      if (this.state === 'win'")
    s = sub(s, '      this.impacts.tick(sub);', '      this.impacts.tick(sub);\n      this.ultPresentation.tick(sub);')
    s = sub(s, '''    if (this.ultShowT > 0) this.ultShowT -= dt;
    if (this.pickQueue > 0 && this.ultShowT <= 0 && !this.gm.panelOpen && this.state === 'running') this.openPick();''', '''    if (this.ultShowT > 0) this.ultShowT = Math.max(0, this.ultShowT - sdt);
    if (this.ultimateActive) this.ultShowT = Math.max(this.ultShowT, 2);
    if (this.pendingWin && !this.ultimateActive && this.state === 'running') this.onAllCleared();
    if (this.pickQueue > 0 && !this.pendingWin && this.ultShowT <= 0 && !this.gm.panelOpen && this.state === 'running') this.openPick();''')
    s = sub(s, "if (this.state !== 'running') return;\n    this.state = 'pick';", "if (this.state !== 'running' || this.pendingWin || this.ultShowT > 0) return;\n    this.state = 'pick';")
    s = sub(s, '''      // Sniper recoil belongs to the actual shot after its lock-on, not the tap.
      if (h.id !== 'sniper') h.animateAttack(true);
      this.impacts.cast(h.x, h.node.position.y + 24, h.id);''', '''      // Each hero owns its actual release cue; tapping starts only its windup.''')
    s = sub(s, "    this.state = 'lose';\n    Sfx.play('defeat');", "    this.state = 'lose'; this.pendingWin = false;\n    this.ultPresentation.clear();\n    Sfx.play('defeat');")
    s = sub(s, "  private onAllCleared(): void {\n    if (this.state !== 'running') return;\n    this.state = 'win';", "  private onAllCleared(): void {\n    if (this.state !== 'running') return;\n    if (this.ultimateActive) { this.pendingWin = true; return; }\n    this.pendingWin = false; this.ultPresentation.clear();\n    this.state = 'win';")
    return s
edit('assets/scripts/battle/BattleDirector.ts', director)

for name in ['UltimateTiming', 'UltimatePresentation']:
    path = GAME/f'assets/scripts/battle/{name}.ts.meta'
    path.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}}, indent=2), encoding='utf-8')
print('Integrated timeline, audio, weather and director.')
