// Read-only recovery of records created before cloud storage was enabled.
document.getElementById('export-legacy').onclick=async()=>{
 const button=document.getElementById('export-legacy');button.disabled=true;
 try{
  const raw=localStorage.getItem('feiniao.encrypted.v1');
  if(!raw)throw Error('此浏览器没有旧版记录；请在原来的设备和浏览器上操作。');
  const old=JSON.parse(raw),password=prompt('输入旧版主密码，仅用于读取此浏览器的旧记录：');if(password===null)return;
  const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
  const rawKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(old.salt),iterations:old.iterations,hash:'SHA-256'},rawKey,{name:'AES-GCM',length:256},false,['decrypt']);
  let data;try{const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(old.iv)},key,unb64(old.ciphertext));data=JSON.parse(new TextDecoder().decode(clear));}catch{throw Error('旧版主密码不正确或旧记录已损坏。');}
  const ids=[...new Set([...data.records,...(data.draftEditor?[data.draftEditor]:[])].flatMap(r=>(r.media||[]).map(m=>m.id)))],assets=[];
  if(ids.length){
   const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('feiniao.encrypted.media.v1');r.onupgradeneeded=()=>{r.transaction.abort();reject(Error('旧版附件库不存在'));};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   try{for(const id of ids){const a=await new Promise((resolve,reject)=>{const r=database.transaction('files','readonly').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(!a)throw Error('旧记录缺少附件，已停止导出；请保留原数据。');assets.push({id,iv:a.iv,ciphertext:b64(new Uint8Array(await a.ciphertext.arrayBuffer()))});}}finally{database.close();}
  }
  const url=URL.createObjectURL(new Blob([JSON.stringify({...old,assets})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='飞鸟-旧版加密备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);alert('已发起下载。请确认备份文件已保存，再点“导入已有备份”上传到云端。原浏览器记录保持不变。');
 }catch(error){alert(error.message||'旧版备份导出失败，请保留原数据。');}finally{button.disabled=false;}
};
