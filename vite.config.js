import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  plugins: [
    VitePWA({
      // Auto-update SW di background begitu versi baru ke-deploy — user
      // gak perlu uninstall/reinstall manual tiap ada update kode.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],

      // ─── Web App Manifest — syarat utama supaya Chrome Android
      // nawarin "Install app" / "Tambahkan ke layar Utama" ───────────
      manifest: {
        name: 'GPS Live — Berbagi Lokasi Real-time',
        short_name: 'GPS Live',
        description: 'Aplikasi pelacakan & berbagi lokasi GPS real-time bareng teman, lengkap dengan snap-ke-jalan dan navigasi.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#e5e6e8', // warna splash screen saat app dibuka
        theme_color: '#247066',      // samain sama <meta theme-color> di index.html
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // ─── Service Worker (Workbox) ───────────────────────────────────
      workbox: {
        // Precache app shell (HTML/JS/CSS/ikon hasil build) → begini yang
        // bikin app tetap kebuka walau HP lagi offline total.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Firebase Realtime Database pakai WebSocket/long-polling buat data
        // live — sengaja TIDAK di-precache/di-intercept SW (lihat runtimeCaching
        // di bawah, gak ada rule buat firebaseio/googleapis). Data lokasi
        // realtime memang butuh koneksi aktif, gak masuk akal di-cache.
        runtimeCaching: [
          // Font Inter & Space Mono dari Google Fonts — biar teks & UI
          // tetap tampil rapi walau offline (bukan cuma fallback font sistem).
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Style + tile vector + sprite + glyph peta (semua 1 origin di
          // OpenFreeMap) — area yang pernah dibuka tetap kebaca offline,
          // area baru otomatis ke-cache tiap kali online.
          {
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Rute OSRM — butuh data fresh, tapi kalau timeout/offline fallback
          // ke rute terakhir yang sama (kalau ada) daripada gagal total.
          {
            urlPattern: ({ url }) => url.hostname === 'router.project-osrm.org',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osrm-routes',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        enabled: false, // set true sementara kalau mau test SW pas `npm run dev`
      },
    }),
  ],
});
