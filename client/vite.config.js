import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Ensures the service worker is injected into index.html
      includeAssets: ['suzuki-logo.png'], 
      manifest: {
        name: 'Value One',
        short_name: 'Value One',
        description: 'Value Motor Agency Receipt & Management System',
        theme_color: '#4f63f0',
        background_color: '#ffffff',
        display: 'standalone', 
        icons: [
          {
            src: '/icon-192x192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png', 
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // BLOCK TO TEST PWA IN LOCALHOST:
      devOptions: {
        enabled: true, 
        type: 'module',
      }
    })
  ],
  server: {
    port: 3000,
  }
});