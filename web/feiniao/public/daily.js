globalThis.FeiniaoDaily = (() => {
 const defaultEnergy=25,defaultGoal=100,maxEnergy=10000,maxAmount=100000;
 const presets=[
  {name:'运动',items:[
   {name:'跑步或步行',kind:'count',target:5,unit:'公里'},
   {name:'健腹轮',kind:'count',target:100,unit:'个'}
  ]},
  {name:'阅读',items:[{name:'读书',kind:'time',target:30,unit:'分钟'}]},
  {name:'生活',items:[{name:'做一道菜',kind:'event',target:1,unit:''}]}
 ];
 const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 function today(now=new Date()){
  const parts=Object.fromEntries(calendar.formatToParts(now).map(({type,value})=>[type,value]));
  return [parts.year,parts.month,parts.day].join('-');
 }
 function validDay(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
   Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 }
 const validName=value=>typeof value==='string'&&value.trim().length>0&&value.length<=80;
 const validEnergy=value=>Number.isInteger(value)&&value>0&&value<=maxEnergy;
 const validAmount=value=>Number.isFinite(value)&&value>0&&value<=maxAmount;
 const validUnit=value=>typeof value==='string'&&value.length<=12;
 const validKind=value=>['event','time','count'].includes(value);
 function validate(data){
  if(data===undefined)return;
  const ids=new Set();
  function identity(value){
   if(!value||typeof value.id!=='string'||!/^[a-f0-9-]{36}$/.test(value.id)||ids.has(value.id)||!validName(value.name))return false;
   ids.add(value.id);return true;
  }
  function itemIsValid(item){
   return identity(item)&&validKind(item.kind)&&validAmount(item.target)&&validUnit(item.unit)&&validEnergy(item.energy)&&
    validDay(item.started)&&(item.ended==null||validDay(item.ended)&&item.ended>=item.started)&&
    Array.isArray(item.logs)&&item.logs.every(log=>log&&validDay(log.day)&&log.day>=item.started&&(!item.ended||log.day<=item.ended)&&
     validAmount(log.amount)&&(log.energy===0||validEnergy(log.energy)));
  }
  if(!data||typeof data.presetsAdded!=='boolean'||!Array.isArray(data.goals)||!data.goals.every(goal=>goal&&validDay(goal.day)&&validEnergy(goal.value))||
   !Array.isArray(data.lists)||data.lists.length>100||!data.lists.every(list=>identity(list)&&Array.isArray(list.items)&&list.items.length<=500&&list.items.every(itemIsValid))){
   throw Error('每日碎片的备份格式不正确');
  }
 }
 function create({panel,getData,save,esc}){
  const $=selector=>panel.querySelector(selector);
  const results=$('#daily-lists'),date=$('#daily-date'),feedback=$('#daily-feedback'),management=$('#daily-management');
  let selected='',current='',saveTurn=0;
  const data=()=>getData().daily;
  const initialize=()=>getData().daily??={lists:[],goals:[],presetsAdded:false};
  const activeOn=(item,day)=>item.started<=day&&(!item.ended||day<=item.ended);
  const activeItems=list=>list.items.filter(item=>activeOn(item,selected));
  const editable=()=>selected===current;
  const dayLog=item=>item.logs.find(log=>log.day===selected);
  const goalFor=day=>(data()?.goals||[]).reduce((latest,goal)=>goal.day<=day&&goal.day>=latest.day?goal:latest,{day:'',value:defaultGoal}).value;
  const entry=item=>({...item,id:crypto.randomUUID(),started:current,logs:[]});
  const listEntry=name=>({name,id:crypto.randomUUID(),items:[]});
  function findItem(id){
   return (data()?.lists||[]).flatMap(list=>list.items).find(item=>item.id===id);
  }
  function progress(){
   const items=(data()?.lists||[]).flatMap(activeItems),logs=items.map(dayLog);
   const earned=logs.reduce((sum,log)=>sum+(log?.energy||0),0),goal=goalFor(selected);
   const completed=logs.filter(log=>log?.energy>0).length;
   const ring=$('#daily-ring');
   ring.style.setProperty('--daily-fill',Math.min(100,earned/goal*100)+'%');
   ring.setAttribute('aria-label',`能量 ${earned} / ${goal} 点`);
   $('#daily-earned').textContent=earned;
   $('#daily-ring-goal').textContent='/ '+goal;
   $('#daily-count').textContent=`已完成 ${completed} / ${items.length} 项`;
   $('#daily-motivation').textContent=earned>=goal?'能量圆环已闭合':`距离目标还差 ${goal-earned} 点`;
  }
  function task(item,canEdit){
   const log=dayLog(item),completed=log?.energy>0,amount=log?.amount??0;
   const label=esc(item.name),unit=esc(item.unit);
   const status=item.kind==='event'?'':`<small>目标 ${item.target} ${unit}</small>`;
   const detail=`<span class="daily-task-name"><strong>${label}</strong>${status}<small class="daily-achieved">已达标</small></span><span class="daily-points">${canEdit?'+':''}${canEdit?item.energy:log?.energy||0} 点</span>`;
   const control=item.kind==='event'
    ?`<label class="daily-task"><input type="checkbox" data-daily-check="${item.id}" ${completed?'checked':''} ${canEdit?'':'disabled'}>${detail}</label>`
    :`<div class="daily-task">${detail}</div>${canEdit?`<form class="daily-amount" data-daily-amount="${item.id}"><input name="amount" aria-label="${label}的今日累计量（${unit}）" type="number" inputmode="decimal" min="0" max="${maxAmount}" step="0.01" value="${amount}" required><span>${unit}</span><button type="submit" class="secondary">记录</button></form>`:`<p>已记录 ${amount} ${unit}</p>`}`;
   const settings=canEdit&&!item.ended?`<details class="daily-item-settings"><summary>项目设置</summary><form class="daily-form" data-daily-energy="${item.id}"><label>达标能量 <input name="energy" type="number" min="1" max="${maxEnergy}" value="${item.energy}" required></label><button class="secondary">保存</button><button type="button" class="text-button" data-daily-retire="${item.id}">明日起停用</button></form></details>`:'';
   return `<li id="daily-item-${item.id}" class="${completed?'daily-completed':''}">${control}${settings}</li>`;
  }
  function render(){
   const lists=data()?.lists||[],canEdit=editable(),target=$('#daily-target'),lastTarget=target.value;
   date.value=selected;date.max=current;
   $('#daily-today').hidden=canEdit;
   management.hidden=!canEdit;
   $('#daily-presets').hidden=!canEdit||data()?.presetsAdded===true;
   target.innerHTML=lists.length?lists.map(list=>`<option value="${list.id}">${esc(list.name)}</option>`).join(''):'<option value="">日常（自动创建）</option>';
   if(lists.some(list=>list.id===lastTarget))target.value=lastTarget;
   $('#daily-goal').value=goalFor(selected);
   results.innerHTML=lists.map(list=>{
    const items=activeItems(list);
    if(!items.length&&!canEdit)return '';
    return `<section class="daily-card"><h2>${esc(list.name)}</h2>${items.length?`<ul>${items.map(item=>task(item,canEdit)).join('')}</ul>`:'<p>这张表还没有打卡项目。</p>'}</section>`;
   }).join('')||`<p class="daily-empty">${canEdit?'先添加自己的活动，或一键加入四项日常。':'这一天没有打卡项目。'}</p>`;
   progress();
  }
  async function persist(){
   const turn=++saveTurn;
   feedback.textContent='正在加密保存…';
   $('#daily-retry').hidden=true;
   try{
    await save();
    if(turn===saveTurn)feedback.textContent='已加密保存';
   }catch{
    if(turn===saveTurn){
     feedback.textContent='保存失败，改动仍在当前页面。';
     $('#daily-retry').hidden=false;
    }
   }
  }
  function changeDay(day){
   if(validDay(day)&&day<=current){selected=day;render();}
   else date.value=selected;
  }
  function record(item,amount){
   item.logs=item.logs.filter(log=>log.day!==current);
   if(amount>0)item.logs.push({day:current,amount,energy:amount>=item.target?item.energy:0});
   progress();persist();
  }
  date.onchange=()=>changeDay(date.value);
  $('#daily-today').onclick=()=>changeDay(current);
  $('#daily-retry').onclick=persist;
  $('#daily-presets').onclick=()=>{
   if(!editable()||data()?.presetsAdded)return;
   const daily=initialize();
   const missing=presets.filter(preset=>!daily.lists.some(list=>list.name===preset.name));
   if(daily.lists.length+missing.length>100||presets.some(preset=>{
    const list=daily.lists.find(list=>list.name===preset.name);
    return list&&list.items.length+preset.items.filter(item=>!list.items.some(saved=>saved.name===item.name&&!saved.ended)).length>500;
   })){feedback.textContent='日常表或项目已达上限，无法加入模板。';return;}
   for(const preset of presets){
    let list=daily.lists.find(list=>list.name===preset.name);
    if(!list){list=listEntry(preset.name);daily.lists.push(list);}
    for(const item of preset.items){
     if(!list.items.some(saved=>saved.name===item.name&&!saved.ended))list.items.push(entry({...item,energy:defaultEnergy}));
    }
   }
   daily.presetsAdded=true;render();persist();
  };
  $('#daily-list-form').onsubmit=event=>{
   event.preventDefault();
   const input=$('#daily-list-name'),name=input.value.trim();
   if(!editable()||!validName(name))return;
   const daily=initialize();
   if(daily.lists.length>=100){feedback.textContent='日常表已达到 100 张。';return;}
   if(daily.lists.some(list=>list.name===name)){feedback.textContent='已有同名日常表。';return;}
   const list=listEntry(name);
   daily.lists.push(list);
   input.value='';render();$('#daily-target').value=list.id;$('#daily-item-name').focus({preventScroll:true});persist();
  };
  const kindField=$('#daily-kind');
  function showKindFields(){
   const kind=kindField.value;
   $('#daily-quantity-fields').hidden=kind==='event';
   $('#daily-item-unit').hidden=kind!=='count';
   $('#daily-item-target-label').textContent=kind==='time'?'目标分钟数':'目标数量';
  }
  kindField.onchange=showKindFields;
  $('#daily-item-form').onsubmit=event=>{
   event.preventDefault();
   const name=$('#daily-item-name').value.trim(),kind=kindField.value;
   const target=kind==='event'?1:$('#daily-item-target').valueAsNumber;
   const unit=kind==='count'?$('#daily-item-unit').value.trim()||'次':kind==='time'?'分钟':'';
   const energy=$('#daily-item-energy').valueAsNumber;
   if(!editable()||!validName(name)||!validKind(kind)||!validAmount(target)||!validUnit(unit)||!validEnergy(energy)){
    feedback.textContent='请填写项目名称、有效的目标和能量值。';return;
   }
   const daily=initialize();
   if(!daily.lists.length)daily.lists.push(listEntry('日常'));
   const list=daily.lists.find(list=>list.id===$('#daily-target').value)||daily.lists[0];
   if(list.items.length>=500){feedback.textContent='这张表已达到 500 项。';return;}
   if(list.items.some(item=>item.name===name&&!item.ended)){feedback.textContent='这张表已有同名项目。';return;}
   list.items.push(entry({name,kind,target,unit,energy}));
   event.target.reset();showKindFields();render();$('#daily-target').value=list.id;$('#daily-item-name').focus({preventScroll:true});persist();
  };
  $('#daily-goal-form').onsubmit=event=>{
   event.preventDefault();
   const value=$('#daily-goal').valueAsNumber;
   if(!editable()||!validEnergy(value))return;
   const daily=initialize();
   daily.goals=daily.goals.filter(goal=>goal.day!==current);
   daily.goals.push({day:current,value});progress();persist();
  };
  results.addEventListener('change',event=>{
   if(!event.target.matches('[data-daily-check]'))return;
   const item=findItem(event.target.dataset.dailyCheck);
   if(editable()&&item&&activeOn(item,current)){
    record(item,Number(event.target.checked));
    event.target.closest('li').classList.toggle('daily-completed',event.target.checked);
   }
  });
  results.addEventListener('submit',event=>{
   const form=event.target,item=findItem(form.dataset.dailyAmount||form.dataset.dailyEnergy);
   if(!item)return;
   event.preventDefault();
   if(!editable()||!activeOn(item,current))return;
   if(form.dataset.dailyAmount){
    const amount=form.elements.amount.valueAsNumber;
    if(amount===0||validAmount(amount)){
     record(item,amount);
     form.closest('li').classList.toggle('daily-completed',amount>=item.target);
    }
   }else{
    const energy=form.elements.energy.valueAsNumber;
    if(!validEnergy(energy))return;
    item.energy=energy;
    const log=dayLog(item);
    if(log?.energy>0)log.energy=energy;
    form.closest('li').querySelector('.daily-points').textContent='+ '+energy+' 点';
    progress();persist();
   }
  });
  results.addEventListener('click',event=>{
   const button=event.target.closest('[data-daily-retire]');
   if(!button||!editable())return;
   const item=findItem(button.dataset.dailyRetire);
   if(!item||item.ended||!confirm('从明天起停止这个项目？已有打卡记录会保留。'))return;
   item.ended=current;render();persist();
  });
  return {
   show(){
    const now=today();
    if(!selected||selected===current)selected=now;
    current=now;panel.hidden=false;render();
   },
   manage(){
    if(!editable())changeDay(current);
    management.open=true;
    const input=$('#daily-item-name');
    input.scrollIntoView({block:'center'});
    input.focus({preventScroll:true});
   },
   hide(){panel.hidden=true;},
   clear(){
    panel.hidden=true;selected=current='';saveTurn++;
    management.open=false;
    for(const form of panel.querySelectorAll('form'))form.reset();
    showKindFields();
    $('#daily-target').replaceChildren();results.replaceChildren();feedback.textContent='';$('#daily-retry').hidden=true;
   },
   rollover(){if(!panel.hidden&&today()!==current)this.show();}
  };
 }
 return {create,validate};
})();
