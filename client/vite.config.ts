import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // 👈 Docker内からアクセス可能にするために必要
    proxy: {
      '/api': {
        target: 'http://backend:3001', // 👈 Docker内のバックエンドを指す
        changeOrigin: true,
      },
    },
  },
});
