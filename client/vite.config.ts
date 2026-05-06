import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/2026-05-06-sprite-forge/',
  server: {
    port: 5179,
    proxy: {
      '/api': 'http://localhost:3479',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
