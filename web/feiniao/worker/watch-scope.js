// Explicit table allowlist keeps each watch's cache, summaries, skips and schedules independent.
export const aiSources=[
 {id:'openai',name:'OpenAI News',url:'https://openai.com/news/rss.xml',topic:'product'},
 {id:'googleresearch',name:'Google Research',url:'https://research.google/blog/rss/',topic:'research'},
 {id:'googleai',name:'Google AI',url:'https://blog.google/technology/ai/rss/',topic:'product'},
 {id:'huggingface',name:'Hugging Face',url:'https://huggingface.co/blog/feed.xml',topic:'technology'},
 {id:'mitai',name:'MIT Technology Review · AI',url:'https://www.technologyreview.com/topic/artificial-intelligence/feed',topic:'policy'},
 {id:'techcrunchai',name:'TechCrunch · AI',url:'https://techcrunch.com/category/artificial-intelligence/feed/',topic:'business'}
].map(source=>({...source,watch:'ai'}));
const aiTables={industry_items:'ai_industry_items',industry_runs:'ai_industry_runs',industry_settings:'ai_industry_settings'};
export function watchEnv(env,watch='game'){
 if(!['game','ai'].includes(watch))throw Error('未知行业观察');
 if(watch==='game')return env;
 return {...env,WATCH_SOURCES:aiSources,DB:{prepare(sql){return env.DB.prepare(sql.replace(/\bindustry_(?:items|runs|settings)\b/g,table=>aiTables[table]));}}};
}
