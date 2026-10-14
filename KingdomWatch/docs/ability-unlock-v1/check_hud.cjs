/* Real engine and artwork composition only: no waves, mobs or BattleDirector.start(). */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/',OUT=__dirname,checks=[],errors=[],failed=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
async function state(p){return p.evaluate(()=>{
  const {d,hud}=window.__abilityQA;
  return d.heroes.map((h,i)=>{
    const s=hud.skills[i],u=hud.ults[i];
    return {id:h.id,x:h.x,y:h.node.position.y,atkX:s.atkIcon.worldPosition.x,atkY:s.atkIcon.worldPosition.y,
      skill:s.root.activeInHierarchy,ult:u.root.activeInHierarchy,skillX:s.icon.worldPosition.x,skillCd:s.cdTxt.activeInHierarchy,
      ultX:u.btn.worldPosition.x,ultY:u.btn.worldPosition.y,charge:h.charge,skillLearned:h.skillUnlocked,ultLearned:h.ultUnlocked,
      attackArt:!!s.atkIcon.getChildByName('art:ui_icon_atk_'+h.id)?.getComponent(cc.Sprite)?.spriteFrame,
      skillArt:!!s.icon.getChildByName('art:ui_icon_skill_'+h.id)?.getComponent(cc.Sprite)?.spriteFrame,
      hiddenSkillChildren:s.root.children.every(n=>!n.activeInHierarchy),hiddenUltChildren:u.root.children.every(n=>!n.activeInHierarchy)};
  });
});}
async function select(p,id){return p.evaluate(id=>{
  const {d}=window.__abilityQA;d.gmLearnCard(id,1);return d.stacks[id]||0;
},id);}
async function compose(width,height,owners){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(()=>localStorage.setItem('kw_save_v1',JSON.stringify({debug:false,music:false,sfx:false})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(URL);await page.waitForFunction(()=>!!globalThis.cc?.director?.getScene(),null,{timeout:60000});
  await page.waitForFunction(()=>{const walk=n=>n.name==='tab2'||n.children.some(walk);return walk(cc.director.getScene());},null,{timeout:45000});
  await page.evaluate(async owners=>{
    const imports=await Promise.all(['Hero','Cards','HUD','BattleDirector','LineDefense','Mobs','UIKit','Panels'].map(n=>System.import('chunks:///_virtual/'+n+'.ts')));
    const [H,C,U,D,L,M,K,P]=imports,scene=cc.director.getScene();
    const find=n=>n.name==='Canvas'?n:n.children.map(find).find(Boolean),canvas=find(scene);if(!canvas)throw Error('Canvas not found');
    for(const n of canvas.children)if(!n.getComponent(cc.Camera))n.active=false;
    const root=new cc.Node('AbilityQA');root.setParent(canvas);root.setPosition(0,0,0);
    const field=new cc.Node('Field');field.setParent(root);const line=new L.LineDefense(field,1000);
    const heroLayer=new cc.Node('Heroes');heroLayer.setParent(field);
    const slots=M.heroSlots(owners.length),ctors={archer:H.ArcherHero,sniper:H.SniperHero,pyro:H.PyroHero,volt:H.VoltHero,mora:H.FrostHero};
    const bases={archer:C.baseArcherStats,sniper:C.baseSniperStats,pyro:C.basePyroStats,volt:C.baseVoltStats,mora:C.baseMoraStats};
    const heroes=owners.map((id,i)=>new ctors[id](heroLayer,slots[i],bases[id]()));
    const d=Object.create(D.BattleDirector.prototype);
    Object.assign(d,{heroes,line,levelDef:M.LEVEL_1_1,elapsed:0,heroLevel:1,xp:0,state:'running',global:{xpMul:1,goldMul:1,lineRegenPct:0},stacks:{},pickQueue:0});
    const ui=new cc.Node('UIRoot');ui.setParent(root);const hud=new U.HUD(ui,d,field);d.hud=hud;
    const panels=new P.Panels(ui,d);d.panels=panels;
    K.setLayerDeep(root,cc.Layers.Enum.UI_2D);hud.sync();hud.setWave(1,10);
    window.__abilityQA={root,d,hud,panels,C,K};
  },owners);
  await page.waitForFunction(()=>window.__abilityQA.d.heroes.every(h=>h.art?.loaded),null,{timeout:45000});
  await wait(1200);
  return {page,context};
}
async function capture(page,name){await wait(500);await page.screenshot({path:path.join(OUT,(process.env.KW_QA_URL?'online-':'')+name+'.png')});}
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge',...(process.env.KW_QA_PROXY?{proxy:{server:process.env.KW_QA_PROXY}}:{})});
  for(const [w,h,owners] of [[430,932,['mora','sniper','pyro','volt']],[375,667,['archer']]]){
    const {page:p,context}=await compose(w,h,owners),initial=await state(p);
    for(const s of initial){assert(!s.skill&&!s.ult&&s.hiddenSkillChildren&&s.hiddenUltChildren,JSON.stringify(s));assert.equal(s.atkX,s.x);assert.equal(s.atkY,s.y-82);assert(s.attackArt&&s.skillArt,JSON.stringify(s));}
    checks.push({viewport:[w,h],initial});await capture(p,'entry-'+w);
    // Valid first-run cards; use the actual animated choice callback and director routing.
    await p.evaluate(()=>{
      const q=window.__abilityQA,cards=q.C.ABILITY_CARDS.filter(c=>c.owner===q.d.heroes[0].id);
      q.d.state='running';q.d.pickQueue=1;q.d.openPick();
      q.panels.showPick([cards[0],cards[1],q.C.M0_POOL.find(c=>c.id==='xp_badge')],q.d.stacks,q.d.pickOpts);
    });
    await wait(900);
    const cardState=await p.evaluate(()=>{
      const q=window.__abilityQA,frames=[];
      const collect=n=>{if(n.name.startsWith('pickCard:'))frames.push(n);for(const child of n.children)collect(child);};
      collect(q.panels.modalRoot);
      const walk=n=>{if(n.name.startsWith('art:ui_icon_')&&n.getComponent(cc.Sprite)?.spriteFrame)return n.name;return n.children.map(walk).find(Boolean);};
      const n=frames[0],r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize(),p=n.worldPosition;
      return {art:frames.slice(0,2).map(walk),x:r.left+(.5+p.x/v.width)*r.width,y:r.top+(.5-p.y/v.height)*r.height};
    });assert(cardState.art.every(Boolean),JSON.stringify(cardState));
    await capture(p,'unlock-cards-'+w);await p.mouse.click(cardState.x,cardState.y);await wait(800);
    const afterChoice=await state(p);assert(afterChoice[0].skill);assert(!afterChoice[0].ult);
    assert.equal(await p.evaluate(()=>window.__abilityQA.d.state),'running');
    checks.push({cardArt:cardState.art,animatedChoiceUnlocksSkill:true});
    const id=owners[owners.length-1];assert.equal(await select(p,id+'_unlock_ult'),1);
    let unlocked=await state(p);assert.equal(unlocked.filter(s=>s.ult).length,1);
    assert.equal(unlocked.at(-1).atkX,unlocked.at(-1).x-(owners.length===1?40:0));assert.equal(unlocked.at(-1).skill,owners.length===1);assert.equal(unlocked.at(-1).charge,0);
    assert.equal(await select(p,owners[0]+'_unlock_skill'),1);unlocked=await state(p);
    assert(unlocked[0].skill);assert.equal(unlocked[0].atkX,unlocked[0].x-40);assert.equal(unlocked[0].skillX,unlocked[0].x+40);
    if(owners.length>1){assert.equal(await select(p,owners[0]+'_unlock_ult'),1);unlocked=await state(p);assert.equal(unlocked[0].ultY-unlocked.at(-1).ultY,-110);}
    await p.evaluate(()=>{const q=window.__abilityQA;q.d.heroes[0].skillCd=6;q.hud.sync();});assert((await state(p))[0].skillCd);
    checks.push({viewport:[w,h],unlocked:await state(p)});await capture(p,'learned-'+w);
    await context.close();
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
  const report={passed:true,url:URL,realBattleStarted:false,checks,errors,failed};
  fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-hud-validation.json':'hud-validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,groups:checks.length,errors,failed}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
