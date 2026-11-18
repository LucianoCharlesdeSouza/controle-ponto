<!-- src/views/PortalColaborador.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { showToast, showConfirm } from '../application/NotificationService.js';
import { criptografarDados } from '../infrastructure/crypto-util.js';

// ========== ESTADOS DE CONFIGURAÇÃO ==========
const isConfigurado = ref(false);
const configurando = ref(false);
const aguardandoConfirmacao = ref(false);
let html5QrcodeScanner = null;

const motivosRecebidos = ref([]);
const pacotesRecebidos = ref(new Set());
const totalPacotesMotivos = ref(0);
const colaboradorRecebido = ref(null);

// ========== ESTADOS DO APP ==========
const abaAtiva = ref('ponto');
const colaborador = ref(null);
const motivos = ref([]);
const marcacoesHoje = ref([]);
const todasMarcacoes = ref([]);
const registrando = ref(false);

// ========== ESTADOS DE SINCRONIZAÇÃO ==========
const qrCodeDataUrl = ref('');
const diasPendentes = ref([]);
const indiceDiaAtual = ref(0);
const isTransmitindo = ref(false);
const intervaloTimer = ref(null);
const tempoPausa = 2200;
const loteAtualQrCodes = ref([]);
const indiceQrCodeAtual = ref(0);

onMounted(async () => {
  await verificarConfiguracao();
});

onUnmounted(() => {
  pararTransmissao();
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(e => console.error(e));
  }
});

async function verificarConfiguracao() {
  const config = await getAllItems('settings');
  const colaboradorSalvo = config.find(c => c.key === 'colaborador_configurado');
  const motivosSalvos = await getAllItems('motivos');

  if (colaboradorSalvo && colaboradorSalvo.value && motivosSalvos.length > 0) {
    colaborador.value = colaboradorSalvo.value;
    motivos.value = motivosSalvos.sort((a, b) => a.ordem - b.ordem);
    isConfigurado.value = true;
    await carregarDados();
  } else {
    isConfigurado.value = false;
  }
}

// ========== LEITOR DE CONFIGURAÇÃO ==========
function iniciarConfiguracao() {
  configurando.value = true;
  motivosRecebidos.value = [];
  pacotesRecebidos.value.clear();
  totalPacotesMotivos.value = 0;
  colaboradorRecebido.value = null;

  setTimeout(() => {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader-config", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    html5QrcodeScanner.render(onConfigScanSuccess, () => {});
  }, 100);
}

async function onConfigScanSuccess(decodedText, decodedResult) {
  try {
    const pacote = JSON.parse(decodedText);
    if (pacote.app !== 'PontoFolha') throw new Error('QR Code inválido');

    // 1. QR de Motivos (fragmentado)
    if (pacote.tipo === 'config_motivos') {
      const idPacote = `motivo-${pacote.paginacao.atual}`;
      
      if (pacotesRecebidos.value.has(idPacote)) return;

      totalPacotesMotivos.value = pacote.paginacao.total;
      
      for (const m of pacote.motivos) {
        if (!motivosRecebidos.value.some(mot => mot.id === m.id)) {
          motivosRecebidos.value.push(m);
        }
      }
      
      pacotesRecebidos.value.add(idPacote);
      
      const lidos = pacotesRecebidos.value.size;
      showToast(`Motivos: ${lidos} de ${totalPacotesMotivos.value} pacotes`, 'success', false);

      if (lidos === totalPacotesMotivos.value) {
        showToast('Motivos completos! Agora leia o QR Code do colaborador.', 'info');
      }
    }
    
    // 2. QR do Colaborador (único)
    else if (pacote.tipo === 'colaborador') {
      if (!totalPacotesMotivos.value || motivosRecebidos.value.length === 0) {
        showToast('Leia primeiro os Motivos!', 'error');
        return;
      }

      colaboradorRecebido.value = {
        colaborador: pacote.colaborador,
        valorHoraCentavos: pacote.valorHoraCentavos
      };

      if (html5QrcodeScanner) {
        await html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
      }
      configurando.value = false;
      aguardandoConfirmacao.value = true;
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  } catch (e) {
    console.error(e);
    showToast('QR Code inválido.', 'error');
  }
}

// ========== APLICAR CONFIGURAÇÃO (CORRIGIDO) ==========
async function aplicarConfiguracao() {
  if (!colaboradorRecebido.value) return;

  const confirmou = await showConfirm(
    'Aplicar Configuração', 
    `Confirmar o cadastro de ${colaboradorRecebido.value.colaborador.nome} no aplicativo?`
  );

  if (!confirmou) return;

  try {
    // Remove a reatividade do Vue antes de salvar no IndexedDB
    const clonar = (obj) => JSON.parse(JSON.stringify(obj));

    // Salva os motivos copiando os IDs originais do admin
    for (const m of motivosRecebidos.value) {
      await putItem('motivos', clonar(m));
    }

    // Salva o colaborador copiando o ID original do admin
    const colabConfig = clonar(colaboradorRecebido.value.colaborador);
    await putItem('colaboradores', {
      ...colabConfig,
      situacao: 'ativo',
      criadoEm: new Date().toISOString()
    });

    // Salva o valor/hora (cria um ID novo para o registro de vigência)
    await putItem('valoresHora', {
      id: uuidv4(),
      colaboradorId: colabConfig.id,
      valorCentavos: colaboradorRecebido.value.valorHoraCentavos,
      vigenciaInicio: new Date().toISOString().split('T')[0],
      vigenciaFim: null
    });

    await putItem('settings', { 
      key: 'colaborador_configurado', 
      value: colabConfig 
    });
    
    showToast('Configuração aplicada com sucesso!', 'success');
    aguardandoConfirmacao.value = false;
    colaboradorRecebido.value = null;
    motivosRecebidos.value = [];
    await verificarConfiguracao();

  } catch (e) {
    console.error(e);
    showToast('Erro ao salvar configuração: ' + e.message, 'error');
  }
}

function cancelarConfiguracao() {
  aguardandoConfirmacao.value = false;
  colaboradorRecebido.value = null;
  motivosRecebidos.value = [];
  pacotesRecebidos.value.clear();
  totalPacotesMotivos.value = 0;
}

// ========== APP NORMAL ==========
const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

const colaboradorAtualNome = computed(() => {
  return colaborador.value ? colaborador.value.nome : 'Carregando...';
});

const minhasMarcacoesHoje = computed(() => {
  if (!colaborador.value) return [];
  return marcacoesHoje.value
    .filter(m => m.colaboradorId === colaborador.value.id)
    .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));
});

async function carregarDados() {
  if (!colaborador.value) return;

  const agora = new Date();
  const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  
  const todas = await getAllItems('marcacoes');
  todasMarcacoes.value = todas;
  marcacoesHoje.value = todas.filter(m => m.dataHoraLocal.startsWith(hojeStr));

  const pendentes = todasMarcacoes.value.filter(
    m => m.colaboradorId === colaborador.value.id && !m.sincronizado
  );

  const agrupados = {};
  pendentes.forEach(m => {
    const dia = m.dataHoraLocal.split('T')[0];
    if (!agrupados[dia]) agrupados[dia] = [];
    agrupados[dia].push(m);
  });

  diasPendentes.value = Object.keys(agrupados).sort().map(dia => ({
    data: dia,
    marcacoes: agrupados[dia]
  }));
  
  indiceDiaAtual.value = 0;
  qrCodeDataUrl.value = '';  
}

async function registrarPonto(motivo) {
  if (!colaborador.value || registrando.value) return;
  registrando.value = true;

  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  const dataHoraLocal = new Date(agora.getTime() - offset).toISOString().slice(0, 19);

  const novaMarcacao = {
    id: uuidv4(),
    colaboradorId: colaborador.value.id,
    dataHoraLocal: dataHoraLocal,
    motivoId: motivo.id,
    natureza: motivo.natureza,
    origem: 'colaborador',
    inconsistente: false,
    sincronizado: false,
    criadoEm: new Date().toISOString()
  };

  try {
    await addItem('marcacoes', JSON.parse(JSON.stringify(novaMarcacao)));
    await carregarDados();
    if (navigator.vibrate) navigator.vibrate(50);
    showToast('Ponto registrado!', 'success');
  } catch (e) {
    showToast('Erro ao registrar ponto.', 'error');
  } finally {
    setTimeout(() => { registrando.value = false; }, 2000); 
  }
}

// ========== SINCRONIZAÇÃO (ENVIO DE PONTOS) ==========
async function gerarQRCode() {
  if (diasPendentes.value.length === 0) {
    showToast('Nenhum ponto pendente.', 'info');
    return;
  }

  const todasPendentes = todasMarcacoes.value
    .filter(m => m.colaboradorId === colaborador.value.id && !m.sincronizado)
    .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));

  const tamanhoPacote = 2;
  const pacotes = [];
  
  for (let i = 0; i < todasPendentes.length; i += tamanhoPacote) {
    pacotes.push(todasPendentes.slice(i, i + tamanhoPacote));
  }

  loteAtualQrCodes.value = [];
  
  for (let i = 0; i < pacotes.length; i++) {
    const pacote = {
      app: 'PontoFolha',
      versao: 1,
      colaboradorId: colaborador.value.id,
      colaboradorNome: colaboradorAtualNome.value,
      paginacao: {
        atual: i + 1,
        total: pacotes.length
      },
      marcacoes: pacotes[i].map(m => ({
        id: m.id,
        dataHoraLocal: m.dataHoraLocal,
        motivoId: m.motivoId,
        natureza: m.natureza,
        criadoEm: m.criadoEm
      }))
    };

    const jsonString = JSON.stringify(pacote);
    const encryptedString = await criptografarDados(jsonString);
    
    const url = await QRCode.toDataURL(encryptedString, {
      width: 600,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    
    loteAtualQrCodes.value.push(url);
  }

  indiceQrCodeAtual.value = 0;
  isTransmitindo.value = true;
  qrCodeDataUrl.value = loteAtualQrCodes.value[0];
  
  iniciarTransmissao();
}

function iniciarTransmissao() {
  pararTransmissao();
  
  intervaloTimer.value = setInterval(() => {
    indiceQrCodeAtual.value = (indiceQrCodeAtual.value + 1) % loteAtualQrCodes.value.length;
    qrCodeDataUrl.value = loteAtualQrCodes.value[indiceQrCodeAtual.value];
    if (navigator.vibrate) navigator.vibrate(20);
  }, tempoPausa);
}

function pararTransmissao() {
  isTransmitindo.value = false;
  if (intervaloTimer.value) {
    clearInterval(intervaloTimer.value);
    intervaloTimer.value = null;
  }
}

function cancelarSincronizacao() {
  pararTransmissao();
  qrCodeDataUrl.value = '';
  loteAtualQrCodes.value = [];
  indiceQrCodeAtual.value = 0;
}

async function confirmarSincronizacao() {
  const confirmou = await showConfirm(
    'Concluir Sincronização', 
    'Tem certeza que o administrador já leu os pontos?'
  );
  
  if (!confirmou) return;

  try {
    const pendentes = todasMarcacoes.value.filter(
      m => m.colaboradorId === colaborador.value.id && !m.sincronizado
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
    
    <!-- TELA DE CONFIGURAÇÃO INICIAL -->
    <div v-if="!isConfigurado" class="config-screen">
      <header class="app-header">
        <h1>Bem-vindo!</h1>
        <p>Configure seu aplicativo</p>
      </header>

      <div v-if="!configurando && !aguardandoConfirmacao" class="card text-center">
        <div class="icon-large">📲</div>
        <h2>Configuração Inicial</h2>
        <p class="desc">Para começar, você precisa ler os QR Codes gerados pelo administrador.</p>
        <button @click="iniciarConfiguracao" class="btn btn-primary btn-block" style="margin-top: 20px;">
          📷 Abrir Câmera
        </button>
      </div>

      <div v-if="configurando" class="card camera-card">
        <div id="reader-config" class="camera-reader"></div>
        <div class="config-status">
          <p><strong>Motivos:</strong> {{ pacotesRecebidos.size }} de {{ totalPacotesMotivos || '?' }} pacotes</p>
          <p v-if="colaboradorRecebido"><strong>Colaborador:</strong> Lido!</p>
        </div>
        <p class="camera-hint">Aponte para o QR Code de Motivos (1) e depois para o seu QR Code (2).</p>
        <button @click="configurando = false" class="btn btn-outline btn-block" style="margin-top: 12px;">Cancelar</button>
      </div>

      <div v-if="aguardandoConfirmacao" class="card">
        <h2 class="section-title" style="text-align: center;">✅ Revisão da Configuração</h2>
        
        <div class="review-section">
          <h3>Motivos Recebidos ({{ motivosRecebidos.length }})</h3>
          <ul class="review-list">
            <li v-for="m in motivosRecebidos" :key="m.id">
              <span class="badge-natureza" :class="m.natureza">{{ m.natureza === 'trabalho' ? '▶️' : '⏸️' }}</span>
              {{ m.nome }}
            </li>
          </ul>
        </div>

        <div class="review-section" v-if="colaboradorRecebido">
          <h3>Colaborador</h3>
          <div class="colab-review">
            <p><strong>Nome:</strong> {{ colaboradorRecebido.colaborador.nome }}</p>
            <p><strong>Valor/Hora:</strong> R$ {{ (colaboradorRecebido.valorHoraCentavos / 100).toFixed(2).replace('.', ',') }}</p>
          </div>
        </div>

        <div class="review-actions">
          <button @click="aplicarConfiguracao" class="btn btn-success btn-block">
            ✅ Aplicar Configuração
          </button>
          <button @click="cancelarConfiguracao" class="btn btn-outline btn-block" style="margin-top: 8px;">
            ❌ Cancelar e Recomeçar
          </button>
        </div>
      </div>
    </div>      
      
    <!-- APP NORMAL -->
    <div v-else>
      <header class="app-header" style="margin-bottom: 16px;">
        <h1>Olá, {{ colaboradorAtualNome.split(' ')[0] }}</h1>
        <p>{{ dataAtual }}</p>
      </header>

      <div class="tabs-container">
        <button :class="{ active: abaAtiva === 'ponto' }" @click="abaAtiva = 'ponto'">Bater Ponto</button>
        <button :class="{ active: abaAtiva === 'sincronizar' }" @click="abaAtiva = 'sincronizar'">Sincronizar</button>
      </div>

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

      <div v-if="abaAtiva === 'sincronizar'">
        <div class="card text-center" v-if="diasPendentes.length > 0">
          <p class="desc" v-if="!qrCodeDataUrl">
            Você tem <strong>{{ diasPendentes.reduce((acc, d) => acc + d.marcacoes.length, 0) }} pontos</strong> pendentes.
          </p>
          
          <button v-if="!qrCodeDataUrl" @click="gerarQRCode" class="btn btn-primary btn-block" style="margin-top: 20px;">
            🔄 Iniciar Sincronização
          </button>

          <div v-if="qrCodeDataUrl" class="qr-area">
            <div class="qr-container">
              <img :src="qrCodeDataUrl" alt="QR Code" class="qr-image" />
              <div v-if="isTransmitindo" class="qr-progress">
                Transmitindo {{ indiceQrCodeAtual + 1 }} / {{ loteAtualQrCodes.length }}
              </div>
            </div>
            
            <p class="qr-hint">Aponte a câmera do administrador. Ele lerá automaticamente.</p>
            
            <div class="qr-actions">
               <button @click="confirmarSincronizacao" class="btn btn-success btn-block">
                ✅ Admin já leu tudo
              </button>
              <button @click="cancelarSincronizacao" class="btn btn-outline btn-block" style="margin-top: 8px;">
                Cancelar
              </button>
            </div>
          </div>
        </div>
        
        <div v-else class="card text-center">
          <p class="desc">Nenhum ponto pendente de sincronização.</p>
        </div>
      </div>
    </div>  
  </div>
</template>

<style scoped>
/* Estilos mantidos do arquivo anterior */
.config-screen { max-width: 600px; margin: 0 auto; }
.icon-large { font-size: 3rem; margin-bottom: 16px; }
.text-center { text-align: center; }
.desc { color: var(--color-muted); font-size: 0.9rem; margin-bottom: 20px; }

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

.config-status {
  background: white;
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
}
.config-status p { margin: 4px 0; font-size: 0.9rem; font-weight: 600; }

.review-section {
  margin-bottom: 20px;
  background: #f8fafc;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid #e2e8f0;
}
.review-section h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--color-primary);
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}
.review-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.badge-natureza {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.badge-natureza.trabalho { background: var(--color-success-light); color: #065f46; }
.badge-natureza.pausa { background: var(--color-warning-light); color: #92400e; }

.colab-review p { margin: 4px 0; font-size: 0.95rem; }
.review-actions { margin-top: 24px; }

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

.history-list { list-style: none; padding: 0; margin: 0; }
.history-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.history-time { font-weight: 800; font-size: 1.1rem; }
.history-motivo { font-size: 0.85rem; font-weight: 700; padding: 4px 10px; border-radius: var(--radius-full); }
.history-motivo.trabalho { background: var(--color-success-light); color: #065f46; }
.history-motivo.pausa { background: var(--color-warning-light); color: #92400e; }

.qr-area { display: flex; flex-direction: column; align-items: center; margin-top: 20px; }
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
.qr-hint { font-size: 0.85rem; color: var(--color-muted); margin-top: 12px; font-weight: 600; }
.empty-state { text-align: center; padding: 20px; color: var(--color-muted); }
</style>