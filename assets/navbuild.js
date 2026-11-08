/* Home page, desktop only, skipped for reduced motion:
   1. Each time the page opens, four design-tool pointers swirl in, draw the menu bar and drop each link in.
   2. Hovering a menu link shows a selection box with its name and size.
   3. As each part of the page scrolls into view (headings, cards, charts, buttons, images...), a pointer marks it with a selection box. */
(function(){
 var H=document.documentElement,nav=document.getElementById('nav'),menu=document.getElementById('menu');
 if(!nav||!menu)return;
 var desk=matchMedia('(min-width:961px) and (pointer:fine)'),calm=matchMedia('(prefers-reduced-motion:reduce)');
 var COL=['#00e5ff','#b14dff','#ff4d9d','#3dffa8'],TAG=['VP','Data','Brand','BD'];
 var ARROW='<svg viewBox="0 0 16 20" width="16" height="20" aria-hidden="true"><path d="M1 1V16L5 12.2L8 19L10.8 17.8L7.9 11.2H13.5Z"/></svg>';
 var STOP=['wheel','keydown','pointerdown','touchstart'];
 // Page parts that get marked (part 3): the first matching kind names the box
 var KINDS=[['h1','h1'],['h2','h2'],['.kpi','kpi'],['.card','card'],['h3','h3'],['canvas','chart'],['table','table'],['form','form'],
  ['img','img'],['.btn,button','button'],['.chip','chip'],['.step','step'],['blockquote','quote'],['.eyebrow','label']];
 var page,queue=[],active=0,lastAt=0,turn=0,MAX=3,GAP=280;

 function mk(cls,parent,html){var e=document.createElement('div');e.className=cls;e.setAttribute('aria-hidden','true');if(html)e.innerHTML=html;parent.appendChild(e);return e}
 function size(r){return Math.round(r.width)+' × '+Math.round(r.height)}
 function frame(b,r,text){var s=b.style;s.left=r.left+'px';s.top=r.top+'px';s.width=r.width+'px';s.height=r.height+'px';if(text!=null)b.lastChild.textContent=text}
 function box(parent,cls,j){var b=mk('nb-box '+(cls||''),parent,'<i></i><i></i><i></i><i></i><span></span>');if(j!=null)b.style.setProperty('--c',COL[j]);return b}
 function go(c,x,y,ms){c.style.transition='transform '+ms+'ms cubic-bezier(.55,0,.25,1),opacity .4s';c.style.transform='translate('+(x-1)+'px,'+(y-1)+'px)'}
 // Pointers start invisible and fade in on the next move
 function cur(parent,j,x,y){var c=mk('nb-cur bye',parent,ARROW+'<b>'+TAG[j]+'</b>');c.style.setProperty('--cc',COL[j]);go(c,x,y,0);c.getBoundingClientRect();return c}

 // 2. Hover: one selection box that slides from link to link
 var hl=mk('nb-layer',document.body),hov=box(hl,'nb-hov');
 menu.addEventListener('mouseover',function(e){
  var a=e.target.closest('a');if(!a||!desk.matches)return;
  var r=a.getBoundingClientRect();
  if(!hov.classList.contains('on')){hov.style.transition='none';frame(hov,r);hov.getBoundingClientRect();hov.style.transition=''}
  frame(hov,r,a.textContent.trim()+' · '+size(r));hov.classList.add('on');
 });
 menu.addEventListener('mouseleave',function(){hov.classList.remove('on')});

 if(!desk.matches||calm.matches){H.classList.remove('navbuild');return}
 try{headings()}catch(e){} // a problem here must never keep the menu hidden

 // 1. Menu build-in (intro.js adds the class early, so the menu never flashes before it)
 if(!H.classList.contains('navbuild'))return;
 function start(){
  var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
  fonts.then(function(){setTimeout(function(){
   if(scrollY>80){H.classList.remove('navbuild');return} // reopened lower down the page: just show the menu
   build();
  },100)});
 }
 if(!H.classList.contains('intro'))start();
 else new MutationObserver(function(m,o){if(!H.classList.contains('intro')){o.disconnect();start()}}).observe(H,{attributes:true,attributeFilter:['class']});

 function build(){
  var items=[nav.querySelector('.logo')].concat([].slice.call(menu.children));
  var layer=mk('nb-layer',document.body),timers=[],done=false,vw=innerWidth,vh=innerHeight;
  var W=nav.querySelector('.wrap').getBoundingClientRect();
  function later(fn,ms){timers.push(setTimeout(fn,ms))}
  function finish(){
   if(done)return;done=true;timers.forEach(clearTimeout);
   STOP.forEach(function(t){removeEventListener(t,finish,true)});
   items.forEach(function(it){it.classList.add('nb-in')});
   layer.classList.add('nb-gone');
   setTimeout(function(){layer.remove();H.classList.remove('navbuild');items.forEach(function(it){it.classList.remove('nb-in')})},500);
  }
  // Any scroll, key or click ends it at once, so nobody waits for it
  STOP.forEach(function(t){addEventListener(t,finish,{capture:true,passive:true})});

  // Swirl: the four pointers fade in circling one spot, as in the video
  var cx=vw/2,cy=Math.min(vh*.42,320),crew=[0,1,2,3].map(function(j){return cur(layer,j,cx,cy)});
  var t0=performance.now();
  requestAnimationFrame(function spin(now){
   var t=now-t0;if(done||t>700)return;
   var rad=46*Math.min(1,t/250);
   crew.forEach(function(c,j){var a=t/900*2*Math.PI+j*Math.PI/2;go(c,cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.8,0)});
   requestAnimationFrame(spin);
  });
  later(function(){crew.forEach(function(c){c.classList.remove('bye')})},40);

  // The crew breaks up: the lead heads for the top-left corner of the bar, the rest wait just below it
  var lead=crew[0],bar=box(layer,'nb-drag');
  later(function(){
   go(lead,W.left+4,W.top+6,450);
   [.3,.55,.8].forEach(function(f,i){go(crew[i+1],W.left+W.width*f,W.bottom+70,500)});
  },700);
  // The lead drags out the menu bar
  later(function(){
   frame(bar,{left:W.left+4,top:W.top+6,width:0,height:0},'');bar.classList.add('on');bar.getBoundingClientRect();
   bar.classList.add('grow');frame(bar,{left:W.left+4,top:W.top+6,width:W.width-8,height:W.height-12},'nav · '+size(W));
   go(lead,W.right-4,W.bottom-6,550);
  },1150);
  later(function(){bar.classList.add('fill')},1700);
  later(function(){bar.classList.remove('on')},1950);

  // Each pointer drops its share of the links, each in a box of its own colour
  items.forEach(function(it,k){
   var j=k%4,c=crew[j],t=1750+j*100+Math.floor(k/4)*320;
   later(function(){var r=it.getBoundingClientRect();go(c,r.right-8,r.bottom-6,300)},t);
   later(function(){
    var r=it.getBoundingClientRect(),b=box(layer,'',j);
    frame(b,r,size(r));b.classList.add('on');it.classList.add('nb-in');
    later(function(){b.classList.remove('on')},450);
   },t+300);
  });

  // The pointers leave (about 3.7 s in all)
  later(function(){
   [[vw*.5,vh+60],[vw+60,-60],[-60,vh*.3],[vw*.9,vh+60]].forEach(function(p,i){go(crew[i],p[0],p[1],600);crew[i].classList.add('bye')});
  },3150);
  later(finish,3700);
 }

 // 3. Everything on the page: as each part scrolls into view, a pointer marks it with a selection box.
 //    Each part once per visit, at most three at a time, so the page never gets crowded.
 //    The first matching kind names the box; a part inside another marked part (a heading inside a card) is left alone.
 function kind(el){for(var i=0;i<KINDS.length;i++)if(el.matches(KINDS[i][0]))return KINDS[i][1]}
 function headings(){
  var main=document.querySelector('main');
  if(!main||!('IntersectionObserver' in window))return;
  page=mk('nb-page',document.body);
  var all=[].slice.call(main.querySelectorAll(KINDS.map(function(k){return k[0]}).join(','))),set=new Set(all);
  var parts=all.filter(function(el){for(var p=el.parentElement;p&&p!==main;p=p.parentElement)if(set.has(p))return false;return true});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
   if(!e.isIntersecting||(e.intersectionRatio<.6&&e.intersectionRect.height<innerHeight*.4))return;
   io.unobserve(e.target);afterFade(e.target);
  })},{rootMargin:'0px 0px -15% 0px',threshold:[.25,.6,1]});
  parts.forEach(function(el){io.observe(el)});
 }
 // Wait until a fading-in section has settled, so the box lands where the part ends up
 function afterFade(el){
  var rv=el.closest('.reveal'),fading=rv&&!rv.classList.contains('show');
  (function wait(){
   if(rv&&!rv.classList.contains('show'))return void setTimeout(wait,150);
   setTimeout(function(){queue.push(el);pump()},fading?950:100);
  })();
 }
 function pump(){
  if(H.classList.contains('navbuild'))return void setTimeout(pump,400); // the menu build goes first
  while(active<MAX&&queue.length){
   var wait=lastAt+GAP-performance.now();if(wait>0)return void setTimeout(pump,wait);
   var el=queue.shift(),r=el.getBoundingClientRect();
   if(r.width<8||r.height<8||r.bottom<0||r.top>innerHeight||!desk.matches)continue; // scrolled past or hidden: skip
   lastAt=performance.now();active++;draw(el,turn++%4);
  }
 }
 function draw(el,j){
  var t=el.getBoundingClientRect(),pad=3,label=kind(el)||'div';
  if(/^(h\d|label)$/.test(label)){var rg=document.createRange();rg.selectNodeContents(el);t=rg.getBoundingClientRect();pad=6} // headings and labels: hug the text
  var r={left:t.left+scrollX-pad,top:t.top+scrollY-pad,width:t.width+pad*2,height:t.height+pad*2};
  var ex=r.left+r.width,ey=r.top+r.height;
  var c=cur(page,j,ex+160,ey+90),b=box(page,'',j);
  c.classList.remove('bye');
  go(c,ex-8,ey-6,650);
  setTimeout(function(){frame(b,r,label+' · '+size(t));b.classList.add('on')},650);
  setTimeout(function(){b.classList.remove('on');go(c,ex+140,r.top-50,700);c.classList.add('bye');active--;pump()},1950);
  setTimeout(function(){c.remove();b.remove()},2800);
 }
})();
