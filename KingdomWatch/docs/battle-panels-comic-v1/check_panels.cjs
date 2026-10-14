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
  const walk=n=>!n.activeInHierarchy||((!/^art:|^atlas:/.test(n.name)||!!n.getComponent(cc.Sprite)?.spriteFrame)&&n.children.every(walk));return walk(cc.director.getScene());
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
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const q=await compose(),p=q.page;
  for(const kind of ['win','lose','pause','pick','tip']){
    await mode(p,kind);await shot(p,kind);
    if(kind!=='tip')await panelLayout(p,'battle'+kind[0].toUpperCase()+kind.slice(1)+'Panel');
    if(kind==='win'||kind==='lose'||kind==='pause'){await click(p,'battleTab:1');checkDamage(await damageGeometry(p));await shot(p,kind+'-damage');}
    if(kind==='pause'){await click(p,'battleTab:2');await shot(p,'pause-settings');}
    if(kind==='tip')checkDamage(await damageGeometry(p));
  }
  if(process.env.KW_SMOKE){console.log(JSON.stringify({errors,failed}));await browser.close();return;}
  checks.push('All five comic overlays load; full party including frost hero; proportional bars and separate readable percentage/value columns');
  await mode(p,'pick');await click(p,'pickCard:mora_unlock_skill');assert((await state(p)).skill);assert.equal((await state(p)).state,'running');
  assert.equal((await state(p)).stacks.mora_unlock_skill,1);checks.push('Animated choice calls real director routing, learns frost skill once and resumes');
  await mode(p,'pick');let before=await data(p);await click(p,'pickDiamondRefresh');let after=await data(p);assert.equal(after.diamonds,before.diamonds-2);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')).diamonds),after.diamonds);
  await click(p,'pickDiamondRefresh');assert.equal((await data(p)).diamonds,after.diamonds);
  await click(p,'pickAdRefresh');await click(p,'pickAdRefresh');let s=await state(p);assert.equal(s.ads.filter(a=>a==='pick_refresh').length,1);
  const stackBefore=JSON.stringify(s.stacks);const cardName=await p.evaluate(()=>{
    const walk=n=>n.name.startsWith('pickCard:')&&n.activeInHierarchy?n.name:n.children.map(walk).find(Boolean);return walk(cc.director.getScene());
  });await click(p,cardName);assert.equal(JSON.stringify((await state(p)).stacks),stackBefore);
  await finishAd(p,false);await click(p,'pickAdRefresh');await finishAd(p,true);await click(p,'pickAdRefresh');assert.equal((await state(p)).ads.filter(a=>a==='pick_refresh').length,2);
  checks.push('Refresh: saved diamond cost once, ad loading blocks card/refresh clicks, failed ad retries without consuming quota, successful ad quota persists');
  await mode(p,'pause');await click(p,'battleTab:2');before=await data(p);await click(p,'battleToggle:music');assert.equal((await data(p)).music,!before.music);
  await click(p,'battleToggle:sfx');assert.equal((await data(p)).sfx,!before.sfx);await click(p,'battleSpeed');assert.equal(await p.evaluate(()=>__panelsQA.d.speed),1.5);
  await click(p,'battleTab:0');await click(p,'battleTab:2');assert((await labels(p,'battleToggle:music')).includes('开启'));
  await click(p,'battleResume');assert.equal((await state(p)).state,'running');assert(!(await has(p,'battlePausePanel')));
  checks.push('Pause settings persist through tabs and to save; speed cycles; resume calls real director without card unlocks');
  await mode(p,'win');before=await data(p);await click(p,'battleDouble');await click(p,'battleDouble');assert.equal((await state(p)).ads.filter(a=>a==='double').length,1);
  await click(p,'battleTab:1');await finishAd(p,true);after=await data(p);assert(after.gold>before.gold);
  await click(p,'battleTab:0');await click(p,'battleDouble');assert.equal((await state(p)).ads.filter(a=>a==='double').length,1);assert.equal((await data(p)).gold,after.gold);
  await shot(p,'win-doubled');await click(p,'battleNext');assert.deepEqual((await state(p)).loads,['Main']);
  checks.push('Victory actual reward and next-level callback; double request only once, claimed state survives tab changes, no second charge/reward');
  await mode(p,'lose');await click(p,'battleRevive');await click(p,'battleRevive');assert.equal((await state(p)).ads.filter(a=>a==='revive').length,1);
  await finishAd(p,false);assert((await labels(p,'battleRevive')).includes('重试广告复活'));await click(p,'battleRevive');await finishAd(p,true);
  assert.equal((await state(p)).state,'running');assert.equal(await p.evaluate(()=>__panelsQA.d.line.hp),300);assert(!(await has(p,'battleLosePanel')));
  await mode(p,'lose');await click(p,'battleRetry');assert((await state(p)).exits>0);
  checks.push('Defeat no duplicate revive requests, retry after no-fill, actual +30% durability revive/resume; retry callback retained');
  await mode(p,'tip');await click(p,'battleStatsTip');assert(await has(p,'battleStatsTip'));assert.equal((await state(p)).state,'running');await p.mouse.click(365,830);await sleep(160);assert(!(await has(p,'battleStatsTip')));
  await p.evaluate(()=>{
    const q=__panelsQA;q.tipRows=[{id:'mora',name:'莫拉·寒霜',val:1,pct:.0001},{id:'archer',name:'艾拉·风羽',val:9999,pct:.9999},{id:'pyro',name:'焰·辉',val:0,pct:0},{id:'volt',name:'沃尔·雷霆',val:0,pct:0}];
    q.d.dmgSvc.rows=()=>q.tipRows;q.panels.showStats(q.tipRows);
  });await loaded(p);checkDamage(await damageGeometry(p));await shot(p,'tip-tiny-zero');
  await p.evaluate(()=>__panelsQA.panels.showStats([]));await shot(p,'tip-empty');checks.push('Tips stay open when touched, outside touch closes without pause; 0%, 0.01% and empty stats remain accurate');
  await q.context.close();
  if(!process.env.KW_ONLINE_SMOKE){
    const poor=await compose(375,667,0);await mode(poor.page,'pick');const before=await data(poor.page);await click(poor.page,'pickDiamondRefresh');assert.deepEqual(await data(poor.page),before);await shot(poor.page,'pick-poor');await poor.context.close();checks.push('No diamond refresh charge with an empty wallet');
  }
  for(const [w,h] of (process.env.KW_ONLINE_SMOKE?[[375,600]]:[[375,667],[375,600]])){
    const small=await compose(w,h);for(const kind of ['win','lose','pause','pick','tip']){
      await mode(small.page,kind);await shot(small.page,kind+'-small-'+h);
      if(kind!=='tip')await panelLayout(small.page,'battle'+kind[0].toUpperCase()+kind.slice(1)+'Panel');
      if(['win','lose','pause'].includes(kind)){await click(small.page,'battleTab:1');checkDamage(await damageGeometry(small.page));await shot(small.page,kind+'-damage-small-'+h);}
      if(kind==='pause'){await click(small.page,'battleTab:2');await shot(small.page,'pause-settings-small-'+h);}
    }await small.context.close();checks.push('375×'+h+' all panels, stats and primary actions fit the viewport');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
  fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'ui-validation.json'),JSON.stringify({ok:true,url:URL,realBattleStarted:false,checks,errors,failed},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,errors:errors.length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
