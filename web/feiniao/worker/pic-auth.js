const encoder=new TextEncoder();
export async function authenticateMac(request,env){
 const id=request.headers.get('x-pic-device'),time=request.headers.get('x-pic-time'),signature=request.headers.get('x-pic-signature');
 if(!id||!signature||!/^\d{13}$/.test(time||'')||Math.abs(Date.now()-Number(time))>300000)return false;
 if(!/^[a-f0-9]{32}$/.test(id))return false;
 const device=await env.DB.prepare('SELECT public_key,revoked FROM pic_devices WHERE id=?').bind(id).first();if(!device||device.revoked)return false;
 const length=Number(request.headers.get('content-length'));if(length>34000000)return false;
 const bytes=await request.clone().arrayBuffer();if(bytes.byteLength>34000000)return false;
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 try{const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(device.public_key),c=>c.charCodeAt(0)),{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),encoder.encode([request.method,new URL(request.url).pathname,time,hash].join('\n')))?id:false;}catch{return false;}
}
export const deviceTools=[{name:'pic_register_mac',description:'Authorize a Mac device public key for encrypted synchronization. Never supply a private key or a password.',inputSchema:{type:'object',properties:{public_key:{type:'string'},label:{type:'string'}},required:['public_key'],additionalProperties:false}},{name:'pic_revoke_mac',description:'Revoke a paired Mac device.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}}];
export async function deviceCall(name,args,env){
 if(name==='pic_register_mac'){
  let bytes;try{bytes=Uint8Array.from(atob(args.public_key),c=>c.charCodeAt(0));}catch{}if(bytes?.length!==32)throw Error('需要 Ed25519 的 32 字节公钥；不要发送私钥');
  await crypto.subtle.importKey('raw',bytes,{name:'Ed25519'},false,['verify']);
  const id=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,32);
  await env.DB.prepare('INSERT INTO pic_devices(id,public_key,label,revoked) VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET revoked=0,label=excluded.label').bind(id,args.public_key,String(args.label||'Mac').slice(0,80)).run();return {id,authorized:true};
 }
 if(name==='pic_revoke_mac'){await env.DB.prepare('UPDATE pic_devices SET revoked=1 WHERE id=?').bind(args.id).run();return {revoked:true};}
 throw Error('未知设备操作');
}
