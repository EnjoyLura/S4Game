// Offline art contact sheet: runs the isolated drawing module against an SVG pen.
// Does not import/boot the game, browser, scene, combat, audio or WASM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const project=path.resolve(__dirname,'../..');
class Color { constructor(hex){this.hex=hex;this.a=255;} }
const fmt=v=>Number(v.toFixed(3));
class Pen {
 constructor(){this.clear();this.fillColor=new Color('#fff');this.strokeColor=new Color('#000');this.lineWidth=1;}
 clear(){this.items=[];this.d='';}
 ellipse(x,y,rx,ry){this.d=`M ${fmt(x-rx)} ${fmt(y)} a ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2*rx)} 0 a ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2*rx)} 0`;}
 moveTo(x,y){this.d+=` M ${fmt(x)} ${fmt(y)}`;}
 lineTo(x,y){this.d+=` L ${fmt(x)} ${fmt(y)}`;}
 quadraticCurveTo(cx,cy,x,y){this.d+=` Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`;}
 close(){this.d+=' Z';}
 fill(){this.items.push(`<path d="${this.d}" fill="${this.fillColor.hex}" opacity="${fmt(this.fillColor.a/255)}"/>`);this.last=this.d;this.d='';}
 stroke(){const d=this.d||this.last;this.items.push(`<path d="${d}" fill="none" stroke="${this.strokeColor.hex}" stroke-width="${fmt(this.lineWidth)}" opacity="${fmt(this.strokeColor.a/255)}" stroke-linejoin="round" stroke-linecap="round"/>`);this.d='';}
}
const moduleStub={exports:{}};
const source=fs.readFileSync(path.join(project,'assets/scripts/battle/NewHeroVFX.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:moduleStub.exports,require:n=>n==='cc'?{Color,Graphics:Pen,Node:class{}}:
 n==='../ui/UIKit'?{C:h=>new Color(h),N:(name,parent)=>({addComponent:()=>{const p=new Pen();parent[name]=p;return p;}})}:(()=>{throw Error(n);})()},
 {filename:'NewHeroVFX.art-only.js'});
const {CannonBlastVFX,SiphonBeamVFX,drawCannonMissile}=moduleStub.exports;
function field(){const layers={ground:{},air:{}};return {layers,getChildByName:n=>n==='GroundFxLayer'?layers.ground:layers.air};}
function ink(f){return Object.values(f.layers.ground).concat(Object.values(f.layers.air)).map(p=>p.items.join('')).join('');}
const bg='<rect x="0" y="0" width="340" height="380" fill="#AA884F"/><path d="M0 90 Q160 20 340 115 M0 230 Q200 130 340 210 M50 380 Q130 170 290 0" fill="none" stroke="#8D713F" stroke-width="20" opacity=".2"/>';
function tile(body,title,x,y){return `<g transform="translate(${x},${y})">${bg}<g transform="translate(170,330) scale(1,-1)">${body}</g><rect x="0" y="0" width="340" height="35" fill="#24343D"/><text x="14" y="24" fill="#FFF1BD" font-size="16" font-family="Arial">${title}</text></g>`;}
async function main(){
 let all='';
 const ages=[.025,.12,.27,.5];
 for(let i=0;i<4;i++){
  const f=field(),fx=new CannonBlastVFX(f);fx.burst(0,100,145,'ult');fx.tick(ages[i]);fx.render();
  const g=new Pen();drawCannonMissile(g,-85,210,120,-1350,13,.18,.3,[-110,370,-106,340,-102,310,-98,280]);
  all+=tile(ink(f)+g.items.join(''),`MISSILE IMPACT  ${ages[i].toFixed(3)}s`,i*348,0);
 }
 for(let i=0;i<4;i++){
  const f=field(),fx=new SiphonBeamVFX(f);fx.tick(1.5+i*.13);
  const targets=[[-85,180],[20,265],[100,135]];
  for(const [j,[x,y]]of targets.entries())fx.hit(x,y,j+1,i>1);
  fx.tick(i*.045);fx.healed();fx.begin(0,5,i>1);
  targets.forEach(([x,y],j)=>fx.beam(x,y,j===0?1.2:.75,j+1));fx.end();
  all+=tile(ink(f),i>1?'LIFE HARVEST · ULTIMATE':'LIFE SIPHON',i*348,388);
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1392" height="768">${all}</svg>`;
 fs.writeFileSync(path.join(__dirname,'art-contact-sheet.svg'),svg);
 await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'art-contact-sheet.png'));
 console.log('Isolated VFX static art exported. No game or browser started.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
