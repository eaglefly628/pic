#!/usr/bin/env node
import {readFileSync,mkdtempSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2),configArg=args.indexOf('--config');
if(configArg<0)throw new Error('请使用 --config 指定本机部署配置文件。');
const config=JSON.parse(readFileSync(resolve(args[configArg+1]),'utf8'));
if(!/^[a-zA-Z0-9_.-]+$/.test(config.sshHost||'')||config.sshHost.includes('REPLACE'))throw new Error('请填写已配置且已验证指纹的 SSH Host 别名。');
if(!/^\/srv\/[a-zA-Z0-9_/-]+$/.test(config.remoteRoot||'')||config.remoteRoot.includes('..'))throw new Error('remoteRoot 必须是 /srv 下不含空格的独立网站目录。');
if(!config.publicUrl?.startsWith('https://'))throw new Error('请先配置可信 HTTPS 地址。');
const project=resolve(import.meta.dirname,'..'),dist=join(project,'dist');
const files=readdirSync(dist).sort();
if(!files.includes('index.html')||files.some(n=>!statSync(join(dist,n)).isFile()||!/^[-a-zA-Z0-9_.]+$/.test(n)))throw new Error('dist 中只能包含本次静态发布的文件。');
const hashes=Object.fromEntries(files.map(n=>[n,createHash('sha256').update(readFileSync(join(dist,n))).digest('hex')]));
const revision=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
function run(command,argv,options={}){const result=spawnSync(command,argv,{stdio:options.input?['pipe','inherit','inherit']:'inherit',...options});if(result.status!==0)throw new Error(command+' 执行失败；现有版本保持不变。');}
const ssh=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',config.sshHost],root=config.remoteRoot,release=root+'/releases/'+revision;
const plan={revision,sshHost:config.sshHost,remoteRoot:root,publicUrl:config.publicUrl,hashes};
if(args.includes('--dry-run')){console.log(JSON.stringify(plan,null,2));process.exit(0);}
const temp=mkdtempSync(join(tmpdir(),'feiniao-release-'));
try{
 const archive=join(temp,'site.tar.gz');
 run('tar',['-czf',archive,'-C',dist,...files]);
 run('ssh',[...ssh,'sh','-s','--',root,revision],{input:'set -eu\nmkdir -p "$1/releases/$2"\n'});
 run('scp',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',archive,config.sshHost+':'+root+'/releases/'+revision+'.tar.gz']);
 const verify=files.map(n=>hashes[n]+'  '+n).join('\n');
 const remote='set -eu\nroot="$1"\nrevision="$2"\nrelease="$root/releases/$revision"\ntar -xzf "$root/releases/$revision.tar.gz" -C "$release"\ncd "$release"\nsha256sum -c - <<\'HASHES\'\n'+verify+'\nHASHES\nln -s "releases/$revision" "$root/current.$revision"\nmv -Tf "$root/current.$revision" "$root/current"\nrm "$root/releases/$revision.tar.gz"\n';
 run('ssh',[...ssh,'sh','-s','--',root,revision],{input:remote});
 run('curl',['--fail','--silent','--show-error','--max-time','20',config.publicUrl+'/index.html','--output',join(temp,'served.html')]);
 const served=readFileSync(join(temp,'served.html'));
 if(createHash('sha256').update(served).digest('hex')!==hashes['index.html'])throw new Error('上线后内容校验不一致，请检查 CDN 缓存或站点路由。');
 console.log(JSON.stringify({...plan,status:'verified'},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
