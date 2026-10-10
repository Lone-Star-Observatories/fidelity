import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const backend = `http://127.0.0.1:${process.env.FIDELITY_PORT || 4011}`;
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// `vite build --mode standalone` makes a backend-free single-page preview that carries a
// bundled catalogue snapshot (see scripts/build-standalone.js); normal builds get none.
export default defineConfig(({ mode }) => ({
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': backend } },
  resolve: {
    alias: { '#snapshot-packed': here('./standalone/snapshot-packed.js'), '#snapshot': here(mode === 'standalone' ? './src/data/embedded-snapshot.js' : './src/data/no-snapshot.js') },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    ...(mode === 'standalone' ? { outDir: 'dist-standalone', rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
  },
}));
