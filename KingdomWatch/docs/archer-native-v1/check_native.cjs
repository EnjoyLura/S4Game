/* Real Cocos nodes and Hero callbacks on a static field; no waves or save mutation. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const URL=process.env.KW_QA_URL||'http://127.0.0.1:8765/',OUT=__dirname,errors=[],failed=[],checks=[];
let browser;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge',...(process.env.KW_QA_PROXY?{proxy:{server:process.env.KW_QA_PROXY}}:{})});
 for(const [width,height] of [[430,932],[375,600]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true});
  await context.addInitScript(()=>localStorage.setItem('kw_save_v1',JSON.stringify({gold:500,diamonds:10,debug:false,music:false,sfx:false,squad:['archer','pyro','volt','mora']})));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await p.goto(URL);await p.waitForFunction(()=>{const s=globalThis.cc?.director?.getScene(),walk=n=>n.name==='tab2'||n.children.some(walk);return s&&walk(s);},null,{timeout:60000});
  await p.evaluate(async()=>{
   const [H,C,K,L,G,U,D,DS,P,M,V]=await Promise.all(['Hero','Cards','UIKit','LineDefense','GameConfig','HUD','BattleDirector','DamageService','Panels','Mobs','Ux'].map(n=>System.import('chunks:///_virtual/'+n+'.ts')));
   const canvas=cc.director.getScene().getChildByName('Canvas');for(const n of canvas.children)if(!n.getComponent(cc.Camera))n.active=false;
   const root=K.N('ArcherNativeQA',canvas),field=K.N('Field',root),line=new L.LineDefense(field,1000),layer=K.N('Heroes',field);
   const visible=[-240,0,240].map(x=>new H.ArcherHero(layer,x,C.baseArcherStats()));
   const hidden=K.N('OtherHeroes',field);hidden.active=false;
   const other=[new H.SniperHero(hidden,0,C.baseSniperStats()),new H.PyroHero(hidden,0,C.basePyroStats()),new H.VoltHero(hidden,0,C.baseVoltStats()),new H.FrostHero(hidden,0,C.baseMoraStats())];
   const dmgSvc=new DS.DamageService(),d=Object.create(D.BattleDirector.prototype);Object.assign(d,{heroes:[visible[1],...other.slice(1)],line,dmgSvc,levelDef:M.LEVEL_1_1,elapsed:47,heroLevel:3,xp:28,goldEarned:570,speed:1,state:'running',global:{xpMul:1,goldMul:1,lineRegenPct:0},stacks:{},pickQueue:0,ultShowT:0});
   d.heroes.forEach((h,i)=>{dmgSvc.register(h.id,h.name);dmgSvc.add(h.id,[123456,60500,47020,21100][i]);});
   const ui=K.N('UIRoot',root),hud=new U.HUD(ui,d,field);d.hud=hud;const panels=new P.Panels(ui,d);d.panels=panels;hud.sync();hud.setWave(4,10);
   for(const [i,x] of [-250,-110,100,240].entries())V.artAtlasSprite(field,x,180-i*50,92,122,'battle_mobs_v2','goblin_worker');
   K.setLayerDeep(root,cc.Layers.Enum.UI_2D);window.__archerQA={root,field,visible,other,hud,panels,d,C,G,H,layer,dmgSvc};
  });
  await p.waitForFunction(()=>__archerQA.visible.every(h=>h.nativeArcher.loaded)&&__archerQA.other.every(h=>h.art.loaded&&h.art.sprite.customMaterial),null,{timeout:90000});await sleep(200);
  const integration=await p.evaluate(()=>{
   const q=__archerQA,h=q.visible[1],n=h.nativeArcher;return {loaded:n.loaded,parts:n.node.children.filter(n=>n.name.startsWith('archerPart:')).length,foot:[n.node.position.x,n.node.position.y],noOldAtlas:h.art===null,fallbackDisabled:!h.node.getComponent(cc.Graphics).enabled};
  });assert(integration.loaded&&integration.noOldAtlas&&integration.fallbackDisabled);assert.equal(integration.parts,12);assert.deepEqual(integration.foot,[0,-76]);
  const combat=await p.evaluate(()=>{
   const q=__archerQA,h=q.visible[1],target={x:h.x+80,y:q.G.HERO_Y+340,dead:false,state:'attack',immobilized:false,slowT:0,def:{speed:50},hp:1e6,maxHp:1e6},mgr={list:[target],pickTarget:()=>target,anyInRange:()=>false};
   const shots=[],rows=[],projs={fire:s=>shots.push({...s,time:clock}),arrowRelease:()=>{rows.push(clock);return true;},sparkAt:()=>{}};
   h.stats.aspd=2;h.stats.serial=2;h.stats.fan=1;h.atkT=0;h.serialQueue=[];h.volleyQueue=[];
   const before=h.nativeArcher.model.releases;let clock=0;
   for(let i=0;i<240;i++){clock=i/60;h.tick(1/60,mgr,projs,q.dmgSvc);}
   const count=h.nativeArcher.model.releases-before,foot=h.nativeArcher.node.position.clone(),pos=h.node.position.clone();
   const genericBefore=h.nativeArcher.model.releases;h.animateAttack();h.animateAttack(true);const genericNoRelease=h.nativeArcher.model.releases===genericBefore;
   const lockedUlt=!h.castUlt(mgr,projs,q.dmgSvc);
   h.atkT=Infinity;h.serialQueue=[];h.volleyQueue=[];h.stats.ultUnlocked=true;h.charge=h.chargeGoal;
   const ultBefore=h.nativeArcher.model.releases,shotsBefore=shots.length;h.castUlt(mgr,projs,q.dmgSvc);
   for(let i=0;i<60;i++){clock=4+i/60;h.tick(1/60,mgr,projs,q.dmgSvc);}
   return {rows:rows.filter(t=>t<4),shots:shotsBefore,releases:count,origin:shots.every(s=>s.x===h.x&&s.y===q.G.HERO_Y+60),genericNoRelease,lockedUlt,ultRows:h.nativeArcher.model.releases-ultBefore,ultArrows:shots.length-shotsBefore,positionStable:h.node.position.equals(pos)&&h.nativeArcher.node.position.equals(foot)};
  });assert.equal(combat.rows.length,24);assert.equal(combat.shots,48);assert.equal(combat.releases,24);assert(combat.origin&&combat.genericNoRelease&&combat.lockedUlt&&combat.positionStable);assert.equal(combat.ultRows,2);assert.equal(combat.ultArrows,16);
  for(let i=0;i<combat.rows.length;i+=3){if(i)assert(Math.abs(combat.rows[i]-combat.rows[i-3]-.5)<1/60+.001);assert(Math.abs(combat.rows[i+1]-combat.rows[i]-.12)<1/60+.001);assert(Math.abs(combat.rows[i+2]-combat.rows[i]-.24)<1/60+.001);}
  const old=await p.evaluate(()=>__archerQA.other.map(h=>{const pos=h.node.position.clone(),sf=h.art.sprite.spriteFrame;h.animateAttack(true);for(let i=0;i<60;i++)h.tickPose(1/60);return {id:h.id,position:h.node.position.equals(pos),sprite:h.art.sprite.spriteFrame===sf,recovered:Math.abs(h.motion.kick)<.01};}));old.forEach(r=>assert(r.position&&r.sprite&&r.recovered));
  await p.evaluate(()=>{const q=__archerQA;for(const [i,h] of q.visible.entries()){const a=[-.82,0,.82][i];h.nativeArcher.model.age=10;for(let j=0;j<120;j++)h.nativeArcher.tick(1/120,.85,Math.sin(a),Math.cos(a));}});await sleep(100);
  const before=await p.screenshot(),region=await p.evaluate(()=>{const h=__archerQA.visible[1],n=h.nativeArcher.node,r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize();return {x:r.left+(v.width/2+n.worldPosition.x-32)*r.width/v.width,y:r.top+(v.height/2-n.worldPosition.y-15)*r.height/v.height,w:64*r.width/v.width,h:15*r.height/v.height};});
  const poseBefore=await p.evaluate(()=>__archerQA.visible[1].nativeArcher.model.clock);await sleep(100);assert.equal(await p.evaluate(()=>__archerQA.visible[1].nativeArcher.model.clock),poseBefore);
  await p.evaluate(()=>{const h=__archerQA.visible[1];h.nativeArcher.release(0,1);for(let j=0;j<8;j++)h.nativeArcher.tick(1/60,0,0,1);});await sleep(100);const after=await p.screenshot();
  const crop={left:Math.round(region.x*2),top:Math.round(region.y*2),width:Math.floor(region.w*2),height:Math.floor(region.h*2)},a=await sharp(before).extract(crop).raw().toBuffer(),b=await sharp(after).extract(crop).raw().toBuffer();let changed=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>3)changed++;assert(changed/a.length<.02,'feet move in rendered output');
  await p.screenshot({path:path.join(OUT,(process.env.KW_QA_URL?'online-':'')+'battle-'+height+'.png')});
  const health=await p.evaluate(()=>{const find=n=>n.name==='lineHealthBar'?n:n.children.map(find).find(Boolean),n=find(cc.director.getScene());return {width:n._uiProps.uiTransformComp.width,bottom:cc.view.getVisibleSize().height/2+n.worldPosition.y};});assert.equal(health.width,640);assert.equal(Math.round(health.bottom),208);
  checks.push({viewport:[width,height],integration,combat,otherHeroes:old,feetChangedRatio:changed/a.length,pausedClockStable:true,health});
  await context.close();
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 const report={ok:true,url:URL,realBattleStarted:false,checks,errors,failed};fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'game-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,viewports:checks.length,errors,failed}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
