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
    alert('Backup compartilhado com sucesso!');
  }
  dataUltimoBackup.value = new Date().toISOString();
}

async function fazerBackupDownload() {
  await baixarBackup();
  alert('Backup baixado com sucesso!');
  dataUltimoBackup.value = new Date().toISOString();
}

async function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm('ATENÇÃO: A restauração irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
    event.target.value = '';
    return;
  }

  importando.value = true;

  try {
    const resultado = await restaurarBackup(file);
    alert(`Backup restaurado com sucesso!\n\n${resultado.colaboradores} colaboradores\n${resultado.marcacoes} marcações\n${resultado.motivos} motivos`);
    window.location.reload();
  } catch (e) {
    alert('Erro ao restaurar: ' + e.message);
  } finally {
    importando.value = false;
    event.target.value = '';
  }
}

function formatarData(isoStr) {
  if (!isoStr) return 'Nunca realizado';
  return new Date(isoStr).toLocaleString('pt-BR');
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>Configurações</h1>
    </header>

    <div class="card menu-card">
      <h2>Cadastros</h2>
      <router-link to="/motivos" class="menu-link">
        <span>📋 Gerenciar Motivos de Ponto</span>
        <span>→</span>
      </router-link>
    </div>

    <div class="card">
      <h2>Backup dos Dados</h2>
      <p class="desc">Os dados são salvos no seu dispositivo. Faça backups periódicos para não perder as informações.</p>
      
      <div class="status-box">
        <div>
          <strong>Último backup:</strong> 
          <span :class="{ 'alerta-texto': !dataUltimoBackup }">{{ formatarData(dataUltimoBackup) }}</span>
        </div>
        <div v-if="espacoUsado">
          <strong>Armazenamento usado:</strong> {{ espacoUsado }}
        </div>
      </div>

      <button @click="fazerBackupCompartilhar" class="btn-primary">
        📲 Compartilhar / Enviar Backup
      </button>
      
      <button @click="fazerBackupDownload" class="btn-primary btn-outline">
        📥 Baixar Backup (.ptbackup)
      </button>

      <div class="import-area">
        <label class="btn-secondary">
          📤 Restaurar Backup
          <input type="file" accept=".ptbackup,.json" @change="importarBackup" style="display: none;" />
        </label>
        <span v-if="importando" class="loading">Restaurando...</span>
      </div>
    </div>

    <div class="card aviso">
      <h3>⚠️ Importante</h3>
      <ul>
        <li>Como o aplicativo funciona 100% offline, os dados ficam salvos no cache do navegador.</li>
        <li>Nunca limpe os dados do navegador sem antes fazer um backup.</li>
        <li>Se trocar de celular ou computador, use o botão "Restaurar Backup" no novo aparelho.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header h1 { font-size: 1.5rem; margin-bottom: 20px; text-align: center; }
.card { background: var(--color-surface, #fff); padding: 20px; border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); margin-bottom: 16px; }
.card h2 { margin-top: 0; font-size: 1.2rem; }
.desc { color: var(--color-muted, #64748b); font-size: 0.9rem; margin-bottom: 16px; }
.status-box { background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 8px; border: 1px solid #e2e8f0; }
.alerta-texto { color: var(--color-danger, #dc2626); font-weight: bold; }
.btn-primary { background: var(--color-primary, #2563eb); color: white; border: none; padding: 14px; width: 100%; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-bottom: 12px; display: flex; justify-content: center; align-items: center; gap: 8px; }
.btn-primary:hover { background: var(--color-primary-hover, #1d4ed8); }
.btn-outline { background: transparent; color: var(--color-primary, #2563eb); border: 2px solid var(--color-primary, #2563eb); }
.btn-outline:hover { background: #eff6ff; }
.btn-secondary { display: block; text-align: center; background: #e2e8f0; color: #1e293b; padding: 14px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 1rem; }
.btn-secondary:hover { background: #cbd5e1; }
.import-area { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.loading { color: var(--color-primary, #2563eb); font-weight: bold; text-align: center; }
.aviso { border-left: 4px solid var(--color-warning, #d97706); }
.aviso h3 { margin-top: 0; color: var(--color-warning, #d97706); font-size: 1.1rem; }
.aviso ul { padding-left: 20px; margin-bottom: 0; font-size: 0.9rem; color: var(--color-muted, #64748b); line-height: 1.5; }

.menu-card h2 { margin-top: 0; font-size: 1.2rem; margin-bottom: 12px; }
.menu-link { display: flex; justify-content: space-between; align-items: center; text-decoration: none; color: var(--color-text, #1e293b); background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-weight: bold; transition: background 0.2s; }
.menu-link:hover { background: #e2e8f0; }

</style>