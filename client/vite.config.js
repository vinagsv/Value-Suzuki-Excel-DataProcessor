import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['suzuki-logo.png'], // Keep other static assets you want cached
      manifest: {
        name: 'Value One',
        short_name: 'Value One',
        description: 'Value Motor Agency Receipt & Management System',
        theme_color: '#4f63f0',
        background_color: '#ffffff',
        display: 'standalone', // Essential for the native app feel on mobile
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
      }
    })
  ],
  server: {
    port: 3000,
  }
});