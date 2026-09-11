import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'icon-512.png'],
      manifest: {
        name: 'Arisan IKT',
        short_name: 'Arisan IKT',
        description: 'Pengelolaan arisan dan kegiatan IKT',
        theme_color: '#0f766e',
        background_color: '#f7fbfa',
        display: 'standalone',
        start_url: '/',
        lang: 'id',
        icons: [
          { src: '/icon.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
