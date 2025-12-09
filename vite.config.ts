import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite pour Vercel - Production Ready
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['lucide-react']
        }
      }
    },
  },
  server: {
    port: 3000,
  }
});