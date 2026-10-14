const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const deployment=process.argv[2];
if(!deployment?.startsWith('https://'))throw Error('Supply the successful Wrangler deployment URL');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));
const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const stage=read('deployment-stage.json'),packaging=read('packaging.json'),source=read('source-origin.json'),build=read('build-record.json');
const log=fs.readFileSync(build.log,'utf8'),matches=[...log.matchAll(/build-project-total \((\d+)ms\)/g)];
const milliseconds=matches.length?Number(matches[matches.length-1][1]):null;
const release={...stage,status:'published',deployment,date:new Date().toISOString(),sourceSha256:source.sha256,
  frames:packaging.uniqueFrames,seconds:packaging.seconds,resource:packaging.resource,
  displayHeight:packaging.displayHeight,paintedHeight:packaging.paintedHeight,
  fullSourceRetained:true,reversePlayback:false,opacityFade:false,gameIntegrated:true,selectedForGameByUser:true,userVisualAccepted:false,
  publication:{exitCode:0,tool:'Wrangler'},build:{...build,milliseconds},
  retained:{voltIdle:'volt_idle_natural_v1',sniperIdle:'sniper_idle_natural_v2',sniperAttack:'sniper_attack_clean_v1',archer:'existing art, animations and height'},
  review:'User manual effect review; source production only; no tests, browser, gameplay or online QA'};
write('release.json',release);
const integration=read('integration.json');integration.status='published';integration.game=stage.game;integration.deployment=deployment;write('integration.json',integration);
const note=`2026-10-14 用户提供新的雷法师攻击视频 \`Downloads/video (1).mp4\` 并明确要求直接应用到游戏，已构建发布[正式游戏](${stage.game})及[待机切换／镜像预览](${stage.preview})，部署 \`${deployment}\`。56 帧、24fps、约 2.333333 秒全部正向保留，固定共享当前待机 \`volt_idle_natural_v1\` 的画内高度 468.7165、显示高度 146 与脚底 (256,496)，释放标注源帧 14。正式攻击引用从 \`volt_attack_natural_v1\` 改为 \`volt_attack_user_v2\`，实际施法回调触发，全不透明换帧；攻击与收势期间停播待机，自身攻击范围内无目标、无排队攻击且动作结束后恢复。重弩手已完工素材、雷法师认可待机、弓箭手及伤害、攻速、弹道、雷电特效和声音保持；未调用视频或图片生成模型。Cocos 成功退出码 ${build.exitCode}、${milliseconds}ms，DPR 完成，Wrangler main 成功。用户人工查看，未运行测试、浏览器、游戏或线上验收，接入授权不等于视觉已获认可。详见 \`docs/volt-attack-user-v2/release.json\`。`;
for(const name of ['AGENTS.md','README.md']){const p=path.join(game,name),text=fs.readFileSync(p,'utf8'),first=text.indexOf('\n');fs.writeFileSync(p,text.slice(0,first+1)+'\n'+note+'\n'+text.slice(first+1));}
fs.appendFileSync(path.join(root,'README.md'),`\n已构建发布：[正式游戏](${stage.game}) · [待机切换／左右镜像预览](${stage.preview})。部署 \`${deployment}\`。Cocos 退出码 ${build.exitCode}、${milliseconds}ms，DPR 完成，Wrangler main 成功。\n`);
console.log(JSON.stringify({game:stage.game,preview:stage.preview,deployment,gameChanged:true,paidTaskSubmitted:false}));
