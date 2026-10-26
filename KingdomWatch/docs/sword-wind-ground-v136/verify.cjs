// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/sword-wind-ground-v136/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
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


const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports),chain=isolated('assets/scripts/battle/SpaceBindingVFX.ts',imports),eye=isolated('assets/scripts/battle/WindGroundVFX.ts',imports);
const transit=isolated('assets/scripts/battle/SpacePresentation.ts'),motion=isolated('assets/scripts/battle/WindFieldMotion.ts');
const fx=isolated('assets/scripts/battle/SpaceSwordVFX.ts',{...imports,'./SwordAbilityVFX':art,'./SpaceBindingVFX':chain,'./SpacePresentation':transit});
const now=f=>read(f).replace(/\r\n/g,'\n'),before=f=>cp.execFileSync('git',['show','24cc600:KingdomWatch/'+f],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');
for(const f of ['assets/scripts/config/SpaceSwordConfig.ts','assets/scripts/config/WindNinjaConfig.ts','assets/scripts/battle/SpaceSwordPlans.ts','assets/scripts/battle/Projectile.ts','assets/resources/fx/wind_tornado_video_v129.frames.json'])assert.equal(now(f),before(f));
function methods(text,className){const tree=ts.createSourceFile('a.ts',text,ts.ScriptTarget.Latest,true);return new Map(tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text===className).members.filter(ts.isMethodDeclaration).map(m=>[m.name.getText(tree),m.getText(tree)]));}
for(const[file,cls,names]of [
 ['assets/scripts/battle/Monster.ts','Monster',['takeDamage','strike','pullToward','teleportUp','clearSpaceTransit','tickSpaceTransit','die']],
 ['assets/scripts/battle/WindNinjaHeroes.ts','WindNinjaHeroBase',['damageArea']],
 ['assets/scripts/battle/SpaceSwordHeroes.ts','SpaceHero',['castUlt','updateQueues']],
 ['assets/scripts/battle/SpaceSwordHeroes.ts','SwordHero',['release','castUlt']]]){
 const current=methods(now(file),cls),old=methods(before(file),cls);for(const n of names){assert.ok(current.has(n),n);assert.equal(current.get(n),old.get(n),n+' damage/timing changed');}
}
const st=transit.SPACE_TRANSIT;assert.ok(Math.abs(st.hiddenUntil-st.portalEnd-1.5)<1e-9);
for(const t of [.35,.84,.85,1.2,2.0,2.349,2.35])assert.equal(transit.spaceTransitOpacity(t),0);
assert.ok(Math.abs(transit.spaceTransitOpacity(2.60)-.5)<1e-9);assert.equal(transit.spaceTransitOpacity(st.end),1);
const monster=now('assets/scripts/battle/Monster.ts');assert.ok(monster.includes('this.knockbackT, transitLeft'));
assert.ok(monster.includes('this.isBoss||this.transitAge>=0||'));assert.ok(monster.includes('if(m.spaceTransitHidden)continue'));
const bodies=[{x:-100,hitY:190},{x:-110,hitY:210},{x:100,hitY:190},{x:110,hitY:210}];
assert.equal(motion.stableWindTarget(bodies,{x:0,y:0},{x:-105,y:200},{x:105,y:200},70).x,-105);
assert.equal(motion.stableWindTarget(bodies.slice(2),{x:0,y:0},{x:-105,y:200},{x:105,y:200},70).x,105);
let checks=0,maxSpeed=0,maxAcceleration=0;
for(const dt of [1/120,1/60,1/30,.05,.25,.4]){
 const p={x:0,y:0},v={x:0,y:0};for(let i=0;i<240;i++){
  const goal={x:Math.floor(i*dt/.25)%2?140:-140,y:200+Math.sin(i*.37)*160},prev={...p},old={...v};motion.moveWindField(p,v,goal,82,dt);
  assert.ok(Number.isFinite(p.x+p.y+v.x+v.y));assert.ok(p.y>=prev.y);assert.ok(Math.hypot(v.x,v.y)<=82+1e-7);assert.ok(Math.hypot(p.x-prev.x,p.y-prev.y)<=82*dt+1e-6);
  maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y));maxAcceleration=Math.max(maxAcceleration,Math.hypot(v.x-old.x,v.y-old.y)/dt);checks++;
 }
}
const paths=[];for(const smooth of [false,true]){let p={x:0,y:0},v={x:0,y:0};const route=[];for(let i=0;i<120;i++){
 const age=i/30,target={x:Math.floor(age/.25)%2?95:-95,y:350};
 if(smooth)motion.moveWindField(p,v,target,82,1/30);else {const dx=target.x-p.x,dy=Math.max(0,target.y-p.y),d=Math.hypot(dx,dy),s=Math.min(d,82/30);p.x+=dx/d*s;p.y+=dy/d*s;}
 route.push({...p,age});}paths.push(route);}
let tipCases=0;
for(const giant of [false,true])for(const size of giant?[48,64]:[9,23])for(const angle of [-2.2,-Math.PI/2,-.9])for(const age of [0,.04,.08,.12,.6]){
 const length=size*(giant?5.6:7.8),sink=art.swordEmbedDepth(size,age,giant),shader=new Shader(null,'s',1),ux=Math.cos(angle),uy=Math.sin(angle);
 art.drawSwordFlight(shader,20+ux*sink,80+uy*sink,angle,size,age,.37,giant,1,true);const q=shader.quads[0];
 assert.ok(sink>=0&&sink<=length*.085+1e-8);assert.ok(Math.abs(q[0]+ux*(length*.65-sink)-20)<1e-6);assert.ok(Math.abs(q[1]+uy*(length*.65-sink)-80)<1e-6);tipCases++;
}
const em=JSON.parse(read('assets/resources/fx/wind_eye_video_v129.frames.json')),oldEye=JSON.parse(before('assets/resources/fx/wind_eye_video_v129.frames.json'));assert.equal(em.flipY,true);const copy={...em};delete copy.flipY;assert.deepEqual(copy,oldEye);
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[];
 for(const[kind,count]of [['space-transit',84],['final-sword',40],['skill-swords',40],['wind-eye',60]])for(let i=0;i<count;i++){
  const age=i/24,f=new fx.SpaceSwordVFX(parent);if(kind==='space-transit')f.warmVolume();else if(kind.includes('sword'))f.warmSword();
  if(kind==='space-transit'){
   if(age<st.portalEnd){f.add('portal',-90,152,66.4,st.portalEnd);f.accents.at(-1).age=age;}
   if(age<st.arrivalEnd){f.add('arrival',-90,452,66.4,st.arrivalEnd);f.accents.at(-1).age=age;}
  }
  if(kind==='final-sword'&&age<1.4){f.add('giant',0,220,320,.9,-Math.PI/2);f.accents.at(-1).age=age;if(age<.68){f.add('finalWave',0,220,320,.68);f.accents.at(-1).age=age;}}
  if(kind==='skill-swords')for(const [x,y,r,a]of [[-120,180,60,-1.8],[100,350,60,-1.45],[0,240,155,-1.68]])if(age<art.swordImpactLife(false,r)){f.add('cut',x,y,r,.6,a);f.accents.at(-1).age=age;}
  f.render();if(kind==='space-transit'&&age>=st.portalEnd&&age<st.hiddenUntil){assert.equal(f.seal.quads.length,0);assert.equal(f.volume.quads.length,0);}
  const contact=new G();if(kind==='wind-eye')eye.drawWindEyeContact(contact,0,220,150,age,Math.min(1,age*6));
  const name=kind+'-'+i+'.png';frames.push({kind,age,graphics:await layer(f.g,name),groundGraphics:await layer(kind==='wind-eye'?contact:f.sealInk||f.groundInk,'ground-'+name),frontGraphics:await layer(f.soilFront||f.chainInk,'front-'+name),ground:f.seal?.quads||f.swordGround?.quads||[],air:f.volume?.quads||f.swordAir?.quads||[],transitOpacity:transit.spaceTransitOpacity(age),moved:age>=st.vanish});f.destroy();
 }
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));fs.writeFileSync(path.join(REC,'motion.json'),JSON.stringify({paths}));
 const report={baseline:'24cc600',status:'PASS',cosmeticFrames:frames.length,tipAnchorCases:tipCases,motionCases:checks,maxSpeed,maxAcceleration,teleportTimeline:st,eyePerspectiveFlipped:true,existingDamageSchedulesPreserved:true,gameEngineBrowserBattleAudioOrWasmStarted:false};fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
