const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
function read(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function write(p,value){fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n')}
for(const folder of [root,path.join(game,'assets/resources/ux/volt_attack_user_v2')]){
 const p=path.join(folder,'attack.frames.json'),m=read(p);
 m.gameIntegrated=true;m.previewOnly=false;m.selectedForGameByUser=true;m.gameVisualAcceptedByUser=false;
 write(p,m);
}
for(const name of ['packaging.json','source-origin.json']){
 const p=path.join(root,name),m=read(p);
 Object.assign(m,{gameIntegrated:true,previewOnly:false,selectedForGameByUser:true,gameVisualAcceptedByUser:false});write(p,m);
}
write(path.join(root,'integration.json'),{status:'integrated_pending_build',date:new Date().toISOString(),
 resource:'volt_attack_user_v2',previousResource:'volt_attack_natural_v1',idleResource:'volt_idle_natural_v1',
 frames:56,seconds:56/24,releaseIndex:14,readyIndex:55,groundAnchor:[256,496],cellSize:[512,512],
 paintedHeight:468.7165,displayHeight:146,reversePlayback:false,opacityFade:false,
 selectedForGameByUser:true,gameVisualAcceptedByUser:false,paidTaskSubmitted:false,
 player:'Existing whole-character HeroSequenceAnimation, actual spell callback triggers release',
 idleRule:'No idle during attack/recovery; idle only when no target within own attack range and no queued attack',
 retained:['volt idle media and timing','completed sniper idle and attack','archer media and size','damage, attack speed, lightning projectiles, effects and sound']});
console.log(JSON.stringify({status:'integrated_pending_build',resource:'volt_attack_user_v2',paidTaskSubmitted:false}));
