import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['amc-favicon.png'],
      manifest: {
        name: 'Starlight Campus',
        short_name: 'Starlight',
        description: 'Starlight Campus Management System',
        theme_color: '#0D3833',
        background_color: '#F0FDF9',
        display: 'standalone',
        icons: [
          {
            src: 'amc-favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'amc-favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
