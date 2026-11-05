import {build} from 'esbuild';
await build({entryPoints:['shared/pic/mac-sync.js'],outfile:'desktop/cloud-runtime.cjs',bundle:true,platform:'node',format:'cjs',target:'node20'});
