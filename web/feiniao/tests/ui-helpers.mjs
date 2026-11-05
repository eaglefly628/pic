import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
async function seal(records){const salt=webcrypto.getRandomValues(new Uint8Array(16)),iv=webcrypto.getRandomValues(new Uint8Array(12)),raw=await webcrypto.subtle.importKey('raw',new TextEncoder().encode('test-password'),'PBKDF2',false,['deriveKey']);const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({records})));return {format:'feiniao-v1',iterations:600000,salt:Buffer.from(salt).toString('base64'),iv:Buffer.from(iv).toString('base64'),ciphertext:Buffer.from(ciphertext).toString('base64')};}
async function unseal(envelope){const raw=await webcrypto.subtle.importKey('raw',new TextEncoder().encode('test-password'),'PBKDF2',false,['deriveKey']),key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt:Buffer.from(envelope.salt,'base64'),iterations:600000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64')},key,Buffer.from(envelope.ciphertext,'base64'))));}
const sleep=()=>new Promise(resolve=>setTimeout(resolve,20));
export async function until(predicate){for(let i=0;i<150;i++){if(predicate())return;await sleep();}throw Error('UI condition did not complete');}
const compiled=await build({entryPoints:['src/editor.js'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
export async function mount(){
 const dom=new JSDOM(await readFile('public/index.html','utf8'),{url:'https://feiniao.test/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.Blob=Blob;w.confirm=()=>true;w.prompt=()=>null;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.Range.prototype.getClientRects=()=>[];w.Range.prototype.getBoundingClientRect=()=>({left:0,top:0,right:0,bottom:0,width:0,height:0});w.HTMLElement.prototype.scrollIntoView=()=>{};w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 let envelope=await seal([{id:'old-poem',kind:'manuscript',domain:'poetry',title:'旧诗稿',body:'第一行\n第二行',tags:['诗歌'],status:'done',favorite:false,created:new Date().toISOString(),updated:new Date().toISOString()}]),revision=2,failSave=false;
 const assets=new Map();w.fetch=async(path,options={})=>{let data,status=200;if(path==='/api/login'||path==='/api/logout')data={ok:true};else if(path.startsWith('/api/media/')){const id=path.split('/').pop();if(options.method==='PUT'){assets.set(id,JSON.parse(options.body));data={ok:true};}else data={id,...assets.get(id)};}else if(path==='/api/vault'&&options.method==='PUT'){if(failSave){status=500;data={error:'模拟网络失败'};}else{const input=JSON.parse(options.body);assert.equal(input.revision,revision);envelope=input.envelope;data={revision:++revision};}}else if(path==='/api/vault')data={revision,envelope};else throw Error('Unexpected path '+path);return {ok:status<400,status,json:async()=>data};};
 w.eval(compiled.outputFiles[0].text);for(const file of ['capture.js','industry.js','shanghai.js','regression.js','quant.js','app.js'])w.eval(await readFile('public/'+file,'utf8'));
 const $=selector=>w.document.querySelector(selector),click=selector=>$(selector).click(),input=(selector,value)=>{$(selector).value=value;$(selector).dispatchEvent(new w.Event('input',{bubbles:true}));},change=(selector,value)=>{$(selector).value=value;$(selector).dispatchEvent(new w.Event('change',{bubbles:true}));},submit=selector=>$(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 input('#master','test-password');submit('#unlock-form');await until(()=>!$('#app').hidden);
 return {w,$,click,input,change,submit,stored:async()=>unseal(envelope),failSave:v=>{failSave=v;},close:()=>dom.window.close()};
}
