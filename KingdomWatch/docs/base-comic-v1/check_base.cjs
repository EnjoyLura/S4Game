/** Disposable browser saves; only lobby pages, construction and codex are inspected. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/',OUT=__dirname;
const MOBS=['goblin_worker','goblin_slinger','goblin_shaman','wolf_rider','goblin_brute','goblin_king'];
const checks=[],errors=[],failures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let browser;
function save(mode='full'){
  const heroes={};for(const id of ['archer','sniper','pyro','volt','mora'])heroes[id]={owned:true,lv:1,weaponLv:1,atkLv:1,skillLv:1,ultLv:1,worn:{}};
  return {gold:mode==='poor'?0:500000,diamonds:2411,heroes,equips:[],bag:{},keepLv:mode==='max'?10:2,
    codex:mode==='empty'?[]:mode==='partial'?MOBS.slice(0,1):MOBS,codexRewards:mode==='claimed'?MOBS:[],
    squad:['archer'],curHero:'archer',unlocked:'1-3',stars:{},debug:false,music:false,sfx:false};
}
async function has(page,name){return page.evaluate(name=>{const walk=n=>n.activeInHierarchy&&(n.name===name||n.children.some(walk));return walk(cc.director.getScene());},name);}
async function node(page,name){return page.evaluate(name=>{
  const find=n=>n.activeInHierarchy&&(n.name===name?n:n.children.map(find).find(Boolean)),n=find(cc.director.getScene());if(!n)throw Error('Missing '+name);
  const t=n._uiProps.uiTransformComp,r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition;
  return {x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height,w:t?.width,h:t?.height};
},name);}
async function click(page,name){const p=await node(page,name);await page.mouse.click(p.x,p.y);await sleep(220);}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));}
async function labels(page,name){return page.evaluate(name=>{
  const find=n=>n.name===name?n:n.children.map(find).find(Boolean),r=[],walk=n=>{const l=n.getComponent(cc.Label);if(l)r.push(l.string);n.children.forEach(walk);};const n=find(cc.director.getScene());if(!n)throw Error('Missing '+name);walk(n);return r;
},name);}
async function loaded(page){await page.waitForFunction(()=>{
  const walk=n=>!n.activeInHierarchy||((!/^art:|^atlas:/.test(n.name)||!!n.getComponent(cc.Sprite)?.spriteFrame)&&n.children.every(walk));return walk(cc.director.getScene());
},null,{timeout:45000});await sleep(250);}
async function screenshot(page,file){await loaded(page);await page.screenshot({path:path.join(OUT,(process.env.KW_QA_URL?'online-':'')+file+'.png')});}
async function open(mode='full',width=430,height=932){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(s=>localStorage.setItem('kw_save_v1',JSON.stringify(s)),save(mode));const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene(),walk=n=>n.name==='tab4'||n.children.some(walk);return !!s&&walk(s);
  },null,{timeout:60000});await click(page,'tab4');await loaded(page);return {page,context};
}
async function scroll(page,name,y){await page.evaluate(({name,y})=>{
  const find=n=>n.name===name?n:n.children.map(find).find(Boolean),n=find(cc.director.getScene());n.getComponent(cc.ScrollView).scrollToOffset({x:0,y},0);n.emit('scrolling');
},{name,y});await sleep(180);}
async function offset(page,name){return page.evaluate(name=>{
  const find=n=>n.name===name?n:n.children.map(find).find(Boolean);return find(cc.director.getScene()).getComponent(cc.ScrollView).getScrollOffset().y;
},name);}
async function dimCount(page){return page.evaluate(()=>{
  let r=0;const walk=n=>{if(n.activeInHierarchy&&n.name==='comicModal')r++;n.children.forEach(walk);};walk(cc.director.getScene());return r;
});}
async function geometry(page){return page.evaluate(()=>{
  const s=cc.director.getScene(),v=cc.view.getVisibleSize(),find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean);
  const box=name=>{const n=find(s,name),t=n._uiProps.uiTransformComp;return {w:t.width,h:t.height,top:v.height/2-n.worldPosition.y-t.height/2,bottom:v.height/2-n.worldPosition.y+t.height/2};};
  const scene=find(s,'art:scenes/bg_base_comic_v1'),t=scene._uiProps.uiTransformComp,r=scene.getComponent(cc.Sprite).spriteFrame.rect;
  const alignment=[];for(const [key,u,y,height] of [['keep',.5,.469,334],['academy',.27,.715,252],['workshop',.73,.747,252]]){
    const n=find(s,'baseBuilding:'+key);alignment.push({key,anchor:[n.worldPosition.x,n.worldPosition.y-height/2+42],ground:[scene.worldPosition.x+t.width*(u-.5),scene.worldPosition.y+t.height*(.5-y)]});
  }
  const old=[],art=[],walk=n=>{if(n.name.startsWith('art:'))art.push(n);if(/lobby_base|bg_base_v1|keep_barracks/.test(n.name))old.push(n.name);n.children.forEach(walk);};walk(s);
  return {size:[v.width,v.height],resource:box('resource:gold'),view:box('baseSettlementView'),board:box('baseConstruction'),action:box('baseConstructionAction'),nav:box('tab4'),
    sceneRatio:t.width/t.height,sourceRatio:r.width/r.height,alignment,old,loadedArt:art.every(n=>!!n.getComponent(cc.Sprite)?.spriteFrame)};
});}
function assertLayout(g){
  assert(g.resource.top>=92&&g.view.bottom<=g.board.top&&g.action.bottom<g.nav.top,JSON.stringify(g));assert.equal(g.old.length,0);assert(g.loadedArt);assert(Math.abs(g.sceneRatio-g.sourceRatio)<.001);
  for(const a of g.alignment)for(let i=0;i<2;i++)assert(Math.abs(a.anchor[i]-a.ground[i])<.02,JSON.stringify(a));
}
async function swipe(page,name){
  const v=await node(page,name),cdp=await page.context().newCDPSession(page),from=v.y+100,to=v.y-100;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:v.x,y:from}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:v.x,y:from+(to-from)*i/12}]});await sleep(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(650);await cdp.detach();
}
async function codex(page){await scroll(page,'baseSettlementView',10000);await click(page,'baseName:academy');await loaded(page);assert(await has(page,'baseCodexDialog'));}
async function upgrade(page){
  const before=await data(page),expected=await page.evaluate(async lv=>(await System.import('chunks:///_virtual/GameData.ts')).keepUpCost(lv),before.keepLv);
  await click(page,'baseConstructionAction');assert.deepEqual(await data(page),before);assert((await labels(page,'baseKeepDialog')).includes('0 → 200'));
  await screenshot(page,'keep-upgrade');await click(page,'baseKeepUpgrade');await loaded(page);const after=await data(page);
  assert.equal(after.keepLv,before.keepLv+1);assert.equal(after.gold,before.gold-expected);assert.equal(after.diamonds,before.diamonds);
  const l=await labels(page,'baseConstruction');assert(l.includes('1,300')&&l.includes('200'));assertLayout(await geometry(page));
  checks.push({keep:'confirmation before charge, Lv.2→3, +100 durability / +200 shield',goldCost:expected});
}
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const q=await open(),page=q.page;await screenshot(page,'base-overview');assertLayout(await geometry(page));
  await upgrade(page);await codex(page);await sleep(1900);await screenshot(page,'codex-list');
  await click(page,'baseCodexCard:goblin_worker');await loaded(page);await screenshot(page,'codex-detail');
  const text=await labels(page,'baseCodexDetail');assert(text.includes('行动特征')&&text.includes('怪物描述')&&text.includes('应对弱点'));
  if(process.env.KW_SMOKE){console.log(JSON.stringify({errors,failures}));await browser.close();return;}
  const before=await data(page);await click(page,'baseCodexClaim');await loaded(page);const after=await data(page);
  assert.equal(after.diamonds,before.diamonds+20);assert.equal(after.gold,before.gold);assert.deepEqual(after.codexRewards,['goblin_worker']);
  assert((await labels(page,'baseCodexDialog')).includes('5份奖励待领'));assert(!(await has(page,'baseCodexReward:goblin_worker')));
  await click(page,'baseCodexCard:goblin_worker');await loaded(page);await click(page,'baseCodexClaim');assert.deepEqual(await data(page),after);
  await click(page,'btn_close');assert(await has(page,'baseCodexDialog'));assert.equal(await dimCount(page),1);
  checks.push({codex:'one-time +20 diamonds, updated wallet/count/list, claimed guard, detail returns to one list'});
  await scroll(page,'baseCodexView',10000);await click(page,'baseCodexCard:goblin_king');await loaded(page);await screenshot(page,'codex-boss-detail');
  await page.mouse.click(7,450);await sleep(250);assert(await has(page,'baseCodexDialog'));assert(await offset(page,'baseCodexView')>0);assert.equal(await dimCount(page),1);
  await click(page,'btn_close');assert.equal(await dimCount(page),0);await click(page,'baseName:workshop');assert.deepEqual(await data(page),after);
  checks.push({discoveredMonsters:'all six actual battle sprites, list scroll remembers position; workshop remains locked'});
  if(!process.env.KW_ONLINE_SMOKE){
    await scroll(page,'baseSettlementView',0);await click(page,'baseName:keep');assert(await has(page,'baseKeepDialog'));await click(page,'btn_close');
    for(let i=0;i<4;i++){await click(page,'tab'+i);await loaded(page);await click(page,'tab4');await loaded(page);assertLayout(await geometry(page));}
    checks.push({sharedNavigation:'shop, heroes, levels and upgrade return to base without old art'});
    await q.context.close();
    for(const mode of ['poor','max','partial','empty','claimed']){
      const g=await open(mode);const before=await data(g.page);await click(g.page,'baseConstructionAction');await click(g.page,'baseKeepUpgrade');
      if(mode==='poor'||mode==='max')assert.deepEqual(await data(g.page),before);if(await has(g.page,'baseKeepDialog'))await click(g.page,'btn_close');
      if(mode==='poor'||mode==='max')await screenshot(g.page,'base-'+mode);
      await codex(g.page);await screenshot(g.page,'codex-'+mode);
      if(mode==='partial'||mode==='empty'){const before=await data(g.page);await click(g.page,'baseCodexCard:goblin_slinger');assert(!(await has(g.page,'baseCodexDetail')));assert.deepEqual(await data(g.page),before);}
      if(mode==='claimed'){await click(g.page,'baseCodexCard:goblin_worker');const before=await data(g.page);await click(g.page,'baseCodexClaim');assert.deepEqual(await data(g.page),before);}
      checks.push({guard:mode});await g.context.close();
    }
  }else await q.context.close();
  for(const [width,height] of (process.env.KW_ONLINE_SMOKE?[[375,600]]:[[375,667],[375,600]])){
    const g=await open('full',width,height);await screenshot(g.page,'base-small-'+height);assertLayout(await geometry(g.page));
    const before=await data(g.page);await swipe(g.page,'baseSettlementView');assert(await offset(g.page,'baseSettlementView')>0);assert.deepEqual(await data(g.page),before);assert(!(await has(g.page,'baseKeepDialog')));assert(!(await has(g.page,'baseCodexDialog')));assertLayout(await geometry(g.page));
    const y=await offset(g.page,'baseSettlementView');await click(g.page,'tab0');await click(g.page,'tab4');await loaded(g.page);assert(Math.abs(await offset(g.page,'baseSettlementView')-y)<2);
    await scroll(g.page,'baseSettlementView',10000);await screenshot(g.page,'base-small-scrolled-'+height);await codex(g.page);await screenshot(g.page,'codex-small-'+height);
    await swipe(g.page,'baseCodexView');assert(!(await has(g.page,'baseCodexDetail')));await scroll(g.page,'baseCodexView',0);await click(g.page,'baseCodexCard:goblin_worker');await screenshot(g.page,'codex-detail-small-'+height);
    checks.push({phone:[width,height],scroll:'touch drag cancels building/card click, remembered offset, scene and targets align, fixed construction above nav'});await g.context.close();
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failures.length,0,JSON.stringify(failures));
  const report={ok:true,url:URL,realBattleStarted:false,checks,errors,failures};fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'ui-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,errors:errors.length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
