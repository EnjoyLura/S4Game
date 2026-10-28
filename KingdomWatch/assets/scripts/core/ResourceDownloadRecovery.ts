/** Keep a stalled native download from occupying Cocos' shared loading slots forever. */
import { assetManager } from 'cc';

type Complete=(error:Error|null,data?:unknown)=>void;
type Handler=(url:string,options:Record<string,any>,complete:Complete)=>void;
const DEADLINE_MS=45000;
let installed=false;

export function boundedDownload(handler:Handler):Handler {
  return (url,options,complete)=>{
    let settled=false;
    const finish:Complete=(error,data)=>{
      if(settled)return;settled=true;clearTimeout(timer);complete(error,data);
    };
    // The engine's Image element loader has no timeout. XHR uses the same budget;
    // the outer timer also covers handlers that never invoke either callback.
    const timer=setTimeout(()=>finish(new Error('download failed: '+url+' (timeout)')),DEADLINE_MS);
    try {handler(url,{...options,xhrTimeout:Math.min(Number(options.xhrTimeout)||DEADLINE_MS,DEADLINE_MS)},finish);}
    catch(error){if(settled)throw error;finish(error instanceof Error?error:new Error(String(error)));}
  };
}

export function installDownloadRecovery():void {
  if(installed)return;installed=true;
  const downloader=assetManager.downloader;
  // Present in the pinned 3.8.8 engine, omitted from its public declaration file.
  const handlers=(downloader as unknown as {handlers?:Record<string,Handler>}).handlers;
  if(!handlers)return;
  // Preserve the engine's ImageBitmap/DOM and font implementations, decoding and retries.
  for(const ext of ['.png','.jpg','.jpeg','.webp','.image','.json','.ttf','.otf','.woff','.woff2']){
    const original=handlers[ext];
    if(original)downloader.register(ext,boundedDownload(original));
  }
}
