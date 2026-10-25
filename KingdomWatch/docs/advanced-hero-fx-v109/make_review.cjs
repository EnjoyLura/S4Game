// Isolated art clock and SVG pen. No game, scene, browser, damage or audio is imported.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=__dirname,project=path.resolve(out,'../..'),W=480,H=540,bottom=-140;
class Color{constructor(){this.set(255,255,255,255);}set(r,g,b,a){this.hex=`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;this.a=a;}}
const f=v=>Number(v.toFixed(3));
class Pen{
 constructor(){this.clear();this.fillColor=new Color();this.strokeColor=new Color();this.lineWidth=1;}
 clear(){this.items=[];this.d='';}
 ellipse(x,y,rx,ry){this.d=`M${f(x-rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2*rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2*rx)} 0`;}
 moveTo(x,y){this.d+=`M${f(x)} ${f(y)}`;}lineTo(x,y){this.d+=`L${f(x)} ${f(y)}`;}
 quadraticCurveTo(cx,cy,x,y){this.d+=`Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`;}close(){this.d+='Z';}
 fill(){this.items.push(`<path d="${this.d}" fill="${this.fillColor.hex}" opacity="${f(this.fillColor.a/255)}"/>`);this.last=this.d;this.d='';}
 stroke(){this.items.push(`<path d="${this.d||this.last}" fill="none" stroke="${this.strokeColor.hex}" stroke-width="${f(this.lineWidth)}" opacity="${f(this.strokeColor.a/255)}" stroke-linejoin="round" stroke-linecap="round"/>`);this.d='';}
}
class Shader{
 constructor(parent,name,cap){this.kind='shader';this.quads=[];this.capacity=cap;this.ready=true;parent.items.push(this);}
 begin(){this.quads=[];}draw(...args){if(this.quads.length>=this.capacity)throw Error('Art pool overflow');this.quads.push(args);return true;}end(){}
}
const moduleStub={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.join(project,'assets/scripts/battle/AdvancedHeroVFX.ts'),'utf8'),
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:moduleStub.exports,require:n=>n==='cc'?{Color,Graphics:Pen,Node:class{}}:
 n==='../ui/UIKit'?{N:(name,parent)=>({addComponent:()=>{let p=new Pen();parent.items.push(p);return p;}})}:
 n==='./HeroFxShader'?{HeroFxShader:Shader}:(()=>{throw Error(n);})()},{filename:'AdvancedHeroVFX.art-only.js'});
const {CannonBlastVFX,SiphonBeamVFX}=moduleStub.exports;
function field(){const g={items:[]},a={items:[]};return{layers:[g,a],getChildByName:n=>n==='GroundFxLayer'?g:a};}
async function save(fx,kind,index){
 const layers=[];
 for(const layer of fx.layers)for(const item of layer.items){
  if(item.kind==='shader'){layers.push({quads:item.quads});continue;}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${W/2},${H+bottom})scale(1,-1)">${item.items.join('')}</g></svg>`;
  const name=`${kind}-${index}-${layers.length}.png`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out,'review-frames',name));layers.push({image:name});
 }
 return{kind,index,layers};
}
async function main(){
 fs.mkdirSync(path.join(out,'review-frames'),{recursive:true});const frames=[];
 const a=field(),bomb=new CannonBlastVFX(a);bomb.burst(0,75,145,'ult');
 for(let i=0;i<63;i++){if(i)bomb.tick(1/30);bomb.render();frames.push(await save(a,'bomb',i));}
 const b=field(),drain=new SiphonBeamVFX(b);
 for(let i=0;i<75;i++){
  drain.tick(1/30);const time=i/30,heavy=i>=38;
  const targets=[[-94+Math.sin(time*2)*14,255],[55+Math.sin(time*2+1)*12,300],[115,140+Math.cos(time*1.8)*10]];
  if(i%8===0){targets.forEach(([x,y],k)=>drain.hit(x,y,k+1,heavy));drain.healed();}
  drain.begin(-35,-90,heavy);targets.forEach(([x,y],k)=>drain.beam(x,y,k? .75:1.15,k+.6));drain.end();
  frames.push(await save(b,'siphon',i));
 }
 fs.writeFileSync(path.join(out,'review-recipes.json'),JSON.stringify({width:W,height:H,bottom,frames}));
 console.log(JSON.stringify({artFrames:frames.length,gameOrBrowserStarted:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
