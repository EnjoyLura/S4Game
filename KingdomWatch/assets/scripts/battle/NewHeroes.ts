/** New hero attacks use the existing battle clock, damage path and pooled projectiles. */
import { Graphics, Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { CANNON, CANNON_CARDS_CFG as CC, SIPHON, SIPHON_CARDS_CFG as SC, SIPHON_LASER,
  cannonSkillCfg, cannonUltCfg, siphonSkillCfg, siphonLaserCfg } from '../config/NewHeroConfig';
import { DESIGN_W, HERO_Y, LINE_Y, LO } from '../config/GameConfig';
import { artSprite } from '../ui/Ux';
import { CA, N } from '../ui/UIKit';
import { Sfx } from '../core/Sfx';
import { bus, EVT } from '../core/EventBus';
import { CannonBlastVFX, SiphonBeamVFX } from './NewHeroVFX';
import { SiphonLaserVFX } from './SiphonLaserVFX';
import { CannonAugments } from './CannonAugments';
import { bestLaserAngle, laserExposure, laserLength, laserTouches, turnLaser } from './SiphonLaser';

function visual(parent: Node, node: Node, x: number, hero: string): Node {
  node.layer = parent.layer; node.setParent(parent); node.setPosition(x, HERO_Y, 0);
  const shadow = N('heroContactShadow', node).addComponent(Graphics);
  shadow.fillColor = CA('#221A16', .3); shadow.ellipse(0, -74, 29, 8); shadow.fill();
  const foot = hero === 'cannon' ? 1395 : 1445, height = 180;
  return artSprite(node, 0, -76 + height * (foot / 1536 - .5), 120, height,
    'new_heroes_v105/' + hero + '_battle', { sliced: false });
}
function point(m: Monster, seconds: number): { x: number; y: number } {
  const moving = m.state === 'move' && !m.immobilized;
  const dy = moving ? m.def.speed * (m.slowT > 0 ? 1 - m.slowAmp : 1) * seconds : 0;
  return { x: Math.max(-330, Math.min(330, m.x)),
    y: Math.max(LINE_Y + 24, Math.min(LO.half - LO.notchTop - 136, m.y - dy)) };
}
function cluster(mgr: MonsterManager, x: number, range: number, radius: number): Monster | null {
  const candidates = mgr.list.filter(m => !m.dead && m.y < LO.half - LO.notchTop - 136
    && m.y >= LINE_Y && (m.x - x) ** 2 + (m.y - HERO_Y) ** 2 <= range * range);
  let best: Monster | null = null, score = -1;
  for (const m of candidates) {
    let count = 0;
    for (const o of candidates) if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 <= radius * radius) count++;
    if (count > score || count === score && m.y < (best?.y ?? Infinity)) { best = m; score = count; }
  }
  return best;
}
interface Shell {
  delay: number; x: number; y: number; damage: number; radius: number;
  skill: boolean; ult: boolean; echo: boolean; extra: boolean; detonate?: boolean;
  launchX?: number; launchY?: number; mini?: boolean; heavy?: boolean;
}

export class CannonHero extends HeroBase {
  readonly id = 'cannon'; readonly name = '布洛克·铜铸';
  readonly chargeMax = CANNON.energy; readonly skillMax = CANNON.cooldown;
  private shells: Shell[] = [];
  private blastFX: CannonBlastVFX | null = null;
  private loadingCycle = 0;
  private flyingUlt = 0;
  private heavyCycle = 0;
  private augments: CannonAugments | null = null;
  private fragments: ProjSpec[] = [];

  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'cannon'); }
  protected shoot(target: Monster): void {
    if (this.shells.length >= 48) return;
    const p = point(target, Math.hypot(target.x - this.x, target.y - HERO_Y - 60) / 760);
    this.shells.push({ delay: 0, ...p, damage: this.effAtk * this.stats.normalMul, radius: CANNON.blast,
      skill: false, ult: false, echo: false, extra: false,
      heavy: !!this.stats.cannonHeavy && ++this.heavyCycle % CC.heavyEvery === 0 });
  }
  protected castSkill(mgr: MonsterManager): void {
    const cfg = cannonSkillCfg(this.stats.skillLv), radius = CANNON.skillBlast * cfg.radiusMul * this.stats.skillRangeMul;
    const target = cluster(mgr, this.x, this.stats.skillRange, radius);
    if (!target || this.shells.length >= 48) return;
    this.skillCd = this.skillCdTotal;
    const flight = Math.hypot(target.x - this.x, target.y - HERO_Y - 60) / 760;
    this.shells.push({ delay: 0, ...point(target, flight), damage: this.abilityDamage(cfg.mul), radius,
      skill: true, ult: false, echo: false, extra: false });
  }
  get ultimateRemaining(): number {
    return Math.max(this.ultimateT, this.flyingUlt || this.shells.some(s => s.ult) ? .01 : 0);
  }
  castUlt(mgr: MonsterManager): boolean {
    const alive = mgr.list.filter(m => !m.dead && m.y <= LO.half - LO.notchTop - 136 && m.y >= LINE_Y);
    if (!this.ultReady || !alive.length) return false;
    const cfg = cannonUltCfg(this.stats.ultLv), count = cfg.shots + (this.stats.cannonUltShots || 0);
    const radius=cfg.radius*this.stats.skillRangeMul*(1+(this.stats.cannonUltRadius || 0));
    this.charge = 0;
    this.beginUltimate(Math.max(4.5, .6 + count * .26 + 1));
    // Cover separate groups before repeating a landing in the same group.
    const ordered = alive.slice().sort((a, b) => a.y - b.y);
    const targets: Monster[] = [];
    while (ordered.length) {
      const target = ordered.shift()!; targets.push(target);
      for (let k = ordered.length - 1; k >= 0; k--)
        if ((ordered[k].x - target.x) ** 2 + (ordered[k].y - target.y) ** 2 < radius ** 2) ordered.splice(k, 1);
    }
    for (let i = 0; i < count; i++) this.shells.push({ delay: .6 + i * .26,
      ...point(targets[i % targets.length], .8 + i * .26), damage: this.abilityDamage(cfg.mul, true),
      radius, skill: false, ult: true, echo: false, extra: true,
      launchX: Math.max(-350, Math.min(350, targets[i % targets.length].x + (i % 2 ? 120 : -120))) });
    Sfx.cast(this.id, true);
    return true;
  }
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    this.blastFX?.tick(dt);
    this.augments?.tick(dt,mgr);
    while(this.fragments.length && projs.hasCapacity){if(!projs.fire(this.fragments[0]))break;this.fragments.shift();}
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shot = this.shells[i]; shot.delay -= dt;
      if (shot.delay > 0) continue;
      if (shot.detonate) { this.detonate(shot, mgr); this.shells.splice(i, 1); continue; }
      if (!projs.hasCapacity) continue;
      const sx = shot.launchX ?? (shot.ult ? shot.x : this.x), sy = shot.launchY ?? (shot.ult ? LO.half + 40 : HERO_Y + 60);
      const dx = shot.x - sx, dy = shot.y - sy, len = Math.hypot(dx, dy) || 1;
      let landing = 0,landedHits=0;
      const critical = Math.random() < this.stats.critRate;
      const spec: ProjSpec = { x: sx, y: sy, dirX: dx / len, dirY: dy / len, speed: shot.ult ? 1350 : 760,
        dmg: shot.damage * (critical ? this.stats.critMul : 1), crit: critical, color: '#D5A641', heroId: this.id,
        size: shot.mini ? 7 : shot.skill || shot.ult ? 13 : 10, explodeR: shot.radius, explodeMul: .7,
        ability: shot.skill, ult: shot.ult, groundTarget: { x: shot.x, y: shot.y }, resCut: this.stats.defIgnore,
        groundPierce: !shot.skill && !shot.ult && !shot.mini ? this.stats.cannonPierce : 0, groundPierceMul: CC.passingMul,
        onGroundDamage: () => {if(this.node.isValid)landedHits=this.resolveBlast(shot,spec.dmg,critical,mgr);},
        onGroundImpact: () => {
          if (!this.node.isValid) return;
          if (landing) this.blastFX?.landed(landing);
          if (shot.ult) { this.flyingUlt = Math.max(0, this.flyingUlt - 1); this.ultimateBeat(shot.x, shot.y, .7, true); }
          this.blast(shot, shot.mini ? 'echo' : shot.ult ? 'ult' : shot.skill ? 'skill' : 'normal');
          if (shot.skill && !shot.mini) for (const m of mgr.list) {
            if (m.dead || (m.x - shot.x) ** 2 + (m.y - shot.y) ** 2 > shot.radius ** 2) continue;
            m.applyResistanceShred('physical', CANNON.shred, cannonSkillCfg(this.stats.skillLv).shredSeconds);
            if (this.stats.cannonKnockback) m.applyKnockback(this.stats.cannonKnockback);
            if(this.stats.cannonCharges)this.extras().mark(m,shot.damage*CC.chargeMul);
            if(this.stats.cannonInterrupt){m.interruptCasting();if(!m.def.elite)m.applyStun(CC.interruptStun);}
          }
          if(shot.skill && !shot.mini){
            if(this.stats.cannonCluster)for(let k=0;k<CC.clusterCount;k++){
              const a=Math.PI/2+k*Math.PI*2/CC.clusterCount;
              this.shells.push({delay:.3+k*.09,x:Math.max(-340,Math.min(340,shot.x+Math.cos(a)*CC.clusterSpread)),
                y:Math.max(LINE_Y+14,Math.min(LO.half-24,shot.y+Math.sin(a)*CC.clusterSpread)),
                damage:shot.damage*CC.clusterMul,radius:CC.clusterRadius*this.stats.skillRangeMul,
                skill:true,ult:false,echo:false,extra:true,mini:true,launchX:shot.x,launchY:shot.y});
            }
            if(this.stats.cannonWave)this.extras().wave(shot.x,shot.y,shot.radius,spec.dmg*CC.waveMul,critical);
            if(this.stats.cannonRefund && landedHits>=CC.refundTargets)
              this.skillCd=Math.max(0,this.skillCd-this.skillCdTotal*CC.refundRatio);
          }
          if (!shot.skill && !shot.ult && !shot.echo && !shot.mini && this.stats.cannonEcho && this.shells.length < 48)
            this.shells.push({ ...shot, delay: .35, damage: shot.damage * this.stats.cannonEcho,
              echo: true, extra: true, detonate: true });
          Sfx.impact(this.id, true);
        } };
      if (!projs.fire(spec)) continue;
      if (shot.ult) { this.flyingUlt++; landing = this.effects().target(shot.x, shot.y, len / spec.speed); }
      else if(!shot.mini) {
        this.animateAttack(shot.skill, dx, dy);
        if (!shot.extra) Sfx.cast(this.id);
      }
      this.shells.splice(i, 1);
      if (!shot.skill && !shot.ult && !shot.extra && this.stats.cannonLoader && ++this.loadingCycle >= 4) {
        this.loadingCycle = 0;
        this.shells.push({ ...shot, damage: shot.damage * .6, delay: .18, extra: true });
      }
    }
  }
  private resolveBlast(shot: Shell, damage: number, critical: boolean, mgr: MonsterManager): number {
    let primary: Monster | null=null,nearest=Infinity,hits=0;
    const r2=shot.radius*shot.radius,normal=!shot.skill&&!shot.ult&&!shot.mini&&!shot.echo;
    for(const m of mgr.list){const d2=(m.x-shot.x)**2+(m.y-shot.y)**2;if(!m.dead&&d2<=r2&&d2<nearest){primary=m;nearest=d2;}}
    for(const m of mgr.list){
      const d2=(m.x-shot.x)**2+(m.y-shot.y)**2;if(m.dead||d2>r2)continue;
      hits++;const direct=m===primary,center=shot.ult ? this.stats.cannonUltCenter || 0 : normal ? this.stats.cannonCenter || 0 : 0;
      const amount=damage*(direct?1:.7)*(d2<=r2*CC.centerRatio**2?1+center:1);
      const charge=normal?this.augments?.consume(m) || 0:0;
      m.takeDamage(amount,direct&&critical,this.id,false,direct?this.stats.defIgnore:0,Math.atan2(m.y-shot.y,m.x-shot.x),direct);
      this.lastDmg?.add(this.id,m.lastDamageTaken);
      if(normal&&shot.heavy)m.applySlow(CC.slow,CC.slowSeconds);
      if(shot.ult&&this.stats.cannonUltStun)m.applyStun(this.stats.cannonUltStun);
      if(charge>0)this.shells.push({delay:0,x:m.x,y:m.y,damage:charge,radius:CC.chargeRadius,
        skill:true,ult:false,echo:true,extra:true,mini:true,detonate:true});
    }
    if(normal&&this.stats.cannonFragments)for(let k=0;k<CC.fragments;k++){
      const a=Math.PI/2+k*Math.PI*2/CC.fragments;
      this.fragments.push({x:shot.x,y:shot.y,dirX:Math.cos(a),dirY:Math.sin(a),speed:650,
        dmg:damage*CC.fragmentMul,crit:critical,color:'#D9C38D',heroId:this.id,size:4,ttl:.55,small:true,resCut:this.stats.defIgnore});
    }
    if(primary)bus.emit(EVT.HIT_STOP);
    return hits;
  }
  private detonate(shot: Shell, mgr: MonsterManager): void {
    for (const m of mgr.list) {
      const d2=(m.x-shot.x)**2+(m.y-shot.y)**2;
      if (m.dead || d2 > shot.radius ** 2) continue;
      const center=!shot.skill&&!shot.ult && d2<=shot.radius**2*CC.centerRatio**2 ? this.stats.cannonCenter || 0 : 0;
      m.takeDamage(shot.damage*(1+center), false, this.id, false, this.stats.defIgnore);
      this.lastDmg?.add(this.id, m.lastDamageTaken);
      if(!shot.skill&&!shot.ult&&shot.heavy)m.applySlow(CC.slow,CC.slowSeconds);
    }
    this.blast(shot, 'echo');
    Sfx.impact(this.id, true);
  }
  private blast(shot: Shell, kind: 'normal' | 'skill' | 'ult' | 'echo'): void {
    this.effects().burst(shot.x, shot.y, shot.radius, kind);
  }
  private effects(): CannonBlastVFX { return this.blastFX ||= new CannonBlastVFX(this.node.parent!.parent!); }
  private extras(): CannonAugments {
    return this.augments ||= new CannonAugments(this.node.parent!.parent!,(m,amount,critical,angle)=>{
      m.takeDamage(amount,critical,this.id,false,this.stats.defIgnore,angle,true);this.lastDmg?.add(this.id,m.lastDamageTaken);
    });
  }
  renderEffects(): void { this.blastFX?.render();this.augments?.render(); }
  warmEffects(): void { this.effects();this.extras(); }
}

interface Beam { mob: Monster; life: number; kind: 'twin' | 'relay' | 'skill'; }
export class SiphonHero extends HeroBase {
  readonly id = 'siphon'; readonly name = '薇拉·绯契';
  readonly chargeMax = SIPHON.energy; readonly skillMax = SIPHON.cooldown;
  private primary: Monster | null = null;
  private primaryLife = 0;
  private ramp = 0;
  private heldSeconds = 0;
  private skillSeconds = 0;
  private skillExtension = 0;
  private grips = new Map<number, { mob: Monster; held: number; next: number }>();
  private liveGrips = new Set<number>();
  private readonly sideRays = [{ angle:0,length:0,halfWidth:0 },{ angle:0,length:0,halfWidth:0 }];
  private laserAge = -1;
  private laserAngle = Math.PI / 2;
  private laserGoal = Math.PI / 2;
  private laserFacing = 1;
  private laserX = 0;
  private laserY = 0;
  private laserTick = 0;
  private laserAimT = 0;
  private readonly laserArena = { left: -DESIGN_W / 2, right: DESIGN_W / 2, top: 0 };
  private laserFX: SiphonLaserVFX | null = null;
  private beams: Beam[] = [];
  private beamFX: SiphonBeamVFX | null = null;

  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'siphon'); }
  warmEffects(): void {
    this.beamFX ||= new SiphonBeamVFX(this.node.parent!.parent!);
    this.laserFX ||= new SiphonLaserVFX(this.node.parent!.parent!);
  }
  protected attackInterval(): number { return SIPHON.tick; }
  private valid(m: Monster | null, life: number, mgr: MonsterManager): m is Monster {
    return !!m && m.lifeId === life && !m.dead && m.node.isValid && m.node.activeInHierarchy && mgr.list.includes(m);
  }
  protected selectNormalTarget(mgr: MonsterManager): Monster | null {
    if (this.valid(this.primary, this.primaryLife, mgr)) return this.primary;
    if (this.primary) {
      this.ramp *= this.stats.siphonInheritance || 0;
      this.heldSeconds = 0;
    }
    this.primary = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
    this.primaryLife = this.primary?.lifeId || 0;
    return this.primary;
  }
  protected shoot(target: Monster, _mgr: MonsterManager, _projs: ProjectileManager, dmg?: DamageService): void {
    const service = dmg || this.lastDmg;
    if (!service) return;
    const base = this.effAtk * this.stats.aspd * this.stats.normalMul * SIPHON.tick;
    const take = (m: Monster, amount: number): number => this.takeSiphon(m,amount,false,service);
    take(target, base * (1 + this.ramp));
    for (const b of this.beams) {
      if (b.mob.lifeId !== b.life || b.mob.dead) continue;
      const amount = b.kind === 'relay' ? base*(1+this.ramp)*SC.relayMul : b.kind === 'twin' ? base * (this.stats.siphonTwin || 0)
        : this.abilityDamage(siphonSkillCfg(this.stats.skillLv).mul) * SIPHON.tick;
      take(b.mob, amount);
    }
    this.animateAttack(false, target.x - this.x, target.y - HERO_Y - 60);
  }
  private takeSiphon(m: Monster, amount: number, heavy=false, service=this.lastDmg): number {
    if(!service||m.dead)return 0;
    const critical=Math.random()<this.stats.critRate;
    m.takeDamage(amount*(critical?this.stats.critMul:1),critical,this.id,false,this.stats.defIgnore,undefined,heavy);
    const dealt=m.lastDamageTaken;service.add(this.id,dealt);
    if(dealt>0)this.beamFX?.hit(m.x,m.y+m.def.radius*.45,m.lifeId,heavy);
    return dealt;
  }
  private tickGrips(dt: number, primary: Monster | null, beams: readonly Beam[]): void {
    this.liveGrips.clear();if(primary&&!primary.dead)this.liveGrips.add(primary.lifeId);
    for(const b of beams)if(b.kind!=='skill'&&!b.mob.dead)this.liveGrips.add(b.life);
    for(const [life] of this.grips)if(!this.liveGrips.has(life))this.grips.delete(life);
    for(const life of this.liveGrips){
      const mob=primary?.lifeId===life?primary:beams.find(b=>b.life===life)!.mob;
      let p=this.grips.get(life);
      if(!p){p={mob,held:0,next:SC.gripDelay+SC.gripEvery};this.grips.set(life,p);}
      p.held+=dt;
      while(p.held+1e-8>=p.next){
        p.next+=SC.gripEvery;
        if(this.stats.siphonHeavyGrip&&!mob.dead)this.takeSiphon(mob,this.effAtk*this.stats.normalMul*SC.gripMul,true);
      }
    }
  }
  protected castSkill(mgr: MonsterManager): void {
    if (!this.selectNormalTarget(mgr)) return;
    this.skillCd = this.skillCdTotal;
    this.skillSeconds = siphonSkillCfg(this.stats.skillLv).duration;
    this.skillExtension = 0;
    Sfx.cast(this.id);
  }
  private get laserCfg() { return siphonLaserCfg(this.stats.ultLv,this.stats.siphonUltDuration || 0,this.stats.siphonUltTicks || 0); }
  get ultShowDuration(): number { return SIPHON_LASER.windup + this.laserCfg.duration + SIPHON_LASER.tail; }
  private get laserHalfWidth(): number {
    return (this.laserCfg.halfWidth + (this.stats.siphonBranches || 0) * 6) * this.stats.skillRangeMul;
  }
  private get laserBounds() { this.laserArena.top = LO.half; return this.laserArena; }
  protected faceAttack(dx: number, dy: number): void {
    // Keep the firing palm anchored during a sweep, even if normal attacks prefer another side.
    if (this.laserAge >= 0) super.faceAttack(this.laserFacing, 1);
    else super.faceAttack(dx, dy);
  }
  castUlt(mgr: MonsterManager): boolean {
    if (!this.ultReady) return false;
    const sy = HERO_Y + 51;
    let angle = bestLaserAngle(this.x, sy, this.laserHalfWidth, mgr.list, this.laserBounds);
    if (angle === null) return false;
    this.laserFacing = Math.cos(angle) >= 0 ? 1 : -1;
    this.laserX = this.x + 43.4 * this.laserFacing; this.laserY = sy;
    angle = bestLaserAngle(this.laserX, sy, this.laserHalfWidth, mgr.list, this.laserBounds, angle) ?? angle;
    this.laserAngle = this.laserGoal = angle;
    this.laserAge = this.laserTick = this.laserAimT = 0;
    this.charge = 0;
    this.warmEffects(); this.faceAttack(this.laserFacing, 1);
    this.beginUltimate();
    Sfx.cast(this.id, true);
    return true;
  }
  private tickLaser(dt: number, mgr: MonsterManager): void {
    this.laserFX?.tick(dt);
    if (this.laserAge < 0) return;
    const cfg = this.laserCfg, before = this.laserAge, bounds = this.laserBounds;
    this.laserAge += dt; this.laserAimT -= dt;
    const damageEnd = SIPHON_LASER.windup + cfg.duration;
    if (this.laserAimT <= 0 && this.laserAge <= damageEnd) {
      this.laserAimT = .18;
      this.laserGoal = bestLaserAngle(this.laserX, this.laserY, this.laserHalfWidth, mgr.list,
        bounds, this.laserAngle) ?? this.laserAngle;
    }
    this.laserAngle = turnLaser(this.laserAngle, this.laserGoal, dt, SIPHON_LASER.turnRate);
    const activeDt = laserExposure(before, this.laserAge, SIPHON_LASER.windup, cfg.duration);
    this.laserTick += activeDt;
    const length = laserLength(this.laserX, this.laserY, this.laserAngle, bounds);
    while (this.laserTick + 1e-8 >= cfg.interval) {
      this.laserTick = Math.max(0, this.laserTick - cfg.interval);
      for(let ray=0;ray<(this.stats.siphonFork?3:1);ray++) {
        const angle=ray===0?this.laserAngle:Math.max(.03,Math.min(Math.PI-.03,this.laserAngle+(ray===1?-SC.forkAngle:SC.forkAngle)));
        const halfWidth=this.laserHalfWidth*(ray===0?1:SC.forkWidth),rayLength=ray===0?length:laserLength(this.laserX,this.laserY,angle,bounds);
        for (const m of mgr.list) {
        if (m.dead || m.y > bounds.top || m.y <= this.laserY || m.x < bounds.left || m.x > bounds.right) continue;
        if (!laserTouches(this.laserX, this.laserY, angle, rayLength, halfWidth,
          m.x, m.y, m.def.radius)) continue;
        const critical = Math.random() < this.stats.critRate;
        m.takeDamage(this.abilityDamage(cfg.mul, true) * SIPHON_LASER.tick * (ray===0?1:SC.forkMul) * (critical ? this.stats.critMul : 1),
          critical, this.id, false, this.stats.defIgnore, angle, true);
        this.lastDmg?.add(this.id, m.lastDamageTaken);
        if (m.lastDamageTaken > 0) this.laserFX?.hit(m.x, m.y + m.def.radius * .45, m.lifeId);
        }
      }
      this.ultimateBeat(this.laserX + Math.cos(this.laserAngle) * length * .55,
        this.laserY + Math.sin(this.laserAngle) * length * .55, .22, false);
    }
    if (this.laserAge >= damageEnd + SIPHON_LASER.tail) this.laserAge = -1;
  }
  protected updateQueues(dt: number, mgr: MonsterManager): void {
    const primary = this.selectNormalTarget(mgr);
    if (primary && !this.beamFX) this.beamFX = new SiphonBeamVFX(this.node.parent!.parent!);
    this.beamFX?.tick(dt);
    let extension=0;
    if(this.skillSeconds>0 && this.stats.siphonExtendOnKill)for(const b of this.beams) {
      if(b.kind!=='skill'||b.mob.lifeId!==b.life||!b.mob.dead)continue;
      const add=Math.min(SC.killExtension,SC.extensionCap-this.skillExtension);
      extension+=add;this.skillExtension+=add;
    }
    this.skillSeconds = Math.max(0, this.skillSeconds + extension - dt);
    if (primary) {
      this.heldSeconds += dt;
      this.ramp = Math.min(SIPHON.rampMax, this.ramp + SIPHON.rampPerSecond * dt);
      if (this.stats.siphonShred && this.heldSeconds >= 3) primary.applyResistanceShred('magic', this.stats.siphonShred, .35);
      if(this.stats.siphonSlow && this.heldSeconds>=SC.slowDelay)primary.applySlow(this.stats.siphonSlow,.5);
      if(this.skillSeconds>0 && this.stats.siphonHealCut)primary.applyHealingReduction(this.stats.siphonHealCut,SC.healCutTail);
    }
    const counts = { twin: this.stats.siphonTwin ? 1 : 0,relay:this.stats.siphonRelay || 0,
      skill: this.skillSeconds > 0 ? siphonSkillCfg(this.stats.skillLv).branches + (this.stats.siphonBranches || 0) + (this.stats.siphonSkillTargets || 0) : 0 };
    const next: Beam[] = [];
    let nearby: Monster[] | null = null;
    for (const kind of ['twin', 'relay', 'skill'] as const) {
      const count = counts[kind];
      if (!primary || !count) continue;
      // Each channel owns its targets. Casting cannot evict an existing normal beam.
      // Different channels may hit the same enemy; each channel never repeats one target.
      const used = new Set<Monster>([primary]);
      if(kind==='relay')for(const b of next)if(b.kind==='twin')used.add(b.mob);
      const keep = this.beams.filter(b => b.kind === kind && this.valid(b.mob, b.life, mgr) && !used.has(b.mob) &&
        (kind!=='relay' || (b.mob.x-primary.x)**2+(b.mob.y-primary.y)**2 <= (300*this.stats.skillRangeMul)**2)).slice(0, count);
      for (const b of keep) { next.push(b); used.add(b.mob); }
      if (keep.length >= count) continue;
      // Sort once only when a connection needs replacement, never for full stable channels.
      if (!nearby) nearby = mgr.list.filter(m => !m.dead).sort((a, b) => (a.x - primary.x) ** 2 + (a.y - primary.y) ** 2
        - (b.x - primary.x) ** 2 - (b.y - primary.y) ** 2);
      for (const m of nearby) {
        if (keep.length >= count) break;
        const radius = 300 * this.stats.skillRangeMul;
        if (m.dead || used.has(m) || (m.x - primary.x) ** 2 + (m.y - primary.y) ** 2 > radius ** 2) continue;
        const b: Beam = { mob: m, life: m.lifeId, kind }; keep.push(b); next.push(b); used.add(m);
      }
    }
    this.beams = next;
    if(this.stats.siphonHealCut)for(const b of next)if(b.kind==='skill')b.mob.applyHealingReduction(this.stats.siphonHealCut,SC.healCutTail);
    this.tickGrips(dt,primary,next);
    this.tickLaser(dt, mgr);
  }
  renderEffects(): void {
    const fx = this.beamFX;
    if (this.laserFX) {
      const cfg = this.laserCfg;
      if(this.stats.siphonFork)for(let i=0;i<2;i++){
        const ray=this.sideRays[i];ray.angle=Math.max(.03,Math.min(Math.PI-.03,this.laserAngle+(i===0?-SC.forkAngle:SC.forkAngle)));
        ray.halfWidth=this.laserHalfWidth*SC.forkWidth;
        ray.length=laserLength(this.laserX,this.laserY,ray.angle,this.laserBounds,
          Math.max(SIPHON_LASER.visualOverscan,ray.halfWidth*2+24));
      }
      this.laserFX.render(this.laserX, this.laserY, this.laserAngle,
        laserLength(this.laserX, this.laserY, this.laserAngle, this.laserBounds,
          Math.max(SIPHON_LASER.visualOverscan, this.laserHalfWidth * 2 + 24)), this.laserHalfWidth,
        this.laserAge, cfg.duration,this.stats.siphonFork?this.sideRays:undefined);
    }
    if (!fx) return;
    // Raised palm center in the 120x180 sprite, mirrored with the whole character.
    fx.begin(this.x + 43.4 * (this.staticArt?.scale.x ?? 1), HERO_Y + 51,
      false);
    const primary = this.primary;
    if (!primary || primary.dead || primary.lifeId !== this.primaryLife) { fx.end(); return; }
    fx.beam(primary.x, primary.y + primary.def.radius * .45, 1 + this.ramp * .4, .6);
    const drawn = new Set<Monster>([primary]);
    for (const b of this.beams) if (b.mob.lifeId === b.life && !drawn.has(b.mob)) {
      if (!b.mob.dead) {
        if(b.kind==='relay')fx.link(primary.x,primary.y+primary.def.radius*.45,b.mob.x,b.mob.y+b.mob.def.radius*.45,.55,b.life%17);
        else fx.beam(b.mob.x, b.mob.y + b.mob.def.radius * .45, .65, b.life % 17);
      }
      drawn.add(b.mob);
    }
    fx.end();
  }
}
