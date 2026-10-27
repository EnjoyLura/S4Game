import { Graphics, Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { DESIGN_W,HERO_Y,LINE_Y,LO } from '../config/GameConfig';
import { LANCE,lanceSkillCfg,lanceUltCfg } from '../config/ThunderLanceConfig';
import { ULT_TIMING } from './UltimateTiming';
import { Sfx } from '../core/Sfx';
import { artSprite } from '../ui/Ux';
import { CA,N } from '../ui/UIKit';
import { densestBodyArea } from './WindNinjaGeometry';
import { lanceDuePulses,lanceRainPlan,lanceRecallCount } from './ThunderLancePlans';
import { LanceVisual,ThunderLanceVFX } from './ThunderLanceVFX';

interface Field extends LanceVisual {damage:number;crit:boolean;interval:number;next:number;resCut:number;}
interface Shot {delay:number;kind:'normal'|'rain'|'great';x?:number;y?:number;}
const live=(m:Monster)=>!m.dead&&m.node.isValid&&m.node.activeInHierarchy;
export class ThunderLanceHero extends HeroBase {
  readonly id='lance';readonly name='雷恩·逐霆';readonly chargeMax=LANCE.energy;readonly skillMax=LANCE.cooldown;
  private fx:ThunderLanceVFX|null=null;
  private fields:Field[]=[];private pending:Shot[]=[];private serial=0;private facing=-1;
  constructor(parent:Node,x:number,stats:HeroStats){super(parent,x,stats);
    this.node.once(Node.EventType.NODE_DESTROYED,()=>{this.pending.length=0;this.fields.length=0;this.fx?.destroy();this.fx=null;});}
  protected buildVisual(parent:Node):void{
    this.node.layer=parent.layer;this.node.setParent(parent);this.node.setPosition(this.x,HERO_Y,0);
    const g=N('heroContactShadow',this.node).addComponent(Graphics);g.fillColor=CA('#322A20',.28);g.ellipse(0,-74,27,7);g.fill();
    this.staticArt=artSprite(this.node,0,-76+180*(744/768-.5),120,180,'new_heroes_v137/lance_battle',{sliced:false});
  }
  protected faceAttack(dx:number,dy:number):void{if(Math.abs(dx)/(Math.hypot(dx,dy)||1)<.06)return;
    this.facing=dx>0?1:-1;this.staticArt?.setScale(this.facing>0?-1:1,1,1);}
  private effects():ThunderLanceVFX{return this.fx ||=new ThunderLanceVFX(this.node.parent!.parent||this.node.parent!);}
  warmEffects():void{this.effects();}
  renderEffects():void{this.fx?.render(this.fields);}
  protected queuedShotDelay():number{return this.pending.reduce((n,p)=>Math.min(n,p.delay),Infinity);}
  private dense(mgr:MonsterManager,radius:number,range=Infinity):{x:number;y:number}|null{
    // Lightning reaches flying bodies; footprint selection keeps the spear planted in the map.
    return densestBodyArea(mgr.list.filter(live).map(m=>({x:m.x,hitY:m.groundY,dead:false})),this.x,HERO_Y,range,radius,
      {left:-DESIGN_W/2+30,right:DESIGN_W/2-30,bottom:LINE_Y+50,top:LO.half-LO.notchTop-150});
  }
  protected shoot(target:Monster,mgr:MonsterManager,projs:ProjectileManager):void{
    this.normal(target,mgr,projs);
    for(let i=1;i<=Math.min(24,this.stats.serial||0)&&this.pending.length<96;i++)this.pending.push({kind:'normal',delay:i*.12});
  }
  private normal(target:Monster,mgr:MonsterManager,projs:ProjectileManager):void{
    const sx=this.x+this.facing*26,sy=HERO_Y+95;
    const speed=target.state==='move'&&!target.immobilized?target.def.speed*(target.slowT>0?1-target.slowAmp:1):0;
    const travel=Math.hypot(target.x-sx,target.groundY-sy)/LANCE.speed;
    for(let k=0;k<Math.min(12,1+(this.stats.fan||0))&&projs.hasCapacity;k++){
      const side=k?Math.ceil(k/2)*(k%2?1:-1)*36:0;
      this.launch({kind:'normal',delay:0,x:target.x+side,y:Math.max(LINE_Y+25,target.groundY-speed*travel)},mgr,projs);
    }
  }
  protected castSkill(mgr:MonsterManager,_projs:ProjectileManager,_dmg:DamageService):void{
    const cfg=lanceSkillCfg(this.stats.skillLv),p=this.dense(mgr,cfg.radius*this.stats.skillRangeMul,this.stats.skillRange);
    if(!p||this.pending.length+cfg.maxCount>96)return;
    const recalled=this.fields.filter(f=>!f.giant);
    const count=lanceRecallCount(recalled.length,cfg.count,cfg.maxCount);
    for(const f of recalled)this.effects().recall(f,this.x,HERO_Y+95,LANCE.recallSeconds);
    this.fields=this.fields.filter(f=>f.giant);this.beginSkillCooldown();
    this.effects().mark(p.x,p.y,cfg.radius*this.stats.skillRangeMul,LANCE.recallSeconds+.35);
    for(const shot of lanceRainPlan(p.x,p.y,count,cfg.radius*this.stats.skillRangeMul))
      this.pending.push({...shot,kind:'rain',delay:LANCE.recallSeconds+shot.delay});
    Sfx.cast(this.id);
  }
  castUlt(mgr:MonsterManager,_projs:ProjectileManager,dmg:DamageService):boolean{
    const cfg=lanceUltCfg(this.stats.ultLv),p=this.dense(mgr,cfg.radius*this.stats.skillRangeMul);
    if(!this.ultReady||!p||this.pending.length>=96)return false;
    this.lastDmg=dmg;this.charge=0;const windup=ULT_TIMING.lance.windup;
    this.beginUltimate(windup+.65+cfg.seconds+.3);
    this.pending.push({kind:'great',delay:windup,...p});
    this.effects().mark(p.x,p.y,cfg.radius*this.stats.skillRangeMul,windup+.65);Sfx.cast(this.id,true);return true;
  }
  private strike(mgr:MonsterManager,x:number,y:number,radius:number,damage:number,crit:boolean,resCut:number,heavy=false):void{
    for(const m of mgr.list){if(!live(m)||(m.x-x)**2+(m.groundY-y)**2>radius*radius)continue;
      let amount=damage;
      if(this.stats.executeBonus&&m.hp/m.maxHp<.3)amount*=1+this.stats.executeBonus;
      if(this.stats.lowHpBonus&&m.hp/m.maxHp<.5)amount*=1+this.stats.lowHpBonus;
      m.takeDamage(amount,crit,this.id,false,resCut,Math.PI/2,heavy);this.lastDmg?.add(this.id,m.lastDamageTaken);
      this.effects().arc(x,y+12,m.x,m.hitY,heavy);
    }
  }
  private launch(p:Shot,mgr:MonsterManager,projs:ProjectileManager):boolean{
    const giant=p.kind==='great',normal=p.kind==='normal',cfg=lanceSkillCfg(this.stats.skillLv),ult=lanceUltCfg(this.stats.ultLv);
    const x=Math.max(-DESIGN_W/2+20,Math.min(DESIGN_W/2-20,p.x!)),y=Math.max(LINE_Y+25,Math.min(LO.half-LO.notchTop-140,p.y!));
    const sx=normal||giant?this.x+this.facing*26:x+65,sy=normal||giant?HERO_Y+95:LO.half+90;
    const crit=normal&&Math.random()<this.stats.critRate,base=this.effAtk*this.stats.normalMul*(crit?this.stats.critMul:1);
    const damage=normal?base:this.abilityDamage(giant?ult.mul:cfg.mul,giant);
    const tickDamage=normal?base*LANCE.tickMul:this.abilityDamage(giant?ult.pulseMul:cfg.tickMul,giant);
    const radius=(giant?ult.radius:LANCE.radius)*(normal?1:this.stats.skillRangeMul);
    const seconds=giant?ult.seconds:normal?LANCE.seconds:cfg.seconds,interval=giant?ult.interval:normal?LANCE.interval:cfg.interval;
    const resCut=this.stats.defIgnore,seed=(++this.serial*.61803398875)%1;
    const angle=-Math.PI/2+(seed-.5)*.36;
    const flightSeconds=normal?Math.hypot(x-sx,y-sy)/LANCE.speed:giant?.65:.38;
    const fired=projs.fire({x:sx,y:sy,dirX:x-sx,dirY:y-sy,speed:Math.hypot(x-sx,y-sy)/Math.max(.001,flightSeconds),
      dmg:damage,crit,heroId:this.id,color:'#FFD34F',visual:giant?'greatLance':'lance',size:giant?35:9,ult:giant,ability:!normal,
      lanceFlight:normal||giant?{seconds:flightSeconds,height:Math.max(giant?260:75,(y-sy)/4+(giant?120:40))}:undefined,
      groundTarget:{x,y},targetLayer:'all',onGroundDamage:()=>{if(this.node.isValid)this.strike(mgr,x,y,radius,damage,crit,resCut,giant);},
      onGroundImpact:()=>{if(!this.node.isValid)return;
        if(this.fields.filter(f=>!f.giant).length>=LANCE.fieldCap&&!giant){const k=this.fields.findIndex(f=>!f.giant);this.fields.splice(k,1);}
        this.fields.push({x,y,radius,giant,age:0,seconds,interval,next:0,damage:tickDamage,crit,resCut,seed,angle});
        this.effects().impact(x,y,radius,giant,seed);if(giant)this.ultimateBeat(x,y,1.35,true);Sfx.impact(this.id,giant);
      }});
    if(fired){this.animateAttack(giant,x-sx,y-sy);if(normal)Sfx.shoot(this.id);}return fired;
  }
  protected updateQueues(dt:number,mgr:MonsterManager,projs:ProjectileManager):void{
    this.fx?.tick(dt);
    for(let i=0;i<this.fields.length;){const f=this.fields[i];f.age+=dt;
      const due=lanceDuePulses(f.age,f.next,f.interval,f.seconds);
      for(let k=0;k<due;k++){this.strike(mgr,f.x,f.y,f.radius,f.damage,f.crit,f.resCut);
        if(f.giant)this.effects().wave(f.x,f.y,f.radius,f.seed+f.next);f.next++;}
      if(f.age>=f.seconds)this.fields.splice(i,1);else i++;
    }
    for(let i=0;i<this.pending.length;){const p=this.pending[i];p.delay-=dt;if(p.delay>1e-7||!projs.hasCapacity){i++;continue;}
      if(p.kind==='normal'){const t=this.selectNormalTarget(mgr);if(t)this.normal(t,mgr,projs);}
      else if(!this.launch(p,mgr,projs)){i++;continue;}
      this.pending.splice(i,1);
    }
  }
}
