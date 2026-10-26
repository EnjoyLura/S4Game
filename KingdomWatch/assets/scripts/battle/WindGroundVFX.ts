/** Ground-only contact dust. Draw before the flipbook and the monster layer. */
import { Graphics } from 'cc';
import { CA } from '../ui/UIKit';
export function drawWindEyeContact(g:Graphics,x:number,y:number,r:number,age:number,alpha:number):void{
  for(let k=5;k>=1;k--){
    const rr=r*(.40+k*.11);
    g.fillColor=CA('#423E28',alpha*.018);g.ellipse(x,y-3,rr,rr*.34);g.fill();
  }
  for(let k=0;k<15;k++){
    const a=k*2.399963+age*.28,rr=r*(.67+(k%4)*.075),pulse=.65+.35*Math.sin(age*1.8+k);
    const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.34;
    g.fillColor=CA(k%3?'#B59D6B':'#756342',alpha*.055*pulse);
    g.ellipse(px,py,r*(.095+(k%3)*.018),r*.018);g.fill();
  }
}
