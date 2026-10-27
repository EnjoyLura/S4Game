import { Graphics,Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster,MonsterManager } from './Monster';
import { ProjectileManager } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { DESIGN_W,HERO_Y,LINE_Y,LO } from '../config/GameConfig';
import { MAGIC_BOW as B,MAGIC_BOW_TIMING as T,magicBowSkillCfg,magicBowUltCfg } from '../config/MagicBowConfig';
import { magicBowTimeline } from './MagicBowPlans';
import { Sfx } from '../core/Sfx';
import { artSprite } from '../ui/Ux';
import { CA,N } from '../ui/UIKit';
import { densestBodyArea,interceptDirection } from './WindNinjaGeometry';
import { MagicBowVFX } from './MagicBowVFX';
interface Cast {x:number;y:number;impact:number;blast:number;impactRadius:number;radius:number;resCut:number;}
interface Pending {kind:'normal'|'skill'|'ascent'|'descent'|'blast';delay:number;cast?:Cast;}
const live=(m:Monster)=>!m.dead&&m.node.isValid&&m.node.activeInHierarchy;
export class MagicBowHero extends HeroBase {
 readonly id='arcane';readonly name='希琳·星弦';readonly chargeMax=B.energy;readonly skillMax=B.cooldown;
 private fx:MagicBowVFX|null=null;private pending:Pending[]=[];private facing=-1;private ultimatePending=false;
 constructor(parent:Node,x:number,stats:HeroStats){super(parent,x,stats);
  this.node.once(Node.EventType.NODE_DESTROYED,()=>{this.pending.length=0;this.ultimatePending=false;this.fx?.destroy();this.fx=null;});}
 protected buildVisual(parent:Node):void{
  this.node.layer=parent.layer;this.node.setParent(parent);this.node.setPosition(this.x,HERO_Y,0);
  const g=N('heroContactShadow',this.node).addComponent(Graphics);g.fillColor=CA('#222F3D',.28);g.ellipse(0,-74,27,7);g.fill();
  this.staticArt=artSprite(this.node,0,-76+180*(744/768-.5),120,180,'new_heroes_v138/arcane_battle',{sliced:false});
 }
 protected faceAttack(dx:number,dy:number):void{if(Math.abs(dx)/(Math.hypot(dx,dy)||1)<.06)return;
  this.facing=dx>0?1:-1;this.staticArt?.setScale(this.facing>0?-1:1,1,1);}
 private effects():MagicBowVFX{return this.fx ||=new MagicBowVFX(this.node.parent!.parent||this.node.parent!);}
 warmEffects():void{this.effects();} renderEffects():void{this.fx?.render();}
 get ultShowDuration():number{return magicBowTimeline().end;}
 protected queuedShotDelay():number{return this.pending.reduce((n,p)=>Math.min(n,p.delay),Infinity);}
 protected shoot(target:Monster,_mgr:MonsterManager,projs:ProjectileManager):void{
  this.normal(target,projs);
  // Reserve queue space for an already committed ultimate's descent and detonation.
  for(let k=1;k<=Math.min(24,this.stats.serial||0)&&this.pending.length<60;k++)this.pending.push({kind:'normal',delay:k*.12});
 }
 private normal(target:Monster,projs:ProjectileManager):void{
  const x=this.x+this.facing*30,y=HERO_Y+85;
  const speed=target.state==='move'&&!target.immobilized?target.def.speed*(target.slowT>0?1-target.slowAmp:1):0;
  const dir=interceptDirection(x,y,target.x,target.hitY,speed,B.speed);let fired=false;
  for(let k=0;k<Math.min(12,1+(this.stats.fan||0))&&projs.hasCapacity;k++){
   const a=k?Math.ceil(k/2)*(k%2?1:-1)*.09:0,ca=Math.cos(a),sa=Math.sin(a),crit=Math.random()<this.stats.critRate;
   fired=projs.fire({x,y,dirX:dir.dirX*ca-dir.dirY*sa,dirY:dir.dirX*sa+dir.dirY*ca,speed:B.speed,
    dmg:this.effAtk*this.stats.normalMul*(crit?this.stats.critMul:1),crit,heroId:this.id,color:'#69BFFF',visual:'magicArrow',size:10,
    targetLayer:'all',ttl:3,resCut:this.stats.defIgnore,pierce:this.stats.pierce||0,split:this.stats.split||0,
    explodeR:this.stats.explodeR||0,explodeMul:this.stats.explodeMul,slowRatio:this.stats.slowOnHit||0,slowDur:this.stats.slowDur||2,
    burnDps:this.stats.burnOnHit?this.effAtk*this.stats.burnOnHit*(this.stats.burnMul||1):0,burnDur:3,
    shockAmp:this.stats.shockOnHit||0,shockDur:3,...this.targetBonuses(),
    onContact:m=>{if(this.node.isValid)this.effects().hit(m.x,m.hitY,30);}})||fired;
  }
  if(fired)Sfx.shoot(this.id);
 }
 private dense(mgr:MonsterManager,radius:number,range=Infinity):{x:number;y:number}|null{
  return densestBodyArea(mgr.list.filter(live).map(m=>({x:m.x,hitY:m.groundY,dead:false})),this.x,HERO_Y,range,radius,
   {left:-DESIGN_W/2+28,right:DESIGN_W/2-28,bottom:LINE_Y+50,top:LO.half-LO.notchTop-155});
 }
 protected castSkill(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):void{
  const cfg=magicBowSkillCfg(this.stats.skillLv),radius=cfg.radius*this.stats.skillRangeMul,p=this.dense(mgr,radius,this.stats.skillRange);
  if(!p||this.pending.length>=60)return;
  const cast={...p,impact:0,blast:this.abilityDamage(cfg.mul),impactRadius:0,radius,resCut:this.stats.defIgnore};
  this.pending.push({kind:'skill',delay:.18,cast});this.beginSkillCooldown();this.effects().charge(this.x,HERO_Y+85,.18,false);Sfx.cast(this.id);
 }
 castUlt(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):boolean{
  const cfg=magicBowUltCfg(this.stats.ultLv),radius=cfg.radius*this.stats.skillRangeMul,p=this.dense(mgr,radius);
  if(!this.ultReady||this.ultimatePending||!p||this.pending.length>=60)return false;
  const cast={...p,impact:this.abilityDamage(cfg.mul,true),blast:this.abilityDamage(cfg.blastMul,true),
   impactRadius:cfg.impactRadius*this.stats.skillRangeMul,radius,resCut:this.stats.defIgnore};
  this.lastDmg=dmg;this.charge=0;this.ultimatePending=true;this.beginUltimate();
  this.pending.push({kind:'ascent',delay:T.windup,cast});this.effects().charge(this.x,HERO_Y+85,T.windup,true);Sfx.cast(this.id,true);return true;
 }
 private damage(mgr:MonsterManager,c:Cast,blast:boolean,ult:boolean):void{
  const r=blast?c.radius:c.impactRadius,amount=blast?c.blast:c.impact;
  for(const m of mgr.list){if(!live(m)||(m.x-c.x)**2+(m.groundY-c.y)**2>r*r)continue;
   m.takeDamage(amount,false,this.id,false,c.resCut,Math.PI/2,ult);this.lastDmg?.add(this.id,m.lastDamageTaken);}
 }
 private release(p:Pending,mgr:MonsterManager,projs:ProjectileManager):boolean{
  const c=p.cast!;
  if(p.kind==='blast'){
   this.damage(mgr,c,true,true);this.effects().explode(c.x,c.y,c.radius,true);
   this.ultimateBeat(c.x,c.y,1.2,true);Sfx.impact(this.id,true);this.ultimatePending=false;
   this.ultimateT=Math.max(this.ultimateT,T.tail);return true;
  }
  const up=p.kind==='ascent',skill=p.kind==='skill',x=up||skill?this.x+this.facing*30:c.x+65;
  const y=up||skill?HERO_Y+85:Math.max(LO.half+200,c.y+600),tx=up?x: c.x,ty=up?LO.half+230:c.y;
  const seconds=up?T.ascent:skill?Math.max(.18,Math.hypot(tx-x,ty-y)/B.speed):T.descent;
  const fired=projs.fire({x,y,dirX:tx-x,dirY:ty-y,speed:Math.hypot(tx-x,ty-y)/seconds,dmg:0,crit:false,
   heroId:this.id,color:'#69BFFF',visual:'magicArrow',size:skill?18:42,ult:!skill,ability:true,targetLayer:'all',groundTarget:{x:tx,y:ty},
   // Upward travel is visual only; descent owns impact, the queued detonation owns the second hit.
   onGroundDamage:()=>{if(!this.node.isValid||up)return;this.damage(mgr,c,skill,!skill);},
   onGroundImpact:()=>{if(!this.node.isValid)return;
    if(up){this.pending.push({kind:'descent',delay:T.skyPause,cast:c});this.effects().mark(c.x,c.y,c.radius,T.skyPause+T.descent);}
    else if(skill){this.effects().explode(c.x,c.y,c.radius,false);Sfx.impact(this.id,true);}
    else{this.effects().impact(c.x,c.y,c.impactRadius,Math.atan2(ty-y,tx-x),T.detonation);
     this.pending.push({kind:'blast',delay:T.detonation,cast:c});this.ultimateBeat(c.x,c.y,.55,true);Sfx.impact(this.id,true);}
   }});
  if(fired&&(up||skill))this.animateAttack(true,tx-x,ty-y);return fired;
 }
 protected updateQueues(dt:number,mgr:MonsterManager,projs:ProjectileManager):void{
  this.fx?.tick(dt);if(this.ultimatePending)this.ultimateT=Math.max(this.ultimateT,.6);
  for(let i=0;i<this.pending.length;){const p=this.pending[i];p.delay-=dt;
   if(p.delay>1e-7||(p.kind!=='blast'&&!projs.hasCapacity)){i++;continue;}
   if(p.kind==='normal'){const target=this.selectNormalTarget(mgr);if(target)this.normal(target,projs);}
   else if(!this.release(p,mgr,projs)){i++;continue;}
   this.pending.splice(i,1);
  }
 }
}
