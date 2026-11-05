import {readFile} from 'node:fs/promises';
export const webAdapter={name:'pic-web-storage',setup(b){b.onLoad({filter:/project-(one|two|three|four)\/src\/.*\.(ts|tsx)$/},async args=>{
 let s=await readFile(args.path,'utf8');
 if(args.path.endsWith('/screens/dev/Disk.tsx'))s='export default function Disk(){return <section><h2>磁盘工具仅适用于 Mac 本机版</h2><p>网站不操作设备磁盘。</p></section>}';
 if(args.path.endsWith('/data/defaultData.ts'))s=s.replace(/const real =[\s\S]*?export const defaultDataset: Dataset = found \?\? sampleDataset;/,'export const defaultDataset: Dataset={vaultName:"家庭理财",userName:"",accounts:[],snapshots:[],real:true};');
 if(args.path.endsWith('/lib/baseDir.ts'))s=s.replace('return typeof (window as any).showDirectoryPicker === "function";','return false;');
 if(args.path.endsWith('/lib/cdn.ts'))s='export function loadScript(){return Promise.reject(new Error("云端版暂未启用外部模型脚本"));}export function loadCss(){return Promise.resolve();}';
 if(args.path.endsWith('/project-one/src/vault/VaultContext.tsx'))s=s.replace(/(const update = useCallback\(async \(mut:[\s\S]*?=> \{)/,'$1\n if((window as any).__PIC_FINANCE_READONLY__)throw new Error("金融数据网页只读，请在 Mac 更新");');
 if(args.path.endsWith('/project-one/src/App.tsx'))s=s.replace('if (status !== "unlocked" || !data) {','if(status === "onboard") return <main style={{padding:24}}>金融数据由 Mac 发布。网页只读；当前没有可解锁的 Mac 金融快照。</main>;\n if (status !== "unlocked" || !data) {');
 s=s.replaceAll('location.reload()','(window.parent as any).PicRuntime.reloadApp(window)');
 const text=[['所有数据仅存于本机。','数据先加密再同步云端。'],['数据只存本机、不联网。','数据先加密再同步云端。'],['本机浏览器（IndexedDB，加密）','加密云端'],['本机浏览器（IndexedDB）','加密云端'],['由本机 run.py 代取','由网站读取公开数据源'],['仅保存在本机','加密同步至云端'],['导入完成：新增','已加密同步：新增']];for(const [a,c] of text)s=s.replaceAll(a,c);
 return {contents:s,loader:args.path.endsWith('.tsx')?'tsx':'ts'};
 });}};
