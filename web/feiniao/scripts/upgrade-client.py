from pathlib import Path
p=Path('public/app.js'); s=p.read_text()
start=s.index('let mediaDatabase;'); end=s.index('function referencedMedia',start)
s=s[:start]+'''let cloudRevision=0;
async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...options.headers}});let data;try{data=await response.json();}catch{throw Error('云端返回异常，请稍后重试。');}if(!response.ok)throw Error(data.error||'云端保存失败');return data;}
async function mediaGet(id){const a=await api('/api/media/'+encodeURIComponent(id));return {...a,ciphertext:new Blob([unb64(a.ciphertext)])};}
async function mediaPut(asset){await api('/api/media/'+encodeURIComponent(asset.id),{method:'PUT',body:JSON.stringify({iv:asset.iv,ciphertext:b64(new Uint8Array(await asset.ciphertext.arrayBuffer()))})});}
''' +s[end:]
start=s.index('async function restoreMediaBundle');end=s.index('function formatSize',start)
s=s[:start]+'''async function restoreMediaBundle(assets,data,key){if(!Array.isArray(assets))throw Error('备份附件格式不正确');const incoming=new Map(assets.map(a=>[a.id,a]));const idMap=new Map();for(const id of referencedMedia(data)){const a=incoming.get(id);if(!a||typeof a.iv!=='string'||typeof a.ciphertext!=='string')throw Error('备份缺少附件');let clear;try{clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(a.iv)},key,unb64(a.ciphertext));}catch{throw Error('备份附件损坏或密码不匹配');}const newId=crypto.randomUUID(),iv=crypto.getRandomValues(new Uint8Array(12)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,clear);await mediaPut({id:newId,iv:b64(iv),ciphertext:new Blob([ciphertext])});idMap.set(id,newId);}for(const r of [...data.records,...(data.draftEditor?[data.draftEditor]:[])])for(const m of r.media||[])m.id=idMap.get(m.id)||m.id;}
''' + s[end:]
start=s.index('function readEnvelope()');end=s.index('function b64(',start)
s=s[:start]+s[end:]
s=s.replace("localStorage.setItem(KEY,JSON.stringify(result));envelope=result;saveError=false;$('#save-state').textContent='空间已加密';", "const cloud=await api('/api/vault',{method:'PUT',body:JSON.stringify({revision:cloudRevision,envelope:result})});cloudRevision=cloud.revision;envelope=result;saveError=false;$('#save-state').textContent='已加密保存到云端';")
s=s.replace("JSON.stringify(result)","JSON.stringify(result)")
s=s.replace("toast('保存失败，可能是浏览器空间不足。请保持页面打开并导出备份。');throw e;", "toast(e.message||'云端保存失败，请保留页面并导出备份。');throw e;")
start=s.index('function setupGate()');end=s.index('function toggleInput(',start)
s=s[:start]+'''function setupGate(){$('#gate-title').textContent='欢迎回到飞鸟';$('#gate-subtitle').textContent='输入访问密码，打开你的云端私人空间。';$('#confirm-wrap').hidden=true;$('#master-confirm').required=false;$('#master').minLength=1;$('#master').autocomplete='current-password';$('#master').placeholder='输入访问密码';$('#unlock-button').innerHTML='解锁我的空间'+icon('arrow');$('#gate-error').textContent='';$('#master').value='';$('#master-confirm').value='';$('#master').type='password';}
$('#unlock-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('#unlock-button').disabled=true;try{if(!crypto.subtle)throw Error('请在 HTTPS 中打开飞鸟。');const password=$('#master').value;await api('/api/login',{method:'POST',body:JSON.stringify({password})});const cloud=await api('/api/vault');cloudRevision=cloud.revision;let data=cloud.envelope,newDb,key,newSalt;if(data){if(!validEnvelope(data))throw Error('云端加密数据格式不正确');newSalt=unb64(data.salt);key=await derive(password,newSalt);let decoded;try{decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(data.iv)},key,unb64(data.ciphertext));}catch{throw Error('无法解密云端记录，请勿覆盖数据。');}newDb=validateDb(JSON.parse(new TextDecoder().decode(decoded)));}else{newSalt=crypto.getRandomValues(new Uint8Array(16));key=await derive(password,newSalt);newDb=seed();}db=newDb;cryptoKey=key;salt=newSalt;envelope=data;if(!data)await save();$('#master').value='';$('#app').hidden=false;$('#gate').hidden=true;lastActivity=Date.now();view='overview';filter='all';tagFilter='';render();if(db.draftEditor)restoreDraft();if(db.quickDraft)$('#quick-text').value=db.quickDraft;if(db.captureDraft){$('#capture-text').value=db.captureDraft;previewCapture();if(!$('#editor-dialog').open)$('#capture-dialog').showModal();}}catch(err){$('#gate-error').textContent=err.message;db=null;cryptoKey=null;salt=null;}finally{busy=false;$('#unlock-button').disabled=false;}});
''' +s[end:]
s=s.replace("await save();$$('dialog[open]')", "await save();await api('/api/logout',{method:'POST'});$$('dialog[open]')")
s=s.replace('所有账号均已加密保存在此浏览器','所有账号均已加密保存在网站云端')
s=s.replace('本地附件库最多 150 MB。请先备份，云端大容量存储待接入。','附件库最多 150 MB，请先导出备份再整理。')
s=s.replace('附件保存失败，可能是浏览器空间不足。请先导出备份。','附件上传失败，请检查网络并重试。')
s=s.replace("toast('已加密保存，灵感有了归处。');", "toast('已加密保存到云端。');")
s=s.replace("r.username=$('#account-user').value;r.password=$('#account-password').value;", "r.username=$('#account-user').value;r.password=$('#account-password').value;r.loginMethod=$('#account-login').value;r.balance=$('#account-balance').value;")
# Keep capture fields when opening the regular editor.
start=s.index("function openEditor(");end=s.index('\n',start)
line=s[start:end]; marker="$('#editor-form').reset();"
line=line.replace(marker,marker+"$('#account-login').value=record?.loginMethod||'';$('#account-balance').value=record?.balance||'';")
s=s[:start]+line+s[end:]
s=s.replace("'<div class=\"credential-row\"><div><small>账号 / 用户名", "'<div class=\"credential-row\"><div><small>账号 / 用户名")
s=s.replace("${r.kind==='account'?`<div class=\"credential-row\">", "${r.kind==='account'?`<div class=\"credential-row\"><div><small>登录方式</small><code>${esc(r.loginMethod||'未填写')}</code></div><div><small>余额 / 权益</small><code>${esc(r.balance||'未填写')}</code></div></div><div class=\"credential-row\">")
start=s.index("$('#import-file').onchange=");end=s.index("\n$('#top-date')",start)
s=s[:start]+'''$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!db)throw Error('请先用访问密码解锁云端空间，再导入旧备份。');if(file.size>MAX_BYTES)throw Error('备份文件过大');const data=JSON.parse(await file.text());if(!validEnvelope(data))throw Error('请选择有效的飞鸟加密备份。');if(saveError)throw Error('当前有未保存的记录，请先导出备份。');const password=prompt('请输入这份旧备份的主密码（不会更改网站访问密码）：');if(password===null)return;const key=await derive(password,unb64(data.salt));let restored;try{const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(data.iv)},key,unb64(data.ciphertext));restored=validateDb(JSON.parse(new TextDecoder().decode(clear)));}catch{throw Error('旧备份密码不正确或文件损坏');}if(!confirm('将旧备份合并到云端；相同 ID 的记录保留云端版本。是否继续？'))return;busy=true;await restoreMediaBundle(data.assets||[],restored,key);const ids=new Set(db.records.map(r=>r.id));db.records.push(...restored.records.filter(r=>!ids.has(r.id)));await save();render();toast('旧备份已合并到云端。');}catch(err){toast(err.message||'导入失败');}finally{busy=false;e.target.value='';}};
''' +s[end:]
start=s.index("$('#capture-form').addEventListener(");end=s.index('\n})();',start)
s=s[:start]+'''function previewCapture(){const p=parseCapture($('#capture-text').value);$('#capture-kind').value=p.kind;$('#capture-title').value=p.title;$('#capture-login').value=p.loginMethod;$('#capture-balance').value=p.balance;$('#capture-user').value=p.username;$('#capture-account-fields').hidden=p.kind!=='account';}
$('#capture-text').addEventListener('input',previewCapture);
$('#capture-kind').onchange=()=>{$('#capture-account-fields').hidden=$('#capture-kind').value!=='account';};
$('#capture-form').addEventListener('submit',async e=>{e.preventDefault();const raw=$('#capture-text').value.trim();if(!raw||busy)return;busy=true;const button=$('#capture-submit');button.disabled=true;const now=new Date().toISOString(),kind=$('#capture-kind').value;const record={id:crypto.randomUUID(),kind,domain:'general',title:$('#capture-title').value.trim()||raw.slice(0,28),body:raw,tags:['随手记'],status:'done',favorite:false,created:now,updated:now};if(kind==='account'){record.loginMethod=$('#capture-login').value.trim();record.balance=$('#capture-balance').value.trim();record.username=$('#capture-user').value.trim();record.password='';}db.records.unshift(record);delete db.captureDraft;try{await save();$('#capture-text').value='';$('#capture-dialog').close();previewCapture();render();toast('已整理并加密保存到云端。');}catch{db.records=db.records.filter(r=>r.id!==record.id);render();}finally{busy=false;button.disabled=false;}});
''' +s[end:]
s=s.replace("function openCapture(){if(!db)return;$('#capture-dialog')", "function openCapture(){if(!db)return;previewCapture();$('#capture-dialog')")
# No browser database or persistent content writes remain.
p.write_text(s)
p=Path('public/index.html');s=p.read_text()
s=s.replace("connect-src 'none'","connect-src 'self'")
s=s.replace('内容加密保存在当前浏览器，不会同步到云端。','记录加密保存在网站云端，可跨设备访问。')
s=s.replace('主密码无法找回，请妥善保管并定期导出加密备份。','无需 OpenAI 账号；请妥善保管访问密码并定期备份。')
s=s.replace('已加密 · 仅此浏览器','已加密 · 云端保存')
s=s.replace('主密码</label>','访问密码</label>')
s=s.replace('附件加密保存在当前浏览器；导出备份会包含全部附件。','附件加密上传到网站数据库；导出备份会包含全部附件。')
s=s.replace('你的博客、手稿、信息和账号都由主密码加密，仅保存在当前浏览器。清除网站数据、更换设备或浏览器后，需要用备份恢复。','你的博客、手稿、信息和账号已加密存入网站端数据库，使用同一访问密码可在不同设备查看。手机和浏览器不持久保存记录；断网时无法读取或保存。')
s=s.replace('主密码无法重置或找回。请把主密码与备份分别妥善保存。此空间适合普通账号记录；重要凭据建议使用专业密码管理器。','请把访问密码与备份分别妥善保存。旧版记录仍在原浏览器中，需先从旧版导出加密备份，再在这里导入；旧记录不会自动上传。')
s=s.replace('先记下来。</h2>','说下来，整理好。</h2>')
s=s.replace('一个想法、一句话，或任何值得留下的东西…','可以直接用豆包输入法口述，例如：我在瑞幸小程序用微信登录，余额还有一百二十元。')
s=s.replace('<p class="small-note">不必想标题，保存后会放进「随手记」。</p>', '''<p class="small-note">自动识别常见账号、登录和余额表达，保存前可修改。原话完整保留，日常想法归入信息。</p><div class="capture-preview"><label for="capture-kind">存到哪里</label><select id="capture-kind"><option value="account">账号</option><option value="info">信息</option></select><label for="capture-title">平台 / 标题</label><input id="capture-title" maxlength="160" required><div id="capture-account-fields"><label for="capture-login">登录方式</label><input id="capture-login" maxlength="100"><label for="capture-user">账号（选填）</label><input id="capture-user" maxlength="100"><label for="capture-balance">余额 / 权益</label><input id="capture-balance" maxlength="100"></div></div>''')
s=s.replace('type="submit" class="primary">收下这一刻','type="submit" id="capture-submit" class="primary">整理并存到云端')
s=s.replace('<label for="account-user">','<label for="account-login">登录方式</label><input id="account-login" placeholder="微信 / 手机号 / Apple 等"><label for="account-balance">余额 / 权益</label><input id="account-balance" placeholder="例如：120 元"><label for="account-user">')
s=s.replace('<script src="app.js?v=20261018b"></script>','<script src="capture.js?v=20261022"></script><script src="app.js?v=20261022"></script>')
s=s.replace('快速随手记','快速整理记录')
s=s.replace('仅自己可见 · 加密保存','密码保护 · 云端加密保存')
p.write_text(s)
