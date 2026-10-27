import { Graphics,Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster,MonsterManager } from './Monster';
import { ProjectileManager } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { DESIGN_W,HERO_Y,LINE_Y,LO } from '../config/GameConfig';
import { SCYTHE as B,SCYTHE_TIMING as T,scytheSkillCfg,scytheUltCfg } from '../config/ScytheConfig';
import { scythePose,scythePulseCount,scytheReapPulseCount,scytheInDomain } from './ScythePlans';
import { Sfx } from '../core/Sfx';
import { artSprite } from '../ui/Ux';
import { CA,N } from '../ui/UIKit';
import { bodyDownSpeed,densestBodyArea,interceptDirection } from './WindNinjaGeometry';
import { ScytheVFX } from './ScytheVFX';
interface Spin {x:number;y:number;sx:number;sy:number;age:number;duration:number;radius:number;damage:number;resCut:number;pulses:number;seed:number;}
interface Pending {kind:'normal';delay:number;}
interface Reap {x:number;y:number;radius:number;age:number;duration:number;damage:number;resCut:number;hits:number;finalMul:number;pulses:number;seed:number;}
const live=(m:Monster)=>!m.dead&&m.node.isValid&&m.node.activeInHierarchy;
export class ScytheHero extends HeroBase {
 readonly id='scythe';readonly name='艾登·烬镰';readonly chargeMax=B.energy;readonly skillMax=B.cooldown;
 private fx:ScytheVFX|null=null;private pending:Pending[]=[];private spins:Spin[]=[];private facing=1;private serial=0;
 private reap:Reap|null=null;
 constructor(parent:Node,x:number,stats:HeroStats){super(parent,x,stats);
  this.node.once(Node.EventType.NODE_DESTROYED,()=>{this.pending.length=0;this.spins.length=0;this.reap=null;this.fx?.destroy();this.fx=null;});}
 protected buildVisual(parent:Node):void{
  this.node.layer=parent.layer;this.node.setParent(parent);this.node.setPosition(this.x,HERO_Y,0);
  const g=N('heroContactShadow',this.node).addComponent(Graphics);g.fillColor=CA('#29202A',.28);g.ellipse(0,-74,27,7);g.fill();
  // Wide weapon silhouette needs a larger canvas; feet retain the shared ground anchor.
  this.staticArt=artSprite(this.node,0,-76+240*(744/768-.5),160,240,'new_heroes_v139/scythe_battle',{sliced:false});
 }
 protected faceAttack(dx:number,dy:number):void{if(Math.abs(dx)/(Math.hypot(dx,dy)||1)<.06)return;
  this.facing=dx>0?1:-1;this.staticArt?.setScale(this.facing>0?1:-1,1,1);}
 private effects():ScytheVFX{return this.fx ||=new ScytheVFX(this.node.parent!.parent||this.node.parent!);}
 warmEffects():void{this.effects();}
 renderEffects():void{const fx=this.effects();fx.begin();for(const s of this.spins){const p=scythePose(s.age,s.duration,s.sx,s.sy,s.x,s.y);fx.spin(p.x,p.y,s.radius,s.age,s.seed,p.opacity,s);}if(this.reap)fx.reaping(this.reap);fx.end();}
 get ultShowDuration():number{return scytheUltCfg(this.stats.ultLv).duration;}
 get ultimateRemaining():number{return Math.max(this.ultimateT,this.reap?this.reap.duration-this.reap.age:0);}
 protected queuedShotDelay():number{return this.pending.reduce((n,p)=>Math.min(n,p.delay),Infinity);}
 protected shoot(target:Monster,_mgr:MonsterManager,projs:ProjectileManager):void{
  this.normal(target,projs);for(let k=1;k<=Math.min(24,this.stats.serial||0)&&this.pending.length<56;k++)this.pending.push({kind:'normal',delay:k*.12});
 }
 private normal(target:Monster,projs:ProjectileManager):void{
  const x=this.x+this.facing*30,y=HERO_Y+85,dir=interceptDirection(x,y,target.x,target.hitY,bodyDownSpeed(target),B.speed);let fired=false;
  for(let k=0;k<Math.min(12,1+(this.stats.fan||0))&&projs.hasCapacity;k++){
   const a=k?Math.ceil(k/2)*(k%2?1:-1)*.13:0,ca=Math.cos(a),sa=Math.sin(a),crit=Math.random()<this.stats.critRate;
   fired=projs.fire({x,y,dirX:dir.dirX*ca-dir.dirY*sa,dirY:dir.dirX*sa+dir.dirY*ca,speed:B.speed,
    dmg:this.effAtk*this.stats.normalMul*(crit?this.stats.critMul:1),crit,heroId:this.id,color:'#FF6E38',visual:'scytheBlade',size:12,
    lineHalfLength:B.halfLength,targetLayer:'all',ttl:3.2,resCut:this.stats.defIgnore,pierce:2+(this.stats.pierce||0)+(Math.random()<(this.stats.pierceChance||0)?1:0),split:this.stats.split||0,
    explodeR:this.stats.explodeR||0,explodeMul:this.stats.explodeMul,slowRatio:this.stats.slowOnHit||0,slowDur:this.stats.slowDur||2,
    burnDps:this.stats.burnOnHit?this.effAtk*this.stats.burnOnHit*(this.stats.burnMul||1):0,burnDur:3,
    shockAmp:this.stats.shockOnHit||0,shockDur:3,...this.targetBonuses(),
    onContact:m=>{if(this.node.isValid)this.effects().hit(m.x,m.hitY,27);}})||fired;
  }if(fired)Sfx.shoot(this.id);
 }
 protected castSkill(mgr:MonsterManager):void{
  if(this.spins.length>=3)return;const c=scytheSkillCfg(this.stats.skillLv),radius=c.radius*this.stats.skillRangeMul;
  const p=densestBodyArea(mgr.list.filter(live),this.x,HERO_Y,this.stats.skillRange,radius,
   {left:-DESIGN_W/2+28,right:DESIGN_W/2-28,bottom:LINE_Y+50,top:LO.half-LO.notchTop-155});if(!p)return;
  const sx=this.x+this.facing*30,sy=HERO_Y+85;
  this.spins.push({...p,sx,sy,age:0,duration:c.duration,radius,damage:this.abilityDamage(c.mul),resCut:this.stats.defIgnore,pulses:0,seed:(++this.serial*.618)%1});
  this.beginSkillCooldown();this.effects().swing(sx,sy,80,.32);Sfx.cast(this.id);
 }
 castUlt(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):boolean{
  if(!this.ultReady||this.reap)return false;
  const c=scytheUltCfg(this.stats.ultLv),radius=c.radius*this.stats.skillRangeMul;
  const p=densestBodyArea(mgr.list.filter(live),this.x,HERO_Y,Infinity,radius,
   {left:-DESIGN_W/2+28,right:DESIGN_W/2-28,bottom:LINE_Y+50,top:LO.half-LO.notchTop-155});if(!p)return false;
  this.lastDmg=dmg;this.charge=0;this.beginUltimate(c.duration);
  this.reap={...p,radius,age:0,duration:c.duration,damage:this.abilityDamage(c.mul,true),resCut:this.stats.defIgnore,
   hits:c.hits,finalMul:c.finalMul,pulses:0,seed:(++this.serial*.618)%1};
  this.animateAttack(true,p.x-this.x,p.y-HERO_Y);Sfx.cast(this.id,true);return true;
 }
 protected updateQueues(dt:number,mgr:MonsterManager,projs:ProjectileManager):void{
  this.fx?.tick(dt);
  if(this.reap){const r=this.reap;r.age+=dt;const due=scytheReapPulseCount(r.age,r.hits);
   while(r.pulses<due){const last=r.pulses===r.hits-1;r.pulses++;
    for(const m of mgr.list){if(!live(m)||!scytheInDomain(m.x,m.hitY,r.x,r.y,r.radius))continue;
     m.takeDamage(r.damage*(last?r.finalMul:1),false,this.id,false,r.resCut,Math.atan2(m.hitY-r.y,m.x-r.x),last);
     this.lastDmg?.add(this.id,m.lastDamageTaken);if(last||r.pulses%3===1)this.effects().hit(m.x,m.hitY,last?38:21);
    }
    if(last){this.ultimateBeat(r.x,r.y,1.2,true);Sfx.impact(this.id,true);}
    else if(r.pulses%3===1)Sfx.shoot(this.id);
   }if(r.age>=r.duration)this.reap=null;
  }
  for(let i=this.spins.length-1;i>=0;i--){const s=this.spins[i];s.age+=dt;const due=scythePulseCount(s.age,s.duration);
   while(s.pulses<due){s.pulses++;for(const m of mgr.list){if(!live(m)||(m.x-s.x)**2+(m.hitY-s.y)**2>(s.radius+m.def.radius*.4)**2)continue;
    m.takeDamage(s.damage,false,this.id,false,s.resCut,Math.atan2(m.hitY-s.y,m.x-s.x));this.lastDmg?.add(this.id,m.lastDamageTaken);
    if(s.pulses%2===1)this.effects().hit(m.x,m.hitY,20);
   }}if(s.age>=scythePose(s.age,s.duration,s.sx,s.sy,s.x,s.y).end)this.spins.splice(i,1);
  }
  // Ordinary serial shots retain the existing projectile capacity gate.
  for(const p of this.pending)p.delay-=dt;
  for(let i=0;i<this.pending.length;){const p=this.pending[i];if(p.delay>1e-7||!projs.hasCapacity){i++;continue;}
   const target=this.selectNormalTarget(mgr);if(target)this.normal(target,projs);this.pending.splice(i,1);
  }
 }
}
