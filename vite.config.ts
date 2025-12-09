import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite pour Vercel - Fixed Importmap issue
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  }
});