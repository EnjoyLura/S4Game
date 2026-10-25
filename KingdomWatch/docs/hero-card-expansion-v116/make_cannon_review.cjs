// Reuse the isolated SVG pen only, then draw the actual new wave/charge paths. No combat module.
const prelude=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../enemy-feedback-v114/make_review.cjs'),'utf8');
eval(prelude.slice(0,prelude.indexOf('const shim='))+`
Pen.prototype.roundRect=function(x,y,w,h,r){this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.close();};
const layers={GroundFxLayer:{pens:[]},FxLayer:{pens:[]}},field={getChildByName:n=>layers[n]};
const config=load('assets/scripts/config/NewHeroConfig.ts',{});
const {CannonAugments}=load('assets/scripts/battle/CannonAugments.ts',{'cc':{Color,Graphics:Pen,Node:class{}},
 '../config/NewHeroConfig':config,'../config/GameConfig':{LO:{half:300}},
 '../ui/UIKit':{N:(_n,p)=>({addComponent:()=>{const g=new Pen();p.pens.push(g);return g;}})}});
const fx=new CannonAugments(field,()=>{throw Error('Art preview must never run damage');});
const mob={x:65,y:0,headTop:72,lifeId:1,dead:false,def:{radius:22},node:{isValid:true,activeInHierarchy:true}};
fx.mark(mob,100);fx.wave(-65,-40,150,100,false);fx.tick(.2,{list:[]});fx.render();
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="340"><rect width="480" height="340" fill="#977343"/><g transform="translate(240 250)scale(1,-1)">'+Object.values(layers).flatMap(l=>l.pens.flatMap(p=>p.items)).join('')+'</g></svg>';
sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'cannon-extra-review.png')).then(()=>{
 fs.writeFileSync(path.join(__dirname,'cannon-art-review.json'),JSON.stringify({actualWaveAndChargeDrawing:true,damageNeverRun:true,gameOrBrowserStarted:false},null,2)+'\\n');
 console.log('Actual cannon ground-wave and charge paths drawn in isolated SVG pen.');
}).catch(e=>{console.error(e);process.exitCode=1;});
`);
