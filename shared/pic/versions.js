export const BACKUP_PROTOCOL='pic-backup-v2';
export const DOMAINS=['shared','health','finance'];
export const FINANCE_KEYS=['familyvault.vault.v1','familyvault.backups.v1'];
export function validVersion(n){return Number.isSafeInteger(n)&&n>=0;}
export function compareVersions(incoming,current){
 if(!validVersion(incoming.version)||!validVersion(current.version))throw Error('缺少可靠的备份版本号，不能根据文件时间判断新旧');
 if(incoming.version<current.version)return 'older';
 if(incoming.version>current.version)return 'newer';
 return incoming.hash===current.hash?'identical':'conflict';
}
export function domainBundle(bundle,domain){
 if(!DOMAINS.includes(domain))throw Error('未知数据分区');
 const ls=Object.fromEntries(Object.entries(bundle.localStorage||{}).filter(([k])=>domain==='finance'?FINANCE_KEYS.includes(k):domain==='shared'&&!FINANCE_KEYS.includes(k)&&/^(familyvault\.|home\.user|.*theme)/.test(k)));
 const db=(bundle.indexedDB||[]).filter(d=>domain==='health'?d.name==='healtharchive':domain==='shared'&&d.name!=='healtharchive').map(d=>domain==='health'?{...d,stores:d.stores.map(s=>s.name==='sources'?{...s,recs:[],keys:[]}:s)}:d);
 return {__home_backup:1,v:1,localStorage:ls,indexedDB:db};
}
export function combineDomains(parts){const result={__home_backup:1,v:1,localStorage:{},indexedDB:[]};for(const domain of DOMAINS){const b=domainBundle(parts[domain]||{},domain);Object.assign(result.localStorage,b.localStorage);result.indexedDB.push(...b.indexedDB);}return result;}
export function backupVersions(bundle){const v=bundle.backup_versions;if(!v||!['shared','health'].every(k=>validVersion(v[k])))throw Error('此旧备份没有可靠的分区版本号。请先在 Mac 完成旧库基线迁移，再导出新版备份；当前数据未替换。');return v;}
export function stableJSON(v){return v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stableJSON).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableJSON(v[k])).join(',')+'}';}
