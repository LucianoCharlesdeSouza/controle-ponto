import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './assets/app.css'
import { seedData } from './infrastructure/seed.js'

// Tenta garantir armazenamento persistente
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {})
}

async function bootstrap() {
  try {
    await seedData(); // Garante que os motivos básicos existam
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
  }
  
  const app = createApp(App)
  app.use(router)
  app.mount('#app')
}

bootstrap();
