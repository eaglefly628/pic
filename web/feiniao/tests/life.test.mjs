import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {mount,until} from './ui-helpers.mjs';
const context=vm.createContext({});vm.runInContext(await readFile('public/life.js','utf8'),context);const life=context.FeiniaoLife;
test('countdown follows Beijing midnight, leap days and ends at zero',()=>{
 assert.equal(life.today(new Date('2026-11-19T15:59:59Z')),'2026-11-19');assert.equal(life.today(new Date('2026-11-19T16:00:00Z')),'2026-11-20');
 assert.equal(life.progress('2024-02-28','2024-03-01').remaining,9998);assert.equal(life.progress('2026-11-19','2026-11-19').remaining,10000);
 assert.equal(life.progress('1990-01-01','2026-11-19').remaining,0);assert.equal(life.progress('1990-01-01','2026-11-19').percent,100);
 assert.throws(()=>life.validate({start:'2026-02-30'}));assert.throws(()=>life.validate({start:'invalid'}));assert.doesNotThrow(()=>life.validate(undefined));
});
test('homepage countdown is opt-in and persists through encrypted vault and navigation',async()=>{
 const ui=await mount();try{
  assert.equal(ui.$('#life-countdown').hidden,false);assert.equal((await ui.stored()).lifeCountdown,undefined);
  ui.click('#life-start-today');await until(()=>ui.$('#life-status').textContent==='已加密保存');
  assert.equal((await ui.stored()).lifeCountdown.start,ui.w.FeiniaoLife.today());assert.equal(ui.$('#life-remaining').textContent,'10,000');
  ui.click('[data-view="daily"]');assert.equal(ui.$('#life-countdown').hidden,true);ui.click('[data-view="overview"]');assert.equal(ui.$('#life-countdown').hidden,false);
  ui.$('#life-start').value='2024-02-28';ui.submit('#life-form');await until(()=>ui.$('#life-status').textContent==='已加密保存');assert.equal((await ui.stored()).lifeCountdown.start,'2024-02-28');
  ui.click('#lock-button');await until(()=>ui.$('#app').hidden);assert.equal(ui.$('#life-countdown').innerHTML,'');
 }finally{ui.close();}
});
test('failed countdown save can be retried and future start dates rejected',async()=>{
 const ui=await mount();try{
  ui.failSave(true);ui.click('#life-start-today');await until(()=>ui.$('#life-status').textContent.includes('失败'));assert.equal((await ui.stored()).lifeCountdown,undefined);
  ui.failSave(false);ui.click('#life-start-today');await until(()=>ui.$('#life-status').textContent==='已加密保存');
  const start=(await ui.stored()).lifeCountdown.start;ui.$('#life-start').value='2999-01-01';ui.submit('#life-form');assert.match(ui.$('#life-status').textContent,/今天或之前/);assert.equal((await ui.stored()).lifeCountdown.start,start);
 }finally{ui.close();}
});
