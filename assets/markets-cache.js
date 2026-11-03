/* Markets page: checks every price file, and keeps good copies in this browser.
   Nothing is sent anywhere: the saved copies stay on the visitor's own device. */
const MarketData=(()=>{
 const SYMBOL=/^[A-Z0-9][A-Z0-9&._-]{0,24}$/,DAY=/^\d{4}-\d{2}-\d{2}$/,PLAIN=/^[^<>`\u0000-\u001f]{0,160}$/;
 const LIMITS={quotes:2e6,symbols:1e6,history:1.5e6},MAX_PRICE=1e7,MAX_MOVE=.5,MAX_BARS=6000;
 const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const price=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<MAX_PRICE;
 const priceOrNull=v=>v==null||price(v);
 const tomorrow=()=>new Date(Date.now()+864e5).toISOString().slice(0,10);

 // [price, previous close, open, high, low, volume, date]
 function validRow(r){
  if(!Array.isArray(r)||r.length!==7)return false;
  const [p,prev,open,high,low,vol,date]=r;
  if(!price(p)||!priceOrNull(prev)||!priceOrNull(open)||!priceOrNull(high)||!priceOrNull(low))return false;
  if(!Number.isSafeInteger(vol)||vol<0)return false;
  if(typeof date!=='string'||!DAY.test(date)||date>tomorrow())return false;
  if(high!=null&&low!=null&&high<low)return false;
  return prev==null||Math.abs(p/prev-1)<=MAX_MOVE; // a bigger one-day move is treated as bad data
 }
 function cleanSection(src,keyOk){
  const out=Object.create(null);
  if(isObj(src))for(const k of Object.keys(src))if(keyOk(k)&&validRow(src[k]))out[k]=src[k];
  return out;
 }
 function quotes(q){
  if(!isObj(q)||typeof q.updated!=='string')throw new Error('Bad price file');
  const when=Date.parse(q.updated);
  if(!Number.isFinite(when)||when>Date.now()+864e5)throw new Error('Bad price date');
  const clean={updated:q.updated,idx:cleanSection(q.idx,k=>PLAIN.test(k)&&k.length<30),NSE:cleanSection(q.NSE,k=>SYMBOL.test(k)),BSE:cleanSection(q.BSE,k=>SYMBOL.test(k))};
  if(!Object.keys(clean.NSE).length)throw new Error('No valid prices');
  return clean;
 }
 function symbols(list){
  if(!Array.isArray(list))throw new Error('Bad stock list');
  const clean=list.filter(r=>Array.isArray(r)&&r.length===5&&SYMBOL.test(r[0])&&r.slice(1).every(v=>typeof v==='string'&&PLAIN.test(v)));
  if(!clean.length)throw new Error('Empty stock list');
  return clean;
 }
 function history(f){
  if(!isObj(f)||!Array.isArray(f.t)||!f.t.length||f.t.length>MAX_BARS)throw new Error('Bad history');
  const n=f.t.length,clean={};
  for(const k of ['t','o','h','l','c','v'])if(!Array.isArray(f[k])||f[k].length!==n)throw new Error('Bad history');else clean[k]=f[k];
  const limit=Date.now()/1000+864e2;
  for(let i=0;i<n;i++){
   if(!Number.isSafeInteger(f.t[i])||f.t[i]>limit||(i&&f.t[i]<=f.t[i-1]))throw new Error('Bad history dates');
   if(!priceOrNull(f.o[i])||!priceOrNull(f.h[i])||!priceOrNull(f.l[i])||!priceOrNull(f.c[i])||!Number.isSafeInteger(f.v[i])||f.v[i]<0)throw new Error('Bad history prices');
  }
  return clean;
 }
 const CHECK={quotes,symbols,history};

 // Same-site files only, size-limited before parsing, never with cookies or redirects
 async function download(kind,url,ms=15000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{
   const r=await fetch(url,{signal:c.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const text=await r.text();
   if(text.length>LIMITS[kind])throw new Error('File too large');
   return CHECK[kind](JSON.parse(text));
  }finally{clearTimeout(t)}
 }

 // ===== Saved copies (IndexedDB). Any failure here just means no saved copy. =====
 const DB='traass-market',STORE='files',KEEP_HISTORY=40;
 let dbp;
 function db(){
  if(!dbp)dbp=new Promise((res,rej)=>{
   if(!window.indexedDB)return rej(new Error('No storage'));
   const q=indexedDB.open(DB,1);
   q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'key'});
   q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);
  });
  return dbp;
 }
 const tx=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{
  const t=d.transaction(STORE,mode),r=fn(t.objectStore(STORE));
  t.oncomplete=()=>res(r&&r.result);t.onerror=t.onabort=()=>rej(t.error);
 }));
 // Saved copies are checked again on the way out: browser storage can be edited
 async function read(key,kind){
  try{
   const row=await tx('readonly',s=>s.get(key));
   if(!row)return null;
   return {data:CHECK[kind](row.data),savedOn:row.savedOn};
  }catch(e){remove(key);return null}
 }
 const remove=key=>tx('readwrite',s=>s.delete(key)).catch(()=>{});
 function write(key,kind,data){
  return tx('readwrite',s=>s.put({key,kind,data,savedOn:new Date().toISOString().slice(0,10),used:Date.now()})).then(()=>kind==='history'&&prune()).catch(()=>{});
 }
 async function prune(){
  const all=(await tx('readonly',s=>s.getAll())).filter(r=>r.kind==='history').sort((a,b)=>b.used-a.used);
  await Promise.all(all.slice(KEEP_HISTORY).map(r=>remove(r.key)));
 }
 return {download,read,write,validRow,check:CHECK};
})();
