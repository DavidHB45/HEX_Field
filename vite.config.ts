import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inject the SW registration script automatically into index.html
      injectRegister: 'auto',
      devOptions: { enabled: false },
      manifest: {
        name: 'Harris Job Walk',
        short_name: 'Job Walk',
        description: 'Harris Excavation field capture app',
        theme_color: '#263E57',
        background_color: '#263E57',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Navigation requests fall back to index.html for client-side routing,
        // but /api/* must never be intercepted — those need to reach the server.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        // Precache all build output (HTML, JS, CSS, fonts, icons)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // External assets (fonts, CDN) – cache-first with long TTL
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cdn',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Explicitly do NOT cache /api/* — any fetch to /api/ must reach the
          // network. No runtimeCaching entry means the SW passes it through.
        ],
      },
    }),
  ],
});
