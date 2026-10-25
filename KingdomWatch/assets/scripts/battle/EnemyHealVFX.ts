/** Successful enemy heals only: tracked links and bounded green motes, driven by battle dt. */
import { Color, Graphics, Node } from 'cc';
import { N } from '../ui/UIKit';
export interface HealingBody {
  x: number; y: number; lifeId: number; dead: boolean; groundY: number;
  node: { isValid: boolean; activeInHierarchy: boolean }; def: { radius: number };
}
interface Link { src: HealingBody; target: HealingBody; sourceLife: number; targetLife: number; age: number; }
export class EnemyHealVFX {
  private g: Graphics;
  private links: Link[] = [];
  private free: Link[] = [];
  private tint = new Color();
  constructor(parent: Node) {
    this.g = N('enemyHealingLinks', parent).addComponent(Graphics);
    for (let i=0;i<24;i++) this.free.push({} as Link);
  }
  connect(src: HealingBody, target: HealingBody): void {
    const p=this.free.pop() || this.links.shift(); if (!p) return;
    p.src=src; p.target=target; p.sourceLife=src.lifeId; p.targetLife=target.lifeId; p.age=0;
    this.links.push(p);
  }
  private valid(body: HealingBody, life: number): boolean {
    return body.lifeId===life && !body.dead && body.node.isValid && body.node.activeInHierarchy;
  }
  tick(dt: number): void {
    const g=this.g; g.clear();
    for (let i=this.links.length-1;i>=0;i--) {
      const p=this.links[i]; p.age+=dt;
      if (p.age>=.9 || !this.valid(p.src,p.sourceLife) || !this.valid(p.target,p.targetLife)) {
        this.links.splice(i,1); this.free.push(p); continue;
      }
      const fade=Math.min(1,p.age/.06)*Math.min(1,(.9-p.age)/.3), r=p.target.def.radius;
      const sx=p.src.x,sy=p.src.y+p.src.def.radius*1.3,tx=p.target.x,ty=p.target.y+r*1.2;
      const dx=tx-sx,dy=ty-sy,len=Math.max(1,Math.hypot(dx,dy)),bend=Math.min(16,len*.08);
      const cx=(sx+tx)*.5-dy/len*bend,cy=(sy+ty)*.5+dx/len*bend;
      for (let layer=0;layer<3;layer++) {
        this.tint.set(layer===2?203:78,layer===2?255:225,layer===2?202:115,Math.round(fade*(layer===0?45:layer===1?185:225)));
        g.strokeColor=this.tint; g.lineWidth=layer===0?7:layer===1?2.6:1;
        g.moveTo(sx,sy); g.quadraticCurveTo(cx,cy,tx,ty); g.stroke();
      }
      // Three bright packets travel from the caster toward the healed body.
      for (let k=0;k<3;k++) {
        const t=(p.age*1.7+k/3)%1,u=1-t;
        this.tint.set(189,255,174,Math.round(fade*210)); g.fillColor=this.tint;
        g.circle(u*u*sx+2*u*t*cx+t*t*tx,u*u*sy+2*u*t*cy+t*t*ty,1.7); g.fill();
      }
      this.tint.set(94,235,128,Math.round(fade*140)); g.strokeColor=this.tint; g.lineWidth=1.6;
      g.ellipse(tx,p.target.groundY,r*(.85+p.age*.12),r*.29); g.stroke();
      for (let k=0;k<6;k++) {
        const phase=(p.age*.8+k/6)%1,a=k*2.4+p.targetLife*.3;
        const x=tx+Math.cos(a)*r*(.55+.4*phase),y=ty-r*.55+phase*r*2.6;
        const opacity=fade*Math.sin(phase*Math.PI);
        this.tint.set(128,244,144,Math.round(opacity*225)); g.strokeColor=this.tint; g.fillColor=this.tint;
        if (k%3===0) {
          const size=3;g.lineWidth=1.8;g.moveTo(x-size,y);g.lineTo(x+size,y);g.moveTo(x,y-size);g.lineTo(x,y+size);g.stroke();
        } else {g.ellipse(x,y,1.5,3);g.fill();}
      }
    }
  }
}
