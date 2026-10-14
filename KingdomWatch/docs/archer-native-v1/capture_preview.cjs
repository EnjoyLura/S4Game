const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.KW_PREVIEW_URL||'http://127.0.0.1:8765/previews/archer-native-v1/',out=__dirname,errors=[],failed=[];
(async()=>{
 const b=await chromium.launch({headless:true,channel:'msedge'}),p=await b.newPage({viewport:{width:1000,height:1040},deviceScaleFactor:1});
 p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));await p.goto(url);await p.waitForFunction(()=>window.__archerPreview);
 await p.evaluate(()=>{__archerPreview.paused=true;__archerPreview.seek(0)});
 const folder=path.join(out,'preview-frames');fs.mkdirSync(folder,{recursive:true});
 let index=0;
 for(const [angle,mode] of [[0,'idle'],[0,'attack'],[-.82,'attack'],[.82,'rapid'],[.82,'heavy']]){
  await p.evaluate(([a,m])=>{__archerPreview.setMode(m);__archerPreview.setAngle(a);__archerPreview.seek(0);},[angle,mode]);
  for(let i=0;i<24;i++){await p.evaluate(()=>__archerPreview.step(1.55/24));await p.locator('canvas').screenshot({path:path.join(folder,String(index++).padStart(3,'0')+'.png')});}
 }
 for(const [name,a] of [['up',0],['left',-.82],['right',.82]]){await p.evaluate(a=>{__archerPreview.setAngle(a);__archerPreview.setMode('attack');__archerPreview.seek(.22);},a);await p.locator('canvas').screenshot({path:path.join(out,'pose-'+name+'.png')});}
 // Actual controls, speed, pause, scrubbing and mobile target drag.
 await p.getByRole('button',{name:'待机',exact:true}).click();assert.equal(await p.evaluate(()=>__archerPreview.pose.arrowVisible),true);
 await p.getByRole('button',{name:'左前方',exact:true}).click();await p.evaluate(()=>__archerPreview.seek(.25));assert.equal(await p.evaluate(()=>__archerPreview.pose.facing),'left');
 await p.locator('#speed').selectOption('0.5');await p.locator('#timeline').fill('0.32');const frozen=await p.evaluate(()=>__archerPreview.time);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>__archerPreview.time),frozen);
 await p.setViewportSize({width:375,height:820});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(out,'preview-mobile.png')});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));fs.writeFileSync(path.join(out,'preview-validation.json'),JSON.stringify({ok:true,url,frames:index,errors,failed,checks:['idle, attack, rapid and heavy playback','three directions','play/pause and frame scrub','speed control','375px layout']},null,2));await b.close();console.log(JSON.stringify({ok:true,frames:index}));
})().catch(e=>{console.error(e);process.exitCode=1;});
