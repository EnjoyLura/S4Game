/** Isolated training lobby saves; real battle is never entered. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/',OUT=__dirname;
const IDS=['archer','sniper','pyro','volt','mora'],checks=[],errors=[],failures=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let browser;
function save(mode='full'){
  const heroes={},equips=[];
  for(const id of IDS)heroes[id]={owned:mode!=='locked'||id==='archer',lv:mode==='max'?90:9,weaponLv:mode==='max'?90:1,atkLv:mode==='max'?20:1,skillLv:mode==='max'?20:1,ultLv:mode==='max'?20:1,worn:{}};
  if(mode!=='empty'&&mode!=='locked')for(const [kind,defId] of [['helm','helm_falcon'],['acc','acc_moon'],['glove','glove_wind'],['armor','armor_forest']]){
    equips.push({uid:'w-'+kind,defId,lv:mode==='max'?20:1});heroes.archer.worn[kind]='w-'+kind;
  }
  return {gold:mode==='poor'?0:500000,diamonds:2411,heroes,equips,bag:mode==='no-mat'?{}:{mat_stone:100,mat_iron:3},
    squad:['archer'],curHero:'archer',unlocked:'1-3',stars:{},debug:false,music:false,sfx:false};
}
async function node(page,name){return page.evaluate(name=>{
  const find=n=>n.name===name&&n.activeInHierarchy?n:n.children.map(find).find(Boolean),n=find(cc.director.getScene());if(!n)throw Error('Missing node '+name);
  const t=n._uiProps.uiTransformComp,r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition;
  return {x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height,wx:p.x,wy:p.y,w:t?.width,h:t?.height};
},name);}
async function has(page,name){return page.evaluate(name=>{const walk=n=>n.name===name&&n.activeInHierarchy||n.children.some(walk);return walk(cc.director.getScene());},name);}
async function click(page,name){const p=await node(page,name);await page.mouse.click(p.x,p.y);await sleep(200);}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));}
async function labels(page,name){return page.evaluate(name=>{
  const find=n=>n.name===name?n:n.children.map(find).find(Boolean),r=[],walk=n=>{const l=n.getComponent(cc.Label);if(l)r.push(l.string);n.children.forEach(walk);};walk(find(cc.director.getScene()));return r;
},name);}
async function loaded(page){await page.waitForFunction(()=>{
  const walk=n=>(!n.name.startsWith('art:')||!!n.getComponent(cc.Sprite)?.spriteFrame)&&n.children.every(walk);return walk(cc.director.getScene());
},null,{timeout:45000});await sleep(250);}
async function screenshot(page,file){await loaded(page);await page.screenshot({path:path.join(OUT,(process.env.KW_QA_URL?'online-':'')+file+'.png')});}
async function open(mode='full',width=430,height=932){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(s=>localStorage.setItem('kw_save_v1',JSON.stringify(s)),save(mode));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene(),walk=n=>n.name==='tab3'||n.children.some(walk);return !!s&&walk(s);
  },null,{timeout:60000});await click(page,'tab3');await loaded(page);return {page,context};
}
async function select(page,tab){await click(page,'trainingTab:'+tab);await loaded(page);}
async function setScroll(page,y){await page.evaluate(y=>{
  const find=n=>n.name==='trainingBodyView'?n:n.children.map(find).find(Boolean),n=find(cc.director.getScene());
  n.getComponent(cc.ScrollView).scrollToOffset({x:0,y},0);n.emit('scrolling');
},y);await sleep(160);}
async function offset(page){return page.evaluate(()=>{
  const find=n=>n.name==='trainingBodyView'?n:n.children.map(find).find(Boolean);return find(cc.director.getScene()).getComponent(cc.ScrollView).getScrollOffset().y;
});}
async function geometry(page,level=false){return page.evaluate(level=>{
  const find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean),s=cc.director.getScene(),v=cc.view.getVisibleSize();
  const box=name=>{const n=find(s,name),t=n._uiProps.uiTransformComp;return {w:t.width,h:t.height,top:v.height/2-n.worldPosition.y-t.height/2,bottom:v.height/2-n.worldPosition.y+t.height/2};};
  const portraits=[],legacy=[],art=[],walk=n=>{if(n.name==='comicPortrait')portraits.push(n);if(n.name.startsWith('art:')){art.push(n);if(/lobby_training|lobby_weapons|lobby_rewards/.test(n.name))legacy.push(n.name);}n.children.forEach(walk);};walk(s);
  let platform=null;if(level){
    const image=find(s,'art:scenes/bg_upgrade_comic_v1'),t=image._uiProps.uiTransformComp,a=find(s,'trainingPlatformAnchor'),f=find(s,'heroFigure:'+JSON.parse(localStorage.getItem('kw_save_v1')).curHero);
    platform={anchor:[a.worldPosition.x,a.worldPosition.y],feet:[f.worldPosition.x,f.worldPosition.y],dais:[image.worldPosition.x+t.width*(.335-.5),image.worldPosition.y+t.height*(.5-.714)]};
  }
  return {size:[v.width,v.height],resource:box('resource:gold'),view:box('trainingBodyView'),dock:box('trainingActionDock'),upgrade:box('trainingUpgrade'),nav:box('tab3'),
    portraits:portraits.map(n=>({w:n._uiProps.uiTransformComp.width,h:n._uiProps.uiTransformComp.height,ellipse:n.getChildByName('portraitClip').getComponent(cc.Mask).type===1})),
    platform,legacy,artProportions:art.filter(n=>n.getComponent(cc.Sprite)?.spriteFrame).every(n=>{
      const r=n.getComponent(cc.Sprite).spriteFrame.rect,t=n._uiProps.uiTransformComp;return Math.abs(t.width/t.height-r.width/r.height)<.01;
    })};
},level);}
function assertLayout(g){
  assert(g.resource.top>=92&&g.view.bottom<=g.dock.top+.01&&g.upgrade.bottom<g.nav.top,JSON.stringify(g));
  assert(g.portraits.length===5&&g.portraits.every(p=>p.w===p.h&&p.ellipse));assert.equal(g.legacy.length,0);assert(g.artProportions);
  if(g.platform)for(let i=0;i<2;i++)for(const p of [g.platform.anchor,g.platform.dais])assert(Math.abs(p[i]-g.platform.feet[i])<.01,JSON.stringify(g.platform));
}
async function cost(page,tab,lv){return page.evaluate(async ({tab,lv})=>{
  const g=await System.import('chunks:///_virtual/GameData.ts');return tab===0?{gold:g.heroUpCost(lv),mat:0}:(tab===1?g.weaponUpCost:tab===2?g.skillUpCost:g.equipUpCost)(lv);
},{tab,lv});}
async function upgraded(page,tab,key,uid){
  const before=await data(page),lv=uid?before.equips.find(e=>e.uid===uid).lv:before.heroes.archer[key],expected=await cost(page,tab,lv);
  await click(page,'trainingUpgrade');await loaded(page);const after=await data(page);
  assert.equal(uid?after.equips.find(e=>e.uid===uid).lv:after.heroes.archer[key],lv+1);assert.equal(after.gold,before.gold-expected.gold);
  assert.equal((after.bag.mat_stone||0)+(after.bag.mat_iron||0),(before.bag.mat_stone||0)+(before.bag.mat_iron||0)-expected.mat);
  for(const k of ['lv','weaponLv','atkLv','skillLv','ultLv'])if(k!==key)assert.equal(after.heroes.archer[k],before.heroes.archer[k]);
  assert(!('skillUnlocked' in after.heroes.archer)&&!('ultUnlocked' in after.heroes.archer));
  checks.push({upgrade:key||uid,from:lv,to:lv+1,cost:expected});
}
async function swipe(page){
  const v=await node(page,'trainingBodyView'),cdp=await page.context().newCDPSession(page),from=v.y+Math.min(80,v.h*750/430*.2),to=v.y-100;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:v.x-80,y:from}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:v.x-80,y:from+(to-from)*i/12}]});await sleep(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(650);await cdp.detach();
}
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const {page,context}=await open();await screenshot(page,'upgrade-level');assertLayout(await geometry(page,true));
  for(let tab=1;tab<4;tab++){await select(page,tab);await screenshot(page,['','upgrade-weapon','upgrade-skill','upgrade-equip'][tab]);assertLayout(await geometry(page));}
  if(process.env.KW_SMOKE){console.log(JSON.stringify({errors,failures}));await browser.close();return;}
  if(process.env.KW_ONLINE_SMOKE){
    checks.push({fourTabs:'online images, shared controls and layout loaded'});
    await select(page,0);await upgraded(page,0,'lv');
    await select(page,1);for(const id of ['pyro','volt','mora']){await click(page,'trainingHero:'+id);await loaded(page);assert(await has(page,'trainingWeapon:'+id));await screenshot(page,'upgrade-weapon-'+id);}
    checks.push({newStaves:'all three published illustrations loaded'});await context.close();
    const q=await open('full',375,600);assertLayout(await geometry(q.page,true));await swipe(q.page);assertLayout(await geometry(q.page,true));await screenshot(q.page,'upgrade-small-scrolled-600');await q.context.close();
    checks.push({shortViewport:[375,600],pinnedAction:true,alignedPlatform:true});
    assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failures.length,0,JSON.stringify(failures));
    fs.writeFileSync(path.join(OUT,'online-validation.json'),JSON.stringify({ok:true,url:URL,realBattleStarted:false,checks,errors,failures},null,2));
    console.log(JSON.stringify({ok:true,checks:checks.length,errors:errors.length}));await browser.close();return;
  }
  checks.push({fourTabs:'new comic components, circular portraits, pinned action, preserved art proportions'});
  await select(page,0);await upgraded(page,0,'lv');
  assert((await labels(page,'milestone10')).includes('已解锁'));await click(page,'milestone10');assert((await labels(page,'comicDialog')).includes('已解锁 · 效果已生效'));await click(page,'btn_close');
  await click(page,'milestonePage:1');assert(await has(page,'milestone40'));await click(page,'milestonePage:-1');checks.push({milestones:'reached state, paging, detail and close'});
  await select(page,1);await upgraded(page,1,'weaponLv');
  for(const id of IDS){await click(page,'trainingHero:'+id);await loaded(page);assert(await has(page,'trainingWeapon:'+id));await screenshot(page,'upgrade-weapon-'+id);}
  await click(page,'trainingHero:archer');await select(page,2);
  for(const [slot,key] of [['atk','atkLv'],['skill','skillLv'],['ult','ultLv']]){
    await click(page,'skillChoice:'+slot);await upgraded(page,2,key);
    if(slot!=='atk')assert((await labels(page,'trainingPreview')).some(s=>s.includes('三选一解锁')));
  }
  await select(page,3);for(const kind of ['helm','acc','glove','armor']){await click(page,'wornChoice:'+kind);await upgraded(page,3,null,'w-'+kind);}
  await select(page,0);await click(page,'trainingAttrs');assert(await has(page,'heroAttrsDialog'));await click(page,'btn_close');
  for(const tab of [0,1,2]){await click(page,'tab'+tab);await loaded(page);await screenshot(page,['shop-regression','hero-regression','levels-regression'][tab]);await click(page,'tab3');await loaded(page);}
  checks.push({navigationAndAttributes:'shared wallet and illustrated nav remain functional'});await context.close();
  for(const mode of ['poor','no-mat','max','empty','locked']){
    const q=await open(mode);for(let tab=0;tab<4;tab++){
      await select(q.page,tab);const before=await data(q.page);
      if(mode==='no-mat'&&tab===0||mode==='empty'&&tab!==3||mode==='locked'&&tab!==3)continue;
      await click(q.page,'trainingUpgrade');assert.deepEqual(await data(q.page),before);assertLayout(await geometry(q.page,tab===0));
    }
    if(mode==='locked'){await click(q.page,'trainingHero:mora');assert.equal((await data(q.page)).curHero,'archer');}
    await sleep(1800);await screenshot(q.page,'upgrade-'+mode);checks.push({guard:mode,noUnexpectedCharge:true});await q.context.close();
  }
  for(const [width,height] of [[375,667],[375,600]]){
    const q=await open('full',width,height);await select(q.page,0);assertLayout(await geometry(q.page,true));await screenshot(q.page,'upgrade-small-'+height);
    const before=await data(q.page);await swipe(q.page);assert(await offset(q.page)>0);assert.deepEqual(await data(q.page),before);assertLayout(await geometry(q.page,true));
    const y=await offset(q.page);await select(q.page,1);await select(q.page,0);assert(Math.abs(await offset(q.page)-y)<2);
    await screenshot(q.page,'upgrade-small-scrolled-'+height);
    for(let tab=1;tab<4;tab++){await select(q.page,tab);assertLayout(await geometry(q.page));await setScroll(q.page,1000);await screenshot(q.page,'upgrade-small-'+height+'-tab'+tab);}
    checks.push({shortScreen:[width,height],scroll:'touch scroll does not upgrade, remembered offset, platform follows feet, action stays visible'});await q.context.close();
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failures.length,0,JSON.stringify(failures));
  const report={ok:true,url:URL,realBattleStarted:false,checks,errors,failures};fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'ui-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,errors:errors.length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
