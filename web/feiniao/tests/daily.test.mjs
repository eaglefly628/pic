import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,until} from './ui-helpers.mjs';

test('daily projects track event, time and count progress and retain historical energy',async()=>{
 const ui=await mount();
 try{
  const RealDate=ui.w.Date;
  let now='2026-11-06T15:58:00Z';
  ui.w.Date=class extends RealDate{
   constructor(...args){super(...(args.length?args:[now]));}
   static now(){return RealDate.parse(now);}
  };
  ui.click('#quick-navigation [data-view="daily"]');
  assert.equal(ui.$('#daily-date').value,'2026-11-06');
  ui.click('#new-button');
  assert.equal(ui.$('#daily-management').open,true);
  ui.input('#daily-item-name','画一幅画');
  ui.input('#daily-item-energy','10');
  ui.submit('#daily-item-form');
  assert.match(ui.$('#daily-lists').textContent,/日常.*画一幅画/s);
  ui.click('#daily-presets');
  assert.match(ui.$('#daily-lists').textContent,/跑步或步行.*目标 5 公里/s);
  assert.match(ui.$('#daily-lists').textContent,/读书.*目标 30 分钟/s);
  assert.match(ui.$('#daily-lists').textContent,/健腹轮.*目标 100 个/s);
  assert.match(ui.$('#daily-lists').textContent,/做一道菜/);
  ui.click('[data-daily-check]');
  const read='[data-daily-amount]:has(input[aria-label^="读书"])';
  ui.input(read+' input','15');
  ui.submit(read);
  assert.equal(ui.$('#daily-earned').textContent,'10');
  ui.input(read+' input','30');
  ui.submit(read);
  assert.equal(ui.$('#daily-count').textContent,'已完成 2 / 5 项');
  assert.equal(ui.$('#daily-earned').textContent,'35');
  ui.input('#daily-goal','35');
  ui.submit('#daily-goal-form');
  assert.equal(ui.$('#daily-motivation').textContent,'能量圆环已闭合');
  await until(()=>ui.$('#daily-feedback').textContent==='已加密保存');
  const saved=await ui.stored();
  assert.deepEqual(saved.daily.lists[0].items[0].logs,[{day:'2026-11-06',amount:1,energy:10}]);
  assert.equal(saved.records.length,1);

  now='2026-11-06T16:01:00Z';
  ui.click('#nav [data-view="overview"]');
  ui.click('#quick-navigation [data-view="daily"]');
  assert.equal(ui.$('#daily-date').value,'2026-11-07');
  assert.equal(ui.$('#daily-earned').textContent,'0');
  assert.equal(ui.$('#daily-count').textContent,'已完成 0 / 5 项');
  ui.change('#daily-date','2026-11-06');
  assert.equal(ui.$('#daily-earned').textContent,'35');
  assert.equal(ui.$('[data-daily-check]').disabled,true);
  ui.click('#daily-today');
  ui.input('#daily-list-name','工作');
  ui.submit('#daily-list-form');
  ui.input('#daily-item-name','清理收件箱');
  ui.change('#daily-kind','count');
  ui.input('#daily-item-target','3');
  ui.input('#daily-item-unit','次');
  ui.submit('#daily-item-form');
  assert.equal(ui.$('#daily-count').textContent,'已完成 0 / 6 项');
  await until(()=>ui.$('#daily-feedback').textContent==='已加密保存');
  const added=(await ui.stored()).daily.lists.at(-1).items[0];
  assert.equal(added.kind,'count');
  assert.equal(added.target,3);
 }finally{ui.close();}
});
