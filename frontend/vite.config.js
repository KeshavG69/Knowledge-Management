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
    host: true,                  // bind 0.0.0.0 in the pod
    port: 5173,
    allowedHosts: [
      'soldieriq.io',
      'www.soldieriq.io',
      '.us-gov-west-1.elb.amazonaws.com', // allow your ALB hostname
    ],
    // If HMR websockets fail behind the ALB, uncomment:
    // hmr: { protocol: 'wss', host: 'www.soldieriq.io', clientPort: 443 },

    // Dev-only proxy; harmless in prod because Ingress routes /api
    proxy: {
      '/api': {
        target: IN_K8S
          ? 'http://soldieriq-backend:8000'
          : (process.env.DOCKER_ENV ? 'http://soldieriq-backend:8000' : 'http://localhost:8000'),
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
