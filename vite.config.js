import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Central SCI',
        short_name: 'Central SCI',
        description: 'Central Operacional — Seção Contra Incêndio',
        theme_color: '#dc2626',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Dados de conformidade/segurança não podem vir de cache desatualizado
            // silenciosamente — sem modo offline real ainda, sempre buscar da rede.
            urlPattern: /^https:\/\/twrnmwdmkhjpwmauqlsu\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
})
