import {build} from 'esbuild';import{mkdir,copyFile,writeFile}from'node:fs/promises';
await mkdir('web/vendor',{recursive:true});await build({entryPoints:['lib/codecs.mjs'],outfile:'web/vendor/codecs.mjs',bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,legalComments:'eof'});
for(const [name,path]of [['fflate','LICENSE'],['gifenc','LICENSE.md'],['gifuct-js','LICENSE'],['js-binary-schema-parser','LICENSE']]){try{await copyFile('node_modules/'+name+'/'+path,'web/vendor/'+name+'-LICENSE.txt');}catch(e){if(e.code!=='ENOENT')throw e;}}
console.log('Built browser image codecs; pixelation modules remain identical to the pinned upstream source.');
