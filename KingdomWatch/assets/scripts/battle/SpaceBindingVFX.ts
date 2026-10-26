/** Linked restraints and ground seals, cosmetic only. No combat or wall-clock state. */
import { Graphics } from 'cc';
import { CA } from '../ui/UIKit';
const TAU=Math.PI*2;

export function drawSpaceChains(g:Graphics,x:number,y:number,groundY:number,r:number,age:number,alpha:number):void{
  const tighten=Math.min(1,age/.42),fade=alpha*Math.min(1,age/.12);
  if(fade<=0)return;
  const w=r*.67,h=r*.54,link=Math.max(4,Math.min(7,r*.075));
  // Alternating face-on / edge-on links remain readable over the luminous column.
  const strand=(points:[number,number][],seed:number)=>{
    for(let k=1;k<points.length;k++){
      const a=points[k-1],b=points[k],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),count=Math.max(1,Math.ceil(d/(link*1.45)));
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,cx=a[0]+dx*t,cy=a[1]+dy*t,u=dx/Math.max(d,.001),v=dy/Math.max(d,.001);
        const thin=(j+k+seed)%2===0?.52:.22;
        const path=()=>{for(let n=0;n<=10;n++){const th=n*TAU/10,along=Math.cos(th)*link,across=Math.sin(th)*link*thin;
          const px=cx+u*along-v*across,py=cy+v*along+u*across;n?g.lineTo(px,py):g.moveTo(px,py);}g.close();};
        g.strokeColor=CA('#291638',fade*.9);g.lineWidth=3.7;path();g.stroke();
        g.strokeColor=CA('#C78AE8',fade);g.lineWidth=2.25;path();g.stroke();
        g.strokeColor=CA('#FBE5FF',fade*.9);g.lineWidth=.85;path();g.stroke();
      }
    }
  };
  for(let side=-1;side<=1;side+=2){
    const slack=(1-tighten)*r*.36,shake=Math.sin(age*17+side)*r*.008*tighten;
    strand([[x-side*w*1.2,groundY],[x-side*w*.84,y-h*.7-slack],
      [x+shake,y],[x+side*w*.78,y+h*.64],[x+side*w*.9,y-h*.25]],side+1);
  }
  // A short lower wrap closes the restraint around the torso, leaving the face visible.
  const wrap:[number,number][]=[];
  for(let k=0;k<=8;k++){const t=k*Math.PI/8;wrap.push([x-Math.cos(t)*w*.88,y-h*.35-Math.sin(t)*h*.24]);}
  strand(wrap,0);
  const s=link*1.2,pulse=.76+.12*Math.sin(age*5);
  g.fillColor=CA('#57316F',fade);g.moveTo(x,y+s);g.lineTo(x+s*.8,y);g.lineTo(x,y-s);g.lineTo(x-s*.8,y);g.close();g.fill();
  g.strokeColor=CA('#F3C5FF',fade*pulse);g.lineWidth=1.5;g.stroke();
}

export function drawPortalSeal(g:Graphics,x:number,y:number,r:number,age:number,alpha:number):void{
  for(let band=0;band<2;band++)for(let k=0;k<8;k++){
    const a=k*TAU/8+age*(band?-.16:.13),rr=r*(band?.69:.96);
    g.strokeColor=CA(band?'#D39FF3':'#F2C9FF',alpha*.7);g.lineWidth=band?2:3;
    for(let n=0;n<=5;n++){const th=a+n*.075,px=x+Math.cos(th)*rr,py=y+Math.sin(th)*rr*.36;n?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
    const th=a+.16;g.moveTo(x+Math.cos(th)*rr*.83,y+Math.sin(th)*rr*.83*.36);
    g.lineTo(x+Math.cos(th)*rr*.95,y+Math.sin(th)*rr*.95*.36);g.stroke();
  }
}
