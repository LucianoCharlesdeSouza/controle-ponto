import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'


const router = createRouter({
  // history: createWebHashHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { title: 'Controle de Ponto' }
    },
  


  ],
})

export default router
