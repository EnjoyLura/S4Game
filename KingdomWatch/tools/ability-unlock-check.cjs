/* Checks real card/director/hero logic without starting a battle or loading artwork. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..'),cache=new Map(),checks=[];
class Node {constructor(name){this.name=name;this.position={x:0,y:0,z:0};}setParent(p){this.parent=p;}setPosition(x,y,z=0){this.position={x,y,z};}}
const cc={Node,Component:class{},_decorator:{ccclass:()=>C=>C}};
const config={HERO_Y:-545,PAL:{},RARITY_WEIGHT:{white:.6,blue:.3,purple:.1}};
const noop=()=>{},sfx={shoot:noop,play:noop};
function load(name){
  if(cache.has(name))return cache.get(name);
  const m={exports:{}};cache.set(name,m.exports);
  const src=fs.readFileSync(path.join(root,'assets/scripts',name+'.ts'),'utf8');
  const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  function req(id){
    if(id==='cc')return cc;
    if(id.endsWith('/GameConfig'))return config;
    if(id.endsWith('/Cards'))return load('config/Cards');
    if(id==='./Hero')return load('battle/Hero');
    if(id.endsWith('/SaveData'))return {loadSave:()=>({}),saveSave:noop};
    if(id.endsWith('/EventBus'))return {bus:{emit:noop},EVT:{}};
    if(id.endsWith('/Sfx'))return {Sfx:sfx};
    return new Proxy({}, {get:()=>class{}});
  }
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{Math,console,Set,Map},{filename:name+'.ts'})(req,m,m.exports);
  return m.exports;
}
const C=load('config/Cards'),H=load('battle/Hero'),D=load('battle/BattleDirector').BattleDirector;
const bases={archer:C.baseArcherStats,sniper:C.baseSniperStats,pyro:C.basePyroStats,volt:C.baseVoltStats,mora:C.baseMoraStats};
const ids=Object.keys(bases),card=id=>{const c=C.M0_POOL.find(c=>c.id===id);assert(c,id);return c;};
class ProbeHero extends H.HeroBase {
  buildVisual(p){this.node.setParent(p);this.node.setPosition(this.x,-545);}
  constructor(id){super(new Node('field'),0,bases[id]());Object.assign(this,{id,chargeMax:60,skillMax:10,shots:0,skills:0});}
  shoot(){this.shots++;}
  castSkill(){this.skills++;this.skillCd=this.skillCdTotal;}
  castUlt(){if(!this.ultReady)return false;this.charge=0;return true;}
}
const mgr={pickTarget:()=>({}),anyInRange:()=>true};
for(const id of ids){
  const hero=new ProbeHero(id),ctx={hero:hero.stats};
  hero.stats.atkLv=hero.stats.skillLv=hero.stats.ultLv=20;
  for(let i=0;i<120;i++){hero.tick(.1,mgr,{},{});hero.chargeKill(2);}
  assert(hero.shots>0);assert.equal(hero.skills,0);assert.equal(hero.charge,0);
  assert(!hero.ultReady);hero.charge=1000;assert(!hero.ultReady);hero.charge=0;
  C.ABILITY_CARDS.find(c=>c.owner===id&&c.unlocks==='skill').apply(ctx);
  hero.tick(.1,mgr,{},{});assert.equal(hero.skills,1);assert(!hero.ultUnlocked);
  hero.chargeKill(8);assert.equal(hero.charge,0);
  C.ABILITY_CARDS.find(c=>c.owner===id&&c.unlocks==='ult').apply(ctx);
  hero.chargeKill(8);assert.equal(hero.charge,8);
  for(let i=0;i<31;i++)hero.tick(.1,mgr,{},{});
  assert.equal(hero.charge,9);hero.chargeKill(100);assert(hero.ultReady);assert(hero.castUlt());
  const fresh=new ProbeHero(id);assert(!fresh.skillUnlocked&&!fresh.ultUnlocked);assert.equal(fresh.charge,0);
}
checks.push('Five heroes: normal attack only on entry, independent learning, no locked charging, fresh run resets');
for(const Hero of [H.ArcherHero,H.SniperHero,H.PyroHero,H.VoltHero,H.FrostHero]){
  const h=new ProbeHero('archer');h.charge=999;assert.equal(Hero.prototype.castUlt.call(h,{}, {}, {}),false);
}
checks.push('All five actual ultimate implementations reject locked abilities even with forced full charge');
const dependencies={
  archer:{skill:[],ult:['rain_rounds','fast_charge_a']},
  sniper:{skill:['multi_lock','cd_cut'],ult:['extra_line','fast_charge_s']},
  pyro:{skill:['pyro_spell','pyro_shards','pyro_cd','pyro_range'],ult:['pyro_war','pyro_eager','pyro_stun','pyro_morale']},
  volt:{skill:['volt_spell','volt_shards','volt_cd','volt_range'],ult:['volt_war','volt_eager','volt_morale']},
  mora:{skill:['mora_spell','mora_range','mora_cd'],ult:['mora_war','mora_linger','mora_morale','mora_eager','mora_glacier']}
};
for(const id of ids)for(const kind of ['skill','ult'])for(const upgrade of dependencies[id][kind]){
  assert(!C.canTakeCard(card(upgrade),{}),upgrade);
  assert(!C.canTakeCard(card(upgrade),{[id+'_unlock_'+(kind==='skill'?'ult':'skill')]:1}),upgrade);
  assert(C.canTakeCard(card(upgrade),{[id+'_unlock_'+kind]:1}),upgrade);
  assert(!C.canTakeCard(card(upgrade),{[id+'_unlock_'+kind]:1,[upgrade]:card(upgrade).maxStacks}),upgrade);
}
assert(!C.canTakeCard(card('pyro_ember'),{}));
assert(C.canTakeCard(card('pyro_ember'),{pyro_unlock_skill:1}));
assert(C.canTakeCard(card('pyro_ember'),{pyro_unlock_ult:1}));
for(const id of ['mora_chill','mora_freeze','mora_brittle','volt_shock','sharp','serial','heavy_head'])assert(C.canTakeCard(card(id),{}),id);
assert(!C.canTakeCard(card('explode_r'),{}));assert(C.canTakeCard(card('explode_r'),{explode:1}));
for(const unlock of C.ABILITY_CARDS){assert(C.canTakeCard(unlock,{}));assert(!C.canTakeCard(unlock,{[unlock.id]:1}));}
for(const owners of [ids,['pyro'],['volt'],['mora'],['archer','sniper']]){
  const pool=C.M0_POOL.filter(c=>c.owner==='global'||owners.includes(c.owner));
  for(let i=0;i<1000;i++){
    const draw=C.draw3(pool,{});assert.equal(draw.length,3);assert.equal(new Set(draw.map(c=>c.id)).size,3);
    for(const c of draw)assert(!c.req&&!c.reqAny);
  }
}
checks.push('5000 initial/refresh draws: three unique eligible cards; all skill/ultimate upgrades gated separately; prerequisites and caps preserved');
function director(owners){
  const d=Object.create(D.prototype);
  Object.assign(d,{heroes:owners.map(id=>new ProbeHero(id)),global:{xpMul:1,goldMul:1,lineRegenPct:0},stacks:{},state:'running',pickQueue:2,
    line:{healPct:noop,addMaxMul:noop},hud:{sync:noop},panels:{resetPickRefresh:noop,showPick(cards,stacks,opts){d.offers=cards;d.opts=opts;d.draws++;},closeAll(){d.closed++;}},draws:0,closed:0});
  return d;
}
const d=director(['mora','sniper']);d.openPick();assert.equal(d.state,'pick');
d.opts.onPick(card('mora_war'));assert.equal(d.pickQueue,2);assert(!d.stacks.mora_war);
d.opts.onPick(card('pyro_unlock_skill'));assert.equal(d.pickQueue,2);
d.opts.onPick(card('mora_unlock_skill'));assert(d.heroes[0].skillUnlocked);assert(!d.heroes[1].skillUnlocked);
assert.equal(d.state,'pick');assert.equal(d.pickQueue,1);assert.equal(d.draws,2);
for(let i=0;i<100;i++){d.requestRefresh();for(const c of d.offers)assert(C.canTakeCard(c,d.stacks));assert(d.offers.every(c=>c.owner==='global'||['mora','sniper'].includes(c.owner)));}
d.opts.onPick(card('sniper_unlock_ult'));assert.equal(d.pickQueue,0);assert.equal(d.state,'running');assert.equal(d.closed,1);
assert(!d.heroes[1].skillUnlocked&&d.heroes[1].ultUnlocked);assert.equal(d.heroes[1].charge,0);
d.opts.onPick(card('sniper_unlock_ult'));assert.equal(d.stacks.sniper_unlock_ult,1);
d.gmLearnCard('mora_war',5);assert(!d.stacks.mora_war);d.gmUltCharge(1000);assert.equal(d.heroes[0].charge,0);assert.equal(d.heroes[1].charge,60);
assert.equal(d.tryCastUlt(0),'locked');assert.equal(d.tryCastUlt(9),'locked');
d.gmLearnCard('mora_unlock_ult',5);assert.equal(d.stacks.mora_unlock_ult,1);assert.equal(d.heroes[0].charge,0);
d.gmLearnCard('mora_linger',5);assert.equal(d.stacks.mora_linger,3);assert.equal(d.heroes[0].stats.ultSlowDur,bases.mora().ultSlowDur+3);
checks.push('Director: rejects premature/undeployed upgrades; queued choices and refresh work; GM respects prerequisites/caps; unlock starts ultimate at zero');
const sniper=new ProbeHero('sniper');Object.assign(sniper,{autoT:-1,volley:null,ultLock:null,autoCasts:0,beginUltLock(){this.autoCasts++;}});sniper.stats.ultAutoCd=25;
H.SniperHero.prototype.updateQueues.call(sniper,30,{highestHp:()=>({})},{});assert.equal(sniper.autoCasts,0);
sniper.stats.ultUnlocked=true;H.SniperHero.prototype.updateQueues.call(sniper,30,{highestHp:()=>({})},{});assert.equal(sniper.autoCasts,1);
const volt=new ProbeHero('volt');Object.assign(volt,{lead:()=>({dirX:0,dirY:1}),spec:x=>x,procs:0,castChain(){this.procs++;}});volt.stats.skillProc=1;
H.VoltHero.prototype.shoot.call(volt,{}, {},{fire:noop});assert.equal(volt.procs,0);
volt.stats.skillUnlocked=true;H.VoltHero.prototype.shoot.call(volt,{}, {},{fire:noop});assert.equal(volt.procs,1);
checks.push('High-level sniper automatic ultimate and volt skill proc remain gated until learned');
const report={passed:true,checks};
const out=path.join(root,'docs/ability-unlock-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
