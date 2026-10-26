// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/space-chains-v135/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
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

const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports);
const chain=isolated('assets/scripts/battle/SpaceBindingVFX.ts',imports),eye=isolated('assets/scripts/battle/WindGroundVFX.ts',imports);
const fx=isolated('assets/scripts/battle/SpaceSwordVFX.ts',{...imports,'./SwordAbilityVFX':art,'./SpaceBindingVFX':chain});
const transit=isolated('assets/scripts/battle/SpacePresentation.ts');
const now=f=>read(f).replace(/\r\n/g,'\n');
const before=f=>cp.execFileSync('git',['show','a1939236:KingdomWatch/'+f],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');
const same=['assets/scripts/config/SpaceSwordConfig.ts','assets/scripts/battle/SpaceSwordPlans.ts','assets/scripts/battle/SpacePresentation.ts','assets/scripts/battle/WindNinjaHeroes.ts','assets/scripts/battle/WindNinjaVFX.ts','assets/scripts/battle/Projectile.ts','assets/resources/fx/wind_tornado_video_v129.frames.json'];
for(const f of same)assert.equal(now(f),before(f),f+' gameplay changed');
assert.equal(now('assets/scripts/battle/Monster.ts').replaceAll('spaceBindRadius','spaceOrbRadius'),before('assets/scripts/battle/Monster.ts'));
const config=isolated('assets/scripts/config/WindNinjaConfig.ts');
for(let lv=1;lv<=20;lv++){const r=config.ninjaUltCfg(lv).radius;assert.ok(Math.abs(r-145*1.25*(lv>=5?1.15:1))<1e-9);}
assert.equal(now('assets/scripts/config/WindNinjaConfig.ts').replace('ultRadius: 181.25','ultRadius: 145'),before('assets/scripts/config/WindNinjaConfig.ts'));
const heroes=now('assets/scripts/battle/SpaceSwordHeroes.ts');
assert.equal(heroes.split('export class SwordHero')[1].replace(/\n\s*if\(ult&&p.final\)this.effects\(\).add\('finalWave',x,y,radius,.68\);/,''),before('assets/scripts/battle/SpaceSwordHeroes.ts').split('export class SwordHero')[1]);
assert.equal(heroes.split('export class SpaceHero')[1].split('protected updateQueues')[1]?.split('renderEffects():void')[0],before('assets/scripts/battle/SpaceSwordHeroes.ts').split('export class SpaceHero')[1].split('protected updateQueues')[1]?.split('renderEffects():void')[0]);
assert.ok(heroes.includes('chains:valid&&c.bound'));
const source=now('assets/resources/fx/space-sword-burst.effect'),old=before('assets/resources/fx/space-sword-burst.effect');
assert.equal(source.split('  vec4 column(')[1].split('  vec4 crystal')[0],old.split('  vec4 column(')[1].split('  vec4 crystal')[0]);
assert.ok(!source.includes('vec4 prison('));assert.ok(source.includes('transitSeal')&&source.includes('transitFlame'));
const eyeManifest=JSON.parse(read('assets/resources/fx/wind_eye_video_v129.frames.json')),priorEye=JSON.parse(before('assets/resources/fx/wind_eye_video_v129.frames.json'));
assert.equal(eyeManifest.displayHeightScale,.65);assert.equal(eyeManifest.displayOffsetY,-4);
assert.deepEqual({...eyeManifest,displayHeightScale:priorEye.displayHeightScale,displayOffsetY:priorEye.displayOffsetY},priorEye);
async function layer(g,name){const body=g?.commands.join('')||'';await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${body}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){
 fs.mkdirSync(REC,{recursive:true});const frames=[];let maxLinks=0,maxQuads=0;
 for(const [kind,count] of [['space-ult',100],['space-transit',42],['final-sword',40],['wind-eye',60]])for(let i=0;i<count;i++){
  const age=i/24,f=new fx.SpaceSwordVFX(parent);
  if(kind.startsWith('space'))f.warmVolume();else if(kind==='final-sword')f.warmSword();
  if(kind==='space-ult')f.setPrison([{x:-90,y:160,bodyX:-90,bodyY:207,groundY:152,chains:true,bindRadius:83,radius:105},{x:110,y:310,bodyX:110,bodyY:357,groundY:302,chains:true,bindRadius:83,radius:105}],age,.95,3);
  if(kind==='space-transit'){
   if(age<.85){f.add('portal',-90,152,66.4,.85);f.accents.at(-1).age=age;}
   if(age<1.5){f.add('arrival',-90,452,66.4,1.5);f.accents.at(-1).age=age;}
  }
  if(kind==='final-sword'){
   if(age<1.4){f.add('giant',0,220,320,.9,-Math.PI/2);f.accents.at(-1).age=age;}
   if(age<.68){f.add('finalWave',0,220,320,.68);f.accents.at(-1).age=age;}
  }
  f.render();
  const name=kind+'-'+i+'.png',contact=new G();
  if(kind==='wind-eye')eye.drawWindEyeContact(contact,0,220,150,age,Math.min(1,age*6));
  const graphics=await layer(f.g,name),groundGraphics=await layer(kind==='wind-eye'?contact:f.sealInk||f.groundInk,'ground-'+name),frontGraphics=await layer(f.chainInk,'front-'+name);
  maxLinks=Math.max(maxLinks,f.chainInk?.commands.length||0);maxQuads=Math.max(maxQuads,(f.volume?.quads.length||0)+(f.seal?.quads.length||0));
  frames.push({kind,age,graphics,groundGraphics,frontGraphics,ground:f.seal?.quads||f.swordGround?.quads||[],air:f.volume?.quads||f.swordAir?.quads||[],transitOpacity:transit.spaceTransitOpacity(age),moved:age>=transit.SPACE_TRANSIT.vanish});
  f.destroy();if(f.sealNode)assert.equal(f.sealNode.isValid,false);if(f.groundNode)assert.equal(f.groundNode.isValid,false);
 }
 const fail=new fx.SpaceSwordVFX(parent);fail.warmVolume();fail.volume.ready=false;fail.seal.ready=false;
 fail.add('portal',0,0,60,.85);fail.tick(.2);fail.render();assert.ok(fail.sealInk.commands.length>0);fail.tick(2);fail.render();assert.equal(fail.accents.length,0);fail.destroy();
 // Full eight-captive upper bound; no actual monsters or battle loop are instantiated.
 const cap=new fx.SpaceSwordVFX(parent);cap.warmVolume();cap.setPrison(Array.from({length:8},(_,i)=>({x:i*50,y:0,bodyX:i*50,bodyY:50,groundY:0,chains:true,bindRadius:90,radius:105})),1.5,.95,3);cap.render();assert.equal(cap.volume.quads.length,8);assert.ok(cap.chainInk.commands.length<2500);cap.destroy();
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 const report={baseline:'a1939236',status:'PASS',cosmeticFrames:frames.length,maxChainDrawCommands:maxLinks,maxSpaceQuads:maxQuads,groundCapacity:16,airCapacity:32,ninjaRadiusCases:20,ninjaRadiusIncrease:.25,ninjaAreaIncrease:.5625,eyeHeightScale:.65,groundNodeCleanup:true,lateLoadFallback:true,actualGameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
