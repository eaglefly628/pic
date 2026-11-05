import seed from './quant-seed.json' with {type:'json'};
import {macroApi} from './macro.js';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const finite=(v,positive=false)=>{const n=Number(v);return v!==''&&v!=null&&Number.isFinite(n)&&(!positive||n>0)?n:null;};
const hkDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));

export function decodeQuotes(text,universe){
 const mapping=new Map(universe.map(r=>[r.code.toLowerCase().replace('.',''),r]));const result={};
 for(const match of text.matchAll(/v_([a-z]{2}\d{6})="([^"]*)"/g)){
  const item=mapping.get(match[1]);if(!item)continue;const fields=match[2].split('~');
  const price=finite(fields[3],true);if(!price||fields.length<40)continue;
  const raw=fields[30]||'',time=/^\d{14}$/.test(raw)?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)} ${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}`:null;
  result[item.code]={code:item.code,name:item.name,price,prev_close:finite(fields[4],true),open:finite(fields[5],true),
   volume:finite(fields[6]),bid:finite(fields[9],true),ask:finite(fields[19],true),
   change_rate:finite(fields[32]),high:finite(fields[33],true),low:finite(fields[34],true),
   turnover:finite(fields[37])==null?null:Number(fields[37])*10000,time,source:'腾讯'};
 }return result;
}

export function compare(history,benchmark,sessions){
 const right=benchmark?.slice(-(sessions+1));if(!right||right.length!==sessions+1)return null;
 const left=new Map((history||[]).map(r=>[r.date,r.close]));if(right.some(r=>!left.has(r.date)))return null;
 const first=right[0],last=right.at(-1),asset=(left.get(last.date)/left.get(first.date)-1)*100,index=(last.close/first.close-1)*100;
 return {return_pct:asset,benchmark_return_pct:index,excess_pct:asset-index,start:first.date,end:last.date};
}

export function valueRows(now=Date.now()){
 const today=hkDate(now),rows=seed.value_snapshot?.rows||{};
 return seed.universe.map(item=>{const row=rows[item.code]||{},stale=row.market_date!==today;
  return {...row,...item,...(seed.navs[item.code]||{}),stale,premium_pct:stale?null:row.premium_pct,
   ask_premium_pct:stale?null:row.ask_premium_pct,spread_pct:stale?null:row.spread_pct};});
}

async function cached(env){const row=await env.DB.prepare('SELECT payload,updated_at FROM quant_cache WHERE key=?').bind('quotes').first();return row?{...JSON.parse(row.payload),updated_at:row.updated_at}:null;}
export async function quantApi(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/api/quant/macro'))return macroApi(request,env);
 if(path==='/api/quant/refresh'&&request.method==='POST'){
  const previous=await cached(env);if(previous&&Date.now()-previous.updated_at<60000)return json({ok:true,reused:true,...previous});
  const universe=[...seed.universe,...seed.benchmarks],codes=universe.map(r=>r.code.toLowerCase().replace('.','')).join(',');
  try{
   const response=await fetch('https://qt.gtimg.cn/q='+codes,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://finance.qq.com/'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('行情源 HTTP '+response.status);
   const bytes=await response.arrayBuffer();let text;try{text=new TextDecoder('gb18030').decode(bytes);}catch{text=new TextDecoder().decode(bytes);}
   const quotes=decodeQuotes(text,universe);if(!Object.keys(quotes).length)throw Error('行情源未返回有效报价');
   const packet={quotes,quotes_fetched_at:new Date().toISOString(),coverage:Object.keys(quotes).length,total:universe.length};
   await env.DB.prepare('INSERT INTO quant_cache(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind('quotes',JSON.stringify(packet),Date.now()).run();
   return json({ok:true,...packet});
  }catch(error){return json({ok:false,error:error.message,note:'保留原快照及其时间，没有将旧数据标记为新行情。'},502);}
 }
 if(path==='/api/quant'&&request.method==='GET'){
  const live=await cached(env);
  return json({...seed,...(live?{quotes:live.quotes,quotes_fetched_at:live.quotes_fetched_at}:{}),
   values:valueRows(),history_note:'历史日线截至 '+seed.review.completed_end+'；刷新按钮只更新报价，不刷新历史或重跑策略。',
   model_status:'尚未训练：指标目录和参数方案已建立，未生成机会分数。'});
 }
 return json({error:'量化接口不存在'},404);
}
