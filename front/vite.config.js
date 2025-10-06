import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  
  publicDir: 'public',

  server: {
    host: '0.0.0.0',
    port: 4200,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        withCredentials: true,
      }
    }
  },
  
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'),
    'import.meta.env.VITE_WS_BASE_URL': JSON.stringify(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'),
    global: 'window',
  },
  
  resolve: {
    alias: {
      'parse5-htmlparser2-tree-adapter': 'parse5-htmlparser2-tree-adapter'
    }
  },
  
  optimizeDeps: {
    include: ['parse5', 'parse5-htmlparser2-tree-adapter']
  }
});