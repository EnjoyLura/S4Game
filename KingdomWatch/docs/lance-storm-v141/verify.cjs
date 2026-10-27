// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/lance-storm-v141/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
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



const plans=isolated('assets/scripts/battle/ThunderLancePlans.ts');
const config=isolated('assets/scripts/config/ThunderLanceConfig.ts');
const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports);
const fx=isolated('assets/scripts/battle/ThunderLanceVFX.ts',{...imports,'./SwordAbilityVFX':art});
let trajectoryCases=0,poseSamples=0,maxAngleStep=0,minDescent=1;
const paths=[];
for(const kind of ['normal','rain','great'])for(const sy of (kind==='rain'?[850]:[-700,-450,-50]))for(const sx of [-300,-100,0,100,300])for(const tx of [-300,-100,0,100,300])for(const ty of [-480,-300,50,300,700]){
 if(kind!=='rain'&&ty<sy-40)continue;
 const p=plans.lanceFlightPlan(sx,sy,tx,ty,kind),end=plans.lanceFlightPose(p,p.seconds);
 assert.ok(p.seconds>0&&p.seconds<3);assert.equal(end.x,tx);assert.equal(end.y,ty);assert.ok(end.vy<0);assert.equal(end.angle,Math.atan2(end.vy,end.vx));
 assert.ok(!plans.lanceFlightPose(p,p.seconds-1e-7).arrived&&end.arrived);
 let prior=null,high=-Infinity,apex=0;const pts=[];
 for(let i=0;i<=240;i++){
  const t=p.seconds*i/240,q=plans.lanceFlightPose(p,t);poseSamples++;
  assert.ok([q.x,q.y,q.angle,q.vx,q.vy].every(Number.isFinite));assert.ok(q.x>=-356&&q.x<=356);
  if(q.y>high){high=q.y;apex=i/240;}
  if(prior){const d=Math.abs(Math.atan2(Math.sin(q.angle-prior.angle),Math.cos(q.angle-prior.angle)));maxAngleStep=Math.max(maxAngleStep,d);assert.ok(d<.20,JSON.stringify({kind,sx,sy,tx,ty,i,d}));}
  const epsilon=.00001;if(t>epsilon&&t<p.seconds-epsilon){
   const a=plans.lanceFlightPose(p,t-epsilon),b=plans.lanceFlightPose(p,t+epsilon);
   assert.ok(Math.abs((b.x-a.x)/(2*epsilon)-q.vx)<1e-4);assert.ok(Math.abs((b.y-a.y)/(2*epsilon)-q.vy)<1e-4);
  }prior=q;if(i%8===0)pts.push([q.x,q.y,q.angle]);
 }
 if(kind!=='rain'){
  minDescent=Math.min(minDescent,1-apex);assert.ok(1-apex>=.30,'Descending phase cannot be squeezed into a steep final tail');
  assert.ok(Math.abs(Math.atan2(-end.vy,Math.abs(end.vx)))<Math.PI*.3,'Oblique landing, not near-vertical');
 }
 if(sy===-450&&(sx===-300&&tx===300&&ty===300||sx===0&&tx===0&&ty===700))paths.push({kind,...p,apex,points:pts});trajectoryCases++;
}
const hero=read('assets/scripts/battle/ThunderLanceHero.ts'),projection=read('assets/scripts/battle/Projectile.ts');
assert.ok(hero.includes('size:giant?40:12')&&hero.includes('phase:flight.seconds'));
assert.ok(projection.includes('const pose=lanceFlightPose(sp.lanceFlight,a.age)'));
assert.ok(!/setTimeout|Date\.now|performance\.now/.test(hero));
for(const rel of ['battle/MagicBowHero.ts','battle/ScytheHero.ts','battle/SpaceSwordHeroes.ts','battle/WindNinjaHeroes.ts',
 'battle/Monster.ts','config/ThunderLanceConfig.ts','ui/Panels.ts','ui/BattleTipLayout.ts']){
 const before=cp.execFileSync('git',['show','9cb78843:KingdomWatch/assets/scripts/'+rel],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(read('assets/scripts/'+rel).replace(/\r\n/g,'\n'),before);
}
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[];
 for(const[kind,count]of [['normal',72],['rain',60],['ultimate',108],['volley',72]]){
  const p=plans.lanceFlightPlan(kind==='rain'?200:-190,kind==='rain'?800:-30,120,330,kind==='ultimate'?'great':kind==='volley'?'normal':kind);
  const f=new fx.ThunderLanceVFX(parent),flight=new Shader(null,'flight',1),fields=[];let impacted=false;
  for(let i=0;i<count;i++){
   const age=i/30;f.tick(i?1/30:0);flight.begin();fields.length=0;const q=plans.lanceFlightPose(p,age),giant=kind==='ultimate';
   if(kind==='volley'){
    for(let k=0;k<8;k++)fields.push({x:(k%4-1.5)*115,y:250+Math.floor(k/4)*160,angle:-1.1+(k%3)*.2,radius:90,giant:false,age:age+k*.13,seconds:4.5,seed:k*.137,phase:.8});
   }else if(!q.arrived)fx.drawLanceFlight(flight,new G(),q.x,q.y,q.angle,giant?40:12,age,.37);
   else{const plantedAge=age-p.seconds;fields.push({x:p.tx,y:p.ty,angle:q.angle,radius:giant?250:90,giant,age:plantedAge,seconds:giant?6:4.5,seed:.37,phase:p.seconds});
    if(!impacted){f.impact(p.tx,p.ty,giant?250:90,giant,.37);impacted=true;}
    if(giant&&plantedAge>1&&plantedAge%1<1/30)f.wave(p.tx,p.ty,250,.37+Math.floor(plantedAge));
   }
   f.render(fields);const name=kind+'-'+i+'.png';frames.push({kind,age,ground:f.ground.quads,air:[...f.spears.quads,...flight.quads],
    groundGraphics:await layer(f.dirt,'ground-'+name),graphics:await layer(f.g,name),frontGraphics:await layer(f.front,'front-'+name)});
  }f.destroy();
 }
 let anchors=0;
 for(const angle of [-2.4,-1.7,-1.2,-.7])for(const size of [12,40])for(const age of [0,.04,.12,1]){
  const shader=new Shader(null,'s',1);fx.drawLanceFlight(shader,new G(),20,30,angle,size,age,.37,1,true,1.2);
  const q=shader.quads[0],length=size*8,buried=length*q[10];assert.ok(Math.abs(q[0]+Math.cos(angle)*(length*.5-buried)-20)<1e-6);
  assert.ok(Math.abs(q[1]+Math.sin(angle)*(length*.5-buried)-30)<1e-6);anchors++;
 }
 const fallback=new Shader(null,'s',1);fallback.ready=false;const ink=new G();fx.drawLanceFlight(fallback,ink,0,100,-.8,40,.4,.1,1,true);assert.ok(ink.commands.length>0);
 for(let seed=0;seed<5;seed++){const g=new G();fx.lanceGround(g,0,0,250,.2+seed*.12,seed*.2,true,1);assert.ok(g.commands.length>0);}
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 fs.writeFileSync(path.join(__dirname,'trajectory-review.json'),JSON.stringify(paths,null,2)+'\n');
 const report={status:'PASS',trajectoryCases,poseSamples,maxAngleStepRadians:maxAngleStep,minDescentFraction:minDescent,tipAnchors:anchors,
  cosmeticFrames:frames.length,fallbackGeometry:true,oldHeroImplementationsAndTooltipFixPreserved:true,gameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
