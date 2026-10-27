/** Editable Blender v2 passes. Visual-only, shared textures, fixed sprite pools, battle age only. */
import { Color, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { ArtPriority, promoteUXArt, uxFrame } from '../ui/Ux';

export type LanceClipKind = 'body' | 'impact' | 'wave' | 'ground';
export const LANCE_CLIPS: readonly LanceClipKind[] = ['body','impact','wave','ground'];
export const lanceClipPath = (kind:LanceClipKind):string => 'fx/thunder_lance_'+kind+'_v142';
interface Manifest {
  schema:number;kind:LanceClipKind;frameCount:number;fps:number;cellSize:[number,number];
  anchor:[number,number];loop:boolean;alpha:string;frames:[number,number,number,number][];
  bodyLengthPixels?:number;visualWidthPerRadius?:number;
}
interface Clip {m:Manifest;frames:SpriteFrame[];buried:Map<number,SpriteFrame>;}
interface Slot {node:Node;sprite:Sprite;ui:UITransform;frame:SpriteFrame|null;}
const clips=new Map<LanceClipKind,Clip>();
const jobs=new Map<LanceClipKind,Promise<void>>();
const finite=(n:number)=>Number.isFinite(n);

function valid(m:Manifest,source:SpriteFrame,kind:LanceClipKind):boolean {
  return m?.schema===1&&m.kind===kind&&m.alpha==='straight'&&typeof m.loop==='boolean'
    &&Number.isInteger(m.frameCount)&&m.frameCount>0&&m.frameCount<=64&&finite(m.fps)&&m.fps>0&&m.fps<=60
    &&Array.isArray(m.cellSize)&&m.cellSize.length===2&&m.cellSize.every(n=>finite(n)&&n>0&&n<=1024)
    &&Array.isArray(m.anchor)&&m.anchor.length===2&&m.anchor.every(n=>finite(n)&&n>=0&&n<=1)
    &&(kind==='body'?finite(m.bodyLengthPixels!)&&m.bodyLengthPixels!>0&&m.bodyLengthPixels!<=m.cellSize[1]
      :finite(m.visualWidthPerRadius!)&&m.visualWidthPerRadius!>0&&m.visualWidthPerRadius!<=4)
    &&Array.isArray(m.frames)&&m.frames.length===m.frameCount&&m.frames.every(r=>Array.isArray(r)&&r.length===4
      &&r.every(finite)&&r[0]>=0&&r[1]>=0&&r[2]===m.cellSize[0]&&r[3]===m.cellSize[1]
      &&r[0]+r[2]<=source.rect.width&&r[1]+r[3]<=source.rect.height);
}
function makeFrame(source:SpriteFrame,x:number,y:number,w:number,h:number):SpriteFrame {
  const frame=new SpriteFrame();frame.reset({texture:source.texture,rect:new Rect(x,y,w,h),
    originalSize:new Size(w,h),offset:new Vec2()});frame.packable=false;return frame;
}
function load(kind:LanceClipKind,priority:ArtPriority):Promise<void> {
  const path=lanceClipPath(kind),hit=jobs.get(kind);
  if(hit){promoteUXArt(path,priority);return hit;}
  const image=new Promise<SpriteFrame|null>(resolve=>uxFrame(path,resolve,priority));
  const manifest=new Promise<Manifest|null>(resolve=>resources.load(path+'.frames',JsonAsset,
    (error,asset)=>resolve(!error&&asset?asset.json as Manifest:null)));
  const job=Promise.all([image,manifest]).then(([source,m])=>{
    if(!source||!m||!valid(m,source,kind))return;
    source.packable=false;
    const frames=m.frames.map(([x,y,w,h])=>makeFrame(source,source.rect.x+x,source.rect.y+y,w,h));
    const buried=new Map<number,SpriteFrame>();
    if(kind==='body')for(let level=0;level<=16;level++)for(let i=0;i<frames.length;i++){
      const frame=frames[i],r=frame.rect;
      const cut=Math.round(m.anchor[1]*m.cellSize[1]+m.bodyLengthPixels!*.11*level/16);
      buried.set(level*m.frameCount+i,makeFrame(frame,r.x,r.y,r.width,r.height-cut));
    }
    clips.set(kind,{m,frames,buried});
  });
  jobs.set(kind,job);
  void job.then(()=>{if(!clips.has(kind)&&jobs.get(kind)===job)jobs.delete(kind);});
  return job;
}
/** The existing entry barrier waits for these shared loads only when lance is equipped. */
export function warmLanceAtlas(priority:ArtPriority='next'):Promise<void> {
  return Promise.all(LANCE_CLIPS.map(kind=>load(kind,priority))).then(()=>{});
}
export function lanceAtlasReady():boolean{return LANCE_CLIPS.every(kind=>clips.has(kind));}
export function lanceAtlasFrame(age:number,fps:number,count:number,loop:boolean):number {
  const i=Math.floor(Math.max(0,finite(age)?age:0)*fps+1e-7);
  return loop?i%count:Math.min(count-1,i);
}
/** Match the study's 85ms axial punch and small settling recoil; ratio of visible shaft length. */
export function lanceInsertion(age:number):number {
  const t=Math.max(0,age),u=Math.min(1,t/.085);
  return t<=.085?.103*(1-(1-u)**2):.088+.015*Math.exp(-(t-.085)*26);
}

export class ThunderLanceAtlas {
  private readonly root:Node;
  private readonly slots:Slot[]=[];
  private readonly choices=new WeakMap<object,boolean>();
  private readonly tint=new Color(255,255,255,255);
  private used=0;private disposed=false;
  constructor(parent:Node,name:string,capacity:number){
    this.root=new Node(name);this.root.layer=Layers.Enum.UI_2D;this.root.setParent(parent);
    for(let i=0;i<capacity;i++){
      const node=new Node('lancePass'+i);node.layer=Layers.Enum.UI_2D;node.setParent(this.root);
      const ui=node.addComponent(UITransform),sprite=node.addComponent(Sprite);
      sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.trim=false;node.active=false;
      this.slots.push({node,ui,sprite,frame:null});
    }
    this.root.once(Node.EventType.NODE_DESTROYED,()=>{
      this.disposed=true;
      for(const slot of this.slots){if(slot.node.isValid)slot.sprite.spriteFrame=null;slot.frame=null;}
      this.slots.length=0;
    });
    void warmLanceAtlas('visible');
  }
  /** Failed/late loads cannot change the appearance halfway through a cast or planted field. */
  choose(owner:object):boolean {
    if(!this.choices.has(owner))this.choices.set(owner,lanceAtlasReady());
    return this.choices.get(owner)!;
  }
  begin():void{this.used=0;}
  private draw(clip:Clip,index:number,x:number,y:number,width:number,height:number,
    anchorX:number,anchorY:number,angle:number,alpha:number,burial=-1):boolean {
    if(this.disposed||this.used>=this.slots.length||!finite(alpha)||alpha<=0)return false;
    const frame=burial<0?clip.frames[index]:clip.buried.get(burial*clip.m.frameCount+index)!;
    const slot=this.slots[this.used++];
    if(slot.frame!==frame){slot.sprite.spriteFrame=frame;slot.frame=frame;}
    slot.ui.setAnchorPoint(anchorX,anchorY);slot.ui.setContentSize(width,height);
    slot.node.setPosition(x,y,0);slot.node.setRotationFromEuler(0,0,angle);
    this.tint.a=Math.round(255*Math.min(1,alpha));slot.sprite.color=this.tint;slot.node.active=true;
    return true;
  }
  spear(x:number,y:number,angle:number,size:number,age:number,seed:number,alpha=1,planted=false,phase=0):boolean {
    const clip=clips.get('body');if(!clip)return false;
    const m=clip.m,scale=size*8/m.bodyLengthPixels!;
    const index=lanceAtlasFrame(age+phase+seed*.6,m.fps,m.frameCount,true);
    if(planted){
      const level=Math.min(16,Math.round(lanceInsertion(age)/.11*16));
      const frame=clip.buried.get(level*m.frameCount+index)!;
      return this.draw(clip,index,x,y,m.cellSize[0]*scale,frame.rect.height*scale,.5,0,angle*180/Math.PI+90,alpha,level);
    }
    return this.draw(clip,index,x,y,m.cellSize[0]*scale,m.cellSize[1]*scale,m.anchor[0],m.anchor[1],angle*180/Math.PI+90,alpha);
  }
  pass(kind:Exclude<LanceClipKind,'body'>,x:number,y:number,radius:number,age:number,alpha=1,seed=0):boolean {
    const clip=clips.get(kind);if(!clip)return false;
    const m=clip.m;
    if(!m.loop&&age>=m.frameCount/m.fps)return true; // finished art stays finished, never replays
    const index=lanceAtlasFrame(age+(m.loop?seed*.8:0),m.fps,m.frameCount,m.loop);
    const width=radius*m.visualWidthPerRadius!;
    return this.draw(clip,index,x,y,width,width*m.cellSize[1]/m.cellSize[0],m.anchor[0],m.anchor[1],0,alpha);
  }
  end():void{for(let i=this.used;i<this.slots.length;i++)this.slots[i].node.active=false;}
}
