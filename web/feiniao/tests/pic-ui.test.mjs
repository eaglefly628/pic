import {build} from 'esbuild';
import {zipSync,strToU8} from 'fflate';
import {PicMemory,digest} from '../../../shared/pic/core.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
const cryptoModule=await build({entryPoints:['../../project-four/src/lib/crypto.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {createVault}=await import('data:text/javascript;base64,'+Buffer.from(cryptoModule.outputFiles[0].text).toString('base64'));
const bundle=readFileSync('dist/server/index.js','utf8');
const assets=JSON.parse(bundle.slice('const ASSETS='.length,bundle.indexOf(';\n')));
const tick=()=>new Promise(r=>setTimeout(r,20));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await tick();}throw Error('PIC UI timed out');}
function browser(html,url){const d=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true});const w=d.window;Object.defineProperty(w,'crypto',{value:webcrypto});Object.assign(w,{TextEncoder,TextDecoder,Blob,structuredClone,Response});w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};w.confirm=()=>true;return d;}
test('cloud entry creates encrypted state, mounts all four real applications, saves and unlocks on a second device',async()=>{
 let revision=0,envelope=null;const domainStates=new Map();const objects=new Map(),network=[];
 const fetcher=async(path,options={})=>{
  network.push({path,body:options.body});
  if(path==='/api/pic/state')return new Response(JSON.stringify({revision:0,envelope:null}));
  if(/\/(shared|health|finance)-state$/.test(path)){let state=domainStates.get(path)||{revision:0,envelope:null};if(options.method==='PUT'){const d=JSON.parse(options.body);if(d.baseVersion!==state.revision)return new Response(JSON.stringify({error:'conflict'}),{status:409});state={revision:d.version,envelope:d.envelope};domainStates.set(path,state);revision++;}return new Response(JSON.stringify(state));}
  if(path.startsWith('/api/pic/objects/')){if(options.method==='PUT'){objects.set(path,new Uint8Array(options.body));return new Response('{}');}return new Response(objects.get(path));}
  return new Response(JSON.stringify({ok:false,error:'source unavailable'}),{status:502});
 };
 const a=browser(assets['/pic/'].body,'https://feiniao.test/pic/'),w=a.window;w.fetch=fetcher;
 try{
  w.eval(assets['/pic/cloud.js'].body);await until(()=>!w.document.getElementById('unlock').hidden);
  w.document.getElementById('password').value='test-cloud-master';w.document.getElementById('confirm-password').value='test-cloud-master';w.document.getElementById('unlock').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>!w.document.getElementById('workspace').hidden);assert.equal(revision,2);
  assert.ok(!w.document.getElementById('management').open);assert.equal(w.document.getElementById('sync').closest('details').id,'management');assert.equal(w.document.getElementById('management').closest('header').className,'bar');
  w.document.getElementById('management').open=true;w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.getElementById('management').open,false);
  w.document.getElementById('management').open=true;w.document.getElementById('welcome').click();assert.equal(w.document.getElementById('management').open,false);

  for(const app of ['finance','gallery','vault','dev']){
   const d=browser(assets['/pic/'+app+'/'].body,'https://feiniao.test/pic/'+app+'/');
   Object.defineProperty(d.window,'parent',{value:w});d.window.fetch=fetcher;
   try{d.window.eval(assets['/pic/'+app+'/app.js'].body);await until(()=>d.window.document.getElementById('root').textContent.length>10);assert.doesNotMatch(d.window.document.getElementById('root').textContent,/undefined|NaN/);if(app==='finance')d.window.localStorage.setItem('familyvault.test-sync','private-modified-on-desktop');}
   finally{d.window.close();}
  }
  // Import via the actual parent bridge: plaintext must never reach network fetch.
  const pdf=strToU8('%PDF-1.4 private-health-source'),sha=await digest(pdf),sid=sha.slice(0,12);
  const data={reports:[{source_id:sid,sha256:sha,pdf:'sources/'+sid+'.pdf',filename:'private-report.pdf',date:'2026-11-01',pages:1}],observations:[{id:'health-row',source_id:sid,source_page:1,date:'2026-11-01',metric_key:'lipid.ldl',name:'低密度脂蛋白',original_value:'3.1',normalized_value:3.1,normalized_unit:'mmol/L',trend_eligible:true}]};
  const bytes=zipSync({'archive-index.json':strToU8(JSON.stringify(data)),['sources/'+sid+'.pdf']:pdf});
  const imported=await (await w.PicRuntime.healthFetch('/api/pic/legacy/health/import',{method:'POST',body:new Blob([bytes])})).json();assert.equal(imported.added,1);
  const health=browser(assets['/pic/dev/'].body,'https://feiniao.test/pic/dev/#health');Object.defineProperty(health.window,'parent',{value:w});health.window.fetch=fetcher;
  try{health.window.eval(assets['/pic/dev/app.js'].body);await until(()=>health.window.document.querySelector('.ha-source-list a'));assert.match(health.window.document.querySelector('.ha-source-list a').href,/^blob:/);assert.ok(health.window.document.getElementById('root').textContent.includes('private-report.pdf'));assert.ok(health.window.document.querySelector('svg.ha-chart'));}finally{health.window.close();}
  // Importing an old .home backup must not erase the independent health archive.
  const manualData={tasks:[],notes:[],snippets:[],links:[],collections:[],lifeItems:[],secrets:[],accounts:[],company:{},invoices:[],bets:[],settings:{autoLockMin:5},updatedAt:1,health:{bp:[{id:'bp1',date:'2026-11-01',systolic:123,diastolic:80,createdAt:1}],lipids:[{id:'lipid1',date:'2026-11-01',ldl:3.1,createdAt:1}],diet:[{id:'diet1',date:'2026-11-01',meal:'早餐',items:'private-breakfast-record',createdAt:1}]}};
  const {file:vaultFile}=await createVault('original-workbench-password',manualData);
  const legacy={__home_backup:1,v:1,localStorage:{'familyvault.test-sync':'private-modified-on-desktop'},indexedDB:[{name:'devworld',version:1,stores:[{name:'vault',keyPath:null,keys:['main'],recs:[vaultFile]}]}]};
  const bad={...legacy,healthBundle:{newFormat:[{value:'private-unknown-health-record'}]}};const beforeBad=revision;Object.defineProperty(w.document.getElementById('file'),'files',{configurable:true,value:[new Blob([JSON.stringify(bad)])]});await w.document.getElementById('file').onchange();assert.equal(revision,beforeBad);assert.ok(w.document.getElementById('state').textContent.includes('未识别'));assert.ok(!w.document.getElementById('import-diagnostic').textContent.includes('private-unknown-health-record'));

  const current={document:{addEventListener(){}}};w.PicRuntime.install(current);const snapshot=new PicMemory();snapshot.factory=current.indexedDB;snapshot.local=current.localStorage;const copied=await snapshot.dump();legacy.indexedDB.push(...copied.indexedDB.filter(d=>d.name==='healtharchive'));legacy.backup_versions={shared:domainStates.get('/api/pic/shared-state').revision+1,health:domainStates.get('/api/pic/health-state').revision,finance:0};
  const file=new Blob([JSON.stringify(legacy)],{type:'application/json'});Object.defineProperty(w.document.getElementById('file'),'files',{configurable:true,value:[file]});await w.document.getElementById('file').onchange();assert.equal((await(await w.PicRuntime.healthFetch('/api/pic/legacy/health/archive')).json()).observations.length,1);
  const manual=browser(assets['/pic/dev/'].body,'https://feiniao.test/pic/dev/#health');Object.defineProperty(manual.window,'parent',{value:w});manual.window.fetch=fetcher;
  try{manual.window.eval(assets['/pic/dev/app.js'].body);await until(()=>[...manual.window.document.querySelectorAll('button')].some(b=>b.textContent==='解锁健康手记'));[...manual.window.document.querySelectorAll('button')].find(b=>b.textContent==='解锁健康手记').click();await until(()=>manual.window.document.querySelector('input[placeholder="主密码"]'));const input=manual.window.document.querySelector('input[placeholder="主密码"]');Object.getOwnPropertyDescriptor(manual.window.HTMLInputElement.prototype,'value').set.call(input,'original-workbench-password');input.dispatchEvent(new manual.window.Event('input',{bubbles:true}));manual.window.document.querySelector('form').dispatchEvent(new manual.window.Event('submit',{bubbles:true,cancelable:true}));await until(()=>[...manual.window.document.querySelectorAll('button')].some(b=>b.textContent==='手记血压'));[...manual.window.document.querySelectorAll('button')].find(b=>b.textContent==='手记血压').click();await until(()=>manual.window.document.getElementById('root').textContent.includes('123/80'));[...manual.window.document.querySelectorAll('button')].find(b=>b.textContent==='饮食').click();await until(()=>manual.window.document.getElementById('root').textContent.includes('private-breakfast-record'));}finally{manual.window.close();}
  await new Promise(r=>setTimeout(r,1100));w.document.getElementById('sync').click();await until(()=>revision>=2&&w.document.getElementById('state').textContent.includes('云端已同步'));
  assert.ok(network.every(n=>typeof n.body!=='string'||!n.body.includes('private-modified-on-desktop')&&!n.body.includes('private-report.pdf')&&!n.body.includes('lipid.ldl')));
  const b=browser(assets['/pic/'].body,'https://feiniao.test/pic/');b.window.fetch=fetcher;
  try{b.window.eval(assets['/pic/cloud.js'].body);await until(()=>!b.window.document.getElementById('unlock').hidden);b.window.document.getElementById('password').value='test-cloud-master';b.window.document.getElementById('unlock').dispatchEvent(new b.window.Event('submit',{cancelable:true}));await until(()=>!b.window.document.getElementById('workspace').hidden);const restored=await(await b.window.PicRuntime.healthFetch('/api/pic/legacy/health/archive')).json();assert.equal(restored.observations[0].original_value,'3.1');assert.equal(restored.reports[0].source_available,true);const device={document:{addEventListener(){}}};b.window.PicRuntime.install(device);assert.equal(device.localStorage.getItem('familyvault.test-sync'),'private-modified-on-desktop');device.localStorage.setItem('familyvault.test-sync','private-modified-on-phone');const before=revision;b.window.document.getElementById('sync').click();await until(()=>revision>before&&b.window.document.getElementById('state').textContent.includes('云端已同步'));const desktop={document:{addEventListener(){}}};w.PicRuntime.install(desktop);desktop.localStorage.setItem('familyvault.test-sync','conflicting-desktop-change');w.document.getElementById('sync').click();await until(()=>w.document.getElementById('state').dataset.error==='true');assert.equal(revision,before+1);assert.equal(desktop.localStorage.getItem('familyvault.test-sync'),'conflicting-desktop-change');}
  finally{b.window.close();}
 }finally{a.window.close();}
});
