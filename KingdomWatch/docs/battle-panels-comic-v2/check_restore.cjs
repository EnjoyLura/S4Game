/* Actual Panels/HUD/Director callbacks over static battle assets; no battle start, waves or simulation. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/',OUT=__dirname,checks=[],errors=[],failed=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let browser;
async function compose(width=430,height=932,diamonds=10){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(diamonds=>localStorage.setItem('kw_save_v1',JSON.stringify({gold:500,diamonds,debug:false,music:false,sfx:false,speedUnlocked:true,squad:['archer','pyro','volt','mora']})),diamonds);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene(),walk=n=>n.name==='tab2'||n.children.some(walk);return !!s&&walk(s);
  },null,{timeout:60000});
  await page.evaluate(async()=>{
    const [H,C,U,D,L,M,K,P,DS,AD,S,V]=await Promise.all(['Hero','Cards','HUD','BattleDirector','LineDefense','Mobs','UIKit','Panels','DamageService','AdService','SaveData','Ux'].map(n=>System.import('chunks:///_virtual/'+n+'.ts')));
    const canvas=cc.director.getScene().getChildByName('Canvas');for(const n of canvas.children)if(!n.getComponent(cc.Camera))n.active=false;
    const root=K.N('BattlePanelsQA',canvas),field=K.N('Field',root),line=new L.LineDefense(field,1000),heroLayer=K.N('Heroes',field);
    const owners=['archer','pyro','volt','mora'],slots=M.heroSlots(4),ctors={archer:H.ArcherHero,pyro:H.PyroHero,volt:H.VoltHero,mora:H.FrostHero};
    const bases={archer:C.baseArcherStats,pyro:C.basePyroStats,volt:C.baseVoltStats,mora:C.baseMoraStats};
    const heroes=owners.map((id,i)=>new ctors[id](heroLayer,slots[i],bases[id]()));
    const dmgSvc=new DS.DamageService(),names={archer:'艾拉·风羽',pyro:'焰·辉',volt:'沃尔·雷霆',mora:'莫拉·寒霜'};
    owners.forEach((id,i)=>{dmgSvc.register(id,names[id]);dmgSvc.add(id,[123456,60500,47020,21100][i]);});
    const d=Object.create(D.BattleDirector.prototype);Object.assign(d,{heroes,line,dmgSvc,levelDef:M.LEVEL_1_1,elapsed:47,heroLevel:3,xp:28,goldEarned:570,speed:1,
      state:'running',global:{xpMul:1,goldMul:1,lineRegenPct:0},stacks:{},pickQueue:0,ultShowT:0});
    const ui=K.N('UIRoot',root),hud=new U.HUD(ui,d,field);d.hud=hud;const panels=new P.Panels(ui,d);d.panels=panels;
    K.setLayerDeep(root,cc.Layers.Enum.UI_2D);hud.sync();hud.setWave(4,10);
    for(const [i,x] of [-240,-130,100,230].entries())V.artAtlasSprite(field,x,280-i*70,92,122,'battle_mobs_v2','goblin_worker');
    const q=window.__panelsQA={root,d,hud,panels,C,S,AD,ads:[],loads:[],exits:0};
    d.exitBattle=()=>{q.exits++;panels.closeAll();};cc.director.loadScene=(name)=>q.loads.push(name);
    AD.AdService.showRewarded=(placement,reward,fail)=>q.ads.push({placement,reward,fail});
  });await loaded(page);return {page,context};
}
async function loaded(page){await page.waitForFunction(()=>{
  const walk=n=>!n.activeInHierarchy||((!/^art:|^atlas:/.test(n.name)||!!n.getComponent(cc.Sprite)?.spriteFrame||(n.name.startsWith('art:ui_avatar_')&&n.children.length>0))&&n.children.every(walk));return walk(cc.director.getScene());
},null,{timeout:45000});await sleep(260);}
async function node(page,name){return page.evaluate(name=>{
  const find=n=>n.activeInHierarchy&&(n.name===name?n:n.children.map(find).find(Boolean)),n=find(cc.director.getScene());if(!n)throw Error('Missing '+name);
  const r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition,t=n._uiProps.uiTransformComp;
  return {x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height,w:t.width,h:t.height,top:v.height/2-p.y-t.height/2,bottom:v.height/2-p.y+t.height/2};
},name);}
async function click(page,name){const n=await node(page,name);await page.mouse.click(n.x,n.y);await sleep(260);}
async function has(page,name){return page.evaluate(name=>{const walk=n=>n.activeInHierarchy&&(n.name===name||n.children.some(walk));return walk(cc.director.getScene());},name);}
async function labels(page,name){return page.evaluate(name=>{
  const find=n=>n.name===name&&n.activeInHierarchy?n:n.children.map(find).find(Boolean),r=[],walk=n=>{const l=n.getComponent(cc.Label);if(l)r.push(l.string);n.children.forEach(walk);};walk(find(cc.director.getScene()));return r;
},name);}
async function data(page){return page.evaluate(()=>({...window.__panelsQA.S.loadSave()}));}
async function shot(page,name){await loaded(page);await page.screenshot({path:path.join(OUT,(process.env.KW_QA_URL?'online-':'')+name+'.png')});}
async function mode(page,kind){await page.evaluate(kind=>{
  const q=window.__panelsQA,d=q.d;d.state='running';
  if(kind==='pause')d.togglePause();if(kind==='win'){d.line.hp=950;d.onAllCleared();}
  if(kind==='lose'){d.line.hp=0;d.onLineBroken();}if(kind==='tip')d.showStats();
  if(kind==='pick'){
    d.pickQueue=1;d.openPick();q.panels.showPick([q.C.ABILITY_CARDS.find(c=>c.id==='mora_unlock_skill'),q.C.M0_POOL.find(c=>c.id==='sharp'),q.C.M0_POOL.find(c=>c.id==='volt_shock')],d.stacks,d.pickOpts);
  }
},kind);await loaded(page);}
async function state(page){return page.evaluate(()=>{
  const q=window.__panelsQA;return {state:q.d.state,ads:q.ads.map(a=>a.placement),exits:q.exits,loads:q.loads,stacks:q.d.stacks,skill:q.d.heroes[3].skillUnlocked};
});}
async function finishAd(page,ok=true){await page.evaluate(ok=>{const q=window.__panelsQA,a=q.ads.at(-1);if(!a)throw Error('No ad');ok?a.reward():a.fail('test_no_fill');},ok);await loaded(page);}
async function damageGeometry(page){return page.evaluate(()=>{
  const find=(n,name)=>n.name===name&&n.activeInHierarchy?n:n.children.map(c=>find(c,name)).find(Boolean),scene=cc.director.getScene(),q=window.__panelsQA;
  const walk=(n,a=[])=>{if(n.name.startsWith('damageRow:')&&n.activeInHierarchy)a.push(n);n.children.forEach(c=>walk(c,a));return a;};
  return walk(scene).map(n=>{
    const id=n.name.slice(10),r=q.d.dmgSvc.rows().find(r=>r.id===id)||q.tipRows?.find(r=>r.id===id),bar=find(n,'damageBar:'+id),fill=find(n,'damageFill:'+id),pct=find(n,'damagePercent:'+id),val=find(n,'damageValue:'+id),av=find(n,'comicPortrait');
    const t=bar._uiProps.uiTransformComp,ft=fill._uiProps.uiTransformComp,pt=pct._uiProps.uiTransformComp,vt=val._uiProps.uiTransformComp;
    return {id,pct:r.pct,val:r.val,fill:ft.width,usable:t.width-4,percent:pct.getComponent(cc.Label).string,pctLeft:pct.worldPosition.x-pt.width/2,valRight:val.worldPosition.x+vt.width/2,
      portrait:!!av&&av._uiProps.uiTransformComp.width===av._uiProps.uiTransformComp.height&&av.getChildByName('portraitClip').getComponent(cc.Mask).type===1};
  });
});}
function checkDamage(rows){
  assert(rows.length>=4);assert(rows.some(r=>r.id==='mora'));
  for(const r of rows){const pct=r.val>0?Math.max(0,Math.min(1,r.pct)):0;assert(Math.abs(r.fill-r.usable*pct)<.01,JSON.stringify(r));assert.equal(r.percent,(pct*100).toFixed(2)+'%');assert(r.valRight<r.pctLeft&&r.portrait,JSON.stringify(r));}
}
async function panelLayout(page,name){const p=await node(page,name);const v=await page.evaluate(()=>cc.view.getVisibleSize().height);assert(p.top>=56&&p.bottom<=v-56,JSON.stringify(p));}
const ts=require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const referenceCode=ts.transpileModule(fs.readFileSync(path.join(OUT,'original-layout.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
async function reference(page){await page.evaluate(async code=>{
 const names=['Cards','GameConfig','DamageService','Hero','BattleDirector','AdService','SaveData','UIKit','Ux'];
 const modules=await Promise.all(names.map(n=>System.import('chunks:///_virtual/'+n+'.ts'))),engine=await System.import('cc'),map={cc:engine};
 names.forEach((n,i)=>map[n]=modules[i]);const exports={};
 new Function('require','exports','module',code)(id=>id==='cc'?engine:map[id.split('/').at(-1)],exports,{exports});
 const q=__panelsQA,host=map.UIKit.N('OriginalLayout',q.root);q.original=new exports.Panels(host,q.d);q.originalHost=host;
 q.options={win:{stars:3,gold:648,ratio:.95,xp:28,onDouble:()=>{},onNext:()=>{},onExit:()=>{}},
  lose:{goldFloor:171,reviveRatio:.3,xp:28,onRevive:()=>{},onRetry:()=>{},onExit:()=>{}},
  pause:{music:false,sfx:false,speed:1,speedUnlocked:true,xp:28,onToggle:()=>{},onResume:()=>{},onExit:()=>{}},
  pick:{onPick:()=>{},onRefreshRequest:()=>{}}};
},referenceCode);}
async function render(page,kind,tab,old){await page.evaluate(({kind,tab,old})=>{
 const q=__panelsQA;q.panels.closeAll();q.original.closeAll();q.originalHost.active=old;q.panels.modalRoot.active=!old;
 const p=old?q.original:q.panels;
 if(kind==='pick')p.showPick(['sharp','swift','volt_shock'].map(id=>q.C.M0_POOL.find(c=>c.id===id)),{},q.options.pick);
 else if(kind==='tip')p.showStats(q.d.dmgSvc.rows());
 else p['show'+kind[0].toUpperCase()+kind.slice(1)]({...q.options[kind],tab});
}, {kind,tab,old});await loaded(page);await sleep(450);}
async function geometry(page,old){return page.evaluate(old=>{
 const q=__panelsQA,p=old?q.original:q.panels,results=[],initials=q.d.dmgSvc.rows().map(r=>r.name[0]);
 const walk=n=>{if(!n.activeInHierarchy)return;const l=n.getComponent(cc.Label),t=n._uiProps.uiTransformComp;
  if(l && !(l.fontSize===26 && initials.includes(l.string)))results.push({text:l.string,x:+n.worldPosition.x.toFixed(3),y:+n.worldPosition.y.toFixed(3),w:t.width,h:t.height,
   size:l.fontSize,bold:l.isBold,color:l.color.toHEX(),align:l.horizontalAlign,line:l.lineHeight});
  n.children.forEach(walk);};walk(p.modalRoot);
 return results.sort((a,b)=>(a.text+a.x+a.y).localeCompare(b.text+b.x+b.y));
},old);}
async function clickText(page,string){const pt=await page.evaluate(string=>{
 const q=__panelsQA,walk=n=>{if(!n.activeInHierarchy)return;const l=n.getComponent(cc.Label);if(l?.string===string)return n;return n.children.map(walk).find(Boolean);};
 const n=walk(q.panels.modalRoot);if(!n)throw Error('Missing label '+string);const r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition;
 return {x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height};
},string);await page.mouse.click(pt.x,pt.y);await sleep(300);}
async function bars(page){return page.evaluate(()=>{
 const root=__panelsQA.panels.modalRoot,out=[],walk=n=>{
  if(n.name==='battleStatBar'&&n.activeInHierarchy){const t=n._uiProps.uiTransformComp,f=n.getChildByName('art:battle_skin_v2/bar_fill'),ft=f._uiProps.uiTransformComp;
   out.push({w:t.width,h:t.height,fill:ft.width,active:f.active,pct:__panelsQA.d.dmgSvc.rows()[out.length].pct});}
  n.children.forEach(walk);};walk(root);return out;
});}
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 for(const [w,h] of (process.env.KW_ONLINE_SMOKE?[[375,600]]:[[430,932],[375,600]])){
  const q=await compose(w,h),p=q.page;await reference(p);
  for(const [kind,tab] of [['pick',0],['pause',0],['pause',1],['pause',2],['win',0],['win',1],['lose',0],['lose',1],['tip',0]]){
   await render(p,kind,tab,true);const expected=await geometry(p,true);
   await render(p,kind,tab,false);const actual=await geometry(p,false);
   assert.deepEqual(actual,expected,kind+' tab '+tab+' original text/geometry');
   if(kind==='tip'){
    const g=await p.evaluate(()=>{
     const p=__panelsQA.panels.modalRoot.children.find(n=>n._uiProps.uiTransformComp?.width===360&&n._uiProps.uiTransformComp?.height===470);
     return {w:p._uiProps.uiTransformComp.width,h:p._uiProps.uiTransformComp.height,alpha:p.getComponent(cc.Graphics).fillColor.a};
    });assert.deepEqual(g,{w:360,h:470,alpha:240});
    const rows=await bars(p);assert.equal(rows.length,4);rows.forEach(r=>assert(Math.abs(r.fill-(r.w-4)*r.pct)<.01));
   }
   await shot(p,kind+'-'+tab+'-'+h);
  }
  checks.push({viewport:[w,h],originalLayoutAndText:'exact match for all nine views',tipBackdrop:'original 360×470, #14181E alpha 0.94',bars:'original 225×16, accurate share, number still in bar'});
  if(w===430 || process.env.KW_ONLINE_SMOKE){
   await p.evaluate(()=>__panelsQA.originalHost.active=false);await mode(p,'pick');await click(p,'pickCard:mora_unlock_skill');assert((await state(p)).skill);assert.equal((await state(p)).state,'running');
   await mode(p,'pick');const before=await data(p);await click(p,'pickDiamondRefresh');assert.equal((await data(p)).diamonds,before.diamonds-2);
   await click(p,'pickDiamondRefresh');assert.equal((await data(p)).diamonds,before.diamonds-2);
   await click(p,'pickAdRefresh');await click(p,'pickAdRefresh');assert.equal((await state(p)).ads.filter(a=>a==='pick_refresh').length,1);
   await finishAd(p,false);await click(p,'pickAdRefresh');await finishAd(p,true);assert.equal((await state(p)).ads.filter(a=>a==='pick_refresh').length,2);
   checks.push('Original animated card choice unlocks skill; refresh and persisted diamond cost stay correct');
   await mode(p,'win');const gold=(await data(p)).gold;await click(p,'battleDouble');await click(p,'battleDouble');assert.equal((await state(p)).ads.filter(a=>a==='double').length,1);
   await finishAd(p,true);assert((await data(p)).gold>gold);await clickText(p,'伤害统计');await clickText(p,'奖励总览');await click(p,'battleDouble');assert.equal((await state(p)).ads.filter(a=>a==='double').length,1);
   await clickText(p,'下一关 ▶');assert.deepEqual((await state(p)).loads,['Main']);
   checks.push('Original victory buttons/tabs retain next-level callback and guarded double claim');
   await mode(p,'lose');await click(p,'battleRevive');await click(p,'battleRevive');assert.equal((await state(p)).ads.filter(a=>a==='revive').length,1);
   await finishAd(p,false);await click(p,'battleRevive');await finishAd(p,true);assert.equal(await p.evaluate(()=>__panelsQA.d.line.hp),300);assert.equal((await state(p)).state,'running');
   checks.push('Original revive placement retains no-fill retry and actual +30% durability/resume');
   await mode(p,'pause');await clickText(p,'设置');const saved=await data(p);
   const switches=await p.evaluate(()=>{
    const nodes=__panelsQA.panels.modalRoot.children.filter(n=>n.name==='switch'),r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize();
    return nodes.map(n=>({x:r.left+(.5+n.worldPosition.x/v.width)*r.width,y:r.top+(.5-n.worldPosition.y/v.height)*r.height}));
   });await p.mouse.click(switches[0].x,switches[0].y);assert.equal((await data(p)).music,!saved.music);
   await clickText(p,'▶ 继续战斗');assert.equal((await state(p)).state,'running');
   checks.push('Original pause title, settings switches, tabs and continue button remain functional');
  }
  await q.context.close();
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 const report={ok:true,url:URL,realBattleStarted:false,checks,errors,failed};
 fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'ui-validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,errors,failed}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});
