import fs from 'node:fs/promises';
import path from 'node:path';
import {generateKeyPairSync,createHash,createPrivateKey,createPublicKey,sign,webcrypto} from 'node:crypto';
import {CloudSync} from './sync.js';
import {DOMAINS,FINANCE_KEYS,domainBundle,combineDomains,stableJSON} from './versions.js';
import {uploadSnapshot} from './core.js';
import {validateHealth} from './health.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const hash=v=>createHash('sha256').update(v).digest('hex');
async function json(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function atomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value),{mode:0o600});await fs.rename(tmp,file);}
export function createMacSync({dataDir,healthDir=path.join(dataDir,'health'),safeStorage,fetcher=fetch}){
 const configPath=path.join(dataDir,'pic-cloud-device.json');let busy=false;
 async function secrets(){if(!safeStorage.isEncryptionAvailable())throw Error('Mac 钥匙串加密尚不可用，未保存任何云密码');const config=await json(configPath,null);if(!config)throw Error('请先配置云同步');return {config,secret:JSON.parse(safeStorage.decryptString(Buffer.from(config.secret,'base64')))};}
 async function save(config,secret){await atomic(configPath,{...config,secret:safeStorage.encryptString(JSON.stringify(secret)).toString('base64')});}
 async function localBundle(){const home=await json(path.join(dataDir,'current.home'),null);if(!home?.__home_backup)throw Error('请先在大厅完成一次本机备份');const data=await json(path.join(healthDir,'archive-index.json'),null);if(!data)return home;validateHealth(data);
 return {...home,indexedDB:[...(home.indexedDB||[]).filter(d=>d.name!=='healtharchive'),{name:'healtharchive',version:1,stores:[{name:'archive',keyPath:null,recs:[data],keys:['main']},{name:'sources',keyPath:null,recs:[],keys:[]},{name:'history',keyPath:null,recs:[],keys:[]}]}]};}
 return {
 async setup({origin,password}){const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/')throw Error('请填写 HTTPS 网站根网址');if(typeof password!=='string'||password.length<8)throw Error('请输入家庭云主密码');if(!safeStorage.isEncryptionAvailable())throw Error('钥匙串尚不可用');const old=await json(configPath,null);let privateKey;if(old){privateKey=(await secrets()).secret.privateKey;}else privateKey=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'});const publicKey=createPublicKey(privateKey).export({format:'der',type:'spki'}).subarray(-32);const deviceId=hash(publicKey).slice(0,32),config={origin:url.origin,deviceId,publicKey:publicKey.toString('base64'),domains:old?.domains||{}};await save(config,{privateKey,password});return {deviceId,public_key:config.publicKey,needsOwnerRegistration:true};},
 async info(){const c=await json(configPath,null);return c?{origin:c.origin,deviceId:c.deviceId,public_key:c.publicKey,versions:Object.fromEntries(DOMAINS.map(d=>[d,c.domains[d]?.version||0]))}:{configured:false};},
 async sync(){if(busy)throw Error('同步正在进行');busy=true;try{
  const {config,secret}=await secrets(),key=createPrivateKey(secret.privateKey);
  const api=async(endpoint,options={})=>{const method=options.method||'GET',body=options.body??'',bytes=typeof body==='string'?Buffer.from(body):Buffer.from(body),time=String(Date.now()),pathname='/api/pic/'+endpoint,signature=sign(null,Buffer.from([method,pathname,time,hash(bytes)].join('\n')),key).toString('base64');const r=await fetcher(config.origin+pathname,{...options,headers:{...options.headers,'x-pic-device':config.deviceId,'x-pic-time':time,'x-pic-signature':signature}});if(!r.ok){let msg;try{msg=(await r.json()).error;}catch{}throw Error(msg||'Mac 尚未授权或云端连接失败（'+r.status+'）');}return r;};
  const cloud=new CloudSync(api),remote=await cloud.open(secret.password),local=await localBundle(),parts={};const actions={};
  // Preflight every domain before any upload or local replacement.
  for(const d of DOMAINS){const localPart=domainBundle(local,d),localHash=hash(stableJSON(localPart)),known=config.domains[d],remoteVersion=cloud.states[d].revision,dirty=known&&known.localHash!==localHash;
   if(dirty&&remoteVersion>known.version)throw Error(d+' 出现分叉：本机修改未覆盖云端新版本，请保留备份后人工合并');
   if(!known&&remoteVersion>0){const incoming=local.backup_versions?.[d];if(!Number.isSafeInteger(incoming))throw Error(d+' 本机备份缺少版本号，先完成旧库基线迁移');if(incoming===remoteVersion&&localHash!==cloud.hashes[d])throw Error(d+' 同版本内容冲突，未自动覆盖');actions[d]=incoming>remoteVersion?'push':incoming===remoteVersion?'unchanged':'pull';parts[d]=actions[d]==='pull'?domainBundle(remote,d):localPart;}else if(known&&remoteVersion>known.version){actions[d]='pull';parts[d]=domainBundle(remote,d);}else{actions[d]=(!known||dirty)?'push':'unchanged';parts[d]=localPart;}
   if(d!=='finance'&&actions[d]==='push'&&!remoteVersion&&cloud.legacyVersion)throw Error('请先打开新版飞鸟网页，完成旧整屋快照的版本分区迁移，再同步 Mac');
  }
  await fs.mkdir(path.join(dataDir,'backups/version-conflicts'),{recursive:true});await atomic(path.join(dataDir,'backups/version-conflicts/pre-sync-'+Date.now()+'.home'),local);
  for(const d of DOMAINS){if(actions[d]==='push'){const state=cloud.states[d],version=Math.max(state.revision+1,local.backup_versions?.[d]||0,config.domains[d]?.version||0,d==='finance'?cloud.legacyVersion+1:1);const manifest=await uploadSnapshot(parts[d],cloud.keys[d],cloud.manifests[d],async(id,bytes)=>api('objects/'+id,{method:'PUT',headers:{'content-type':'application/octet-stream'},body:bytes}));const envelope=await cloud.encrypt(manifest,d);const result=await(await api(d+'-state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseVersion:state.revision,version,envelope})})).json();cloud.states[d]={...result,envelope};}
   config.domains[d]={version:cloud.states[d].revision,localHash:hash(stableJSON(parts[d]))};
  }
  const combined=combineDomains(parts);Object.assign(combined.localStorage,Object.fromEntries(Object.entries(local.localStorage||{}).filter(([k])=>!FINANCE_KEYS.includes(k)&&!(/^(familyvault\.|home\.user|.*theme)/.test(k)))));combined.backup_versions=Object.fromEntries(DOMAINS.map(d=>[d,config.domains[d].version]));
  if(actions.health==='pull'){const h=parts.health.indexedDB.find(d=>d.name==='healtharchive'),a=h?.stores.find(s=>s.name==='archive')?.recs?.[0];if(a){validateHealth(a);const blobs=h.stores.find(s=>s.name==='sources');for(const report of a.reports){const i=blobs?.keys.indexOf(report.source_id)??-1;if(i<0)continue;const v=blobs.recs[i];if(v.__t!=='blob')throw Error('健康原件格式无效');const bytes=Buffer.from(v.b64,'base64');if(hash(bytes)!==report.sha256)throw Error('健康原件校验失败');const target=path.resolve(healthDir,report.pdf),root=path.resolve(healthDir);if(!target.startsWith(root+path.sep))throw Error('健康路径越界');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{mode:0o600});}await atomic(path.join(healthDir,'archive-index.json'),a);}}
  await save(config,secret);cloud.clear();return {ok:true,actions,backup_versions:combined.backup_versions,bundle:combined};
 }finally{busy=false;}}
 };
}
