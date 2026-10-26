/** Pure forward-only steering: the rendered field and damage center use the same position. */
import { BodyPoint, FieldPoint } from './WindNinjaGeometry';

export function stableWindTarget(bodies:readonly BodyPoint[],point:FieldPoint,previous:FieldPoint,
  candidate:FieldPoint,radius:number):FieldPoint {
  const old={x:previous.x,y:Math.max(point.y,previous.y)},next={x:candidate.x,y:Math.max(point.y,candidate.y)};
  const count=(p:FieldPoint)=>bodies.reduce((n,m)=>n+Number(!m.dead&&m.hitY>=point.y&&(m.x-p.x)**2+(m.hitY-p.y)**2<=radius**2),0);
  const oldCount=count(old),newCount=count(next),nearOld=Math.hypot(old.x-point.x,old.y-point.y)<Math.max(18,radius*.22);
  // A one-monster / equal-score fluctuation cannot yank an established path sideways.
  if(oldCount>0&&!nearOld&&newCount<oldCount+2)return old;
  if(oldCount>0&&Math.hypot(next.x-old.x,next.y-old.y)<18)return old;
  return next;
}

export function moveWindField(point:FieldPoint,velocity:FieldPoint,target:FieldPoint,speed:number,dt:number):void {
  if(!Number.isFinite(dt)||dt<=0||speed<=0)return;
  let left=Math.min(dt,10);
  // Fixed maximum integration step also handles catch-up frames without abrupt reversals.
  while(left>1e-8){
    const h=Math.min(.025,left),dx=target.x-point.x,dy=Math.max(0,target.y-point.y),distance=Math.hypot(dx,dy);
    const travelSpeed=Math.min(speed,distance/.24),vx=distance>1e-6?dx/distance*travelSpeed:0,vy=distance>1e-6?dy/distance*travelSpeed:0;
    const decay=Math.exp(-h/.18),oldX=velocity.x,oldY=Math.max(0,velocity.y);
    velocity.x=vx+(oldX-vx)*decay;velocity.y=Math.max(0,vy+(oldY-vy)*decay);
    point.x+=vx*h+(oldX-vx)*.18*(1-decay);
    point.y+=Math.max(0,vy*h+(oldY-vy)*.18*(1-decay));
    left-=h;
  }
}
