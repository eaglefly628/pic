import {CloudSync} from '../../../../shared/pic/sync.js';
import {backupVersions,domainBundle,combineDomains} from '../../../../shared/pic/versions.js';
import {inspectBackup,prepareEmbeddedArchive,describeBackup,backupStructure} from '../../../../shared/pic/backup.js';
import {HealthStore} from '../../../../shared/pic/health.js';
import {PicMemory,b64,un64,keyFor,seal,open,uploadSnapshot,downloadSnapshot} from '../../../../shared/pic/core.js';
const $=id=>document.getElementById(id);
let health=null,engine=null,requestedVersions=null;
let memory=null,key=null,salt=null,revision=0,manifest=null,generation=0,saved=0,pending=null,timer=null,blocked=false,remoteChanged=false,lastActivity=Date.now(),epoch=0;
function status(message,error=false){$('state').textContent=message;$('state').dataset.error=String(error);}
async function api(path,options={}){const r=await fetch('/api/pic/'+path,{credentials:'same-origin',...options});if(!r.ok){let e;try{e=await r.json();}catch{}const error=Error(e?.error||'云端连接失败（'+r.status+'）');error.status=r.status;throw error;}return r;}
async function state(){const m=await new CloudSync(api).metadata();return {envelope:m.envelope,revision:m.states.shared.revision};}
const versionsText=()=>{const v=engine.versions();return `共享 v${v.shared} · 健康 v${v.health} · 金融 v${v.finance}（网页只读）`;};
async function envelope(value){const bytes=await seal(key,value);return {format:'feiniao-v1',iterations:600000,salt,iv:b64(bytes.slice(0,12)),ciphertext:b64(bytes.slice(12))};}
async function decode(e,k=key){if(e.format!=='feiniao-v1'||e.iterations!==600000)throw Error('加密格式不受支持');const iv=un64(e.iv),ct=un64(e.ciphertext),bytes=new Uint8Array(iv.length+ct.length);bytes.set(iv);bytes.set(ct,12);return open(k,bytes);}
function changed(){generation++;status('有修改待同步，请保持页面打开');clearTimeout(timer);if(!blocked&&!remoteChanged)timer=setTimeout(()=>flush().catch(()=>{}),900);}
async function flush(){
 if(pending){await pending;return flush();}if(!memory||generation===saved)return;if(blocked||remoteChanged)throw Error('请先下载加密备份，再加载云端版本');
 const turn=epoch;let succeeded=false;
 pending=(async()=>{
  const g=generation;status('正在加密并同步…');
  try{
   await engine.commit(await memory.dump(),requestedVersions);requestedVersions=null;
   if(turn!==epoch)return;revision=engine.versions().shared;saved=g;succeeded=true;status('云端已同步 · '+versionsText());
  }catch(error){if(turn===epoch){if(error.status===409){blocked=true;remoteChanged=true;}status(error.message+'；当前修改尚在内存，请勿关闭页面。',true);}throw error;}
 })().finally(()=>{pending=null;if(succeeded&&!blocked&&!remoteChanged&&generation!==saved&&turn===epoch){clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),300);}});
 await pending;if(generation!==saved)return flush();
}
async function setupMemory(bundle){memory=new PicMemory(changed);await memory.restore(bundle||{__home_backup:1,v:1,localStorage:{},indexedDB:[]});memory.local.readOnlyFinance=true;}
function healthService(){if(!memory||!key)throw Error('请先解锁家庭云空间');if(!health){const owner=memory,turn=epoch;health=new HealthStore(owner,{flush,active:()=>!!key&&memory===owner&&turn===epoch});}return health;}
window.PicRuntime={protectFinance(w){w.document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/添加|编辑|删除|保存|重置|导入|录入|新增|记一|修改|恢复|创建|清空|更改密码/.test(b.textContent)){e.preventDefault();e.stopImmediatePropagation();status('金融数据网页只读，请在 Mac 修改后发布新版');}},true);},healthFetch:(input,options)=>healthService().fetch(input,options),async reloadApp(w){try{await flush();w.location.reload();}catch(e){status(e.message+"；请先下载加密备份，再刷新。",true);}},install(w){if(!memory||!key)throw Error('请先解锁家庭云空间');memory.install(w);for(const event of ['pointerdown','keydown','input','scroll'])w.document.addEventListener(event,()=>lastActivity=Date.now(),{capture:true,passive:true});}};
async function connect(){
 $('error').textContent='';$('checking').hidden=false;$('reconnect').hidden=true;
 try{const s=await state();revision=s.revision;manifest=null;$('login').hidden=true;$('unlock').hidden=false;$('confirm-label').hidden=!!s.envelope;$('confirm-password').required=!s.envelope;$('gate-title').textContent=s.envelope?'解锁家庭云空间':'设置家庭云主密码';$('enter').textContent=s.envelope?'解锁':'创建加密云空间';$('unlock').dataset.exists=String(!!s.envelope);}
 catch(e){if(e.status===401){$('login').hidden=false;$('unlock').hidden=true;}else{$('error').textContent=e.message;$('reconnect').hidden=false;}}
 finally{$('checking').hidden=true;}
}
$('reconnect').onclick=connect;
$('login').onsubmit=async e=>{e.preventDefault();const button=$('login').querySelector('button');button.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('site-password').value})});const d=await r.json();if(!r.ok)throw Error(d.error);$('site-password').value='';await connect();}catch(e){$('error').textContent=e.message;}finally{button.disabled=false;}};
$('unlock').onsubmit=async e=>{
 e.preventDefault();$('enter').disabled=true;$('error').textContent='';
 try{
  const s=await state(),password=$('password').value;
  if(!s.envelope&&password!==$('confirm-password').value)throw Error('两次主密码不一致');
  engine=new CloudSync(api);let bundle;try{bundle=await engine.open(password);}catch(error){throw Error(error.message||'主密码不正确或云端数据暂不可读');}
  key=engine.keys.shared;salt=engine.salts.shared;revision=engine.versions().shared;
  await setupMemory(bundle);generation=1;saved=0;blocked=false;remoteChanged=false;await flush();
  $('password').value='';$('confirm-password').value='';$('gate').hidden=true;$('workspace').hidden=false;$('lock').hidden=false;$('management').hidden=false;lastActivity=Date.now();status('云端已同步 · '+versionsText());
 }catch(e){key=null;memory=null;manifest=null;$('error').textContent=e.message;}finally{$('enter').disabled=false;}
};
for(const b of document.querySelectorAll('[data-app]'))b.onclick=async()=>{if(!memory)return;try{await flush();if(blocked||remoteChanged)throw Error('请先备份并加载云端');$('frame').src=b.dataset.app==='health'?'/pic/dev/#health':'/pic/'+b.dataset.app+'/';$('frame').hidden=false;$('welcome').hidden=true;for(const t of document.querySelectorAll('[data-app]'))t.setAttribute('aria-current',String(t===b));}catch(e){status(e.message,true);}};
$('sync').onclick=()=>flush().catch(e=>status(e.message+'；请保留页面并下载加密备份。',true));
$('reload').onclick=()=>{if(generation!==saved&&!confirm('存在尚未同步的修改。请先下载加密备份。确定放弃当前内存中的修改并加载云端吗？'))return;location.reload();};
$('backup').onclick=async()=>{if(!memory||!key)return;try{const e=await envelope(await engine.backup(await memory.dump())),blob=new Blob([JSON.stringify({__pic_backup:1,envelope:e})],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='PIC-加密备份-v'+engine.versions().shared+'-h'+engine.versions().health+'.pic';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status('备份失败：'+e.message,true);}};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files[0];$('file').value='';if(!file||!memory)return;
 if(blocked||remoteChanged){status('请先备份并加载最新云端版本，再导入',true);return;}
 if(!confirm('导入将替换家庭 PIC 的当前全部资料，不会修改飞鸟的作品和账号。请先下载当前加密备份。确定继续？'))return;
 $('import').disabled=true;try{
  await flush();let b=JSON.parse(await file.text());
  if(b.__pic_backup===1){const password=prompt('输入此备份的家庭云主密码（只在本机解密）');if(password===null)return;b=await decode(b.envelope,await keyFor(password,b.envelope.salt));}
  const inspection=inspectBackup(b);$('import-diagnostic').textContent=backupStructure(b);$('import-report').hidden=false;$('import-report-text').textContent=describeBackup(inspection.summary);if(inspection.suspected.length)throw Error('备份存在未识别的健康分区，已停止替换；请提供文件结构以继续适配');
  const incomingVersions=backupVersions(b);
  const gallery=b.indexedDB?.find(d=>d.name==='familygallery');
  if(gallery){const meta=gallery.stores.find(s=>s.name==='meta'),orig=gallery.stores.find(s=>s.name==='orig');if(meta?.recs.some(r=>r.path&&!orig?.keys?.includes(r.id)))throw Error('此备份包含只有电脑目录索引的影像，请先在原 PIC 导入原文件后重新导出；目录索引不能跨设备读取原图');}
  const candidate=new PicMemory();await candidate.restore(b);
  if(inspection.archives.length){const importer=new HealthStore(candidate);for(const archive of inspection.archives)await importer.import(await prepareEmbeddedArchive(archive));importer.clear();}
  const combined=combineDomains({shared:await candidate.dump(),health:await candidate.dump(),finance:await memory.dump()});
  await engine.verifyImport(combined,incomingVersions);
  const ready=new PicMemory();await ready.restore(combined);ready.local.readOnlyFinance=true;
  requestedVersions=incomingVersions;
  $('frame').removeAttribute('src');$('frame').hidden=true;$('welcome').hidden=false;
  health?.clear();health=null;memory=ready;memory.onChange=changed;generation++;await flush();const restored=await new HealthStore(memory).read();$('import-report-text').textContent=describeBackup({...inspection.summary,healthArchiveCount:restored.reports.length?1:0,healthReports:restored.reports.length,healthObservations:restored.observations.length})+' 金融数据保持 Mac 已发布版本，不从网页备份替换。若手记仍为空，请在健康页解锁原工作台，不能用云主密码代替。';status('云端已同步 · 备份导入完成 · 版本 '+revision+'；请查看备份检查结果');
 }catch(e){status('导入未完成：'+e.message+'；保留页面，必要时下载加密备份。',true);}finally{$('import').disabled=false;}
};
async function lock(){
 if(!key)return;try{await flush();if(generation!==saved)throw Error('还有未同步修改');epoch++;engine?.clear();engine=null;health?.clear();health=null;key=null;memory=null;manifest=null;generation=saved=0;$('frame').removeAttribute('src');$('frame').hidden=true;$('workspace').hidden=true;$('gate').hidden=false;$('lock').hidden=true;$('management').open=false;$('management').hidden=true;$('import-report').hidden=true;$('welcome').hidden=false;await connect();}catch(e){status('暂未锁定：'+e.message+'。请先下载加密备份。',true);}
}
$('lock').onclick=lock;
$('copy-import-report').onclick=async()=>{const text=$('import-diagnostic').textContent;try{await navigator.clipboard.writeText(text);status('结构诊断已复制（仅字段类型和数量，不含记录内容）');}catch{$('import-diagnostic').hidden=false;status('请从展开的结构诊断中选择并复制；其中不含记录内容');}};
$('health-from-report').onclick=()=>document.querySelector('[data-app="health"]').click();
const management=$('management');
management.querySelector('.management-panel').addEventListener('click',e=>{if(e.target.closest('button'))management.open=false;});
document.addEventListener('click',e=>{if(!management.contains(e.target))management.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&management.open){management.open=false;management.querySelector('summary').focus();}});
window.addEventListener('beforeunload',e=>{if(key&&generation!==saved){e.preventDefault();e.returnValue='';}});
for(const e of ['pointerdown','keydown','input','scroll'])document.addEventListener(e,()=>lastActivity=Date.now(),{capture:true,passive:true});
setInterval(()=>{if(key&&Date.now()-lastActivity>300000)lock();},10000);
setInterval(async()=>{if(!key||pending||remoteChanged)return;try{if(await engine.changedRemotely()){remoteChanged=true;status('另一台设备有更新。请先下载当前加密备份，再点“加载云端”。',true);}}catch(e){status(e.message+'；尚未确认云端最新状态。',true);}},30000);
connect();
