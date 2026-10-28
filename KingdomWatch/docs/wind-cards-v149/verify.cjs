// Isolated data, geometry and controlled callbacks only: never loads Cocos, a scene, audio or a real battle.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/^\uFEFF/,''),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
let checks=0;const ok=(a,msg)=>{assert.ok(a,msg);checks++;};
function run(source,globals={}){const result=ts.transpileModule(source,{compilerOptions:{module:1,target:7},reportDiagnostics:true});assert.equal(result.diagnostics.length,0);
 const c={exports:{},Math,Number,Map,Set,WeakMap,...globals};vm.runInNewContext(result.outputText,c);return c.exports;}
function isolated(file,imports={}){return run(read(file),{require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied import '+n);return imports[n];}});}
const game={DESIGN_W:750,HERO_Y:-545,LINE_Y:-513,LO:{half:667,notchTop:0},MAX_PROJS:500,PAL:{white:'#fff',blue:'#88f',purple:'#a5f',gold:'#fc6'}};
const cache=new Map();function config(name){if(cache.has(name))return cache.get(name);const result=run(read('assets/scripts/config/'+name+'.ts'),{require:n=>{
 if(n==='./GameConfig')return game;ok(/^\.\/[A-Za-z]+$/.test(n),'pure config import');return config(n.slice(2));}});cache.set(name,result);return result;}
const cards=config('Cards'),cfg=config('WindNinjaConfig'),aura=isolated('assets/scripts/battle/WindEyeAura.ts');
const selected=cards.WIND_CARDS.filter(c=>c.offerGroup==='combat');assert.equal(selected.length,13);assert.equal(cards.WIND_CARDS.length,17);
const ids=['wide','pierce','mark','eye_radius','eye_duration','eye_slow','eye_shred','eye_move','ult_radius','ult_duration','ult_pulse','ult_blades','ult_twin'].map(n=>'wind_'+n);
assert.equal(JSON.stringify(selected.map(c=>c.id).sort()),JSON.stringify(ids.sort()));
const stacks={wind_unlock_skill:1,wind_unlock_ult:1},max=cards.baseWindStats();
for(const card of selected){ok(cards.M0_POOL.includes(card)&&cards.isMechanicCard(card)&&card.art.startsWith('ui_icon_'),'pool / art / mechanic');
 for(let i=0;i<card.maxStacks;i++){ok(cards.canTakeCard(card,stacks));card.apply({hero:max});stacks[card.id]=(stacks[card.id]||0)+1;}ok(!cards.canTakeCard(card,stacks),'stack ceiling');}
const basic=cards.baseWindStats(),bn=cfg.windNormalCfg(basic),mn=cfg.windNormalCfg(max),ms=cfg.windSkillCfg(10,max),mu=cfg.windUltCfg(10,max);
near(bn.halfLength,30);near(mn.halfLength,45);near(mn.size,15);near(mn.forwardOffset,13.5);assert.equal(mn.pierce,4);
near(ms.radius,231);near(ms.duration,7);near(ms.slowSeconds,4);near(ms.moveSpeed,36);near(ms.shred,.3);
near(mu.radius,120*1.15*1.4*.85);near(mu.duration,9);near(mu.interval,.3);near(mu.damageScale,.65);assert.equal(mu.count,2);
for(let n=1;n<=3;n++)near(cfg.windSkillCfg(1,{windEyeSlow:n}).slowSeconds,n+1);
for(const lv of [1,5,10,15,20]){const b=cfg.windSkillCfg(lv),u=cfg.windUltCfg(lv);near(b.duration,4+(lv>=10?1:0));near(u.duration,5+(lv>=10?1:0));near(u.interval,.4);}
class Node{static EventType={NODE_DESTROYED:'destroy'};constructor(){this.isValid=this.activeInHierarchy=true;this.handlers=[];this.parent={parent:{}};}once(e,f){this.handlers.push(f);}destroy(){this.isValid=false;this.handlers.forEach(f=>f());}}
class Base {constructor(parent,x,stats){this.node=new Node();this.x=x;this.stats=stats;this.charge=70;}
 get effAtk(){return this.stats.atk*this.stats.atkMul;}get ultReady(){return this.charge>0;}abilityDamage(m,u){return cards.abilityDamage(this.stats,m,u);}
 targetBonuses(){return {};}beginSkillCooldown(){this.cooldowns=(this.cooldowns||0)+1;}beginUltimate(n){this.ultSeconds=n;}ultimateBeat(){}animateAttack(){}
 selectNormalTarget(m){return m.list.find(x=>!x.dead);} }
class FX{tick(){}release(){}begin(){}end(){}area(){}destroy(){}}
const geom=isolated('assets/scripts/battle/WindNinjaGeometry.ts'),motion=isolated('assets/scripts/battle/WindFieldMotion.ts',{'./WindNinjaGeometry':geom});
const magicPlans=isolated('assets/scripts/battle/MagicBowPlans.ts',{'../config/MagicBowConfig':config('MagicBowConfig')});
const timing=isolated('assets/scripts/battle/UltimateTiming.ts',{'./MagicBowPlans':magicPlans,'../config/NewHeroConfig':config('NewHeroConfig')});
const heroes=isolated('assets/scripts/battle/WindNinjaHeroes.ts',{'cc':{Node,Graphics:class{}},'./Hero':{HeroBase:Base},'../config/GameConfig':game,
 '../config/WindNinjaConfig':cfg,'./WindEyeAura':aura,'./UltimateTiming':timing,'../core/Sfx':{Sfx:{shoot(){},cast(){}}},'../ui/Ux':{artSprite(){}},
 '../ui/UIKit':{CA(){},N(){}},'./WindNinjaVFX':{WindNinjaVFX:FX},'./WindNinjaGeometry':geom,'./WindFieldMotion':motion});
function mob(x=0,y=0){return {x,hitY:y,groundY:y,dead:false,node:{isValid:true,activeInHierarchy:true},lifeId:1,hp:10000,maxHp:10000,def:{speed:0,radius:10},state:'move',
 slowT:0,immobilized:false,lastDamageTaken:0,hits:[],slows:[],pulls:[],takeDamage(n){this.hits.push(n);this.lastDamageTaken=n;return false;},applySlow(...v){this.slows.push(v);},pullToward(...v){this.pulls.push(v);},applyWindMark(){this.marked=(this.marked||0)+1;}};}
function hero(stats=basic){return new heroes.WindHero({},0,{...stats,critRate:0});}
function projectiles(){return {hasCapacity:true,shots:[],fire(s){this.shots.push(s);return true;}};}
const ordinary=hero(),enhanced=hero(max),target=mob(0,100),mg={list:[target]},pr=projectiles();
const normal=enhanced.normalSpec(0,-400,0,1);near(normal.lineHalfLength,45);near(normal.size,15);assert.equal(normal.pierce,4);normal.onContact(target);assert.equal(target.marked,1);
ok(!ordinary.normalSpec(0,0,0,1).onContact);ok(enhanced.releaseNormal(target,mg,pr,0));
// Live aura: overlapping eyes use the strongest value, and moved/expired/delayed sources cannot leave residual shred.
const owner={},owner2={},registry={},region={kind:'eye',x:0,y:0,radius:100,age:0,duration:4,delay:0};
aura.registerWindEyes(registry,owner,[region],()=>.3);aura.registerWindEyes(registry,owner2,[region],()=>.3);
near(aura.windEyeShredAt(registry,0,0),.3);near(aura.windEyeShredAt(registry,101,0),0);region.y=200;near(aura.windEyeShredAt(registry,0,0),0);
region.age=4;near(aura.windEyeShredAt(registry,0,200),0);region.age=0;region.delay=.5;near(aura.windEyeShredAt(registry,0,200),0);
region.delay=0;aura.removeWindEyes(registry,owner);near(aura.windEyeShredAt(registry,0,200),.3);aura.removeWindEyes(registry);near(aura.windEyeShredAt(registry,0,200),0);
const wind=hero({...basic,windEyeMove:true,windEyeShred:true,windEyeSlow:1}),body=mob(),outside=mob(360,0),mgr={list:[body,outside]};wind.castSkill(mgr);
const field=wind.areas[0],start={x:field.x,y:field.y};near(aura.windEyeShredAt(mgr,start.x,start.y),.3);
wind.updateQueues(2,mgr,projectiles());near(field.y,start.y+72);body.hitY=field.y+72;
wind.updateQueues(2,mgr,projectiles());near(field.y,start.y+144);assert.equal(wind.areas.length,0);near(body.slows.at(-1)[0],.4);near(body.slows.at(-1)[1],2);assert.equal(outside.slows.length,0);
ok(body.pulls.every(v=>v[3]===true),'moving eye never pulls toward keep');near(aura.windEyeShredAt(mgr,field.x,field.y),0);
wind.node.destroy();near(aura.windEyeShredAt(mgr,field.x,field.y),0);
const late=hero({...basic,windEyeSlow:3}),lateMob=mob(),lateMgr={list:[lateMob]};late.castSkill(lateMgr);late.updateQueues(5,lateMgr,projectiles());near(lateMob.slows.at(-1)[1],3);
// Actual scheduling boundaries: compare catch-up callback with 60 small steps, including simultaneous pulse/breath events.
function schedule(step,stats){const h=hero(stats),m=mob(),mgr={list:[m]},p=projectiles();h.castUlt(mgr,p,{add(){}});const duration=h.ultSeconds;
 for(let t=0;t<duration-1e-8;){const dt=Math.min(step,duration-t);h.updateQueues(dt,mgr,p);t+=dt;}return {h,m,p};}
const single=schedule(10,{...basic,windUltPulse:true,windUltBlades:true}),fine=schedule(1/60,{...basic,windUltPulse:true,windUltBlades:true});
assert.equal(single.m.hits.length,16);assert.equal(fine.m.hits.length,16);assert.equal(single.p.shots.length,12);assert.equal(fine.p.shots.length,12);
near(single.m.hits[0],ordinary.abilityDamage(cfg.windUltCfg(1).mul,true));
for(const shot of single.p.shots){ok(shot.dirY>0&&shot.noKillCharge&&shot.ability&&shot.ult&&!shot.onContact&&!shot.split,'safe secondary');near(shot.dmg,basic.atk*basic.normalMul*.4);}
const twins=hero(max),twinMgr={list:[mob(-230,200),mob(230,200)]};ok(twins.castUlt(twinMgr,projectiles(),{add(){}}));
assert.equal(twins.areas.length,2);ok(Math.abs(twins.areas[0].x-twins.areas[1].x)>100,'distinct enemy clusters');
const initial=twins.areas.map(a=>a.y);twins.updateQueues(.8,twinMgr,projectiles());twins.areas.forEach((a,i)=>{ok(a.y>=initial[i]);near(a.damageScale,.65);});
const capped=hero(max);for(let i=0;i<7;i++)capped.addArea('eye',{x:0,y:0},10,1,.5,1,0);ok(!capped.castUlt(twinMgr,projectiles(),{add(){}}));assert.equal(capped.charge,70);
// Extract only relevant methods; no actor constructor, scene, tick loop, audio or Cocos import.
function ast(file){return ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);}
function member(file,name){let found;const visit=n=>{if(!found&&(ts.isMethodDeclaration(n)||ts.isGetAccessor(n))&&n.name?.getText()===name)found=n;ts.forEachChild(n,visit);};visit(ast(file));assert.ok(found,name);return found.getText();}
function method(file,name,globals={}){return run(`class Harness {${member(file,name)}};exports.f=Harness.prototype.${name};`,globals).f;}
function getter(file,name,globals={}){return run(`class Harness {${member(file,name)}};exports.f=Object.getOwnPropertyDescriptor(Harness.prototype,'${name}').get;`,globals).f;}
const monster='assets/scripts/battle/Monster.ts',traits='assets/scripts/battle/MonsterTraits.ts';
const mark=method(monster,'applyWindMark'),takeDamage=method(monster,'takeDamage',{Sfx:{impact(){}},damageKindFor:id=>id==='archer'?'physical':'magic'});
const status={hp:10000,dead:false,x:0,hitY:0,def:{radius:10},windMarkT:0,windMarkAge:0,vulnT:0,hunterMarkT:0,shockT:0,
 traits:{physicalResistance:0,magicResistance:0,incomingDamage:n=>n,recordHit(){}},ctx:{dmgNumber(){}},flash(){}};
takeDamage.call(status,100,false,'archer');near(status.lastDamageTaken,100);mark.call(status);near(status.windMarkT,2);
for(const id of ['archer','wind','pyro','burn']){takeDamage.call(status,100,false,id);near(status.lastDamageTaken,120);}
status.windMarkT=.1;mark.call(status);near(status.windMarkT,2);status.vulnT=10;status.vulnAmp=.3;takeDamage.call(status,100,false,'wind');near(status.lastDamageTaken,130);
status.vulnT=0;status.windMarkT=0;takeDamage.call(status,100,false,'archer');near(status.lastDamageTaken,100);
status.dead=true;mark.call(status);near(status.windMarkT,0);
const resisted={owner:{def:{physRes:.5,magicRes:.4},physicalShred:0,magicShred:0,windEyeShred:.3}};
near(getter(traits,'physicalResistance').call(resisted),.2);near(getter(traits,'magicResistance').call(resisted),.1);
resisted.owner.windEyeShred=0;near(getter(traits,'physicalResistance').call(resisted),.5);resisted.owner.windEyeShred=.7;near(getter(traits,'physicalResistance').call(resisted),0);
const kill=method('assets/scripts/battle/BattleDirector.ts','onMobKilled',{DIFFICULTIES:{normal:{goldMul:1}},SHARED_KILL_CHARGE:1});
const rewards={isEndless:false,state:'running',goldEarned:0,global:{goldMul:1,xpMul:1},levelDef:{difficulty:'normal'},loot:{onKill(){rewards.lootCount++;}},
 heroes:[{stats:{},chargeKill(n){rewards.charge+=n;}}],killBeatCooldown:1,lootCount:0,charge:0,xp:0,gainXp(n){this.xp+=n;}};
kill.call(rewards,{gold:5,exp:7,charge:3},'wind',{x:0,y:0,noKillCharge:true});near(rewards.charge,0);near(rewards.xp,7);near(rewards.goldEarned,5);near(rewards.lootCount,1);
kill.call(rewards,{gold:5,exp:7,charge:3},'wind',{x:0,y:0});near(rewards.charge,3);
// Monster pool cleanup and the projectile's post-contact-only mark bridge.
ok(member(monster,'init').includes('this.windMarkT = this.windMarkAge = 0'));ok(member(monster,'die').includes('this.windMarkT=this.windMarkAge=0'));
ok(member('assets/scripts/battle/Projectile.ts','hitMob').includes('!!sp.noKillCharge'));
ok(member(monster,'tick').includes('this.windMarkT=Math.max(0,this.windMarkT-dt)'));
const old=cp.execFileSync('git',['show','c2c416ac:KingdomWatch/assets/scripts/battle/WindNinjaHeroes.ts'],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/g,'\n');
assert.equal(read('assets/scripts/battle/WindNinjaHeroes.ts').replace(/\r\n/g,'\n').split('interface AttachedShuriken')[1],old.split('interface AttachedShuriken')[1]);
for(const file of ['ThunderLanceHero.ts','ScytheHero.ts','MagicBowHero.ts','SpaceSwordHeroes.ts']){
 const prior=cp.execFileSync('git',['show','c2c416ac:KingdomWatch/assets/scripts/battle/'+file],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(read('assets/scripts/battle/'+file).replace(/\r\n/g,'\n'),prior);}
const result={status:'PASS',cards:13,totalWindCards:17,checks,levels:[1,5,10,15,20],slowDurations:[2,3,4],
 pulseHits:single.m.hits.length,breathBlades:single.p.shots.length,largeAndSmallStepsAgree:true,liveAuraExitExpiryAndOverlap:true,
 markTeamDamageAndIndependentExpiry:true,secondaryNoChargeKeepsGoldXpLoot:true,twinClusterAndCapacity:true,ninjaAndOtherHeroesPreserved:true,
 gameEngineRealBattleBrowserAudioOrWasmStarted:false};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'cards.json'),JSON.stringify(selected.map(({apply,...c})=>c),null,2)+'\n');console.log(JSON.stringify(result));
