import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Разбивка тяжёлых вендоров в отдельные кешируемые чанки.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          charts: ['@ant-design/charts'],
          query: ['@tanstack/react-query'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Dev convenience: proxy API calls to the FastAPI backend.
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
