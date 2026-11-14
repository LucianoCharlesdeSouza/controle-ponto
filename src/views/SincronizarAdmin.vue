<!-- src/views/SincronizarAdmin.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getAllItems, addItem } from '../infrastructure/database.js';
import { showToast, showConfirm } from '../application/NotificationService.js';

const leitorAtivo = ref(true);
const dadosRecebidos = ref(null);
const processando = ref(false);
let html5QrcodeScanner = null;

// Função para iniciar a câmera
function iniciarLeitor() {
  leitorAtivo.value = true;
  dadosRecebidos.value = null;
  
  // Aguarda o DOM renderizar a div do leitor
  setTimeout(() => {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
  }, 100);
}

// Callback quando o QR Code é lido com sucesso
async function onScanSuccess(decodedText, decodedResult) {
  try {
    const pacote = JSON.parse(decodedText);
    
    if (pacote.app !== 'PontoFolha') {
      showToast('QR Code inválido. Não é do Ponto & Folha.', 'error');
      return;
    }

    // Para a câmera para não ficar lendo várias vezes
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().catch(e => console.error(e));
      html5QrcodeScanner = null;
    }
    leitorAtivo.value = false;

    // Pega os nomes dos motivos para exibir na tela
    const motivos = await getAllItems('motivos');
    const marcacoesFormatadas = pacote.marcacoes.map(m => {
      const motivo = motivos.find(mot => mot.id === m.motivoId);
      return {
        ...m,
        motivoNome: motivo?.nome || 'Motivo desconhecido'
      };
    });

    dadosRecebidos.value = {
      colaboradorId: pacote.colaboradorId,
      colaboradorNome: pacote.colaboradorNome,
      marcacoes: marcacoesFormatadas.sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal))
    };

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  } catch (e) {
    showToast('Erro ao ler o QR Code. Tente novamente.', 'error');
  }
}

function onScanFailure(error) {
  // Ignora os erros de leitura contínua (o scanner tenta ler várias vezes por segundo)
}

// Função para salvar os dados no banco do admin
async function confirmarImportacao() {
  if (!dadosRecebidos.value || processando.value) return;
  
  const confirmou = await showConfirm(
    'Importar Pontos', 
    `Deseja importar ${dadosRecebidos.value.marcacoes.length} marcações de ${dadosRecebidos.value.colaboradorNome}?`
  );
  
  if (!confirmou) return;
  processando.value = true;

  try {
    // Pega as marcações existentes para não duplicar
    const marcacoesExistentes = await getAllItems('marcacoes');
    const idsExistentes = new Set(marcacoesExistentes.map(m => m.id));
    
    let importados = 0;

    for (const m of dadosRecebidos.value.marcacoes) {
      if (!idsExistentes.has(m.id)) {
        await addItem('marcacoes', {
          id: m.id,
          colaboradorId: dadosRecebidos.value.colaboradorId,
          dataHoraLocal: m.dataHoraLocal,
          motivoId: m.motivoId,
          natureza: m.natureza,
          origem: 'colaborador',
          inconsistente: false,
          criadoEm: m.criadoEm || new Date().toISOString()
        });
        importados++;
      }
    }

    showToast(`${importados} pontos importados com sucesso!`, 'success');
    dadosRecebidos.value = null;
    iniciarLeitor(); // Reinicia a câmera para ler outro colaborador

  } catch (e) {
    showToast('Erro ao importar pontos.', 'error');
  } finally {
    processando.value = false;
  }
}

onMounted(() => {
  iniciarLeitor();
});

onUnmounted(() => {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(e => console.error(e));
  }
});
</script>

<template>
  <div class="page-container">
    <header class="app-header">
      <h1>Sincronizar Pontos</h1>
      <p>Leia o QR Code do colaborador</p>
    </header>

    <!-- Área da Câmera -->
    <div v-if="leitorAtivo" class="card camera-card">
      <div id="reader" class="camera-reader"></div>
      <p class="camera-hint">Aponte a câmera para o QR Code gerado no celular do colaborador.</p>
    </div>

    <!-- Área de Revisão (Após a leitura) -->
    <div v-if="dadosRecebidos" class="card result-card">
      <div class="result-header">
        <h2>Pontos Recebidos</h2>
        <span class="badge-colab">{{ dadosRecebidos.colaboradorNome }}</span>
      </div>
      
      <p class="result-desc">Foram encontradas <strong>{{ dadosRecebidos.marcacoes.length }}</strong> marcações neste QR Code. Confira abaixo e confirme a importação.</p>

      <div class="lista-importacao">
        <div v-for="m in dadosRecebidos.marcacoes" :key="m.id" class="import-item">
          <span class="import-date">{{ m.dataHoraLocal.split('T')[0].split('-').reverse().join('/') }}</span>
          <span class="import-time">{{ new Date(m.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</span>
          <span class="import-motivo" :class="m.natureza">{{ m.motivoNome }}</span>
        </div>
      </div>

      <div class="actions">
        <button @click="dadosRecebidos = null; iniciarLeitor()" class="btn btn-outline">Cancelar</button>
        <button @click="confirmarImportacao" class="btn btn-success" :disabled="processando">
          {{ processando ? 'Importando...' : 'Confirmar Importação' }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.camera-card {
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 2px dashed #cbd5e1;
  background: #f8fafc;
}

.camera-reader {
  width: 100%;
  min-height: 300px;
  background: #000;
}

/* Estiliza o elemento interno gerado pela biblioteca html5-qrcode */
:deep(#reader video) {
  border-radius: 0 !important;
}
:deep(#reader__dashboard_section) {
  padding: 16px !important;
  background: white;
}
:deep(#reader__dashboard_section button) {
  background: var(--color-primary) !important;
  color: white !important;
  border: none !important;
  padding: 10px 16px !important;
  border-radius: var(--radius-md) !important;
  font-weight: bold !important;
  cursor: pointer !important;
}

.camera-hint {
  text-align: center;
  padding: 16px;
  font-size: 0.85rem;
  color: var(--color-muted);
  margin: 0;
}

/* Área de Resultados */
.result-card {
  border-top: 4px solid var(--color-success);
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.result-header h2 {
  margin: 0;
  font-size: 1.2rem;
}
.badge-colab {
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.8rem;
}
.result-desc {
  font-size: 0.9rem;
  color: var(--color-muted);
  margin-bottom: 16px;
}

.lista-importacao {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  max-height: 300px;
  overflow-y: auto;
}
.import-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid #e2e8f0;
}
.import-date { font-size: 0.8rem; font-weight: 600; color: var(--color-muted); }
.import-time { font-size: 1rem; font-weight: 800; color: var(--color-text); }
.import-motivo {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.import-motivo.trabalho { background: var(--color-success-light); color: #065f46; }
.import-motivo.pausa { background: var(--color-warning-light); color: #92400e; }

.actions {
  display: flex;
  gap: 12px;
}
.actions .btn { flex: 1; }
</style>