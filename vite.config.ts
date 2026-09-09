import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const precacheManifestPlugin: Plugin = {
  name: 'smartfinance-precache-manifest',
  writeBundle(options, bundle) {
    const directory = options.dir || 'dist';
    const files = [...new Set([...Object.keys(bundle).filter(name => name !== 'precache-manifest.json' && !name.endsWith('.map')),
      'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'])].sort();
    const assets = files.map(path => ({ path: `./${path}`, sha256: createHash('sha256').update(readFileSync(resolve(directory, path))).digest('hex') }));
    const source = readFileSync('public/service-worker.js', 'utf8');
    const buildId = createHash('sha256').update(JSON.stringify(assets)).update(source).digest('hex').slice(0, 20);
    writeFileSync(resolve(directory, 'precache-manifest.json'), JSON.stringify({ buildId, assets }));
    writeFileSync(resolve(directory, 'service-worker.js'), source.replace('__SF_BUILD_ID__', buildId));
  },
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle)
      .filter((fileName) => !fileName.endsWith('.map'))
      .map((fileName) => `./${fileName}`)
      .sort();
    this.emitFile({
      type: 'asset',
      fileName: 'precache-manifest.json',
      source: JSON.stringify(files),
    });
  },
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // When serving `dist/` from a subfolder (e.g. VSCode "Go Live"), absolute
  // `/assets/...` URLs 404 and cause a white screen. Use relative base on build.
  base: command === 'build' ? './' : '/',
  plugins: [react(), precacheManifestPlugin],
  publicDir: 'public', // Explicitly define public dir (default is 'public')
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split big vendor deps for better caching and smaller initial chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Match the larger/specific packages before React. Both `recharts`
          // and `lucide-react` contain the word "react" in their package name.
          if (id.includes('/recharts/') || id.includes('node_modules\\recharts')) return 'vendor-recharts';
          // Let Rollup tree-shake Lucide per route instead of forcing the whole
          // icon package into one oversized shared chunk.
          if (id.includes('/lucide-react/') || id.includes('node_modules\\lucide-react')) return undefined;
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
          // Let Rollup decide the rest to avoid circular manual chunk deps.
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
}))
