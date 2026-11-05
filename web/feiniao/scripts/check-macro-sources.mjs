// Local diagnostic only. The website runs the same official parsers; no API key or site password is read here.
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {catalog,parseFred} from '../worker/macro.js';
import {collectOfficial} from '../worker/official-sources.js';
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const ids=option('--series')?.split(','),selected=new Set(ids||catalog.filter(s=>s.active!==false).map(s=>s.id));
for(const id of selected)if(!catalog.some(s=>s.id===id))throw Error('Unknown indicator: '+id);
let inflight=0;const queue=[];
async function read(url){await new Promise(resolve=>{if(inflight<4){inflight++;resolve();}else queue.push(resolve);});try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();if(text.length>2000000)throw Error('Response exceeds 2MB');return text;}finally{const next=queue.shift();if(next)next();else inflight--;}}
const report=[],observations=[];
const fred=catalog.filter(s=>selected.has(s.id)&&s.active!==false&&s.adapter==='fred_csv');
await Promise.all(fred.map(async s=>{try{const rows=parseFred(await read(s.method.primary_url));if(!rows.length)throw Error('No parsed observations');report.push({id:s.id,ok:true,parsed:rows.length,first:rows[0].period,last:rows.at(-1).period,source_url:s.method.primary_url});if(option('--observations'))observations.push(...rows.map(r=>({...r,series_id:s.id,source_url:s.method.primary_url,vintage_verified:false})));}catch(e){report.push({id:s.id,ok:false,error:e.message,source_url:s.method.primary_url});}}));
const official=await collectOfficial(read,async a=>{if(!selected.has(a.series_id))return {};const sorted=[...a.observations].sort((a,b)=>a.period.localeCompare(b.period));if(option('--observations'))observations.push(...a.observations.map(r=>({...r,series_id:a.series_id,source_url:a.source_url})));return {first:sorted[0]?.period,last:sorted.at(-1)?.period};},selected);
report.push(...official.filter(r=>selected.has(r.id)));
for(const s of catalog.filter(s=>selected.has(s.id)&&s.active===false))report.push({id:s.id,paused:true,reason:s.pause_reason,method:s.method});
const output={checked_at:new Date().toISOString(),environment:'local Node.js; not the hosted website',checks:report.sort((a,b)=>a.id.localeCompare(b.id))};
if(option('--output')){await mkdir(dirname(option('--output')),{recursive:true});await writeFile(option('--output'),JSON.stringify(output,null,2));}
if(option('--observations')){await mkdir(dirname(option('--observations')),{recursive:true});await writeFile(option('--observations'),JSON.stringify({fetched_at:output.checked_at,observations},null,2));}
console.log(JSON.stringify(output,null,2));
