import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Ponto from '../views/Ponto.vue'
import Colaboradores from '../views/Colaboradores.vue'
import Relatorios from '../views/Relatorios.vue'
import Configuracoes from '../views/Configuracoes.vue'
import AjustesPonto from '../views/AjustesPonto.vue'
import Motivos from '../views/Motivos.vue'

const router = createRouter({
  // history: createWebHashHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { title: 'Painel' }
    },
    {
      path: '/ponto',
      name: 'ponto',
      component: Ponto,
      meta: { title: 'Registrar Ponto' }
    },
    {
      path: '/colaboradores',
      name: 'colaboradores',
      component: Colaboradores,
      meta: { title: 'Colaboradores' }
    },
    {
      path: '/relatorios',
      name: 'relatorios',
      component: Relatorios,
      meta: { title: 'Relatórios' }
    },
    {
      path: '/configuracoes',
      name: 'configuracoes',
      component: Configuracoes,
      meta: { title: 'Configurações' }
    },
    {
      path: '/ajustes',
      name: 'ajustes-ponto',
      component: AjustesPonto,
      meta: { title: 'Tratamento de Ponto' }
    },    
    {
      path: '/motivos',
      name: 'motivos',
      component: Motivos,
      meta: { title: 'Motivos' }
    },
      


  ],
})

export default router
