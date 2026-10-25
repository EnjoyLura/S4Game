/** Read-only scope and pure-code checks. Never starts the game or engine. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base='95935c828ad7fb73829e32c41ca0574d6660fbaa';
const fx='assets/resources/fx/wind-ninja-flow.effect',vfx='assets/scripts/battle/WindNinjaVFX.ts';
const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
const prior=file=>git(['show',base+':KingdomWatch/'+file]).replace(/\r\n/g,'\n');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const compact=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
function block(source,name){
 const match=new RegExp('(?:function\\s+'+name+'|(?:float|vec[234])\\s+'+name+')\\s*\\(').exec(source);assert(match,name);
 const start=match.index,open=source.indexOf('{',start);let depth=1,i=open+1;
 for(;depth&&i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}
 assert.equal(depth,0);return source.slice(start,i);
}
const changed=git(['diff','--name-only',base,'--','assets']).trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(changed.sort(),['KingdomWatch/'+fx,'KingdomWatch/'+vfx].sort());
assert.equal(git(['ls-files','--others','--exclude-standard','assets']).trim(),'');
const shader=read(fx),oldShader=prior(fx),drawing=read(vfx),oldDrawing=prior(vfx);
assert.equal(compact(drawing.replace(block(drawing,'flowParticles'),'')),compact(oldDrawing.replace(block(oldDrawing,'flowParticles'),'')));
let rest=shader,oldRest=oldShader;
for(const name of ['tornado','tornadoDust','flowHash','flowNoise'])rest=rest.replace(block(rest,name),'');
oldRest=oldRest.replace(block(oldRest,'tornado'),'');assert.equal(compact(rest),compact(oldRest));
assert(!/\b(?:sampler2D|samplerCube)\b|\btexture\s*\(/.test(compact(shader)));
const protectedFunctions=['windEye','windCrescent','ninjaFlow','energyShuriken','frag'];
const exact={};
for(const name of protectedFunctions){const a=block(shader,name),b=block(oldShader,name);assert.equal(a,b);exact[name]=crypto.createHash('sha256').update(a).digest('hex');}
assert.equal((shader.match(/float flowHash\(/g)||[]).length,1);
assert.equal((shader.match(/float flowNoise\(/g)||[]).length,1);
assert.match(block(shader,'tornado'),/for \(int i = 0; i < 12; i\+\+\)/);
const recipe=json=>JSON.parse(fs.readFileSync(path.join(__dirname,json),'utf8'));
const drawingReport=recipe('drawing-review.json');assert.equal(drawingReport.otherUnchangedDrawingFrames,300);
const report={status:'PASS',baseline:base,changedAssets:changed,allOtherTrackedAssetsUnchanged:true,newAssets:0,
  exactShaderFunctions:exact,allOtherVfxDrawingFunctionsAndClassUnchanged:true,
  actualEyeAndNinjaDrawingFramesUnchanged:300,volumeRaySamples:12,shaderSamplers:0,
  newGameMedia:0,gameCombatBrowserAudioOrWasmStarted:false};
fs.writeFileSync(path.join(__dirname,'code-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
