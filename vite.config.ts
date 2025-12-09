import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite pour Vercel
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  }
});