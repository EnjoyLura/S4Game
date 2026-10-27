// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/scythe-v139/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function isolated(file,imports={}){const out=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied import '+n);return imports[n];},Math,Number,Map,Set};vm.runInNewContext(out.outputText,c,{filename:file});return c.exports;}
class G{
 constructor(){this.commands=[];this.path='';this.lineWidth=1;}
 clear(){this.commands=[];this.path='';} check(...v){assert.ok(v.every(Number.isFinite));}
 moveTo(x,y){this.check(x,y);this.path=`M${x},${y}`;} lineTo(x,y){this.check(x,y);this.path+=`L${x},${y}`;}
 quadraticCurveTo(a,b,x,y){this.check(a,b,x,y);this.path+=`Q${a},${b} ${x},${y}`;}
 ellipse(x,y,a,b){this.check(x,y,a,b);this.path=`M${x-a},${y}a${a},${b} 0 1,0 ${a*2},0a${a},${b} 0 1,0 ${-a*2},0`;}
 circle(x,y,r){this.ellipse(x,y,r,r);} close(){this.path+='Z';} fill(){this.add('fill',this.fillColor);} stroke(){this.add('stroke',this.strokeColor);}
 add(kind,c){assert.ok(c&&Number.isFinite(c.a)&&c.a>=0&&c.a<=1);this.commands.push(`<path d="${this.path}" ${kind}="${c.hex}" ${kind}-opacity="${c.a}" ${kind==='stroke'?`fill="none" stroke-width="${this.lineWidth}"`:''}/>`);}
}
const instances=[],drawings=[];
class Shader{
 constructor(p,n,capacity){this.capacity=capacity;this.quads=[];this.ready=true;instances.push(this);}
 begin(){this.quads=[];} draw(...q){assert.ok(q.every(Number.isFinite));if(!this.ready||this.quads.length>=this.capacity)return false;this.quads.push(q);return true;} end(){}
}
const ground={name:'GroundFxLayer',isValid:true},parent={getChildByName:n=>n==='GroundFxLayer'?ground:null};
const N=(name,p)=>({name,parent:p,isValid:true,addComponent:()=>{const g=new G();drawings.push(g);return g;},setSiblingIndex(){},destroy(){this.isValid=false;}});
const imports={'cc':{Graphics:G},'../ui/UIKit':{CA:(hex,a)=>({hex,a}),N},'./HeroFxShader':{HeroFxShader:Shader}};



const config=isolated('assets/scripts/config/ScytheConfig.ts');
const plan=isolated('assets/scripts/battle/ScythePlans.ts',{'../config/ScytheConfig':config});
const geometry=isolated('assets/scripts/battle/WindNinjaGeometry.ts');
const fx=isolated('assets/scripts/battle/ScytheVFX.ts',imports),T=config.SCYTHE_TIMING;
const wave=plan.scytheWavePlan(-478,850,750),duration=config.scytheSkillCfg(1).duration;
assert.equal(wave.releases.length,3);assert.ok(wave.halfLength>375);
for(let i=1;i<3;i++)assert.ok(Math.abs(wave.releases[i]-wave.releases[i-1]-T.gap)<1e-8);
let pulses=0;
for(let i=0;i<=360;i++){
 const age=i/60,p=plan.scythePose(age,duration,-100,0,60,300),due=plan.scythePulseCount(age,duration);
 assert.ok([p.x,p.y,p.opacity,p.end].every(Number.isFinite));assert.ok(p.opacity>=0&&p.opacity<=1&&due>=pulses&&due<=10);pulses=due;
 if(p.active)assert.ok(Math.abs(p.x-60)<1e-7&&Math.abs(p.y-300)<1e-7);
}assert.equal(pulses,10);assert.equal(plan.scythePulseCount(100,duration),10);
assert.equal(plan.scythePulseCount(T.skillWindup+T.throw-.001,duration),0);
assert.equal(plan.scythePulseCount(T.skillWindup+T.throw,duration),1);
// Full-width continuous sweep hits both lateral edges, even if the leading edge crosses the entire enemy in one step.
let sweepChecks=0;
for(const half of [43,wave.halfLength])for(const step of [20,80,500])for(const side of [-1,0,1]){
 const entry=geometry.sweptBladeEntry(step*.5,side*(half-2),step,half,12);assert.ok(Number.isFinite(entry)&&entry>=0&&entry<=1);sweepChecks++;
 assert.ok(!Number.isFinite(geometry.sweptBladeEntry(step*.5,half+13,step,half,12)));
}
// Curve-specific contact: visible tips lag behind center by .3*half, not an invisible straight bar.
for(const half of [43,411])for(const step of [20,80,500])for(const side of [-.95,0,.95]){
 const lateral=side*half,edge=-.3*lateral*lateral/half;
 const entry=plan.scytheBladeEntry(edge+step*.5,lateral,step,half,4);
 assert.ok(Number.isFinite(entry)&&entry>=0&&entry<=1);sweepChecks++;
 assert.equal(plan.scytheBladeEntry(edge,lateral,0,half,4),0);
 assert.equal(plan.scytheBladeEntry(edge+step*.5,half+6,step,half,4),Infinity);
}
for(const half of [43,411]){
 const step=half*2,center=plan.scytheBladeEntry(half,0,step,half,1),tip=plan.scytheBladeEntry(half,half*.95,step,half,1);
 assert.ok(tip>center+.1,'Curved tip must not hit early');
}
// Independent dense curve sampling: prevents a sign/axis mistake from passing only nominal cases.
let sampledCases=0;
for(const side of [-1.03,-.7,-.2,.3,.8,1.02])for(const front of [-.35,0,.2,.7]){
 const half=411,travel=500,radius=14,forward=front*half,lateral=side*half;
 const entry=plan.scytheBladeEntry(forward,lateral,travel,half,radius);
 let sampled=Infinity;
 for(let j=0;j<=200;j++){const time=j/200;let closest=Infinity;
  for(let k=0;k<=400;k++){const y=(k/200-1)*half,x=-.3*y*y/half+travel*time;closest=Math.min(closest,(x-forward)**2+(y-lateral)**2);}
  if(closest<=radius*radius){sampled=time;break;}
 }
 assert.equal(Number.isFinite(entry),Number.isFinite(sampled));
 if(Number.isFinite(entry))assert.ok(Math.abs(entry-sampled)<.012);sampledCases++;
}
for(let lv=1;lv<=20;lv++){
 const sk=config.scytheSkillCfg(lv),ult=config.scytheUltCfg(lv);assert.ok(sk.mul>0&&sk.radius>0&&ult.mul>0&&ult.waves===3);
 if(lv>1)assert.ok(ult.mul>=config.scytheUltCfg(lv-1).mul);
}
const source=read('assets/scripts/battle/ScytheHero.ts');
for(const needle of ['scythePulseCount(s.age,s.duration)','this.lastDmg?.add','lineHalfLength:plan.halfLength','pierce:9999',
 'dirX:0,dirY:1','this.pending.length>56','this.spins.length>=3','this.pending[j].delay+=late','this.ultimateT=Math.max(this.ultimateT,plan.ttl+.25)'])assert.ok(source.includes(needle),needle);
assert.ok(!/setTimeout|Date\.now|performance\.now/.test(source));
for(const rel of ['core/GameData.ts','core/SaveData.ts','config/Cards.ts','config/Weapons.ts','ui/TrainingLobby.ts','ui/Panels.ts',
 'ui/HeroComic.ts','ui/HUD.ts','ui/ComicUI.ts','ui/BattleEntryWarmup.ts','ui/GrowthFeedback.ts','ui/PickArt.ts','ui/pages/UpgradePage.ts',
 'core/Sfx.ts','battle/BattleDirector.ts','battle/UltimateTiming.ts','config/Mobs.ts'])assert.ok(read('assets/scripts/'+rel).includes('scythe'),rel);
for(const rel of ['battle/MagicBowHero.ts','battle/MagicBowVFX.ts','battle/ThunderLanceHero.ts','battle/ThunderLanceVFX.ts',
 'battle/SpaceSwordHeroes.ts','battle/WindNinjaHeroes.ts','battle/Monster.ts','battle/WindNinjaGeometry.ts','config/MagicBowConfig.ts']){
 const old=cp.execFileSync('git',['show','034cdc8d:KingdomWatch/assets/scripts/'+rel],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');
 assert.equal(read('assets/scripts/'+rel).replace(/\r\n/g,'\n'),old);
}
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[];
 for(const[kind,count]of [['normal',32],['skill',128],['ultimate',84]]){
  const f=new fx.ScytheVFX(parent),flight=new Shader(null,'flight',4);let hit=false;const launched=new Set();
  for(let i=0;i<count;i++){
   const age=i/24;f.tick(i?1/24:0);flight.begin();
   if(kind==='normal'){
    if(age<.6)fx.drawScytheBlade(flight,new G(),-120+age*200,age*550,Math.atan2(550,200),43,age,.3);
    if(age>=.6&&!hit){f.hit(0,330,27);hit=true;}
   }else if(kind==='ultimate'){
    if(i===0)f.charge(-120,0,88,T.windup);
    for(let k=0;k<3;k++){
     const travel=age-wave.releases[k];if(travel<0||travel>wave.ttl)continue;
     if(!launched.has(k)){f.swing(-120,0,145,.42);launched.add(k);}
     fx.drawScytheBlade(flight,new G(),0,-40+travel*T.waveSpeed,Math.PI/2,wave.halfLength,travel,.3+k*.2);
    }
   }
   f.begin();
   if(kind==='skill'){const p=plan.scythePose(age,duration,-120,0,0,330);f.spin(p.x,p.y,155,age,.3,p.opacity);}
   f.end();const name=kind+'-'+i+'.png';
   frames.push({kind,age,ground:[],air:[...f.shader.quads,...flight.quads],groundGraphics:await layer(null,'ground-'+name),graphics:await layer(f.ink,name),frontGraphics:await layer(null,'front-'+name)});
  }f.destroy();
 }
 const fallback=new Shader(null,'fallback',1);fallback.ready=false;const ink=new G();fx.drawScytheBlade(fallback,ink,0,0,Math.PI/2,411,.3,.2);assert.ok(ink.commands.length>0);
 const bounded=new fx.ScytheVFX(parent);for(let k=0;k<200;k++)bounded.hit(0,0,30);assert.equal(bounded.accents.length,40);
 bounded.shader.ready=false;bounded.begin();bounded.spin(0,0,155,.6,.3,1);bounded.end();assert.ok(bounded.ink.commands.length>0);
 bounded.tick(2);assert.equal(bounded.accents.length,0);bounded.destroy();
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 const report={status:'PASS',wave,pulses,poseSamples:361,sweepChecks,sampledCases,trainingLevels:20,cosmeticFrames:frames.length,
  buffersBounded:true,fallbackGeometry:true,oldHeroImplementationsPreserved:true,gameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
