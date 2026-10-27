const config=isolated('assets/scripts/config/ThunderLanceConfig.ts');
const plans=isolated('assets/scripts/battle/ThunderLancePlans.ts');
const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports);
const fx=isolated('assets/scripts/battle/ThunderLanceVFX.ts',{...imports,'./SwordAbilityVFX':art});
let scheduleCases=0;
for(const seconds of [4,4.5,6,7])for(const interval of [.75,.8,1])for(const dt of [1/120,1/60,1/30,.05,.17,.4]){
 let age=0,next=0;while(age<seconds+.5){age+=dt;next+=plans.lanceDuePulses(age,next,interval,seconds);}
 assert.equal(next,Math.floor((seconds+1e-7)/interval));scheduleCases++;
}
for(let level=1;level<=20;level++){
 const s=config.lanceSkillCfg(level),u=config.lanceUltCfg(level);assert.ok(s.mul>0&&u.mul>s.mul&&s.maxCount<=16);
 for(let n=0;n<=30;n++){
  const count=plans.lanceRecallCount(n,s.count,s.maxCount),p=plans.lanceRainPlan(30,100,count,s.radius);
  assert.equal(p.length,count);assert.equal(p[0].x,30);assert.equal(p[0].y,100);
  for(const q of p)assert.ok(Math.hypot(q.x-30,(q.y-100)/.65)<=s.radius*.78+1e-5);
 }
}
const source=read('assets/scripts/battle/ThunderLanceHero.ts');
for(const needle of ['this.fields.filter(f=>!f.giant)','this.fields=this.fields.filter(f=>f.giant)',
 'this.node.isValid','m.groundY-y','this.lastDmg?.add','this.beginSkillCooldown()',
 'this.pending.length>=96','onGroundDamage:','onGroundImpact:','lanceDuePulses','Sfx.impact'])assert.ok(source.includes(needle),needle);
assert.ok(!/setTimeout|Date\.now|performance\.now/.test(source));
const projection=read('assets/scripts/battle/Projectile.ts');assert.ok(projection.includes('lanceFlight?.end()'));
for(const rel of ['core/GameData.ts','core/SaveData.ts','config/Cards.ts','config/Weapons.ts','ui/TrainingLobby.ts',
 'ui/Panels.ts','ui/HeroComic.ts','ui/HUD.ts','ui/ComicUI.ts','ui/BattleEntryWarmup.ts','ui/GrowthFeedback.ts',
 'ui/PickArt.ts','ui/pages/UpgradePage.ts','core/Sfx.ts','battle/BattleDirector.ts','battle/UltimateTiming.ts','config/Mobs.ts'])assert.ok(read('assets/scripts/'+rel).includes('lance'),rel);
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[];
 for(const[kind,count]of [['normal',72],['recall-rain',84],['ultimate',108]]){
  const f=new fx.ThunderLanceVFX(parent);const fields=[];
  for(let i=0;i<count;i++){
   const age=i/24;f.tick(i?1/24:0);fields.length=0;
   if(kind==='normal'){
    fields.push({x:0,y:210,radius:90,age,seconds:4.5,giant:false,seed:.37,angle:-1.65});
    if(i===0)f.impact(0,210,90,false,.37);
    if(i>0&&i%18===0)f.arc(0,222,72,290,false);
   }
   if(kind==='ultimate'){
    fields.push({x:0,y:210,radius:250,age,seconds:6,giant:true,seed:.37,angle:-1.7});
    if(i===0)f.impact(0,210,250,true,.37);
    if(i>0&&i%24===0){f.wave(0,210,250,.37+i/24);for(const[x,y]of [[-100,260],[120,340],[75,200]])f.arc(0,222,x,y,true);}
   }
   if(kind==='recall-rain'){
    if(i===0){for(let k=0;k<4;k++)f.recall({x:(k-1.5)*85,y:240+(k%2)*90,radius:90,age:1,seconds:4.5,giant:false,seed:k*.19,angle:-1.65},0,-50,.6);f.mark(0,300,170,.9);}
    for(const[p,k]of plans.lanceRainPlan(0,300,10,170).map((p,k)=>[p,k])){
     const t=age-.6-p.delay;
     if(t>=.38){fields.push({x:p.x,y:p.y,radius:90,age:t-.38,seconds:4,giant:false,seed:k*.19,angle:-1.65});
      if(t-.38<1/24)f.impact(p.x,p.y,90,false,k*.19);}
    }
   }
   f.render(fields);
   const name=kind+'-'+i+'.png';frames.push({kind,age,ground:f.ground.quads,air:f.spears.quads,
     groundGraphics:await layer(f.dirt,'ground-'+name),graphics:await layer(f.g,name),frontGraphics:await layer(f.front,'front-'+name)});
  }f.destroy();
 }
 // The exact tip anchors survive all supported insertion angles, not only straight swords.
 let anchors=0;for(const angle of [-1.75,-Math.PI/2,-1.4])for(const size of [9,35])for(const age of [0,.04,.12,1]){
  const shader=new Shader(null,'s',1);fx.drawLanceFlight(shader,new G(),20,30,angle,size,age,.37,1,true);
  const q=shader.quads[0],length=size*8,buried=length*q[10];
  assert.ok(Math.abs(q[0]+Math.cos(angle)*(length*.5-buried)-20)<1e-6);
  assert.ok(Math.abs(q[1]+Math.sin(angle)*(length*.5-buried)-30)<1e-6);anchors++;
 }
 // Explicit failed-material path produces finite code geometry, never white carrier quads.
 const fallback=new Shader(null,'s',1);fallback.ready=false;const ink=new G();fx.drawLanceFlight(fallback,ink,0,100,-1.5,35,.4,.1);assert.ok(ink.commands.length>0);
 const bounded=new fx.ThunderLanceVFX(parent);for(let i=0;i<200;i++){bounded.arc(0,0,10,10,false);bounded.impact(0,0,90,false,.2);}assert.equal(bounded.arcs.length,96);assert.equal(bounded.accents.length,64);bounded.tick(2);assert.equal(bounded.arcs.length+bounded.accents.length,0);bounded.destroy();
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 const report={status:'PASS',pureScheduleCases:scheduleCases,trainingLevels:20,rainCountCases:620,tipAnchors:anchors,cosmeticFrames:frames.length,
  buffersBounded:true,fallbackGeometry:true,gameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
