// Bundles src/ into dist/. Run with `npm run build`.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const common = { bundle: true, target: 'es2020', logLevel: 'warning' };

writeFileSync('dist/_all.js', "export * from '../src/index.js';\nexport { LoftScene, LoftSpot } from '../src/element.js';\n");

await Promise.all([
  // ES module: `import { Scene } from './dist/loft.js'`
  build({ ...common, entryPoints: ['src/index.js'], format: 'esm', outfile: 'dist/loft.js' }),
  build({ ...common, entryPoints: ['src/index.js'], format: 'esm', minify: true, outfile: 'dist/loft.min.js' }),
  // ES module that also registers <loft-scene>
  build({ ...common, entryPoints: ['dist/_all.js'], format: 'esm', minify: true, outfile: 'dist/loft-element.js' }),
  // Classic script: defines window.Loft and registers <loft-scene>; works from file://
  build({ ...common, entryPoints: ['dist/_all.js'], format: 'iife', globalName: 'Loft', minify: true, outfile: 'dist/loft.global.js' }),
]);

for (const f of ['loft.js', 'loft.min.js', 'loft-element.js', 'loft.global.js']) {
  const buf = readFileSync(`dist/${f}`);
  console.log(`${f.padEnd(18)} ${(buf.length / 1024).toFixed(1).padStart(6)} kB   ${(gzipSync(buf).length / 1024).toFixed(1).padStart(5)} kB gzipped`);
}
