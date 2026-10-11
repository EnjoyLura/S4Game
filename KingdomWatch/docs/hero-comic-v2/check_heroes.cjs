/** Isolated UI saves. Exercises the hero lobby only and never launches a battle. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT=__dirname,URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
const checks=[],errors=[],failures=[];
const IDS=['archer','sniper','pyro','volt','mora'];
function save(mode='full'){
  const heroes={};for(const id of IDS)heroes[id]={owned:mode!=='locked'||id==='archer',lv:8,weaponLv:1,atkLv:1,skillLv:1,ultLv:1,worn:{}};
  const equips=[];
  if(mode!=='empty'&&mode!=='locked'){
    equips.push({uid:'w-bow',defId:'wpn_bow',lv:1},{uid:'w-helm',defId:'helm_falcon',lv:1},{uid:'w-acc',defId:'acc_moon',lv:1},
      {uid:'w-glove',defId:'glove_wind',lv:1},{uid:'w-armor',defId:'armor_forest',lv:1},{uid:'b-crossbow',defId:'wpn_crossbow',lv:1},
      {uid:'b-bow',defId:'wpn_bow',lv:1},{uid:'sniper-helm',defId:'helm_falcon',lv:1});
    heroes.archer.worn={weapon:'w-bow',helm:'w-helm',acc:'w-acc',glove:'w-glove',armor:'w-armor'};
    heroes.sniper.worn={helm:'sniper-helm'};
    for(let i=0;i<26;i++)equips.push({uid:'b-'+i,defId:['helm_falcon','acc_moon','glove_wind','armor_forest'][i%4],lv:1+i%3});
  }
  if(mode==='max')equips.find(e=>e.uid==='w-bow').lv=20;
  return {gold:mode==='poor'?0:500000,diamonds:2411,heroes,equips,bag:mode==='empty'||mode==='locked'||mode==='no-mat'?{}:{mat_stone:12,mat_iron:3,mat_dust:2,mat_rune:1},
    squad:['archer'],curHero:'archer',unlocked:'1-3',stars:{},debug:false,music:false,sfx:false};
}
async function node(page,name){return page.evaluate(name=>{
  const find=n=>{if(n.name===name&&n.activeInHierarchy)return n;for(const c of n.children){const r=find(c);if(r)return r;}};
  const n=find(cc.director.getScene());if(!n)throw Error('Missing node '+name);
  const t=n._uiProps.uiTransformComp,r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition;
  return {name,x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height,wx:p.x,wy:p.y,w:t?.width,h:t?.height,uuid:n.uuid};
},name);}
async function has(page,name){return page.evaluate(name=>{
  const walk=n=>n.name===name&&n.activeInHierarchy||n.children.some(walk);return !!walk(cc.director.getScene());
},name);}
async function click(page,name){const p=await node(page,name);await page.mouse.click(p.x,p.y);await sleep(180);}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));}
async function loaded(page){await page.waitForFunction(()=>{
  const walk=n=>(!n.name.startsWith('art:')||!!n.getComponent(cc.Sprite)?.spriteFrame)&&n.children.every(walk);
  return walk(cc.director.getScene());
},null,{timeout:45000});await sleep(250);}
async function screenshot(page,file){await loaded(page);await page.screenshot({path:path.join(OUT,file+'.png')});}
async function open(mode='full',width=430,height=932){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(s=>localStorage.setItem('kw_save_v1',JSON.stringify(s)),save(mode));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene();const walk=n=>n.name==='tab1'||n.children.some(walk);return !!s&&walk(s);
  },null,{timeout:60000});await click(page,'tab1');await loaded(page);return {page,context};
}
async function blank(page){await page.mouse.click(12,Math.min(280,page.viewportSize().height*.35));await sleep(160);}
async function scrollOffset(page){return page.evaluate(()=>{
  const find=n=>n.name==='heroBagView'?n:n.children.map(find).find(Boolean);return find(cc.director.getScene()).getComponent(cc.ScrollView).getScrollOffset().y;
});}
async function setScroll(page,y){await page.evaluate(y=>{
  const find=n=>n.name==='heroBagView'?n:n.children.map(find).find(Boolean);const n=find(cc.director.getScene());
  n.getComponent(cc.ScrollView).scrollToOffset({x:0,y},0);n.emit('scrolling');
},y);await sleep(140);}
async function geometry(page){return page.evaluate(()=>{
  const find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean),s=cc.director.getScene(),v=cc.view.getVisibleSize();
  const box=name=>{let n=find(s,name),t=n._uiProps.uiTransformComp;if(!t){n=n.children[0];t=n._uiProps.uiTransformComp;}return {w:t.width,h:t.height,top:v.height/2-n.worldPosition.y-t.height/2,bottom:v.height/2-n.worldPosition.y+t.height/2};};
  const portraits=[],walk=n=>{if(n.name==='comicPortrait')portraits.push(n);n.children.forEach(walk);};walk(s);
  return {size:[v.width,v.height],resource:box('resource:gold'),roster:box('heroLobbyRoster'),stage:box('heroStage'),bag:box('heroInventory'),view:box('heroBagView'),nav:box('tab1'),
    portraits:portraits.map(n=>{const t=n._uiProps.uiTransformComp,m=n.getChildByName('portraitClip').getComponent(cc.Mask);return {w:t.width,h:t.height,ellipse:m.type===1};})};
});}
async function stageArt(page){return page.evaluate(()=>{
  const find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean),s=cc.director.getScene();
  const upper=find(s,'heroUpperScene'),anchor=find(s,'heroPlatformAnchor'),figure=find(s,'heroFigure:'+JSON.parse(localStorage.getItem('kw_save_v1')).curHero);
  const art=find(s,'art:scenes/bg_heroes_comic_v2'),t=art._uiProps.uiTransformComp;
  const noFrame=['heroEquipment','heroPower','heroCycle:left','heroCycle:right','heroDetail:属性','heroDetail:故事'].every(name=>!find(s,name).getComponent(cc.Graphics));
  const dais={x:art.worldPosition.x+t.width*(.315-.5),y:art.worldPosition.y+t.height*(.5-.840)};
  return {titleAbsent:!find(s,'heroTitle'),namePlateAbsent:!find(s,'heroNameplate'),noFrame,
    paperBackdrop:!!find(s,'heroPageBackdrop')?.getComponent(cc.Graphics),
    upperHeight:upper._uiProps.uiTransformComp.height,
    anchor:[anchor.worldPosition.x,anchor.worldPosition.y],figureFeet:[figure.worldPosition.x,figure.worldPosition.y],
    dais:[dais.x,dais.y],icons:['comic_cycle_arrow_v2','comic_power_banner_v2','comic_bag_v2','comic_attributes_v2','comic_story_v2'].map(key=>!!find(s,'art:hero_comic_v2/'+key)?.getComponent(cc.Sprite)?.spriteFrame)};
});}
async function assertStageArt(page){
  const art=await stageArt(page),g=await geometry(page);
  assert(art.titleAbsent&&art.namePlateAbsent&&art.noFrame&&art.paperBackdrop,JSON.stringify(art));
  assert(art.icons.every(Boolean));assert(Math.abs(art.upperHeight-g.bag.top)<.01);
  for(let i=0;i<2;i++){assert(Math.abs(art.anchor[i]-art.figureFeet[i])<.01);assert(Math.abs(art.dais[i]-art.figureFeet[i])<.01);}
  return art;
}
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const {page,context}=await open();await screenshot(page,'hero-main');
  checks.push({upperArtAndUnframedControls:await assertStageArt(page)});
  const g=await geometry(page);assert(g.resource.top>=92);assert.equal(g.bag.w,750);assert.equal(g.portraits.length,5);assert(g.portraits.every(p=>p.w===p.h&&p.ellipse));
  assert(g.roster.bottom<=g.stage.top+.01&&g.stage.bottom<=g.bag.top+.01&&g.view.bottom<g.nav.top,JSON.stringify(g));
  assert(!await has(page,'heroBagItem:w-helm')&&!await has(page,'heroBagItem:sniper-helm'));
  checks.push({layout:g,wornItemsExcludedAcrossHeroes:true});
  const wallet=await node(page,'resource:gold');
  for(const id of IDS){await click(page,'heroSelect:'+id);await loaded(page);assert.equal((await data(page)).curHero,id);assert(await has(page,'heroFigure:'+id));await screenshot(page,'hero-'+id);}
  await click(page,'heroSelect:archer');await click(page,'heroCycle:right');assert.equal((await data(page)).curHero,'sniper');await click(page,'heroCycle:left');assert.equal((await data(page)).curHero,'archer');
  checks.push({heroSelection:5,cycleArrows:true,allFiguresLoaded:true});
  const stageBefore=await node(page,'heroStage');await setScroll(page,110);assert((await scrollOffset(page))>100);assert.equal((await node(page,'heroStage')).wy,stageBefore.wy);
  await click(page,'heroBagTab:weapon');assert.equal(await scrollOffset(page),0);await click(page,'heroBagTab:equip');assert(Math.abs(await scrollOffset(page)-110)<2);
  await setScroll(page,0);checks.push({bagScroll:'independent stage and restored per-tab offset'});
  await click(page,'heroDetail:属性');await screenshot(page,'hero-attributes');assert(await has(page,'heroAttrsDialog'));await click(page,'btn_close');assert(!await has(page,'heroAttrsDialog'));
  await click(page,'heroDetail:故事');await screenshot(page,'hero-story');assert(await has(page,'heroStoryDialog'));await click(page,'btn_close');checks.push({attributesAndStory:'new components open and close'});
  await click(page,'heroEquipped:weapon');await screenshot(page,'hero-equipped');assert(!await has(page,'btn_close'));
  const p=await node(page,'heroEquipmentCard:current');await page.mouse.click(p.x,p.y);await sleep(100);assert(await has(page,'heroWornDialog'));
  await click(page,'heroForgeOpen');await screenshot(page,'hero-forge');await click(page,'heroForgeAction');
  let s=await data(page);assert.equal(s.gold,499880);assert.equal(s.bag.mat_stone,11);assert.equal(s.equips.find(e=>e.uid==='w-bow').lv,2);assert(!await has(page,'heroForgeDialog'));
  assert.equal((await node(page,'resource:gold')).uuid,wallet.uuid);checks.push({forge:'level +1, 120 gold and one stone charged, wallet reused'});
  await sleep(1700);await click(page,'heroBagItem:b-0');await screenshot(page,'hero-compare');assert(await has(page,'heroCompareDialog'));assert(!await has(page,'btn_close'));
  await click(page,'heroDismantleOpen');await screenshot(page,'hero-dismantle');await click(page,'heroSellCancel');assert.equal((await data(page)).gold,499880);assert(await has(page,'heroCompareDialog'));
  await click(page,'heroDismantleOpen');await click(page,'heroSellConfirmAction');s=await data(page);assert.equal(s.gold,501380);assert(!s.equips.some(e=>e.uid==='b-0'));
  checks.push({dismantle:'cancel does not charge; confirm removes item and returns 1500 gold'});
  await click(page,'heroBagTab:weapon');await click(page,'heroBagItem:b-crossbow');assert(await has(page,'heroCompareDialog'));await click(page,'heroReplace');s=await data(page);
  assert.equal(s.heroes.archer.worn.weapon,'b-crossbow');assert(await has(page,'heroBagItem:w-bow'));await click(page,'heroBagItem:w-bow');await blank(page);assert(!await has(page,'heroCompareDialog'));
  checks.push({replace:'new item worn, previous weapon returns to bag; blank tap closes comparison'});
  await click(page,'heroSelect:sniper');await click(page,'heroBagTab:equip');await setScroll(page,0);await click(page,'heroBagItem:b-1');assert(await has(page,'heroWarehouseDialog'));
  await click(page,'heroSellOpen');await click(page,'heroSellCancel');await blank(page);await click(page,'heroBagItem:b-1');await click(page,'heroWear');s=await data(page);
  assert.equal(s.heroes.sniper.worn.acc,'b-1');checks.push({warehouse:'sale cancel preserves item, wear fills empty slot'});
  await click(page,'heroSelect:archer');await click(page,'heroBagTab:mat');await screenshot(page,'hero-materials');await click(page,'heroBagItem:mat_stone');await screenshot(page,'hero-material-detail');await click(page,'btn_close');
  checks.push({materials:'four types render with count and detail'});
  await context.close();
  for(const mode of ['poor','no-mat','max']){
    const q=await open(mode);await click(q.page,'heroEquipped:weapon');await click(q.page,'heroForgeOpen');
    if(mode==='max')assert(!await has(q.page,'heroForgeAction'));
    else {await click(q.page,'heroForgeAction');assert(await has(q.page,'heroForgeDialog'));const d=await data(q.page);assert.equal(d.equips.find(e=>e.uid==='w-bow').lv,1);assert.equal(d.gold,mode==='poor'?0:500000);}
    checks.push({forgeGuard:mode,noUnexpectedCharge:true});await q.context.close();
  }
  const short=await open('full',375,667);await screenshot(short.page,'hero-small');const small=await geometry(short.page);assert(small.resource.top>=92);assert(small.view.bottom<small.nav.top);assert(small.view.h>=260);await assertStageArt(short.page);
  checks.push({smallViewport:[375,667],layout:small});await short.context.close();
  const empty=await open('empty');await click(empty.page,'heroSelect:mora');
  for(const tab of ['weapon','equip','mat']){
    await click(empty.page,'heroBagTab:'+tab);assert(await has(empty.page,'heroBagEmpty'));
    const emptyState=await empty.page.evaluate(()=>{
      const find=n=>n.name==='heroBagContent'?n:n.children.map(find).find(Boolean);
      const walk=n=>{if(n.name==='heroBagEmpty')return !n.getComponent(cc.Graphics);return n.children.some(walk);};
      const seat=n=>n.name==='heroItemSeat'||n.name.startsWith('heroBagItem:')||n.children.some(seat);
      const grid=find(cc.director.getScene());return {plainDescription:walk(grid),noItemSeats:!seat(grid)};
    });
    assert(emptyState.plainDescription&&emptyState.noItemSeats,JSON.stringify(emptyState));
    await screenshot(empty.page,'hero-empty-'+tab);
  }
  await assertStageArt(empty.page);checks.push({emptyBag:'all three categories display only plain text, no placeholder slots'});await empty.context.close();
  const locked=await open('locked');await click(locked.page,'heroSelect:mora');assert(!await has(locked.page,'heroFigure:mora'));assert(await has(locked.page,'heroFigure:archer'));await sleep(1700);await screenshot(locked.page,'hero-locked');
  checks.push({emptyInventory:true,lockedHeroCannotBeSelected:true});await locked.context.close();
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failures.length,0,JSON.stringify(failures));
  fs.writeFileSync(path.join(OUT,'ui-validation.json'),JSON.stringify({ok:true,url:URL,checks,errors,failures},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,errors:errors.length,screenshots:fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
