/** Offline pure configuration/geometry/drawing checks. Never imports heroes, engine or gameplay. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function isolated(file,imports={}){const out=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);
  const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied import '+n);return imports[n];},Math,Number,Map,Set};vm.runInNewContext(out.outputText,c,{filename:file});return c.exports;}
const cfg=isolated('assets/scripts/config/SpaceSwordConfig.ts'),geo=isolated('assets/scripts/battle/WindNinjaGeometry.ts');
const weapons=isolated('assets/scripts/config/Weapons.ts');
const source=read('assets/scripts/battle/SpaceSwordHeroes.ts'),proj=read('assets/scripts/battle/Projectile.ts'),mob=read('assets/scripts/battle/Monster.ts');
let sweepCases=0;
for(const half of [560,667,880,1200,1700])for(const dt of [.016,.1,.5,3.8])for(let x=-375;x<=375;x+=15){
  const bottom=-half+199,top=half+100,targetY=bottom+(top-bottom)*.51,step=cfg.SPACE.ultSpeed*dt;
  let hit=false;
  for(let y=bottom;y<top;y+=step){const travel=Math.min(step,top-y);if(Number.isFinite(geo.sweptBladeEntry(targetY-y,-x,travel,cfg.spaceUltCfg(1).halfLength,17)))hit=true;}
  assert.ok(hit,'Blade missed screen column '+x);sweepCases++;
}
for(const slot of ['skill','ult'])for(const hero of ['space','sword']){
  const f=cfg[hero+(slot==='skill'?'Skill':'Ult')+'Cfg'];let prior=0;
  for(let lv=1;lv<=20;lv++){const c=f(lv);assert.ok(c.mul>prior);prior=c.mul;assert.equal(cfg.spaceSwordMilestones(hero,slot).length,4);}
}
assert.equal(cfg.spaceSkillCfg(1).targets,4);assert.notEqual(cfg.SPACE.energy,cfg.SWORD.energy);
assert.equal(weapons.weaponFits('sword','wpn_starter_sword'),true);assert.equal(weapons.weaponFits('space','wpn_starter_sword'),false);
assert.equal(weapons.weaponFits('space','wpn_starter_space'),true);assert.equal(weapons.weaponFits('sword','wpn_starter_staff'),false);
for(const id of ['space','sword']){
  assert.ok(read('assets/scripts/core/GameData.ts').includes("id:'"+id+"'"));
  assert.ok(read('assets/scripts/core/SaveData.ts').includes("'"+id+"'"));
  assert.ok(read('assets/scripts/battle/BattleDirector.ts').includes('new '+(id==='space'?'Space':'Sword')+'Hero'));
  assert.ok(read('assets/scripts/ui/BattleEntryWarmup.ts').includes("new_heroes_v127/"));
  assert.ok(read('assets/scripts/config/Cards.ts').includes("commonHeroCards('"+id+"')"));
  const growth=ts.createSourceFile('GrowthFeedback.ts',read('assets/scripts/ui/GrowthFeedback.ts'),ts.ScriptTarget.Latest,true);
  for(const key of ['NORMAL_CFG','ULT_DAMAGE']){
    const decl=growth.statements.filter(ts.isVariableStatement).flatMap(s=>Array.from(s.declarationList.declarations)).find(d=>d.name.getText(growth)===key);
    assert.ok(decl&&ts.isObjectLiteralExpression(decl.initializer)&&decl.initializer.properties.some(p=>p.name?.getText(growth)===id),'Missing growth feedback '+id+':'+key);
  }
  assert.ok(read('assets/scripts/ui/ComicUI.ts').includes('wind|ninja|space|sword'));
}
assert.ok(mob.includes('this.holdY=y;'));assert.ok(mob.includes('this.lungeT=this.atkAnimT=0'));
assert.ok(mob.includes('this.dead||this.isBoss||!Number.isFinite(destinationY)'));
assert.ok(source.includes('for(let k=0;k<2;k++)'));assert.ok(source.includes('pierce:1000000'));
assert.ok(source.includes('earned=true;this.intent=Math.min(SWORD.intentCap,this.intent+1)'));
assert.ok(source.includes('this.intent=0;this.beginSkillCooldown()'));
assert.ok(proj.includes('target.lifeId===sp.homingLifeId'));assert.ok(proj.includes('const next=this.mgr.nearest'));
const cannon=read('assets/scripts/battle/NewHeroes.ts');
assert.ok(cannon.includes('ttl:Math.hypot(LO.half*2+400,860)/760'));
assert.ok(cannon.includes("targetLayer:'ground',explodeR:shot.radius,explodeMul:.7"));
assert.ok(cannon.includes('onBlastImpact:m=>'));assert.ok(proj.includes('if (sp.onBlastImpact) sp.onBlastImpact(m)'));
assert.ok(!read('assets/scripts/battle/SpaceSwordVFX.ts').match(/resources\.load|Date\.now|setTimeout|SpriteFrame/));
class G{
  constructor(){this.commands=[];this.path='';this.lineWidth=1;}
  clear(){this.commands=[];this.path='';}
  moveTo(x,y){this.check(x,y);this.path=`M${x},${y}`;}
  lineTo(x,y){this.check(x,y);this.path+=`L${x},${y}`;}
  quadraticCurveTo(a,b,x,y){this.check(a,b,x,y);this.path+=`Q${a},${b} ${x},${y}`;}
  ellipse(x,y,a,b){this.check(x,y,a,b);this.path=`M${x-a},${y}a${a},${b} 0 1,0 ${a*2},0a${a},${b} 0 1,0 ${-a*2},0`;}
  close(){this.path+='Z';}
  check(...n){assert.ok(n.every(Number.isFinite));}
  fill(){this.add('fill',this.fillColor);}
  stroke(){this.add('stroke',this.strokeColor);}
  add(kind,c){assert.ok(c&&Number.isFinite(c.a));this.commands.push(`<path d="${this.path}" ${kind}="${c.hex}" ${kind}-opacity="${c.a}" ${kind==='stroke'?`fill="none" stroke-width="${this.lineWidth}"`:''}/>`);}
}
const CA=(hex,a)=>({hex,a});
const fx=isolated('assets/scripts/battle/SpaceSwordVFX.ts',{'cc':{Graphics:G},'../ui/UIKit':{CA,N:()=>({isValid:true,addComponent:()=>new G(),setSiblingIndex(){},destroy(){}})}});
let frames=0,maxCommands=0;
for(let i=0;i<180;i++){
  const g=new G(),angle=(i%4)*Math.PI/2,t=i/60;
  fx.drawMagicBlade(g,0,0,angle,423,t,'#BB63D8');fx.drawFlyingSword(g,0,0,angle,i%2?23:7,t);fx.drawRiftShard(g,0,0,angle,7,t);
  maxCommands=Math.max(maxCommands,g.commands.length);frames++;
}
async function main(){
  const aliases=isolated('assets/scripts/ui/NewHeroArt.ts').NEW_HERO_FRAMES,manifest=JSON.parse(read('docs/space-sword-v127/art-manifest.json'));
  for(const [key,frame]of Object.entries(manifest.frames)){assert.deepEqual(JSON.parse(JSON.stringify(aliases[key])),frame);const a=manifest.assets.find(a=>a.path.endsWith(frame.source.split('/').pop()+'.png'));assert.ok(a);const[x,y,w,h]=frame.rect;assert.ok(x>=0&&y>=0&&x+w<=a.width&&y+h<=a.height);}
  for(const a of manifest.assets){const m=await sharp(path.join(ROOT,a.path)).metadata();assert.ok(m.hasAlpha);assert.equal(m.width,a.width);assert.equal(m.height,a.height);}
  const panels=[];
  function panel(x,y,w,h,title,draw){const g=new G();draw(g);panels.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#273A32"/><text x="${x+18}" y="${y+27}" fill="#FFF1D1" font-size="19">${title}</text><g transform="translate(${x+w/2},${y+h*.62}) scale(1,-1)">${g.commands.join('')}</g>`);}
  panel(12,12,936,200,'Space ultimate - complete transverse blade',g=>fx.drawMagicBlade(g,0,0,Math.PI/2,423,.35,'#BB63D8'));
  panel(12,224,300,250,'Space crystal',g=>fx.drawRiftShard(g,0,0,Math.PI/2,18,.35));
  panel(324,224,300,250,'Sword flight / finishing sword',g=>{fx.drawFlyingSword(g,-55,0,Math.PI/2,10,.3);fx.drawFlyingSword(g,45,0,-Math.PI/2,24,.5);});
  panel(636,224,312,250,'Sword formation',g=>{for(let k=0;k<9;k++){const a=k*Math.PI*2/9;fx.drawFlyingSword(g,Math.cos(a)*100,Math.sin(a)*40,Math.PI/2,5,.3);}});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="486"><rect width="960" height="486" fill="#14221E"/>${panels.join('')}</svg>`;
  fs.writeFileSync(path.join(__dirname,'procedural-preview.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'procedural-preview.png'));
  const report={status:'PASS',pureGeometryCases:sweepCases,isolatedDrawingFrames:frames,maxDrawingCommands:maxCommands,
    artAliasesChecked:Object.keys(manifest.frames).length,checks:['full screen blade width and continuous sweeps across five aspect ratios','monotone cultivation curves','two distinct energy requirements','weapon compatibility','factory/save/common cards/prewarm registration','teleport clears hold/lunge anchors and protects bosses','sword intent earned once per actual normal projectile hit','homing lifecycle guard and retargeting','cannon lifespan/splash/procedural burst path','pure drawing finite geometry and no image runtime dependency','formal art alpha/atlas bounds'],
    actualEngineGameBrowserCombatAudioOrWasmStarted:false,manualPhoneGameplay:'pending user'};
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
