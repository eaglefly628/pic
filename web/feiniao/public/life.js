(()=>{
'use strict';
const TOTAL=10000,DAY=86400000;
const today=(now=new Date())=>new Date(+now+8*3600000).toISOString().slice(0,10);
function dayNumber(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp/DAY:NaN;}
function validate(value){if(value==null)return;if(!value||typeof value!=='object'||!Number.isFinite(dayNumber(value.start)))throw Error('人生倒计时日期格式不正确');}
function progress(start,day=today()){validate({start});const elapsed=Math.max(0,dayNumber(day)-dayNumber(start));return {elapsed,remaining:Math.max(0,TOTAL-elapsed),percent:Math.min(100,elapsed/TOTAL*100),end:new Date((dayNumber(start)+TOTAL)*DAY).toISOString().slice(0,10)};}
function create({panel,getData,save,now=()=>new Date()}){
 let shown=false,lastDay='',pending=false,unsaved=false;
 const $=s=>panel.querySelector(s);
 function render(){
  const data=getData();if(!shown||!data)return;
  lastDay=today(now());const start=data.lifeCountdown?.start||'2026-11-19',p=progress(start,lastDay);
  panel.innerHTML=`<div class="life-copy"><span class="life-kicker">把日子，过成喜欢的样子</span><h2 id="life-title">人生 10000 天</h2><p>${p?'已走过 '+p.elapsed.toLocaleString('en-US')+' 天 · 每一天都值得认真度过':'选一个起点，留住每天的一点光。'}</p></div><div class="life-count"><span>${p?'还剩':'留给未来'}</span><div><strong id="life-remaining">${(p?.remaining??TOTAL).toLocaleString('en-US')}</strong><span>天</span></div>${p?`<div class="life-track" role="progressbar" aria-label="已走过的 10000 天进度" aria-valuemin="0" aria-valuemax="10000" aria-valuenow="${Math.min(TOTAL,p.elapsed)}"><i style="width:${p.percent}%"></i></div>`:''}</div><div class="life-settings">${p?`<p>${start.replaceAll('-','.')} 起<br>${p.remaining?'至 '+p.end.replaceAll('-','.'):'这 10000 天，已走完。'}</p>`:'<button class="secondary" type="button" id="life-start-today">从今天开始</button>'}<details id="life-options"><summary>${p?'调整起算日':'选择起算日'}</summary><form id="life-form"><label for="life-start">起算日期</label><input type="date" id="life-start" required min="0001-01-01" max="${lastDay}" value="${start||lastDay}"><small>可选生日或想纪念的一天。按北京时间，每过一天减少一天。</small><button class="secondary" type="button" id="life-start-today">从今天开始</button><button class="primary" type="submit">${unsaved?'重试保存':'保存起算日'}</button></form></details><p id="life-status" role="status">${unsaved?'保存未完成，请重试。':''}</p></div>`;
 }
 async function update(start){
  if(pending||!getData())return;
  if(!Number.isFinite(dayNumber(start))||start>today(now())||start<'0001-01-01'){$('#life-status').textContent='请选择今天或之前的有效日期。';return;}
  getData().lifeCountdown={start};pending=true;unsaved=true;
  panel.querySelectorAll('button').forEach(b=>b.disabled=true);$('#life-status').textContent='正在加密保存…';
  try{await save();unsaved=false;render();if(shown)$('#life-status').textContent='已加密保存';}
  catch{if(shown){$('#life-status').textContent='保存失败，请重试。';panel.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  finally{pending=false;}
 }
 panel.addEventListener('click',e=>{if(e.target.closest('#life-start-today'))update(today(now()));});
 panel.addEventListener('submit',e=>{if(e.target.id==='life-form'){e.preventDefault();update($('#life-start').value);}});
 return {show(){shown=true;panel.hidden=false;render();},hide(){shown=false;panel.hidden=true;},clear(){shown=false;panel.hidden=true;panel.innerHTML='';unsaved=false;},rollover(){if(shown&&!pending&&lastDay!==today(now())&&!$('#life-options')?.open)render();}};
}
globalThis.FeiniaoLife={today,validate,progress,create};
})();
