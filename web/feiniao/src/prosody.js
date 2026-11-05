import forms from '../data/ci-forms.json' with {type:'json'};
import lexicon from '../data/ci-lexicon.json' with {type:'json'};
export {forms};
export function verseLines(text){return String(text||'').split(/[，。！？；、,\n!?;]+/).map(s=>s.trim().replace(/[\s“”‘’「」《》：:·…—]/g,'')).filter(Boolean);}
export function inspectCi(text,id='忆江南'){
 const form=forms.find(f=>f.id===id)||forms[0],lines=verseLines(text),rhymes=[];let wrong=0,pending=0;
 const rows=form.lines.map((expected,i)=>{
  const chars=[...(lines[i]||'')],cells=[...expected.pattern].map((tone,j)=>{const char=chars[j]||'',readings=lexicon[char]||[],tones=[...new Set(readings.map(r=>r[1]))];let state=!char||char==='□'?'empty':!readings.length?'unknown':tones.length>1?'ambiguous':tone==='中'||tones.includes(tone)?'ok':'wrong';if(state==='wrong')wrong++;if(['unknown','ambiguous','empty'].includes(state))pending++;return {char,expected:tone,readings,state};});
  const countOK=chars.length===expected.pattern.length;if(!countOK)wrong++;
  if(expected.rhyme&&chars.length){const char=chars.at(-1),readings=lexicon[char]||[];const expectedTone=[...expected.pattern].at(-1);rhymes.push({line:i+1,char,groups:[...new Set(readings.filter(r=>expectedTone==='中'||r[1]===expectedTone).map(r=>r[0]))]});}
  let repetition=null;if(id==='如梦令'&&i===5&&lines[i]&&lines[i-1]){repetition=lines[i]===lines[i-1];if(!repetition)wrong++;}
  return {line:i+1,text:lines[i]||'',cells,expected,count:chars.length,countOK,repetition};
 });
 const known=rhymes.filter(r=>r.groups.length);let common=known[0]?.groups||[];for(const r of known.slice(1))common=common.filter(g=>r.groups.includes(g));
 const rhymeStatus=rhymes.length<2?'pending':known.length!==rhymes.length?'pending':common.length?'possible':'conflict';if(rhymeStatus==='conflict')wrong++;
 const extra=Math.max(0,lines.length-form.lines.length);wrong+=extra;
 return {form,rows,extra,rhymes,common,rhymeStatus,wrong,pending,total:lines.reduce((n,s)=>n+[...s].filter(c=>c!=='□').length,0),expectedTotal:form.lines.reduce((n,l)=>n+l.pattern.length,0),status:wrong?'有需检查的位置':pending?'仍有待确认位置':'本谱基础检查未发现冲突'};
}
export function modernStats(text){const lines=String(text||'').split('\n'),nonempty=lines.filter(l=>l.trim());const stanzas=String(text||'').trim()?String(text).trim().split(/\n\s*\n/).filter(Boolean).length:0;return {characters:[...String(text||'').replace(/\s/g,'')].length,lines:nonempty.length,stanzas,longLines:nonempty.map((text,i)=>({line:i+1,length:[...text].length})).filter(l=>l.length>30)};}
