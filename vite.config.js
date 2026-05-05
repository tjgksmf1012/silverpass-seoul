import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '실버패스 서울 Care',
        short_name: '실버패스',
        description: '고령자의 안전한 이동을 돕는 AI 경로 안내 서비스',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0F766E',
        lang: 'ko',
        orientation: 'portrait',
        categories: ['health', 'navigation', 'utilities'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: '응급 신고',
            short_name: '응급',
            description: '즉시 119 연결',
            url: '/emergency',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // 핵심 파일 사전 캐싱
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // API 요청은 캐시하지 않음 (실시간 데이터)
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // 지도 타일 캐싱 (오프라인에서도 마지막 지도 표시)
            urlPattern: /^https:\/\/{s}\.tile\.openstreetmap\.org\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/seoul': {
        target: 'http://openapi.seoul.go.kr:8088',
        changeOrigin: true,
        rewrite: () => '/',
      },
    },
  },
})
