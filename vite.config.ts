import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, renameSync, rmSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chrome-extension-build',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'public/manifest.json'),
          resolve(distDir, 'manifest.json')
        );
        
        // Copy icons
        const iconsDir = resolve(distDir, 'icons');
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
        for (const size of ['16', '32', '48', '128']) {
          const src = resolve(__dirname, `public/icons/icon${size}.png`);
          if (existsSync(src)) {
            copyFileSync(src, resolve(iconsDir, `icon${size}.png`));
          }
        }
        
        // Move HTML files from dist/src/popup/ to dist/popup/
        const srcPopupDir = resolve(distDir, 'src/popup');
        const destPopupDir = resolve(distDir, 'popup');
        if (existsSync(srcPopupDir)) {
          if (!existsSync(destPopupDir)) mkdirSync(destPopupDir, { recursive: true });
          const popupHtml = resolve(srcPopupDir, 'index.html');
          if (existsSync(popupHtml)) {
            // Read and fix asset paths in the HTML
            let html = readFileSync(popupHtml, 'utf-8');
            // Fix relative paths - from popup/ to assets/
            html = html.replace(/\/assets\//g, '../assets/');
            writeFileSync(resolve(destPopupDir, 'index.html'), html);
          }
        }
        
        // Move HTML files from dist/src/options/ to dist/options/
        const srcOptionsDir = resolve(distDir, 'src/options');
        const destOptionsDir = resolve(distDir, 'options');
        if (existsSync(srcOptionsDir)) {
          if (!existsSync(destOptionsDir)) mkdirSync(destOptionsDir, { recursive: true });
          const optionsHtml = resolve(srcOptionsDir, 'index.html');
          if (existsSync(optionsHtml)) {
            let html = readFileSync(optionsHtml, 'utf-8');
            html = html.replace(/\/assets\//g, '../assets/');
            writeFileSync(resolve(destOptionsDir, 'index.html'), html);
          }
        }
        
        // Clean up the src dir in dist
        const distSrcDir = resolve(distDir, 'src');
        if (existsSync(distSrcDir)) {
          rmSync(distSrcDir, { recursive: true, force: true });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
