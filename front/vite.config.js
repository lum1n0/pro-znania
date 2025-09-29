import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// https://vite.dev/config/  
export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  // Копируем tinymce в public при сборке
  publicDir: 'public',

  server: {
    host: '0.0.0.0', // Слушаем все доступные сетевые интерфейсы
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
    global: 'window', // Указываем, что global должен быть заменён на window
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