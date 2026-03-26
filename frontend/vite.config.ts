import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/machinedb/',
  plugins: [react()],
  server: {
    port: 5173,
    hmr: {
      path: '/machinedb/__vite_hmr',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/machinedb/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/machinedb\/api/, '/api'),
      },
    },
  },
});
