import {webAdapter} from './pic-web-adapter.mjs';
import {readFile,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
const editorBundle=await build({entryPoints:['src/editor.js'],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],minify:true});
const assets={};
for(const [url,file,type] of [['/','index.html','text/html'],['/app.js','app.js','text/javascript'],['/daily.js','daily.js','text/javascript'],['/daily.css','daily.css','text/css'],['/style.css','style.css','text/css'],['/editor.css','editor.css','text/css'],['/studio.css','studio.css','text/css'],['/industry.css','industry.css','text/css'],['/industry.js','industry.js','text/javascript'],['/shanghai.js','shanghai.js','text/javascript'],['/shanghai.css','shanghai.css','text/css'],['/regression.js','regression.js','text/javascript'],['/quant.js','quant.js','text/javascript'],['/quant.css','quant.css','text/css'],['/credits.txt','credits.txt','text/plain'],['/capture.js','capture.js','text/javascript'],['/legacy-export.js','legacy-export.js','text/javascript']])assets[url]={body:await readFile('public/'+file,'utf8'),type:type+'; charset=utf-8'};
// PIC source is bundled from the pinned upstream copy, with cloud storage installed before React mounts.
for(const [url,file,type] of [['/pic/','index.html','text/html'],['/pic/cloud.css','cloud.css','text/css']])assets[url]={body:await readFile('public/pic/'+file,'utf8'),type:type+'; charset=utf-8'};
const cloud=await build({entryPoints:['src/pic/cloud.js'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true});
assets['/pic/cloud.js']={body:cloud.outputFiles[0].text,type:'text/javascript; charset=utf-8'};
assets['/pic/pdf.worker.mjs']={body:await readFile(new URL('../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url),'utf8'),type:'text/javascript; charset=utf-8'};
const bootstrap=await readFile('src/pic/child.js','utf8');
const picPlugins=[webAdapter,{name:'pdf-worker-url',setup(b){b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},args=>({path:args.path,namespace:'pic-worker'}));b.onLoad({filter:/.*/,namespace:'pic-worker'},()=>({contents:'export default "/pic/pdf.worker.mjs";',loader:'js'}));}}];
for(const [name,folder] of [['finance','project-one'],['gallery','project-two'],['vault','project-three'],['dev','project-four']]){
 const bundle=await build({entryPoints:['../../'+folder+'/src/main.tsx'],bundle:true,write:false,outfile:'/tmp/pic-'+name+'.js',format:'iife',platform:'browser',target:'es2022',jsx:'automatic',loader:{'.png':'dataurl'},plugins:picPlugins,minify:true,define:{'process.env.NODE_ENV':'"production"'},banner:{js:bootstrap+(name==='finance'?'\nwindow.__PIC_FINANCE_READONLY__=true;window.parent.PicRuntime.protectFinance(window);':'')}});
 assets['/pic/'+name+'/']={body:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PIC · 飞鸟</title><link rel="stylesheet" href="/pic/'+name+'/app.css"></head><body><div id="root"></div><script src="/pic/'+name+'/app.js" defer></script></body></html>',type:'text/html; charset=utf-8'};
 for(const file of bundle.outputFiles){const css=file.path.endsWith('.css');assets['/pic/'+name+'/app.'+(css?'css':'js')]={body:file.text+(css?'\nheader{overflow-x:auto;flex-shrink:0}header>*{flex-shrink:0}@media(max-width:600px){main>div{max-width:100%;padding-left:12px!important;padding-right:12px!important}}':''),type:(css?'text/css':'text/javascript')+'; charset=utf-8'};}
}
const code=await readFile('worker/index.js','utf8');
assets['/editor.js']={body:editorBundle.outputFiles[0].text,type:'text/javascript; charset=utf-8'};
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
const workerBundle=await build({entryPoints:['worker/index.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',banner:{js:'const ASSETS='+JSON.stringify(assets)+';'}});
await writeFile('dist/server/index.js',workerBundle.outputFiles[0].text);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/drizzle',{recursive:true});
console.log('Built Worker with embedded assets and migrations');
