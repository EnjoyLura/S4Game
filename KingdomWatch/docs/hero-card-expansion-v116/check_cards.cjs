// Pure card/config data only. No hero, monster, combat, scene or browser module executes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const root=path.resolve(__dirname,'../..');
function pure(file,imports={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports:m.exports,require:n=>{if(imports[n])return imports[n];throw Error('Unexpected dependency '+n);}});return m.exports;}
const cfg=pure('assets/scripts/config/NewHeroConfig.ts');
const cards=pure('assets/scripts/config/Cards.ts',{'./NewHeroConfig':cfg,'./GameConfig':{PAL:{white:'#fff',blue:'#00f',purple:'#f0f',gold:'#fa0'}}});
const art=pure('assets/scripts/ui/NewHeroArt.ts').NEW_HERO_FRAMES;
const wanted={cannon_fragments:['cannonFragments',true],cannon_pierce:['cannonPierce',1],cannon_center:['cannonCenter',.3],
 cannon_heavy:['cannonHeavy',true],cannon_cluster:['cannonCluster',true],cannon_wave:['cannonWave',true],
 cannon_interrupt:['cannonInterrupt',true],cannon_charges:['cannonCharges',true],cannon_refund:['cannonRefund',true],
 cannon_ult_center:['cannonUltCenter',.3],cannon_ult_radius:['cannonUltRadius',.3],cannon_ult_stun:['cannonUltStun',2],
 siphon_relay:['siphonRelay',1],siphon_slow:['siphonSlow',.2],siphon_healcut:['siphonHealCut',.3],
 siphon_relay_time:['siphonExtendOnKill',true],siphon_fork:['siphonFork',true],siphon_ult_duration:['siphonUltDuration',1.5],
 siphon_ult_ticks:['siphonUltTicks',3],siphon_heavy_grip:['siphonHeavyGrip',true],siphon_skill_targets:['siphonSkillTargets',1]};
const selected=[];
for(const [id,[key,value]] of Object.entries(wanted)){
 const list=cards.M0_POOL.filter(c=>c.id===id);assert.equal(list.length,1,id);const c=list[0];
 assert.equal(c.owner,id.split('_')[0]);assert(cards.isMechanicCard(c));assert(art[c.art],c.art);
 const x={hero:{},global:{}};c.apply(x);assert.equal(x.hero[key],value,id);
 assert.equal(Object.keys(x.hero).length,1,id+' leaks into other stats');
 if(c.maxStacks>1){c.apply(x);assert(Math.abs(x.hero[key]-Number(value)*2)<1e-8);}
 selected.push({id,name:c.name,desc:c.desc,art:c.art,maxStacks:c.maxStacks,source:art[c.art].source});
}
assert.equal(cfg.CANNON_CARDS_CFG.fragments,3);assert.equal(cfg.CANNON_CARDS_CFG.refundTargets,7);
const timing=[];
for(const lv of [1,10,20])for(const duration of [0,1.5])for(const extra of [0,3,6])for(const cadence of [[1/60],[1/30],[.011,.027,.043,.018]]){
 const c=cfg.siphonLaserCfg(lv,duration,extra),base=cfg.siphonUltCfg(lv);
 assert.equal(c.ticks,Math.round((base.duration+duration)/.15)+extra);
 let age=0,bank=0,ticks=0,i=0,end=.6+c.duration+.18;
 while(age<end){const before=age;age+=cadence[i++%cadence.length];bank+=Math.max(0,Math.min(age,.6+c.duration)-Math.max(before,.6));
  while(bank+1e-8>=c.interval){bank=Math.max(0,bank-c.interval);ticks++;}}
 assert.equal(ticks,c.ticks);timing.push({level:lv,durationBonus:duration,extraTicks:extra,cadence,ticks,interval:c.interval});
}
const report={newCards:selected,cannonCards:12,siphonCards:9,allArtUsesExistingHeroSources:true,
 pureConfigApplicationsPassed:true,laserTimingCases:timing,gameModulesExecuted:false};
fs.writeFileSync(path.join(__dirname,'card-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cards:selected.length,timingCases:timing.length,level1Base:cfg.siphonLaserCfg(1),
 level1DurationAndTicks:cfg.siphonLaserCfg(1,1.5,3),gameStarted:false}));
