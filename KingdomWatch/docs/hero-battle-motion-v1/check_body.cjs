(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
 for(const [w,h] of (process.env.KW_ONLINE_SMOKE?[[375,600]]:[[430,932],[375,600],[430,760]])){
  const {page:p,context}=await compose(w,h);
  // Use all party sizes, including four damage rows, without spawning waves.
  for(const count of [1,2,3,4]){
   await p.evaluate(count=>{
    const q=__panelsQA;if(!q.allRows)q.allRows=q.d.dmgSvc.rows();
    q.d.dmgSvc.rows=()=>q.allRows.slice(0,count);
    q.panels.showPause({music:false,sfx:false,speed:1,speedUnlocked:true,xp:28,onToggle:()=>{},onResume:()=>{},onExit:()=>{},tab:1});
   },count);await loaded(p);
   const geometry=await p.evaluate(()=>{
    const q=__panelsQA,v=cc.view.getVisibleSize(),rows=q.panels.modalRoot.children.filter(n=>n.name.startsWith('pauseDamageRow:'));
    const bounds=n=>{
     const boxes=[],walk=n=>{const t=n._uiProps.uiTransformComp;if(n.activeInHierarchy&&t&&[cc.Label,cc.Sprite,cc.Graphics].some(c=>n.getComponent(c)?.enabled))boxes.push([v.height/2-n.worldPosition.y-t.height*Math.abs(n.worldScale.y)/2,v.height/2-n.worldPosition.y+t.height*Math.abs(n.worldScale.y)/2]);n.children.forEach(walk);};walk(n);
     return {id:n.name,top:Math.min(...boxes.map(b=>b[0])),bottom:Math.max(...boxes.map(b=>b[1]))};
    };
    return {rows:rows.map(bounds),tabs:bounds(q.panels.modalRoot.children.find(n=>n.name==='tabseg0'))};
   });assert.equal(geometry.rows.length,count);
   geometry.rows.forEach((r,i)=>{assert(r.top>=514,JSON.stringify(geometry));assert(r.bottom<=geometry.tabs.top-12,JSON.stringify(geometry));if(i)assert(r.top>geometry.rows[i-1].bottom+3,JSON.stringify(geometry));});
   if(count===4)await shot(p,'pause-four-'+h);
  }
  await p.evaluate(()=>{const q=__panelsQA;q.d.dmgSvc.rows=()=>q.allRows;q.panels.closeAll();});
  const health=await node(p,'lineHealthBar');const oldHealthBottom=h*750/w-186;
  assert(Math.abs(health.y-(h-(208*w/750)))<1,JSON.stringify(health));
  assert(health.y<h-186*w/750);assert.equal(health.w,640);
  checks.push({viewport:[w,h],pause:'1–4 rows clear subtitle, one another and tabs by at least 12px',health:'whole health/shield group raised 22 design pixels'});
  if(!process.env.KW_ONLINE_SMOKE&&w===430&&h===932){
   await p.evaluate(async()=>{
    const q=__panelsQA,H=await System.import('chunks:///_virtual/Hero.ts'),K=await System.import('chunks:///_virtual/UIKit.ts');
    q.sniperProbe=new H.SniperHero(q.root,-300,q.C.baseSniperStats());q.sniperProbe.node.active=false;
    q.motionHeroes=[...q.d.heroes,q.sniperProbe];
   });
   await p.waitForFunction(()=>__panelsQA.motionHeroes.every(h=>h.art.loaded&&h.art.sprite.customMaterial),null,{timeout:15000});
   const motionChecks=await p.evaluate(()=>{
    const q=__panelsQA,out=[];
    for(const h of q.motionHeroes){
     const pos={x:h.node.position.x,y:h.node.position.y},sf=h.art.sprite.spriteFrame;
     const initial=[h.art.node.position.x,h.art.node.position.y,h.art.node.angle,h.art.node.scale.x,h.art.node.scale.y];
     const frames=[],properties=[],step=dt=>{h.tickPose(dt);const b=h.art.sprite.customMaterial.getProperty('bodyMotion'),a=h.art.sprite.customMaterial.getProperty('armMotion');properties.push([b.x,b.y,b.z,b.w,a.x]);frames.push(h.art.sprite.spriteFrame);};
     for(let i=0;i<30;i++)step(1/60);
     h.animateAttack();for(let i=0;i<36;i++)step(1/60);
     const kickAfter=Math.abs(h.motion.kick);
     h.animateAttack(true);for(let i=0;i<6;i++)step(1/60);h.animateAttack(false);for(let i=0;i<60;i++)step(1/60);
     let maxDelta=0;for(let i=1;i<properties.length;i++)for(let j=0;j<5;j++)maxDelta=Math.max(maxDelta,Math.abs(properties[i][j]-properties[i-1][j]));
     out.push({id:h.id,hasMotion:properties.some(p=>Math.abs(p[1])>.001),frameStable:frames.every(f=>f===sf),nodeStable:initial.every((v,i)=>v===[h.art.node.position.x,h.art.node.position.y,h.art.node.angle,h.art.node.scale.x,h.art.node.scale.y][i]),
      simulationOriginStable:h.node.position.x===pos.x&&h.node.position.y===pos.y,maxDelta,kickAfter,recovered:Math.abs(h.motion.kick)<.01});
    }
    return out;
   });
   motionChecks.forEach(r=>{assert(r.hasMotion&&r.frameStable&&r.nodeStable&&r.simulationOriginStable&&r.recovered,JSON.stringify(r));assert(r.maxDelta<.04,JSON.stringify(r));});
   checks.push({heroMotion:motionChecks});
   // Real Hero.tick, fixed target, projectile recording: verify cadence and source origins.
   const combat=await p.evaluate(async()=>{
    const q=__panelsQA,G=await System.import('chunks:///_virtual/GameConfig.ts'),out=[];
    for(const h of q.motionHeroes){
     const events=[],target={x:h.x+40,y:G.HERO_Y+300,dead:false,state:'attack',immobilized:false,slowT:0,def:{speed:50},hp:100000,maxHp:100000};
     const mgr={list:[target],pickTarget:()=>target,anyInRange:()=>false};
     const projs={fire:s=>events.push({x:s.x,y:s.y,time:clock,hero:s.heroId}),sparkAt:()=>{},arrowRelease:()=>true,fireCraters:()=>[]};
     h.atkT=0;let clock=0;for(let i=0;i<240;i++){clock=i/60;h.tick(1/60,mgr,projs,q.d.dmgSvc);}
     const gap=1/h.stats.aspd;out.push({id:h.id,shots:events.length,expected:Math.ceil(4/gap),origin:events.every(e=>e.x===h.x&&e.y===G.HERO_Y+60),intervals:events.slice(1).map((e,i)=>e.time-events[i].time),gap,skill:h.skillUnlocked,ult:h.ultUnlocked});
    }
    return out;
   });combat.forEach(r=>{assert(Math.abs(r.shots-r.expected)<=1&&r.origin&&!r.skill&&!r.ult,JSON.stringify(r));r.intervals.forEach(t=>assert(Math.abs(t-r.gap)<=1/60+1e-6));});
   checks.push({combatCadence:combat});
   // Observe actual GPU output, not just node transforms, in a controlled pose timeline.
   await p.evaluate(()=>{const q=__panelsQA;q.d.heroes.forEach(h=>{h.poseTarget=null;h.motion.age=10;h.motion.kick=0;h.motion.brace=0;h.motion.aim=0;h.tickPose(0);});});
   await sleep(100);const before=await p.screenshot();
   const regions=await p.evaluate(()=>{
    const r=document.querySelector('canvas').getBoundingClientRect(),v=cc.view.getVisibleSize();
    return __panelsQA.d.heroes.map(h=>{const n=h.art.node,t=n._uiProps.uiTransformComp;return {id:h.id,x:r.left+(v.width/2+n.worldPosition.x-t.width/2)*r.width/v.width,y:r.top+(v.height/2-n.worldPosition.y-t.height)*r.height/v.height,w:t.width*r.width/v.width,h:t.height*r.height/v.height};});
   });
   await p.evaluate(()=>__panelsQA.d.heroes.forEach(h=>{h.animateAttack(true);for(let i=0;i<6;i++)h.tickPose(1/60);}));await sleep(100);const after=await p.screenshot();
   const pixelChecks=[];
   for(const region of regions){
    const area=part=>({left:Math.round(region.x*2),top:Math.round((region.y+region.h*(part==='feet'?.905:.08))*2),width:Math.floor(region.w*2),height:Math.max(2,Math.floor(region.h*(part==='feet'?.065:.7)*2))});
    const diff=async part=>{const a=await sharp(before).extract(area(part)).raw().toBuffer(),b=await sharp(after).extract(area(part)).raw().toBuffer();let changed=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>3)changed++;return {changed,total:a.length};};
    const feet=await diff('feet'),body=await diff('body');assert(feet.changed/feet.total<.02,JSON.stringify({id:region.id,feet}));assert(body.changed/body.total>.01,JSON.stringify({id:region.id,body}));pixelChecks.push({id:region.id,feet,body});
   }
   checks.push({gpuPixelChecks:pixelChecks});
   const frames=path.join(OUT,'motion-frames');fs.mkdirSync(frames,{recursive:true});
   await p.evaluate(()=>{const q=__panelsQA;const old=q.d.heroes[0];old.node.active=false;q.sniperProbe.node.active=true;q.sniperProbe.node.setPosition(old.x,old.node.position.y,0);q.previewHeroes=[q.sniperProbe,...q.d.heroes.slice(1)];q.previewHeroes.forEach(h=>{h.poseTarget=null;h.motion.kick=0;h.motion.age=10;h.motion.aim=0;});});
   const top=Math.floor((932-260*430/750)*2),clip={x:0,y:top/2,width:430,height:932-top/2};
   for(let i=0;i<36;i++){
    await p.evaluate(i=>{const q=__panelsQA;q.previewHeroes.forEach((h,j)=>{const f=(i+j*4)%24;if(f===4)h.animateAttack(j>1);h.motion.tick(1/18,f<4?f/4:0,0);});},i);
    await sleep(35);await p.screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png'),clip});
   }
   await shot(p,'hero-combat-ready');
  }
  await context.close();
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 const report={ok:true,url:URL,realBattleStarted:false,checks,errors,failed};
 fs.writeFileSync(path.join(OUT,process.env.KW_QA_URL?'online-validation.json':'ui-validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,errors,failed}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});
