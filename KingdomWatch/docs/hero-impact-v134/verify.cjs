// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/hero-impact-v134/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
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
const fx=isolated('assets/scripts/battle/SpaceSwordVFX.ts',{...imports,'./SwordAbilityVFX':art});
const transit=isolated('assets/scripts/battle/SpacePresentation.ts');
assert.equal(transit.spaceTransitOpacity(0),1);for(const age of [.35,.5,.79])assert.equal(transit.spaceTransitOpacity(age),0);assert.equal(transit.spaceTransitOpacity(1.3),1);
for(let i=0;i<200;i++){const a=i/100,v=transit.spaceTransitOpacity(a);assert.ok(v>=0&&v<=1);}
const cfg=isolated('assets/scripts/config/SpaceSwordConfig.ts'),plans=isolated('assets/scripts/battle/SpaceSwordPlans.ts',{'../config/SpaceSwordConfig':cfg});
const before=f=>cp.execFileSync('git',['show','d80042b0:KingdomWatch/'+f],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');
const now=f=>read(f).replace(/\r\n/g,'\n');
for(const f of ['assets/scripts/config/SpaceSwordConfig.ts','assets/scripts/battle/SpaceSwordPlans.ts','assets/scripts/battle/WindNinjaVFX.ts','assets/scripts/battle/WindNinjaHeroes.ts','assets/scripts/battle/WindVideoVFX.ts','assets/resources/fx/wind_eye_video_v129.frames.json'])assert.equal(now(f),before(f));
const hero='assets/scripts/battle/SpaceSwordHeroes.ts';assert.equal(now(hero).split('export class SwordHero')[1],before(hero).split('export class SwordHero')[1]);
// Freeze every projectile simulation/damage method; cosmetic fire latch is the sole release edit.
const projectile='assets/scripts/battle/Projectile.ts';
function methods(text){const tree=ts.createSourceFile('p.ts',text,ts.ScriptTarget.Latest,true);return tree.statements.find(ts.isClassDeclaration).members.filter(ts.isMethodDeclaration).map(m=>[m.name.getText(tree),m.getText(tree)]);}
const oldMethods=new Map(methods(before(projectile).replace(/\n\s*a\.swordShader = [^\n]+;/,'')));
for(const[n,s]of methods(now(projectile)))if(!['warmSwordFlight','warmSpaceFlight','render','makeActive'].includes(n))assert.equal(s.replace(/\n\s*a\.(?:swordShader|spaceShader) = [^\n]+;/g,''),oldMethods.get(n),n+' gameplay changed');
// New presentation hooks are the only edits to pre-existing Monster methods.
const monster='assets/scripts/battle/Monster.ts',oldMonster=new Map(methods(before(monster)));
for(const[n,source]of methods(now(monster))){if(!oldMonster.has(n))continue;
 const clean=source.replaceAll('this.clearSpaceTransit();','').replaceAll('this.tickSpaceTransit(dt);','').replace(/\s+/g,'');
 assert.equal(clean,oldMonster.get(n).replace(/\s+/g,''),n+' unrelated monster change');}
const mh=now(monster);assert.ok(mh.includes('if(!this.transitMoved&&this.transitAge>=SPACE_TRANSIT.vanish)'));
assert.ok(mh.includes('if(this.dead||this.isBoss||!this.node.isValid||!Number.isFinite(destinationY)'));
for(const dt of [1/60,1/30,.1,.4,1.5]){let age=0,count=0,moved=false;while(age<1.5){age+=dt;if(!moved&&age>=transit.SPACE_TRANSIT.vanish){moved=true;count++;}}assert.equal(count,1);}
const windSource='assets/resources/fx/wind-ninja-flow.effect';assert.equal(now(windSource).split('  float shurikenShape')[0],before(windSource).split('  float shurikenShape')[0]);
for(const angle of [-Math.PI/2,-.9,0,.9,Math.PI/2,Math.PI])for(const giant of [false,true]){
 const s=new Shader(null,'test',24),size=giant?64:9;assert.ok(art.drawSwordFlight(s,37,91,angle,size,.12,.3,giant));
 const q=s.quads[0],a=q[4]*Math.PI/180,tipX=q[0]-Math.sin(a)*q[9]*.65,tipY=q[1]+Math.cos(a)*q[9]*.65;
 assert.ok(Math.abs(tipX-37)<1e-6&&Math.abs(tipY-91)<1e-6,'tip anchor');
}
const clip=JSON.parse(read('assets/resources/fx/wind_tornado_video_v129.frames.json')),oldClip=JSON.parse(before('assets/resources/fx/wind_tornado_video_v129.frames.json'));assert.equal(clip.visualWidthPerRadius,4.6);clip.visualWidthPerRadius=oldClip.visualWidthPerRadius;assert.deepEqual(clip,oldClip);
const effect=read('assets/resources/fx/sword-jade-flow.effect');assert.ok(!/\b(sampler2D|samplerCube|texture)\b/.test(effect));assert.ok(effect.includes('blendSrcAlpha: zero'));
async function main(){
 fs.mkdirSync(REC,{recursive:true});const frames=[];let maxGround=0,maxAir=0;
 for(const kind of ['skill','heaven'])for(let i=0;i<110;i++){
  const age=i/24,f=new fx.SpaceSwordVFX(parent);f.warmSword();const g=drawings.at(-2),ink=drawings.at(-1),groundFx=instances.at(-2),air=instances.at(-1),flight=new Shader(null,'flight',24);
  const radius=kind==='skill'?155:240;
  f.add('array',0,170,kind==='skill'?radius:320,kind==='skill'?2.8:3.45);f.accents.at(-1).age=age;
  // Representative 1590-unit tall field: half=795, notch=0, heaven arena top=640, skill release y=860.
  const shots=kind==='heaven'?plans.heavenSwordPlan(0,170,240,{left:-315,right:315,bottom:-100,top:640}):plans.swordRainPlan(0,170,12,155).map(s=>({...s,startX:s.x+45,startY:860,seconds:s.final?.52:.42}));
  for(const s of shots){
   const release=(kind==='heaven'?.65:.18)+s.delay,t=age-release,impact=t-s.seconds;
   const rr=kind==='heaven'?(s.final?320:240):(s.final?155:60),angle=Math.atan2(s.y-s.startY,s.x-s.startX);
   if(impact>=0&&impact<art.swordImpactLife(kind==='heaven',rr)){f.add(kind==='heaven'?'giant':'cut',s.x,s.y,rr,kind==='heaven'?.9:.6,angle);f.accents.at(-1).age=impact;}
   if(kind==='heaven'&&t>=0&&t<s.seconds){f.add('landing',s.x,s.y,rr,s.seconds,angle);f.accents.at(-1).age=t;}
   if(t>=0&&t<s.seconds){const p=t/s.seconds;art.drawSwordFlight(flight,s.startX+(s.x-s.startX)*p,s.startY+(s.y-s.startY)*p,angle,
    kind==='heaven'?(s.final?64:48):(s.final?23:9),t,.37,kind==='heaven');}
  }
  f.render();maxGround=Math.max(maxGround,groundFx.quads.length);maxAir=Math.max(maxAir,air.quads.length);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g.commands.join('')}</g></svg>`;
  const name=`${kind}-${i.toString().padStart(3,'0')}.png`;await sharp(Buffer.from(svg)).png().toFile(path.join(REC,name));
  const groundName='ground-'+name;await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${ink.commands.join('')}</g></svg>`)).png().toFile(path.join(REC,groundName));
  frames.push({kind,age,graphics:name,groundGraphics:groundName,ground:groundFx.quads,air:air.quads.concat(flight.quads)});f.destroy();assert.equal(f.groundNode.isValid,false);
 }
 for(let i=0;i<72;i++){
  const age=i/30,g=new G(),flight=new Shader(null,'flight',24);
  for(let k=0;k<3;k++){const t=(age*.85+k*.33)%1,angle=(70+k*13)*Math.PI/180;
   art.drawSwordFlight(flight,-70+k*60+Math.cos(angle)*t*460,Math.sin(angle)*t*460,angle,7,t,k*.17,false);}
  const name='normal-'+i+'.png',svg='<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"></svg>';
  await sharp(Buffer.from(svg)).png().toFile(path.join(REC,name));frames.push({kind:'normal',age,graphics:name,groundGraphics:name,ground:[],air:flight.quads});
 }
 const spaceFrames=[];
 for(const kind of ['space-ult','space-transit','space-normal'])for(let i=0;i<108;i++){
  const age=i/24,f=new fx.SpaceSwordVFX(parent);f.warmVolume();const g=drawings.at(-1),shader=instances.at(-1);
  if(kind==='space-ult')f.setPrison([{x:-90,y:160,orbX:-90,orbY:207,orb:true,orbRadius:83,radius:105},{x:110,y:310,orbX:110,orbY:357,orb:true,orbRadius:83,radius:105}],age,.95,3);
  if(kind==='space-transit'){
   if(age<.85){f.add('portal',-90,207,83,.85);f.accents.at(-1).age=age;}
   if(age<1.5){f.add('arrival',-90,507,83,1.5);f.accents.at(-1).age=age;}
  }
  f.render();
  if(kind==='space-normal')for(let k=0;k<3;k++){const t=(age*.8+k*.33)%1,a=(70+k*12)*Math.PI/180;
   shader.draw(-70+k*60+Math.cos(a)*t*430,Math.sin(a)*t*430,98,49,a*180/Math.PI,t,k*.19,1,3,25.2,0);}
  const name=kind+'-'+i+'.png',svg=`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g.commands.join('')}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(REC,name));
  spaceFrames.push({kind,age,graphics:name,quads:shader.quads,transitOpacity:transit.spaceTransitOpacity(age),moved:age>=transit.SPACE_TRANSIT.vanish});f.destroy();
 }
 fs.writeFileSync(path.join(REC,'space-recipes.json'),JSON.stringify({frames:spaceFrames,width:750,height:940,bottom:-100}));
 // Startup failure keeps bounded old geometry; expiry clears accents and no stale quads.
 const f=new fx.SpaceSwordVFX(parent);f.warmSword();f.swordGround.ready=false;for(let i=0;i<60;i++)f.add('cut',i,0,60);assert.equal(f.accents.length,40);f.render();f.tick(2);f.render();assert.equal(f.accents.length,0);f.destroy();
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 const report={baseline:'d80042b0',status:'PASS',cosmeticFrames:frames.length,spaceCosmeticFrames:spaceFrames.length,tipAnchorCases:12,maxGround,maxAir,groundCapacity:24,airCapacity:32,flightCapacity:24,
  swordAndWindGameplayAndEyePreserved:true,shaderHasNoImageSampler:true,groundNodeCleanup:true,lateLoadFallback:true,actualGameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
