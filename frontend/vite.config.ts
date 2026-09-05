import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-logo.png', 'amc-favicon.png', 'hostel.png'],
      manifest: {
        id: 'com.amc.hosteldesk',
        name: 'AMC Hostel Management System',
        short_name: 'HostelDesk',
        description: 'Enterprise Hostel Management System Portal for Students and Staff',
        theme_color: '#0D3833',
        background_color: '#F0FDF9',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en-US',
        dir: 'ltr',
        categories: ['education', 'productivity', 'utilities'],
        prefer_related_applications: false,
        icons: [
          {
            src: 'app-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'app-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'app-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Gate Pass',
            short_name: 'Gate Pass',
            description: 'Quickly access Gate Pass requests',
            url: '/student/gate-pass',
            icons: [{ src: 'app-logo.png', sizes: '192x192' }]
          },
          {
            name: 'Complaints',
            short_name: 'Complaints',
            description: 'Raise or view complaints',
            url: '/student/complaints',
            icons: [{ src: 'app-logo.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          {
            src: 'hostel.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'HostelDesk Overview'
          },
          {
            src: 'app-logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'HostelDesk Portal'
          }
        ]
      }
    })
  ]
})
