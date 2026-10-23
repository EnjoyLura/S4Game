// Only the first visible map (or first tutorial battlefield) and two wallet icons.
// Content-addressed URLs are generated from the real Cocos ImageAsset metadata.
(function(){
  'use strict';
  var art=/*__STARTUP_ART_DATA__*/;
  try{
    var saved=JSON.parse(localStorage.getItem('kw_save_v1')||'null');
    var first=!saved||(saved.firstJourney&&saved.firstJourney.enabled&&!saved.firstJourney.entryStarted);
    var chapter=saved&&(saved.viewedChapter||parseInt(saved.unlocked,10))||1;
    var urls=[first?art.firstBattle:art.chapters[chapter]||art.chapters[1]].concat(art.common);
    urls.forEach(function(url){
      var link=document.createElement('link');
      link.rel='preload';link.as='image';link.crossOrigin='anonymous';
      // Scripts remain critical; these hints use otherwise idle startup bandwidth.
      link.setAttribute('fetchpriority','low');link.href=url;document.head.appendChild(link);
    });
  }catch(e){/* Storage restrictions never block normal Cocos loading. */}
})();
