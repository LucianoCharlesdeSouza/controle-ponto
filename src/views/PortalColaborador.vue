<!-- src/views/PortalColaborador.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { showToast, showConfirm, showPrompt } from '../application/NotificationService.js';

const abaAtiva = ref('ponto'); // 'ponto' ou 'sincronizar'
const colaboradores = ref([]);
const motivos = ref([]);
const colaboradorSelecionadoId = ref('');
const marcacoesHoje = ref([]);
const todasMarcacoes = ref([]);
const registrando = ref(false);

// Dados do QR Code
const qrCodeDataUrl = ref('');
const textoJson = ref('');

onMounted(async () => {
  const todosColab = await getAllItems('colaboradores');
  colaboradores.value = todosColab.filter(c => c.situacao === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));
  
  motivos.value = (await getAllItems('motivos')).filter(m => m.ativo !== false).sort((a, b) => a.ordem - b.ordem);
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
  
  await carregarDados();
});

const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

const colaboradorAtualNome = computed(() => {
  return colaboradores.value.find(c => c.id === colaboradorSelecionadoId.value)?.nome || 'Selecione';
});

const minhasMarcacoesHoje = computed(() => {
  return marcacoesHoje.value
    .filter(m => m.colaboradorId === colaboradorSelecionadoId.value)
    .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));
});

async function carregarDados() {
  const agora = new Date();
  const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  
  const todas = await getAllItems('marcacoes');
  todasMarcacoes.value = todas;
  marcacoesHoje.value = todas.filter(m => m.dataHoraLocal.startsWith(hojeStr));
}

async function registrarPonto(motivo) {
  if (!colaboradorSelecionadoId.value || registrando.value) return;
  registrando.value = true;

  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  const dataHoraLocal = new Date(agora.getTime() - offset).toISOString().slice(0, 19);

  const novaMarcacao = {
    id: uuidv4(),
    colaboradorId: colaboradorSelecionadoId.value,
    dataHoraLocal: dataHoraLocal,
    motivoId: motivo.id,
    natureza: motivo.natureza,
    origem: 'colaborador',
    inconsistente: false,
    sincronizado: false, // Flag para saber se já foi pro admin
    criadoEm: new Date().toISOString()
  };

  try {
    await addItem('marcacoes', novaMarcacao);
    await carregarDados();
    if (navigator.vibrate) navigator.vibrate(50);
    showToast('Ponto registrado!', 'success');
  } catch (e) {
    showToast('Erro ao registrar ponto.', 'error');
  } finally {
    setTimeout(() => { registrando.value = false; }, 2000); 
  }
}

// --- LÓGICA DE GERAÇÃO DE QR CODE ---

async function gerarQRCode() {
  // Pega todas as marcações deste colaborador que ainda não foram sincronizadas
  const pendentes = todasMarcacoes.value.filter(
    m => m.colaboradorId === colaboradorSelecionadoId.value && !m.sincronizado
  );

  if (pendentes.length === 0) {
    showToast('Nenhum ponto pendente de sincronização.', 'info');
    return;
  }

  // Monta o pacote de dados
  const pacote = {
    app: 'PontoFolha',
    versao: 1,
    colaboradorId: colaboradorSelecionadoId.value,
    colaboradorNome: colaboradorAtualNome.value,
    marcacoes: pendentes.map(m => ({
      id: m.id,
      dataHoraLocal: m.dataHoraLocal,
      motivoId: m.motivoId,
      natureza: m.natureza,
      criadoEm: m.criadoEm
    }))
  };

  textoJson.value = JSON.stringify(pacote);

  try {
    // Gera a imagem do QR Code
    const url = await QRCode.toDataURL(textoJson.value, {
      width: 600,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    qrCodeDataUrl.value = url;
  } catch (err) {
    showToast('Erro ao gerar QR Code.', 'error');
  }
}

async function confirmarSincronizacao() {
  const confirmou = await showConfirm(
    'Concluir Sincronização', 
    'Tem certeza que o administrador já leu o QR Code? Os pontos serão marcados como enviados.'
  );
  
  if (!confirmou) return;

  try {
    const pendentes = todasMarcacoes.value.filter(
      m => m.colaboradorId === colaboradorSelecionadoId.value && !m.sincronizado
    );

    for (const m of pendentes) {
      await putItem('marcacoes', JSON.parse(JSON.stringify({ ...m, sincronizado: true })));
    }

    showToast('Pontos marcados como sincronizados!', 'success');
    qrCodeDataUrl.value = '';
    await carregarDados();
    abaAtiva.value = 'ponto';
  } catch (e) {
    showToast('Erro ao atualizar status.', 'error');
  }
}
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <h1>Portal do Colaborador</h1>
      <p>{{ dataAtual }}</p>
    </header>

    <div class="card filter-card">
      <label class="form-label">Quem é você?</label>
      <select v-model="colaboradorSelecionadoId" class="form-select">
        <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
    </div>

    <div class="tabs-container">
      <button :class="{ active: abaAtiva === 'ponto' }" @click="abaAtiva = 'ponto'">Bater Ponto</button>
      <button :class="{ active: abaAtiva === 'sincronizar' }" @click="abaAtiva = 'sincronizar'">Sincronizar</button>
    </div>

    <!-- ABA BATER PONTO -->
    <div v-if="abaAtiva === 'ponto'">
      <div class="status-panel card">
        <div class="status-content">
          <div class="status-info">
            <span class="status-name">{{ colaboradorAtualNome }}</span>
            <span class="status-label">Total de hoje</span>
          </div>
          <div class="status-time">
            {{ minhasMarcacoesHoje.length }} pontos
          </div>
        </div>
      </div>

      <div class="actions-grid">
        <button 
          v-for="motivo in motivos" 
          :key="motivo.id"
          @click="registrarPonto(motivo)"
          class="btn-action"
          :class="motivo.natureza === 'trabalho' ? 'btn-entrada' : 'btn-pausa'"
          :disabled="registrando"
        >
          <span class="action-icon">{{ motivo.natureza === 'trabalho' ? '▶️' : '⏸️' }}</span>
          <span class="action-text">{{ motivo.nome }}</span>
        </button>
      </div>

      <div class="card">
        <h2 class="section-title">Histórico de Hoje</h2>
        <ul v-if="minhasMarcacoesHoje.length > 0" class="history-list">
          <li v-for="marc in minhasMarcacoesHoje" :key="marc.id">
            <div class="history-time">{{ new Date(marc.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</div>
            <div class="history-motivo" :class="marc.natureza">{{ motivos.find(m => m.id === marc.motivoId)?.nome }}</div>
          </li>
        </ul>
        <p v-else class="empty-state">Nenhuma marcação registrada hoje.</p>
      </div>
    </div>

    <!-- ABA SINCRONIZAR -->
    <div v-if="abaAtiva === 'sincronizar'">
      <div class="card text-center">
        <p class="desc">Envie seus pontos para o administrador de forma offline. Basta gerar o código abaixo e mostrar a tela do seu celular para ele ler.</p>
        
        <button v-if="!qrCodeDataUrl" @click="gerarQRCode" class="btn btn-primary btn-block" style="margin-top: 20px;">
          🔄 Gerar QR Code de Ponto
        </button>

        <div v-if="qrCodeDataUrl" class="qr-area">
          <img :src="qrCodeDataUrl" alt="QR Code" class="qr-image" />
          <p class="qr-hint">Mostre esta tela para o administrador.</p>
          
          <button @click="confirmarSincronizacao" class="btn btn-success btn-block" style="margin-top: 24px;">
            ✅ Já fui Sincronizado
          </button>
          <button @click="qrCodeDataUrl = ''" class="btn btn-outline btn-block" style="margin-top: 12px;">
            Cancelar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.filter-card { border-top: 4px solid var(--color-primary); margin-bottom: 16px; }

.tabs-container {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}
.tabs-container button {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.tabs-container button.active {
  background: white;
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* Painel de Status */
.status-panel {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  color: white;
  padding: 24px;
  border: none;
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
}
.status-content { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.status-info { display: flex; flex-direction: column; flex: 1; }
.status-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }
.status-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; opacity: 0.8; }
.status-time { font-size: 1.5rem; font-weight: 800; }

/* Botões de Ação */
.actions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
.btn-action {
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  padding: 24px 12px; border: none; border-radius: var(--radius-lg);
  font-size: 1.1rem; font-weight: 700; color: white; cursor: pointer; transition: all 0.15s;
}
.btn-action:active { transform: scale(0.95); }
.btn-action:disabled { opacity: 0.5; }
.action-icon { font-size: 2rem; margin-bottom: 8px; }
.btn-entrada { background: var(--color-success); }
.btn-pausa { background: var(--color-warning); }

/* Histórico */
.history-list { list-style: none; padding: 0; margin: 0; }
.history-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.history-time { font-weight: 800; font-size: 1.1rem; }
.history-motivo { font-size: 0.85rem; font-weight: 700; padding: 4px 10px; border-radius: var(--radius-full); }
.history-motivo.trabalho { background: var(--color-success-light); color: #065f46; }
.history-motivo.pausa { background: var(--color-warning-light); color: #92400e; }

/* QR Code */
.text-center { text-align: center; }
.desc { color: var(--color-muted); font-size: 0.9rem; margin-bottom: 20px; }
.qr-area { display: flex; flex-direction: column; align-items: center; margin-top: 20px; }
.qr-image { width: 100%; max-width: 300px; border-radius: var(--radius-md); box-shadow: var(--shadow-md); border: 1px solid #e2e8f0; }
.qr-hint { font-size: 0.85rem; color: var(--color-muted); margin-top: 12px; font-weight: 600; }

.empty-state { text-align: center; padding: 20px; color: var(--color-muted); }
</style>