<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getDB, putItem, getAllItems } from '../infrastructure/database.js';
import { 
  compartilharOuBaixarBackup, 
  baixarBackup, 
  restaurarBackup, 
  restaurarBackupParcial, 
  ultimoBackup, 
  estimativaArmazenamento 
} from '../infrastructure/backup-service.js';
import { showToast, showConfirm } from '../application/NotificationService.js';


const importando = ref(false);
const dataUltimoBackup = ref(null);
const espacoUsado = ref(null);

const modalRestaurarAberto = ref(false);
const fileSelecionado = ref(null);
const opcoesRestauracao = reactive({
  cadastros: true,
  movimentacoes: true,
  substituir: false,
  dataInicio: '',
  dataFim: ''
});

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

function prepararRestauracao(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileSelecionado.value = file;

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  opcoesRestauracao.dataInicio = primeiroDia;
  opcoesRestauracao.dataFim = ultimoDia;

  modalRestaurarAberto.value = true;
  event.target.value = '';
}

async function executarRestauracaoParcial() {
  if (!fileSelecionado.value) return;

  if (!opcoesRestauracao.cadastros && !opcoesRestauracao.movimentacoes) {
    showToast('Selecione pelo menos uma opção.', 'error');
    return;
  }

  modalRestaurarAberto.value = false;
  importando.value = true;

  try {

    if (opcoesRestauracao.substituir) {
      const db = await getDB();
      const txMarc = db.transaction('marcacoes', 'readwrite');
      await new Promise(res => txMarc.objectStore('marcacoes').clear().onsuccess = res);
      
      const txAjustes = db.transaction('ajustes', 'readwrite');
      await new Promise(res => txAjustes.objectStore('ajustes').clear().onsuccess = res);
    }

    const resultado = await restaurarBackupParcial(fileSelecionado.value, opcoesRestauracao);
    showToast(`Sucesso! ${resultado.colaboradores} colab., ${resultado.marcacoes} pontos, ${resultado.ajustes} ajustes restaurados.`, 'success', false);
    
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
    importando.value = false;
  }
}


async function zerarBanco() {
  const confirmou = await showConfirm(
    'Apagar Todos os Dados', 
    'ATENÇÃO ABSOLUTA: Isso apagará TODOS os colaboradores, pontos, ajustes e histórico. O sistema voltará ao estado de fábrica. Deseja continuar?'
  );
  
  if (!confirmou) return;

  const confirmou2 = await showConfirm(
    'Tem Certeza?', 
    'Esta ação NÃO PODE ser desfeita sem um backup. Confirme novamente.'
  );

  if (!confirmou2) return;

  try {
    importando.value = true;
    const db = await getDB();
    const stores = ['colaboradores', 'motivos', 'valoresHora', 'marcacoes', 'ajustes', 'settings'];
    
    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    }

    showToast('Base de dados zerada com sucesso!', 'success');
    setTimeout(() => window.location.reload(), 2000);
  } catch (e) {
    showToast('Erro ao zerar base: ' + e.message, 'error');
    importando.value = false;
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
    
    <div class="card action-card">
      <h2 class="section-title">🔄 Sincronização</h2>
      <router-link to="/sincronizar" class="menu-link">
        <div class="menu-icon">📷</div>
        <div class="menu-text">
          <strong>Receber Pontos via QR Code</strong>
          <span>Leia o QR Code gerado no celular do colaborador</span>
        </div>
        <div class="menu-arrow">→</div>
      </router-link>
    </div>

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
        
        <label class="btn btn-secondary btn-block">
          📤 Selecionar Arquivo de Backup
          <input type="file" accept=".ptbackup,.json" @change="prepararRestauracao" style="display: none;" />
        </label>
      </div>

      <div class="divider"></div>
      <!-- Card de Zona de Perigo -->
      <div class="card danger-card">
        <h2 class="section-title" style="color: var(--color-danger);">🚨 Zona de Perigo</h2>
        <p class="desc">Se você deseja começar do zero ou aplicar uma restauração exata de um período, você pode apagar os registros atuais.</p>
        
        <button @click="zerarBanco" class="btn btn-outline btn-block" style="border-color: var(--color-danger); color: var(--color-danger);">
          🗑️ Limpar Todos os Dados
        </button>
      </div>        
    </div>

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

    <div v-if="modalRestaurarAberto" class="modal-overlay no-print" @click.self="modalRestaurarAberto = false">
      <div class="modal-box" style="max-width: 420px;">
        <h3 class="modal-title">Restauração Seletiva</h3>
        <p class="modal-text">Escolha o que deseja importar. Os dados atuais que não forem sobrescritos serão mantidos.</p>

        <div class="options-list">
          <!-- Opção 1: Cadastros -->
          <label class="checkbox-card">
            <input type="checkbox" v-model="opcoesRestauracao.cadastros" />
            <div class="checkbox-info">
              <strong>Cadastros Básicos</strong>
              <small>Colaboradores, Motivos e Valores/Hora</small>
            </div>
          </label>

          <!-- Opção 2: Movimentações -->
          <label class="checkbox-card">
            <input type="checkbox" v-model="opcoesRestauracao.movimentacoes" />
            <div class="checkbox-info">
              <strong>Pontos e Ajustes</strong>
              <small>Restaurar marcações de um período</small>
            </div>
          </label>

          <!-- Datas -->
          <div v-if="opcoesRestauracao.movimentacoes" class="date-range-container">
            <div class="date-input-group">
              <label class="date-label">De:</label>
              <input type="date" v-model="opcoesRestauracao.dataInicio" class="form-input" />
            </div>
            <div class="date-input-group">
              <label class="date-label">Até:</label>
              <input type="date" v-model="opcoesRestauracao.dataFim" class="form-input" />
            </div>
          </div>

          <!-- Opção 3: Substituir (Limpar) -->
          <label class="checkbox-card danger-option">
            <input type="checkbox" v-model="opcoesRestauracao.substituir" />
            <div class="checkbox-info">
              <strong style="color: var(--color-danger);">Limpar dados antes de importar</strong>
              <small>Apagará todos os pontos atuais. Use para períodos exatos.</small>
            </div>
          </label>
        </div>

        <div class="modal-actions">
          <button @click="modalRestaurarAberto = false" class="btn btn-outline">Cancelar</button>
          <button @click="executarRestauracaoParcial" class="btn btn-primary">Restaurar</button>
        </div>
      </div>
    </div>    
  </div>
</template>

<style scoped>
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

.backup-actions { display: flex; flex-direction: column; gap: 12px; }
.btn-block { width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 14px; font-size: 1rem; }
.btn-secondary { background: #e2e8f0; color: #1e293b; cursor: pointer; }
.btn-secondary:hover { background: #cbd5e1; }
.btn-secondary.disabled { opacity: 0.6; cursor: not-allowed; }

.divider { height: 1px; background: #e2e8f0; margin: 24px 0; }

.restore-area { text-align: center; }
.restore-title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin-bottom: 4px; }
.restore-area .desc { margin-bottom: 12px; }

.aviso-card { border-left: 5px solid var(--color-warning); background: #fffbeb; }
.aviso-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.aviso-icon { font-size: 1.2rem; }
.aviso-header h3 { margin: 0; color: #92400e; font-size: 1.1rem; }
.aviso-list { padding-left: 20px; margin: 0; font-size: 0.9rem; color: #78350f; line-height: 1.6; }
.aviso-list strong { font-weight: 800; }

.desc { color: var(--color-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 16px; }



/* Adicione estas classes no final do seu <style scoped> em Configuracoes.vue */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 16px;
}

.modal-box {
  background: var(--color-surface, #fff);
  width: 100%;
  max-width: 450px;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.2));
  animation: popIn 0.2s ease-out;
}

.modal-title {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  color: var(--color-text, #1e293b);
  font-weight: 800;
}

.modal-text {
  color: var(--color-muted, #64748b);
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}
.modal-actions .btn {
  flex: 1; /* Faz os botões ocuparem 50% cada */
  padding: 12px;
}

@keyframes popIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.checkbox-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.checkbox-card:hover {
  border-color: var(--color-primary-light);
  background: #f1f5f9;
}
.checkbox-card input {
  margin-top: 2px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-info {
  display: flex;
  flex-direction: column;
}
.checkbox-info strong {
  color: var(--color-text);
  font-size: 0.95rem;
}
.checkbox-info small {
  color: var(--color-muted);
  font-size: 0.8rem;
  margin-top: 2px;
  line-height: 1.4;
}

/* Opção de Perigo (Limpar) */
.danger-option {
  background: #fef2f2;
  border-color: #fecaca;
}
.danger-option:hover {
  border-color: #fca5a5;
  background: #fee2e2;
}

/* Inputs de Data Lado a Lado */
.date-range-container {
  display: grid;
  grid-template-columns: 1fr; /* No celular, um embaixo do outro */
  gap: 12px;
  background: var(--color-primary-light, #eff6ff);
  padding: 16px;
  border-radius: var(--radius-md, 12px);
  border: 1px solid #bfdbfe;
  width: 100%;
  box-sizing: border-box;
}

@media (min-width: 400px) {
  .date-range-container {
    grid-template-columns: 1fr 1fr;
  }
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.date-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary-hover, #1d4ed8);
}

/* Inputs de data maiores e confortáveis */
.date-input-group input[type="date"] {
  width: 100%;
  min-height: 48px; /* Altura ideal para toque */
  padding: 12px;
  font-size: 1rem; /* Fonte tamanho padrão de app */
  border: 1.5px solid #cbd5e1;
  border-radius: var(--radius-md, 8px);
  background: white;
  color: var(--color-text);
  box-sizing: border-box;
}

.date-input-group input[type="date"]:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
</style>