<!-- src/views/Configuracoes.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { 
  compartilharOuBaixarBackup, 
  baixarBackup, 
  restaurarBackup, 
  ultimoBackup, 
  estimativaArmazenamento 
} from '../infrastructure/backup-service.js';
import { showToast, showConfirm } from '../application/NotificationService.js';


const importando = ref(false);
const dataUltimoBackup = ref(null);
const espacoUsado = ref(null);

onMounted(async () => {
  dataUltimoBackup.value = await ultimoBackup();
  
  const estimativa = await estimativaArmazenamento();
  if (estimativa) {
    espacoUsado.value = (estimativa.usage / (1024 * 1024)).toFixed(2) + ' MB';
  }
});

async function fazerBackupCompartilhar() {
  const resultado = await compartilharOuBaixarBackup();
  if (resultado === 'share') {
    showToast('Backup compartilhado com sucesso!', 'success');
  }
  dataUltimoBackup.value = new Date().toISOString();
}

async function fazerBackupDownload() {
  await baixarBackup();
  showToast('Backup baixado com sucesso!', 'success');
  dataUltimoBackup.value = new Date().toISOString();
}

async function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!await showConfirm('Restaurar Backup', 'ATENÇÃO: A restauração irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
    event.target.value = '';
    return;
  }

  importando.value = true;

  try {
    const resultado = await restaurarBackup(file);

   // Mostra o toast com os detalhes e sem auto-hide (fica na tela até recarregar)
    const msg = `Sucesso! ${resultado.colaboradores} colab., ${resultado.marcacoes} marcações, ${resultado.motivos} motivos restaurados.`;

    showToast(msg, 'success', false);
    
    setTimeout(() => {
      window.location.reload();
    }, 4000);

  } catch (e) {
    showToast('Erro ao restaurar: ', 'error');
  } finally {
    importando.value = false;''
    event.target.value = '';
  }
}

function formatarData(isoStr) {
  if (!isoStr) return 'Nunca realizado';
  return new Date(isoStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<template>

  <header class="app-header">
    <h1>Configurações</h1>
    <p>Gestão do sistema e dados</p>
  </header>

  <div class="page-container">

    <!-- Ações Rápidas -->
    <div class="card action-card">
      <h2 class="section-title">📋 Cadastros</h2>
      <router-link to="/motivos" class="menu-link">
        <div class="menu-icon">🏷️</div>
        <div class="menu-text">
          <strong>Gerenciar Motivos de Ponto</strong>
          <span>Criar, editar ou desativar botões de marcação</span>
        </div>
        <div class="menu-arrow">→</div>
      </router-link>
    </div>

    <!-- Backup -->
    <div class="card">
      <h2 class="section-title">💾 Backup dos Dados</h2>
      <p class="desc">Os dados ficam salvos apenas neste dispositivo. Faça backups periódicos para não perder nada se o celular for formatado ou o navegador limpo.</p>
      
      <div class="status-box">
        <div class="status-item">
          <span class="status-label">Último backup:</span>
          <span class="status-value" :class="{ 'alerta': !dataUltimoBackup }">{{ formatarData(dataUltimoBackup) }}</span>
        </div>
        <div class="status-item" v-if="espacoUsado">
          <span class="status-label">Armazenamento usado:</span>
          <span class="status-value">{{ espacoUsado }}</span>
        </div>
      </div>

      <div class="backup-actions">
        <button @click="fazerBackupCompartilhar" class="btn btn-primary btn-block">
          📲 Compartilhar / Enviar Backup
        </button>
        
        <button @click="fazerBackupDownload" class="btn btn-outline btn-block">
          📥 Baixar Backup (.ptbackup)
        </button>
      </div>

      <div class="divider"></div>

      <div class="restore-area">
        <h3 class="restore-title">Restaurar Dados</h3>
        <p class="desc">Substitua os dados atuais por um backup salvo.</p>
        
        <label class="btn btn-secondary btn-block" :class="{ 'disabled': importando }">
          {{ importando ? 'Restaurando...' : '📤 Selecionar Arquivo de Backup' }}
          <input type="file" accept=".ptbackup,.json" @change="importarBackup" style="display: none;" :disabled="importando" />
        </label>
      </div>
    </div>

    <!-- Aviso -->
    <div class="card aviso-card">
      <div class="aviso-header">
        <span class="aviso-icon">⚠️</span>
        <h3>Atenção</h3>
      </div>
      <ul class="aviso-list">
        <li>O aplicativo funciona <strong>100% offline</strong>. Os dados ficam no cache do navegador.</li>
        <li><strong>Nunca limpe os dados do navegador</strong> sem antes fazer um backup.</li>
        <li>Ao trocar de celular, use o botão "Restaurar Backup" no novo aparelho.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Menu Link */
.action-card { padding: 16px; }
.menu-link {
  display: flex;
  align-items: center;
  gap: 16px;
  text-decoration: none;
  background: #f8fafc;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}
.menu-link:hover { background: #f1f5f9; border-color: #cbd5e1; }
.menu-icon { font-size: 1.8rem; }
.menu-text { flex: 1; display: flex; flex-direction: column; }
.menu-text strong { color: var(--color-text); font-size: 1rem; }
.menu-text span { color: var(--color-muted); font-size: 0.8rem; margin-top: 2px; }
.menu-arrow { color: var(--color-primary); font-size: 1.2rem; font-weight: bold; }

/* Status Box */
.status-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status-item { display: flex; justify-content: space-between; align-items: center; }
.status-label { font-size: 0.85rem; color: var(--color-muted); font-weight: 600; }
.status-value { font-size: 0.9rem; font-weight: 800; color: var(--color-text); }
.status-value.alerta { color: var(--color-danger); }

/* Botões de Ação */
.backup-actions { display: flex; flex-direction: column; gap: 12px; }
.btn-block { width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 14px; font-size: 1rem; }
.btn-secondary { background: #e2e8f0; color: #1e293b; cursor: pointer; }
.btn-secondary:hover { background: #cbd5e1; }
.btn-secondary.disabled { opacity: 0.6; cursor: not-allowed; }

.divider { height: 1px; background: #e2e8f0; margin: 24px 0; }

/* Restaurar */
.restore-area { text-align: center; }
.restore-title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin-bottom: 4px; }
.restore-area .desc { margin-bottom: 12px; }

/* Aviso */
.aviso-card { border-left: 5px solid var(--color-warning); background: #fffbeb; }
.aviso-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.aviso-icon { font-size: 1.2rem; }
.aviso-header h3 { margin: 0; color: #92400e; font-size: 1.1rem; }
.aviso-list { padding-left: 20px; margin: 0; font-size: 0.9rem; color: #78350f; line-height: 1.6; }
.aviso-list strong { font-weight: 800; }

.desc { color: var(--color-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 16px; }
</style>