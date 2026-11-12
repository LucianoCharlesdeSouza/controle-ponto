<!-- src/App.vue -->
<template>
  <div class="app-wrapper">
    <main class="page-content">
      <router-view />
    </main>

    <nav class="bottom-nav no-print">
      <router-link to="/" class="nav-item">
        <div class="icon-box"><span class="icon">🏠</span></div>
        <span class="text">Início</span>
      </router-link>
      <router-link to="/ponto" class="nav-item">
        <div class="icon-box"><span class="icon">⏱️</span></div>
        <span class="text">Ponto</span>
      </router-link>
      <router-link to="/colaboradores" class="nav-item">
        <div class="icon-box"><span class="icon">👥</span></div>
        <span class="text">Equipe</span>
      </router-link>
      <router-link to="/ajustes" class="nav-item">
        <div class="icon-box"><span class="icon">📝</span></div>
        <span class="text">Ajustes</span>
      </router-link>      
      <router-link to="/relatorios" class="nav-item">
        <div class="icon-box"><span class="icon">📊</span></div>
        <span class="text">Relatórios</span>
      </router-link>
      <router-link to="/configuracoes" class="nav-item">
        <div class="icon-box"><span class="icon">⚙️</span></div>
        <span class="text">Config</span>
      </router-link>      
    </nav>
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-content {
  flex: 1;
}

/* Menu Inferior Moderno */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 75px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-evenly; /* Distribui o espaço igualmente entre os itens */
  align-items: center;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
  border-top: 1px solid #f1f5f9;
  z-index: 100;
  padding: 0 8px; /* Margem de segurança nas laterais */
  box-sizing: border-box;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #94a3b8;
  font-size: 0.65rem;
  font-weight: 600;
  transition: all 0.2s ease;
  /* Removemos o flex:1 para não esticar até a borda */
  flex: 0 1 auto;
  min-width: 50px;
}

.icon-box {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px; /* Um pouco mais largo para acomodar o efeito pílula */
  height: 50px;
  border-radius: 6px; /* Torna o fundo circular */
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.nav-item .icon {
  font-size: 1.3rem;
  filter: grayscale(100%) opacity(0.6);
  transition: all 0.2s ease;
}

/* Estilo para quando a rota está ativa */
.nav-item.router-link-active {
  color: var(--color-primary);
}

.nav-item.router-link-active .icon-box {
  background-color: var(--color-primary-light, #eff6ff);
}

.nav-item.router-link-active .icon {
  filter: grayscale(0%) opacity(1);
  transform: scale(1.1);
}

/* Ajuste fino para telas muito pequenas (ex: iPhone SE) */
@media (max-width: 360px) {
  .nav-item { font-size: 0.55rem; min-width: 40px; }
  .icon-box { width: 36px; }
  .nav-item .icon { font-size: 1.1rem; }
}
</style>