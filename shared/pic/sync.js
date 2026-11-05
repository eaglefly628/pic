import {b64,un64,keyFor,seal,open,digest,uploadSnapshot,downloadSnapshot} from './core.js';
import {DOMAINS,domainBundle,combineDomains,stableJSON,compareVersions,BACKUP_PROTOCOL} from './versions.js';
const encode=new TextEncoder();
export class CloudSync{
 constructor(api){this.api=api;this.keys={};this.salts={};this.states={};this.manifests={};this.hashes={};this.legacyVersion=0;}
 async get(domain){return (await this.api(domain+'-state')).json();}
 async metadata(){const legacy=await (await this.api('state')).json(),states=Object.fromEntries(await Promise.all(DOMAINS.map(async d=>[d,await this.get(d)])));return {legacy,states,envelope:states.shared.envelope||states.health.envelope||states.finance.envelope||legacy.envelope};}
 async decrypt(e,key){const iv=un64(e.iv),ct=un64(e.ciphertext),bytes=new Uint8Array(iv.length+ct.length);bytes.set(iv);bytes.set(ct,12);return open(key,bytes);}
 async encrypt(value,domain){const bytes=await seal(this.keys[domain],value);return {format:'feiniao-v1',iterations:600000,salt:this.salts[domain],iv:b64(bytes.slice(0,12)),ciphertext:b64(bytes.slice(12))};}
 async open(password){
  const meta=await this.metadata();this.states=meta.states;this.legacyVersion=meta.legacy.revision||0;let legacyBundle={__home_backup:1,v:1,localStorage:{},indexedDB:[]};
  const cache=new Map();const derive=async salt=>{if(!cache.has(salt))cache.set(salt,await keyFor(password,salt));return cache.get(salt);};
  if(meta.legacy.envelope&&DOMAINS.some(d=>!this.states[d].envelope)){
   const e=meta.legacy.envelope,k=await derive(e.salt),manifest=await this.decrypt(e,k);
   if(!this.states.shared.envelope||!this.states.health.envelope)legacyBundle=await downloadSnapshot(manifest,k,async id=>new Uint8Array(await(await this.api('objects/'+id)).arrayBuffer()));
   else legacyBundle.localStorage=manifest.localStorage;
  }
  const parts={};
  for(const domain of DOMAINS){const state=this.states[domain],salt=state.envelope?.salt||meta.legacy.envelope?.salt||b64(crypto.getRandomValues(new Uint8Array(16)));this.salts[domain]=salt;this.keys[domain]=await derive(salt);
   if(state.envelope){const manifest=await this.decrypt(state.envelope,this.keys[domain]);this.manifests[domain]=manifest;parts[domain]=domainBundle(await downloadSnapshot(manifest,this.keys[domain],async id=>new Uint8Array(await(await this.api('objects/'+id)).arrayBuffer())),domain);}
   else{this.manifests[domain]=null;parts[domain]=domainBundle(legacyBundle,domain);}
   this.hashes[domain]=await this.hash(parts[domain]);
  }
  return combineDomains(parts);
 }
 versions(){return Object.fromEntries(DOMAINS.map(d=>[d,this.states[d]?.revision||(d==='finance'?this.legacyVersion:0)]));}
 async hash(b){return digest(encode.encode(stableJSON(b)));}
 async verifyImport(bundle,versions){for(const domain of ['shared','health']){const hash=await this.hash(domainBundle(bundle,domain)),result=compareVersions({version:versions[domain],hash},{version:this.states[domain].revision,hash:this.hashes[domain]});if(result==='older'||result==='conflict')throw Error(domain+' 分区备份版本过期或同版本内容冲突，当前数据未替换');}}
 async commit(bundle,requestedVersions){
  for(const domain of ['shared','health']){
   const part=domainBundle(bundle,domain),hash=await this.hash(part),state=this.states[domain];
   if(state.envelope&&hash===this.hashes[domain]&&(!requestedVersions||requestedVersions[domain]===state.revision))continue;
   const version=requestedVersions?.[domain]??(!state.envelope&&this.legacyVersion?Math.max(1,this.legacyVersion):state.revision+1);
   if(version<=state.revision)throw Error('备份版本不能覆盖同版本或更高版本');
   const manifest=await uploadSnapshot(part,this.keys[domain],this.manifests[domain],async(id,bytes)=>this.api('objects/'+id,{method:'PUT',headers:{'content-type':'application/octet-stream'},body:bytes})),envelope=await this.encrypt(manifest,domain);
   let result;try{result=await(await this.api(domain+'-state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseVersion:state.revision,version,envelope})})).json();}
   catch(error){let found;try{found=await this.get(domain);}catch{}if(found?.envelope?.ciphertext===envelope.ciphertext&&found?.envelope?.iv===envelope.iv)result=found;else throw error;}
   this.states[domain]={...result,envelope};this.manifests[domain]=manifest;this.hashes[domain]=hash;
  }
  return this.versions();
 }
 async backup(bundle){const versions=this.versions();for(const d of ['shared','health'])if(await this.hash(domainBundle(bundle,d))!==this.hashes[d])versions[d]++;
  return {protocol:BACKUP_PROTOCOL,...bundle,backup_versions:versions};
 }
 async changedRemotely(){for(const d of DOMAINS)if((await this.get(d)).revision!==this.states[d].revision)return true;return false;}
 clear(){this.keys={};this.salts={};this.hashes={};this.manifests={};}
}
