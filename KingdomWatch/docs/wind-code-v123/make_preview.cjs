/** Actual VFX drawing only, with inert node/Graphics/material doubles; never a battle. */
const fs=require('node:fs'),path=require('node:path');
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
const {WindNinjaVFX}=loadIsolated('assets/scripts/battle/WindNinjaVFX.ts',{
 cc:{Color,Node,Graphics:RecordingGraphics,Layers:{Enum:{UI_2D:1}}},'./HeroFxShader':{HeroFxShader:Shader}
});
function field(){const p=new Node('field');new Node('TextLayer').setParent(p);shaders=[];return new WindNinjaVFX(p);}
function capture(fx){return {quads:shaders.flatMap(s=>s.quads),commands:fx.g.commands};}
const frames=[];
for(const kind of ['eye','tornado','spiral']){
 const fx=field(),a={kind,x:0,y:0,radius:kind==='tornado'?120:140,age:0,duration:4};
 for(let i=0;i<90;i++){
  a.age=.10+i/30;fx.begin();fx.area(a);fx.end();frames.push({kind,age:a.age,...capture(fx)});
 }
}
const fx=field();fx.spiralLaunch(-135,-95,30,65,.45);
for(let i=0;i<90;i++){
 const age=i/30;if(i)fx.tick(1/30);fx.begin();
 if(age>=.45)fx.area({kind:'spiral',x:30,y:65,radius:145,age:age-.45,duration:4});
 fx.end();frames.push({kind:'ninja-sequence',age,...capture(fx)});
}
const out={source:'actual WindNinjaVFX area/launch calls, inert cc; geometry only',width:400,height:440,bottom:-180,frames};
const cache=path.join(helpers.ROOT,'local/art-archive/wind-code-v123');fs.mkdirSync(cache,{recursive:true});
fs.writeFileSync(path.join(cache,'review-recipes.json'),JSON.stringify(out));
console.log(JSON.stringify({cosmeticFrames:frames.length,gameOrCombatStarted:false}));
