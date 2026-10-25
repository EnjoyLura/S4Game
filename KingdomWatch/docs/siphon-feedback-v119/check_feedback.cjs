/* Pure damage arithmetic + targeting policy + isolated lettering control, never combat/game modules. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const root=path.resolve(__dirname,'../..'),hashes={},cases=[];
function read(file){const s=fs.readFileSync(path.join(root,file),'utf8');hashes[file]=crypto.createHash('sha256').update(s).digest('hex');return s;}
function tree(file){return ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);}
function member(file,owner,name){const ast=tree(file);const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text===owner);return cls.members.find(n=>n.name?.getText(ast)===name).getText(ast);}
function js(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;}
const policy={};vm.runInNewContext(js(read('assets/scripts/config/Targeting.ts')),{exports:policy});
const config={};vm.runInNewContext(js(read('assets/scripts/config/NewHeroConfig.ts')),{exports:config});
function test(name,run){const details=run();cases.push({name,passed:true,details});}
const g={x:0,y:30,hitY:30,dead:false,def:{}},air={x:0,y:30,hitY:100,dead:false,def:{airborne:true}};
test('Blocked messages distinguish incompatible targets, empty field, dead units and real range',()=>{
 assert.equal(policy.blockedTargetMessage([air],'ground',0,0,120),'无法对空');
 assert.equal(policy.blockedTargetMessage([g],'air',0,0,120),'无法对地');
 assert.equal(policy.blockedTargetMessage([g,air],'ground',0,0,120),null);
 assert.equal(policy.blockedTargetMessage([],'ground',0,0,120),null);
 assert.equal(policy.blockedTargetMessage([],'all',0,0,120,true),'暂无目标');
 assert.equal(policy.blockedTargetMessage([{...air,dead:true}],'ground',0,0,120),null);
 assert.equal(policy.blockedTargetMessage([air],'ground',0,0,99),null);
 assert.equal(policy.blockedTargetMessage([air],'all',0,0,99,true),'超出射程');
 assert.equal(policy.blockedTargetMessage([air],'all',0,0,100),null);
 return {boundaryInclusive:true,offscreenAutomaticQuiet:true};
});
const ast=tree('assets/scripts/battle/NewHeroes.ts');
const siphon=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='SiphonHero');
const shoot=siphon.members.find(n=>n.name?.getText(ast)==='shoot');
const decls=new Map();
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer)decls.set(n.name.text,n.initializer.getText(ast));ts.forEachChild(n,visit);}
visit(shoot);
const expression=vm.runInNewContext(js('(function(kind){const base='+decls.get('base')+';const normal='+decls.get('normal')+';const b={kind};return {primary:normal,side:'+decls.get('amount')+'};})'),{SIPHON:config.SIPHON,SC:config.SIPHON_CARDS_CFG,siphonSkillCfg:config.siphonSkillCfg});
const math=(stats,effAtk,ramp,kind)=>expression.call({stats,effAtk,ramp,abilityDamage:()=>200},kind);
test('Actual raw beam expressions preserve twin half-ratio during ramp and inherited ramp',()=>{
 const rows=[];
 for(const aspd of [.7,1,2])for(const ramp of [0,.1,.25,.5]){
  const r=math({aspd,normalMul:1.2,siphonTwin:.5,skillLv:1},64,ramp,'twin');
  assert(Math.abs(r.side/r.primary-.5)<1e-10);rows.push({aspd,ramp,main:r.primary,twin:r.side});
 }
 const start=rows.find(r=>r.aspd===1&&r.ramp===0),end=rows.find(r=>r.aspd===1&&r.ramp===.5);
 assert.equal(end.twin/start.twin,1.5);
 const relay=math({aspd:1,normalMul:1,siphonTwin:.5,skillLv:1},64,.5,'relay');
 assert.equal(relay.side/relay.primary,.25);
 return rows;
});
test('Hero hint cooldown shares one clock across slots and does not spend attacks or energy',()=>{
 const events=[],report=member('assets/scripts/battle/Hero.ts','HeroBase','reportBlockedTarget');
 const proto=vm.runInNewContext(js('({'+report+'})'),{blockedTargetMessage:policy.blockedTargetMessage,HERO_Y:0,EVT:{TARGET_BLOCKED:'target_blocked'},bus:{emit:(...a)=>events.push(a)}});
 const h={x:0,stats:{range:120,skillRange:120},charge:50,skillCd:0,targetHintCd:0,targetLayer:()=> 'ground'};
 proto.reportBlockedTarget.call(h,{list:[air]},'skill');assert.equal(events.length,1);assert.equal(h.targetHintCd,4);
 proto.reportBlockedTarget.call(h,{list:[air]},'atk');assert.equal(events.length,1);
 h.targetHintCd=0;proto.reportBlockedTarget.call(h,{list:[]},'ult',true);assert.equal(events.length,2);
 assert.equal(h.charge,50);assert.equal(h.skillCd,0);
 return {events,chargeUnchanged:true,cooldownUnchanged:true};
});
test('Notice uses body font and recycled numeric text returns to combat font, without importing rendering',()=>{
 const spawn=member('assets/scripts/battle/FloatText.ts','FloatText','spawn');
 const fonts=[],live=[],free=[],color={};
 const factory=()=>({kind:'normal',node:{active:false,setScale(){},setPosition(){}},label:{},opacity:{},age:0,life:0,baseX:0,baseY:0});
 const ctx={MAX_ACTIVE:30,MAX_PERIODIC:12,MERGE_WINDOW:.075,
 MOTION:{normal:{peak:1.2,life:.62,opacity:255},crit:{peak:1.4,life:.74,opacity:255},periodic:{peak:1.04,life:.42,opacity:220},heal:{peak:1.16,life:.9,opacity:255},notice:{peak:1.05,life:1.15,opacity:255}},
 applyFont:(label,role)=>fonts.push(role)};
 const proto=vm.runInNewContext(js('({'+spawn+'})'),ctx);
 const ui={live,pool:{get:()=>free.pop()||factory(),put:t=>free.push(t)},col:x=>x,measure:(t,s)=>t.length*s*.55+10,place:(ft,x,y)=>{ft.baseX=x;ft.baseY=y;return true;}};
 proto.spawn.call(ui,0,0,'无法对空','#F5D695',false,{notice:true});
 assert.equal(fonts.at(-1),'body');assert.equal(live[0].label.color,'#F5D695');assert.equal(live[0].label.fontSize,22);
 const previous=live.pop();free.push(previous);
 proto.spawn.call(ui,0,0,'100','#FFFFFF');
 assert.equal(fonts.at(-1),'combat');
 for(let i=0;i<8;i++)proto.spawn.call(ui,0,0,'无法对空','#F5D695',false,{notice:true});
 assert.equal(live.filter(t=>t.kind==='notice').length,4);
 return {fontSwitches:fonts,noticeCap:4,readableChinese:true};
});
test('Event lifetime and manual failure wiring are paired',()=>{
 const dir=read('assets/scripts/battle/BattleDirector.ts'),hud=read('assets/scripts/ui/HUD.ts');
 assert(dir.includes('bus.on(EVT.TARGET_BLOCKED, this.onTargetBlocked, this)'));
 assert(dir.includes('bus.off(EVT.TARGET_BLOCKED, this.onTargetBlocked, this)'));
 assert(dir.includes("h.reportBlockedTarget(this.mgr, 'ult', true); return 'no-target'"));
 assert(hud.includes("result === 'no-target'"));
 return {teardown:true,noFailureReleaseAnimation:true};
});
fs.writeFileSync(path.join(__dirname,'feedback-check.json'),JSON.stringify({passed:true,cases,sourceHashes:hashes,gameBrowserCombatAudioWasmExecuted:false,onlyActualArithmeticAndUiControlExtracted:true},null,2)+'\n');
console.log(JSON.stringify({passed:true,groups:cases.length,gameModulesExecuted:false}));

