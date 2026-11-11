/* TRAASS · Vedant Pathak — site logic */
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600)};

// ===== Settings =====
const EMAIL='vedant@traass.in';                           // the address visitors see (links, email-app fallback)
const INBOX=atob('cGF0aGFrdmVkYW50MDAxQGdtYWlsLmNvbQ=='); // main inbox where enquiries are delivered (Gmail), Base64 so it isn't plain text in the page
const FORM_ENDPOINT='https://formsubmit.co/ajax/'+INBOX;  // already activated for this inbox
const MY_PHONE=atob('KzkxIDYzOTI1IDM3NDU0');            // +91 phone, Base64 so it isn't plain text in the page
const SITE='https://traass.in/';
// Your real client conversion history. Fill in all three lists to show the chart on the site, e.g.
// {years:['2022','2023','2024','2025','2026'],leads:[...],converted:[...]}
const CONVERSION_HISTORY=null;

// Form checks: strip hidden characters, cap lengths, and limit how often one browser can send
const cleanText=(v,max=2000)=>String(v==null?'':v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);
const cleanLine=(v,max=120)=>cleanText(v,max).replace(/[\r\n]+/g,' ');
function allowSend(){const now=Date.now(),sent=store.get('vp_sent',[]).filter(t=>typeof t==='number'&&now-t<6e5);if(sent.length>=5)return false;sent.push(now);store.set('vp_sent',sent);return true}
async function sendForm(fields){
 if(!allowSend())throw new Error('too many');
 const data=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,k==='Message'?cleanText(v):cleanLine(v,k==='_subject'?160:120)]));
 const r=await fetch(FORM_ENDPOINT,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({_template:'table',_captcha:'false',Page:location.href,Time:new Date().toLocaleString('en-IN'),...data})});
 if(!r.ok)throw new Error('send failed');return r.json();
}

// ===== Background stars + cursor glow =====
const cv=$('#stars'),cx=cv.getContext('2d');let S=[];
function rs(){cv.width=innerWidth;cv.height=innerHeight;S=Array.from({length:Math.min(160,innerWidth/8)},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,r:Math.random()*1.5,v:Math.random()*.3+.05}))}
rs();addEventListener('resize',rs);
(function an(){cx.fillStyle='#05060f';cx.fillRect(0,0,cv.width,cv.height);
 const g=cx.createRadialGradient(cv.width*.75,cv.height*.15,0,cv.width*.75,cv.height*.15,cv.width*.6);g.addColorStop(0,'rgba(177,77,255,.13)');g.addColorStop(1,'transparent');cx.fillStyle=g;cx.fillRect(0,0,cv.width,cv.height);
 cx.fillStyle='rgba(200,220,255,.8)';S.forEach(s=>{s.y-=s.v;if(s.y<0)s.y=cv.height;cx.beginPath();cx.arc(s.x,s.y,s.r,0,7);cx.fill()});requestAnimationFrame(an)})();
const gc=$('#glowcur');addEventListener('pointermove',e=>{gc.style.left=e.clientX+'px';gc.style.top=e.clientY+'px'});

// ===== Nav, progress, active section, back to top =====
const nav=$('#nav'),menu=$('#menu'),burger=$('#burger');
burger.onclick=()=>{const o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o)};
$$('#menu a').forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
const secs=$$('main section, main header');
addEventListener('scroll',()=>{const y=scrollY,h=document.documentElement.scrollHeight-innerHeight;
 $('#progress').style.width=(y/h*100)+'%';nav.classList.toggle('solid',y>30);$('#toTop').classList.toggle('show',y>800);
 let cur='';secs.forEach(s=>{if(s.offsetTop-120<=y)cur=s.id});$$('#menu a').forEach(a=>a.classList.toggle('act',a.getAttribute('href')==='#'+cur&&!a.classList.contains('cta')))},{passive:true});
$('#toTop').onclick=()=>scrollTo({top:0});
$('#yr').textContent=new Date().getFullYear();

// ===== Typing =====
const roles=['Business Analyst','B2B Marketing for Manufacturing','Business Development & Client Conversion','Branding for Industrial Companies','Mechanical Engineer · Certified Data Analyst','Fan Design & APCD Expert','ERP & Dashboard Builder','Python for Data & Markets','Transforming Every Industry: Steel to FMCG'];let ri=0,ci=0,del=false;
(function ty(){const w=roles[ri];$('#typed').textContent='> '+w.slice(0,ci)+'_';if(!del&&ci++===w.length){del=true;return setTimeout(ty,1500)}if(del&&ci--===0){del=false;ri=(ri+1)%roles.length}setTimeout(ty,del?35:75)})();

// ===== Reveal, skill bars, counters =====
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('show');
 e.target.querySelectorAll('em[data-w]').forEach(m=>m.style.width=m.dataset.w+'%');
 e.target.querySelectorAll('.stat [data-c]').forEach(b=>{if(b.done)return;b.done=1;let n=0;const t=+b.dataset.c,st=setInterval(()=>{n+=Math.ceil(t/60);if(n>=t){n=t;clearInterval(st)}b.textContent=n.toLocaleString('en-IN')},25)})}),{threshold:.12});
$$('.reveal').forEach(r=>io.observe(r));

// ===== Journey =====
const J=[
 ['🎓 B.Tech: Mechanical Engineering','The foundation: fluid mechanics, thermodynamics and machine design. This is where I learned how air, heat and machines behave.'],
 ['🌀 Fan Design Software Expert','Industrial fan design and selection: duty point, static pressure, efficiency, motor sizing and noise. The right fan is the heart of every dust collection system.'],
 ['🏭 APCD Consulting & RCA · 5+ years','5+ years serving customers on Air Pollution Control Devices. I studied each application, did RCA of existing dust collection systems and recommended the best-suited APCD.'],
 ['📊 Certified Data Analyst','I took the engineer\'s habit of measuring everything into data: SQL, Excel, Power BI and storytelling. Readings became decisions.'],
 ['🚀 Digital Transformation: From Steel to FMCG','Now transforming businesses in every industry, from steel to FMCG, with ERP, live dashboards and B2B marketing, using engineering sense and data skills together.']];
function showJ(k){$('#jInfo').innerHTML=`<h3>${J[k][0]}</h3><p>${J[k][1]}</p>`;$$('.stg').forEach(g=>g.querySelector('circle,rect').style.strokeWidth=g.dataset.k==k?5:2)}
$$('.stg').forEach(g=>{g.style.cursor='pointer';g.setAttribute('tabindex','0');g.onclick=()=>showJ(+g.dataset.k);g.onkeydown=e=>{if(e.key==='Enter')showJ(+g.dataset.k)}});showJ(2);
const imp=$('#imp'),pg=$('#parts'),NS='http://www.w3.org/2000/svg';let P=[],ang=0;
for(let i=0;i<34;i++){const c=document.createElementNS(NS,'circle');c.setAttribute('r',3);pg.appendChild(c);P.push({el:c,x:Math.random()*920+40,o:Math.random()*14-7})}
(function fl(){ang=(ang+6)%360;imp.setAttribute('transform',`rotate(${ang})`);
 P.forEach(p=>{p.x+=2.2;if(p.x>960)p.x=40;p.el.setAttribute('cx',p.x);p.el.setAttribute('cy',170+p.o+Math.sin(p.x/30)*3);p.el.setAttribute('fill',p.x<500?'#c49a6c':'#00e5ff')});requestAnimationFrame(fl)})();

// ===== Raw data → story =====
const raw=[['North','TMT Bars',42,48,55,63],['South','TMT Bars',38,36,33,30],['West','Bag Filters',25,29,34,41],['East','Bag Filters',18,19,18,20],['West','ID Fans',30,31,35,38]];
const tb=$('#rawT tbody');
raw.forEach(r=>{const tr=document.createElement('tr');r.forEach((c,i)=>{const td=document.createElement('td');td.textContent=c;if(i>1)td.contentEditable=true;tr.appendChild(td)});tb.appendChild(tr)});
$('#tellStory').onclick=()=>{
 const rows=[...tb.rows].map(r=>{const c=[...r.cells].map(x=>x.textContent.trim());return{reg:c[0],prod:c[1],q:c.slice(2).map(v=>+v||0)}}).filter(r=>r.q[0]>0);
 if(!rows.length)return;
 rows.forEach(r=>{r.tot=r.q.reduce((a,b)=>a+b,0);r.gr=(r.q[3]-r.q[0])/r.q[0]*100});
 const tot=rows.reduce((a,r)=>a+r.tot,0),qs=[0,1,2,3].map(i=>rows.reduce((a,r)=>a+r.q[i],0));
 const by=f=>[...rows].sort(f)[0],best=by((a,b)=>b.gr-a.gr),worst=by((a,b)=>a.gr-b.gr),top=by((a,b)=>b.tot-a.tot);
 const g=((qs[3]-qs[0])/qs[0]*100).toFixed(1);
 $('#storyOut').innerHTML=`<h3 style="color:var(--txt)">📌 Sales ${g>=0?'grew':'fell'} ${Math.abs(g)}% from Q1 to Q4 (₹${tot} L total)</h3>
 <p>1️⃣ <strong>${esc(top.reg)}: ${esc(top.prod)}</strong> is the largest contributor at ${(top.tot/tot*100).toFixed(0)}% of revenue.</p>
 <p>2️⃣ <strong>${esc(best.reg)}: ${esc(best.prod)}</strong> is growing fastest (+${best.gr.toFixed(0)}% Q1→Q4).</p>
 <p>3️⃣ <strong>${esc(worst.reg)}: ${esc(worst.prod)}</strong> is ${worst.gr<0?'declining':'lagging'} (${worst.gr.toFixed(0)}%) and needs attention.</p>
 <p style="color:var(--a1);margin-top:10px">🎯 Action: shift sales effort toward ${esc(best.reg)} ${esc(best.prod)}, and run an RCA on ${esc(worst.reg)} ${esc(worst.prod)} covering pricing, competition and dealer coverage.</p>`;
};

// ===== Charts (need Chart.js) =====
function charts(){
 if(!window.Chart)return;
 Chart.defaults.color='#9aa3c7';Chart.defaults.borderColor='rgba(120,140,255,.12)';Chart.defaults.font.family='Inter';
 // fan curve
 const Q=Array.from({length:21},(_,i)=>i*1000),fanP=Q.map(q=>Math.max(0,250-6e-7*q*q));
 const fan=new Chart($('#cFan'),{type:'line',data:{labels:Q.map(q=>q/1000+'k'),datasets:[
  {label:'Fan curve (mmWC)',data:fanP,borderColor:'#b14dff',tension:.4,pointRadius:0},
  {label:'System curve',data:[],borderColor:'#00e5ff',tension:.4,pointRadius:0},
  {label:'Duty point',data:[],borderColor:'#ff4d9d',backgroundColor:'#ff4d9d',pointRadius:7,showLine:false}]},
  options:{plugins:{legend:{position:'bottom'}},scales:{x:{title:{display:true,text:'Airflow (m³/hr)'}},y:{min:0,max:300}}}});
 const sysK=$('#sysK');
 function fanUpd(){const k=+sysK.value*1e-7,sys=Q.map(q=>k*q*q);let bi=0,bd=1e9;Q.forEach((q,i)=>{const d=Math.abs(fanP[i]-sys[i]);if(d<bd){bd=d;bi=i}});
  fan.data.datasets[1].data=sys;fan.data.datasets[2].data=Q.map((q,i)=>i===bi?fanP[i]:null);fan.update('none');
  const q=Q[bi],p=fanP[bi],kw=(q/3600*p*9.81/1000/.75).toFixed(1);
  $('#fanOut').innerHTML=`<p><b class="mono" style="color:var(--txt);font-size:1.4rem">${q.toLocaleString('en-IN')} m³/hr</b><br>airflow at the duty point</p><p><strong>${p.toFixed(0)} mmWC</strong> static pressure</p><p><strong>≈ ${kw} kW</strong> shaft power (75% efficiency)</p><p style="color:var(--a1);font-size:.88rem;margin-top:8px">${+sysK.value>8?'⚠️ High resistance: check for choked bags or poor duct design. This is a classic RCA finding.':'✅ Healthy system: the fan is running near its best efficiency.'}</p>`}
 sysK.oninput=fanUpd;fanUpd();
 // dashboard
 const segs=['Steel','APCD','Engineering'],cols=['#00e5ff','#b14dff','#ff4d9d'];
 function gen(y,s){let seed=y*7+s.length*13;const r=()=>(seed=(seed*9301+49297)%233280)/233280;const base={Steel:60,APCD:40,Engineering:30}[s]*(1+(y-2024)*.18);return Array.from({length:12},(_,i)=>Math.round(base*(.8+r()*.5)+i*1.5))}
 const data={};[2023,2024,2025,2026].forEach(y=>{data[y]={};segs.forEach(s=>data[y][s]=gen(y,s))});
 const line=new Chart($('#cLine'),{type:'line',data:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],datasets:[]},options:{plugins:{legend:{position:'bottom'}},interaction:{mode:'index',intersect:false}}});
 const pie=new Chart($('#cPie'),{type:'doughnut',data:{labels:segs,datasets:[{data:[],backgroundColor:cols,borderWidth:0}]},options:{cutout:'65%',plugins:{legend:{position:'bottom'}}}});
 const sum=a=>a.reduce((x,y)=>x+y,0);
 function upd(){const y=+$('#fYear').value,s=$('#fSeg').value,use=s==='all'?segs:[s];
  line.data.datasets=use.map(k=>({label:k,data:data[y][k],borderColor:cols[segs.indexOf(k)],backgroundColor:cols[segs.indexOf(k)]+'22',fill:true,tension:.4}));line.update();
  pie.data.datasets[0].data=segs.map(k=>sum(data[y][k]));pie.update();
  const rev=sum(use.map(k=>sum(data[y][k]))),prev=sum(use.map(k=>sum(data[y-1][k]))),ord=Math.round(rev/2.4),pord=Math.round(prev/2.4);
  $('#kRev').textContent='₹'+(rev/100).toFixed(2)+' Cr';$('#kOrd').textContent=ord;$('#kAov').textContent='₹'+(rev/ord).toFixed(1)+' L';$('#kWin').textContent=(22+(y-2024)*3+use.length)+'%';
  const d=(a,b)=>`<small class="${a>=b?'up':'dn'}">${a>=b?'▲':'▼'} ${Math.abs((a-b)/b*100).toFixed(1)}% YoY</small>`;
  $('#kRevD').innerHTML=d(rev,prev);$('#kOrdD').innerHTML=d(ord,pord)}
 $('#fYear').onchange=$('#fSeg').onchange=upd;upd();
 // conversion history (only shown once real numbers are filled in)
 const H=CONVERSION_HISTORY;
 if(H){$('#convHistory').classList.remove('hidden');
  new Chart($('#cConv'),{data:{labels:H.years,datasets:[
   {type:'bar',label:'Leads',data:H.leads,backgroundColor:'rgba(0,229,255,.35)',borderRadius:6,yAxisID:'y'},
   {type:'bar',label:'Converted',data:H.converted,backgroundColor:'rgba(177,77,255,.7)',borderRadius:6,yAxisID:'y'},
   {type:'line',label:'Conversion %',data:H.leads.map((l,i)=>+(H.converted[i]/l*100).toFixed(1)),borderColor:'#ff4d9d',tension:.4,yAxisID:'y1'}]},
   options:{plugins:{legend:{position:'bottom'}},scales:{y1:{position:'right',grid:{display:false},ticks:{callback:v=>v+'%'}}}}})}
}
charts();

// ===== Sales funnel calculator =====
const money=l=>l>=100?'₹'+(l/100).toFixed(2)+' Cr':'₹'+l.toFixed(1)+' L';
function funnel(){
 const v=id=>+$('#'+id).value,leads=v('fLeads')*12,q=v('fQual'),p=v('fProp'),w=v('fWin'),aov=v('fAov');
 $('#fLeadsV').textContent=v('fLeads');$('#fQualV').textContent=q+'%';$('#fPropV').textContent=p+'%';$('#fWinV').textContent=w+'%';$('#fAovV').textContent='₹'+aov+' L';
 const qual=leads*q/100,prop=qual*p/100,ord=prop*w/100,rev=ord*aov;
 const steps=[['Qualifying your leads',q],['Getting qualified leads to a proposal',p],['Winning proposals',w]],leak=steps.reduce((a,b)=>b[1]<a[1]?b:a),li=steps.indexOf(leak);
 const uplift=ord*(leak[1]+5)/leak[1]-ord;
 const rows=[['Leads',leads],['Qualified',qual],['Proposals',prop],['Orders',ord]];
 $('#funnelOut').innerHTML=rows.map((r,i)=>`<div class="fstage${i===li+1?' leak':''}"><div><span>${r[0]}</span><b>${Math.round(r[1]).toLocaleString('en-IN')}</b></div><i style="width:${r[1]/leads*100}%"></i></div>`).join('')
  +`<div class="frev">${money(rev)} <small style="font-size:.7rem;color:var(--mut)">a year</small></div><p class="fnote"><strong>Biggest leak:</strong> ${leak[0].toLowerCase()} (${leak[1]}%). Improving just this step by 5 points adds about ${uplift.toFixed(1)} orders, worth ${money(uplift*aov)} a year.</p>`;
 $('#funnelCta').dataset.summary=`Hi Vedant, I tried your funnel calculator: ${v('fLeads')} leads a month, ${q}% qualify, ${p}% get a proposal, ${w}% win. My biggest leak looks like ${leak[0].toLowerCase()}. Can we talk?`;
}
$$('#funnelInputs input').forEach(i=>i.oninput=funnel);funnel();
$('#funnelCta').addEventListener('click',e=>{$('#cMsg').value=e.currentTarget.dataset.summary});

// ===== Blog =====
const POSTS=(window.POSTS||[]).map(p=>({...p,mins:Math.max(1,Math.round(p.body.split(/\s+/).length/200))})).sort((a,b)=>b.date.localeCompare(a.date));
const CAT_STYLE={'Business Development':['#ffb84d','🤝'],'APCD':['#ff4d9d','🏭'],'Fans':['#b14dff','🌀'],'Steel':['#3dffa8','🔩'],'ERP':['#00e5ff','🧩'],'Dashboards':['#ffb84d','📊'],'Marketing':['#4d8bff','📣'],'Data Story':['#00e5ff','📖']};
const cs=c=>CAT_STYLE[c]||['#00e5ff','📝'];
// One picture per line in a post: ![alt|caption](images/file.jpg){full|center|left|right|cover}. Same rule as tools/build_site.py
const IMG_LINE=/^!\[([^\]|]*)(?:\|([^\]]*))?\]\((images\/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|png|webp))\)(?:\{(full|center|left|right|cover)\})?$/;
const coverPic=p=>{const m=p.body.split(/\n/).map(l=>IMG_LINE.exec(l.trim())).filter(Boolean);const c=m.find(x=>x[4]==='cover')||m[0];return c?{src:'blog/'+c[3],alt:c[1].trim()}:null};
const cover=p=>{const pic=coverPic(p);if(pic)return `<div class="cover pic"><img src="${esc(pic.src)}" alt="${esc(pic.alt)}" loading="lazy" decoding="async"></div>`;const[c,e]=cs(p.cat);return `<div class="cover" style="background:linear-gradient(135deg,${c}33,#0b0e22 70%)">${p.emoji||e}</div>`};
const fmtDate=d=>new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
let likes=store.get('vp_likes',{}),cat='All';
const cats=['All',...new Set(POSTS.map(p=>p.cat))];
$('#cats').innerHTML=cats.map(c=>`<button class="cat${c==='All'?' on':''}" data-cat="${esc(c)}">${c==='All'?'All':cs(c)[1]+' '+esc(c)} <small>(${c==='All'?POSTS.length:POSTS.filter(p=>p.cat===c).length})</small></button>`).join('');
$$('.cat').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;$$('.cat').forEach(x=>x.classList.toggle('on',x===b));render()});
function card(p){return `<article class="card post" data-s="${p.slug}" tabindex="0">${cover(p)}<div class="body"><div class="meta"><span class="c">${esc(p.cat)}</span><span>${fmtDate(p.date)}</span><span>${p.mins} min read</span></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><div class="foot"><span>${likes[p.slug]?'❤️':'🤍'} ${likes[p.slug]?'Liked':'Like'}</span><span style="color:var(--a1)">Read →</span></div></div></article>`}
function render(){
 const q=$('#search').value.toLowerCase().trim(),sort=$('#sort').value;
 let list=POSTS.filter(p=>(cat==='All'||p.cat===cat)&&(p.title+p.excerpt+p.body+p.cat+(p.tags||[]).join(' ')).toLowerCase().includes(q));
 if(sort==='old')list=[...list].reverse();if(sort==='short')list=[...list].sort((a,b)=>a.mins-b.mins);
 const f=!q&&cat==='All'&&sort==='new'?list[0]:null;
 $('#featured').innerHTML=f?`<article class="card featured" data-s="${f.slug}" tabindex="0">${cover(f).replace('class="cover"','class="cover" style="font-size:5rem;background:linear-gradient(135deg,'+cs(f.cat)[0]+'44,#0b0e22 75%)"')}<div class="body"><span class="eyebrow">★ Latest post</span><div class="meta"><span class="c">${esc(f.cat)}</span><span>${fmtDate(f.date)}</span><span>${f.mins} min read</span></div><h3>${esc(f.title)}</h3><p>${esc(f.excerpt)}</p><span class="btn fill sm" style="margin-top:14px">Read the post →</span></div></article>`:'';
 $('#posts').innerHTML=(f?list.slice(1):list).map(card).join('')||'<p class="sub">No posts match. Try another word.</p>';
 $$('[data-s]').forEach(el=>{el.onclick=()=>openPost(el.dataset.s);el.onkeydown=e=>{if(e.key==='Enter')openPost(el.dataset.s)}});
}
$('#search').oninput=render;$('#sort').onchange=render;render();

function md(t){const out=[];let list=false;
 t.trim().split(/\n/).forEach(l=>{l=l.trim();const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  if(/^- /.test(l)){if(!list){out.push('<ul>');list=true}out.push('<li>'+inl(l.slice(2))+'</li>');return}
  if(list){out.push('</ul>');list=false}
  const pic=IMG_LINE.exec(l);if(pic){const cap=(pic[2]||'').trim();out.push(`<figure class="pimg pimg-${pic[4]||'center'}"><img src="blog/${esc(pic[3])}" alt="${esc(pic[1].trim())}" loading="lazy" decoding="async">${cap?`<figcaption>${esc(cap)}</figcaption>`:''}</figure>`);return}
  if(!l)return;if(/^## /.test(l))out.push('<h2>'+inl(l.slice(3))+'</h2>');else if(/^> /.test(l))out.push('<blockquote>'+inl(l.slice(2))+'</blockquote>');else out.push('<p>'+inl(l)+'</p>')});
 if(list)out.push('</ul>');return out.join('')}
const baseTitle=document.title,metaDesc=document.querySelector('meta[name=description]'),baseDesc=metaDesc.content;
function openPost(slug){const i=POSTS.findIndex(p=>p.slug===slug);if(i<0)return;const p=POSTS[i],prev=POSTS[i+1],next=POSTS[i-1];
 const url=(window.POST_PAGES||[]).includes(p.slug)?SITE+'blog/'+p.slug+'.html':SITE+'#post/'+p.slug,share=encodeURIComponent(url),txt=encodeURIComponent(p.title+' by Vedant Pathak');
 const rel=POSTS.filter(x=>x.cat===p.cat&&x.slug!==p.slug).slice(0,2);
 $('#rArt').innerHTML=`${cover(p).replace('class="cover"','class="cover" style="border-radius:18px;height:200px;font-size:4.5rem;background:linear-gradient(135deg,'+cs(p.cat)[0]+'44,#0b0e22 75%)"')}
 <div class="meta" style="margin-top:22px"><span class="c">${esc(p.cat)}</span><span>${fmtDate(p.date)}</span><span>${p.mins} min read</span><span>By Vedant Pathak</span></div>
 <h1>${esc(p.title)}</h1><div class="content">${md(p.body)}</div>
 <div class="toolbar"><button class="btn sm like${likes[p.slug]?' on':''}" id="likeBtn">${likes[p.slug]?'❤️ Liked':'🤍 Like'}</button>
  <a class="btn sm" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${share}">in Share</a>
  <a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=${txt}%20${share}">💬 WhatsApp</a>
  <button class="btn sm" id="copyBtn">🔗 Copy link</button>
  <a class="btn sm fill" href="#contact" id="rTalk">Talk to me about this →</a></div>
 ${rel.length?`<h3 style="margin-bottom:12px;font-size:.95rem">More on ${esc(p.cat)}</h3><div class="navposts" style="margin-bottom:20px">${rel.map(r=>`<div class="card" data-go="${r.slug}"><small>${r.mins} min read</small><h3>${esc(r.title)}</h3></div>`).join('')}</div>`:''}
 <div class="navposts">${prev?`<div class="card" data-go="${prev.slug}"><small>← Previous</small><h3>${esc(prev.title)}</h3></div>`:'<div></div>'}${next?`<div class="card" data-go="${next.slug}" style="text-align:right"><small>Next →</small><h3>${esc(next.title)}</h3></div>`:''}</div>`;
 $('#reader').classList.add('open');$('#reader').scrollTop=0;document.body.style.overflow='hidden';
 document.title=p.title+' | Vedant Pathak · TRAASS';metaDesc.content=p.excerpt;
 if(location.hash!=='#post/'+p.slug)history.pushState(null,'','#post/'+p.slug);
 $('#likeBtn').onclick=e=>{likes[p.slug]=!likes[p.slug];store.set('vp_likes',likes);e.target.classList.toggle('on',likes[p.slug]);e.target.textContent=likes[p.slug]?'❤️ Liked':'🤍 Like';render()};
 $('#copyBtn').onclick=()=>{navigator.clipboard?.writeText(url).then(()=>toast('Link copied ✓'),()=>toast(url))};
 $('#rTalk').onclick=()=>{closePost(true);$('#cMsg').value=`Hi Vedant, I read "${p.title}" and wanted to discuss…`};
 $$('[data-go]').forEach(el=>el.onclick=()=>openPost(el.dataset.go));
}
function closePost(keep){$('#reader').classList.remove('open');document.body.style.overflow='';document.title=baseTitle;metaDesc.content=baseDesc;if(!keep&&location.hash.startsWith('#post/'))history.pushState(null,'','#blog')}
$('#rClose').onclick=()=>closePost();
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#reader').classList.contains('open'))closePost()});
$('#reader').addEventListener('scroll',e=>{const r=e.target;$('#readBar').style.width=(r.scrollTop/(r.scrollHeight-r.clientHeight)*100)+'%'});
// Arriving from another page: the browser's own jump can be lost while this long page lays out
addEventListener('load',()=>{const el=location.hash.length>1&&!location.hash.startsWith('#post/')&&document.getElementById(location.hash.slice(1));if(el)setTimeout(()=>el.scrollIntoView({behavior:'instant'}),100)});
function route(){const m=location.hash.match(/^#post\/(.+)/);if(m)openPost(m[1]);else if($('#reader').classList.contains('open'))closePost(true)}
addEventListener('popstate',route);route();

// subscribe
$('#subForm').onsubmit=async e=>{e.preventDefault();if(e.target._honey.value)return;const b=e.target.querySelector('button');b.disabled=true;
 try{await sendForm({_subject:'📬 New blog subscriber',Email:$('#subMail').value});toast('Subscribed ✓ Thank you!');e.target.reset()}catch(err){toast('Could not subscribe. Please email me instead.')}b.disabled=false};

// ===== Phone gate: visitor shares number → you get it by email → they see yours =====
const fake=n=>/^(\d)\1{9}$/.test(n)||['1234567890','9876543210','0123456789'].includes(n);
function showPhone(name){const wa=MY_PHONE.replace(/\D/g,''),tel=MY_PHONE.replace(/\s/g,'');
 $('#phoneMask').innerHTML=`<a href="tel:${tel}">${MY_PHONE}</a>`;
 const txt=encodeURIComponent(`Hi Vedant, I'm ${name}. I found you through your TRAASS portfolio.`);
 $('#gate').innerHTML=`<p class="up">✅ Thanks ${esc(name)}! Call or WhatsApp anytime.</p><a class="btn sm" href="tel:${tel}" style="margin-top:10px">📞 Call now</a><a class="btn fill sm" style="margin-top:10px;background:#25D366" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${txt}">💬 Chat on WhatsApp</a>`}
const known=store.get('vp_visitor',null);if(known&&typeof known.name==='string')showPhone(cleanLine(known.name,80));
$('#gateForm').onsubmit=async e=>{e.preventDefault();if(e.target._honey.value)return;
 const name=cleanLine($('#vName').value,80),ph=$('#vPhone').value.trim(),msg=$('#gateMsg');
 if(name.length<2){msg.textContent='Please enter your name.';return}
 if(!/^[6-9]\d{9}$/.test(ph)||fake(ph)){msg.textContent='Please enter your real 10-digit mobile number.';return}
 const b=$('#revealBtn');b.disabled=true;b.textContent='Please wait…';
 try{await sendForm({_subject:`📞 New lead: ${name} (+91 ${ph})`,Name:name,Phone:'+91 '+ph,Company:$('#vCo').value||'-',Source:'Phone reveal'})}catch(err){}
 store.set('vp_visitor',{name});showPhone(name)};

// ===== Contact form =====
$$('form input:not([maxlength]):not([type=range]),form textarea').forEach(el=>{el.maxLength=el.tagName==='TEXTAREA'?2000:120});
$$('[data-topic]').forEach(a=>a.addEventListener('click',()=>{$('#cTopic').value=a.dataset.topic;setTimeout(()=>$('#cName').focus({preventScroll:true}),600)}));
$('#cForm').onsubmit=async e=>{e.preventDefault();if(e.target._honey.value)return;const b=$('#cBtn'),out=$('#cMsgOut');b.disabled=true;b.textContent='Sending…';
 try{await sendForm({_subject:`[TRAASS] ${$('#cTopic').value}: ${$('#cName').value}`,_replyto:$('#cMail').value,Name:$('#cName').value,Email:$('#cMail').value,Company:$('#cCo').value||'-',Topic:$('#cTopic').value,Message:$('#cMsg').value});
  out.innerHTML='<span class="up">✅ Message sent. I\'ll reply within 24 hours.</span>';e.target.reset()}
 catch(err){const s=encodeURIComponent(`[TRAASS] ${$('#cTopic').value}`),bd=encodeURIComponent($('#cMsg').value+'\n\n'+$('#cName').value);out.innerHTML=`Couldn't send from here. <a href="mailto:${EMAIL}?subject=${s}&body=${bd}">Open your email app instead →</a>`}
 b.disabled=false;b.textContent='Send Message'};
})();
