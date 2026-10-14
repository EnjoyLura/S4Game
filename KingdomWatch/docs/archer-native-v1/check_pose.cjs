const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ts=require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'../..'),mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'assets/scripts/battle/ArcherRigPose.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:mod.exports,Math});
const {ArcherRigPose}=mod.exports,frames=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/ux/archer_native_v1/parts.frames.json'))).frames;
let samples=0,maxForeError=0,maxReleaseJump=0;
for(const angle of [-1.08,-.82,0,.82,1.08]){
 const m=new ArcherRigPose(frames),dx=Math.sin(angle),dy=Math.cos(angle);for(let i=0;i<120;i++)m.tick(1/120,0,dx,dy);
 for(let i=0;i<600;i++){
  const prepare=(i%120)/120,p=m.tick(1/120,prepare,dx,dy);
  if(i%120===119){const q=m.release(dx,dy);maxReleaseJump=Math.max(maxReleaseJump,Math.hypot(q.rightGrip.x-p.rightGrip.x,q.rightGrip.y-p.rightGrip.y));assert(!q.arrowVisible);}
  for(const s of p.parts){for(const key of ['x','y','width','height','ax','ay','angle'])assert(Number.isFinite(s[key]),s.name+':'+key);assert(s.width>0&&s.height>0);}
  const feet=p.parts.find(s=>s.name.endsWith('_legs'));assert.equal(feet.x,0);assert.equal(feet.y,0);assert.equal(feet.angle,0);assert.equal(feet.height,58);
  assert.equal(p.arrowTip.x,0);assert.equal(p.arrowTip.y,136);
  for(const name of ['left_forearm','right_forearm']){const s=p.parts.find(s=>s.name===name);maxForeError=Math.max(maxForeError,Math.abs(s.height*.78-23));}
  assert.equal(p.parts.filter(s=>s.name==='bow').length,1);assert.equal(p.parts.filter(s=>s.name==='left_hand').length,1);samples++;
 }
 assert.equal(m.facing,angle<-.4?'left':angle>.4?'right':'up');
}
assert(maxForeError<.15,'arm length error '+maxForeError);assert(maxReleaseJump<.001,'release jump '+maxReleaseJump);
const m=new ArcherRigPose(frames);for(let i=0;i<90;i++)m.tick(1/60,0,Math.sin(.42),Math.cos(.42));assert.equal(m.facing,'right');
for(let i=0;i<120;i++)m.tick(1/60,0,Math.sin(.35+(i%2?-.02:.02)),Math.cos(.35+(i%2?-.02:.02)));assert.equal(m.facing,'right');
for(let i=0;i<240;i++)m.tick(1/60,0);assert.equal(m.facing,'up');
const rapid=new ArcherRigPose(frames);rapid.tick(0,1,0,1);rapid.release(0,1);for(let i=0;i<10;i++)rapid.tick(1/120,.8,0,1);assert(rapid.sample().arrowVisible,'queued shot re-nocks before 0.12s');
const before=rapid.sample();rapid.release(0,1);const after=rapid.sample();assert(Math.hypot(before.rightGrip.x-after.rightGrip.x,before.rightGrip.y-after.rightGrip.y)<.001);
const report={ok:true,samples,maxForeError,maxReleaseJump,checks:['fixed feet and firing origin','bounded two-joint arm lengths','continuous release including rapid re-trigger','three independently drawn directions','turn hysteresis and no-target recovery','rapid re-nock before queued shot']};fs.writeFileSync(path.join(__dirname,'pose-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
