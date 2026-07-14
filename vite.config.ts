import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const precacheManifestPlugin: Plugin = {
  name: 'smartfinance-precache-manifest',
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
