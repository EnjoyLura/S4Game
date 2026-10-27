// Pure geometry only: regression for forced lateral swerve, gravity, endpoints and apex drawing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),file='assets/scripts/battle/ThunderLancePlans.ts';
function moduleOf(text){const c={exports:{},Math};vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports;}
const now=moduleOf(fs.readFileSync(path.join(ROOT,file),'utf8'));
const old=moduleOf(cp.execFileSync('git',['show','6fbe9cfc:KingdomWatch/'+file],{cwd:path.resolve(ROOT,'..'),encoding:'utf8'}));
const previous=old.lanceFlightPlan(0,0,0,400,'great');
const oldLateral=Math.max(...Array.from({length:101},(_,i)=>Math.abs(old.lanceFlightPose(previous,i*previous.seconds/100).x)));
assert.ok(oldLateral>50,'Regression example did not reproduce the old lateral bow');
let cases=0,samples=0,maxAccelerationError=0,maxShaftStep=0;
for(const kind of ['normal','great','rain'])for(const sx of [-280,0,280])for(const dx of [-400,-80,-1,0,1,80,400])for(const dy of [-200,-20,0,20,300,700,1100]){
 if(kind==='rain'&&dy>=0)continue;
 const p=now.lanceFlightPlan(sx,0,sx+dx,dy,kind),end=now.lanceFlightPose(p,p.seconds);
 assert.equal(end.x,sx+dx);assert.equal(end.y,dy);assert.ok(end.arrived&&end.vy<0);
 assert.ok(!('c1x' in p)&&p.gravity>0);
 let prev=null;
 for(let i=0;i<=500;i++){
  const t=p.seconds*i/500,q=now.lanceFlightPose(p,t);
  assert.ok(Object.values(q).every(v=>typeof v==='boolean'||Number.isFinite(v)));
  assert.ok(Math.abs(q.x-(sx+dx*i/500))<1e-8,'lateral acceleration or side bow');
  assert.ok(q.x>=Math.min(sx,sx+dx)-1e-8&&q.x<=Math.max(sx,sx+dx)+1e-8);
  const tail=[q.x-Math.cos(q.angle)*320*q.lengthScale,q.y-Math.sin(q.angle)*320*q.lengthScale];
  if(prev){const dt=p.seconds/500,error=Math.abs((q.vy-prev.q.vy)/dt+p.gravity);maxAccelerationError=Math.max(maxAccelerationError,error);
   assert.ok(error<1e-6);maxShaftStep=Math.max(maxShaftStep,Math.hypot(tail[0]-prev.tail[0],tail[1]-prev.tail[1]));}
  if(dx===0)assert.ok(Math.abs(tail[0]-sx)<1e-8,'vertical throw turns sideways');
  prev={q,tail};samples++;
 }
 cases++;
}
const vertical=now.lanceFlightPlan(0,0,0,400,'great'),apex=vertical.vy/vertical.gravity;
const a=now.lanceFlightPose(vertical,apex-1e-7),b=now.lanceFlightPose(vertical,apex+1e-7);
assert.ok(a.lengthScale<.00001&&b.lengthScale<.00001);
assert.equal(now.lanceFlightPose(vertical,vertical.seconds).angle,-Math.PI/2);
assert.ok(Math.max(a.lengthScale,b.lengthScale)*320<.004,'full-length instantaneous apex flip');
const result={status:'PASS',baseline:'6fbe9cfc',previousStraightAheadLateralPixels:oldLateral,
 currentStraightAheadLateralPixels:0,cases,samples,maxAccelerationError,maxShaftStep,
 endpointExact:true,constantGravity:true,monotonicHorizontalMotion:true,continuousProjectedShaft:true,
 gameEngineBrowserBattleAudioOrWasmStarted:false};
fs.writeFileSync(path.join(__dirname,'trajectory-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
