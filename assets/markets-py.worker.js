/* Runs Python (Pyodide) off the main thread so live prices keep updating. */
const PYODIDE='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
importScripts(PYODIDE+'pyodide.js');
let py;
self.onmessage=async e=>{
 const m=e.data;
 try{
  if(m.type==='init'){
   py=await loadPyodide({indexURL:PYODIDE});
   await py.loadPackage(['numpy','pandas']);
   for(const src of m.sources)py.runPython(src);
   return postMessage({id:m.id,ok:true});
  }
  if(m.type==='tool'){
   const args=m.args.map(a=>typeof a==='string'?a:py.toPy(a));
   const out=py.globals.get(m.name)(...args);
   const result=out.toJs({dict_converter:Object.fromEntries});
   out.destroy();
   return postMessage({id:m.id,ok:true,result});
  }
  if(m.type==='code'){
   const lines=[];
   py.setStdout({batched:s=>lines.push(s)});
   py.setStderr({batched:s=>lines.push(s)});
   py.globals.set('_raw',m.raw);
   py.runPython('df = frame(_raw)');
   try{py.runPython(m.code)}
   catch(err){lines.push(String(err.message||err))}
   return postMessage({id:m.id,ok:true,result:lines.join('\n')});
  }
 }catch(err){postMessage({id:m.id,ok:false,error:String(err.message||err)})}
};
