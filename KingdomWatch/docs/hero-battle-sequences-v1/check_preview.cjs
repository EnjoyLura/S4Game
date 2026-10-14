const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1240,height:980},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:29279/review.html');
 await page.waitForFunction(()=>Object.values(images).every(im=>im.complete&&im.naturalWidth===2048));
 await page.locator('#play').click();
 await page.locator('#attack').click();
 await page.locator('#frame').fill('12');
 await page.screenshot({path:path.join(__dirname,'review-page-attack.png'),fullPage:true});
 const state=await page.evaluate(()=>({heroCount:document.querySelectorAll('.card').length,
    atlases:Object.values(images).map(im=>[im.naturalWidth,im.naturalHeight]),
    mode,playing,manual,readout:document.querySelector('#readout').textContent}));
 if(state.heroCount!==5||state.mode!=='attack'||state.playing||state.manual!==12||errors.length)throw Error(JSON.stringify({state,errors}));
 await page.locator('#step').click();
 await page.waitForFunction(()=>manual===13);
 await page.locator('#idle').click();
 await page.screenshot({path:path.join(__dirname,'review-page-idle.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(__dirname,'review-page-mobile.png'),fullPage:true});
 fs.writeFileSync(path.join(__dirname,'preview-validation.json'),JSON.stringify({state,errors,stepping:true,viewports:[[1240,980],[390,844]],realBattleStarted:false},null,2));
 await browser.close();console.log(JSON.stringify({preview:'passed',heroes:state.heroCount,errors}));
})().catch(e=>{console.error(e);process.exit(1)});
