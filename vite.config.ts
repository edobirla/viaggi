import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // foto delle città (Wikipedia) e dei posti (Google): restano disponibili offline
          {
            urlPattern: /^https:\/\/((upload|thumb)\.wikimedia\.org|[a-z0-9-]+\.googleusercontent\.com)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'foto', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      manifest: {
        name: 'Viaggi',
        short_name: 'Viaggi',
        lang: 'it',
        display: 'standalone',
        start_url: './',
        background_color: '#f2f2f0',
        theme_color: '#d4442e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { host: true },
})
