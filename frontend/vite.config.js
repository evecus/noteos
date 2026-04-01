import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../web/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:2344',
      '/uploads': 'http://localhost:2344',
    },
  },
})
