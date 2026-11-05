import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import worker from '../worker/index.js';
import '../public/capture.js';
globalThis.ASSETS={'/':{body:'login page',type:'text/html'}};
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../drizzle/0000_cloud.sql',import.meta.url),'utf8'));
 const adapter={
  prepare(sql){
   return {bind(...args){
    return {
     async first(){return db.prepare(sql).get(...args)||null;},
     async all(){return {results:db.prepare(sql).all(...args)};},
     async run(){return {meta:db.prepare(sql).run(...args)};}
    };
   }};
  },
  async batch(stmts){
   db.exec('BEGIN');
   try {const results=await Promise.all(stmts.map(x=>x.run()));db.exec('COMMIT');return results;}
   catch(e){db.exec('ROLLBACK');throw e;}
  }
 };
 return {DB:adapter,PASSWORD_SALT:'test-salt',PASSWORD_HASH:pbkdf2Sync('sample-test-password','test-salt',100000,32,'sha256').toString('hex'),SESSION_SECRET:'test-session-secret'};
}
const origin='https://feiniao.example';
function req(path,method='GET',body,cookie,extra={}){return new Request(origin+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
async function login(env){const r=await worker.fetch(req('/api/login','POST',{password:'sample-test-password'}),env);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];}
test('password gate protects every data API and rejects cross-origin writes',async()=>{const env=setup();assert.equal((await worker.fetch(req('/api/vault'),env)).status,401);assert.equal((await worker.fetch(req('/api/shanghai'),env)).status,401);assert.equal((await worker.fetch(req('/api/shanghai/check','POST',{events:[]}),env)).status,401);assert.equal((await worker.fetch(req('/api/shanghai/check','POST',{},null,{origin:'https://evil.example'}),env)).status,403);assert.equal((await worker.fetch(req('/api/media/a'),env)).status,401);assert.equal((await worker.fetch(req('/api/login','POST',{password:'bad'}),env)).status,401);assert.equal((await worker.fetch(req('/api/login','POST',{password:'sample-test-password'},null,{origin:'https://evil.example'}),env)).status,403);const cookie=await login(env);assert.equal((await worker.fetch(req('/api/vault','GET',undefined,cookie),env)).status,200);assert.equal((await worker.fetch(req('/api/vault','GET',undefined,cookie+'forged'),env)).status,401);});
test('cloud record save and conflict protection preserve current data',async()=>{const env=setup(),cookie=await login(env),envelope={format:'feiniao-v1',iterations:600000,salt:'a'.repeat(24),iv:'b'.repeat(16),ciphertext:'private-encrypted-data'};let r=await worker.fetch(req('/api/vault','PUT',{revision:0,envelope},cookie),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{revision:1});r=await worker.fetch(req('/api/vault','PUT',{revision:0,envelope:{...envelope,ciphertext:'overwrite'}},cookie),env);assert.equal(r.status,409);r=await worker.fetch(req('/api/vault','GET',undefined,cookie),env);assert.equal((await r.json()).envelope.ciphertext,'private-encrypted-data');r=await worker.fetch(req('/api/vault','PUT',{revision:1,envelope},cookie),env);assert.equal(r.status,200);});
test('encrypted attachments round trip through the server and cannot be overwritten',async()=>{const env=setup(),cookie=await login(env),data={iv:'b'.repeat(16),ciphertext:'YWJj'.repeat(130000)};let r=await worker.fetch(req('/api/media/test-id','PUT',data,cookie),env);assert.equal(r.status,200);r=await worker.fetch(req('/api/media/test-id','GET',undefined,cookie),env);assert.deepEqual(await r.json(),{id:'test-id',...data});assert.equal((await worker.fetch(req('/api/media/test-id','PUT',data,cookie),env)).status,409);});
test('repeated wrong passwords are rate limited',async()=>{const env=setup();for(let i=0;i<8;i++)assert.equal((await worker.fetch(req('/api/login','POST',{password:'bad'}),env)).status,401);assert.equal((await worker.fetch(req('/api/login','POST',{password:'bad'}),env)).status,429);});
test('dictated account details and everyday ideas are sorted with original text',()=>{const raw='我在瑞幸小程序用微信登录，余额还有一百二十元。';const p=parseCapture(raw);assert.equal(p.kind,'account');assert.equal(p.title,'瑞幸');assert.equal(p.loginMethod,'微信');assert.equal(p.balance,'120元');assert.equal(p.raw,raw);assert.equal(parseCapture('今天走路的时候想到一段诗').kind,'info');assert.equal(parseCapture('我在星巴克小程序通过手机号登录，里面还有123.50元').balance,'123.50元');});
test('client no longer writes records into localStorage or IndexedDB',()=>{const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');assert.doesNotMatch(js,/localStorage\.|indexedDB\./);});
