/** Jade sword spell presentation. No collision, damage, movement or wall-clock state. */
import { Graphics } from 'cc';
import { CA } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
export const SWORD_ABILITY_EFFECT = 'fx/sword-jade-flow';
export const SWORD_FLIGHT_CAP = 24;

/** The point passed by ProjectileManager remains the exact sword tip / landing point. */
export function drawSwordFlight(shader: HeroFxShader | null, x: number, y: number, angle: number,
  size: number, age: number, seed: number, giant: boolean, opacity = 1, planted = false): boolean {
  if (!shader) return false;
  const length = size * (giant ? 5.6 : 7.8), ux = Math.cos(angle), uy = Math.sin(angle);
  return shader.draw(x - ux * length * .65, y - uy * length * .65, length * .9, length * 2.7,
    angle * 180 / Math.PI - 90, age, seed, opacity, 0, length, (giant ? 1 : 0) + (planted ? 2 : 0));
}

/** Cosmetic hold duration only. Damage and the release/landing schedule remain owned by the hero. */
export function swordImpactLife(giant: boolean, radius: number): number {
  return giant ? 1.4 : radius > 100 ? 1.08 : .82;
}

/** Match the shader's buried fraction, so its visible edge ends exactly at the ground point. */
export function swordEmbedDepth(size:number,age:number,giant:boolean):number {
  const t=Math.min(1,Math.max(0,age/.12)),ease=t*t*(3-2*t);
  return size*(giant?5.6:7.8)*(giant?.085:.075)*ease;
}

/** The near side of displaced soil is drawn AFTER the sword, occluding its inserted point. */
export function swordSoilLip(g:Graphics,x:number,y:number,r:number,age:number,giant:boolean,opacity:number):void {
  const open=Math.min(1,age/.08),alpha=Math.max(0,opacity)*open;
  if(alpha<=0)return;
  const w=Math.max(5,r*(giant?.115:.12)),h=Math.max(3,w*.24);
  g.fillColor=CA('#28291F',alpha*.85);g.ellipse(x,y-1,w*.80,h*.7);g.fill();
  // Broken earth spans the blade base; its top crest overlaps the clipped tip by a few pixels.
  g.fillColor=CA('#655A3F',alpha*.93);
  g.moveTo(x-w,y-2);g.lineTo(x-w*.68,y+h*.45);g.lineTo(x-w*.35,y+h*.7);
  g.lineTo(x-w*.08,y+h*.24);g.lineTo(x+w*.24,y+h*.61);g.lineTo(x+w*.65,y+h*.35);
  g.lineTo(x+w,y-2);g.lineTo(x+w*.65,y-h*.55);g.lineTo(x-w*.55,y-h*.45);g.close();g.fill();
  g.strokeColor=CA('#BDA878',alpha*.70);g.lineWidth=giant?1.8:1;
  g.moveTo(x-w*.68,y+h*.45);g.lineTo(x-w*.35,y+h*.7);g.lineTo(x-w*.08,y+h*.24);g.stroke();
  g.moveTo(x+w*.24,y+h*.61);g.lineTo(x+w*.65,y+h*.35);g.lineTo(x+w*.82,y);g.stroke();
  for(let k=0;k<4;k++){const px=x+(k-1.5)*w*.52,py=y-h*.48-(k%2)*h*.24,s=w*(.09+k%2*.03);
    g.fillColor=CA(k%2?'#87764F':'#4B4835',alpha*.92);g.moveTo(px-s,py);g.lineTo(px-s*.3,py+s*.6);g.lineTo(px+s,py+s*.2);g.lineTo(px+s*.55,py-s*.35);g.close();g.fill();}
}

export function swordCrater(g: Graphics, x: number, y: number, radius: number, age: number, giant: boolean): void {
  const life=swordImpactLife(giant,radius),fade=Math.min(1,age*24)*Math.min(1,(life-age)*3);
  if(fade<=0)return;
  const reach=radius*(giant?.38:.32),open=Math.min(1,age*16);
  for(let k=0;k<(giant?9:5);k++){
    const a=k*2.399963,rr=reach*(.6+(k%3)*.18)*open;
    const ax=x+Math.cos(a)*rr*.34,ay=y+Math.sin(a)*rr*.14;
    const bx=x+Math.cos(a+.13)*rr*.67,by=y+Math.sin(a+.13)*rr*.27;
    const cx=x+Math.cos(a-.05)*rr,cy=y+Math.sin(a-.05)*rr*.4;
    g.strokeColor=CA('#302E27',fade*.65);g.lineWidth=giant?3.6:2;
    g.moveTo(x,y);g.lineTo(ax,ay);g.lineTo(bx,by);g.lineTo(cx,cy);g.stroke();
    g.strokeColor=CA('#CEB688',fade*.5);g.lineWidth=1;
    g.moveTo(ax,ay+1.5);g.lineTo(bx,by+1.5);g.lineTo(cx,cy+1.5);g.stroke();
  }
}

/** Small grounded debris has weight, an upward impulse and a finite landing, not star confetti. */
export function swordDebris(g: Graphics, x: number, y: number, radius: number, age: number, giant: boolean): void {
  const life = giant ? 1.15 : .64, t = Math.min(1, age / life);
  if (t >= 1) return;
  const count = giant ? 20 : 7, spread = radius * (giant ? .72 : .52);
  for (let k = 0; k < count; k++) {
    const a = k * 2.399963, speed = .36 + (k % 4) * .16;
    const d = spread * speed * (1 - (1 - t) ** 2);
    const up = Math.max(0, Math.sin(Math.min(1, t * 1.25) * Math.PI)) * radius * (.21 + k % 3 * .06);
    const px = x + Math.cos(a) * d, groundY = y + Math.sin(a) * d * .35;
    const s = (giant ? 5.3 : 2.6) * (1 - t * .35) * (1 + (k % 3) * .25), spin = a + t * (k % 2 ? 4 : -3);
    g.fillColor = CA('#3A3427', (1 - t) * .22); g.ellipse(px, groundY - 1, s * 1.5, s * .5); g.fill();
    g.fillColor = CA(k % 3 ? '#736957' : '#A7AA8A', (1 - t) * .95);
    g.moveTo(px + Math.cos(spin) * s, groundY + up + Math.sin(spin) * s);
    g.lineTo(px + Math.cos(spin + 2.1) * s * 1.4, groundY + up + Math.sin(spin + 2.1) * s * 1.4);
    g.lineTo(px + Math.cos(spin + 4.0) * s, groundY + up + Math.sin(spin + 4.0) * s); g.close(); g.fill();
    g.strokeColor=CA('#D3C4A1',(1-t)*.7);g.lineWidth=1;
    g.moveTo(px+Math.cos(spin)*s,groundY+up+Math.sin(spin)*s);
    g.lineTo(px+Math.cos(spin+2.1)*s*1.4,groundY+up+Math.sin(spin+2.1)*s*1.4);g.stroke();
  }
}
