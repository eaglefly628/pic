import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {decodeQuotes,compare,valueRows,quantApi} from '../worker/quant.js';
import worker from '../worker/index.js';
import {JSDOM} from 'jsdom';

function env(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE quant_cache (key TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at INTEGER NOT NULL)');return {DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}};}}};}
test('quant APIs retain the existing password boundary',async()=>{const e={DB:{},PASSWORD_HASH:'x',PASSWORD_SALT:'x',SESSION_SECRET:'test'};assert.equal((await worker.fetch(new Request('https://garden.test/api/quant'),e)).status,401);assert.equal((await worker.fetch(new Request('https://garden.test/api/quant/refresh',{method:'POST',headers:{origin:'https://evil.test'}}),e)).status,403);});
test('decoding quotes only accepts requested symbols and valid prices',()=>{const fields=Array(55).fill('');fields[3]='1.067';fields[4]='1.05';fields[30]='20261105143600';fields[32]='1.62';fields[37]='123';const text=`v_sh560530="${fields.join('~')}";v_sz999999="${fields.join('~')}";`;const q=decodeQuotes(text,[{code:'SH.560530',name:'摩根A500'}]);assert.deepEqual(Object.keys(q),['SH.560530']);assert.equal(q['SH.560530'].turnover,1230000);assert.equal(q['SH.560530'].time,'2026-11-05 14:36:00');});
test('same dates required for historical excess return',()=>{const benchmark=[{date:'2026-11-03',close:100},{date:'2026-11-04',close:105}];assert.equal(compare([{date:'2026-11-03',close:1}],benchmark,1),null);const q=compare([{date:'2026-11-03',close:1},{date:'2026-11-04',close:1.1}],benchmark,1);assert.ok(Math.abs(q.excess_pct-5)<1e-9);});
test('old IOPV is visible as old data but cannot produce current discount',()=>{const values=valueRows(Date.parse('2026-11-05T06:00:00Z'));assert.equal(values.length,32);assert.ok(values.every(r=>r.stale&&r.premium_pct===null&&r.ask_premium_pct===null));assert.ok(values.every(r=>!/(增强|红利|低波|联接)/.test(r.name)));});
test('research data has complete provenance and no invented model score',async()=>{const response=await quantApi(new Request('https://garden.test/api/quant'),env());const data=await response.json();assert.equal(data.universe.length,32);assert.equal(data.benchmarks.length,4);assert.equal(data.macro.catalog.length,20);assert.equal(data.macro.factor_count,6);assert.match(data.model_status,/尚未训练/);assert.equal(data.review.summary.length,5);assert.match(data.review.note,/非实盘/);});
test('failed refresh preserves the seed and does not claim fresh observations',async()=>{const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});try{const r=await quantApi(new Request('https://garden.test/api/quant/refresh',{method:'POST'}),env());assert.equal(r.status,502);assert.match((await r.json()).note,/旧数据/);}finally{globalThis.fetch=previous;}});
test('client escapes source content and uses the authenticated same-origin API',()=>{const source=readFileSync(new URL('../public/quant.js',import.meta.url),'utf8');assert.match(source,/function\(\{api,onError\}\)/);assert.doesNotMatch(source,/localStorage|fetch\(['"]https:/);assert.match(readFileSync(new URL('../public/regression.js',import.meta.url),'utf8'),/尚无本地运行结果/);assert.match(source,/快照/);});
test('locking clears research and ignores a response still in flight',async()=>{
 const dom=new JSDOM('<div id="overview-top"></div>',{runScripts:'outside-only'}),w=dom.window;
 let resolve,stopped=0;w.setInterval=()=>1;w.clearInterval=()=>stopped++;
 w.eval(readFileSync(new URL('../public/regression.js',import.meta.url),'utf8'));
 w.eval(readFileSync(new URL('../public/quant.js',import.meta.url),'utf8'));
 const module=w.createQuantResearch({api:()=>new Promise(r=>{resolve=r;})});
 module.show();module.clear();resolve({});await new Promise(r=>setImmediate(r));
 assert.equal(w.document.querySelector('#quant-panel').hidden,true);
 assert.equal(w.document.querySelector('#quant-panel').innerHTML,'');assert.equal(stopped,1);
 assert.match(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),/shanghai\.clear\(\);quant\.clear\(\)/);
 dom.window.close();
});
