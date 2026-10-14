/** Live-site smoke check in an isolated save; no battle entry. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL='https://kingdom-watch.pages.dev/?v=levels-comic-v2-1791711814',errors=[];
let browser;
(async()=>{
  browser=await chromium.launch({channel:'msedge',headless:true,proxy:{server:'http://127.0.0.1:10808'}});
  const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(()=>localStorage.setItem('kw_save_v1',JSON.stringify({gold:5000,diamonds:800,
    heroes:{archer:{owned:true,lv:1,worn:{}}},equips:[],bag:{},squad:['archer'],curHero:'archer',
    stars:{'1-1':3},chestClaimed:{},debug:false,music:false,sfx:false})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(()=>!!globalThis.cc?.director?.getScene());
  const info=async name=>page.evaluate(name=>{
    const find=n=>n.name===name&&n.activeInHierarchy?n:n.children.map(find).find(Boolean);
    const n=find(cc.director.getScene());if(!n)return null;
    const v=cc.view.getVisibleSize(),r=document.querySelector('canvas').getBoundingClientRect(),p=n.worldPosition;
    return {x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height};
  },name);
  const click=async name=>{await page.waitForFunction(name=>{
    const walk=n=>n.name===name&&n.activeInHierarchy||n.children.some(walk);return walk(cc.director.getScene());
  },name);const p=await info(name);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);};
  await click('tab2');
  await page.waitForFunction(()=>{
    const find=n=>n.name==='levelTerrain:1-1'?n:n.children.map(find).find(Boolean);
    return !!find(cc.director.getScene())?.getComponent(cc.Sprite)?.spriteFrame;
  },null,{timeout:45000});
  const offset=()=>page.evaluate(()=>{
    const find=n=>n.name==='levelSelectors'?n:n.children.map(find).find(Boolean);
    return -find(cc.director.getScene()).getComponent(cc.ScrollView).getScrollOffset().x;
  });
  const view=await info('levelSelectors'),cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:view.x+120,y:view.y}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:view.x+120-24*i,y:view.y}]});await page.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(700);const moved=await offset();assert(moved>100);
  await click('rewardTier1');assert(Math.abs(await offset()-moved)<1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')).gold),5200);
  await click('tab0');await click('tab1');await click('tab2');assert(Math.abs(await offset()-moved)<1);
  await click('levelSquad');assert.equal(await info('squadBack'),null);
  await click('squadDone');assert.equal(await info('levelSquadOverlay'),null);assert(Math.abs(await offset()-moved)<1);
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report={ok:true,url:URL,viewport:[375,667],realTouchDrag:true,claimedGold:200,
    offsetRetainedAcross:['claim refresh','shop/hero/level roundtrip','squad done'],
    squadBackRemoved:true,battleEntered:false,errors};
  fs.writeFileSync(path.join(__dirname,'online-smoke.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
