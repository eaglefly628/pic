import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {digest} from './core.js';
const MAX=100*1024*1024,FILE_MAX=20*1024*1024;
const empty=()=>({schema_version:'draft-0.2',reports:[],observations:[]});
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const done=t=>new Promise((res,rej)=>{t.addEventListener('complete',res);t.addEventListener('abort',()=>rej(t.error||Error('健康档案写入已中止')));t.addEventListener('error',()=>rej(t.error));});
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const equal=(a,b)=>canonical(a)===canonical(b);
function date(value){if(value==null)return;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('检查日期必须为有效的 YYYY-MM-DD');}
function sample(r){if(r.sampled_at){if(typeof r.sampled_at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r.sampled_at)||!Number.isFinite(Date.parse(r.sampled_at)))throw Error('采样时间必须有效且包含时区');if(r.date_basis==='sampled_at'&&r.sampled_at.slice(0,10)!==r.date)throw Error('采样日期与归档日期不一致');}else if(r.date_basis==='sampled_at')throw Error('缺少作为归档依据的采样时间');}
function path(value){if(typeof value!=='string'||!value||value.startsWith('/')||/[:\\\x00]/.test(value)||value.split('/').some(p=>p==='..'||p==='.'||p==='')||!value.match(/\.(pdf|jpg|jpeg|png)$/i))throw Error('原件路径无效');return value;}
export function validateHealth(data){
 if(!data||!Array.isArray(data.reports)||!Array.isArray(data.observations))throw Error('请选择含 reports 和 observations 的标准化健康档案或健康 ZIP');
 if(data.reports.length>10000||data.observations.length>200000)throw Error('本次导入超过记录上限');
 if(data.clinical_summary!=null){const c=data.clinical_summary;if(typeof c!=='object'||!Array.isArray(c.longitudinal)||!Array.isArray(c.by_exam)||c.longitudinal.some(r=>!r||typeof r.title!=='string'||typeof r.text!=='string')||c.by_exam.some(r=>!r||typeof r.date!=='string'||typeof r.summary!=='string'||typeof r.follow_up!=='string'))throw Error('健康结论结构不完整，请核对标准化档案');}
 const reports=new Map(),paths=new Map();
 for(const r of data.reports){
  if(!r||!(/^[a-f0-9]{12}$/.test(r.source_id))||!(/^[a-f0-9]{64}$/.test(r.sha256))||!r.sha256.startsWith(r.source_id)||reports.has(r.source_id))throw Error('报告来源标识无效或重复');
  date(r.date);sample(r);path(r.pdf);if(r.historical_references!=null&&!Array.isArray(r.historical_references))throw Error('历史引用格式无效');
  if(typeof r.filename!=='string'||!Number.isInteger(r.pages)||r.pages<1||r.pages>10000)throw Error('报告文件名或页数无效');
  if(paths.has(r.pdf)&&paths.get(r.pdf)!==r.sha256)throw Error('原件路径存在不同内容');paths.set(r.pdf,r.sha256);reports.set(r.source_id,r);
 }
 const ids=new Set();
 for(const r of data.observations){
  if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('指标记录 ID 缺失或重复');ids.add(r.id);
  const report=reports.get(r.source_id);
  if(!report||typeof r.name!=='string'||typeof r.original_value!=='string'||typeof r.metric_key!=='string'||!r.metric_key)throw Error('指标缺少名称、原始结果或有效来源');
  date(r.date);sample(r);if((r.date??null)!==(report.date??null))throw Error('记录日期与来源检查日期不一致');
  if(!Number.isInteger(r.source_page)||r.source_page<1||r.source_page>report.pages)throw Error('来源页码超出报告范围');
  if(r.normalized_value!=null&&(typeof r.normalized_value!=='number'||!Number.isFinite(r.normalized_value)))throw Error('标准值必须为有限数值或空');
  if(r.trend_eligible&&(r.normalized_value==null||!r.normalized_unit||r.comparator||r.needs_review))throw Error('趋势记录缺少可比数值或单位，或仍有疑点');
 }
 return data;
}
export function parseHealth(bytes){
 if(bytes.length>MAX)throw Error('健康备份超过 100 MiB，请分批导入');
 let files={},data;
 if(bytes[0]===80&&bytes[1]===75){
  let total=0,count=0;const paths=new Set();
  files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;count++;if(total>MAX||count>10001||paths.has(f.name))throw Error('备份解压体积过大或包含重复路径');paths.add(f.name);if(f.name.startsWith('/')||/[:\\\x00]/.test(f.name)||f.name.split('/').includes('..'))throw Error('备份包含不安全路径');return true;}});
  if(!files['archive-index.json'])throw Error('ZIP 中缺少 archive-index.json；请导入健康页面导出的独立备份');
  data=JSON.parse(strFromU8(files['archive-index.json']));
 }else data=JSON.parse(strFromU8(bytes));
 return {data:validateHealth(data),files};
}
export class HealthStore{
 constructor(memory,{flush=async()=>{},active=()=>true}={}){this.memory=memory;this.flush=flush;this.active=active;this.urls=new Map();this.running=false;}
 ensure(){if(!this.active())throw Error('家庭云空间已锁定，请重新解锁');}
 async db(){this.ensure();const r=this.memory.factory.open('healtharchive',1);r.onupgradeneeded=()=>{for(const s of ['archive','sources','history'])r.result.createObjectStore(s);};return req(r);}
 async read(){const db=await this.db();try{return await req(db.transaction('archive','readonly').objectStore('archive').get('main'))||empty();}finally{db.close();}}
 async source(id){const db=await this.db();try{return req(db.transaction('sources','readonly').objectStore('sources').get(id));}finally{db.close();}}
 async list(){const data=structuredClone(await this.read());this.ensure();
  for(const row of data.observations){row.date??=null;row.normalized_value??=null;row.normalized_unit??=null;}
  for(const r of data.reports){r.date??=null;const blob=await this.source(r.source_id);this.ensure();r.source_available=!!blob;r.pdf_url='';if(blob){let url=this.urls.get(r.source_id);if(!url){url=URL.createObjectURL(blob);this.urls.set(r.source_id,url);}r.pdf_url=url;}r.count=data.observations.filter(x=>x.source_id===r.source_id).length;r.issues=Array.isArray(r.issues)?r.issues:[];delete r.pdf;}
  return {...data,ok:true};
 }
 async import(bytes){
  this.ensure();if(this.running)throw Error('另一个健康导入正在进行');this.running=true;
  try{
   const {data,files}=parseHealth(bytes),current=await this.read();await this.flush();this.ensure();
   const reports=new Map(current.reports.map(r=>[r.source_id,r])),rows=new Map(current.observations.map(r=>[r.id,r]));let added=0,duplicates=0;const sources=new Map();
   for(const report of data.reports){const old=reports.get(report.source_id);if(old&&['date','sha256','pages','pdf'].some(k=>!equal(old[k]??null,report[k]??null)))throw Error('已有报告信息发生冲突，未写入；请核对原件与日期');if(!old)reports.set(report.source_id,report);
    const content=files[path(report.pdf)];if(content){if(content.length>FILE_MAX)throw Error('单份报告原件最多 20 MiB，请压缩或拆分后重新整理备份');if(await digest(content)!==report.sha256)throw Error('报告原件哈希校验失败，未写入');const existing=await this.source(report.source_id);if(existing&&await digest(await existing.arrayBuffer())!==report.sha256)throw Error('已有原件内容不一致，未写入');if(!existing){const ext=report.pdf.split('.').pop().toLowerCase();sources.set(report.source_id,new Blob([content],{type:ext==='pdf'?'application/pdf':ext==='png'?'image/png':'image/jpeg'}));}}
   }
   for(const row of data.observations){if(rows.has(row.id)){if(!equal(rows.get(row.id),row))throw Error('已有记录发生修订冲突，未覆盖旧值；请核对后使用新的记录 ID');duplicates++;}else{rows.set(row.id,row);added++;}}
   const merged={...current,schema_version:'draft-0.2',reports:[...reports.values()],observations:[...rows.values()]};
   if(!merged.clinical_summary&&data.clinical_summary)merged.clinical_summary=data.clinical_summary;
   validateHealth(merged);if(strToU8(JSON.stringify(merged)).length>30*1024*1024)throw Error('健康索引超过单项容量，请分库整理');
   if(added||reports.size!==current.reports.length||sources.size||!equal(current.clinical_summary??null,merged.clinical_summary??null)){
    this.ensure();merged.updated_at=new Date().toISOString();const db=await this.db();try{
     const prior=await req(db.transaction('history','readonly').objectStore('history').getAllKeys());
     const t=db.transaction(['archive','sources','history'],'readwrite'),finished=done(t);
     t.objectStore('history').put(current,new Date().toISOString()+'-'+crypto.randomUUID());for(const k of prior.slice(0,Math.max(0,prior.length-9)))t.objectStore('history').delete(k);
     t.objectStore('archive').put(merged,'main');for(const [id,blob] of sources)t.objectStore('sources').put(blob,id);await finished;
    }finally{db.close();}
    await this.flush();this.ensure();
   }
   return {ok:true,added,duplicates,reports:reports.size,total:rows.size};
  }finally{this.running=false;}
 }
 async export(){const data=await this.read();for(const row of data.observations){row.date??=null;row.normalized_value??=null;row.normalized_unit??=null;}
  for(const r of data.reports)r.date??=null;this.ensure();return zipSync({'archive-index.json':strToU8(JSON.stringify(data))},{level:6});}
 async fetch(input,options={}){
  this.ensure();const url=new URL(typeof input==='string'?input:input.url,location.origin),name=url.pathname.split('/').pop();let output;
  if(name==='archive'&&(!options.method||options.method==='GET'))output=await this.list();
  else if(name==='import'&&options.method==='POST'){const b=options.body,bytes=b instanceof Uint8Array?b:new Uint8Array(await b.arrayBuffer());output=await this.import(bytes);}
  else if(name==='export'&&(!options.method||options.method==='GET'))return new Response(await this.export(),{headers:{'content-type':'application/zip','cache-control':'no-store'}});
  else throw Error('不支持的健康操作');
  this.ensure();return new Response(JSON.stringify(output),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 }
 clear(){for(const url of this.urls.values())URL.revokeObjectURL(url);this.urls.clear();}
}
