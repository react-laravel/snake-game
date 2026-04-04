import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/snake/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/snake': {
        target: 'http://localhost:3333',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
