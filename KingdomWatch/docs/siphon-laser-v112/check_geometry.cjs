// Only the pure laser geometry/config modules execute; no Cocos, monster or combat simulation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project=path.resolve(__dirname,'../..');
function pure(file){const m={exports:{}};const s=fs.readFileSync(path.join(project,file),'utf8');
 vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports},{filename:file});return m.exports;}
const {laserLength,laserTouches,bestLaserAngle,turnLaser,laserExposure}=pure('assets/scripts/battle/SiphonLaser.ts');
const {SIPHON_LASER,siphonUltCfg}=pure('assets/scripts/config/NewHeroConfig.ts');
const bounds={left:-355,right:355,top:560},body=(x,y,other={})=>({x,y,dead:false,isBoss:false,def:{radius:18},...other});
assert.equal(laserLength(0,-500,Math.PI/2,bounds),1060);
assert(Math.abs(laserLength(0,-500,Math.PI/4,bounds)-355*Math.SQRT2)<1e-8);
assert.equal(laserLength(0,-500,-Math.PI/2,bounds),0);
const mobs=[body(0,-100),body(0,130),body(0,440),body(240,0),body(250,250),body(-200,900),body(0,170,{dead:true})];
const angle=bestLaserAngle(0,-500,28,mobs,bounds);
assert(Math.abs(angle-Math.PI/2)<1e-8);
const length=laserLength(0,-500,angle,bounds);
assert.equal(mobs.slice(0,3).filter(m=>laserTouches(0,-500,angle,length,28,m.x,m.y,m.def.radius)).length,3);
assert.equal(laserTouches(0,-500,angle,length,28,200,120,18),false);
assert.equal(bestLaserAngle(0,-500,28,[body(0,900),body(0,-550),body(0,100,{dead:true})],bounds),null);
for(const dt of [1/240,1/60,1/30,.2]) assert(Math.abs(turnLaser(.5,2,dt)-.5)<=.45*dt+1e-8);
let contacts=0;
for(let i=0;i<1200;i++){
 const a=.12+(i%96)/95*(Math.PI-.24),tx=Math.sin(i*1.7)*430,ty=-620+(i%111)*12;
 const len=laserLength(100,-560,a,bounds),width=28+i%3*6,radius=9+i%20;
 const vx=Math.cos(a)*len,vy=Math.sin(a)*len,rx=tx-100,ry=ty+560;
 const t=Math.max(0,Math.min(1,(rx*vx+ry*vy)/(vx*vx+vy*vy)));
 const expected=(rx-vx*t)**2+(ry-vy*t)**2<=(width+radius)**2;
 assert.equal(laserTouches(100,-560,a,len,width,tx,ty,radius),expected);contacts++;
}
const timing=[];
for(const level of [1,10,20])for(const cadence of [[1/60],[1/30],[.011,.027,.043,.018]]){
 let age=0,bank=0,ticks=0,n=0;const cfg=siphonUltCfg(level),end=SIPHON_LASER.windup+cfg.duration+SIPHON_LASER.tail;
 while(age<end){const before=age;age+=cadence[n++%cadence.length];bank+=laserExposure(before,age,SIPHON_LASER.windup,cfg.duration);
  while(bank+1e-8>=SIPHON_LASER.tick){bank=Math.max(0,bank-SIPHON_LASER.tick);ticks++;assert(age>=SIPHON_LASER.windup);}}
 assert.equal(ticks,level<10?12:14);assert(Math.abs(ticks*SIPHON_LASER.tick-cfg.duration)<1e-8);
 assert.equal(laserExposure(end,end+1,SIPHON_LASER.windup,cfg.duration),0);
 timing.push({level,cadence,ticks,integratedDamageSeconds:ticks*SIPHON_LASER.tick});
}
const hero=fs.readFileSync(path.join(project,'assets/scripts/battle/NewHeroes.ts'),'utf8');
assert(!/healAmount|healPct|healFraction|harvest|\.healed\(/.test(hero));
assert(!/healFraction|ultimateHeal/.test(fs.readFileSync(path.join(project,'assets/scripts/config/NewHeroConfig.ts'),'utf8')));
const report={contactsChecked:contacts,groupLinePiercesThreeTargets:true,emptyFieldDoesNotCast:true,turnRateBounded:true,
 timing,noSiphonHealingCallsOrConfig:true,scope:'pure geometry and interval math only; game/monster/scene modules not run',gameStarted:false};
fs.writeFileSync(path.join(__dirname,'geometry-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
