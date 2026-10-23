// A two-pixel VP8L image with transparency probes actual lossless WebP decoding.
// Shared by the launcher and diagnostics; injected inline by the offline exporter.
var kwWebPProbe;
function supportsLosslessWebP(){
  if(!kwWebPProbe)kwWebPProbe=new Promise(function(resolve){
    var image=new Image(),done=false;
    function finish(ok){if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;resolve(ok);}
    var timer=setTimeout(function(){finish(false);},5000);
    image.onload=function(){finish(image.naturalWidth===2&&image.naturalHeight===1);};
    image.onerror=function(){finish(false);};
    image.src='data:image/webp;base64,UklGRiIAAABXRUJQVlA4TBUAAAAvAQAAEA/wMes7JX/Fav5DGhnR/wAA';
  });
  return kwWebPProbe;
}
