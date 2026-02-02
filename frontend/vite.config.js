import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const IN_K8S = process.env.K8S_ENV === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: IN_K8S
          ? 'http://soldieriq-backend:8000'
          : (process.env.DOCKER_ENV ? 'http://soldieriq-backend:8000' : 'http://localhost:8001'),
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
})
