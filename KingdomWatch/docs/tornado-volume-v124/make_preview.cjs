/** Actual VFX drawing only, with inert node/Graphics/material doubles; never a battle. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const helpers=require('../wind-ninja-v120/render-preview.cjs');
const {loadIsolated,RecordingGraphics,DrawingNode}=helpers;
let shaders=[];
class Node extends DrawingNode {
 constructor(name='node'){super();this.name=name;this.children=[];this.layer=1;}
 setParent(p){this.parent=p;p.children.push(this);}
 getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 getSiblingIndex(){return this.parent?.children.indexOf(this)||0;}
 setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this);}
 addComponent(C){const c=new C();c.node=this;return c;}
}
class Color {constructor(){this.r=this.g=this.b=this.a=255;}static fromHEX(c,h){c.r=parseInt(h.slice(1,3),16);c.g=parseInt(h.slice(3,5),16);c.b=parseInt(h.slice(5,7),16);return c;}}
class Shader {
 constructor(_p,_name,cap,blend){this.ready=true;this.cap=cap;this.blend=blend;this.quads=[];shaders.push(this);}
 begin(){this.quads=[];}draw(...q){if(this.quads.length>=this.cap)return false;this.quads.push(q);return true;}end(){}
}
const base='95935c828ad7fb73829e32c41ca0574d6660fbaa';
const imports={cc:{Color,Node,Graphics:RecordingGraphics,Layers:{Enum:{UI_2D:1}}},'./HeroFxShader':{HeroFxShader:Shader}};
function drawing(before){
 const text=before?cp.execFileSync('git',['show',base+':KingdomWatch/assets/scripts/battle/WindNinjaVFX.ts'],{cwd:helpers.ROOT,encoding:'utf8'}):fs.readFileSync(path.join(helpers.ROOT,'assets/scripts/battle/WindNinjaVFX.ts'),'utf8');
 const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2018,module:ts.ModuleKind.CommonJS}}).outputText;
 const ctx={exports:{},require(id){assert(Object.hasOwn(imports,id));return imports[id];}};
 vm.runInNewContext(code,ctx);return ctx.exports.WindNinjaVFX;
}
function field(C){const p=new Node('field');new Node('TextLayer').setParent(p);shaders=[];return new C(p);}
function capture(fx){return {quads:shaders.flatMap(s=>s.quads),commands:fx.g.commands};}
const frames=[],others={};
for(const before of [true,false]){
 const C=drawing(before),version=before?'old':'new';
 for(const kind of ['eye','tornado','spiral']){
  const fx=field(C),a={kind,x:0,y:0,radius:130,age:0,duration:5};
  for(let i=0;i<150;i++){
   a.age=i/30;fx.begin();fx.area(a);fx.end();const rec={version,kind,age:a.age,...capture(fx)};
   if(kind==='tornado')frames.push(rec);else (others[version]||=[]).push(rec);
  }
 }
}
assert.equal(JSON.stringify(others.old.map(({version,...v})=>v)),JSON.stringify(others.new.map(({version,...v})=>v)));
const out={baseline:base,source:'actual old/current VFX drawing only, inert cc; no combat',width:440,height:500,bottom:-200,frames};
const cache=path.join(helpers.ROOT,'local/art-archive/tornado-volume-v124');fs.mkdirSync(cache,{recursive:true});
fs.writeFileSync(path.join(cache,'review-recipes.json'),JSON.stringify(out));
fs.writeFileSync(path.join(__dirname,'drawing-review.json'),JSON.stringify({baseline:base,tornadoFrames:frames.length,otherUnchangedDrawingFrames:300,gameOrCombatStarted:false},null,2)+'\n');
console.log(JSON.stringify({cosmeticFrames:frames.length,otherUnchangedDrawingFrames:300,gameOrCombatStarted:false}));
