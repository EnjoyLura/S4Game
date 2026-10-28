// Fault injection against the actual download/transition functions, without Cocos or a browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function clock(){let now=0,id=0;const timers=new Map();return {setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id;},clearTimeout(i){timers.delete(i);},
 advance(ms){now+=ms;for(const[i,t]of [...timers])if(t.at<=now&&timers.delete(i))t.fn();},get size(){return timers.size;}};}
async function flush(){for(let i=0;i<35;i++)await Promise.resolve();}
function transpile(s){return ts.transpileModule(s,{compilerOptions:{module:1,target:7}}).outputText;}
async function main(){
 const time=clock(),registered={},original=(url,options,cb)=>cb(null,'decoded');
 const cc={assetManager:{downloader:{handlers:{'.png':original,'.json':original,'.ttf':original,'.mp3':original},register(ext,h){registered[ext]=h;}}}};
 const scope={exports:{},require:n=>{assert.equal(n,'cc');return cc;},...time,Error,Math,Number};
 vm.runInNewContext(transpile(read('assets/scripts/core/ResourceDownloadRecovery.ts')),scope);
 scope.exports.installDownloadRecovery();scope.exports.installDownloadRecovery();assert.deepEqual(Object.keys(registered).sort(),['.json','.png','.ttf']);
 let done=0,late,gotError,seenOptions;
 scope.exports.boundedDownload((url,options,cb)=>{late=cb;seenOptions=options;})('image.webp',{xhrTimeout:90000},error=>{done++;gotError=error;});
 assert.equal(seenOptions.xhrTimeout,45000);time.advance(44999);assert.equal(done,0);time.advance(1);assert.equal(done,1);assert.match(gotError.message,/download failed.*timeout/);
 late(null,'late image');late(new Error('late error'));assert.equal(done,1);assert.equal(time.size,0);
 scope.exports.boundedDownload(original)('ok.png',{},(e,data)=>{assert.equal(e,null);assert.equal(data,'decoded');});assert.equal(time.size,0);
 assert.throws(()=>scope.exports.boundedDownload(original)('ok.png',{},()=>{throw new Error('consumer exception');}),/consumer exception/);
 let thrown=0;scope.exports.boundedDownload(()=>{throw new Error('synchronous');})('bad.png',{},e=>{assert.match(e.message,/synchronous/);thrown++;});assert.equal(thrown,1);assert.equal(time.size,0);
 // Exact UI draw handoff: normal draw, missing draw, replaced callbacks, destroyed/cancelled owner.
 const text=read('assets/scripts/ui/UIMotion.ts'),ast=ts.createSourceFile('UI.ts',text,ts.ScriptTarget.Latest,true),methods=[];
 function visit(n){if(ts.isMethodDeclaration(n)&&['afterDraw','cancelDraw'].includes(n.name.getText(ast)))methods.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
 const uiClock=clock(),events=new Set(),ui={exports:{},...uiClock,director:{once:(e,f)=>events.add(f),off:(e,f)=>events.delete(f)},Director:{EVENT_AFTER_DRAW:'draw'}};
 vm.runInNewContext(transpile(`class Motion {drawReady=null;drawDeadline=undefined;${methods.join('\n')}};exports.Motion=Motion;`),ui);
 const motion=new ui.exports.Motion();let draws=0;motion.afterDraw(drawn=>{assert.equal(drawn,true);draws++;});[...events][0]();uiClock.advance(1000);assert.equal(draws,1);assert.equal(events.size,0);
 motion.afterDraw(drawn=>{assert.equal(drawn,false);draws++;});uiClock.advance(750);assert.equal(draws,2);assert.equal(events.size,0);
 assert.ok(text.includes("if (direction && drawn)"),'timeout skips frame-dependent tween');
 motion.afterDraw(()=>draws+=100);motion.afterDraw(()=>draws++);uiClock.advance(750);assert.equal(draws,3);
 motion.afterDraw(()=>draws+=100);motion.cancelDraw();uiClock.advance(750);assert.equal(draws,3);
 // Actual worker: hung headers / partial body, integrity retry, pending cleanup and recovery.
 const wc=clock(),bytes=new TextEncoder().encode('verified-image'),record={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 const cache={async match(){return undefined;},async put(){},async keys(){return [];}};let mode='hang',fetches=0,signals=[],bodyResolve;
 const response=(data=bytes,hang=false)=>({status:200,type:'basic',headers:new Headers(),clone(){return this;},arrayBuffer(){return hang?new Promise(r=>bodyResolve=r):Promise.resolve(data.buffer);}});
 const worker={...wc,URL,Request,Headers,AbortController,TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Map,Set,Date,TypeError,
  crypto:crypto.webcrypto,Response,console,caches:{open:async()=>cache},self:{location:{origin:'https://example.test'},addEventListener(){},clients:{}},
  fetch:async req=>{fetches++;signals.push(req.signal);if(mode==='hang')return new Promise(()=>{});if(mode==='body')return response(bytes,true);
   if(mode==='corrupt'&&fetches===1)return response(new TextEncoder().encode('bad'));return response();}};
 vm.runInNewContext(read('tools/github-pages/runtime-cache-sw.js').replace('__BASE_PATH__','/game/')+`\nmeasured=true;statePromise=Promise.resolve({clients:{c:'r'}});catalogs.set('r',Promise.resolve({files:{'image.webp':${JSON.stringify(record)}}}));this.resource=resource;this.pendingSize=()=>pending.size;`,worker);
 const event={clientId:'c',request:new Request('https://example.test/game/image.webp')};
 async function fail(which){mode=which;fetches=0;signals=[];let settled=false,error;
  const request=worker.resource(event,'image.webp').then(()=>{settled=true;},e=>{settled=true;error=e;});await flush();assert.equal(fetches,1);
  wc.advance(20000);await flush();assert.equal(fetches,2);wc.advance(20000);await flush();await request;
  assert.ok(settled&&error);assert.ok(signals.every(s=>s.aborted));assert.equal(worker.pendingSize(),0);}
 await fail('hang');await fail('body');bodyResolve(bytes.buffer);await flush();assert.equal(worker.pendingSize(),0);
 mode='ok';fetches=0;const good=await worker.resource(event,'image.webp');assert.equal(good.response.status,200);assert.equal(fetches,1);await good.write;assert.equal(worker.pendingSize(),0);
 mode='corrupt';fetches=0;const retry=await worker.resource(event,'image.webp');assert.equal(fetches,2);await retry.write;
 const report={status:'PASS',downloadNeverReturnsReproduced:true,engineSlotReleasedAfterTimeout:true,lateCallbackIgnored:true,synchronousThrowSettled:true,
  drawEventNormalMissingReplacedCancelled:true,workerHeadersAndBodyTimeout:true,workerRetryAndPendingCleanup:true,integrityCheckPreserved:true,
  successfulRequestAfterStall:true,gameEngineBrowserCombatAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
