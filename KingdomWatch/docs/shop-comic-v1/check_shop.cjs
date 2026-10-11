/** Browser integration checks for the shop only; never starts a battle. */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const {chromium} = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT = path.resolve(__dirname);
const URL = process.env.KW_QA_URL || 'http://127.0.0.1:8765/';
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

function save(unlocked='1-3', funds=true) {
  const heroes = {};
  for (const id of ['archer','sniper','pyro','volt','mora'])
    heroes[id] = {owned:id==='archer',lv:1,weaponLv:1,atkLv:1,skillLv:1,ultLv:1,worn:{}};
  return {gold:funds?500000:0,diamonds:funds?500000:0,heroes,squad:['archer'],curHero:'archer',unlocked,
    stars:{},bag:{},equips:[],debug:false,music:false,sfx:false};
}

async function locate(page,name) {
  return page.evaluate(name=>{
    const find=n=>{if(n.name===name&&n.activeInHierarchy)return n;for(const c of n.children){const r=find(c);if(r)return r;}};
    const n=find(globalThis.cc.director.getScene());
    if(!n) throw new Error('Missing UI node '+name);
    const r=document.querySelector('canvas').getBoundingClientRect(),size=globalThis.cc.view.getVisibleSize(),p=n.worldPosition;
    return {x:r.left+(.5+p.x/size.width)*r.width,y:r.top+(.5-p.y/size.height)*r.height};
  },name);
}
async function click(page,name) {const p=await locate(page,name);await page.mouse.click(p.x,p.y);await sleep(160);}
async function has(page,name) {
  return page.evaluate(name=>{
    const find=n=>n.name===name&&n.activeInHierarchy||n.children.some(find);
    return !!find(globalThis.cc.director.getScene());
  },name);
}
async function wallet(page) {
  return page.evaluate(()=>{
    const find=(n,name)=>{if(n.name===name)return n;for(const c of n.children){const r=find(c,name);if(r)return r;}};
    const scene=globalThis.cc.director.getScene();
    return ['gold','diamond'].map(cur=>{
      const row=find(scene,'resource:'+cur),t=row._uiProps.uiTransformComp;
      const icon=row.children.find(n=>n.name.startsWith('art:'));
      const transform=icon._uiProps.uiTransformComp;
      const amount=row.getChildByName('resourceAmount'),amountT=amount._uiProps.uiTransformComp;
      const add=row.getChildByName('resourceAdd:'+cur);
      return {cur,uuid:row.uuid,x:row.worldPosition.x,y:row.worldPosition.y,w:t.width,h:t.height,
        icon:icon.name,loaded:!!icon.getComponent(globalThis.cc.Sprite).spriteFrame,
        iconLeft:icon.position.x-transform.width/2,iconRight:icon.position.x+transform.width/2,
        textLeft:amount.position.x-amountT.width/2,textRight:amount.position.x+amountT.width/2,
        plusLeft:add.position.x-add._uiProps.uiTransformComp.width/2,
        plusRight:add.position.x+add._uiProps.uiTransformComp.width/2,plus:!!add};
    });
  });
}
async function shopLayout(page) {
  const geometry=await page.evaluate(()=>{
    const find=(n,name)=>{if(n.name===name)return n;for(const c of n.children){const r=find(c,name);if(r)return r;}};
    const scene=globalThis.cc.director.getScene();
    const sign=find(scene,'shopSign'),art=find(find(scene,'shopSplash'),'art:scenes/bg_shop_comic_v1');
    const title=sign.children.find(n=>n.getComponent(globalThis.cc.Label)?.string==='商店');
    const back=find(scene,'shopShelfBackdrop'),shelf=find(scene,'shopShelfPanel'),gold=find(scene,'resource:gold');
    const size=n=>n._uiProps.uiTransformComp;
    return {signU:.5+(sign.worldPosition.x-art.worldPosition.x)/size(art).width,
      signV:.5-(sign.worldPosition.y-art.worldPosition.y)/size(art).height,
      titleRight:title.worldPosition.x+size(title).width/2,walletLeft:gold.worldPosition.x-size(gold).width/2,
      backdropWidth:size(back).width,shelfWidth:size(shelf).width,
      sameVerticalCoverage:back.worldPosition.y===shelf.worldPosition.y&&size(back).height===size(shelf).height};
  });
  assert(geometry.signU>.20&&geometry.signU<.25&&geometry.signV>.30&&geometry.signV<.40,'Title must sit inside the illustrated plank');
  assert(geometry.titleRight<geometry.walletLeft,'Title and wallet must not overlap');
  assert(geometry.backdropWidth>=750&&geometry.backdropWidth>geometry.shelfWidth&&geometry.sameVerticalCoverage,'Backing must cover both shelf edges');
  return geometry;
}
async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(()=>{
    const s=globalThis.cc?.director?.getScene();
    const find=n=>n.name==='resource:diamond'||n.children.some(find);
    return !!s&&find(s);
  },null,{timeout:60000});
  await click(page,'tab0');
  await page.waitForFunction(()=>{
    const s=globalThis.cc.director.getScene();
    const walk=n=> {
      if(n.name.startsWith('art:shop_comic_v1/')||n.name==='art:scenes/bg_shop_comic_v1') {
        if(!n.getComponent(globalThis.cc.Sprite)?.spriteFrame)return false;
      }
      return n.children.every(walk);
    };
    return walk(s);
  },null,{timeout:45000});
  await sleep(800);
}
async function artLoaded(page) {
  await page.waitForFunction(()=>{
    const walk=n=>(!n.name.startsWith('art:shop_comic_v1/')||!!n.getComponent(globalThis.cc.Sprite)?.spriteFrame)&&n.children.every(walk);
    return walk(globalThis.cc.director.getScene());
  },null,{timeout:30000});
  await sleep(240);
}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
  const errors=[],failures=[],checks=[];
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(data=>localStorage.setItem('kw_save_v1',JSON.stringify(data)),save());
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await ready(page);
  await page.screenshot({path:path.join(OUT,'shop-initial.png')});
  const initialWallet=await wallet(page);
  assert(initialWallet.every(w=>w.loaded&&w.plus&&w.w<240&&w.iconLeft>=-w.w/2&&w.plusRight<=w.w/2
    &&w.textLeft-w.iconRight>=0&&w.textLeft-w.iconRight<=10&&w.textRight<w.plusLeft));
  assert(initialWallet[0].x>=0&&initialWallet[1].x>initialWallet[0].x,'Wallet must align to the right');
  assert.equal(initialWallet[1].x+initialWallet[1].w/2,343);
  checks.push({layout:'title on plank, compact right wallet, full-width shelf backing',geometry:await shopLayout(page)});
  for(const tab of ['weapon','hero','equip','mat']){
    await click(page,'shopTab:'+tab);await artLoaded(page);
    await page.screenshot({path:path.join(OUT,'shop-'+tab+'.png')});
    const count=await page.evaluate(()=>{
      const walk=n=>(n.name.startsWith('shopItem:')?1:0)+n.children.reduce((s,c)=>s+walk(c),0);
      return walk(globalThis.cc.director.getScene());
    });
    assert.equal(count,{weapon:2,hero:5,equip:4,mat:4}[tab]);
    checks.push({tab,count,allIllustrationsLoaded:true});
    if(tab==='hero') {
      const portraits=await page.evaluate(()=>{
        const frames=[],walk=n=>{if(n.name==='comicPortrait')frames.push(n);n.children.forEach(walk);};
        walk(globalThis.cc.director.getScene());
        return frames.map(frame=>{const t=frame._uiProps.uiTransformComp,clip=frame.getChildByName('portraitClip');
          const mask=clip?.getComponent(globalThis.cc.Mask),ct=clip?._uiProps.uiTransformComp;
          return {width:t.width,height:t.height,hasArtwork:!!clip,circularMask:!!mask&&mask.type===1&&ct.width===ct.height};});
      });
      assert.equal(portraits.length,5);
      assert(portraits.every(p=>p.width===p.height&&(!p.hasArtwork||p.circularMask)));
      assert.equal(portraits.filter(p=>p.hasArtwork).length,4);
      checks.push({heroPortraits:portraits});
    }
  }
  await click(page,'shopTab:weapon');
  await click(page,'shopBuy:s_wpn_bow');
  assert(await has(page,'shopPurchaseDialog'));
  await page.screenshot({path:path.join(OUT,'shop-purchase.png')});
  await click(page,'shopPurchaseConfirm');
  let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));
  assert.equal(data.diamonds,499200);assert.equal(data.equips.length,1);
  assert.equal(data.equips[0].defId,'wpn_bow');
  assert.equal(data.heroes.archer.worn.weapon,data.equips[0].uid);
  assert(await has(page,'shopTab:weapon'));checks.push({purchase:'weapon',charged:800,autoEquipped:true});

  await click(page,'shopTab:mat');await click(page,'shopBuy:s_mat_stone');
  await click(page,'shopPurchaseCancel');
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));
  assert.equal(data.gold,500000);assert.equal(data.bag.mat_stone,undefined);
  await click(page,'shopBuy:s_mat_stone');await click(page,'shopPurchaseConfirm');
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));
  assert.equal(data.gold,499950);assert.equal(data.bag.mat_stone,1);
  checks.push({purchase:'material',cancelDoesNotCharge:true,charged:50,quantity:1});

  await click(page,'shopTab:hero');await artLoaded(page);
  await click(page,'shopBuy:s_hero_pyro');await artLoaded(page);
  await page.screenshot({path:path.join(OUT,'shop-hero-purchase.png')});
  await click(page,'shopPurchaseConfirm');await artLoaded(page);
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));
  assert.equal(data.diamonds,496400);assert(data.heroes.pyro.owned);
  assert(await has(page,'shopBuy:s_hero_pyro'));
  await click(page,'shopBuy:s_hero_pyro');
  assert(!(await has(page,'shopPurchaseDialog')));
  await page.screenshot({path:path.join(OUT,'shop-owned.png')});
  checks.push({purchase:'hero',charged:2800,ownedHeroCannotRepurchase:true});

  for(let tab=1;tab<=4;tab++){
    await click(page,'tab'+tab);
    const current=await wallet(page);
    assert(current.every((w,i)=>w.uuid===initialWallet[i].uuid&&w.x===initialWallet[i].x&&w.y===initialWallet[i].y&&w.plus));
  }
  checks.push({sharedWallet:'same nodes and geometry on all 5 pages'});
  await click(page,'tab0');await click(page,'resourceAdd:gold');
  assert(await has(page,'comicDialog'));await click(page,'btn_close');
  assert(!(await has(page,'comicDialog')));checks.push({resourcePlus:'opens and closes correctly'});

  const small=await browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:2,hasTouch:true});
  await small.addInitScript(data=>localStorage.setItem('kw_save_v1',JSON.stringify(data)),save('1-1',false));
  const smallPage=await small.newPage();smallPage.on('pageerror',e=>errors.push(e.message));
  await ready(smallPage);
  await click(smallPage,'shopBuy:s_wpn_crossbow');
  assert(!(await has(smallPage,'shopPurchaseDialog')));
  await click(smallPage,'shopBuy:s_wpn_bow');await click(smallPage,'shopPurchaseConfirm');
  assert(await has(smallPage,'shopPurchaseDialog'));
  assert(await has(smallPage,'comicToast'));
  data=await smallPage.evaluate(()=>JSON.parse(localStorage.getItem('kw_save_v1')));
  assert.equal(data.diamonds,0);assert.equal(data.equips.length,0);
  await click(smallPage,'shopPurchaseCancel');
  await click(smallPage,'shopTab:mat');await artLoaded(smallPage);
  await sleep(1700);
  await smallPage.screenshot({path:path.join(OUT,'shop-small-locked.png')});
  const geometry=await smallPage.evaluate(()=>{
    const cc=globalThis.cc;
    const find=(n,name)=>{if(n.name===name)return n;for(const c of n.children){const r=find(c,name);if(r)return r;}};
    const s=cc.director.getScene(),size=cc.view.getVisibleSize(),wallet=find(s,'resource:gold'),tabs=find(s,'shopTabs');
    const height=n=>n._uiProps.uiTransformComp.height;
    return {walletTop:size.height/2-wallet.worldPosition.y-height(wallet)/2,
      tabsBottom:tabs.worldPosition.y-height(tabs)/2,navTop:find(s,'tab0').worldPosition.y+52,
      hasDarkSeats:!!find(s,'shopItemRays'),hasOldArt:!!find(s,'art:ui_card_shop')};
  });
  assert(geometry.walletTop>=92);
  assert(!geometry.hasDarkSeats&&!geometry.hasOldArt);
  checks.push({smallViewport:[375,667],lockedItemDoesNotOpenPurchase:true,insufficientFundsDoesNotCharge:true,geometry,shopLayout:await shopLayout(smallPage)});
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(failures.length,0,JSON.stringify(failures));
  const result={ok:true,url:URL,checks,errors,failures,wallet:initialWallet};
  fs.writeFileSync(path.join(OUT,'ui-validation.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,screenshots:9,errors:errors.length}));
  await browser.close();
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
