/** Cannon-only charge marks and short ground waves; no textures or independent clocks. */
import { Color, Graphics, Node } from 'cc';
import type { Monster, MonsterManager } from './Monster';
import { CANNON_CARDS_CFG as CC } from '../config/NewHeroConfig';
import { LO } from '../config/GameConfig';
import { N } from '../ui/UIKit';
interface Charge { mob: Monster; life: number; remaining: number; damage: number; }
interface Wave { x: number; y: number; width: number; age: number; damage: number; critical: boolean; hit: Set<number>; }
export class CannonAugments {
  private charges: Charge[] = [];
  private waves: Wave[] = [];
  private free: Wave[] = [];
  private ground: Graphics;
  private marks: Graphics;
  private tint = new Color();
  constructor(field: Node, private deal: (mob: Monster, damage: number, critical: boolean, angle: number) => void) {
    this.ground = N('cannonGroundWaves', field.getChildByName('GroundFxLayer')!).addComponent(Graphics);
    this.marks = N('cannonChargeMarks', field.getChildByName('FxLayer')!).addComponent(Graphics);
  }
  mark(mob: Monster, damage: number): void {
    if (mob.dead) return;
    let p = this.charges.find(p => p.mob === mob && p.life === mob.lifeId);
    if (!p) { p = { mob, life: mob.lifeId, remaining: 0, damage: 0 }; this.charges.push(p); }
    p.remaining = CC.chargeSeconds; p.damage = Math.max(p.damage, damage);
  }
  consume(mob: Monster): number {
    const i = this.charges.findIndex(p => p.mob === mob && p.life === mob.lifeId);
    if (i < 0) return 0;
    const p = this.charges.splice(i, 1)[0]; return p.remaining > 0 ? p.damage : 0;
  }
  wave(x: number, y: number, radius: number, damage: number, critical: boolean): void {
    const p = this.free.pop() || { x:0,y:0,width:0,age:0,damage:0,critical:false,hit:new Set<number>() };
    p.x=x;p.y=y;p.width=radius*.6;p.age=0;p.damage=damage;p.critical=critical;p.hit.clear();this.waves.push(p);
  }
  tick(dt: number, manager: MonsterManager): void {
    for (let i=this.charges.length-1;i>=0;i--) {
      const p=this.charges[i];p.remaining-=dt;
      if (p.remaining<=0 || p.mob.dead || p.mob.lifeId!==p.life || !p.mob.node.isValid || !p.mob.node.activeInHierarchy)
        this.charges.splice(i,1);
    }
    for (let i=this.waves.length-1;i>=0;i--) {
      const p=this.waves[i],before=p.age;p.age=Math.min(CC.waveSeconds,p.age+dt);
      const from=p.y+CC.waveDistance*before/CC.waveSeconds,to=p.y+CC.waveDistance*p.age/CC.waveSeconds;
      for (const m of manager.list) {
        if(m.dead || m.y>LO.half || p.hit.has(m.lifeId) || Math.abs(m.x-p.x)>p.width+m.def.radius ||
          m.y<from-14-m.def.radius || m.y>to+14+m.def.radius) continue;
        p.hit.add(m.lifeId);this.deal(m,p.damage,p.critical,Math.PI/2);
      }
      if(p.age>=CC.waveSeconds){this.waves.splice(i,1);this.free.push(p);}
    }
  }
  render(): void {
    const g=this.ground;g.clear();
    for(const p of this.waves){
      const t=p.age/CC.waveSeconds,y=p.y+CC.waveDistance*t,fade=1-t*.8;
      for(let k=0;k<3;k++){
        this.tint.set(k===0?129:245,k===0?84:200,k===0?43:119,Math.round(fade*(k===0?95:220)));
        g.strokeColor=this.tint;g.lineWidth=k===0?12:2.8-k*.7;
        g.moveTo(p.x-p.width,y-12-k*7);g.quadraticCurveTo(p.x,y+20-k*7,p.x+p.width,y-12-k*7);g.stroke();
      }
      for(let k=0;k<5;k++){
        const x=p.x+(k-2)*p.width*.36,sy=y-12-(k%2)*8;
        this.tint.set(203,153,82,Math.round(fade*170));g.fillColor=this.tint;
        g.moveTo(x,sy+3);g.lineTo(x+3,sy-2);g.lineTo(x-3,sy-3);g.close();g.fill();
      }
    }
    const m=this.marks;m.clear();
    for(const p of this.charges){
      const x=p.mob.x+p.mob.def.radius*.8,y=p.mob.y+p.mob.headTop*.55,fade=Math.min(1,p.remaining/.4);
      this.tint.set(214,159,73,Math.round(fade*240));m.fillColor=this.tint;
      this.tint.set(55,35,20,Math.round(fade*255));m.strokeColor=this.tint;m.lineWidth=1.6;
      m.roundRect(x-4,y-5,8,10,2);m.fill();m.stroke();
      this.tint.set(255,220,124,Math.round(fade*250));m.strokeColor=this.tint;m.lineWidth=1.4;
      m.moveTo(x,y+5);m.quadraticCurveTo(x+6,y+6,x+4,y+10);m.stroke();
      m.fillColor=this.tint;m.circle(x+4,y+10,1.6);m.fill();
    }
  }
}
