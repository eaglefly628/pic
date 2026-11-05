// Called only after the site's existing cookie and origin checks.
export async function picApi(request,env,{json,body,validEnvelope,mac=false}){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/pic/state'){
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT revision,envelope FROM vault WHERE id=?').bind('pic').first();
   return json(row?{revision:row.revision,envelope:JSON.parse(row.envelope)}:{revision:0,envelope:null});
  }
  if(request.method!=='GET')return json({error:'旧整屋快照已冻结，金融数据只允许已配对 Mac 更新。请刷新网站。'},403);
 }
 const domain=path.match(/^\/api\/pic\/(shared|health|finance)-state$/)?.[1];
 if(domain){
  const key='pic-'+domain,row=await env.DB.prepare('SELECT revision,envelope FROM vault WHERE id=?').bind(key).first();
  if(request.method==='GET'){const saved=row?JSON.parse(row.envelope):null;const legacy=await env.DB.prepare('SELECT revision FROM vault WHERE id=?').bind('pic').first();return json({revision:row?.revision||0,envelope:saved?.envelope||null,hash:saved?.hash||null,legacy_revision:legacy?.revision||0});}
  if(request.method==='PUT'){
   if(domain==='finance'&&!mac)return json({error:'金融数据网页只读，仅已配对 Mac 可发布金融快照'},403);
   const d=await body(request,1900000);
   if(!Number.isSafeInteger(d.version)||d.version<1||!Number.isSafeInteger(d.baseVersion)||d.baseVersion<0||!validEnvelope(d.envelope))return json({error:'需要备份版本号、基线版本及加密内容'},400);
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(d.envelope))))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(row&&d.version===row.revision&&hash===JSON.parse(row.envelope).hash)return json({revision:row.revision,hash,unchanged:true});
   if(d.version<=(row?.revision||0)||d.baseVersion!==(row?.revision||0))return json({error:'备份版本过期或同版本内容冲突；当前快照未被覆盖。',currentVersion:row?.revision||0},409);
   const data=JSON.stringify({envelope:d.envelope,hash});
   const r=!row?await env.DB.prepare('INSERT OR IGNORE INTO vault(id,revision,envelope) VALUES(?,?,?)').bind(key,d.version,data).run():await env.DB.prepare('UPDATE vault SET revision=?,envelope=? WHERE id=? AND revision=?').bind(d.version,data,key,d.baseVersion).run();
   if(!r.meta.changes)return json({error:'其他设备已经提交新版本；当前快照未被覆盖。'},409);
   return json({revision:d.version,hash});
  }
 }
 const match=path.match(/^\/api\/pic\/objects\/([a-f0-9]{64})$/);
 if(match){
  if(!env.PIC_FILES)return json({error:'加密文件存储尚未就绪'},503);
  const key='pic/'+match[1];
  if(request.method==='GET'){
   const object=await env.PIC_FILES.get(key);if(!object)return json({error:'加密文件不存在，请保留备份并重试'},404);
   return new Response(object.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(request.method==='PUT'){
   // Immutable content-addressed ciphertext: retrying an uncertain upload is safe.
   const max=32*1024*1024;
   if(Number(request.headers.get('content-length'))>max)return json({error:'单项加密数据最多 32 MiB；媒体原文件建议小于 20 MiB'},413);
   const reader=request.body?.getReader();if(!reader)return json({error:'缺少密文'},400);
   let n=0;const parts=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();return json({error:'单项加密数据过大'},413);}parts.push(value);}
   if(n<29)return json({error:'密文过短'},400);
   const bytes=new Uint8Array(n);let off=0;for(const part of parts){bytes.set(part,off);off+=part.length;}
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==match[1])return json({error:'密文校验失败'},400);
   await env.PIC_FILES.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});
   return json({ok:true});
  }
 }
 if(path.startsWith('/api/pic/legacy/'))return legacy(url,env,json);
 return json({error:'接口不存在'},404);
}
async function legacy(url,env,json){
 const name=url.pathname.split('/').pop();
 if(name.startsWith('disk'))return json({ok:false,error:'云端版无法操作本机磁盘'},400);
 const get=async u=>{const r=await fetch(u,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!r.ok)throw Error('来源暂不可用');return r.json();};
 try{
  const range=['1mo','3mo','6mo','1y','5y','max'].includes(url.searchParams.get('range'))?url.searchParams.get('range'):'3mo';
  if(name==='fx'){const d=await get('https://open.er-api.com/v6/latest/USD');return json({ok:true,base:'USD',rates:d.rates,history:[],asOf:Date.now(),src:'er-api'});}
  if(name==='sports'){
   const leagues={'fifa.world':'soccer/fifa.world',nba:'basketball/nba',wnba:'basketball/wnba','eng.1':'soccer/eng.1','esp.1':'soccer/esp.1','ita.1':'soccer/ita.1','ger.1':'soccer/ger.1','uefa.champions':'soccer/uefa.champions'},league=url.searchParams.get('league');
   if(!leagues[league])return json({ok:false,error:'未知联赛'},400);
   const dates=url.searchParams.get('dates');if(dates&&!/^\d{8}(-\d{8})?$/.test(dates))return json({ok:false,error:'日期格式不正确'},400);
   const data=await get('https://site.api.espn.com/apis/site/v2/sports/'+leagues[league]+'/scoreboard'+(dates?'?dates='+dates:''));
   const side=c=>c?{name:c.team?.displayName,short:c.team?.shortDisplayName||c.team?.abbreviation,abbr:c.team?.abbreviation,score:c.score,winner:!!c.winner}:null;
   return json({ok:true,league,leagueName:data.leagues?.[0]?.name||'',asOf:Date.now(),events:(data.events||[]).map(e=>{const c=e.competitions?.[0]||{},t=e.status?.type||{};return {id:e.id,date:e.date,name:e.shortName||e.name,state:t.state,completed:!!t.completed,detail:t.shortDetail||t.detail||'',note:c.notes?.[0]?.headline||'',odds:c.odds?.[0]?.details,home:side(c.competitors?.find(v=>v.homeAway==='home')),away:side(c.competitors?.find(v=>v.homeAway==='away'))};})});
  }
  if(name==='gold'||name==='btc'){
   const d=await get('https://query1.finance.yahoo.com/v8/finance/chart/'+(name==='gold'?'GC%3DF':'BTC-USD')+'?range='+range+'&interval=1d'),r=d.chart.result[0],c=r.indicators.quote[0].close;
   let usdCny=null;try{usdCny=(await get('https://open.er-api.com/v6/latest/USD')).rates.CNY;}catch{}
   return json({ok:true,[name==='gold'?'usdPerOz':'usd']:r.meta.regularMarketPrice,prevClose:r.meta.chartPreviousClose,history:r.timestamp.flatMap((t,i)=>c[i]==null?[]:[{t:t*1000,usd:c[i]}]),usdCny,asOf:Date.now(),src:'yahoo'});
  }
  return json({ok:false,error:'此本机接口尚不适用于云端版'},501);
 }catch{return json({ok:false,error:'外部数据源当前不可用，请稍后重试'},502);}
}
