"""Data backup counters. App releases and modification times are never ordering keys."""
import json
FINANCE_KEYS={'familyvault.vault.v1','familyvault.backups.v1'}
def valid(v): return isinstance(v,dict) and all(type(v.get(k)) is int and v[k]>=0 for k in ('finance','shared','health'))
def content(b,domain):
    ls={k:v for k,v in (b.get('localStorage') or {}).items() if (k in FINANCE_KEYS)==(domain=='finance')}
    db=[] if domain=='finance' else [d for d in b.get('indexedDB',[]) if d.get('name')!='healtharchive']
    return json.dumps({'ls':ls,'db':db},sort_keys=True,ensure_ascii=False)
def next_versions(old,new):
    current=old.get('backup_versions') if old else None
    current=current if valid(current) else {'finance':0,'shared':0,'health':0}
    incoming=new.get('backup_versions')
    if incoming is not None and not valid(incoming): raise ValueError('备份版本号无效')
    if incoming and any(incoming[k]<current[k] for k in current): raise ValueError('低版本备份不能覆盖高版本')
    changed={d:content(old or {},d)!=content(new,d) for d in ('finance','shared')}
    if incoming and any(changed[d] and incoming[d]==current[d] and new.get('restore_by_version') for d in changed): raise ValueError('同版本内容冲突，未覆盖')
    return {d:max(current[d]+int(changed.get(d,False)),(incoming or {}).get(d,0)) for d in current}
