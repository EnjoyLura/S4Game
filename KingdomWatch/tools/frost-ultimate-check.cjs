/* Offline logic checks with a tiny cc double. Never starts a real battle. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
let nodeCount = 0;
const pending = [], modules = new Map(), sources = new Map();
class Color {
  constructor(r = 255, g = 255, b = 255, a = 255) { this.set(r, g, b, a); }
  set(r, g, b, a) { if (typeof r === 'object') Object.assign(this, r); else Object.assign(this, { r, g, b, a }); }
  static fromHEX(c, hex) { c.set(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16),255); }
}
Color.WHITE = new Color();
class Node {
  static EventType = { NODE_DESTROYED: 'destroyed' };
  constructor(name = '') { nodeCount++; Object.assign(this, { name, children: [], components: [], isValid: true, active: true, angle: 0, events: {}, position: { x: 0, y: 0, z: 0 } }); }
  setParent(parent) { this.parent = parent; parent.children.push(this); }
  setSiblingIndex(index) {
    const list=this.parent.children, prior=list.indexOf(this);
    if(prior>=0) list.splice(prior,1); list.splice(Math.max(0,Math.min(index,list.length)),0,this);
  }
  addComponent(C) { const c = new C(); c.node = this; this.components.push(c); return c; }
  setPosition(x, y, z) { this.position = typeof x === 'object' ? { ...x } : { x, y, z }; }
  once(evt, cb) { this.events[evt] = cb; }
  destroy() {
    if (!this.isValid) return;
    this.isValid = false;
    for (const cb of Object.values(this.events)) cb();
    for (const child of this.children) child.destroy();
  }
}
class UITransform {
  setContentSize(w, h) { this.width = w; this.height = h; }
  setAnchorPoint(x, y) { this.anchor = { x, y }; }
}
class Sprite {
  static SizeMode = { CUSTOM: 1 };
  get isValid() { return this.node.isValid; }
  set color(c) { this._color = { ...c }; }
  get color() { return this._color; }
}
class Graphics {
  constructor() { this.commands = []; }
  clear() { this.commands.length = 0; }
}
for (const name of ['ellipse','fill','moveTo','lineTo','stroke','circle','close']) {
  Graphics.prototype[name] = function (...args) {
    this.commands.push([name,...args, { fill: {...this.fillColor}, stroke: {...this.strokeColor}, width: this.lineWidth }]);
  };
}
class SpriteFrame {
  constructor() { this.refs = 0; this.destroyed = false; }
  reset(o) { Object.assign(this,o); this.width = o.rect.width; this.height = o.rect.height; }
  addRef() { this.refs++; }
  decRef() { this.refs--; }
  destroy() { this.destroyed = true; }
}
class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
class Size { constructor(width,height) { Object.assign(this,{width,height}); } }
class Vec2 { constructor(x=0,y=0) { Object.assign(this,{x,y}); } }
class Vec3 { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } }
const cc = { Color, Node, UITransform, Sprite, SpriteFrame, Graphics, Rect, Size, Vec2, Vec3,
  JsonAsset: class {}, Layers: { Enum: { UI_2D: 1 } },
  resources: { load(p, type, cb) { pending.push({ p, cb }); } } };
const config = { LINE_Y:-513, HERO_Y:-545, SPAWN_Y:717, MAX_MOBS:80, MAX_PROJS:80,
  LO:{ half:667, notchTop:0 }, PAL:{ white:'#fff',blue:'#00f',purple:'#a0f' } };
const events = [], sfx = [];
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const source = fs.readFileSync(path.join(root,'assets/scripts',name+'.ts'),'utf8');
  const code = ts.transpileModule(source,{ compilerOptions:{ target:ts.ScriptTarget.ES2018, module:ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports:{} }; modules.set(name,m.exports);
  const req = id => {
    if (id === 'cc') return cc;
    if (id.endsWith('/GameConfig')) return config;
    if (id.endsWith('/Cards')) return load('config/Cards');
    if (id.endsWith('/EventBus')) return { bus:{ emit(...a){events.push(a);} },EVT:{ CHARGE_CHANGED:'charge' } };
    if (id.endsWith('/Sfx')) return { Sfx:{ play(a){sfx.push(a);} } };
    if (id === './FrostVFX') return load('battle/FrostVFX');
    if (id === './FrostProjectileVFX') return load('battle/FrostProjectileVFX');
    if (id === './FrostUltimateVFX') return load('battle/FrostUltimateVFX');
    if (id === './BattleDepth') return load('battle/BattleDepth');
    return new Proxy({}, { get:()=>class {} });
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Math,Set,Map}, {filename:name+'.ts'})(req,m,m.exports);
  return m.exports;
}
function deliver(entry, fail = false) {
  if (fail) { entry.cb(new Error('offline loading failure'),null); return; }
  if (entry.p.endsWith('.frames')) {
    const json = JSON.parse(fs.readFileSync(path.join(root,'assets/resources',entry.p+'.json'),'utf8'));
    entry.cb(null,{json});
  } else {
    if (!sources.has(entry.p)) {
      const meta = JSON.parse(fs.readFileSync(path.join(root,'assets/resources',entry.p.replace('/spriteFrame','.png.meta')),'utf8'));
      const d = meta.subMetas.f9941.userData, f = new SpriteFrame();
      f.reset({texture:{resource:entry.p},rect:new Rect(0,0,d.width,d.height)}); sources.set(entry.p,f);
    }
    entry.cb(null,sources.get(entry.p));
  }
}
function flush(fail = false) { while(pending.length) deliver(pending.shift(),fail); }
function create() {
  const ground = new Node('ground'), air = new Node('air'), depth=new Node('depth');
  return new (load('battle/FrostUltimateVFX').FrostUltimateVFX)(ground,air,depth);
}
const targets = Array.from({length:80},(_,i)=>({ x:-290+i%10*61,y:460-Math.floor(i/10)*112,radius:i%8===0?34:22 }));
const snapshot = fx => JSON.stringify({ age:fx.age,hitCount:fx.hits.length,
  hits:fx.hits.map(h=>[h.frameIndex,h.back.node.active,h.front.node.active,h.back.node.position,h.front.node.position]),
  rain:fx.drops.map(d=>[d.part.node.active,d.part.node.position]),
  chips:fx.chips.map(p=>[p.node.active,p.node.position]) });
function seededCast(fx, points, seed = 1643) {
  const previous = Math.random;
  Math.random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  try { fx.cast(points); } finally { Math.random=previous; }
}

const fx = create(), initialNodes = nodeCount;
seededCast(fx,targets); fx.tick(0.08);
assert(fx.ground.commands.length>0,'loading fallback is available');
flush();
assert.equal(fx.backFrames.length,64); assert.equal(fx.frontFrames.length,64);
assert.equal(fx.clipLife,1.38); assert.equal(fx.hits.length,24);
for (let i=0;i<64;i++) {
  assert.equal(fx.backFrames[i].rect.height,118);
  assert.equal(fx.frontFrames[i].rect.height,138);
  assert.equal(fx.frontFrames[i].rect.y,fx.backFrames[i].rect.y+118);
  assert.equal(fx.backFrames[i].texture,fx.frontFrames[i].texture);
  assert.equal(fx.backFrames[i].packable,false);
}
fx.tick(0.47);
assert(fx.drops.some(d=>d.part.node.active),'painted rain appears during the peak');
assert(fx.chips.some(p=>p.node.active),'low chip arcs appear');
const beforePause = snapshot(fx); fx.tick(0); assert.equal(snapshot(fx),beforePause);
for (const h of fx.hits) {
  if (!h.back.node.active) continue;
  assert.equal(h.back.node.position.x,h.x);
  assert.equal(h.back.node.position.y,h.y);
  assert(Math.abs(h.front.node.position.y - (h.y - 2*h.width/256)) < 1e-9,'fixed front offset');
}
fx.cast([]); assert.equal(snapshot(fx),beforePause,'empty cast does not reset a running clip');
for (let i=0;i<100;i++) { fx.cast(targets); fx.tick(.12); }
assert.equal(nodeCount,initialNodes,'repeated casts allocate no nodes');
assert.equal(fx.hits.length,24); assert.equal(fx.drops.length,128); assert.equal(fx.chips.length,120);
fx.tick(3);
assert.equal(fx.running,false);
assert(fx.hits.every(h=>!h.back.node.active&&!h.front.node.active));
assert(fx.drops.every(d=>!d.part.node.active)); assert(fx.chips.every(p=>!p.node.active));
assert.equal(fx.ground.commands.length,0); assert.equal(fx.trails.commands.length,0);

const fast = create(), slow = create(); flush();
seededCast(fast,targets); seededCast(slow,targets);
for(let i=0;i<9;i++) fast.tick(.025*2);
for(let i=0;i<18;i++) slow.tick(.025);
assert(Math.abs(fast.age-slow.age)<1e-9);
assert.deepEqual(fast.hits.map(h=>h.frameIndex),slow.hits.map(h=>h.frameIndex),'2x uses the same simulation-time frame');
// Physics/contacts: overhead positions respect landing depth, speed up, stay opaque until
// the tip reaches the fixed endpoint, and only then emit a ground burst.
const physical = create(); flush(); seededCast(physical,[targets[37]]);
// A lower-field sample is on screen for its entire projected descent.
const contactIndex=physical.hits.findIndex(h=>h.y<physical.skyTop-400);
assert(contactIndex>=0);
const contactHit=physical.hits[contactIndex];
const drop = physical.drops.find(d=>d.x===contactHit.x&&d.y===contactHit.y), landing = drop.start+drop.flight;
assert(drop.travel>270 && drop.travel<390,'overhead altitude is projected relative to each footprint');
assert(Math.abs(drop.drift/drop.travel)<0.18,'descent has a modest oblique view');
assert.equal(contactHit.start,landing,'ground clip starts at its actual needle contact');
const at = time => { physical.age=time; physical.render(); return {...drop.part.node.position}; };
const p1=at(drop.start+drop.flight*.35),p2=at(drop.start+drop.flight*.45);
const p3=at(drop.start+drop.flight*.75),p4=at(drop.start+drop.flight*.85);
assert(p3.y-p4.y>p1.y-p2.y,'descent accelerates instead of floating linearly');
at(landing-.001);
assert(drop.part.node.active); assert(drop.part.sprite.color.a>=228,'needle does not fade before impact');
assert(Math.abs(drop.part.node.position.y-drop.y)<6,'tip reaches within one frame of the floor');
assert.equal(contactHit.back.node.active,false,'no ground burst before contact');
assert(Math.abs(drop.part.ui.anchor.x-46/65)<1e-10);
assert(Math.abs(drop.part.ui.anchor.y-(1-2/156))<1e-10);
at(landing+.001);
assert.equal(drop.part.node.active,false,'airborne needle is consumed on impact');
assert.equal(contactHit.back.node.active,true,'impact begins on the next frame');
assert(physical.chips.slice(contactIndex*5,contactIndex*5+5).some(p=>p.node.active),'chips appear immediately, not a separate delayed effect');
const activeDrops=physical.drops.slice(0,physical.rainCount);
assert.equal(physical.rainCount,128,'fixed full-field rain even with one enemy');
assert(activeDrops.every(d=>d.start+d.flight+.56<2),'last contact clears within the storm duration');
assert(activeDrops.every(d=>d.depth.depthY===d.y),'sprite sorting uses ground depth, never its current altitude');
assert.equal(drop.part.node.parent,physical.depthParent,'needles share actor depth instead of a top overlay');
seededCast(physical,targets);
const rainEvents=physical.drops.slice(0,physical.rainCount);
assert(rainEvents.every((d,i)=>i===0||d.start>rainEvents[i-1].start),'individual emissions are strictly staggered');
assert.equal(rainEvents.filter(d=>d.start<.1).length,8,'individual opening drops, never a simultaneous salvo');
assert(Math.max(...physical.hits.map(h=>h.start))-Math.min(...physical.hits.map(h=>h.start))>.85,'main ground hits are spread across the cast');
const spawnYs=rainEvents.map(d=>d.y+d.travel);
assert(Math.max(...spawnYs)-Math.min(...spawnYs)>700,'birth positions follow ground depth, not one horizontal strip');
const near=rainEvents.reduce((a,b)=>a.y<b.y?a:b),far=rainEvents.reduce((a,b)=>a.y>b.y?a:b);
assert(near.perspective>far.perspective,'subtle depth scale is smaller at the far side');
// The weather pattern is independent of monsters, including its RNG consumption.
const stormPlan = f => JSON.stringify({
  rain:f.drops.map(d=>[d.x,d.y,d.start,d.flight,d.height,d.travel,d.drift,d.seed]),
  hits:f.hits.map(h=>[h.x,h.y,h.width,h.opacity,h.start])
});
const fullPlan=stormPlan(physical);
seededCast(physical,[{x:300,y:470,radius:48}]);
assert.equal(stormPlan(physical),fullPlan,'moving or removing enemies cannot move or reduce the rain');
const low=config.LINE_Y+40,span=config.LO.half-150-config.LO.notchTop-10-low;
const bands=Array(8).fill(0);
const bandOf=d=>Math.floor((d.y-low)/span*8);
for(const d of physical.drops) {
  assert(d.x>=-325&&d.x<=325&&d.y>=low&&d.y<low+span,'all contacts within full battle area');
  bands[bandOf(d)]++;
}
assert.deepEqual(bands,Array(8).fill(16),'middle and lower screen have the same rain coverage as the upper screen');
assert(new Set(physical.drops.slice(0,16).map(bandOf)).size>=6,'depth bands are shuffled, not swept row by row');
for(let seed=1;seed<=20;seed++) {
  seededCast(physical,targets,seed);const planned=stormPlan(physical);
  seededCast(physical,[{x:-290,y:-420,radius:22}],seed);
  assert.equal(stormPlan(physical),planned,'each random seed remains independent of enemy positions');
}
physical.tick(3); physical.root.destroy();
assert.equal(load('battle/BattleDepth').depthSprites(physical.depthParent).length,0,'external depth nodes unregister on effect cleanup');
const savedFrames = [...fx.ownedFrames];
fx.root.destroy(); fast.root.destroy(); slow.root.destroy();
assert(savedFrames.every(f=>f.destroyed)); assert.equal(fx.groundRoot.isValid,false);
assert([...sources.values()].every(s=>s.refs===0),'loaded sources released after scene cleanup');
const late = create();
deliver(pending.shift()); // metadata starts the nested texture request
late.root.destroy(); flush();
assert.equal(late.ownedFrames.length,0,'late callbacks cannot restore a destroyed scene');
assert([...sources.values()].every(s=>s.refs===0));
const failed = create(); flush(true); failed.cast(targets); failed.tick(.33);
assert(failed.trails.commands.length>0,'load failure keeps a bounded painted-geometry fallback');
failed.tick(3); failed.root.destroy();

// Exercise actual actor/effect sort, including a needle passing behind a body.
const { MonsterManager } = load('battle/Monster');
const depthLayer=new Node('depthTest'),shadowNode=new Node('shadow'),feetNode=new Node('feet');
shadowNode.setParent(depthLayer);feetNode.setParent(depthLayer);
const farActor={node:new Node('farActor'),depthY:240},nearActor={node:new Node('nearActor'),depthY:20};
farActor.node.setParent(depthLayer);nearActor.node.setParent(depthLayer);
const needle=new Node('needle');needle.setParent(depthLayer);
const depthEntry=load('battle/BattleDepth').registerDepthSprite(depthLayer,needle);depthEntry.depthY=120;
const sortable={field:depthLayer,list:[nearActor,farActor],depthOrder:[],shadows:{node:shadowNode},iceFeet:{node:feetNode}};
MonsterManager.prototype.sortDepth.call(sortable);
assert.deepEqual(depthLayer.children.map(n=>n.name),['shadow','farActor','needle','nearActor','feet']);
depthEntry.depthY=-20;MonsterManager.prototype.sortDepth.call(sortable);
assert.deepEqual(depthLayer.children.map(n=>n.name),['shadow','farActor','nearActor','needle','feet']);
depthLayer.destroy();

// Exercise the real hero method with numerical targets, no scene or browser.
const { FrostHero } = load('battle/Hero');
const cards = load('config/Cards');
for (const level of [1,5,10,20]) {
  const applied = [], damageRows = [], snapshots = [];
  const mobs = [22,34,48].map((radius,i)=>({x:i*40,y:200,hp:i===0?50:1000,dead:false,
    def:{radius},groundOffset:.0437,
    takeDamage(d){applied.push(['hit',d]);this.hp-=d;if(this.hp<=0){this.dead=true;this.y=-999;}},
    applySlow(r,d){applied.push(['slow',r,d]);} }));
  const hero = { ultReady:true,charge:50,id:'mora',skillAtk:100,stats:{ultLv:level,ultDmgMul:1.2,ultSlowDur:1},slowR:r=>r };
  const mgr = {list:mobs}, projs = {frostUltimate:points=>snapshots.push(points)};
  const dmg = {add:(id,v)=>damageRows.push(v)};
  assert.equal(FrostHero.prototype.castUlt.call(hero,mgr,projs,dmg),true);
  const cfg = cards.moraUltCfg(level);
  assert.equal(applied.filter(r=>r[0]==='hit').length,3,'one hit per target');
  for(const row of applied.filter(r=>r[0]==='hit')) assert.equal(row[1],100*cfg.boltMul*1.2);
  for(const row of applied.filter(r=>r[0]==='slow')) assert.deepEqual(row,['slow',cfg.slowMul,cfg.slowDur+1]);
  assert.equal(damageRows[0],50,'overkill statistics are still capped by prior HP');
  assert.equal(snapshots.length,1);
  assert(Math.abs(snapshots[0][0].y-(200-22*.82+22*3.85*.0437))<1e-9,'feet captured before lethal hit changes target');
  assert.equal(hero.charge,0);
}
for (const ready of [false,true]) {
  const hero = {ultReady:ready,charge:50};
  const untouched = {frostUltimate(){throw new Error('empty cast emitted visual');}};
  assert.equal(FrostHero.prototype.castUlt.call(hero,{list:[]},untouched,{}),false);
  assert.equal(hero.charge,50);
}
const heroSource = fs.readFileSync(path.join(root,'assets/scripts/battle/Hero.ts'),'utf8');
assert(!heroSource.includes("new Node('blizRing')"),'old expanding ripple removed');
assert(!heroSource.includes("new Node('blizDrop')"),'old independent Tween rain removed');
// The regular skill keeps its real playback clock, fixed anchor and resource lifetime.
const regular=new (load('battle/FrostVFX').FrostVFX)(new Node('regularGround'));flush();
assert.equal(regular.life,1.5);assert.equal(regular.frames.length,44);
assert.equal(regular.source.texture.resource,'fx/frost_domain_video_v10/spriteFrame');
regular.domain(13,-25,126,1.5);regular.tick(.820001);
assert.equal(regular.active[0].frameIndex,24,'original video tail begins at .82s');
assert.equal(regular.active[0].sprite.node.position.y,-25,'tail never shifts the entire ground anchor');
regular.tick(.68);assert.equal(regular.active.length,0,'regular skill fully clears at 1.5 seconds');
regular.root.destroy();assert([...sources.values()].every(s=>s.refs===0));

// The dedicated card changes the slow applied by the actual hero, not just its text.
const linger=cards.M0_POOL.find(c=>c.id==='mora_linger');
assert(linger&&linger.owner==='mora'&&linger.rarity==='blue');
assert.equal(cards.draw3([linger],{mora_linger:linger.maxStacks}).length,0,'capped card leaves the draw pool');
for(const ultLv of [1,10]) {
  const stats=cards.baseMoraStats();stats.ultLv=ultLv;
  const before={...stats};
  for(let layer=0;layer<=linger.maxStacks;layer++) {
    if(layer)linger.apply({hero:stats});
    let slow;
    const target={x:0,y:250,hp:10000,dead:false,def:{radius:22},groundOffset:0,
      takeDamage(){},applySlow(r,d){slow=[r,d];}};
    const hero={ultReady:true,charge:50,id:'mora',stats,skillAtk:100,slowR:r=>r};
    FrostHero.prototype.castUlt.call(hero,{list:[target]},{frostUltimate(){}},{add(){}});
    assert.deepEqual(slow,[cards.moraUltCfg(ultLv).slowMul,cards.moraUltCfg(ultLv).slowDur+layer]);
    for(const key of Object.keys(before))if(key!=='ultSlowDur')assert.equal(stats[key],before[key],'no unrelated skill/attack changes');
  }
  const glacier=cards.MORA_CARDS.find(c=>c.id==='mora_glacier');glacier.apply({hero:stats});
  assert.equal(stats.ultSlowDur,linger.maxStacks+2,'existing purple duration upgrade stacks additively');
}

// Normal projectiles share the actual ultimate texture, preserve its aspect,
// and leave gameplay positions/velocity/collision data in ProjectileManager.
const {FrostProjectileVFX}=load('battle/FrostProjectileVFX');
const ice=new FrostProjectileVFX(new Node('iceProjectileLayer'));
assert.equal(ice.projectile(0,0,0,850,6,.1),false,'fallback before texture loading');flush();
assert.equal(ice.frame.texture.resource,'fx/frost_ultimate_rain_v1/spriteFrame');
assert.equal(ice.frame.rect.height,156);assert.equal(ice.frame.packable,false);
for(const [vx,vy] of [[0,850],[850,0],[-425,736],[-850,0],[0,-850]]) {
  ice.beginProjectileFrame();assert(ice.projectile(30,-25,vx,vy,6,.2));
  const f=ice.flights[0];
  assert(Math.abs(f.ui.width/f.ui.height-65/156)<1e-9,'crystal is not stretched or flattened');
  assert.equal(f.node.angle,Math.atan2(vy,vx)*180/Math.PI-90,'painted point follows direction');
  assert.deepEqual(f.node.position,{x:30,y:-25,z:0},'rendering cannot move the collision centre');
  const paused=JSON.stringify(ice.trails.commands);ice.beginProjectileFrame();ice.projectile(30,-25,vx,vy,6,.2);
  assert.equal(JSON.stringify(ice.trails.commands),paused,'same age gives stable trail without frame-number flicker');
}
const iceNodes=nodeCount;
for(let n=0;n<100;n++) {
  ice.beginProjectileFrame();for(let i=0;i<80;i++)assert(ice.projectile(i,0,0,850,6,.2));
  assert.equal(ice.projectile(0,0,0,850,6,.2),false,'bounded pool falls back on exhaustion');
}
assert.equal(nodeCount,iceNodes,'normal shots create no nodes during repeated frames');
const {ProjectileManager}=load('battle/Projectile');
const bridge={beginProjectileFrame:()=>ice.beginProjectileFrame(),iceProjectile:(...args)=>ice.projectile(...args)};
const projectiles=new ProjectileManager(new Node('projectileTest'),{list:[]},{add(){}},undefined,bridge);
const shot={x:10,y:-100,dirX:0,dirY:1,speed:850,dmg:58,crit:false,color:'#7FD8FF',heroId:'mora',size:6,slowRatio:.25,slowDur:2};
projectiles.fire(shot);projectiles.tick(.1,{takeDamage(){}});
assert.equal(shot.y,-15);assert.equal(shot.dmg,58);assert.equal(shot.slowDur,2);
assert.equal(ice.flights[0].node.position.y,shot.y,'actual projectile renderer routes frost shots to the pool');
projectiles.tick(4,{takeDamage(){}});
assert(ice.flights.every(f=>!f.node.active));assert.equal(ice.trails.commands.length,0,'recycled final shot clears its trail');

const iceDump=process.argv.indexOf('--ice-preview');
if(iceDump>=0) {
  const states=[];
  for(let i=0;i<55;i++) {
    const t=i/30;
    ice.beginProjectileFrame();
    for(const [x,y,vx,vy] of [[-180,-300,0,850],[0,-280,280,802],[170,-280,-280,802]]) {
      if(y+vy*t<=config.LO.half+120)ice.projectile(x+vx*t,y+vy*t,vx,vy,6,t);
    }
    states.push({t,ground:[],trails:[...ice.trails.commands],bodies:ice.flights.slice(0,ice.used).map(f=>({
      x:f.node.position.x,y:f.node.position.y,w:f.ui.width,h:f.ui.height,angle:f.node.angle,
      anchor:f.ui.anchor,alpha:255,rect:f.sprite.spriteFrame.rect,resource:f.sprite.spriteFrame.texture.resource
    }))});
  }
  fs.writeFileSync(process.argv[iceDump+1],JSON.stringify(states));
}
const iceFrame=ice.frame;ice.root.destroy();assert(iceFrame.destroyed);
const lateIce=new FrostProjectileVFX(new Node('lateIce'));lateIce.root.destroy();flush();
assert.equal(lateIce.frame,null);assert([...sources.values()].every(s=>s.refs===0));
console.log('PASS: 128 fixed full-field contacts; 8 equal depth bands shuffled in time; enemy-independent patterns across 20 seeds; staggered emissions/contacts; actor occlusion; ground contact; pause/2x; recasts; cleanup; failed/late loads; regular 1.5s playback; unchanged hero hit/slow.');
console.log('PASS: original v10 restored; +1s card applied through real ultimate at levels 1/10 and all stacks; pool cap; painted normal ice shots/aspect/direction/stable trails; real projectile movement; final clear; bounded allocations; late cleanup.');

// Offline previews consume the ACTUAL renderer's sprite and Graphics states.
// This avoids a second approximate motion model without opening a real battle.
const dumpIndex = process.argv.indexOf('--preview-plan');
if (dumpIndex>=0) {
  const specs = JSON.parse(fs.readFileSync(process.argv[dumpIndex+1],'utf8'));
  const output = {};
  const partState = p => p.node.active && p.sprite.spriteFrame ? {
    x:p.node.position.x,y:p.node.position.y,angle:p.node.angle,
    w:p.ui.width,h:p.ui.height,anchor:p.ui.anchor||{x:.5,y:.5},alpha:p.sprite.color.a,
    rect:p.sprite.spriteFrame.rect,resource:p.sprite.spriteFrame.texture.resource
  } : null;
  for (const [name,spec] of Object.entries(specs)) {
    if(spec.layout) { config.LO.half=spec.layout.half; config.LINE_Y=-config.LO.half+154; }
    const storm = create(); flush(); seededCast(storm,spec.targets);
    const frames = [];
    for (const t of spec.times) {
      storm.age=t;
      if(t>=0 && t<2) {storm.running=true;storm.render();} else storm.hide();
      frames.push({t,ground:[...storm.ground.commands],trails:[...storm.trails.commands],
        backs:storm.hits.map(h=>partState(h.back)).filter(Boolean),
        fronts:storm.hits.map(h=>partState(h.front)).filter(Boolean),
        rain:storm.drops.map(d=>{const p=partState(d.part);return p?{...p,depthY:d.y}:null;}).filter(Boolean),
        chips:storm.chips.map(partState).filter(Boolean)});
    }
    output[name]={...spec,hitCount:storm.hits.length,rainCount:storm.rainCount,frames};
    storm.root.destroy();
  }
  fs.writeFileSync(process.argv[dumpIndex+2],JSON.stringify(output));
  console.log('Saved actual runtime states for offline composition.');
}
