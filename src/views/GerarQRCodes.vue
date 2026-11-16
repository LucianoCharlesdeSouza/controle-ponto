<!-- src/views/GerarQRCodes.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems } from '../infrastructure/database.js';
import QRCode from 'qrcode';
import { showToast } from '../application/NotificationService.js';

const colaboradores = ref([]);
const colaboradorSelecionadoId = ref('');

const qrMotivosUrl = ref('');
const qrColaboradorUrl = ref('');

onMounted(async () => {
  colaboradores.value = (await getAllItems('colaboradores'))
    .filter(c => c.situacao === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome));
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
});

async function gerarQRMotivos() {
  const motivos = await getAllItems('motivos');
  const motivosAtivos = motivos.filter(m => m.ativo !== false);
  
  if (motivosAtivos.length === 0) {
    showToast('Nenhum motivo ativo cadastrado.', 'error');
    return;
  }

  const pacote = {
    app: 'PontoFolha',
    tipo: 'config_motivos',
    versao: 1,
    motivos: motivosAtivos.map(m => ({
      id: m.id,
      nome: m.nome,
      natureza: m.natureza,
      ordem: m.ordem
    }))
  };

  try {
    const url = await QRCode.toDataURL(JSON.stringify(pacote), {
        width: 800,
        margin: 2,
        // errorCorrectionLevel: 'H',
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    qrMotivosUrl.value = url;
  } catch (e) {
    showToast('Erro ao gerar QR Code.', 'error');
  }
}

async function gerarQRColaborador() {
  if (!colaboradorSelecionadoId.value) return;
  
  const colab = colaboradores.value.find(c => c.id === colaboradorSelecionadoId.value);
  const valoresHora = await getAllItems('valoresHora');
  
  // Pega o valor/hora mais recente
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

  try {
    const url = await QRCode.toDataURL(JSON.stringify(pacote), {
        width: 800,
        margin: 2,
        // errorCorrectionLevel: 'H',
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    qrColaboradorUrl.value = url;
  } catch (e) {
    showToast('Erro ao gerar QR Code.', 'error');
  }
}
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <h1>Configurar Celular</h1>
      <p>Gere os QR Codes para o colaborador</p>
    </header>

    <div class="card">
      <h2 class="section-title">1. Motivos de Ponto</h2>
      <p class="desc">O colaborador deve ler este QR Code primeiro para ter os mesmos motivos que o seu sistema.</p>
      
      <button v-if="!qrMotivosUrl" @click="gerarQRMotivos" class="btn btn-primary btn-block">Gerar QR Code de Motivos</button>
      
      <div v-else class="qr-area">
        <img :src="qrMotivosUrl" alt="QR Motivos" class="qr-image" />
        <button @click="qrMotivosUrl = ''" class="btn btn-outline btn-block" style="margin-top: 12px;">Gerar Novamente</button>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">2. Dados do Colaborador</h2>
      <p class="desc">Escolha o colaborador e gere o QR Code com os dados dele e o valor/hora.</p>
      
      <div class="form-group">
        <label class="form-label">Colaborador</label>
        <select v-model="colaboradorSelecionadoId" class="form-select">
          <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </div>

      <button v-if="!qrColaboradorUrl" @click="gerarQRColaborador" class="btn btn-primary btn-block">Gerar QR Code do Colaborador</button>
      
      <div v-else class="qr-area">
        <img :src="qrColaboradorUrl" alt="QR Colaborador" class="qr-image" />
        <button @click="qrColaboradorUrl = ''" class="btn btn-outline btn-block" style="margin-top: 12px;">Gerar Novamente</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desc { color: var(--color-muted); font-size: 0.9rem; margin-bottom: 16px; }
.qr-area { display: flex; flex-direction: column; align-items: center; margin-top: 16px; }
.qr-image { width: 100%; max-width: 300px; border-radius: var(--radius-md); box-shadow: var(--shadow-md); border: 1px solid #e2e8f0; }
</style>