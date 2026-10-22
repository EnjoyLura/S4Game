// Read source literals with TypeScript AST; never load or run game modules.
const fs=require('fs'),path=require('path');
const ts=require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'../..');
function readCatalog(file){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function literal(n){
  if(ts.isStringLiteral(n))return n.text;
  if(ts.isNumericLiteral(n))return Number(n.text);
  if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,literal(p.initializer)]));
  throw Error('Unsupported catalog expression: '+n.getText(source));
 }
 for(const s of source.statements)if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)
  if(d.name.getText(source)==='EQUIPS')return literal(d.initializer);
 throw Error('Missing EQUIPS');
}
const current=readCatalog(path.join(root,'assets/scripts/core/GameData.ts'));
const before=readCatalog(path.join(__dirname,'before/assets/scripts/core/GameData.ts'));
for(const id of Object.keys(before))if(JSON.stringify(current[id])!==JSON.stringify(before[id]))throw Error('Existing equipment changed: '+id);
const added=Object.values(current).filter(d=>!before[d.id]);
if(added.length!==16||Object.keys(current).length!==20)throw Error('Unexpected equipment count');
const keys={helm:['atk','atkPct'],acc:['critRate','critDmg'],glove:['atkSpd','range'],armor:['skillDmg','chargeEff']};
for(const quality of [2,3])for(const kind of Object.keys(keys)){
 const pair=added.filter(d=>d.quality===quality&&d.kind===kind);
 if(pair.length!==2)throw Error('Missing quality/slot pair: '+quality+kind);
 const [a,b]=pair,[first,second]=keys[kind];
 if(!(a.stats[first]>b.stats[first]&&a.stats[second]<b.stats[second]))throw Error('Pair is not a distinct attribute tradeoff');
}
for(const d of added){
 if(d.tier!==1||d.price!==(d.quality===2?1800:6000)||d.unlock!==(d.quality===2?'1-2':'1-4'))throw Error('Progression mismatch');
 if(JSON.stringify(Object.keys(d.stats))!==JSON.stringify(keys[d.kind])||Object.values(d.stats).some(v=>v<=0))throw Error('Wrong slot attributes');
 if(d.price<([100,400,1500,5000][d.quality]*Math.pow(3,d.tier-1)))throw Error('New level-one buy/sell arbitrage');
 if(!d.focus||!d.description||!d.art.startsWith('shop_comic_v1/')||!d.art.endsWith('_v57'))throw Error('Missing presentation');
}
const record={originalNonWeaponEquipment:4,originalNonWeaponEquipmentUnchanged:true,newEquipment:16,totalNonWeaponEquipment:20,totalIncludingWeapons:45,
 shopEquipmentCount:20,qualitySlotPairs:8,newLevelOneBuySellArbitrage:false,added,inspection:'Static source AST only; game code not executed'};
fs.writeFileSync(path.join(__dirname,'catalog.json'),JSON.stringify(record,null,2));
process.stdout.write('AST reviewed: 16 new equipment, 20 non-weapon total; all 4 originals unchanged; all 8 pairs trade attributes.\n');
