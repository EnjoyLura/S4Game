// Actual UI and status-mark drawing only, using inert Cocos stubs. No scenes or battle run.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function load(file,imports={}){const js=ts.transpileModule(read(file),{compilerOptions:{module:1,target:7}}).outputText;
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),n);return imports[n];},Math,Number};vm.runInNewContext(js,c);return c.exports;}
const cache={};function config(name){return cache[name]||(cache[name]=load('assets/scripts/config/'+name+'.ts',new Proxy({},{get:(_,n)=>n==='./GameConfig'?{PAL:{}}:config(n.slice(2)),getOwnPropertyDescriptor:()=>({configurable:true,enumerable:true})})));}
const cfg=config('WindNinjaConfig'),cards=config('Cards'),layout=load('assets/scripts/ui/BattleTipLayout.ts');
const finite=(...xs)=>assert.ok(xs.every(Number.isFinite),'Finite UI coordinates');
class G{constructor(){this.commands=[];}circle(...a){finite(...a);}fill(){}moveTo(x,y){finite(x,y);this.d=`M${x},${y}`;}
 bezierCurveTo(...a){finite(...a);this.d+='C'+a.join(' ');}stroke(){if(this.d){const c=this.strokeColor;this.commands.push(`<path d="${this.d}" fill="none" stroke="rgb(${c.r},${c.g},${c.b})" stroke-opacity="${c.a/255}" stroke-width="${this.lineWidth}" stroke-linecap="round"/>`);}}}
let labels=[],panels=[];
const context={...cfg,...layout,Math,Number,Graphics:G,Node:{EventType:{TOUCH_END:'touch'}},CA:(hex,a)=>({hex,a}),
 LO:{half:667},HERO_Y:-545,WYB:(b,h)=>-context.LO.half+b+h/2,WX:(x,w)=>x-375+w/2,
 HERO_DEFS:{wind:{skillName:'风眼旋涡',ultName:'游走龙卷'}},voltShockAmp:()=>0,voltShockDuration:()=>3,targetLabel:()=>'',
 N:(n,p,x=0,y=0,w=0,h=0)=>{finite(x,y,w,h);return {on(){},addComponent:()=>new G()};},
 gpanel:(p,x,y,w,h)=>{finite(x,y,w,h);panels.push({x,y,w,h});return {};},artSprite:(p,x,y,w,h)=>finite(x,y,w,h),
 label:(p,x,y,text,style)=>{finite(x,y);labels.push({x,y,text,style});}};
const source=read('assets/scripts/ui/Panels.ts'),ast=ts.createSourceFile('Panels.ts',source,ts.ScriptTarget.Latest,true);let method;
function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='showTips')method=n;ts.forEachChild(n,visit);}visit(ast);assert.ok(method);
vm.runInNewContext(ts.transpileModule('function '+method.getText(ast),{compilerOptions:{target:7}}).outputText+';this.showTips=showTips;',context);
const basic=cards.baseWindStats(),full=cards.baseWindStats();for(const c of cards.WIND_CARDS.filter(c=>c.offerGroup==='combat'))for(let i=0;i<c.maxStacks;i++)c.apply({hero:full});
const cases=[];let checked=0;
for(const half of [500,667,850])for(const [build,stats]of [['base',basic],['full',full]])for(const kind of ['atk','skill','ult'])for(const x of [-270,-90,90,270]){
 context.LO.half=half;context.HERO_Y=-half+122;panels=[];labels=[];const h={...stats,skillLv:10,ultLv:10};
 const hero={id:'wind',x,stats:h,effAtk:h.atk,skillCdTotal:12,chargeGoal:70,charge:20,abilityDamage:mul=>100*mul,targetLayer:()=>'all'};
 context.showTips.call({begin(){},closeAll(){},modalRoot:{}},kind,hero,{maxHp:100},3);
 assert.equal(panels.length,1);const p=panels[0];assert.ok(p.x-p.w/2>=-367&&p.x+p.w/2<=367&&p.y-p.h/2>=-half+8&&p.y+p.h/2<=half-8);
 for(const l of labels){assert.ok(typeof l.text==='string'&&!/NaN|undefined/.test(l.text));assert.ok(l.y>=p.y-p.h/2+12&&l.y<=p.y+p.h/2-12);}
 const words=labels.map(l=>l.text).join('|');if(build==='full'){
  if(kind==='atk')assert.ok(words.includes('受伤+20%')&&words.includes('90'));
  if(kind==='skill')assert.ok(words.includes('向上 36/秒')&&words.includes('双抗-30个百分点')&&words.includes('圈内40% · 4秒'));
  if(kind==='ult')assert.ok(words.includes('9秒 · 每0.3秒')&&words.includes('2道')&&words.includes('26%普攻'));}
 if(half===667&&x===-90)cases.push({build,kind,panel:p,labels});checked++;
}
class Color{set(r,g,b,a){Object.assign(this,{r,g,b,a});}}
const mark=load('assets/scripts/battle/WindMarkVFX.ts',{'cc':{Color,Graphics:G}}),layers=[];
for(const [i,age]of [0,.15,1,1.95].entries()){const g=new G();mark.drawWindMark(g,0,0,2-age,age);assert.equal(g.commands.length,6);
 layers.push(`<g transform="translate(${70+i*120},80) scale(2,-2)">${g.commands.join('')}</g>`);}
async function main(){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="140"><rect width="500" height="140" fill="#283e30"/>${layers.join('')}</svg>`)).png().toFile(path.join(__dirname,'wind-mark-preview.png'));
 fs.writeFileSync(path.join(__dirname,'tips-review.json'),JSON.stringify(cases,null,2)+'\n');
 const report={status:'PASS',actualShowTipsCases:checked,baseAndFullBuilds:true,viewHeights:[1000,1334,1700],panelsInBoundsAndAllLabelsFinite:true,
  markActualPathsRendered:true,gameEngineBrowserCombatAudioOrWasmStarted:false};fs.writeFileSync(path.join(__dirname,'ui-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
main().catch(e=>{console.error(e);process.exitCode=1;});
