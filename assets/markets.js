/* Markets page: NSE/BSE prices + Python Lab (Pyodide).
   Prices are files saved by tools/fetch_market_data.py; only FEED below reads them. */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(v);return Number.isFinite(n)?n:null};
const fmt=(v,d=2)=>{const n=num(v);return n==null?'–':n.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})};
const SAFE_ID=/^[A-Z0-9][A-Z0-9&._-]{0,24}$/;
const fileKey=s=>s.replace(/[^A-Za-z0-9]/g,'_'); // same rule as file_key() in the fetch script

// ===== Price provider =====
const quoteFields=(r,sym,ex)=>({sym,ex,price:r[0],prev:r[1],open:r[2],high:r[3],low:r[4],vol:r[5],date:r[6],change:r[1]?r[0]-r[1]:null,pct:r[1]?(r[0]-r[1])/r[1]*100:null});
const today=()=>new Date().toISOString().slice(0,10);
const FEED={
 base:'data/market/',quotes:null,symbols:[],files:{},fresh:false,
 // Shows the visitor's saved copies at once; the network then replaces them
 async loadSaved(){
  const [q,sym]=await Promise.all([MarketData.read('quotes','quotes'),MarketData.read('symbols','symbols')]);
  if(q)this.quotes=q.data;
  if(sym)this.symbols=sym.data;
  this.symbolsDay=sym&&sym.savedOn;
 },
 // GitHub Pages caches files for about 10 minutes, so ask for a fresh copy each minute
 async refresh(){
  const q=await MarketData.download('quotes',`${this.base}quotes.json?t=${Math.floor(Date.now()/60000)}`);
  // An older copy from a web cache must not replace newer prices
  if(!this.quotes||Date.parse(q.updated)>=Date.parse(this.quotes.updated)){this.quotes=q;MarketData.write('quotes','quotes',q)}
  this.fresh=true;
  return this.quotes;
 },
 async loadSymbols(){
  if(this.symbols.length&&this.symbolsDay===today())return;
  try{this.symbols=await MarketData.download('symbols',`${this.base}symbols.json?d=${today()}`);this.symbolsDay=today();MarketData.write('symbols','symbols',this.symbols)}
  catch(e){if(!this.symbols.length)throw e}
 },
 info(sym){return this.symbols.find(x=>x[0]===sym)},
 quote(sym,ex){const r=this.quotes&&this.quotes[ex]&&this.quotes[ex][sym];if(!r)throw new Error('No price for '+sym);return quoteFields(r,sym,ex)},
 index(name){const r=this.quotes&&this.quotes.idx[name];if(!r)throw new Error('No price for '+name);return quoteFields(r,name,'')},
 // Past prices: saved copy if it is from today, then the site, then any older saved copy
 async pastPrices(key){
  if(this.files[key])return this.files[key];
  const saved=await MarketData.read('h:'+key,'history');
  if(saved&&saved.savedOn===today())return this.files[key]=saved.data;
  try{
   const f=await MarketData.download('history',`${this.base}history/${key}.json?d=${today()}`);
   MarketData.write('h:'+key,'history',f);
   return this.files[key]=f;
  }catch(e){
   if(saved)return this.files[key]=saved.data;
   throw new Error('Past prices for this stock are not ready yet.');
  }
 },
 async history(symbol,days,kind='stock'){
  const f=await this.pastPrices((kind==='index'?'IDX_':'')+fileKey(symbol));
  const from=Math.floor(Date.now()/1000)-days*86400,start=Math.max(0,f.t.findIndex(t=>t>=from));
  const h=Object.fromEntries(['t','o','h','l','c','v'].map(k=>[k,f[k].slice(start)]));
  // The history file updates once a day, so add today's bar from the latest prices
  const q=kind==='index'?this.quotes.idx[symbol]:this.quotes.NSE[symbol];
  const last=h.t.length-1,lastDay=new Date(h.t[last]*1000).toISOString().slice(0,10);
  if(q&&q[6]>lastDay){h.t.push(Date.parse(q[6])/1000);h.o.push(q[2]);h.h.push(q[3]);h.l.push(q[4]);h.c.push(q[0]);h.v.push(q[5])}
  else if(q&&q[6]===lastDay){h.c[last]=q[0];h.h[last]=q[3];h.l[last]=q[4];h.v[last]=q[5]}
  return h;
 }
};

// ===== State =====
const INDICES=['NIFTY 50','SENSEX','NIFTY BANK'];
const DEFAULT_WL=[['RELIANCE','Reliance'],['TCS','TCS'],['HDFCBANK','HDFC Bank'],['INFY','Infosys'],['ICICIBANK','ICICI Bank'],['SBIN','SBI'],['ITC','ITC'],['LT','Larsen'],['TATASTEEL','Tata Steel']];
const S={id:'RELIANCE',ex:'NSE',q:null,days:365,hist:null};
let watch=DEFAULT_WL;
try{const w=JSON.parse(localStorage.getItem('traass_watch_nse'));if(Array.isArray(w)&&w.every(x=>SAFE_ID.test(x[0])))watch=w}catch(e){}
const saveWatch=()=>{try{localStorage.setItem('traass_watch_nse',JSON.stringify(watch))}catch(e){}};

function marketOpen(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const m=+p.hour*60+ +p.minute;
 return !['Sat','Sun'].includes(p.weekday)&&m>=555&&m<=930; // 9:15 to 15:30 IST; exchange holidays are not known here
}
function setStatus(ok){
 const el=$('mkStatus'),updated=FEED.quotes&&FEED.quotes.updated;
 if(!updated){el.className='mk-status err';el.lastElementChild.textContent=ok===false?'Price data is not available yet. Retrying…':'Connecting…';return}
 const when=new Date(updated),time=when.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
 if(!FEED.fresh){el.className='mk-status'+(ok===false?' err':'');el.lastElementChild.textContent=ok===false?`Could not update · showing saved prices from ${time}`:`Showing saved prices from ${time} · updating…`;return}
 const open=marketOpen(),late=Date.now()-when.getTime()>45*60000;
 if(!ok||(open&&late)){el.className='mk-status err';el.lastElementChild.textContent=`Prices delayed · last update ${time}`;return}
 el.className='mk-status'+(open?' live':'');
 el.lastElementChild.textContent=open?`Market hours · prices as of ${time}, refreshed about every 10 minutes`:`Market closed · last update ${time}`;
}
const chg=(a,b)=>{const n=num(a),c=n>=0?'mk-up':'mk-dn';return n==null?'':`<span class="${c}">${n>=0?'▲ +':'▼ '}${fmt(a)} (${fmt(b)}%)</span>`};

// ===== Indices =====
function loadIndices(){
 $('mkIndices').innerHTML=INDICES.map(name=>{let d=null;try{d=FEED.index(name)}catch(e){}
  return `<div class="mk-idx"><small>${esc(name)}</small><b>${d?fmt(d.price):'–'}</b>${d?chg(d.change,d.pct):''}</div>`}).join('');
}

// ===== Selected stock =====
async function loadQuote(){
 const d=FEED.quote(S.id,S.ex),info=FEED.info(S.id)||[],name=info[1]||S.id;
 const prev=S.q&&S.q.price;S.q=d;
 $('qName').textContent=name;
 $('qMeta').textContent=[S.ex,S.ex==='BSE'&&info[4]||S.id,info[2]].filter(Boolean).join(' · ');
 const pe=$('qPrice');pe.textContent='₹'+fmt(d.price);
 if(prev&&prev!==d.price){pe.style.color=d.price>prev?'var(--ok)':'var(--a3)';setTimeout(()=>pe.style.color='',700)}
 $('qChange').innerHTML=chg(d.change,d.pct);
 const year=await FEED.history(S.id,365).catch(()=>null),valid=a=>a.filter(v=>v!=null);
 const st=[['Open',fmt(d.open)],['Prev close',fmt(d.prev)],['Day high',fmt(d.high)],['Day low',fmt(d.low)],['52W high',year?fmt(Math.max(...valid(year.h))):'–'],['52W low',year?fmt(Math.min(...valid(year.l))):'–'],['Volume',fmt(d.vol,0)],['Price date',esc(d.date)]];
 $('qStats').innerHTML=st.map(x=>`<div class="mk-stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
 updateWatchBtn();
 document.title=`${name} ₹${fmt(d.price)} | TRAASS Markets`;
 $('labStock').textContent=name;
}

let priceChart;
async function loadChart(){
 const id=S.id,h=await FEED.history(id,S.days);
 if(id!==S.id)return;
 const labels=h.t.map(t=>new Date(t*1000).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit',timeZone:'UTC'}));
 const up=h.c[h.c.length-1]>=h.c[0],col=up?'#3dffa8':'#ff4d9d';
 if(priceChart)priceChart.destroy();
 priceChart=new Chart($('priceChart'),{type:'line',data:{labels,datasets:[{label:'Close (₹)',data:h.c,borderColor:col,backgroundColor:col+'1f',fill:true,pointRadius:0,borderWidth:2,tension:.1,spanGaps:true}]},options:baseOpts(false)});
}
function baseOpts(legend=true){return{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:legend,position:'bottom',labels:{color:'#9aa3c7',boxWidth:12}}},scales:{x:{ticks:{color:'#9aa3c7',maxTicksLimit:7,maxRotation:0},grid:{color:'rgba(120,140,255,.08)'}},y:{ticks:{color:'#9aa3c7'},grid:{color:'rgba(120,140,255,.08)'}}}}}

async function selectStock(id,ex){
 if(!SAFE_ID.test(id))return;
 S.id=id;S.ex=ex||S.ex;S.q=null;
 $('exNSE').classList.toggle('on',S.ex==='NSE');$('exBSE').classList.toggle('on',S.ex==='BSE');
 const link=$('qLink');
 link.href=S.ex==='NSE'?`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(id)}`:'https://www.bseindia.com/';
 link.textContent=`Check on ${S.ex} ↗`;
 $('qName').textContent='Loading…';$('qPrice').textContent='–';$('qChange').textContent='';
 $('qChartMsg').textContent='';
 try{await loadQuote();setStatus(true)}
 catch(e){
  // A few shares have no price on one exchange
  if(!S.q&&!selectStock.retry){selectStock.retry=true;try{await selectStock(id,S.ex==='NSE'?'BSE':'NSE')}finally{selectStock.retry=false}return}
  $('qName').textContent='Could not load this stock';$('qMeta').textContent='Its price data is not available right now. Please try again later.';setStatus(!!S.q);return
 }
 try{await loadChart()}
 catch(e){if(priceChart){priceChart.destroy();priceChart=null}$('qChartMsg').textContent=e.message}
}

// ===== Watchlist =====
const inWatch=()=>watch.some(w=>w[0]===S.id);
function updateWatchBtn(){$('qWatch').textContent=inWatch()?'★ Remove from watchlist':'☆ Add to watchlist'}
$('qWatch').onclick=()=>{
 if(inWatch())watch=watch.filter(w=>w[0]!==S.id);
 else if(S.q)watch=[[S.id,(FEED.info(S.id)||[])[1]||S.id],...watch];
 saveWatch();updateWatchBtn();loadWatch();
};
function loadWatch(){
 $('wlBody').innerHTML=watch.map(w=>{let d=null;try{d=FEED.quote(w[0],'NSE')}catch(e){}const n=d&&d.pct;
  return `<tr data-id="${esc(w[0])}" tabindex="0"><td>${esc(w[1])}</td><td>${d?fmt(d.price):'–'}</td><td class="${n>=0?'mk-up':'mk-dn'}">${n==null?'–':(n>=0?'+':'')+fmt(n)+'%'}</td></tr>`}).join('')||'<tr><td colspan="3" class="mk-mut">Your watchlist is empty.</td></tr>';
}
$('wlBody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-id]');if(tr)selectStock(tr.dataset.id,'NSE')});
$('wlBody').addEventListener('keydown',e=>{const tr=e.target.closest('tr[data-id]');if(tr&&e.key==='Enter')selectStock(tr.dataset.id,'NSE')});

// ===== Search: the Nifty 500 list from NSE =====
$('mkQ').addEventListener('input',()=>{
 const typed=$('mkQ').value.trim().toLowerCase(),box=$('mkSug');
 if(typed.length<2){box.hidden=true;return}
 const rank=x=>{const sym=x[0].toLowerCase(),n=x[1].toLowerCase();return sym===typed||x[4]===typed?0:n.startsWith(typed)||sym.startsWith(typed)?1:n.includes(typed)?2:3};
 const list=FEED.symbols.map(x=>[rank(x),x]).filter(r=>r[0]<3).sort((a,b)=>a[0]-b[0]||a[1][1].length-b[1][1].length).slice(0,8).map(r=>r[1]);
 box.innerHTML=list.length?list.map(x=>`<button type="button" data-id="${esc(x[0])}">${esc(x[1])}<small>${[x[0],x[4],x[2]].filter(Boolean).map(esc).join(' · ')}</small></button>`).join(''):`<p class="mk-mut" style="padding:12px 14px">${FEED.symbols.length?'Not found. This page covers the Nifty 500 companies.':'The stock list has not loaded yet. Please try again in a moment.'}</p>`;
 box.hidden=false;
});
$('mkSug').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;$('mkSug').hidden=true;$('mkQ').value='';selectStock(b.dataset.id,S.ex)});
document.addEventListener('click',e=>{if(!e.target.closest('.mk-search'))$('mkSug').hidden=true});
$('exNSE').onclick=()=>selectStock(S.id,'NSE');
$('exBSE').onclick=()=>selectStock(S.id,'BSE');
$('mkRange').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.days=+b.dataset.d;$('mkRange').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));loadChart().catch(e=>{$('qChartMsg').textContent=e.message})});

// ===== Polling: looks for a newer price file once a minute. Paused when the tab is hidden. =====
let busy=false;
async function poll(){
 if(document.hidden||busy)return;
 busy=true;
 try{
  await FEED.loadSymbols().catch(()=>{}); // search still works from a saved list
  await FEED.refresh();
  loadIndices();loadWatch();
  if(S.q)await loadQuote();else await selectStock(S.id,S.ex);
  setStatus(true);
 }catch(e){setStatus(false)}
 finally{busy=false}
}
setInterval(poll,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});

// ===== Python Lab =====
const PY_COMMON=`import json
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
import numpy as np
import pandas as pd

def frame(raw):
    """Turn the price history into a pandas DataFrame."""
    d = json.loads(raw) if isinstance(raw, str) else raw
    df = pd.DataFrame({"open": d["o"], "high": d["h"], "low": d["l"], "close": d["c"], "volume": d["v"]},
                      index=pd.to_datetime(d["t"], unit="s"))
    return df.dropna(subset=["close"])

def clean(s, digits=2):
    return [None if pd.isna(x) or np.isinf(x) else round(float(x), digits) for x in s]

def days(idx):
    return [x.strftime("%d %b %y") for x in idx]
`;
const TOOLS={
 indicators:{
  desc:'Moving averages, Bollinger Bands, RSI and MACD for the last year of trading days.',
  days:800,params:[['sma_fast','Fast SMA',20],['sma_slow','Slow SMA',50],['rsi_n','RSI period',14]],
  py:`def indicators(raw, p):
    df = frame(raw)
    close = df["close"]
    fast, slow = close.rolling(int(p["sma_fast"])).mean(), close.rolling(int(p["sma_slow"])).mean()

    # Bollinger Bands: 20-day average +/- 2 standard deviations
    mid, sd = close.rolling(20).mean(), close.rolling(20).std()
    upper, lower = mid + 2 * sd, mid - 2 * sd

    # RSI (Wilder smoothing)
    n = int(p["rsi_n"])
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, min_periods=n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, min_periods=n, adjust=False).mean()
    rsi = 100 - 100 / (1 + gain / loss)

    # MACD (12, 26, 9)
    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    signal = macd.ewm(span=9, adjust=False).mean()

    last = -250
    return {
        "cards": [["Close", round(float(close.iloc[-1]), 2)], ["SMA fast", round(float(fast.iloc[-1]), 2)],
                  ["SMA slow", round(float(slow.iloc[-1]), 2)], ["RSI", round(float(rsi.iloc[-1]), 1)],
                  ["MACD", round(float(macd.iloc[-1]), 2)], ["MACD signal", round(float(signal.iloc[-1]), 2)]],
        "charts": [
            {"title": "Price, moving averages and Bollinger Bands", "labels": days(df.index[last:]), "series": [
                ["Close", clean(close[last:]), "#00e5ff"], ["SMA fast", clean(fast[last:]), "#ffb84d"],
                ["SMA slow", clean(slow[last:]), "#b14dff"], ["Upper band", clean(upper[last:]), "#5b6490"],
                ["Lower band", clean(lower[last:]), "#5b6490"]]},
            {"title": "RSI", "small": True, "labels": days(df.index[last:]), "series": [["RSI", clean(rsi[last:]), "#3dffa8"]]},
            {"title": "MACD", "small": True, "labels": days(df.index[last:]), "series": [
                ["MACD", clean(macd[last:]), "#00e5ff"], ["Signal", clean(signal[last:]), "#ff4d9d"]]}]}
`},
 risk:{
  desc:'How much the stock has returned, how bumpy the ride was, and how it moved against the NIFTY 50, over up to 5 years.',
  days:1825,needsIndex:true,params:[['rf','Risk-free rate %',6.5]],
  py:`def risk(raw, p, index_raw):
    close = frame(raw)["close"]
    r = close.pct_change().dropna()
    years = len(r) / 252
    cagr = (close.iloc[-1] / close.iloc[0]) ** (1 / years) - 1
    vol = r.std() * np.sqrt(252)
    sharpe = (cagr - float(p["rf"]) / 100) / vol
    drawdown = close / close.cummax() - 1

    # Beta against the NIFTY 50, using dates both series share
    mkt = frame(index_raw)["close"]
    mkt.index, close_d = mkt.index.normalize(), close.copy()
    close_d.index = close_d.index.normalize()
    both = pd.concat([close_d, mkt], axis=1, join="inner").pct_change().dropna()
    beta = both.iloc[:, 0].cov(both.iloc[:, 1]) / both.iloc[:, 1].var()

    return {
        "cards": [["Years of data", round(years, 1)], ["CAGR", f"{cagr:.1%}"], ["Annual volatility", f"{vol:.1%}"],
                  ["Sharpe ratio", round(float(sharpe), 2)], ["Beta vs NIFTY", round(float(beta), 2)],
                  ["Max drawdown", f"{drawdown.min():.1%}"], ["Best day", f"{r.max():.1%}"], ["Worst day", f"{r.min():.1%}"],
                  ["Days up", f"{(r > 0).mean():.0%}"]],
        "charts": [{"title": "Drawdown from peak (%)", "labels": days(drawdown.index),
                    "series": [["Drawdown", clean(drawdown * 100), "#ff4d9d"]], "fill": True}]}
`},
 backtest:{
  desc:'Tests a simple rule on past prices: hold while the fast average is above the slow average. It is compared with simply holding the stock. For learning only; past results do not predict future returns.',
  days:1825,params:[['fast','Fast SMA',20],['slow','Slow SMA',50],['cost','Cost per trade %',0.1]],
  py:`def backtest(raw, p):
    close = frame(raw)["close"]
    fast = close.rolling(int(p["fast"])).mean()
    slow = close.rolling(int(p["slow"])).mean()

    # Decide on today's close, act on the next day: this avoids look-ahead bias
    position = (fast > slow).astype(int).shift(1).fillna(0)
    trades = position.diff().abs().fillna(0)
    daily = close.pct_change().fillna(0)
    rule = (1 + position * daily - trades * float(p["cost"]) / 100).cumprod()
    hold = (1 + daily).cumprod()

    def stats(curve):
        years = len(curve) / 252
        return curve.iloc[-1] ** (1 / years) - 1, (curve / curve.cummax() - 1).min()

    rule_cagr, rule_dd = stats(rule)
    hold_cagr, hold_dd = stats(hold)
    return {
        "cards": [["Rule CAGR", f"{rule_cagr:.1%}"], ["Buy & hold CAGR", f"{hold_cagr:.1%}"],
                  ["Rule max drawdown", f"{rule_dd:.1%}"], ["Buy & hold drawdown", f"{hold_dd:.1%}"],
                  ["Trades", int(trades.sum())], ["Time invested", f"{position.mean():.0%}"]],
        "charts": [{"title": "Growth of ₹100", "labels": days(close.index), "series": [
            ["SMA rule", clean(rule * 100), "#00e5ff"], ["Buy & hold", clean(hold * 100), "#ffb84d"]]}]}
`},
 compare:{
  desc:'Compares up to 6 stocks from your watchlist over the last year: growth of ₹100, and how closely their daily moves are related (correlation).',
  days:365,multi:true,params:[],
  py:`def compare(raw_map):
    closes = {}
    for name, raw in json.loads(raw_map).items():
        s = frame(raw)["close"]
        s.index = s.index.normalize()
        closes[name] = s
    px = pd.DataFrame(closes).dropna()
    growth = px / px.iloc[0] * 100
    corr = px.pct_change().dropna().corr()
    palette = ["#00e5ff", "#ffb84d", "#b14dff", "#3dffa8", "#ff4d9d", "#4d8bff"]
    return {
        "cards": [[c, f"{px[c].iloc[-1] / px[c].iloc[0] - 1:.1%}"] for c in px.columns],
        "charts": [{"title": "Growth of ₹100", "labels": days(growth.index),
                    "series": [[c, clean(growth[c]), palette[i % 6]] for i, c in enumerate(growth.columns)]}],
        "corr": {"names": list(corr.columns), "values": [clean(corr[c]) for c in corr.columns]}}
`},
 code:{
  desc:'Write your own Python. The selected stock is ready as a pandas DataFrame called df, with up to 5 years of open, high, low, close and volume. numpy (np) and pandas (pd) are loaded.',
  days:1825,params:[],
  py:`# df holds the selected stock's daily prices
print(df.tail())

# Average return by weekday
returns = df["close"].pct_change()
by_day = returns.groupby(df.index.day_name()).mean() * 100
print("\\nAverage daily return % by weekday:")
print(by_day.round(3))

# Average volume by year
print("\\nAverage volume by year:")
print(df["volume"].groupby(df.index.year).mean().round(0))
`}
};

let pyReady=null,pyWorker=null,pySeq=0,labTab='indicators',labCharts=[];
function resetPython(){if(pyWorker)pyWorker.terminate();pyWorker=null;pyReady=null}
function pyCall(msg,ms){
 return new Promise((res,rej)=>{
  const id=++pySeq,w=pyWorker;
  const done=()=>{clearTimeout(timer);w.removeEventListener('message',on);w.removeEventListener('error',bad)};
  const on=e=>{if(e.data.id!==id)return;done();e.data.ok?res(e.data.result):rej(new Error(e.data.error))};
  const bad=()=>{done();resetPython();rej(new Error('Could not start Python. Please check your connection and try again.'))};
  // Stopping the worker is the only way to end a runaway script
  const timer=setTimeout(()=>{done();resetPython();rej(new Error('Python took too long and was stopped. Please try again.'))},ms);
  w.addEventListener('message',on);w.addEventListener('error',bad);
  w.postMessage({...msg,id});
 });
}
function loadPython(){
 if(pyReady)return pyReady;
 pyWorker=new Worker('assets/markets-py.worker.js');
 pyReady=pyCall({type:'init',sources:[PY_COMMON,...['indicators','risk','backtest','compare'].map(k=>TOOLS[k].py)]},180000)
  .catch(e=>{resetPython();throw e});
 return pyReady;
}
function showTab(t){
 labTab=t;const T=TOOLS[t];
 $('labTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
 $('labDesc').textContent=T.desc;
 $('labParams').innerHTML=T.params.map(p=>`<label>${esc(p[1])}<input type="number" step="any" min="0" data-k="${p[0]}" value="${p[2]}"></label>`).join('');
 $('labCode').hidden=t!=='code';if(t==='code'&&!$('labCode').value)$('labCode').value=T.py;
 $('labSrcWrap').hidden=t==='code';$('labSrc').textContent=T.py;
 clearLab();
}
function clearLab(){labCharts.forEach(c=>c.destroy());labCharts=[];$('labCards').innerHTML='';$('labCharts').innerHTML='';$('labOut').hidden=true;$('labOut').textContent='';$('labMsg').textContent=''}
$('labTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)showTab(b.dataset.t)});

function renderLab(r){
 $('labCards').innerHTML=(r.cards||[]).map(c=>`<div class="mk-stat"><small>${esc(c[0])}</small><b>${esc(c[1])}</b></div>`).join('');
 (r.charts||[]).forEach(ch=>{
  const t=document.createElement('p');t.className='mk-chart-t';t.textContent=ch.title;
  const w=document.createElement('div');w.className='mk-chart'+(ch.small?' sm':'');
  const cv=document.createElement('canvas');w.appendChild(cv);$('labCharts').append(t,w);
  labCharts.push(new Chart(cv,{type:'line',data:{labels:ch.labels,datasets:ch.series.map(s=>({label:s[0],data:s[1],borderColor:s[2],backgroundColor:s[2]+'26',fill:!!ch.fill,pointRadius:0,borderWidth:1.6,spanGaps:true}))},options:baseOpts(ch.series.length>1)}));
 });
 if(r.corr){
  const n=r.corr.names,shade=v=>v==null?'transparent':`rgba(${v>=0?'0,229,255':'255,77,157'},${Math.abs(v)*.55})`;
  const w=document.createElement('div');w.className='mk-tablewrap';
  w.innerHTML=`<p class="mk-chart-t">Correlation of daily returns (1 = move together, 0 = unrelated)</p><table class="mk-corr"><tr><th></th>${n.map(x=>`<th>${esc(x)}</th>`).join('')}</tr>${n.map((x,i)=>`<tr><th>${esc(x)}</th>${r.corr.values[i].map(v=>`<td style="background:${shade(v)}">${v==null?'–':v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</table>`;
  $('labCharts').appendChild(w);
 }
}
$('labRun').onclick=async()=>{
 const btn=$('labRun'),T=TOOLS[labTab],tab=labTab;
 btn.disabled=true;clearLab();
 try{
  const sym=S.id;
  if(!S.q&&!T.multi)throw new Error('the stock is still loading. Please try again in a moment.');
  $('labMsg').textContent=pyReady?'Running…':'Downloading Python (first run only, up to a minute)…';
  await loadPython();
  $('labMsg').textContent='Fetching prices…';
  const params=Object.fromEntries([...$('labParams').querySelectorAll('input')].map(i=>[i.dataset.k,i.value]));
  let result;
  if(tab==='compare'){
   const items=watch.slice(0,6),map={};
   const got=await Promise.allSettled(items.map(async w=>[w[1],await FEED.history(w[0],T.days)]));
   got.forEach(g=>{if(g.status==='fulfilled')map[g.value[0]]=g.value[1]});
   if(Object.keys(map).length<2)throw new Error('Compare needs at least 2 stocks in your watchlist.');
   $('labMsg').textContent='Running…';
   result=await pyCall({type:'tool',name:'compare',args:[JSON.stringify(map)]},60000);
  }else{
   const h=await FEED.history(sym,T.days);
   $('labMsg').textContent='Running…';
   if(tab==='code'){
    const out=await pyCall({type:'code',raw:JSON.stringify(h),code:$('labCode').value},60000);
    $('labOut').textContent=out||'(Your code ran but printed nothing. Use print() to see results.)';
    $('labOut').hidden=false;$('labMsg').textContent='';return;
   }
   const args=[JSON.stringify(h),params];
   if(tab==='risk')args.push(JSON.stringify(await FEED.history('NIFTY 50',T.days,'index')));
   result=await pyCall({type:'tool',name:tab,args},60000);
  }
  renderLab(result);
  $('labMsg').textContent='';
 }catch(e){
  $('labMsg').textContent='Could not run: '+String(e.message||e).split('\n').filter(Boolean).pop();
 }finally{btn.disabled=false}
};
// ===== Free tools directory =====
const FREE_TOOLS=[
 ['📥 Get market data',[['yfinance','https://github.com/ranaroussi/yfinance','NSE (.NS) and BSE (.BO) history and quotes. This page uses it'],['NSE reports','https://www.nseindia.com/all-reports','Official end-of-day price files and stock lists from NSE'],['jugaad-data','https://github.com/jugaad-py/jugaad-data','Indian stock and index data, including NSE'],['OpenBB','https://github.com/OpenBB-finance/OpenBB','Open research platform with many data sources']]],
 ['🧮 Clean and calculate',[['pandas','https://pandas.pydata.org/','The core tool for tables and time series'],['NumPy','https://numpy.org/','Fast numerical calculations'],['statsmodels','https://www.statsmodels.org/','Regression and time-series statistics']]],
 ['📈 Technical indicators',[['TA-Lib','https://github.com/TA-Lib/ta-lib-python','150+ classic indicators and candle patterns'],['ta','https://github.com/bukosabino/ta','Simple indicators built on pandas'],['mplfinance','https://github.com/matplotlib/mplfinance','Candlestick charts in a few lines']]],
 ['🔁 Backtest ideas',[['Backtesting.py','https://github.com/kernc/backtesting.py','Lightweight and the easiest place to start'],['Backtrader','https://github.com/mementum/backtrader','Full-featured event-driven backtesting'],['vectorbt','https://github.com/polakowo/vectorbt','Test thousands of parameter sets quickly']]],
 ['🛡️ Risk and portfolio',[['QuantStats','https://github.com/ranaroussi/quantstats','Performance and risk reports in one call'],['PyPortfolioOpt','https://github.com/robertmartin8/PyPortfolioOpt','Portfolio optimisation methods'],['Riskfolio-Lib','https://github.com/dcajasn/Riskfolio-Lib','Advanced risk-based portfolio models']]],
 ['🤖 Forecast and build apps',[['scikit-learn','https://scikit-learn.org/','Machine learning for tabular data'],['Prophet','https://github.com/facebook/prophet','Time-series forecasting for trends and seasonality'],['Streamlit','https://streamlit.io/','Turn a Python script into a web dashboard'],['Google Colab','https://colab.research.google.com/','Run Python notebooks free in the browser'],['Plotly','https://plotly.com/python/','Interactive charts']]]
];
$('toolGrid').innerHTML=FREE_TOOLS.map(g=>`<article class="card mk-tool"><h3>${g[0]}</h3><ul>${g[1].map(t=>`<li><a href="${t[1]}" target="_blank" rel="noopener">${t[0]} ↗</a><br>${t[2]}</li>`).join('')}</ul></article>`).join('');

// ===== Start =====
showTab('indicators');
Chart.defaults.font.family='Inter,sans-serif';
(async()=>{
 await FEED.loadSaved().catch(()=>{});
 if(FEED.quotes){loadIndices();loadWatch();await selectStock(S.id,S.ex)}
 poll();
})();
