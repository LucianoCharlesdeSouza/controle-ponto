<!-- src/views/GerarQRCodes.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getAllItems } from '../infrastructure/database.js';
import QRCode from 'qrcode';
import { showToast } from '../application/NotificationService.js';

const colaboradores = ref([]);
const colaboradorSelecionadoId = ref('');

// Controle de transmissão para Motivos
const motivosPacotes = ref([]);
const motivosIndice = ref(0);
let motivosTimer = null; // CORRIGIDO: let em vez de const
const motivosTransmitindo = ref(false);
const motivosQrAtual = ref('');

// Controle de transmissão para Colaborador
const colabPacotes = ref([]);
const colabIndice = ref(0);
let colabTimer = null; // CORRIGIDO: let em vez de const
const colabTransmitindo = ref(false);
const colabQrAtual = ref('');

const TEMPO_PAUSA = 2200; // 2.2 segundos entre pacotes
const TAMANHO_PACOTE = 2; // 2 itens por QR Code

onMounted(async () => {
  colaboradores.value = (await getAllItems('colaboradores'))
    .filter(c => c.situacao === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome));
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
});

onUnmounted(() => {
  pararMotivos();
  pararColab();
});

// ========== MOTIVOS ==========
async function iniciarMotivos() {
  const motivos = await getAllItems('motivos');
  const motivosAtivos = motivos.filter(m => m.ativo !== false);
  
  if (motivosAtivos.length === 0) {
    showToast('Nenhum motivo ativo cadastrado.', 'error');
    return;
  }

  // Divide os motivos em pacotes de TAMANHO_PACOTE
  const pacotes = [];
  for (let i = 0; i < motivosAtivos.length; i += TAMANHO_PACOTE) {
    pacotes.push(motivosAtivos.slice(i, i + TAMANHO_PACOTE));
  }

  motivosPacotes.value = [];
  
  for (let i = 0; i < pacotes.length; i++) {
    const pacote = {
      app: 'PontoFolha',
      tipo: 'config_motivos',
      versao: 1,
      paginacao: { atual: i + 1, total: pacotes.length },
      motivos: pacotes[i].map(m => ({
        id: m.id,
        nome: m.nome,
        natureza: m.natureza,
        ordem: m.ordem
      }))
    };
    const url = await QRCode.toDataURL(JSON.stringify(pacote), {
      width: 600,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    motivosPacotes.value.push(url);
  }

  motivosIndice.value = 0;
  motivosQrAtual.value = motivosPacotes.value[0];
  motivosTransmitindo.value = true;
  iniciarLoopMotivos();
}

function iniciarLoopMotivos() {
  pararMotivos();
  motivosTimer = setInterval(() => {
    motivosIndice.value = (motivosIndice.value + 1) % motivosPacotes.value.length;
    motivosQrAtual.value = motivosPacotes.value[motivosIndice.value];
    if (navigator.vibrate) navigator.vibrate(20);
  }, TEMPO_PAUSA);
}

function pararMotivos() {
  motivosTransmitindo.value = false;
  if (motivosTimer) {
    clearInterval(motivosTimer);
    motivosTimer = null;
  }
}

function cancelarMotivos() {
  pararMotivos();
  motivosQrAtual.value = '';
  motivosPacotes.value = [];
  motivosIndice.value = 0;
}

// ========== COLABORADOR ==========
async function iniciarColab() {
  if (!colaboradorSelecionadoId.value) return;
  
  const colab = colaboradores.value.find(c => c.id === colaboradorSelecionadoId.value);
  const valoresHora = await getAllItems('valoresHora');
  const valoresColab = valoresHora
    .filter(v => v.colaboradorId === colab.id)
    .sort((a, b) => new Date(b.vigenciaInicio) - new Date(a.vigenciaInicio));
  const valorAtual = valoresColab.length > 0 ? valoresColab[0].valorCentavos : 0;

  const pacote = {
    app: 'PontoFolha',
    tipo: 'colaborador',
    versao: 1,
    colaborador: {
      id: colab.id,
      nome: colab.nome,
      cpf: colab.cpf || '',
      dataAdmissao: colab.dataAdmissao
    },
    valorHoraCentavos: valorAtual
  };

  colabPacotes.value = [];
  const url = await QRCode.toDataURL(JSON.stringify(pacote), {
    width: 600,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' }
  });
  colabPacotes.value.push(url);
  colabIndice.value = 0;
  colabQrAtual.value = url;
  colabTransmitindo.value = true;
  iniciarLoopColab();
}

function iniciarLoopColab() {
  pararColab();
  colabTimer = setInterval(() => {
    colabIndice.value = (colabIndice.value + 1) % colabPacotes.value.length;
    colabQrAtual.value = colabPacotes.value[colabIndice.value];
    if (navigator.vibrate) navigator.vibrate(20);
  }, TEMPO_PAUSA);
}

function pararColab() {
  colabTransmitindo.value = false;
  if (colabTimer) {
    clearInterval(colabTimer);
    colabTimer = null;
  }
}

function cancelarColab() {
  pararColab();
  colabQrAtual.value = '';
  colabPacotes.value = [];
  colabIndice.value = 0;
}
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <h1>Configurar Celular</h1>
      <p>Gere os QR Codes para o colaborador</p>
    </header>

    <!-- MOTIVOS -->
    <div class="card">
      <h2 class="section-title">1. Motivos de Ponto</h2>
      <p class="desc">
        O colaborador deve ler este QR Code primeiro para ter os mesmos motivos que o seu sistema.
        O envio é automático e em loop.
      </p>

      <button v-if="!motivosQrAtual" @click="iniciarMotivos" class="btn btn-primary btn-block">
        Iniciar Envio de Motivos
      </button>

      <div v-else class="qr-area">
        <div class="qr-container">
          <img :src="motivosQrAtual" alt="QR Motivos" class="qr-image" />
          <div v-if="motivosTransmitindo" class="qr-progress">
            Motivos {{ motivosIndice + 1 }} / {{ motivosPacotes.length }}
          </div>
        </div>
        <p class="qr-hint">O QR Code está em loop. Aguarde a leitura completa.</p>
        <button @click="cancelarMotivos" class="btn btn-outline btn-block" style="margin-top: 12px;">
          Parar Envio
        </button>
      </div>
    </div>

    <!-- COLABORADOR -->
    <div class="card">
      <h2 class="section-title">2. Dados do Colaborador</h2>
      <p class="desc">
        Escolha o colaborador e inicie o envio dos dados dele e do valor/hora.
        Também é enviado em loop.
      </p>

      <div class="form-group">
        <label class="form-label">Colaborador</label>
        <select v-model="colaboradorSelecionadoId" class="form-select">
          <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </div>

      <button v-if="!colabQrAtual" @click="iniciarColab" class="btn btn-primary btn-block">
        Iniciar Envio do Colaborador
      </button>

      <div v-else class="qr-area">
        <div class="qr-container">
          <img :src="colabQrAtual" alt="QR Colaborador" class="qr-image" />
          <div v-if="colabTransmitindo" class="qr-progress">
            Colaborador {{ colabIndice + 1 }} / {{ colabPacotes.length }}
          </div>
        </div>
        <p class="qr-hint">O QR Code está em loop. Aguarde a leitura completa.</p>
        <button @click="cancelarColab" class="btn btn-outline btn-block" style="margin-top: 12px;">
          Parar Envio
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desc { color: var(--color-muted); font-size: 0.9rem; margin-bottom: 16px; }
.qr-area { display: flex; flex-direction: column; align-items: center; margin-top: 16px; }
.qr-container { position: relative; display: inline-block; }
.qr-image { width: 100%; max-width: 300px; border-radius: var(--radius-md); box-shadow: var(--shadow-md); border: 1px solid #e2e8f0; }
.qr-progress {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(37, 99, 235, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}
.qr-hint { font-size: 0.85rem; color: var(--color-muted); margin-top: 12px; font-weight: 600; text-align: center; }
</style>