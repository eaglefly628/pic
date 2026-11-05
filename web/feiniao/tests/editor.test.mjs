import {mount,until} from './ui-helpers.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {fromPlainText,renderDocument,validDocument,appearance} from '../src/rich-document.js';
import '../public/capture.js';

test('smart entry recognizes personal accounts without confusing a login-system design note',()=>{
 const account=parseCapture('我在瑞幸小程序用微信登录，余额还有一百二十元。');assert.equal(account.kind,'account');assert.equal(account.title,'瑞幸');assert.equal(account.balance,'120元');
 const development=parseCapture('设计一个游戏登录系统，研究玩家的账号流程和奖励机制');assert.equal(development.kind,'blog');assert.equal(development.domain,'game');
 assert.equal(parseCapture('这是诗歌：月色落在窗边，风翻过一页纸').domain,'poetry');
 assert.equal(parseCapture('今天散步的时候想到了一件事，先记下来').domain,'journal');
 assert.equal(parseCapture('证明这个不等式，然后推导概率公式').domain,'math');
 assert.equal(parseCapture('收藏资料 https://example.com/tutorial').kind,'info');
 assert.equal(parseCapture('窗外的风\n替我合上书\n把月光留在纸上').domain,'poetry');
 assert.equal(parseCapture('这一小段暂时还说不清').confidence,'待整理');
});
test('saved classifications help suggest similar future records',()=>{
 const previous=[{kind:'manuscript',domain:'poetry',title:'风与月光',body:'窗外的风替我合上书，把月光留在纸上'}];
 const result=parseCapture('窗外的风又替我合上书，把月光留在纸上',previous);assert.equal(result.domain,'poetry');assert.equal(result.confidence,'参考已有记录');
});
test('rich document renderer preserves formatting and rejects executable content',()=>{
 const doc=fromPlainText('第一行\n第二行\n\n下一段');doc.content[0].content[0].marks=[{type:'bold'},{type:'textStyle',attrs:{color:'#123456',fontSize:'24px'}}];
 const html=renderDocument(doc);assert.match(html,/<strong>第一行<\/strong>/);assert.match(html,/color:#123456/);assert.match(html,/<br>第二行/);assert.match(html,/<p>下一段/);
 const unsafe={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'<img src=x onerror=alert(1)>',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}},{type:'textStyle',attrs:{color:'red; background:url(x)',fontFamily:'bad'}}]}]}]};
 const escaped=renderDocument(unsafe);assert.doesNotMatch(escaped,/<img|href=|style=/);assert.match(escaped,/&lt;img/);
 assert.equal(validDocument({type:'doc',content:[{type:'script'}]}),false);assert.equal(appearance({background:'url(x)'}).background,'#ffffff');
});

test('unified add saves account fields, honors manual corrections and keeps original input on failure',async()=>{
 const ui=await mount();try{
  ui.click('#new-button');assert.equal(ui.$('#capture-dialog').open,true);ui.input('#capture-text','我在瑞幸小程序用微信登录，余额还有120元');assert.equal(ui.$('#capture-kind').value,'account');assert.equal(ui.$('#capture-login').value,'微信');
  ui.input('#capture-title','我的咖啡卡');ui.input('#capture-text','我在瑞幸小程序用微信登录，余额还有130元');assert.equal(ui.$('#capture-title').value,'我的咖啡卡');assert.equal(ui.$('#capture-balance').value,'130元');
  ui.failSave(true);ui.submit('#capture-form');await until(()=>ui.$('#capture-error').textContent.includes('模拟网络失败'));assert.equal(ui.$('#capture-dialog').open,true);assert.match(ui.$('#capture-text').value,/130元/);
  ui.failSave(false);ui.submit('#capture-form');await until(()=>!ui.$('#capture-dialog').open);const saved=(await ui.stored()).records.find(r=>r.title==='我的咖啡卡');assert.equal(saved.kind,'account');assert.equal(saved.balance,'130元');assert.equal(saved.sourceText,saved.body);
 }finally{ui.close();}
});
test('rich editing upgrades old plain text without losing it and round trips formatting through encrypted save',async()=>{
 const ui=await mount();try{
  ui.click('[data-open="old-poem"]');ui.click('#edit-record');assert.match(ui.$('#rich-editor').textContent,/第一行/);
  const ed=ui.$('.tiptap').editor;assert.ok(ed);ed.commands.selectAll();ui.click('[data-edit="bold"]');ui.change('#text-size','24px');ui.change('#page-background','#faf8f1');ui.submit('#editor-form');await until(()=>!ui.$('#editor-dialog').open);
  const saved=(await ui.stored()).records.find(r=>r.id==='old-poem');assert.equal(saved.body,'第一行\n第二行');assert.equal(saved.appearance.background,'#faf8f1');assert.match(renderDocument(saved.document),/<strong>/);assert.match(renderDocument(saved.document),/24px/);
  ui.click('[data-open="old-poem"]');assert.match(ui.$('.rich-prose').innerHTML,/<strong>/);ui.click('#edit-record');assert.match(ui.$('.tiptap').innerHTML,/<strong>/);
 }finally{ui.close();}
});
test('smart entry can route poetry into the rich editor before saving',async()=>{
 const ui=await mount();try{ui.click('#mobile-add');ui.input('#capture-text','一首诗：风与月光\n窗外的风\n替我合上书');assert.equal(ui.$('#capture-domain').value,'poetry');ui.click('#capture-compose');assert.equal(ui.$('#editor-dialog').open,true);assert.equal(ui.$('#record-domain').value,'poetry');assert.match(ui.$('.tiptap').textContent,/窗外的风/);ui.submit('#editor-form');await until(()=>!ui.$('#editor-dialog').open);const records=(await ui.stored()).records;assert.equal(records.length,2);assert.equal(records[0].domain,'poetry');assert.match(records[0].sourceText,/一首诗/);}finally{ui.close();}
});
test('multimedia uploads stay encrypted and their positions survive re-editing',async()=>{
 const ui=await mount();try{
  ui.click('[data-open="old-poem"]');ui.click('#edit-record');
  const bytes=new TextEncoder().encode('test-media-bytes'),file={name:'配图.png',type:'image/png',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
  Object.defineProperty(ui.$('#attachment'),'files',{value:[file],configurable:true});ui.$('#attachment').dispatchEvent(new ui.w.Event('change',{bubbles:true}));
  await until(()=>ui.$('.editor-cloud-media')&&!ui.$('#save-record').disabled);ui.submit('#editor-form');await until(()=>!ui.$('#editor-dialog').open);
  const saved=(await ui.stored()).records.find(r=>r.id==='old-poem');assert.equal(saved.media.length,1);assert.equal(saved.media[0].name,'配图.png');assert.ok(JSON.stringify(saved.document).includes('cloudMedia'));assert.doesNotMatch(JSON.stringify(saved.document),/blob:test|test-media-bytes/);
  ui.click('[data-open="old-poem"]');await until(()=>ui.$('.inline-cloud-media img'));ui.click('#edit-record');await until(()=>ui.$('.editor-cloud-media img'));
 }finally{ui.close();}
});
test('locking an unsaved rich draft restores formatting after password unlock',async()=>{
 const ui=await mount();try{
  ui.click('[data-open="old-poem"]');ui.click('#edit-record');const ed=ui.$('.tiptap').editor;ed.commands.selectAll();ui.click('[data-edit="bold"]');ui.change('#page-background','#f0f4fb');ui.click('#top-lock');await until(()=>ui.$('#app').hidden);
  assert.equal(ui.$('.tiptap').textContent,'');assert.equal(ui.$('#mobile-add').hidden,true);ui.input('#master','test-password');ui.submit('#unlock-form');await until(()=>!ui.$('#app').hidden&&ui.$('#editor-dialog').open);assert.match(ui.$('.tiptap').innerHTML,/<strong>/);assert.equal(ui.$('#page-background').value,'#f0f4fb');
 }finally{ui.close();}
});
