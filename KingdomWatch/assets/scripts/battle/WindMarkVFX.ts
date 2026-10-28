/** Small mint wind crest. Drawn in the existing status overlay; no nodes, timers or textures. */
import { Color,Graphics } from 'cc';
const tint=new Color();
export function drawWindMark(g:Graphics,x:number,y:number,seconds:number,age:number):void {
  const fade=Math.min(1,Math.max(0,seconds/.2)),pulse=1+Math.exp(-age*14)*.18;
  for(let layer=0;layer<2;layer++){
    tint.set(layer?193:29,layer?255:99,layer?222:84,Math.round(fade*(layer?240:135)));
    g.strokeColor=tint;g.lineWidth=layer?1.7:4.5;
    for(let k=0;k<3;k++){
      const w=(13-k*3)*pulse,yy=y+(k-1)*6;
      g.moveTo(x-w,yy);g.bezierCurveTo(x-w*.2,yy-4,x+w*.65,yy-3,x+w,yy+2);
      if(k===0)g.bezierCurveTo(x+w+4,yy+8,x+w-6,yy+10,x+w-5,yy+4);
      g.stroke();
    }
  }
}
