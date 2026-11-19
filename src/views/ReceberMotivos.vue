<!-- src/views/ReceberMotivos.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getAllItems, putItem } from '../infrastructure/database.js';
import { showToast, showConfirm } from '../application/NotificationService.js';

const leitorAtivo = ref(true);
const motivosRecebidos = ref([]);
const motivosExistentes = ref([]);
const processando = ref(false);
let html5QrcodeScanner = null;

// Conjunto de pacotes já lidos (para não ler o mesmo duas vezes)
const pacotesRecebidos = ref(new Set());
const totalPacotesEsperados = ref(0);

onMounted(async () => {
  // Carrega o que já temos no banco
  motivosExistentes.value = await getAllItems('motivos');
  iniciarLeitor();
});

onUnmounted(() => {
  pararLeitor();
});

function iniciarLeitor() {
  leitorAtivo.value = true;
  pacotesRecebidos.value.clear();
  totalPacotesEsperados.value = 0;
  motivosRecebidos.value = [];

  setTimeout(() => {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader-motivos", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    html5QrcodeScanner.render(onScanSuccess, () => {});
  }, 100);
}

async function pararLeitor() {
  if (html5QrcodeScanner) {
    await html5QrcodeScanner.clear().catch(e => console.error(e));
    html5QrcodeScanner = null;
  }
  leitorAtivo.value = false;
}

async function onScanSuccess(decodedText, decodedResult) {
  try {
    const pacote = JSON.parse(decodedText);
    
    if (pacote.app !== 'PontoFolha' || pacote.tipo !== 'config_motivos') {
      showToast('QR Code inválido. Não é de Motivos.', 'error');
      return;
    }

    const idPacote = `motivo-${pacote.paginacao.atual}`;
    if (pacotesRecebidos.value.has(idPacote)) return;

    if (pacote.paginacao && pacote.paginacao.total > 0) {
      totalPacotesEsperados.value = pacote.paginacao.total;
    }

    // Adiciona à lista de revisão aplicando a validação de ID
    for (const m of pacote.motivos) {
      const existente = motivosExistentes.value.find(ex => ex.id === m.id);
      
      const itemRevisao = {
        ...m,
        jaExisteId: !!existente,         // Se o ID já está no banco
        nomeIgual: existente ? existente.nome === m.nome : false, // Se o nome coincide
        selecionado: true                // Por padrão vem marcado para importar
      };

      // Evita duplicar na lista de staging se o pacote for lido de novo
      if (!motivosRecebidos.value.some(mot => mot.id === m.id)) {
        motivosRecebidos.value.push(itemRevisao);
      }
    }

    pacotesRecebidos.value.add(idPacote);
    
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    showToast(`Pacote ${pacote.paginacao?.atual} lido`, 'success', false);

    if (pacotesRecebidos.value.size === totalPacotesEsperados.value) {
      await pararLeitor();
      showToast('🎉 Leitura completa! Revise abaixo.', 'success');
    }

  } catch (e) {
    console.error(e);
    showToast('QR Code inválido.', 'error');
  }
}

function removerDaRevisao(index) {
  motivosRecebidos.value.splice(index, 1);
}

async function confirmarImportacao() {
  const selecionados = motivosRecebidos.value.filter(m => m.selecionado);
  
  if (selecionados.length === 0) {
    showToast('Nenhum motivo selecionado para importar.', 'info');
    return;
  }

  const confirmou = await showConfirm(
    'Importar Motivos', 
    `Deseja salvar ${selecionados.length} motivos no banco de dados?`
  );
  
  if (!confirmou) return;
  processando.value = true;

  try {
    // Como o ID é a chave primária no IndexedDB, um 'putItem' com o mesmo ID
    // sobrescreve. Se o ID é novo, ele adiciona.
    for (const m of selecionados) {
      // Remove as flags de controle antes de salvar
      const motivoPuro = {
        id: m.id,
        nome: m.nome,
        natureza: m.natureza,
        ordem: m.ordem,
        ativo: true
      };
      
      await putItem('motivos', JSON.parse(JSON.stringify(motivoPuro)));
    }

    showToast(`${selecionados.length} motivos importados!`, 'success');
    
    // Recarrega os existentes para atualizar a tela se o usuário quiser ler mais
    motivosExistentes.value = await getAllItems('motivos');
    motivosRecebidos.value = [];
    iniciarLeitor();

  } catch (e) {
    console.error(e);
    showToast('Erro ao importar motivos.', 'error');
  } finally {
    processando.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <router-link to="/configuracoes" class="btn-back" style="position: absolute; left: 16px; font-size: 1.5rem;">←</router-link>
      <h1>Receber Motivos</h1>
      <p>Importar via QR Code</p>
    </header>

    <!-- Área da Câmera -->
    <div v-if="leitorAtivo" class="card camera-card">
      <div id="reader-motivos" class="camera-reader"></div>
      
      <div v-if="totalPacotesEsperados > 0" class="progress-bar-container">
        <div class="progress-text">
          Lendo: {{ pacotesRecebidos.size }} / {{ totalPacotesEsperados }} pacotes
        </div>
        <div class="progress-bar-bg">
          <div 
            class="progress-bar-fill" 
            :style="{ width: (pacotesRecebidos.size / totalPacotesEsperados) * 100 + '%' }"
          ></div>
        </div>
      </div>

      <p class="camera-hint">Aponte para o QR Code de Motivos no celular de origem.</p>
      <button @click="pararLeitor" class="btn btn-outline" style="margin: 0 16px 16px; width: calc(100% - 32px);">
        Parar Leitura e Revisar
      </button>
    </div>

    <!-- Área de Revisão -->
    <div v-if="motivosRecebidos.length > 0" class="staging-area">
      <div class="staging-header">
        <h2 class="section-title">📋 Revisão de Motivos ({{ motivosRecebidos.length }})</h2>
        <button v-if="!leitorAtivo" @click="iniciarLeitor" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
          + Ler Mais
        </button>
      </div>

      <div class="card staging-card">
        <div class="staging-list">
          <div v-for="(m, idx) in motivosRecebidos" :key="m.id" class="staging-item">
            
            <input type="checkbox" v-model="m.selecionado" class="checkbox" />

            <div class="item-info">
              <span class="item-name">{{ m.nome }}</span>
              <span class="badge-natureza" :class="m.natureza">
                {{ m.natureza === 'trabalho' ? '⏱️ Trabalho' : '☕ Pausa' }}
              </span>
            </div>

            <!-- Avisos de Colisão -->
            <div class="item-status">
              <span v-if="m.jaExisteId && m.nomeIgual" class="status-ok">✅ Já existe (Igual)</span>
              <span v-else-if="m.jaExisteId && !m.nomeIgual" class="status-warn">⚠️ ID já existe (Nome diferente)</span>
              <span v-else class="status-new">🆕 Novo</span>
            </div>

            <button @click="removerDaRevisao(idx)" class="btn-icon" title="Remover">🗑️</button>
          </div>
        </div>
      </div>

      <div class="staging-footer">
        <button @click="confirmarImportacao" class="btn btn-success btn-block" :disabled="processando" style="padding: 16px; font-size: 1.1rem;">
          {{ processando ? 'Importando...' : '✅ Importar Selecionados' }}
        </button>
        <button @click="motivosRecebidos = []; iniciarLeitor()" class="btn btn-outline btn-block" style="margin-top: 12px;">
          Descartar Tudo
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Câmera */
.camera-card {
  position: relative;
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 2px dashed #cbd5e1;
  background: #f8fafc;
  margin-bottom: 24px;
}
.camera-reader { width: 100%; min-height: 300px; background: #000; }
:deep(#reader video) { border-radius: 0 !important; }
:deep(#reader__dashboard_section) { padding: 16px !important; background: white; }
:deep(#reader__dashboard_section button) { background: var(--color-primary) !important; color: white !important; border: none !important; padding: 10px 16px !important; border-radius: var(--radius-md) !important; font-weight: bold !important; cursor: pointer !important; }
.camera-hint { text-align: center; padding: 16px; font-size: 0.85rem; color: var(--color-muted); margin: 0; }

/* Barra de progresso */
.progress-bar-container { background: white; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
.progress-text { font-size: 0.85rem; font-weight: 700; color: var(--color-primary); margin-bottom: 8px; text-align: center; }
.progress-bar-bg { width: 100%; height: 8px; background: #e2e8f0; border-radius: var(--radius-full); overflow: hidden; }
.progress-bar-fill { height: 100%; background: var(--color-success); transition: width 0.3s ease; border-radius: var(--radius-full); }

/* Staging */
.staging-area { display: flex; flex-direction: column; gap: 16px; }
.staging-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.staging-card { border-left: 4px solid var(--color-primary); padding: 0; overflow: hidden; }
.staging-list { display: flex; flex-direction: column; }
.staging-item { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid #f1f5f9; }
.staging-item:last-child { border-bottom: none; }

.checkbox { width: 20px; height: 20px; cursor: pointer; accent-color: var(--color-primary); }

.item-info { flex: 1; display: flex; align-items: center; gap: 8px; }
.item-name { font-weight: 700; font-size: 1rem; color: var(--color-text); }
.badge-natureza { font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.badge-natureza.trabalho { background: var(--color-success-light); color: #065f46; }
.badge-natureza.pausa { background: var(--color-warning-light); color: #92400e; }

.item-status { font-size: 0.75rem; font-weight: 600; }
.status-ok { color: var(--color-success); }
.status-warn { color: var(--color-warning); }
.status-new { color: var(--color-primary); }

.btn-icon { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.2s; }
.btn-icon:hover { background: #fee2e2; }

.staging-footer { margin-top: 16px; margin-bottom: 32px; }

.btn-back {
  text-decoration: none;
  color: var(--color-text);
  font-weight: bold;
}
</style>