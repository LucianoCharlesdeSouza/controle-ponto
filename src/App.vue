<!-- src/App.vue -->
<template>
  <div class="app-wrapper">
    <!-- O conteúdo das páginas é renderizado aqui -->
    <main class="page-content">
      <router-view />
    </main>

    <!-- Menu inferior fixo -->
    <nav class="bottom-nav">
      <router-link to="/" class="nav-item">
        <span class="icon">🏠</span>
        <span class="text">Início</span>
      </router-link>
      <router-link to="/ponto" class="nav-item">
        <span class="icon">⏱️</span>
        <span class="text">Ponto</span>
      </router-link>
      <router-link to="/colaboradores" class="nav-item">
        <span class="icon">👥</span>
        <span class="text">Equipe</span>
      </router-link>
      <router-link to="/ajustes" class="nav-item">
        <span class="icon">📝</span>
        <span class="text">Ajustes</span>
      </router-link>      
      <router-link to="/relatorios" class="nav-item">
        <span class="icon">📊</span>
        <span class="text">Relatórios</span>
      </router-link>
      <router-link to="/configuracoes" class="nav-item">
        <span class="icon">⚙️</span>
        <span class="text">Configurações</span>
      </router-link>      
    </nav>
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: 70px; /* Espaço para o menu */
}

.page-content {
  flex: 1;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65px;
  background: var(--color-surface, #fff);
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: var(--color-muted, #64748b);
  font-size: 0.8rem;
  font-weight: 500;
}

.nav-item .icon {
  font-size: 1.5rem;
  margin-bottom: 2px;
}

/* Estilo para quando a rota está ativa */
.nav-item.router-link-active {
  color: var(--color-primary, #2563eb);
}
</style>