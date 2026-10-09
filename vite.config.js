import { defineConfig } from 'vite';

const backend = `http://127.0.0.1:${process.env.FIDELITY_PORT || 4011}`;

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': backend } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
