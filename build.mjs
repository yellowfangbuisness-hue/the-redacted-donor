import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
// Supabase project for the online leaderboard and cloud saves. The publishable key is meant to ship in clients;
// row-level security on the database decides what it can do.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://raemznzmcfzqwtuskwvq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_bqFxzJf-GJ9sZx388iBRjg_QGXGcBvg';
const require = createRequire(import.meta.url);
const paths = [process.cwd(), ...(process.env.INK_TOOLCHAIN ? [process.env.INK_TOOLCHAIN] : [])];
const esbuild = require(require.resolve('esbuild', { paths }));
const root = resolve(require.resolve('three', { paths }), '../..');
// The wanted-poster easter egg photo is inlined as a data URL constant.
// Hand-made sound effects: every src/audio/<name>.(mp3|wav|m4a) is embedded and overrides the synth cue <name>.
const { readdir } = await import('node:fs/promises');
const recorded = {};
for (const f of await readdir('src/audio').catch(() => [])) {
  const m = f.match(/^([a-z0-9-]+)\.(mp3|wav|m4a)$/i);
  if (m && m[1] !== 'daynight') recorded[m[1].toLowerCase()] = (await readFile(`src/audio/${f}`)).toString('base64');
}
const wantedArt = 'data:image/jpeg;base64,' + (await readFile('src/art/wanted.jpg')).toString('base64');
const { outputFiles } = await esbuild.build({
  define: { __SFX__: JSON.stringify(recorded), __SUPABASE_URL__: JSON.stringify(SUPABASE_URL), __SUPABASE_KEY__: JSON.stringify(SUPABASE_KEY), __WANTED_ART__: JSON.stringify(wantedArt), __DAYNIGHT_SFX__: JSON.stringify((await readFile('src/audio/daynight.mp3')).toString('base64')) },
  entryPoints: ['src/game.js'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
  write: false,
  nodePaths: [resolve(root, '..')],
  logLevel: 'warning',
});
const bundle = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [template, style, art, rescue, collapse, license] = await Promise.all([
  readFile('src/shell.html', 'utf8'),
  Promise.all([readFile('src/ui.css', 'utf8'), readFile('src/tactile.css', 'utf8').catch(() => ''), readFile('src/dossier.css', 'utf8').catch(() => '')]).then((parts) => parts.join('\n')),
  readFile('src/art/title.jpg'),
  readFile('src/art/rescue.jpg'),
  readFile('src/art/collapse.jpg'),
  readFile(resolve(root, 'LICENSE'), 'utf8'),
]);
const jpeg = (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`;
const css = style.replace('__TITLE_ART__', () => jpeg(art)).replace('__RESCUE_ART__', () => jpeg(rescue)).replace('__COLLAPSE_ART__', () => jpeg(collapse));
const hash = (s) => "'sha256-" + createHash('sha256').update(s).digest('base64') + "'";
// Optional hand tracking loads MediaPipe from jsDelivr (code + WebAssembly) and its model from Google storage.
const policy = `default-src 'none'; script-src ${hash(bundle)} https://cdn.jsdelivr.net 'wasm-unsafe-eval'; style-src ${
  hash(css)
}; img-src data: blob:; connect-src ${SUPABASE_URL} https://cdn.jsdelivr.net https://storage.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = template.replace('__CSP__', () => policy).replace('__CSS__', () => css).replace(
  '__BUNDLE__',
  () => bundle,
).replace('</head>', () => `<!-- Embedded Three.js license\n${license.replaceAll('--', '—')}-->\n</head>`);
for (const file of ['index.html', 'mars-rehearsal.html']) await writeFile(file, html);
console.log(`Built offline game (${Buffer.byteLength(html).toLocaleString()} bytes, ${Object.keys(recorded).length} recorded sounds).`);
