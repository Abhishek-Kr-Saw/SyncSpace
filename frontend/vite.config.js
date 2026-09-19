import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    cors: {
      origin: /^https?:\/\/(?:.+\.)?localhost(?::\d+)?$/
    },
    proxy: {
      '^/agent-proxy/.*': {
        target: 'http://localhost',
        changeOrigin: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/agent-proxy\/[^/?]+/, ''),
        configure: (proxy) => {
          const setSandboxHost = (proxyReq, req) => {
            const sandboxId = (req.originalUrl || req.url).split('?')[0].split('/')[2];
            if (sandboxId) {
              proxyReq.setHeader('host', `${sandboxId}.agent.localhost`);
            }
          };
          proxy.on('proxyReq', setSandboxHost);
          proxy.on('proxyReqWs', setSandboxHost);
        }
      },
      '^/preview-proxy/.*': {
        target: 'http://localhost',
        changeOrigin: false,
        ws: false,
        rewrite: (path) => path.replace(/^\/preview-proxy\/[^/?]+/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const sandboxId = (req.originalUrl || req.url).split('?')[0].split('/')[2];
            if (sandboxId) {
              proxyReq.setHeader('host', `${sandboxId}.preview.localhost`);
            }
          });
        }
      },
      "/api": {
        target: 'http://localhost',
        changeOrigin: true,
        secure: false
      }
    }
  }
})