(function(root){
 function number(text){
  const plain=text.replace(/[,，]/g,'').replace(/块钱|块/g,'元').replace(/两/g,'二');
  if(/^\d+(\.\d+)?$/.test(plain))return plain;
  const digits={'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
  let result=0,section=0,n=0;
  const [integer,decimal]=plain.split(/[点.]/);
  if(!/[十百千万]/.test(integer)){const v=[...integer].map(x=>digits[x]??x).join('');return /^\d+$/.test(v)?v+(decimal?'.'+[...decimal].map(x=>digits[x]??x).join(''):''):text;}
  for(const c of integer){if(c in digits)n=digits[c];else if(c==='万'){result+=(section+n)*10000;section=0;n=0;}else if('十百千'.includes(c)){section+=(n||1)*({十:10,百:100,千:1000}[c]);n=0;}else return text;}
  return String(result+section+n)+(decimal?'.'+[...decimal].map(x=>digits[x]??x).join(''):'');
 }
 const labels={game:'游戏开发',math:'数学',poetry:'诗歌',journal:'日常笔记',general:'随手记'};
 const cues={game:[/游戏开发|游戏设计|玩法|关卡|数值设计|原型|机制设计|Unity|Unreal|Godot|策划|战斗系统|游戏引擎|代码|程序开发/gi,/玩家|游戏机制|技能系统|奖励系统|游戏系统/gi],math:[/数学|定理|证明|微积分|线性代数|矩阵|概率|方程|几何|推导|积分|导数|函数|求和|不等式|勾股/gi,/[∑∫√]|\b[xy]\s*[²³^=]/g],poetry:[/诗歌|诗稿|一首诗|写首诗|现代诗|诗句|诗词|听风|作诗/gi,/诗意|押韵|意象/gi],journal:[/今天|昨天|日记|随手记|散步|心情|日常|随笔|读书|生活|感想|笔记/gi]};
 function grams(text){const chars=text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const out=new Set();for(let i=0;i<chars.length-1;i++)out.add(chars.slice(i,i+2));return out;}
 function learned(text,records){const input=grams(text);let best=null;for(const r of records||[]){if(r.example||r.kind==='account'||typeof r.body!=='string')continue;const terms=grams((r.title+' '+r.body).slice(0,6000));let overlap=0;for(const g of input)if(terms.has(g))overlap++;const score=overlap/Math.sqrt(input.size*terms.size||1);if(overlap>=4&&score>0.27&&(!best||score>best.score))best={kind:r.kind,domain:Object.hasOwn(labels,r.domain)?r.domain:'general',score};}return best;}
 function parseCapture(raw,records=[]){
  const text=String(raw||'').trim(),scores=Object.fromEntries(Object.keys(labels).map(k=>[k,0]));
  for(const [key,patterns] of Object.entries(cues))for(const pattern of patterns)scores[key]+=(text.match(pattern)||[]).length*(key==='journal'?2:4);
  const creativeDesign=/(设计|开发|实现|研究|讨论|优化|分析).{0,12}(登录|登陆|账号|账户)|(登录|登陆|账号|账户).{0,12}(设计|开发|流程|系统|机制)/.test(text);
  const credential=/(?:用|通过|使用)[^，。；\n]{1,30}(?:登录|登陆)|(?:账号|账户|密码|用户名|手机号|邮箱)(?:是|为|：|:)|(?:微信|手机号|支付宝|Apple|邮箱|QQ|Google)(?:一键)?(?:登录|登陆)|我的.{0,15}(?:账号|账户)|余额|储值|还剩[^，。；]{0,10}(?:元|块|积分)/.test(text);
  let account=credential&&!creativeDesign,domain='general',kind='info',reason='内容暂不明确，先完整放进随手记。',confidence='待整理';
  const explicit=text.match(/(?:归(?:到|入|类为)|分类(?:为|到)|存(?:为|到)|这(?:是|是一篇|是一首))(账号|账户|诗歌|诗稿|日记|随笔|数学|游戏开发|资料|信息|博客|手稿)/);
  if(explicit){const route={账号:['account','general'],账户:['account','general'],诗歌:['manuscript','poetry'],诗稿:['manuscript','poetry'],日记:['blog','journal'],随笔:['blog','journal'],数学:['blog','math'],游戏开发:['blog','game'],资料:['info','general'],信息:['info','general'],博客:['blog','general'],手稿:['manuscript','general']}[explicit[1]];[kind,domain]=route;account=kind==='account';reason='按你在原文中指定的分类整理。';confidence='明确';}
  else if(account){kind='account';reason='识别到实际的登录、账号或余额信息。';confidence='明确';}
  else{
   const lines=text.split('\n').map(x=>x.trim()).filter(Boolean),poetic=lines.length>=3&&lines.every(x=>x.length<45)&&!/(https?:|^[-*\d][.)、]|证明|步骤|清单|待办)/m.test(text);
   if(poetic)scores.poetry+=7;
   const ranked=Object.entries(scores).filter(([k])=>k!=='general').sort((a,b)=>b[1]-a[1]);
   const top=ranked[0];if(top&&top[1]>=4){domain=top[0];kind=domain==='poetry'?'manuscript':domain==='journal'&&text.length<180?'info':'blog';reason=domain==='poetry'&&poetic?'识别到分行短句，建议放进听风。':'根据'+labels[domain]+'相关表达建议分类。';confidence=top[1]>=8?'较明确':'建议';}
   else if(/https?:\/\/|资料|教程|收藏|参考链接|书单|网址/.test(text)){kind='info';reason='识别到资料或链接，建议收藏到信息。';confidence='建议';}
   else if(/草稿|手稿|未完成|写作计划/.test(text)){kind='manuscript';reason='识别到创作草稿，建议保存为手稿。';confidence='建议';}
   else {const prior=learned(text,records);if(prior){kind=prior.kind;domain=prior.domain;reason='与已有记录相近，参考你之前的分类。';confidence='参考已有记录';}}
  }
  let title='';
  if(account){const named=text.match(/(?:小程序|平台|应用|账户|账号)(?:名(?:称)?|叫|是|：|:)\s*[「“"《]?([^，。；\n「」“”"《》]{1,30})/),before=text.match(/(?:我(?:在|用|的)?|今天(?:在|用)?|刚(?:在|用)?|记录一下|记一下)?\s*([^，。；\n]{1,25}?)(?:这个|的)?小程序/);if(named)title=named[1].trim();else if(before)title=before[1].replace(/^(我(?:在|用|的)?|今天(?:在|用)?|刚(?:在|用)?|记录一下|记一下)\s*/,'').trim();if(!title){const p=text.match(/(?:我在|平台是|平台：|平台:|应用是)([^，。；\n]{1,25}?)(?:用|通过|，|。|登录|登陆)/);if(p)title=p[1].trim();}}
  const namedTitle=text.match(/(?:标题|题目|名为)(?:是|叫|：|:)?\s*[《「“]?([^》」”\n，。]{1,60})/);if(namedTitle)title=namedTitle[1].trim();
  if(!title&&/^《[^》]+》/.test(text))title=text.match(/^《([^》]+)》/)[1];
  const login=text.match(/(?:用|通过|使用)\s*([^，。；\n]{1,30}?)(?:来)?(?:登录|登陆)/)||text.match(/(?:登录|登陆)(?:方式)?(?:是|为|：|:)\s*([^，。；\n]{1,30})/)||text.match(/(微信|手机号|支付宝|Apple|邮箱|QQ|Google)(?:一键)?(?:登录|登陆)/);
  let balance='';const amount=text.match(/(?:余额(?:还)?(?:有|是|为|：|:)?|还(?:剩|有)|剩余(?:余额)?(?:是|为|有)?|里面(?:还)?有)\s*(?:人民币)?\s*([\d,.零〇一二两三四五六七八九十百千万点]+)\s*(元|块钱|块|人民币|美元|港币|积分|点|次)?/);if(amount)balance=number(amount[1])+(amount[2]||'元');
  const user=text.match(/(?:手机号|用户名|邮箱|账号)(?:是|为|：|:)\s*([^，。；\n]{1,80})/),password=text.match(/密码(?:是|为|：|:)\s*([^，。；\s]{1,100})/);
  const tags=['随手记',...(domain!=='general'?[labels[domain]]:[]),...(confidence==='待整理'?['待整理']:[])];
  return {kind,domain,title:title||text.split(/[，。\n]/)[0].replace(/^(帮我|请)?(记录一下|记一下)[，：: ]*/,'').slice(0,60)||'未命名记录',loginMethod:account?login?.[1]?.trim()||'':'',balance:account?balance:'',username:account?user?.[1]?.trim()||'':'',password:account?password?.[1]?.trim()||'':'',url:text.match(/https?:\/\/[^\s，。；）)]+/)?.[0]||'',raw:text,tags,reason,confidence};
 }
 root.parseCapture=parseCapture;
})(globalThis);
