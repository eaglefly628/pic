import {authenticateMac} from './pic-auth.js';
import {picApi} from './pic.js';
import {quantApi} from './quant.js';
import {shanghaiApi} from './shanghai.js';
import {industryApi,industryMcp} from './industry.js';
const encoder=new TextEncoder();
const COOKIE='__Host-feiniao';
const noCache={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...noCache,'content-type':'application/json; charset=utf-8',...extra}});
const hex=buffer=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join('');
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;};
async function sign(value,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));}
async function authenticated(request,env){const raw=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!raw)return false;const [expires,nonce,sig]=raw.split('.');return Number(expires)>Date.now()&&Number(expires)<Date.now()+86401000&&equal(sig,await sign(expires+'.'+nonce,env.SESSION_SECRET));}
async function verifyPassword(password,env){const raw=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(env.PASSWORD_SALT),iterations:100000},raw,256));return equal(hash,env.PASSWORD_HASH);}
async function body(request,max){const size=Number(request.headers.get('content-length'));if(size>max)throw new Error('请求过大');const reader=request.body?.getReader();if(!reader)return {};let bytes=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw new Error('请求过大');}parts.push(value);}const data=new Uint8Array(bytes);let i=0;for(const p of parts){data.set(p,i);i+=p.length;}return JSON.parse(new TextDecoder().decode(data));}
function validEnvelope(v){return v&&v.format==='feiniao-v1'&&v.iterations===600000&&typeof v.salt==='string'&&typeof v.iv==='string'&&typeof v.ciphertext==='string'&&v.salt.length===24&&v.iv.length===16&&v.ciphertext.length<=1800000;}
export default {async fetch(request,env){try{
 const url=new URL(request.url),path=url.pathname;
 if(!env.DB||!env.PASSWORD_HASH||!env.PASSWORD_SALT||!env.SESSION_SECRET)return json({error:'服务配置尚未完成，请稍后再试。'},503);
 if(path==='/mcp'&&request.method==='POST')return industryMcp(request,env);
 const mac=path.startsWith('/api/pic/')?await authenticateMac(request,env):false;
 if(!mac&&!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'请求来源不正确'},403);
 if(path==='/api/login'&&request.method==='POST'){
  const input=await body(request,2048);if(typeof input.password!=='string'||input.password.length>256)return json({error:'请输入访问密码'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown',id=await sign(ip,env.SESSION_SECRET),now=Date.now();
  const limit=await env.DB.prepare('SELECT failures, until_at FROM login_limits WHERE id=?').bind(id).first();
  if(limit&&limit.until_at>now&&limit.failures>=8)return json({error:'尝试次数较多，请 15 分钟后重试。'},429,{'retry-after':'900'});
  if(!await verifyPassword(input.password,env)){
   await env.DB.prepare('INSERT INTO login_limits(id,failures,until_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN until_at<? THEN 1 ELSE failures+1 END, until_at=CASE WHEN until_at<? THEN ? ELSE until_at END').bind(id,now+900000,now,now,now+900000).run();
   return json({error:'访问密码不正确'},401);
  }
  await env.DB.prepare('DELETE FROM login_limits WHERE id=? OR until_at<?').bind(id,now).run();
  const value=(now+86400000)+'.'+crypto.randomUUID();const token=value+'.'+await sign(value,env.SESSION_SECRET);
  return json({ok:true},200,{'set-cookie':COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400'});
 }
 if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':COOKIE+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
 if(path.startsWith('/api/')){
  if(!mac&&!await authenticated(request,env))return json({error:'请先输入访问密码'},401);
  if(path.startsWith('/api/pic/'))return await picApi(request,env,{json,body,validEnvelope,mac});
  if(path==='/api/quant'||path.startsWith('/api/quant/'))return quantApi(request,env);
  if(path.startsWith('/api/shanghai'))return await shanghaiApi(request,env);
  if(path.startsWith('/api/industry'))return industryApi(request,env);
  if(path==='/api/vault'&&request.method==='GET'){const row=await env.DB.prepare('SELECT revision,envelope FROM vault WHERE id=?').bind('main').first();return json(row?{revision:row.revision,envelope:JSON.parse(row.envelope)}:{revision:0,envelope:null});}
  if(path==='/api/vault'&&request.method==='PUT'){
   const data=await body(request,1900000);if(!Number.isInteger(data.revision)||data.revision<0||!validEnvelope(data.envelope))return json({error:'记录格式不正确或超过云端单库容量'},400);
   const result=data.revision===0?await env.DB.prepare('INSERT OR IGNORE INTO vault(id,revision,envelope) VALUES(?,1,?)').bind('main',JSON.stringify(data.envelope)).run():await env.DB.prepare('UPDATE vault SET revision=revision+1,envelope=? WHERE id=? AND revision=?').bind(JSON.stringify(data.envelope),'main',data.revision).run();
   if(!result.meta.changes)return json({error:'另一台设备已更新记录。请先导出当前备份，再重新解锁后合并。'},409);
   return json({revision:data.revision+1});
  }
  const match=path.match(/^\/api\/media\/([a-zA-Z0-9-]{1,100})$/);
  if(match&&request.method==='GET'){const rows=await env.DB.prepare('SELECT part,payload,iv FROM media_chunks WHERE asset_id=? ORDER BY part').bind(match[1]).all();if(!rows.results.length)return json({error:'附件不存在'},404);return json({id:match[1],iv:rows.results[0].iv,ciphertext:rows.results.map(x=>x.payload).join('')});}
  if(match&&request.method==='PUT'){
   const a=await body(request,71000000);if(typeof a.iv!=='string'||a.iv.length!==16||typeof a.ciphertext!=='string'||a.ciphertext.length>70000000||!/^[A-Za-z0-9+/=]+$/.test(a.ciphertext))return json({error:'附件格式不正确'},400);
   const existing=await env.DB.prepare('SELECT part FROM media_chunks WHERE asset_id=? LIMIT 1').bind(match[1]).first();if(existing)return json({error:'附件已存在'},409);
   const statements=[];for(let offset=0,part=0;offset<a.ciphertext.length;offset+=500000,part++)statements.push(env.DB.prepare('INSERT INTO media_chunks(asset_id,part,payload,iv) VALUES(?,?,?,?)').bind(match[1],part,a.ciphertext.slice(offset,offset+500000),a.iv));
   await env.DB.batch(statements);return json({ok:true});
  }
  return json({error:'接口不存在'},404);
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404,headers:noCache});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{...noCache,'content-type':asset.type,'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:8769; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}});
}catch(error){console.error('Cloud operation failed:',error.message);return json({error:error.message==='请求过大'?'请求过大':'服务暂时不可用，请重试；未保存的内容请保留。'},500);}}};
