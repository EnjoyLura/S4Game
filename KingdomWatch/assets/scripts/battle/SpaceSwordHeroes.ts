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
import { SpaceSwordVFX, drawFlyingSword } from './SpaceSwordVFX';
import { densestBodyArea, interceptDirection } from './WindNinjaGeometry';

interface Pending { delay:number; kind:'normal'|'skill'|'blade'|'rain';
  x?:number;y?:number;target?:Monster;life?:number;final?:boolean; }
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
  protected dense(mgr:MonsterManager,radius:number):{x:number;y:number}|null{
    return densestBodyArea(mgr.list,this.x,HERO_Y,Infinity,radius,{left:-DESIGN_W/2+24,right:DESIGN_W/2-24,
      bottom:LINE_Y+60,top:LO.half-LO.notchTop-145});
  }
}

export class SpaceHero extends SpaceSwordBase {
  readonly id='space';readonly name='伊芙·折界';readonly chargeMax=SPACE.energy;readonly skillMax=SPACE.cooldown;
  protected buildVisual(parent:Node):void{this.buildFigure(parent,'space');}
  protected projectileSpeed():number{return SPACE.speed;}
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
  castUlt(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):boolean{
    if(!this.ultReady||!mgr.list.some(live)||this.pending.length>92)return false;
    const cfg=spaceUltCfg(this.stats.ultLv),windup=ULT_TIMING.space.windup;
    this.charge=0;
    this.beginUltimate(windup+cfg.gap+(LO.half-HERO_Y+180)/cfg.speed);
    for(let k=0;k<2;k++)this.pending.push({kind:'blade',delay:windup+k*cfg.gap});
    Sfx.cast(this.id,true);return true;
  }
  protected release(p:Pending,_mgr:MonsterManager,projs:ProjectileManager):boolean{
    if(p.kind!=='blade')return true;
    const cfg=spaceUltCfg(this.stats.ultLv),y=LINE_Y+45,top=LO.half+100;
    return projs.fire({x:0,y,dirX:0,dirY:1,speed:cfg.speed,dmg:this.abilityDamage(cfg.mul,true),crit:false,
      heroId:this.id,color:'#BB63D8',visual:'spaceBlade',size:18,lineHalfLength:cfg.halfLength,
      lineForwardOffset:0,pierce:1000000,ttl:(top-y)/cfg.speed+.3,endPoint:{x:0,y:top},
      targetLayer:'all',ult:true,ability:true,resCut:this.stats.defIgnore,
      slowRatio:cfg.slow,slowDur:cfg.slowSeconds,onContact:m=>this.ultimateBeat(m.x,m.hitY,.3,false)});
  }
}

export class SwordHero extends SpaceSwordBase {
  readonly id='sword';readonly name='凌霄·御锋';readonly chargeMax=SWORD.energy;readonly skillMax=SWORD.cooldown;
  private intent=0;
  private orbit:Graphics|null=null;
  protected buildVisual(parent:Node):void{this.buildFigure(parent,'sword');}
  warmEffects():void{super.warmEffects();if(!this.orbit)this.orbit=N('swordIntent',this.node).addComponent(Graphics);}
  protected projectileSpeed():number{return SWORD.speed;}
  protected attackSpec(target:Monster,offset=0,ability=false,mul=1,speed=0):ProjSpec{
    const spec=super.attackSpec(target,offset,ability,mul,speed);
    // Intent belongs to the hero. Only a real basic hit, once per projectile, earns it.
    let earned=false;
    if(!ability)spec.onContact=()=>{if(!earned&&this.node.isValid){earned=true;this.intent=Math.min(SWORD.intentCap,this.intent+1);}};
    if(ability){spec.homingTarget=target;spec.homingLifeId=target.lifeId;}
    return spec;
  }
  private strongest(mgr:MonsterManager):Monster|null{
    let best:Monster|null=null;
    for(const m of mgr.list){if(!live(m)||(m.x-this.x)**2+(m.hitY-HERO_Y)**2>this.stats.skillRange**2)continue;
      if(!best||Number(m.isBoss)>Number(best.isBoss)||m.isBoss===best.isBoss&&Number(!!m.def.elite)>Number(!!best.def.elite)
        ||m.isBoss===best.isBoss&&!!m.def.elite===!!best.def.elite&&m.hp>best.hp)best=m;}
    return best;
  }
  protected castSkill(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):void{
    const t=this.strongest(mgr);if(!t||this.pending.length>80)return;
    const cfg=swordSkillCfg(this.stats.skillLv),count=cfg.swords+this.intent;
    this.intent=0;this.beginSkillCooldown();
    for(let k=0;k<count;k++)this.pending.push({kind:'skill',delay:k*.09,target:t,life:t.lifeId});
    Sfx.cast(this.id);
  }
  castUlt(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):boolean{
    const cfg=swordUltCfg(this.stats.ultLv),p=this.dense(mgr,cfg.radius);
    if(!this.ultReady||!p||this.pending.length+cfg.count+1>96)return false;
    const windup=ULT_TIMING.sword.windup;
    this.charge=0;this.beginUltimate(windup+cfg.count*SWORD.rainGap+1);
    this.effects().add('array',p.x,p.y,cfg.radius,windup+cfg.count*SWORD.rainGap+.9);
    for(let k=0;k<cfg.count;k++){
      const a=k*2.399963,r=Math.sqrt((k+.5)/cfg.count)*cfg.radius*.78;
      this.pending.push({kind:'rain',delay:windup+k*SWORD.rainGap,x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r*.65});
    }
    this.pending.push({kind:'rain',delay:windup+cfg.count*SWORD.rainGap+.12,x:p.x,y:p.y,final:true});
    Sfx.cast(this.id,true);return true;
  }
  protected release(p:Pending,mgr:MonsterManager,projs:ProjectileManager):boolean{
    if(p.kind==='skill'){
      const t=p.target&&p.target.lifeId===p.life&&live(p.target)&&mgr.list.indexOf(p.target)>=0?p.target:this.strongest(mgr);
      if(!t)return true;
      const cfg=swordSkillCfg(this.stats.skillLv);
      return projs.fire(this.attackSpec(t,0,true,cfg.mul,cfg.speed));
    }
    if(p.kind!=='rain')return true;
    const cfg=swordUltCfg(this.stats.ultLv),x=Math.max(-335,Math.min(335,p.x!)),y=Math.max(LINE_Y+35,Math.min(LO.half-150,p.y!));
    const radius=(p.final?cfg.radius:62)*this.stats.skillRangeMul,amount=this.abilityDamage(p.final?cfg.finalMul:cfg.mul,true);
    return projs.fire({x:x+45,y:LO.half+65,dirX:-45,dirY:y-LO.half-65,speed:p.final?1300:1550,
      dmg:amount,crit:false,heroId:this.id,color:'#63D2A4',visual:'sword',size:p.final?23:9,ult:true,ability:true,
      groundTarget:{x,y},targetLayer:'all',onGroundDamage:()=>{
        if(!this.node.isValid)return;
        for(const m of mgr.list){if(!live(m)||(m.x-x)**2+(m.hitY-y)**2>radius**2)continue;
          m.takeDamage(amount,false,this.id,false,this.stats.defIgnore,-Math.PI/2,!!p.final);this.lastDmg?.add(this.id,m.lastDamageTaken);}
      },onGroundImpact:()=>{if(!this.node.isValid)return;this.effects().add('cut',x,y,p.final?radius:60);
        this.ultimateBeat(x,y,p.final?1:.25,!!p.final);Sfx.impact(this.id,!!p.final);}});
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
