import {validateHealth} from './health.js';
import {unpack,digest} from './core.js';
import {zipSync,strToU8} from 'fflate';
// Inspect structure only. Never include values, account names, file names, or ciphertext in diagnostics.
export function inspectBackup(bundle){
 if(!bundle||bundle.__home_backup!==1||!Array.isArray(bundle.indexedDB))throw Error('不是可识别的整屋备份');
 const archives=[],suspected=[],visited=new Set();let nodes=0;
 function visit(value,path,depth){
  if(!value||typeof value!=='object'||depth>8||visited.has(value))return;
  visited.add(value);if(++nodes>30000)throw Error('备份结构过于复杂，未执行替换');
  if(Array.isArray(value.reports)&&Array.isArray(value.observations)){validateHealth(value);archives.push({path,data:value});return;}
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)visit(value[i],path+'['+i+']',depth+1);return;}
  for(const [k,v] of Object.entries(value)){
   if(['ciphertext','ct','wrap'].includes(k))continue;
   const next=path+'.'+k;
   if(/health|健康|体检/i.test(k)&&v!=null&&(typeof v==='object'||typeof v==='string'&&v.trim().startsWith('{'))){
    if(typeof v==='string'&&v.trim().startsWith('{')){let parsed;try{parsed=JSON.parse(v);}catch{}if(parsed){const before=archives.length;visit(parsed,next,depth+1);if(archives.length===before)suspected.push(next);continue;}}
    const before=archives.length;visit(v,next,depth+1);if(archives.length===before&&(!Array.isArray(v)||v.length))suspected.push(next);
   }else visit(v,next,depth+1);
  }
 }
 // Existing website health records are restored through their memory database, not re-imported.
 const scan={...bundle,indexedDB:bundle.indexedDB.filter(d=>d.name!=='healtharchive')};visit(scan,'backup',0);
 const healthDb=bundle.indexedDB.find(d=>d.name==='healtharchive');
 const stored=healthDb?.stores?.find(s=>s.name==='archive')?.recs?.find(r=>Array.isArray(r?.reports)&&Array.isArray(r?.observations));
 const dev=bundle.indexedDB.find(d=>d.name==='devworld'),workbench=!!dev?.stores?.find(s=>s.name==='vault')?.recs?.length;
 const reportCount=stored?.reports.length||0,rowCount=stored?.observations.length||0;const unresolved=[...new Set(suspected)].filter(p=>!archives.some(a=>a.path.startsWith(p))); 
 return {archives,suspected:unresolved,summary:{databaseCount:bundle.indexedDB.length,databaseNames:bundle.indexedDB.map(d=>d.name),hasEncryptedWorkbench:workbench,healthArchiveCount:archives.length+(stored?1:0),healthReports:reportCount+archives.reduce((n,a)=>n+a.data.reports.length,0),healthObservations:rowCount+archives.reduce((n,a)=>n+a.data.observations.length,0),unrecognizedHealthSections:unresolved.map(()=> '未识别健康分区')}};
}
export async function prepareEmbeddedArchive(entry){
 const files={'archive-index.json':strToU8(JSON.stringify(entry.data))};
 // Inline standardized archives may contain the same typed Blob records used by .home backups.
 for(const r of entry.data.reports){const raw=entry.data.files?.[r.pdf]||entry.data.sources?.[r.source_id];if(raw?.__t==='blob'){
  const blob=unpack(raw),bytes=new Uint8Array(await blob.arrayBuffer());if(await digest(bytes)!==r.sha256)throw Error('内嵌健康原件校验失败');files[r.pdf]=bytes;
 }}
 return zipSync(files,{level:0});
}
export function describeBackup(summary){
 const parts=[`已识别 ${summary.databaseCount} 个应用数据库`];
 parts.push(summary.hasEncryptedWorkbench?'工作台加密库已识别，健康手记需使用原工作台主密码解锁后核对':'未识别到工作台加密库');
 parts.push(summary.healthArchiveCount?`体检档案：${summary.healthReports} 份报告、${summary.healthObservations} 条指标`:'此文件未识别到独立体检档案，不能据此判断健康手记是否存在');
 if(summary.unrecognizedHealthSections.length)parts.push('检测到未识别健康分区，停止替换以免遗漏');
 return parts.join('。')+'。';
}

export function backupStructure(bundle){
 let budget=180;
 function shape(v,depth=0){if(--budget<0)return '…';if(v===null)return 'null';if(Array.isArray(v))return {type:'array',count:v.length,sample:v.length?shape(v[0],depth+1):null};if(typeof v!=='object')return typeof v;if(depth>5)return 'object';const out={};let i=0;for(const [k,val] of Object.entries(v).slice(0,30)){const label=/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)?k:'entry_'+(++i);Object.defineProperty(out,label,{value:shape(val,depth+1),enumerable:true});}return out;}
 return JSON.stringify(shape(bundle),null,2);
}
