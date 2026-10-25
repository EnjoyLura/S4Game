// Pure viewport/ray/interval math only. No engine, hero, monster or game is executed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project=path.resolve(__dirname,'../..');
function pure(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(project,file),'utf8'),
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports});return m.exports;}
const {laserLength,laserTouches,bestLaserAngle,laserExposure}=pure('assets/scripts/battle/SiphonLaser.ts');
const {SIPHON_LASER,siphonUltCfg}=pure('assets/scripts/config/NewHeroConfig.ts');
let viewports=0;
for(const half of [580,667,820,1000])for(const sx of [-293.4,-126.4,0,126.4,293.4])for(const angle of [.12,.35,.8,1.3,Math.PI/2,1.8,2.4,2.85,Math.PI-.12]){
 const sy=-half+173,bounds={left:-375,right:375,top:half};
 for(const width of [28,46,76]){
  const margin=Math.max(SIPHON_LASER.visualOverscan,width*2+24),len=laserLength(sx,sy,angle,bounds),art=laserLength(sx,sy,angle,bounds,margin);
  const x=sx+Math.cos(angle)*art,y=sy+Math.sin(angle)*art;
  assert(art>len && (x<=bounds.left-margin+1e-6 || x>=bounds.right+margin-1e-6 || y>=bounds.top+margin-1e-6));
  // Fade and the full widened beam tip clear the visible edge, even for slanted side exits.
  assert(margin>width+24);
  assert(laserTouches(sx,sy,angle,len,width,sx+Math.cos(angle)*len*.92,sy+Math.sin(angle)*len*.92,18));
  viewports++;
 }
}
const bounds={left:-375,right:375,top:667},mob=(x,y)=>({x,y,dead:false,isBoss:false,def:{radius:18}});
assert.equal(bestLaserAngle(0,-494,28,[mob(0,700)],bounds),null);
assert.equal(laserTouches(0,-494,Math.PI/2,laserLength(0,-494,Math.PI/2,bounds),28,0,800,18),false);
assert.equal(laserLength(0,-494,Math.PI/2,bounds),1161);
const timing=[];
for(const lv of [1,10,20])for(const cadence of [[1/60],[1/30],[.011,.027,.043,.018]]){
 const cfg=siphonUltCfg(lv),end=SIPHON_LASER.windup+cfg.duration+SIPHON_LASER.tail;
 let age=0,bank=0,n=0,ticks=0;
 while(age<end){const before=age;age+=cadence[n++%cadence.length];bank+=laserExposure(before,age,SIPHON_LASER.windup,cfg.duration);
  while(bank+1e-8>=SIPHON_LASER.tick){bank=Math.max(0,bank-SIPHON_LASER.tick);ticks++;}}
 assert.equal(ticks,lv<10?20:22);assert(Math.abs(ticks*SIPHON_LASER.tick-cfg.duration)<1e-8);
 assert.equal(laserExposure(0,.6,.6,cfg.duration),0);assert.equal(laserExposure(end,end+1,.6,cfg.duration),0);
 timing.push({level:lv,cadence,ticks,damageSeconds:cfg.duration});
}
const report={viewportWidthAngleCases:viewports,laserClearsTopAndSideEdges:true,offscreenTargetExcluded:true,timing,
 scope:'pure viewport and interval math only',gameOrBrowserStarted:false};
fs.writeFileSync(path.join(__dirname,'geometry-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({viewportCases:viewports,baseDamageSeconds:3,baseTicks:20,gameStarted:false}));
