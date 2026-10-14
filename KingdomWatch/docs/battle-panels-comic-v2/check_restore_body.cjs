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
