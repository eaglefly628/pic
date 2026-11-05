export const fonts={system:'system-ui, sans-serif',serif:'Georgia, "Noto Serif SC", "Songti SC", serif',sans:'"PingFang SC", "Microsoft YaHei", sans-serif',mono:'ui-monospace, monospace'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:null;
export const safeLink=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
export function fromPlainText(text=''){
 return {type:'doc',content:String(text).split(/\n\n/).map(block=>({type:'paragraph',content:block.split('\n').flatMap((line,i)=>[...(i?[{type:'hardBreak'}]:[]),...(line?[{type:'text',text:line}]:[])])}))};
}
export function validDocument(doc){
 let count=0;const nodes=new Set(['doc','paragraph','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','horizontalRule','text','hardBreak','cloudMedia']);
 function walk(n,depth){if(!n||typeof n!=='object'||++count>15000||depth>30||!nodes.has(n.type))return false;if(n.type==='text'&&typeof n.text!=='string')return false;if(n.content&&(!Array.isArray(n.content)||!n.content.every(x=>walk(x,depth+1))))return false;if(n.marks&&(!Array.isArray(n.marks)||n.marks.length>12||n.marks.some(m=>!m||typeof m.type!=='string')))return false;if(n.type==='cloudMedia'&&(!/^[\w-]{1,100}$/.test(n.attrs?.id||'')||!['image','audio','video'].includes((n.attrs?.mime||'').split('/')[0])))return false;return true;}
 return doc?.type==='doc'&&walk(doc,0);
}
export function renderDocument(doc){
 if(!validDocument(doc))return '';
 function render(n){
  const a=n.attrs||{},children=(n.content||[]).map(render).join('');
  if(n.type==='text'){
   let text=escape(n.text);
   for(const m of n.marks||[]){const attrs=m.attrs||{};const tags={bold:'strong',italic:'em',underline:'u',strike:'s',code:'code'};if(tags[m.type])text=`<${tags[m.type]}>${text}</${tags[m.type]}>`;else if(m.type==='link'){const href=safeLink(attrs.href);if(href)text=`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;}else if(m.type==='highlight'&&color(attrs.color))text=`<mark style="background-color:${color(attrs.color)}">${text}</mark>`;else if(m.type==='textStyle'){const style=[];if(color(attrs.color))style.push('color:'+color(attrs.color));if(Object.values(fonts).includes(attrs.fontFamily))style.push('font-family:'+attrs.fontFamily);if(['14px','16px','18px','20px','24px','32px'].includes(attrs.fontSize))style.push('font-size:'+attrs.fontSize);if(style.length)text=`<span style="${escape(style.join(';'))}">${text}</span>`;}}
   return text;
  }
  const align=['left','center','right','justify'].includes(a.textAlign)?` style="text-align:${a.textAlign}"`:'';
  switch(n.type){case'doc':return children;case'paragraph':return `<p${align}>${children||'<br>'}</p>`;case'heading':{const level=[1,2,3].includes(a.level)?a.level:2;return `<h${level}${align}>${children||'<br>'}</h${level}>`;}
   case'bulletList':return `<ul>${children}</ul>`;case'orderedList':return `<ol>${children}</ol>`;case'listItem':return `<li>${children}</li>`;case'taskList':return `<ul class="task-list">${children}</ul>`;case'taskItem':return `<li class="task-item"><span aria-label="${a.checked?'已完成':'未完成'}">${a.checked?'☑':'☐'}</span><div>${children}</div></li>`;case'blockquote':return `<blockquote>${children}</blockquote>`;case'codeBlock':return `<pre><code>${children}</code></pre>`;case'horizontalRule':return '<hr>';case'hardBreak':return '<br>';case'cloudMedia':return `<figure class="inline-cloud-media" data-cloud-media="${escape(a.id)}"><span>正在读取加密附件…</span></figure>`;default:return children;
  }
 }
 return render(doc);
}
export function appearance(value){return {background:['#ffffff','#faf8f1','#f1f6ef','#f0f4fb','#fbf0f3'].includes(value?.background)?value.background:'#ffffff',font:Object.hasOwn(fonts,value?.font)?value.font:'serif'};}
