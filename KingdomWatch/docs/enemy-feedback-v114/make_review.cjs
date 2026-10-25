// Standalone SVG drawing of actual badge/healing paths. No game or combat modules imported.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
class Color{constructor(r=255,g=255,b=255,a=255){this.set(r,g,b,a);}set(r,g,b,a){this.rgb=`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;this.a=a;}static fromHEX(c,h){c.set(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255);}}
const n=v=>Number(v.toFixed(3));
class Pen{
 set fillColor(c){this._fill={rgb:c.rgb,a:c.a};}get fillColor(){return this._fill;}
 set strokeColor(c){this._stroke={rgb:c.rgb,a:c.a};}get strokeColor(){return this._stroke;}
 constructor(){this.clear();this.fillColor=new Color();this.strokeColor=new Color();this.lineWidth=1;}
 clear(){this.items=[];this.d='';this.last='';}
 moveTo(x,y){this.d+=`M${n(x)} ${n(y)}`;}lineTo(x,y){this.d+=`L${n(x)} ${n(y)}`;}
 quadraticCurveTo(x,y,a,b){this.d+=`Q${n(x)} ${n(y)} ${n(a)} ${n(b)}`;}
 bezierCurveTo(a,b,c,d,e,f){this.d+=`C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)}`;}
 close(){this.d+='Z';}
 circle(x,y,r){this.ellipse(x,y,r,r);}
 ellipse(x,y,rx,ry){this.d=`M${n(x-rx)} ${n(y)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2*rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2*rx)} 0`;}
 fill(){this.items.push(`<path d="${this.d}" fill="${this.fillColor.rgb}" opacity="${n(this.fillColor.a/255)}"/>`);this.last=this.d;this.d='';}
 stroke(){this.items.push(`<path d="${this.d||this.last}" fill="none" stroke="${this.strokeColor.rgb}" stroke-width="${n(this.lineWidth)}" opacity="${n(this.strokeColor.a/255)}" stroke-linejoin="round"/>`);this.d='';}
}
function load(file,imports){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,require:n=>{if(imports[n])return imports[n];throw Error(n);}});return m.exports;}
const shim={'cc':{Color,Graphics:Pen},'../ui/UIKit':{N:(_n,p)=>({addComponent:()=>p.pen=new Pen()})}};
const {drawEnemyBadge}=load('assets/scripts/battle/EnemyBadge.ts',shim),{EnemyHealVFX}=load('assets/scripts/battle/EnemyHealVFX.ts',shim);
async function main(){
 const p=new Pen(),kinds=['armor','armorBroken','ward','wardBroken','heal','rush','health','attack'];
 kinds.forEach((k,i)=>drawEnemyBadge(p,k,-350+i*100,0,2.2));
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="840" height="180"><rect width="840" height="180" fill="#977343"/><g transform="translate(420 92)scale(1,-1)">${p.items.join('')}</g></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'badge-review.png'));
 const parent={},fx=new EnemyHealVFX(parent),body=(x,y,id)=>({x,y,lifeId:id,dead:false,groundY:y-18,def:{radius:24},node:{isValid:true,activeInHierarchy:true}});
 const a=body(-160,0,1),b=body(100,55,2);fx.connect(a,b);
 const frames=[];for(let i=0;i<27;i++){a.x+=.7;b.x-=.3;fx.tick(1/30);
  svg=`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#977343"/><g transform="translate(240 160)scale(1,-1)">${parent.pen.items.join('')}</g></svg>`;
  frames.push(await sharp(Buffer.from(svg)).png().toBuffer());}
 await sharp(frames[8]).png().toFile(path.join(__dirname,'healing-review.png'));
 // Check only the isolated art's bounded slot reuse and stale-instance cleanup.
 for(let i=0;i<80;i++)fx.connect(a,b);if(fx.links.length>24)throw Error('Unbounded art links');
 b.lifeId++;fx.tick(.01);if(fx.links.length)throw Error('Stale life remains');
 fs.writeFileSync(path.join(__dirname,'art-review.json'),JSON.stringify({badges:kinds.length,healingFrames:27,linkSlots:24,staleInstanceCleanup:true,gameCombatOrBrowserStarted:false},null,2)+'\n');
 console.log('Standalone badges and healing art drawn; bounded slots and stale-instance cleanup passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
