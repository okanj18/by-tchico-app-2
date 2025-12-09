import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite pour Vercel - Production Ready
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
  }
});