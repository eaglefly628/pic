import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
await build({absWorkingDir:fileURLToPath(new URL('../',import.meta.url)),entryPoints:['shared/pic/mac-sync.js'],outfile:'desktop/cloud-runtime.cjs',bundle:true,platform:'node',format:'cjs',target:'node20'});
