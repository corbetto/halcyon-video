import { defineConfig } from 'astro/config';
import { writeFile,readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { captureBuildSource } from './src/deployment/source.ts';
const repository=fileURLToPath(new URL('..',import.meta.url));
let startingSource=captureBuildSource(repository);
const provenance={name:'halcyon-static-provenance',hooks:{
  'astro:build:start':()=>{startingSource=captureBuildSource(repository);},
  'astro:build:done':async({dir})=>{
    const endingSource=captureBuildSource(repository);
    const astro=JSON.parse(await readFile(new URL('./node_modules/astro/package.json',import.meta.url),'utf8')).version;
    await writeFile(new URL('build-provenance.json',dir),JSON.stringify({version:1,sourceCommit:startingSource.sourceCommit,
      clean:startingSource.clean&&endingSource.clean&&startingSource.sourceCommit===endingSource.sourceCommit,
      toolchain:{node:process.version,astro}})+'\n');
  },
}};
const origin = process.env.SHOWCASE_ORIGIN;
if (origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('SHOWCASE_ORIGIN must be an HTTPS origin without credentials, path or query.');
}
// This foundation is deliberately preview-only until the publication gates in #356 pass.
if (process.env.SHOWCASE_DEPLOY_TARGET === 'production')
  throw new Error('Production requires the source-rights, domain and release gates in #356.');
export default defineConfig({ site: origin, output: 'static', trailingSlash: 'always', devToolbar: { enabled: false },integrations:[provenance] });
