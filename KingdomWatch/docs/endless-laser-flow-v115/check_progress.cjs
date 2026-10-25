// Execute only the pure floor-accounting function; no battle/monster/wave state machine.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/scripts/battle/EndlessFlow.ts'),'utf8'),m={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports});
const {clearedEndlessFloor}=m.exports,e=(floor,dead=false)=>({endlessFloor:floor,dead});
const cases=[
 [1,false,[],0],[1,true,[],1],[1,true,[e(1)],0],
 [2,false,[e(1),e(2)],0],[2,true,[e(1)],0],[2,false,[e(2)],1],
 [3,true,[e(1),e(3)],0],[3,true,[e(2)],1],[3,false,[e(3)],2],
 [3,false,[],2],[3,true,[],3],[3,true,[e(1,true),e(3)],2],
 [3,true,[e(1),e(2,true),e(3,true)],0],[3,false,[e(0)],2],
 [5,true,[e(2),e(5)],1],[5,false,[e(4),e(5)],3],
];
for(const [floor,emitted,enemies,want] of cases)assert.equal(clearedEndlessFloor(floor,emitted,enemies),want);
// Exhaust the independent definition: every earlier floor must be fully emitted and have no survivor.
let checked=0;
for(let floor=1;floor<=10;floor++)for(const emitted of [false,true])for(let mask=0;mask<(1<<floor);mask++){
 const enemies=[];for(let f=1;f<=floor;f++)if(mask&(1<<(f-1)))enemies.push(e(f));
 let want=0;for(let f=1;f<=floor-(emitted?0:1);f++){if(enemies.some(x=>x.endlessFloor===f))break;want=f;}
 assert.equal(clearedEndlessFloor(floor,emitted,enemies),want);checked++;
}
const report={explicitBoundaryCases:cases.length,exhaustiveLiveFloorCombinations:checked,
 laterFloorsCannotBypassEarlierSurvivors:true,emissionDoesNotGrantAClear:true,deadActorsDoNotBlock:true,
 scope:'pure integer/list accounting only; battle, waves and monsters not executed',gameOrBrowserStarted:false};
fs.writeFileSync(path.join(__dirname,'progress-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
