/** Space displacement and sword intent use the shared battle clock and damage paths. */
import { Graphics, Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { SPACE, SWORD, spaceSkillCfg, spaceUltCfg, swordSkillCfg, swordUltCfg } from '../config/SpaceSwordConfig';
import { DESIGN_W, HERO_Y, LINE_Y, LO } from '../config/GameConfig';
import { ULT_TIMING } from './UltimateTiming';
import { Sfx } from '../core/Sfx';
import { artSprite } from '../ui/Ux';
import { CA, N } from '../ui/UIKit';
import { SpacePrisonVisual, SpaceSwordVFX, drawFlyingSword } from './SpaceSwordVFX';
import { densestBodyArea, interceptDirection } from './WindNinjaGeometry';
import { heavenSwordPlan, spacePulseAt, swordRainPlan } from './SpaceSwordPlans';

interface Pending { delay:number; kind:'normal'|'rain'|'heaven';
  x?:number;y?:number;startX?:number;startY?:number;seconds?:number;final?:boolean; }
interface Captive {mob:Monster;life:number;x:number;y:number;hitY:number;bound:boolean;orbRadius:number;}
interface Prison {age:number;start:number;next:number;damage:number;radius:number;
  cfg:ReturnType<typeof spaceUltCfg>;captures:Captive[];}
const live=(m:Monster)=>!m.dead&&m.node.isValid&&m.node.activeInHierarchy;
const EPS=1e-7;
abstract class SpaceSwordBase extends HeroBase {
  protected fx:SpaceSwordVFX|null=null;
  protected pending:Pending[]=[];
  protected clock=0;
  protected facing=-1;
  constructor(parent:Node,x:number,stats:HeroStats){super(parent,x,stats);
    this.node.once(Node.EventType.NODE_DESTROYED,()=>{this.pending.length=0;this.fx?.destroy();this.fx=null;});}
  protected buildFigure(parent:Node,id:string):void{
    this.node.layer=parent.layer;this.node.setParent(parent);this.node.setPosition(this.x,HERO_Y,0);
    const g=N('heroContactShadow',this.node).addComponent(Graphics);g.fillColor=CA('#243633',.28);g.ellipse(0,-74,27,7);g.fill();
    this.staticArt=artSprite(this.node,0,-76+180*(744/768-.5),120,180,'new_heroes_v127/'+id+'_battle',{sliced:false});
  }
  protected faceAttack(dx:number,dy:number):void{
    if(Math.abs(dx)/(Math.hypot(dx,dy)||1)<.06)return;this.facing=dx>0?1:-1;
    this.staticArt?.setScale(this.facing>0?-1:1,1,1);
  }
  protected effects():SpaceSwordVFX{return this.fx ||= new SpaceSwordVFX(this.node.parent!.parent||this.node.parent!);}
  warmEffects():void{this.effects();}
  renderEffects():void{this.fx?.render();}
  protected queuedShotDelay():number{return this.pending.reduce((n,p)=>Math.min(n,p.delay),Infinity);}
  protected shoot(target:Monster,mgr:MonsterManager,projs:ProjectileManager):void{
    this.releaseNormal(target,projs);
    const count=Math.min(24,Math.max(0,Math.floor(this.stats.serial||0)));
    for(let k=1;k<=count&&this.pending.length<96;k++)this.pending.push({kind:'normal',delay:k*.12});
  }
  private releaseNormal(target:Monster,projs:ProjectileManager):void{
    const count=Math.min(12,1+Math.max(0,Math.floor(this.stats.fan||0)));
    let launched=false;
    for(let k=0;k<count&&projs.hasCapacity;k++){
      const side=k===0?0:Math.ceil(k/2)*(k%2?1:-1)*.09;
      const spec=this.attackSpec(target,side);
      if(projs.fire(spec))launched=true;
    }
    if(launched)Sfx.shoot(this.id);
  }
  protected attackSpec(target:Monster,offset=0,ability=false,mul=1,speed=0):ProjSpec{
    const x=this.x+this.facing*29,y=HERO_Y+90;
    const dir=interceptDirection(x,y,target.x,target.hitY,target.state==='move'&&!target.immobilized?target.def.speed:0,speed||this.projectileSpeed());
    const ca=Math.cos(offset),sa=Math.sin(offset),dx=dir.dirX*ca-dir.dirY*sa,dy=dir.dirX*sa+dir.dirY*ca;
    const critical=Math.random()<this.stats.critRate;
    const amount=ability?this.abilityDamage(mul):this.effAtk*this.stats.normalMul;
    return {x,y,dirX:dx,dirY:dy,speed:speed||this.projectileSpeed(),dmg:amount*(critical?this.stats.critMul:1),
      crit:critical,color:this.id==='space'?'#BB63D8':'#63D2A4',heroId:this.id,
      visual:this.id==='space'?'rift':'sword',size:ability?9:7,ttl:4,ability,targetLayer:'all',resCut:this.stats.defIgnore,
      pierce:Math.max(0,this.stats.pierce||0)+(Math.random()<(this.stats.pierceChance||0)?1:0),
      split:ability?0:this.stats.split||0,explodeR:ability?0:this.stats.explodeR||0,explodeMul:this.stats.explodeMul,
      slowRatio:this.stats.slowOnHit||0,slowDur:this.stats.slowDur||2,
      burnDps:this.stats.burnOnHit?this.effAtk*this.stats.burnOnHit*(this.stats.burnMul||1):0,burnDur:3,
      shockAmp:this.stats.shockOnHit||0,shockDur:3,...this.targetBonuses()};
  }
  protected abstract projectileSpeed():number;
  protected abstract release(p:Pending,mgr:MonsterManager,projs:ProjectileManager):boolean;
  protected updateQueues(dt:number,mgr:MonsterManager,projs:ProjectileManager):void{
    this.clock+=dt;this.fx?.tick(dt);
    for(let k=0;k<this.pending.length;){const p=this.pending[k];p.delay-=dt;
      if(p.delay>EPS){k++;continue;}
      if(!projs.hasCapacity){k++;continue;}
      if(p.kind==='normal'){const t=this.selectNormalTarget(mgr);if(t)this.releaseNormal(t,projs);}
      else if(!this.release(p,mgr,projs)){k++;continue;}
      this.pending.splice(k,1);
    }
  }
  protected dense(mgr:MonsterManager,radius:number,range=Infinity):{x:number;y:number}|null{
    return densestBodyArea(mgr.list,this.x,HERO_Y,range,radius,{left:-DESIGN_W/2+24,right:DESIGN_W/2-24,
      bottom:LINE_Y+60,top:LO.half-LO.notchTop-145});
  }
}

export class SpaceHero extends SpaceSwordBase {
  readonly id='space';readonly name='伊芙·折界';readonly chargeMax=SPACE.energy;readonly skillMax=SPACE.cooldown;
  private prison:Prison|null=null;
  private prisonVisuals:SpacePrisonVisual[]=[];
  protected buildVisual(parent:Node):void{this.buildFigure(parent,'space');}
  protected projectileSpeed():number{return SPACE.speed;}
  warmEffects():void{super.warmEffects();this.effects().warmVolume();}
  protected canAutoSkill(mgr:MonsterManager):boolean{return !this.prison&&super.canAutoSkill(mgr);}
  protected castSkill(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):void{
    const cfg=spaceSkillCfg(this.stats.skillLv),r2=this.stats.skillRange**2;
    const targets=mgr.list.filter(m=>live(m)&&(m.x-this.x)**2+(m.hitY-HERO_Y)**2<=r2)
      .sort((a,b)=>Number(a.isBoss)-Number(b.isBoss)||a.y-b.y).slice(0,cfg.targets);
    if(!targets.length)return;
    this.beginSkillCooldown();
    for(let k=0;k<targets.length;k++){
      const m=targets[k],x=m.x,y=m.hitY;
      this.effects().add('portal',x,y,Math.max(27,m.def.radius*1.15));
      m.takeDamage(this.abilityDamage(cfg.mul),false,this.id,false,this.stats.defIgnore);
      dmg.add(this.id,m.lastDamageTaken);
      if(!m.dead){
        const top=LO.half-LO.notchTop-178-m.def.radius;
        if(m.teleportUp(top-(k%2)*36))this.effects().add('portal',m.x,m.hitY,Math.max(27,m.def.radius*1.15),.75);
        m.applySlow(cfg.slow,cfg.slowSeconds);
      }
    }
    Sfx.cast(this.id);
  }
  castUlt(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):boolean{
    if(!this.ultReady||this.prison)return false;
    const cfg=spaceUltCfg(this.stats.ultLv),start=ULT_TIMING.space.windup+cfg.orbDelay;
    const targets=mgr.list.filter(m=>live(m)&&m.hitY>LINE_Y+20&&m.hitY<LO.half-LO.notchTop-90)
      .sort((a,b)=>a.y-b.y).slice(0,cfg.targets);
    if(!targets.length)return false;
    this.lastDmg=dmg;this.charge=0;
    const captures=targets.map(m=>({mob:m,life:m.lifeId,x:m.x,y:m.y,hitY:m.hitY,
      bound:m.applySpaceBind(start+cfg.duration),orbRadius:Math.max(37,Math.min(96,m.def.radius*1.8))}));
    this.prison={age:0,start,next:0,captures,cfg,damage:this.abilityDamage(cfg.mul,true),radius:cfg.radius*this.stats.skillRangeMul};
    this.beginUltimate(start+cfg.duration+.2);Sfx.cast(this.id,true);return true;
  }
  protected release(_p:Pending,_mgr:MonsterManager,_projs:ProjectileManager):boolean{return true;}
  protected updateQueues(dt:number,mgr:MonsterManager,projs:ProjectileManager):void{
    super.updateQueues(dt,mgr,projs);const p=this.prison;if(!p)return;p.age+=dt;
    while(p.next<p.cfg.pulses&&spacePulseAt(p.next,p.start,p.cfg.duration,p.cfg.pulses)<=p.age+EPS){
      // Overlapping columns are one spell: one damage event per living actor per pulse.
      for(const m of mgr.list){if(!live(m)||!p.captures.some(c=>(m.x-c.x)**2+(m.hitY-c.hitY)**2<=p.radius**2))continue;
        m.takeDamage(p.damage,false,this.id,false,this.stats.defIgnore,Math.PI/2,p.next===0);
        this.lastDmg?.add(this.id,m.lastDamageTaken);}
      for(const c of p.captures)this.effects().add('spacePulse',c.x,c.y,p.radius,.3);
      if(p.next===0||p.next===5)Sfx.impact(this.id,true);
      this.ultimateBeat(p.captures[0].x,p.captures[0].hitY,p.next===0?.7:.12,false);p.next++;
    }
    if(p.age>=p.start+p.cfg.duration)this.prison=null;
  }
  renderEffects():void{
    const p=this.prison;this.prisonVisuals.length=0;
    if(p)for(const c of p.captures){const valid=c.life===c.mob.lifeId&&live(c.mob);
      this.prisonVisuals.push({x:c.x,y:c.y,orbX:valid?c.mob.x:c.x,orbY:valid?c.mob.hitY+c.mob.def.radius*.45:c.hitY,
        orb:valid&&c.bound,orbRadius:c.orbRadius,radius:p.radius});}
    this.effects().setPrison(this.prisonVisuals,p?.age||0,p?.start||0,p?.cfg.duration||0);
    super.renderEffects();
  }
}

export class SwordHero extends SpaceSwordBase {
  readonly id='sword';readonly name='凌霄·御锋';readonly chargeMax=SWORD.energy;readonly skillMax=SWORD.cooldown;
  private intent=0;
  private orbit:Graphics|null=null;
  protected buildVisual(parent:Node):void{this.buildFigure(parent,'sword');}
  warmEffects():void{super.warmEffects();this.effects().warmSword();if(!this.orbit)this.orbit=N('swordIntent',this.node).addComponent(Graphics);}
  protected projectileSpeed():number{return SWORD.speed;}
  protected attackSpec(target:Monster,offset=0,ability=false,mul=1,speed=0):ProjSpec{
    const spec=super.attackSpec(target,offset,ability,mul,speed);
    // Intent belongs to the hero. Only a real basic hit, once per projectile, earns it.
    let earned=false;
    if(!ability)spec.onContact=()=>{if(!earned&&this.node.isValid){earned=true;this.intent=Math.min(SWORD.intentCap,this.intent+1);}};
    return spec;
  }
  protected castSkill(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):void{
    const cfg=swordSkillCfg(this.stats.skillLv),radius=cfg.radius*this.stats.skillRangeMul;
    const p=this.dense(mgr,radius,this.stats.skillRange),count=cfg.count+this.intent;
    if(!p||this.pending.length+count+1>96)return;
    this.intent=0;this.beginSkillCooldown();
    this.effects().add('array',p.x,p.y,radius,.18+count*SWORD.rainGap+.8);
    for(const shot of swordRainPlan(p.x,p.y,count,radius))this.pending.push({...shot,kind:'rain',delay:.18+shot.delay});
    Sfx.cast(this.id);
  }
  castUlt(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):boolean{
    const cfg=swordUltCfg(this.stats.ultLv),radius=cfg.radius*this.stats.skillRangeMul,p=this.dense(mgr,radius);
    if(!this.ultReady||!p||this.pending.length+5>96)return false;
    const windup=ULT_TIMING.sword.windup;
    this.lastDmg=dmg;this.charge=0;this.beginUltimate(windup+4*SWORD.heavenGap+SWORD.heavenPause+.52+.9);
    this.effects().add('array',p.x,p.y,cfg.finalRadius*this.stats.skillRangeMul,windup+2.8);
    for(const shot of heavenSwordPlan(p.x,p.y,radius,{left:-DESIGN_W/2+60,right:DESIGN_W/2-60,
      bottom:LINE_Y+65,top:LO.half-LO.notchTop-155}))this.pending.push({...shot,kind:'heaven',delay:windup+shot.delay});
    Sfx.cast(this.id,true);return true;
  }
  protected release(p:Pending,mgr:MonsterManager,projs:ProjectileManager):boolean{
    if(p.kind!=='rain'&&p.kind!=='heaven')return true;
    const ult=p.kind==='heaven',cfg=ult?swordUltCfg(this.stats.ultLv):swordSkillCfg(this.stats.skillLv);
    const x=Math.max(-335,Math.min(335,p.x!)),y=Math.max(LINE_Y+35,Math.min(LO.half-LO.notchTop-150,p.y!));
    const radius=(ult?(p.final?swordUltCfg(this.stats.ultLv).finalRadius:cfg.radius):(p.final?cfg.radius:62))*this.stats.skillRangeMul;
    const amount=this.abilityDamage(p.final?cfg.finalMul:cfg.mul,ult);
    const sx=ult?p.startX!:x+45,sy=ult?p.startY!:LO.half+65,seconds=ult?p.seconds!:(p.final?.52:.42);
    const angle=Math.atan2(y-sy,x-sx),fired=projs.fire({x:sx,y:sy,dirX:x-sx,dirY:y-sy,speed:Math.hypot(x-sx,y-sy)/seconds,
      dmg:amount,crit:false,heroId:this.id,color:'#63D2A4',visual:ult?'heavenSword':'sword',size:ult?(p.final?64:48):(p.final?23:9),ult,ability:true,
      groundTarget:{x,y},targetLayer:'all',onGroundDamage:()=>{
        if(!this.node.isValid)return;
        for(const m of mgr.list){if(!live(m)||(m.x-x)**2+(m.hitY-y)**2>radius**2)continue;
          m.takeDamage(amount,false,this.id,false,this.stats.defIgnore,angle,!!p.final||ult);this.lastDmg?.add(this.id,m.lastDamageTaken);}
      },onGroundImpact:()=>{if(!this.node.isValid)return;
        this.effects().add(ult?'giant':'cut',x,y,ult?radius:(p.final?radius:60),ult?.9:.6,angle);
        if(ult)this.ultimateBeat(x,y,p.final?1.5:.6,!!p.final);Sfx.impact(this.id,ult||!!p.final);}});
    if(fired&&ult)this.effects().add('landing',x,y,radius,seconds,angle);
    return fired;
  }
  renderEffects():void{
    super.renderEffects();
    if(!this.orbit)this.orbit=N('swordIntent',this.node).addComponent(Graphics);
    this.orbit.clear();for(let k=0;k<this.intent;k++){
      const a=Math.PI*.15+k*Math.PI*.7/Math.max(1,this.intent-1);
      drawFlyingSword(this.orbit,Math.cos(a)*50,55+Math.sin(a)*42,Math.PI/2,3.5,this.clock);
    }
  }
}
