import {FINANCE_KEYS} from './versions.js';
import {IDBFactory} from 'fake-indexeddb';
const enc=new TextEncoder(),dec=new TextDecoder();
export const b64=a=>{let s='';for(const v of new Uint8Array(a))s+=String.fromCharCode(v);return btoa(s);};
export const un64=s=>Uint8Array.from(atob(s),v=>v.charCodeAt(0));
export async function digest(a){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function keyFor(password,salt){const raw=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:un64(salt),iterations:600000},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12)),data=enc.encode(JSON.stringify(value));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data)),out=new Uint8Array(iv.length+ct.length);out.set(iv);out.set(ct,12);return out;}
export async function open(key,bytes){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12))));}
export async function pack(value){
 if(value===undefined)return {__t:'undefined'};
 if(value===null||typeof value!=='object')return value;
 if(typeof value.arrayBuffer==='function'&&typeof value.type==='string'){if(value.size>20*1024*1024)throw Error('照片/视频单文件最多 20 MiB，请先压缩较大的视频');return {__t:'blob',type:value.type,b64:b64(await value.arrayBuffer())};}
 if(value instanceof ArrayBuffer)return {__t:'ab',b64:b64(value)};
 if(ArrayBuffer.isView(value))return {__t:'view',ctor:value.constructor.name,b64:b64(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength))};
 if(value instanceof Date)return {__t:'date',iso:value.toISOString()};
 if(typeof value.kind==='string'&&typeof value.queryPermission==='function')throw Error('本机目录句柄不能同步，请改用媒体导入');
 if(Array.isArray(value))return Promise.all(value.map(pack));
 const out={};for(const [k,v] of Object.entries(value))Object.defineProperty(out,k,{value:await pack(v),enumerable:true,writable:true,configurable:true});return out;
}
export function unpack(value){
 if(value===null||typeof value!=='object')return value;
 if(value.__t==='undefined')return undefined;
 if(value.__t==='blob')return new Blob([un64(value.b64)],{type:value.type});
 if(value.__t==='ab')return un64(value.b64).buffer;
 if(value.__t==='view'){const classes={Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray,DataView};const C=classes[value.ctor];if(!C)throw Error('不支持的二进制类型');return new C(un64(value.b64).buffer);}
 if(value.__t==='date')return new Date(value.iso);
 if(Array.isArray(value))return value.map(unpack);
 const out={};for(const [k,v] of Object.entries(value))Object.defineProperty(out,k,{value:unpack(v),enumerable:true,writable:true,configurable:true});return out;
}
const request=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const complete=t=>new Promise((res,rej)=>{t.addEventListener('complete',res);t.addEventListener('abort',()=>rej(t.error||Error('操作已中止')));t.addEventListener('error',()=>rej(t.error));});
const allowedDB=new Set(['familygallery','familyvault','devworld','healtharchive']);
export class MemoryStorage{
 constructor(onChange=()=>{}){this.readOnlyFinance=false;this.data=new Map();this.onChange=onChange;}
 get length(){return this.data.size;} key(i){return [...this.data.keys()][i]??null;} getItem(k){return this.data.get(String(k))??null;}
 setItem(k,v){k=String(k);if(this.readOnlyFinance&&FINANCE_KEYS.includes(k))throw Error('金融数据网页只读，请在 Mac 更新');v=String(v);if(this.data.get(k)!==v){this.data.set(k,v);this.onChange();}}
 removeItem(k){if(this.readOnlyFinance&&FINANCE_KEYS.includes(String(k)))throw Error('金融数据网页只读');if(this.data.delete(String(k)))this.onChange();}clear(){if(this.readOnlyFinance&&FINANCE_KEYS.some(k=>this.data.has(k)))throw Error('金融数据网页只读');if(this.data.size){this.data.clear();this.onChange();}}
}
export class PicMemory{
 constructor(onChange=()=>{}){
  this.factory=new IDBFactory();this.onChange=onChange;this.restoring=false;this.local=new MemoryStorage(()=>this.changed());this.session=new MemoryStorage();
  // Each connection belongs to this in-memory factory; nothing opens the real device database.
  const original=this.factory.open.bind(this.factory);
  this.factory.open=(...args)=>{if(!allowedDB.has(args[0]))throw Error('不支持的 PIC 数据库');const r=original(...args);r.addEventListener('upgradeneeded',()=>{r.transaction.addEventListener('complete',()=>this.changed());});r.addEventListener('success',()=>{const db=r.result,tx=db.transaction.bind(db);db.transaction=(...args)=>{const t=tx(...args);if(args[1]==='readwrite')t.addEventListener('complete',()=>this.changed());return t;};});return r;};
 }
 changed(){if(!this.restoring)this.onChange();}
 install(w){Object.defineProperty(w,'localStorage',{value:this.local,configurable:true});Object.defineProperty(w,'sessionStorage',{value:this.session,configurable:true});Object.defineProperty(w,'indexedDB',{value:this.factory,configurable:true});}
 async dump(){
  const dbs=[];for(const info of await this.factory.databases()){
   const db=await request(this.factory.open(info.name)),stores=[];
   for(const name of db.objectStoreNames){const t=db.transaction(name,'readonly'),os=t.objectStore(name);const [recs,keys]=await Promise.all([request(os.getAll()),request(os.getAllKeys())]);stores.push({name,keyPath:os.keyPath,autoIncrement:os.autoIncrement,recs:await pack(recs),keys:await pack(keys)});}
   dbs.push({name:db.name,version:db.version,stores});db.close();
  }
  const localStorage={};for(const [k,v] of this.local.data)if(/^(familyvault\.|home\.user|.*theme)/.test(k))localStorage[k]=v;
  return {__home_backup:1,v:1,localStorage,indexedDB:dbs};
 }
 async restore(bundle){
  if(!bundle||bundle.__home_backup!==1||!Array.isArray(bundle.indexedDB))throw Error('不是可识别的 PIC 备份');
  for(const d of bundle.indexedDB)if(!allowedDB.has(d.name))throw Error('备份包含未知数据库，请先在原应用导出完整备份');
  this.restoring=true;try{
   for(const d of bundle.indexedDB){
    const r=this.factory.open(d.name,d.version||1);r.addEventListener('upgradeneeded',()=>{for(const s of d.stores)r.result.createObjectStore(s.name,{keyPath:s.keyPath??undefined,autoIncrement:!!s.autoIncrement});});const db=await request(r);
    for(const s of d.stores){const t=db.transaction(s.name,'readwrite'),done=complete(t),os=t.objectStore(s.name),recs=unpack(s.recs),keys=unpack(s.keys);recs.forEach((rec,i)=>s.keyPath==null?os.put(rec,keys[i]):os.put(rec));await done;}
    db.close();
   }
   for(const [k,v] of Object.entries(bundle.localStorage||{}))if(/^(familyvault\.|home\.user|.*theme)/.test(k)&&typeof v==='string')this.local.setItem(k,v);
  }finally{this.restoring=false;}
 }
}
export async function uploadSnapshot(bundle,key,previous,upload){
 const manifest={__pic_manifest:1,localStorage:bundle.localStorage,databases:[],objects:[]};
 const prev=new Map((previous?.objects||[]).map(x=>[x.loc,x]));
 for(const db of bundle.indexedDB){
  manifest.databases.push({name:db.name,version:db.version,stores:db.stores.map(({recs,keys,...s})=>s)});
  for(const store of db.stores)for(let i=0;i<store.recs.length;i++){
   const loc=JSON.stringify([db.name,store.name,store.keyPath==null?store.keys[i]:i]);
   const value={db:db.name,store:store.name,key:store.keyPath==null?store.keys[i]:null,value:store.recs[i]},hash=await digest(enc.encode(JSON.stringify(value)));
   const old=prev.get(loc);if(old?.hash===hash){manifest.objects.push(old);continue;}
   const bytes=await seal(key,value);if(bytes.length>32*1024*1024)throw Error("单项加密数据超过 32 MiB，请拆分资料");const id=await digest(bytes);await upload(id,bytes);manifest.objects.push({loc,hash,id});
  }
 }
 return manifest;
}
export async function downloadSnapshot(manifest,key,download){
 if(manifest.__pic_manifest!==1)throw Error('云端索引格式不受支持');
 const bundle={__home_backup:1,v:1,localStorage:manifest.localStorage,indexedDB:manifest.databases.map(db=>({...db,stores:db.stores.map(s=>({...s,recs:[],keys:[]}))}))};
 for(const ref of manifest.objects){const bytes=await download(ref.id);if(await digest(bytes)!==ref.id)throw Error('云端密文校验失败');const rec=await open(key,bytes),db=bundle.indexedDB.find(x=>x.name===rec.db),store=db?.stores.find(x=>x.name===rec.store);if(!store)throw Error('云端数据索引不完整');store.recs.push(rec.value);store.keys.push(rec.key);}
 return bundle;
}
