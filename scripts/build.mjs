import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('1. Building Vite frontend (Popup & Options)...');
await viteBuild({ configFile: path.resolve(root, 'vite.config.ts') });

console.log('2. Bundling background service worker...');
await esbuild.build({
  entryPoints: [path.resolve(root, 'src/background/index.ts')],
  outfile: path.resolve(root, 'dist/background.js'),
  bundle: true,
  target: 'es2022',
  format: 'esm',
  minify: true,
});

console.log('3. Bundling content script...');
await esbuild.build({
  entryPoints: [path.resolve(root, 'src/content/index.ts')],
  outfile: path.resolve(root, 'dist/content.js'),
  bundle: true,
  target: 'es2022',
  minify: false, // keep clean for debugging
});

console.log('✓ Build completed successfully into dist/');
