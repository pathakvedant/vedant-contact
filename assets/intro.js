/* 3D logo intro on the home page: shown once per visit, click to skip */
(function(){
 var L=document.getElementById('loader'),H=document.documentElement,seen=false;
 try{seen=sessionStorage.getItem('traass_intro')==='1'}catch(e){}
 if(seen||matchMedia('(prefers-reduced-motion:reduce)').matches){L.remove();return}
 H.classList.add('intro');
 // Stack copies of each logo part along Z to give it real thickness
 var NS='http://www.w3.org/2000/svg',DEPTH=14,STEP=1.7;
 L.querySelectorAll('.ld-half').forEach(function(h){
  var gem=h.classList.contains('ld-gem');
  for(var i=0;i<DEPTH;i++){
   var s=document.createElementNS(NS,'svg'),p=document.createElementNS(NS,'path'),edge=i>0&&i<DEPTH-1;
   s.setAttribute('viewBox','0 0 100 172');
   s.style.transform='translateZ('+((i-(DEPTH-1)/2)*STEP)+'px)';
   p.setAttribute('d',h.dataset.d);p.setAttribute('fill-rule','evenodd');
   p.setAttribute('fill',gem?(edge?'#7d0c11':'#e8212a'):(edge?'#a85400':(i===0?'#fd7f00':'url(#ldGold)')));
   s.appendChild(p);h.appendChild(s);
  }
 });
 var D=document.createElement('div');
 D.innerHTML='<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="ldGold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="172"><stop offset="0" stop-color="#ffd25e"/><stop offset=".5" stop-color="#fd7f00"/><stop offset="1" stop-color="#ffd25e"/></linearGradient></defs></svg>';
 L.appendChild(D.firstChild);
 // Tilt the logo toward the pointer
 var S=document.getElementById('ldStage');
 L.addEventListener('pointermove',function(e){S.style.transform='rotateX('+((.5-e.clientY/innerHeight)*24)+'deg) rotateY('+((e.clientX/innerWidth-.5)*24)+'deg)'});
 var loaded=false,done=false,t0=performance.now(),F=document.getElementById('ldFill'),P=document.getElementById('ldPct');
 addEventListener('load',function(){loaded=true});
 function close(){if(done)return;done=true;try{sessionStorage.setItem('traass_intro','1')}catch(e){}
  L.classList.add('out');H.classList.remove('intro');setTimeout(function(){L.remove()},750)}
 L.addEventListener('click',close);
 setTimeout(close,6000); // never hold the site back on a slow connection
 (function tick(){if(done)return;var p=Math.min((performance.now()-t0)/3200,loaded?1:.92);
  F.style.width=(p*100)+'%';P.textContent=Math.round(p*100)+'%';
  if(p>=1)return void setTimeout(close,250);requestAnimationFrame(tick)})();
})();
