/** Shared final placement, including heroes that only supply tooltip content. */
export function battleTipPlacement(kind:'atk'|'skill'|'ult',heroX:number,w:number,h:number,
  iconY:number,ultX:number,ultY:number,half:number,preferredX?:number,preferredY?:number){
  const fallbackX=kind==='ult'?ultX-45-16-w/2:heroX+(kind==='atk'?-27:27)+23+16+w/2;
  const fallbackY=kind==='ult'?ultY:iconY+23+16+h/2;
  const x=typeof preferredX==='number'&&Number.isFinite(preferredX)?preferredX:fallbackX;
  const y=typeof preferredY==='number'&&Number.isFinite(preferredY)?preferredY:fallbackY;
  return {x:Math.max(-375+w/2+8,Math.min(375-w/2-8,x)),
    y:Math.max(-half+h/2+8,Math.min(half-h/2-8,y))};
}
