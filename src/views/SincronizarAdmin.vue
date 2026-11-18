<!-- src/views/SincronizarAdmin.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getAllItems, addItem } from '../infrastructure/database.js';
import { showToast, showConfirm } from '../application/NotificationService.js';
import { descriptografarDados } from '../infrastructure/crypto-util.js';
import { v4 as uuidv4 } from 'uuid';

const leitorAtivo = ref(true);
const statusLeitura = ref('idle');
const processando = ref(false);

let html5QrcodeScanner = null;

// Staging
const staging = ref([]); // Cada item: { colaboradorId, colaboradorNome, marcacoes: [] }
const motivos = ref([]);
const todasMarcacoesExistentes = ref([]);

// Controle de leitura
const pacotesRecebidos = ref(new Set());
const totalPacotesEsperados = ref(0);
const leituraCompleta = ref(false);

// Modal de edição no staging
const editandoIndex = ref(null);
const formEdicao = ref(null);

onMounted(async () => {
  motivos.value = (await getAllItems('motivos')).sort((a, b) => a.ordem - b.ordem);
  todasMarcacoesExistentes.value = await getAllItems('marcacoes');
  iniciarLeitor();
});

onUnmounted(() => {
  pararLeitor();
});

function iniciarLeitor() {
  pacotesRecebidos.value.clear();
  totalPacotesEsperados.value = 0;
  leituraCompleta.value = false;
  statusLeitura.value = 'idle';
  leitorAtivo.value = true;

  setTimeout(() => {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    html5QrcodeScanner.render(onScanSuccess, () => {});
  }, 100);

  setTimeout(async () => {
    try {
      if (html5QrcodeScanner) {
        const capabilities = html5QrcodeScanner.getRunningTrackCapabilities();
        const constraints = {
          width: { ideal: 1000 },
          frameRate: { ideal: capabilities.frameRate?.max || 30 },
          ...(capabilities.zoom > 2 ? [{ zoom: 2.0 }] : []),
          ...(capabilities.focusDistance ? [{ focusDistance: 1 }] : [])
        };
        await html5QrcodeScanner.applyVideoConstraints(constraints);
      }
    } catch (e) {
      console.warn('Não foi possível ajustar câmera:', e);
    }
  }, 1500);
}

async function pararLeitor() {
  if (html5QrcodeScanner) {
    await html5QrcodeScanner.clear().catch(e => console.error(e));
    html5QrcodeScanner = null;
  }
  leitorAtivo.value = false;
}

async function onScanSuccess(decodedText, decodedResult) {
  if (leituraCompleta.value) return;

  statusLeitura.value = 'success';

  try {
    const jsonString = await descriptografarDados(decodedText);
    const jsonLimpo = jsonString.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    const pacote = JSON.parse(jsonLimpo);

    if (pacote.app !== 'PontoFolha') throw new Error('App inválido');

    // Atualiza total esperado
    if (pacote.paginacao && pacote.paginacao.total > 0) {
      totalPacotesEsperados.value = pacote.paginacao.total;
    }

    const idPacote = `${pacote.colaboradorId}-${pacote.paginacao?.atual || 1}`;
    if (pacotesRecebidos.value.has(idPacote)) {
      // Já recebido, ignora
      return;
    }

    // Filtra marcações que já existem no banco
    const marcasFiltradas = pacote.marcacoes.filter(m =>
      !todasMarcacoesExistentes.value.some(ex => ex.id === m.id)
    );

    if (marcasFiltradas.length > 0) {
      // Encontra ou cria grupo no staging
      let grupo = staging.value.find(g => g.colaboradorId === pacote.colaboradorId);
      if (!grupo) {
        grupo = {
          stagingId: uuidv4(),
          colaboradorId: pacote.colaboradorId,
          colaboradorNome: pacote.colaboradorNome,
          marcacoes: []
        };
        staging.value.push(grupo);
      }
      // Adiciona marcações formatadas
      for (const m of marcasFiltradas) {
        grupo.marcacoes.push({
          ...m,
          motivoNome: motivos.value.find(mot => mot.id === m.motivoId)?.nome || 'Desconhecido',
          isNova: true
        });
      }
    }

    pacotesRecebidos.value.add(idPacote);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    const lidos = pacotesRecebidos.value.size;
    showToast(`Pacote ${pacote.paginacao?.atual || 1} de ${totalPacotesEsperados.value} recebido`, 'success', false);

    setTimeout(() => { statusLeitura.value = 'idle'; }, 500);

    if (lidos === totalPacotesEsperados.value) {
      leituraCompleta.value = true;
      await pararLeitor();
      showToast('🎉 Leitura Completa! Revise e confirme.', 'success');
    }

  } catch (e) {
    console.error(e);
    statusLeitura.value = 'error';
    setTimeout(() => { statusLeitura.value = 'idle'; }, 1000);
  }
}

// ========== STAGING ==========

function removerDoStaging(colabIdx, marcId) {
  const grupo = staging.value[colabIdx];
  grupo.marcacoes = grupo.marcacoes.filter(m => m.id !== marcId);
  if (grupo.marcacoes.length === 0) {
    staging.value.splice(colabIdx, 1);
  }
  showToast('Ponto removido da revisão.', 'info');
}

function abrirEdicao(colabIdx, marcIdx) {
  editandoIndex.value = { colabIdx, marcIdx };
  formEdicao.value = JSON.parse(JSON.stringify(staging.value[colabIdx].marcacoes[marcIdx]));
  if (formEdicao.value.dataHoraLocal.length > 16) {
    formEdicao.value.dataHoraLocal = formEdicao.value.dataHoraLocal.slice(0, 16);
  }
}

function atualizarNatureza() {
  const motivo = motivos.value.find(m => m.id === formEdicao.value.motivoId);
  if (motivo) formEdicao.value.natureza = motivo.natureza;
}

function salvarEdicaoStaging() {
  const { colabIdx, marcIdx } = editandoIndex.value;
  const marcacao = formEdicao.value;
  marcacao.motivoNome = motivos.value.find(m => m.id === marcacao.motivoId)?.nome || 'Desconhecido';
  staging.value[colabIdx].marcacoes[marcIdx] = marcacao;
  editandoIndex.value = null;
  showToast('Ajuste salvo na revisão.', 'success');
}

async function confirmarImportacaoFinal() {
  if (staging.value.length === 0 || processando.value) return;
  const totalPontos = staging.value.reduce((acc, g) => acc + g.marcacoes.length, 0);

  const confirmou = await showConfirm(
    'Confirmar Importação',
    `Deseja salvar ${totalPontos} marcações de ${staging.value.length} colaborador(es) no banco de dados definitivo?`
  );
  if (!confirmou) return;
  processando.value = true;

  try {
    let importados = 0;
    for (const grupo of staging.value) {
      // Garante colaborador existente
      const colaboradores = await getAllItems('colaboradores');
      let colab = colaboradores.find(c => c.id === grupo.colaboradorId);
      if (!colab) {
        await addItem('colaboradores', {
          id: grupo.colaboradorId,
          nome: grupo.colaboradorNome,
          situacao: 'ativo',
          dataAdmissao: new Date().toISOString().split('T')[0],
          criadoEm: new Date().toISOString()
        });
        await addItem('valoresHora', {
          id: uuidv4(),
          colaboradorId: grupo.colaboradorId,
          valorCentavos: 0,
          vigenciaInicio: new Date().toISOString().split('T')[0],
          vigenciaFim: null
        });
      }

      for (const m of grupo.marcacoes) {
        await addItem('marcacoes', {
          id: m.id,
          colaboradorId: grupo.colaboradorId,
          dataHoraLocal: m.dataHoraLocal,
          motivoId: m.motivoId,
          natureza: m.natureza,
          origem: 'colaborador',
          inconsistente: false,
          sincronizado: true,
          criadoEm: m.criadoEm || new Date().toISOString()
        });
        importados++;
      }
    }

    showToast(`${importados} pontos importados com sucesso!`, 'success');
    staging.value = [];
    todasMarcacoesExistentes.value = await getAllItems('marcacoes');
    iniciarLeitor();
  } catch (e) {
    console.error(e);
    showToast('Erro ao importar pontos.', 'error');
  } finally {
    processando.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <h1>Sincronizar Pontos</h1>
      <p>Leia o QR Code e revise antes de importar</p>
    </header>

    <!-- Área da Câmera -->
    <div v-if="leitorAtivo" class="card camera-card">
      <div class="camera-feedback" :class="statusLeitura"></div>
      <div id="reader" class="camera-reader"></div>

      <!-- Barra de progresso -->
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

      <p class="camera-hint">
        Aponte para o QR Code. O colaborador está em loop, pode aguardar a leitura.
      </p>
      <button v-if="staging.length > 0" @click="pararLeitor" class="btn btn-outline" style="margin: 0 16px 16px; width: calc(100% - 32px);">
        Parar Leitura e Revisar
      </button>
    </div>

    <!-- Staging (Revisão) -->
    <div v-if="staging.length > 0" class="staging-area">
      <div class="staging-header">
        <h2 class="section-title">📋 Revisão ({{ staging.reduce((acc, g) => acc + g.marcacoes.length, 0) }} pontos)</h2>
        <button v-if="!leitorAtivo" @click="iniciarLeitor" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
          + Ler Mais
        </button>
      </div>

      <div v-for="(grupo, colabIdx) in staging" :key="grupo.stagingId" class="card staging-card">
        <div class="staging-colab-header">
          <h3>{{ grupo.colaboradorNome }}</h3>
          <span class="badge">{{ grupo.marcacoes.length }} pontos</span>
        </div>

        <div class="staging-list">
          <div v-for="(marc, marcIdx) in grupo.marcacoes" :key="marc.id" class="staging-item">
            <div class="item-info">
              <span class="item-date">{{ marc.dataHoraLocal.split('T')[0].split('-').reverse().join('/') }}</span>
              <span class="item-time">{{ new Date(marc.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</span>
              <span class="item-motivo" :class="marc.natureza">{{ marc.motivoNome }}</span>
            </div>
            <div class="item-actions">
              <button @click="abrirEdicao(colabIdx, marcIdx)" class="btn-icon" title="Editar">✏️</button>
              <button @click="removerDoStaging(colabIdx, marc.id)" class="btn-icon" title="Remover">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <div class="staging-footer">
        <button @click="confirmarImportacaoFinal" class="btn btn-success btn-block" :disabled="processando" style="padding: 16px; font-size: 1.1rem;">
          {{ processando ? 'Importando...' : '✅ Confirmar e Salvar no Banco' }}
        </button>
        <button @click="staging = []; iniciarLeitor()" class="btn btn-outline btn-block" style="margin-top: 12px;">
          Descartar Tudo
        </button>
      </div>
    </div>

    <!-- Modal de Edição -->
    <div v-if="editandoIndex" class="modal-overlay no-print" @click.self="editandoIndex = null">
      <div class="modal-box">
        <h3 class="modal-title">Ajustar Ponto</h3>
        <div class="form-group">
          <label class="form-label">Data e Hora</label>
          <input type="datetime-local" v-model="formEdicao.dataHoraLocal" class="form-input" step="1" />
        </div>
        <div class="form-group">
          <label class="form-label">Motivo</label>
          <select v-model="formEdicao.motivoId" @change="atualizarNatureza" class="form-select">
            <option v-for="m in motivos" :key="m.id" :value="m.id">{{ m.nome }} ({{ m.natureza }})</option>
          </select>
        </div>
        <div class="modal-actions" style="margin-top: 24px;">
          <button @click="editandoIndex = null" class="btn btn-outline">Cancelar</button>
          <button @click="salvarEdicaoStaging" class="btn btn-primary">Salvar Ajuste</button>
        </div>
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
.camera-feedback {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  border: 4px solid transparent;
  border-radius: var(--radius-lg);
  transition: border-color 0.2s, background 0.2s;
  z-index: 10;
}
.camera-feedback.success { border-color: var(--color-success); background: rgba(16, 185, 129, 0.2); }
.camera-feedback.error { border-color: var(--color-danger); background: rgba(239, 68, 68, 0.2); }
.camera-reader { width: 100%; min-height: 300px; background: #000; }
:deep(#reader video) { border-radius: 0 !important; }
:deep(#reader__dashboard_section) { padding: 16px !important; background: white; }
:deep(#reader__dashboard_section button) { background: var(--color-primary) !important; color: white !important; border: none !important; padding: 10px 16px !important; border-radius: var(--radius-md) !important; font-weight: bold !important; cursor: pointer !important; }
.camera-hint { text-align: center; padding: 16px; font-size: 0.85rem; color: var(--color-muted); margin: 0; }

/* Barra de progresso */
.progress-bar-container {
  background: white;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.progress-text {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 8px;
  text-align: center;
}
.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--color-success);
  transition: width 0.3s ease;
  border-radius: var(--radius-full);
}

/* Staging */
.staging-area { display: flex; flex-direction: column; gap: 16px; }
.staging-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.staging-card { border-left: 4px solid var(--color-primary); padding: 16px; }
.staging-colab-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
.staging-colab-header h3 { margin: 0; font-size: 1.1rem; }
.badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; }
.staging-list { display: flex; flex-direction: column; gap: 8px; }
.staging-item { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid #e2e8f0; }
.item-info { display: flex; align-items: center; gap: 12px; }
.item-date { font-size: 0.75rem; font-weight: 600; color: var(--color-muted); }
.item-time { font-size: 0.95rem; font-weight: 800; color: var(--color-text); }
.item-motivo { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
.item-motivo.trabalho { background: var(--color-success-light); color: #065f46; }
.item-motivo.pausa { background: var(--color-warning-light); color: #92400e; }
.item-actions { display: flex; gap: 4px; }
.btn-icon { background: white; border: 1px solid #cbd5e1; border-radius: 6px; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s; }
.btn-icon:hover { background: #f1f5f9; }
.staging-footer { margin-top: 16px; margin-bottom: 32px; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 16px; }
.modal-box { background: var(--color-surface, #fff); width: 100%; max-width: 400px; border-radius: var(--radius-lg, 12px); padding: 24px; box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.2)); animation: popIn 0.2s ease-out; }
.modal-title { margin: 0 0 16px 0; font-size: 1.2rem; color: var(--color-text, #1e293b); font-weight: 800; }
.modal-actions { display: flex; gap: 12px; }
.modal-actions .btn { flex: 1; }
@keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>