// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/magic-bow-v138/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
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



const config=isolated('assets/scripts/config/MagicBowConfig.ts');
const plan=isolated('assets/scripts/battle/MagicBowPlans.ts',{'../config/MagicBowConfig':config});
const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports);
const fx=isolated('assets/scripts/battle/MagicBowVFX.ts',{...imports,'./SwordAbilityVFX':art});
const timeline=plan.magicBowTimeline(),T=config.MAGIC_BOW_TIMING;
assert.ok(Math.abs(timeline.blast-timeline.impact-.3)<1e-8);
assert.ok(timeline.launch<timeline.sky&&timeline.sky<timeline.fall&&timeline.fall<timeline.impact&&timeline.impact<timeline.blast);
for(const[stage,start,end]of [['prepare',0,timeline.launch],['ascent',timeline.launch,timeline.sky],['sky',timeline.sky,timeline.fall],['descent',timeline.fall,timeline.impact],['impact',timeline.impact,timeline.blast],['blast',timeline.blast,timeline.end]]){
 assert.equal(plan.magicBowPhase(start+1e-6),stage);assert.equal(plan.magicBowPhase(end-1e-6),stage);
}
for(let lv=1;lv<=20;lv++){
 const sk=config.magicBowSkillCfg(lv),ult=config.magicBowUltCfg(lv);assert.ok(sk.mul>0&&ult.mul>0&&ult.blastMul>ult.mul&&ult.radius>ult.impactRadius);
 if(lv>1){const before=config.magicBowUltCfg(lv-1);assert.ok(ult.mul>=before.mul&&ult.blastMul>=before.blastMul);}
}
const source=read('assets/scripts/battle/MagicBowHero.ts');
for(const needle of ['if(!this.node.isValid||up)return','this.damage(mgr,c,skill,!skill)',"kind:'blast',delay:T.detonation",
 'this.damage(mgr,c,true,true)','this.ultimatePending=false','this.ultimateT=Math.max(this.ultimateT,.6)',
 "p.kind!=='blast'&&!projs.hasCapacity",'m.groundY-c.y','this.lastDmg?.add','this.pending.length>=60'])assert.ok(source.includes(needle),needle);
assert.ok(!/setTimeout|Date\.now|performance\.now/.test(source));
for(const rel of ['core/GameData.ts','core/SaveData.ts','config/Cards.ts','config/Weapons.ts','ui/TrainingLobby.ts',
 'ui/Panels.ts','ui/HeroComic.ts','ui/HUD.ts','ui/ComicUI.ts','ui/BattleEntryWarmup.ts','ui/GrowthFeedback.ts',
 'ui/PickArt.ts','ui/pages/UpgradePage.ts','core/Sfx.ts','battle/BattleDirector.ts','battle/UltimateTiming.ts','config/Mobs.ts'])assert.ok(read('assets/scripts/'+rel).includes('arcane'),rel);
// Preserve every previous hero's own implementation and VFX files byte-for-byte.
for(const rel of ['battle/ThunderLanceHero.ts','battle/ThunderLanceVFX.ts','battle/SpaceSwordHeroes.ts','battle/WindNinjaHeroes.ts',
 'battle/Monster.ts','config/ThunderLanceConfig.ts','config/SpaceSwordConfig.ts']){
 const old=cp.execFileSync('git',['show','0689ef65:KingdomWatch/assets/scripts/'+rel],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(read('assets/scripts/'+rel).replace(/\r\n/g,'\n'),old);
}
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[];
 for(const[kind,count]of [['normal',40],['skill',44],['ultimate',80]]){
  const f=new fx.MagicBowVFX(parent),flight=new Shader(null,'flight',4);let contacted=false,exploded=false,launched=false,marked=false;
  for(let i=0;i<count;i++){
   const age=i/24;f.tick(i?1/24:0);const x=0,y=300,launchX=-180,launchY=-30,sky=940;
   flight.begin();
   if(kind==='ultimate'){
    if(!launched){f.charge(launchX,launchY,T.windup,true);launched=true;}
    if(age>=timeline.sky&&!marked){f.mark(x,y,275,T.skyPause+T.descent);marked=true;}
    if(age>=timeline.impact&&!contacted){f.impact(x,y,175,Math.atan2(y-sky,-65),T.detonation);contacted=true;}
    if(age>=timeline.blast&&!exploded){f.explode(x,y,275,true);exploded=true;}
    if(age>=timeline.launch&&age<timeline.sky){const t=(age-timeline.launch)/T.ascent;fx.drawMagicArrow(flight,new G(),launchX,launchY+(sky-launchY)*t,Math.PI/2,42,age-timeline.launch,.3);}
    if(age>=timeline.fall&&age<timeline.impact){const t=(age-timeline.fall)/T.descent;fx.drawMagicArrow(flight,new G(),x+65*(1-t),sky+(y-sky)*t,Math.atan2(y-sky,-65),42,age-timeline.fall,.3);}
   }else{
    const windup=kind==='skill'?.18:0,seconds=.6,travel=age-windup;
    if(kind==='skill'&&!launched){f.charge(launchX,launchY,windup,false);launched=true;}
    if(travel>=0&&travel<seconds){const t=travel/seconds;fx.drawMagicArrow(flight,new G(),launchX+(x-launchX)*t,launchY+(y-launchY)*t,Math.atan2(y-launchY,x-launchX),kind==='skill'?18:10,travel,.3);}
    if(travel>=seconds&&!contacted){if(kind==='skill')f.explode(x,y,150,false);else f.hit(x,y+25,30);contacted=true;}
   }
   f.render();const name=kind+'-'+i+'.png';frames.push({kind,age,phase:kind==='ultimate'?plan.magicBowPhase(age):null,
    ground:f.groundShader.quads,air:[...f.airShader.quads,...flight.quads],groundGraphics:await layer(f.dirt,'ground-'+name),graphics:await layer(f.ink,name),frontGraphics:await layer(f.front,'front-'+name)});
  }f.destroy();
 }
 let anchors=0;for(const angle of [-1.8,-Math.PI/2,-1.3])for(const age of [0,.03,.09,.25]){
  const shader=new Shader(null,'s',1);fx.drawMagicArrow(shader,new G(),20,30,angle,42,age,.3,1,true);const q=shader.quads[0],length=336,buried=length*q[10];
  assert.ok(Math.abs(q[0]+Math.cos(angle)*(length*.5-buried)-20)<1e-6);assert.ok(Math.abs(q[1]+Math.sin(angle)*(length*.5-buried)-30)<1e-6);anchors++;
 }
 const fallback=new Shader(null,'s',1);fallback.ready=false;const ink=new G();fx.drawMagicArrow(fallback,ink,0,100,-1.5,42,.4,.1);assert.ok(ink.commands.length>0);
 const bounded=new fx.MagicBowVFX(parent);for(let i=0;i<200;i++)bounded.hit(0,0,30);assert.equal(bounded.accents.length,32);bounded.tick(2);assert.equal(bounded.accents.length,0);bounded.destroy();
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 const report={status:'PASS',timeline,twoDamageStagesDistinct:true,trainingLevels:20,tipAnchors:anchors,cosmeticFrames:frames.length,
  buffersBounded:true,fallbackGeometry:true,oldHeroImplementationsPreserved:true,gameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});

