/** Isolated lobby saves; verifies selection, rewards and squad without entering a battle. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT=__dirname,URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/';
const IDS=['archer','sniper','pyro','volt','mora'],checks=[],errors=[],failures=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
function save(mode){
  const heroes={};for(const id of IDS)heroes[id]={owned:mode!=='new'||id==='archer',lv:8,weaponLv:1,atkLv:1,skillLv:1,ultLv:1,worn:{}};
  return {gold:5000,diamonds:800,heroes,equips:[],bag:{},squad:mode==='empty'?[]:['archer'],curHero:'archer',
    stars:mode==='full'?{'1-1':3,'1-1e':2,'1-1h':1,'1-2':3,'1-2e':1,'1-3':2}:mode==='reward'?{'1-1':3}:{},
    chestClaimed:{},debug:false,music:false,sfx:false};
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
async function click(page,name){const p=await node(page,name);await page.mouse.click(p.x,p.y);await sleep(200);}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));}
async function labels(page,root){return page.evaluate(root=>{
  const find=n=>n.name===root?n:n.children.map(find).find(Boolean),out=[];
  const walk=n=>{const l=n.getComponent(cc.Label);if(l)out.push(l.string);n.children.forEach(walk);};
  const n=find(cc.director.getScene());if(n)walk(n);return out;
},root);}
async function loaded(page){await page.waitForFunction(()=>{
  const walk=n=>(!(n.name.startsWith('art:')||n.name.startsWith('levelTerrain:')||n.name.startsWith('rewardChest'))||!!n.getComponent(cc.Sprite)?.spriteFrame)&&n.children.every(walk);
  return walk(cc.director.getScene());
},null,{timeout:45000});await sleep(250);}
async function screenshot(page,name){await loaded(page);await page.screenshot({path:path.join(OUT,name+'.png')});}
async function open(mode='full',width=430,height=932){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(s=>localStorage.setItem('kw_save_v1',JSON.stringify(s)),save(mode));
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene(),walk=n=>n.name==='tab2'||n.children.some(walk);return !!s&&walk(s);
  },null,{timeout:60000});
  await click(page,'tab2');await loaded(page);
  await page.evaluate(()=>{window.__battleCalls=[];cc.director.loadScene=(name)=>{window.__battleCalls.push(name);return true;};});
  return {page,context};
}
async function selectedDifficulty(page){return page.evaluate(()=>{
  const find=n=>n.name==='levelDifficultyBar'?n:n.children.map(find).find(Boolean),bar=find(cc.director.getScene());
  return bar.children.findIndex(n=>{const c=n.getComponent(cc.Graphics)?.fillColor;return c&&c.r===255&&c.g===232&&c.b===140;});
});}
async function routeState(page){return page.evaluate(()=>{
  const find=n=>n.name==='levelSelectors'?n:n.children.map(find).find(Boolean),view=find(cc.director.getScene()),scroll=view.getComponent(cc.ScrollView);
  return {offset:-scroll.getScrollOffset().x,max:scroll.getMaxScrollOffset().x,horizontal:scroll.horizontal,vertical:scroll.vertical,mask:!!view.getComponent(cc.Mask)};
});}
async function swipeRoute(page,direction){
  const v=await node(page,'levelSelectors'),cdp=await page.context().newCDPSession(page);
  const from=v.x+(direction==='left'?130:-130),to=v.x+(direction==='left'?-130:130);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y:v.y}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*i/12,y:v.y}]});await sleep(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(750);await cdp.detach();
}
async function geometry(page){return page.evaluate(()=>{
  const find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean),s=cc.director.getScene(),v=cc.view.getVisibleSize();
  const box=name=>{const n=find(s,name),t=n._uiProps.uiTransformComp,p=n.worldPosition;return {w:t.width,h:t.height,left:p.x-t.width/2,right:p.x+t.width/2,top:v.height/2-p.y-t.height/2,bottom:v.height/2-p.y+t.height/2};};
  const old=[],walk=n=>{if(n.name.includes('lobby_levels_v1')||n.name.includes('lobby_rewards_v1')||n.name==='levelPlaque')old.push(n.name);n.children.forEach(walk);};walk(s);
  const terrain=find(s,'levelUpperScene').children[0].children[0],sp=terrain.getComponent(cc.Sprite),t=terrain._uiProps.uiTransformComp;
  const tiers=[1,2,3].map(i=>({tier:box('rewardTier'+i),condition:box('rewardCondition'+i),chest:box('rewardChest'+i),amount:box('rewardAmount'+i),status:box('rewardStatus'+i)}));
  return {viewport:[v.width,v.height],resource:box('resource:gold'),title:box('levelTitle'),difficulty:box('levelDifficultyBar'),stage:box('terrainStage'),
    selectors:box('levelSelectors'),rewards:box('rewardShelf'),battle:box('levelBattle'),squad:box('levelSquad'),nav:box('tab2'),upper:box('levelUpperScene'),
    paper:!!find(s,'levelPageBackdrop')?.getComponent(cc.Graphics),noOldArt:old.length===0,
    terrainLoaded:!!sp.spriteFrame,terrainAspect:t.width/t.height,sourceAspect:sp.spriteFrame.rect.width/sp.spriteFrame.rect.height,
    coverMask:!!terrain.parent.getComponent(cc.Mask),tiers,
    arrowsRemoved:!find(s,'levelSwitch:left')&&!find(s,'levelSwitch:right')};
});}
async function assertGeometry(page){
  await loaded(page);
  const g=await geometry(page);
  assert(g.paper&&g.noOldArt&&g.terrainLoaded&&g.coverMask&&g.arrowsRemoved,JSON.stringify(g));
  assert(g.resource.top>=92&&g.resource.bottom<g.title.top);
  assert(g.title.bottom<g.difficulty.top&&g.difficulty.bottom<g.stage.top);
  assert(g.stage.bottom<g.selectors.top&&g.selectors.bottom<g.rewards.top);
  assert(g.rewards.bottom<g.battle.top&&g.battle.bottom<g.nav.top);
  assert.equal(g.battle.h,g.squad.h);assert(Math.abs(g.upper.bottom-g.rewards.top)<.01);
  assert(g.stage.h>=170&&g.battle.h>=92&&g.rewards.h>=316);assert(Math.abs(g.terrainAspect-g.sourceAspect)<.001);
  for(const t of g.tiers){
    assert(t.tier.top>=g.rewards.top+65&&t.tier.bottom<=g.rewards.bottom-13);
    for(const part of [t.condition,t.chest,t.amount,t.status]){
      assert(part.left>=t.tier.left&&part.right<=t.tier.right&&part.top>=t.tier.top&&part.bottom<=t.tier.bottom,JSON.stringify({part,t}));
    }
    assert(t.condition.bottom<t.chest.top&&t.chest.bottom<t.amount.top&&t.amount.bottom<t.status.top,JSON.stringify(t));
  }
  return g;
}
async function assertRoster(page){return page.evaluate(()=>{
  const find=(n,name)=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean),s=cc.director.getScene();
  const bar=find(s,'squadHeroRoster'),w=bar._uiProps.uiTransformComp.width;
  const cards=bar.children.filter(n=>n.name.startsWith('squadHero:'));
  return {cards:cards.length,withinPanel:cards.every(n=>Math.abs(n.position.x)+n._uiProps.uiTransformComp.width/2<w/2),
    largeCards:cards.every(n=>n._uiProps.uiTransformComp.width>=126),
    portraitMasks:cards.every(n=>n.getChildByName('comicPortrait').getChildByName('portraitClip').getComponent(cc.Mask).type===1)};
});}
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const full=await open(),p=full.page,wallet=await node(p,'resource:gold');
  checks.push({phoneLayout:await assertGeometry(p)});await screenshot(p,'levels-outpost');
  const before=await routeState(p);assert(before.horizontal&&!before.vertical&&before.mask&&before.max>0);
  await swipeRoute(p,'left');const moved=await routeState(p);
  assert(moved.offset>before.offset+100);assert(await has(p,'levelTerrain:1-1'));
  await screenshot(p,'levels-route-later');await click(p,'levelSelect:1-5');
  assert(await has(p,'levelTerrain:1-1'));assert.deepEqual(await p.evaluate(()=>window.__battleCalls),[]);
  await sleep(1600);await click(p,'levelDifficulty:1');
  assert(Math.abs((await routeState(p)).offset-moved.offset)<1);
  await click(p,'levelSquad');assert(!await has(p,'squadBack'));await click(p,'squadDone');
  assert(Math.abs((await routeState(p)).offset-moved.offset)<1);
  await swipeRoute(p,'right');assert((await routeState(p)).offset<1);
  await click(p,'levelDifficulty:0');
  checks.push({route:'real touch swipe, inertia, masked later stops, no accidental selection, offset retained across difficulty and squad refresh; 1-4/1-5 unavailable'});
  await click(p,'levelDifficulty:1');assert.equal(await selectedDifficulty(p),1);
  assert((await labels(p,'rewardShelf')).includes('2/3 星'));await screenshot(p,'levels-elite');
  await click(p,'levelDifficulty:2');assert.equal(await selectedDifficulty(p),2);
  assert((await labels(p,'rewardShelf')).includes('1/3 星'));await screenshot(p,'levels-hell');
  checks.push({difficulty:'normal, elite and hell use independent stars'});
  await click(p,'levelSelect:1-2');assert.equal(await selectedDifficulty(p),2);assert(await has(p,'levelTerrain:1-2'));await screenshot(p,'levels-forest');
  await click(p,'levelSelect:1-3');assert.equal(await selectedDifficulty(p),1);assert(await has(p,'levelTerrain:1-3'));await screenshot(p,'levels-lair');
  checks.push({selection:'three continuous outdoor scenes; locked-difficulty fallback; map arrows removed'});
  await click(p,'levelSquad');await screenshot(p,'squad-one');const roster=await assertRoster(p);
  assert(roster.cards===5&&roster.withinPanel&&roster.largeCards&&roster.portraitMasks,JSON.stringify(roster));checks.push({formationArt:roster});
  await click(p,'squadHero:pyro');await click(p,'squadHero:sniper');await click(p,'squadHero:volt');
  assert.deepEqual((await data(p)).squad,['archer','pyro','sniper','volt']);await screenshot(p,'squad-full');
  await click(p,'squadHero:mora');assert.deepEqual((await data(p)).squad,['archer','pyro','sniper','volt']);
  checks.push({deploy:'ordered slots, four-hero limit guarded'});
  await sleep(1600);await click(p,'squadSlot:1');assert(await has(p,'squadRemoveDialog'));await screenshot(p,'squad-confirm');
  await click(p,'squadRemoveCancel');assert.deepEqual((await data(p)).squad,['archer','pyro','sniper','volt']);
  await click(p,'squadHero:pyro');await click(p,'squadRemoveConfirm');assert.deepEqual((await data(p)).squad,['archer','sniper','volt']);
  assert(!await has(p,'squadRemoveDialog'));await click(p,'squadHero:mora');assert.deepEqual((await data(p)).squad,['archer','sniper','volt','mora']);
  checks.push({remove:'cancel preserves squad; confirm removes and closes; new hero appends'});
  await click(p,'squadDone');assert(!await has(p,'levelSquadOverlay'));assert((await labels(p,'levelSquad')).includes('4/4 已上阵'));
  assert.equal((await node(p,'resource:gold')).uuid,wallet.uuid);await click(p,'levelBattle');
  assert.deepEqual(await p.evaluate(()=>window.__battleCalls),['Main']);
  const flow=await p.evaluate(async()=>{const mod=await System.import('chunks:///_virtual/Flow.ts');return {mode:mod.flow.mode,levelId:mod.flow.levelId,diff:mod.flow.diff};});
  assert.deepEqual(flow,{mode:'battle',levelId:'1-3',diff:1});
  checks.push({start:flow,squadSaved:true,walletReused:true,battleWasIntercepted:true});await full.context.close();

  const reward=await open('reward');const r=reward.page;await screenshot(r,'rewards-ready');
  for(let tier=1;tier<=3;tier++){await click(r,'rewardTier'+tier);assert.equal((await data(r)).chestClaimed['1-1'],tier);await sleep(1600);}
  const rs=await data(r);assert.equal(rs.gold,5200);assert.equal(rs.diamonds,1010);
  await screenshot(r,'rewards-claimed');await click(r,'rewardTier3');assert.equal((await data(r)).diamonds,1010);
  await click(r,'levelDifficulty:1');assert((await labels(r,'rewardShelf')).includes('0/3 星'));await click(r,'rewardTier1');
  assert.equal((await data(r)).gold,5200);assert.equal((await data(r)).chestClaimed['1-1e'],undefined);
  checks.push({rewards:'200 gold and 210 diamonds, once only; incomplete difficulty cannot claim'});await reward.context.close();

  const fresh=await open('new');const f=fresh.page;await click(f,'levelDifficulty:1');assert.equal(await selectedDifficulty(f),0);
  await sleep(1600);await click(f,'levelSelect:1-2');assert(await has(f,'levelLockedHint'));await screenshot(f,'levels-locked');
  await click(f,'levelDifficulty:0');await click(f,'levelBattle');assert.deepEqual(await f.evaluate(()=>window.__battleCalls),[]);
  await click(f,'levelSelect:1-1');assert(await has(f,'levelTerrain:1-1'));assert(!await has(f,'levelLockedHint'));
  await click(f,'levelSquad');await click(f,'squadHero:mora');
  assert.deepEqual((await data(f)).squad,['archer','mora']);assert.equal((await data(f)).heroes.mora.owned,true);
  assert(!await has(f,'squadBack'));await click(f,'squadDone');assert(!await has(f,'levelSquadOverlay'));
  checks.push({guards:'locked difficulty, locked level and battle disabled; existing deploy ownership behavior preserved'});await fresh.context.close();

  const empty=await open('empty');await click(empty.page,'levelBattle');assert.deepEqual(await empty.page.evaluate(()=>window.__battleCalls),[]);
  await sleep(1600);await click(empty.page,'levelSquad');await screenshot(empty.page,'squad-empty');await click(empty.page,'squadDone');
  checks.push({emptySquad:'start guarded and four empty slots readable'});await empty.context.close();
  const short=await open('full',375,667);await screenshot(short.page,'levels-small');checks.push({smallPhone:await assertGeometry(short.page)});
  await click(short.page,'levelSquad');await screenshot(short.page,'squad-small');const sm=await assertRoster(short.page);assert(sm.withinPanel);await click(short.page,'squadDone');
  await click(short.page,'tab0');await screenshot(short.page,'shop-regression');await click(short.page,'tab1');await screenshot(short.page,'hero-regression');
  await click(short.page,'tab2');await loaded(short.page);assert(await has(short.page,'levelPageBackdrop'));await assertGeometry(short.page);
  checks.push({tabRoundTrip:'shop → hero → levels, shared wallet/nav retained'});await short.context.close();
  const reduced=await open('full',375,600);checks.push({reducedBrowserHeight:await assertGeometry(reduced.page)});
  await screenshot(reduced.page,'levels-short-browser');await swipeRoute(reduced.page,'left');
  assert((await routeState(reduced.page)).offset>100);await click(reduced.page,'levelSelect:1-3');
  assert(await has(reduced.page,'levelTerrain:1-3'));await assertGeometry(reduced.page);await reduced.context.close();
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failures.length,0,JSON.stringify(failures));
  const screenshots=fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).length;
  fs.writeFileSync(path.join(OUT,'ui-validation.json'),JSON.stringify({ok:true,url:URL,checks,errors,failures,screenshots},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,screenshots,errors:errors.length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
