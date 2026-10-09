/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: proxy /api -> backend (FastAPI em :8000). Em produção o Nginx faz o roteamento.
// VITE_MOCK=1 (ou `npm run dev:mock`) liga o backend simulado em memória — só em desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // antd + jsdom é pesado; máquinas lentas (CI) precisam de folga.
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--max-old-space-size=4096'] } },
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
