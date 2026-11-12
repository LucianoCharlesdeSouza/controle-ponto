import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './assets/app.css'
import { seedData } from './infrastructure/seed.js'


async function solicitarArmazenamentoPersistente() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log("✅ Armazenamento persistente concedido. Seus dados estão seguros!");
    } else {
      console.warn("⚠️ O navegador negou o armazenamento persistente. Seus dados podem ser limpos se o espaço acabar.");
    }
  }
}

async function bootstrap() {
  try {
    
    await seedData(); // Garante que os motivos básicos existam
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
  }
  
  solicitarArmazenamentoPersistente();
  
  const app = createApp(App)
  app.use(router)
  app.mount('#app')
}

bootstrap();
