import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa' // IMPORT

// https://vite.dev/config/
export default defineConfig({
  base: '/controle-ponto/',
  plugins: [
    vue(),
    // vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate', // Atualiza o SW automaticamente
      devOptions: {
        enabled: true // Permite testar o PWA em localhost
      },
      manifest: {
        id: '/controle-ponto/',
        name: 'Controle de Ponto',
        short_name: 'Controle de Ponto',
        description: 'Sistema de registro, acompanhamento e gerenciamento de jornada de trabalho e folha de pagamento.',
        lang: 'pt-BR',
        dir: 'ltr',
        orientation: 'any',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: [
        'standalone',
        'minimal-ui'
        ],
        start_url: '/controle-ponto/',
        scope: '/controle-ponto/',
        categories: [
        'business',
        'productivity',
        'utilities'
        ],
        prefer_related_applications: false,
        icons: [
          // Coloque seus ícones na pasta /public/icons/ e referencie aqui
          { 
            src: 'icons/controle-ponto-192.png', 
            sizes: '192x192', 
            type: 'image/png', 
            purpose: 'any' },
          { 
            src: 'icons/controle-ponto-512.png', 
            sizes: '512x512', 
            type: 'image/png', 
            purpose: 'any' },
          { 
            src: 'icons/controle-ponto-maskable-192.png', 
            sizes: '192x192', 
            type: 'image/png', 
            purpose: 'maskable' },
          { 
            src: 'icons/controle-ponto-maskable-512.png', 
            sizes: '512x512', 
            type: 'image/png', 
            purpose: 'maskable' }
        ],
        screenshots: [
          {
              "src": "icons/screenshots/desktop.png",
              "sizes": "1901x877",
              "type": "image/png",
              "form_factor": "wide",
              "label": "Painel de controle"
          },
          {
              "src": "icons/screenshots/mobile.png",
              "sizes": "404x728",
              "type": "image/png",
              "form_factor": "narrow",
              "label": "Painel de controle mobile"
          }
        ]        
      }

    })    
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
