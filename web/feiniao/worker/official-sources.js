// Only public, first-party Chinese/US sources. Page access is not counted as parsing success.
export const NBS_INDEX='https://www.stats.gov.cn/sj/zxfb/';
export const PBC_INDEX='https://www.pbc.gov.cn/diaochatongjisi/116219/index.html';
export const H10_URL='https://www.federalreserve.gov/releases/h10/current/';
export const H10_HISTORY='https://www.federalreserve.gov/releases/h10/hist/dat00_ch.htm';
export const SGE_URL='https://www.sge.com.cn/sjzx/quotation_daily_new';
const text=html=>html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function officialLinks(html,base){const host=new URL(base).hostname;const links=[];for(const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const url=new URL(m[1],base);if(url.protocol==='https:'&&url.hostname===host)links.push({url:url.href,title:text(m[2])});}catch{}}return links.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i);}
function month(title,body){const a=title.match(/(20\d{2})年(?:1[—－-])?(\d{1,2})月/);if(a)return `${a[1]}-${a[2].padStart(2,'0')}-01`;const year=title.match(/(20\d{2})年/),m=body.match(/(\d{1,2})月末/);if(year&&m)return `${year[1]}-${m[1].padStart(2,'0')}-01`;throw Error('未能核实统计月份');}
function publication(body){const m=body.match(/(20\d{2})[-/](\d{2})[-/](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);return m?`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}+08:00`:null;}
function signed(body,pattern){const m=body.match(pattern);if(!m)throw Error('页面可访问，但指标字段未匹配');const v=Number(m[2]);if(!Number.isFinite(v))throw Error('指标不是有效数字');return /下降|减少/.test(m[1])?-v:v;}
function row(id,period,value,source,published){return {series_id:id,source_url:source,observations:[{period,value,...(published?{published_at:published}:{}),vintage_verified:false}]};}
export const nbsGroups=[
 {kind:'pmi',title:/中国采购经理指数运行情况/,ids:['cn_pmi','cn_services']},
 {kind:'ip',title:/月份规模以上工业增加值/,ids:['cn_ip']},
 {kind:'retail',title:/社会消费品零售总额/,ids:['cn_retail']},
 {kind:'invest',title:/全国固定资产投资/,ids:['cn_invest']},
 {kind:'housing',title:/全国房地产市场基本情况/,ids:['cn_housing']},
 {kind:'profit',title:/全国规模以上工业企业利润/,ids:['cn_profit']},
 {kind:'prices',title:/解读.*CPI和PPI数据/,ids:['cn_corecpi','cn_ppi']}
];
export function parseNbs(kind,html,title,url){const body=text(html).replace(/\s/g,''),period=month(title,text(html)),published=publication(text(html));
 const values={};
 if(kind==='pmi'){for(const [id,p] of [['cn_pmi',/制造业采购经理指数[（(]PMI[）)]为([\d.]+)%/],['cn_services',/非制造业商务活动指数为([\d.]+)%/]]){const m=body.match(p);if(!m)throw Error('PMI字段缺失');values[id]=Number(m[1]);}}
 if(kind==='ip')values.cn_ip=signed(body,/规模以上工业增加值同比(?:实际)?(增长|下降)([\d.]+)%/);
 if(kind==='retail'){const m=Number(period.slice(5,7));values.cn_retail=signed(body,new RegExp(`(?<![\\d—－-])${m}月份[，,]社会消费品零售总额[\\d.]+亿元，同比(增长|下降)([\\d.]+)%`));}
 if(kind==='invest')values.cn_invest=signed(body,/制造业投资(增长|下降)([\d.]+)%/);
 if(kind==='housing')values.cn_housing=signed(body,/(?:新建)?商品房销售面积[\d.]+万平方米，同比(增长|下降)([\d.]+)%/);
 if(kind==='profit')values.cn_profit=signed(body,/(?:全国)?规模以上工业企业实现利润总额[\d.]+亿元，同比(增长|下降)([\d.]+)%/);
 if(kind==='prices'){values.cn_corecpi=signed(body,/核心CPI同比(上涨|下降)([\d.]+)%/);values.cn_ppi=signed(body,/(?:工业生产者出厂价格指数[（(]PPI[）)]|PPI)[^。]{0,60}?同比(上涨|下降)([\d.]+)%/);}
 return Object.entries(values).map(([id,value])=>row(id,period,value,url,published));
}
export function parsePbc(html,title,url){const body=text(html).replace(/\s/g,''),period=month(title,text(html)),published=publication(text(html));return [
 row('cn_tsf',period,signed(body,/社会融资规模存量为[\d.]+万亿元，同比(增长|下降)([\d.]+)%/),url,published),
 row('cn_m1',period,signed(body,/狭义货币[（(]M1[）)]余额[\d.]+万亿元，同比(增长|下降)([\d.]+)%/),url,published),
 row('cn_m2',period,signed(body,/广义货币[（(]M2[）)]余额[\d.]+万亿元，同比(增长|下降)([\d.]+)%/),url,published)
 ];}
export function parseSge(html,url){const rows=[];let closeColumn=-1;for(const tr of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...tr[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(x=>text(x[1]));if(cells.includes('收盘价'))closeColumn=cells.indexOf('收盘价');if(cells[1]!=='Au99.99')continue;if(closeColumn<0)throw Error('黄金收盘价表头未匹配');const value=Number(cells[closeColumn].replace(/,/g,''));if(/^\d{4}-\d{2}-\d{2}$/.test(cells[0])&&value>0&&Number.isFinite(value))rows.push({period:cells[0],value,vintage_verified:false});}if(!rows.length)throw Error('没有解析到Au99.99收盘价；不以iAu或其他合约替代');return [{series_id:'gold',source_url:url,observations:rows.slice(0,1000)}];}
export function parseH10History(html,url=H10_HISTORY){const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],observations=[];for(const tr of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...tr[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(x=>text(x[1]));const m=cells[0]?.match(/^(\d{1,2})-([A-Z]{3})-(\d{2}|\d{4})$/),value=Number(cells[1]);if(!m||!Number.isFinite(value)||value<=0)continue;const month=months.indexOf(m[2])+1;if(!month)continue;const year=m[3].length===4?Number(m[3]):2000+Number(m[3]);observations.push({period:`${year}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`,value,vintage_verified:false});}if(!observations.length)throw Error('H10人民币历史表未解析出数据');return [{series_id:'cn_fx',source_url:url,observations:observations.slice(-600)}];}
export function parseH10(html,url=H10_URL){const body=text(html),release=body.match(/Release Date:\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(20\d{2})/);if(!release)throw Error('H10发布日期缺失');const releaseDate=new Date(`${release[1]} ${release[2]}, ${release[3]} 23:59:59 GMT-0500`);const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];let dates=[];const result=[];
 for(const tr of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...tr[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(x=>text(x[1]));if(cells.some(c=>c==='COUNTRY')){dates=cells.slice(2).map(c=>{const m=c.match(/([A-Za-z]{3})\.?\s*(\d{1,2})/);if(!m)throw Error('H10日期表头错误');const month=months.indexOf(m[1]);let year=Number(release[3]);if(month>releaseDate.getUTCMonth()+1)year--;return `${year}-${String(month+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;});}if(cells[0]?.includes('CHINA')&&dates.length){const observations=cells.slice(2).map((v,i)=>({period:dates[i],value:Number(v.replace(/,/g,'')),vintage_verified:false})).filter(r=>r.period&&r.value>0&&Number.isFinite(r.value));if(observations.length)result.push({series_id:'cn_fx',source_url:url,observations});}}
 if(!result.length)throw Error('H10人民币字段缺失');return result;
}
export async function collectOfficial(read,emit,selectedIds=null){const checks=[],wanted=id=>!selectedIds||selectedIds.has(id),groups=nbsGroups.filter(g=>g.ids.some(wanted));const save=async a=>{if(!wanted(a.series_id))return;try{const r=await emit(a);checks.push({id:a.series_id,ok:true,parsed:a.observations.length,source_url:a.source_url,...r});}catch(e){checks.push({id:a.series_id,ok:false,error:e.message});}};
 const nbs=!groups.length?Promise.resolve():(async()=>{
  const found=new Map(),errors=new Map(),bases=[{base:NBS_INDEX,groups:groups.filter(g=>g.kind!=='prices')},{base:'https://www.stats.gov.cn/sj/sjjd/',groups:groups.filter(g=>g.kind==='prices')}];
  for(const source of bases){if(!source.groups.length)continue;for(let i=0;i<3;i++){const url=i?source.base+`index_${i}.html`:source.base;try{const html=await read(url);for(const group of source.groups){if(found.has(group.kind))continue;const link=officialLinks(html,url).find(l=>group.title.test(l.title));if(link)found.set(group.kind,link);}if(source.groups.every(g=>found.has(g.kind)))break;}catch(e){for(const group of source.groups)if(!found.has(group.kind))errors.set(group.kind,e.message);break;}}}
  for(let i=0;i<groups.length;i+=3)await Promise.all(groups.slice(i,i+3).map(async group=>{const link=found.get(group.kind);if(!link){for(const id of group.ids)checks.push({id,ok:false,error:errors.get(group.kind)||'官网目录中未找到该指标最新原始发布'});return;}try{for(const a of parseNbs(group.kind,await read(link.url),link.title,link.url))await save(a);}catch(e){for(const id of group.ids)checks.push({id,ok:false,error:e.message,source_url:link.url});}}));
 })();
 const pbc=!['cn_tsf','cn_m1','cn_m2'].some(wanted)?Promise.resolve():(async()=>{try{const html=await read(PBC_INDEX),link=officialLinks(html,PBC_INDEX).find(l=>/金融统计数据报告/.test(l.title));if(!link)throw Error('央行目录未发现金融统计数据报告');for(const a of parsePbc(await read(link.url),link.title,link.url))await save(a);}catch(e){for(const id of ['cn_tsf','cn_m1','cn_m2'])checks.push({id,ok:false,error:e.message,source_url:PBC_INDEX});}})();
 const sge=!wanted('gold')?Promise.resolve():(async()=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Hong_Kong'}),end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);const start=new Date(end);start.setUTCDate(start.getUTCDate()-20);const url=SGE_URL+`?start_date=${start.toISOString().slice(0,10)}&end_date=${end.toISOString().slice(0,10)}`;try{for(const a of parseSge(await read(url),url))await save(a);}catch(e){checks.push({id:'gold',ok:false,error:e.message,source_url:url});}})();
 const fx=!wanted('cn_fx')?Promise.resolve():(async()=>{try{let parsed;try{parsed=parseH10History(await read(H10_HISTORY));}catch{parsed=parseH10(await read(H10_URL));}for(const a of parsed)await save(a);}catch(e){checks.push({id:'cn_fx',ok:false,error:e.message,source_url:H10_URL});}})();
 await Promise.all([nbs,pbc,sge,fx]);return checks;
}
