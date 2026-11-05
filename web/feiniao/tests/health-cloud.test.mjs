import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {HealthStore,validateHealth,parseHealth} from '../../../shared/pic/health.js';
import {PicMemory,digest,keyFor,b64,seal,uploadSnapshot,downloadSnapshot} from '../../../shared/pic/core.js';
const original=strToU8('%PDF-1.4 synthetic-private-report'),sha=await digest(original),sid=sha.slice(0,12);
const archive=()=>({schema_version:'draft-0.2',reports:[{source_id:sid,sha256:sha,pdf:'sources/'+sid+'.pdf',filename:'private-health-report.pdf',pages:2,date:'2026-11-01'}],observations:[{id:'row-1',source_id:sid,source_page:1,date:'2026-11-01',metric_key:'lipid.ldl',name:'低密度脂蛋白',original_value:'3.1',normalized_value:3.1,normalized_unit:'mmol/L',trend_eligible:true}]});
const zip=(data=archive(),file=original)=>zipSync({'archive-index.json':strToU8(JSON.stringify(data)),['sources/'+sid+'.pdf']:file});
const store=()=>new HealthStore(new PicMemory());
test('health ZIP import verifies originals, skips duplicate records, and rejects conflicts atomically',async()=>{
 const s=store();assert.equal((await s.import(zip())).added,1);const first=await s.read();assert.equal((await s.import(zip())).duplicates,1);assert.deepEqual(await s.read(),first);
 const changed=archive();changed.observations[0].original_value='9.9';await assert.rejects(()=>s.import(zip(changed)),/修订冲突/);assert.deepEqual(await s.read(),first);
 const wrongReport=archive();wrongReport.reports[0].date='2026-10-01';wrongReport.observations[0].date='2026-10-01';await assert.rejects(()=>s.import(zip(wrongReport)),/报告信息发生冲突/);assert.deepEqual(await s.read(),first);
 await assert.rejects(()=>s.import(zip(archive(),strToU8('altered original'))),/哈希校验失败/);assert.deepEqual(await s.read(),first);
 const badNew=archive();badNew.observations.push({...badNew.observations[0],id:'row-2',source_page:99});await assert.rejects(()=>s.import(zip(badNew)),/页码/);assert.deepEqual(await s.read(),first);
});
test('health metadata stays usable with missing originals, and later ZIP repairs source availability',async()=>{
 const s=store();await s.import(strToU8(JSON.stringify(archive())));let list=await s.list();assert.equal(list.reports[0].source_available,false);assert.equal(list.reports[0].pdf_url,'');
 const repaired=await s.import(zip());assert.equal(repaired.added,0);assert.equal(repaired.duplicates,1);list=await s.list();assert.equal(list.reports[0].source_available,true);assert.match(list.reports[0].pdf_url,/^blob:/);
 const files=unzipSync(await s.export());assert.deepEqual(files['sources/'+sid+'.pdf'],original);assert.equal(parseHealth(await s.export()).data.observations.length,1);s.clear();assert.equal(s.urls.size,0);
});
test('health validation preserves date, unit, source, and path boundaries',async()=>{
 const bads=[a=>a.reports[0].pdf='../private.pdf',a=>a.reports[0].pdf='C:\\private.pdf',a=>a.reports[0].date='2026-02-30',a=>a.observations[0].date='2026-10-01',a=>a.observations[0].normalized_value=true,a=>a.observations[0].normalized_unit='',a=>a.observations[0].comparator='>',a=>a.observations[0].needs_review=true,a=>a.reports[0].sampled_at='2026-11-01T10:00:00',a=>{a.observations[0].date_basis='sampled_at';a.observations[0].sampled_at='2026-10-31T23:00:00+08:00';}];
 for(const mutate of bads){const a=archive();mutate(a);assert.throws(()=>validateHealth(a));}
 assert.throws(()=>parseHealth(zipSync({'../escape.txt':strToU8('bad'),'archive-index.json':strToU8(JSON.stringify(archive()))})),/不安全路径/);
 assert.throws(()=>parseHealth(zipSync({'other.json':strToU8('{}')})),/缺少 archive-index/);
 const s=store(),large=new Uint8Array(20*1024*1024+1);await assert.rejects(()=>s.import(zip(archive(),large)),/20 MiB/);assert.equal((await s.read()).observations.length,0);
});
test('health data and PDF originals round trip across independent devices through ciphertext only',async()=>{
 const a=new PicMemory(),s=new HealthStore(a);await s.import(zip());const key=await keyFor('health-cloud-test-password',b64(new Uint8Array(16))),objects=new Map();
 const manifest=await uploadSnapshot(await a.dump(),key,null,async(id,bytes)=>objects.set(id,bytes));const encryptedManifest=await seal(key,manifest);
 for(const bytes of objects.values()){assert.ok(!Buffer.from(bytes).includes(Buffer.from('private-health-report')));assert.ok(!Buffer.from(bytes).includes(Buffer.from(original)));}
 assert.ok(!Buffer.from(encryptedManifest).includes(Buffer.from('lipid.ldl')));
 const b=new PicMemory();await b.restore(await downloadSnapshot(manifest,key,async id=>objects.get(id)));const phone=new HealthStore(b);assert.equal((await phone.read()).observations[0].original_value,'3.1');assert.deepEqual(new Uint8Array(await(await phone.source(sid)).arrayBuffer()),original);
 const add=archive();add.observations.push({...add.observations[0],id:'row-2',metric_key:'glucose.fasting',name:'空腹血糖',original_value:'5.5',normalized_value:5.5});assert.equal((await phone.import(zip(add))).added,1);
 const latest=await uploadSnapshot(await b.dump(),key,manifest,async(id,bytes)=>objects.set(id,bytes));const desktop=new PicMemory();await desktop.restore(await downloadSnapshot(latest,key,async id=>objects.get(id)));assert.equal((await new HealthStore(desktop).read()).observations.length,2);
});
test('health success waits for durable cloud sync, while failures retain encrypted-backup recovery data',async()=>{
 let fail=true,called=0;const m=new PicMemory(),s=new HealthStore(m,{flush:async()=>{called++;if(called>1&&fail)throw Error('cloud conflict');}});
 await assert.rejects(()=>s.import(zip()),/cloud conflict/);assert.equal((await s.read()).observations.length,1);assert.equal((await m.dump()).indexedDB.find(d=>d.name==='healtharchive').stores.find(s=>s.name==='archive').recs.length,1);
 fail=false;await s.import(zip());assert.ok(called>=3);
 let active=true;const locked=new HealthStore(new PicMemory(),{active:()=>active});active=false;await assert.rejects(()=>locked.read(),/锁定/);
});
