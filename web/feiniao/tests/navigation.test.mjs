import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,until} from './ui-helpers.mjs';

test('top shortcuts open the correct cloud panels, match sidebar selection, and return to the top',async()=>{
 const ui=await mount();try{
  const original=ui.w.fetch,calls=[];let scrolled=0;ui.w.scrollTo=({top})=>{assert.equal(top,0);scrolled++;};
  ui.w.fetch=async(path,options)=>{
   if(path.startsWith('/api/industry')){calls.push(path);return {ok:true,status:200,json:async()=>({items:[],sources:[],last:null,schedule:null})};}
   if(path==='/api/shanghai'){calls.push(path);return {ok:true,status:200,json:async()=>({items:[],sources:[],last_check:null,schedule:null})};}
   return original(path,options);
  };
  assert.equal(ui.$('#quick-navigation').closest('.workspace-header')!==null,true);
  assert.equal(ui.$('#quick-navigation [aria-current]'),null);
  for(const [view,panel,path] of [['industry','#industry-panel','/api/industry'],['aiIndustry','#ai-industry-panel','/api/industry?watch=ai'],['shanghai','#shanghai-panel','/api/shanghai']]){
   ui.click(`#quick-navigation [data-view="${view}"]`);await until(()=>calls.includes(path)&&ui.$(panel).children.length>0);
   assert.equal(ui.$(panel).hidden,false);assert.equal(ui.$(`#quick-navigation [data-view="${view}"]`).getAttribute('aria-current'),'page');
   assert.equal(ui.$(`#nav [data-view="${view}"]`).classList.contains('active'),true);
   assert.equal(ui.w.document.querySelectorAll('#quick-navigation [aria-current="page"]').length,1);
  }
  ui.click('#nav [data-view="overview"]');assert.equal(ui.$('#quick-navigation [aria-current]'),null);assert.equal(scrolled,4);
  assert.ok(ui.$('#nav [data-view="quant"]'),'Existing quantitative research navigation is preserved');
 }finally{ui.close();}
});

test('phone menu has visible text and closes on escape, backdrop, destination, resizing and locking',async()=>{
 const ui=await mount();try{
  Object.defineProperty(ui.w,'innerWidth',{configurable:true,value:375});ui.w.dispatchEvent(new ui.w.Event('resize'));
  assert.match(ui.$('#menu-button').textContent,/菜单/);assert.equal(ui.$('#menu-button').getAttribute('aria-controls'),'site-sidebar');
  assert.equal(ui.$('#site-sidebar').inert,true);assert.equal(ui.$('#menu-button').getAttribute('aria-expanded'),'false');assert.equal(ui.$('#nav-backdrop').hidden,true);
  const open=()=>{ui.click('#menu-button');assert.equal(ui.$('#menu-button').getAttribute('aria-expanded'),'true');assert.equal(ui.$('#nav-backdrop').hidden,false);assert.equal(ui.$('#site-sidebar').inert,false);assert.equal(ui.$('#site-sidebar').getAttribute('aria-hidden'),'false');};
  const closed=()=>{assert.equal(ui.$('#menu-button').getAttribute('aria-expanded'),'false');assert.equal(ui.$('#nav-backdrop').hidden,true);assert.equal(ui.w.document.body.classList.contains('navigation-open'),false);};
  open();assert.equal(ui.w.document.activeElement,ui.$('#sidebar-close'));ui.w.document.dispatchEvent(new ui.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));closed();assert.equal(ui.w.document.activeElement,ui.$('#menu-button'));
  open();ui.click('#nav-backdrop');closed();
  open();ui.click('#sidebar-close');closed();
  open();ui.click('#nav [data-view="poetry"]');closed();
  open();Object.defineProperty(ui.w,'innerWidth',{configurable:true,value:1440});ui.w.dispatchEvent(new ui.w.Event('resize'));closed();assert.equal(ui.$('#site-sidebar').inert,false);assert.equal(ui.$('#site-sidebar').getAttribute('aria-hidden'),'false');
  Object.defineProperty(ui.w,'innerWidth',{configurable:true,value:375});ui.w.dispatchEvent(new ui.w.Event('resize'));open();ui.click('#top-lock');await until(()=>ui.$('#app').hidden);closed();assert.equal(ui.$('#quick-navigation [aria-current]'),null);
 }finally{ui.close();}
});
