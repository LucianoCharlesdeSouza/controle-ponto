<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import QrDisplay from './QrDisplay.vue';
import QrScanner from './QrScanner.vue';

const props = defineProps({
  role: { type: String, required: true },
  sync: { type: Object, required: true },
});

const scannerRef = ref(null);
const jsonText = ref(JSON.stringify({ message: 'Olá pelo WebRTC', sentAt: new Date().toISOString() }, null, 2));
const scanProgress = ref('');
const sending = ref(false);
const sendResult = ref('');
const autoAdvance = ref(true);
const autoAdvanceMs = ref(2200);
const scanBusy = ref(false);
let autoAdvanceTimer = null;
const expectedSignal = computed(() => props.role === 'a' ? 'answer' : 'offer');
const qrTitle = computed(() => props.role === 'a' ? 'Oferta de conexão' : 'Resposta de conexão');

function stopAutoAdvance() {
  if (autoAdvanceTimer !== null) {
    window.clearInterval(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
}

function startAutoAdvance() {
  stopAutoAdvance();
  if (!autoAdvance.value || props.sync.qrFrames.value.length < 2) return;

  autoAdvanceTimer = window.setInterval(() => {
    const lastIndex = props.sync.qrFrames.value.length - 1;
    if (props.sync.qrIndex.value >= lastIndex) {
      props.sync.qrIndex.value = 0;
      return;
    }
    props.sync.nextQr();
  }, autoAdvanceMs.value);
}

watch(
  () => props.sync.qrFrames.value.length,
  length => {
    stopAutoAdvance();
    if (length > 0) startAutoAdvance();
  },
);

watch(autoAdvance, enabled => {
  if (enabled) startAutoAdvance();
  else stopAutoAdvance();
});

watch(autoAdvanceMs, () => {
  if (autoAdvance.value) startAutoAdvance();
});

onBeforeUnmount(stopAutoAdvance);

async function startConnection() {
  sendResult.value = '';
  await props.sync.startAsOfferer();
}

async function startScanner() {
  scanProgress.value = '';
  scannerRef.value?.start();
}

async function handleScan(raw) {
  if (scanBusy.value) return;
  scanBusy.value = true;
  try {
    const result = await props.sync.receiveSignalFrame(raw, expectedSignal.value);
    if (result.complete) {
      scanProgress.value = 'Sinalização concluída.';
      await scannerRef.value?.stop();
    } else {
      scanProgress.value = `Fragmentos recebidos: ${result.received}/${result.total}`;
    }
  } catch (error) {
    scanProgress.value = error.message;
  } finally {
    scanBusy.value = false;
  }
}

async function sendJson() {
  sending.value = true;
  sendResult.value = '';
  try {
    const payload = JSON.parse(jsonText.value);
    const result = await props.sync.sendData(payload);
    sendResult.value = `Recebido e confirmado pelo outro aparelho (${result.transferId}).`;
  } catch (error) {
    sendResult.value = error.message;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <main class="sync-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Sincronização local • WebRTC</p>
        <h1>Dispositivo {{ role.toUpperCase() }}</h1>
        <p>Conexão direta entre aparelhos na mesma rede Wi-Fi.</p>
      </div>
      <span class="status" :class="sync.connected.value ? 'online' : ''">
        {{ sync.status.value }}
      </span>
    </header>

    <section class="panel">
      <h2>1. Pareamento</h2>
      <p v-if="role === 'a'">No aparelho A, crie a oferta. Depois, leia a resposta exibida no aparelho B.</p>
      <p v-else>Leia a oferta exibida no aparelho A. Depois apresente a resposta para o aparelho A ler.</p>

      <button v-if="role === 'a'" type="button" @click="startConnection">
        Criar conexão
      </button>

      <div v-if="sync.qrFrames.value.length" class="qr-area">
        <h3>{{ qrTitle }}</h3>
        <QrDisplay :value="sync.currentQr.value" />
        <p class="muted">
          QR {{ sync.qrIndex.value + 1 }} de {{ sync.qrFrames.value.length }}
        </p>
        <div class="auto-controls">
          <label class="auto-toggle">
            <input v-model="autoAdvance" type="checkbox" />
            Avançar QR automaticamente
          </label>
          <label class="interval-control">
            Intervalo
            <select v-model.number="autoAdvanceMs">
              <option :value="1500">1,5 segundo</option>
              <option :value="2200">2,2 segundos</option>
              <option :value="3000">3 segundos</option>
              <option :value="4000">4 segundos</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button class="secondary" :disabled="sync.qrIndex.value === 0" @click="sync.previousQr()">Anterior</button>
          <button class="secondary" :disabled="sync.qrFrames.value.length < 2" @click="autoAdvance ? (autoAdvance = false) : (autoAdvance = true)">
            {{ autoAdvance ? 'Pausar sequência' : 'Retomar sequência' }}
          </button>
          <button class="secondary" :disabled="sync.qrIndex.value >= sync.qrFrames.value.length - 1" @click="sync.nextQr()">Próximo</button>
        </div>
        <div class="sequence-track">
          <div :style="{ width: `${((sync.qrIndex.value + 1) / sync.qrFrames.value.length) * 100}%` }"></div>
        </div>
        <p class="hint">A sequência repete automaticamente do primeiro ao último QR até o outro aparelho concluir a leitura. Se a câmera estiver demorando, aumente o intervalo.</p>
      </div>

      <div class="scanner-area">
        <h3>{{ role === 'a' ? 'Ler QR da resposta do aparelho B' : 'Ler QR da oferta do aparelho A' }}</h3>
        <QrScanner ref="scannerRef" :element-id="`webrtc-reader-${role}`" @scan="handleScan" />
        <p class="muted">{{ scanProgress }}</p>
      </div>

      <p v-if="sync.error.value" class="error">{{ sync.error.value }}</p>
      <button class="secondary" type="button" @click="sync.reset">Reiniciar conexão</button>
    </section>

    <section class="panel">
      <h2>2. Testar transferência</h2>
      <p>Envie um JSON de qualquer aparelho para o outro. A confirmação ocorre após o receptor validar o conteúdo.</p>
      <textarea v-model="jsonText" rows="7" spellcheck="false"></textarea>
      <button type="button" :disabled="!sync.connected.value || sending" @click="sendJson">
        {{ sending ? 'Enviando...' : 'Enviar dados ao outro aparelho' }}
      </button>
      <p v-if="sendResult" class="muted">{{ sendResult }}</p>
      <div v-if="sync.progress.value" class="progress">
        <span>
          {{ sync.progress.value.direction === 'send' ? 'Enviando' : 'Recebendo' }}:
          {{ sync.progress.value.sent ?? sync.progress.value.received }}/{{ sync.progress.value.total }}
        </span>
        <progress :value="sync.progress.value.sent ?? sync.progress.value.received" :max="sync.progress.value.total"></progress>
      </div>
    </section>

    <section v-if="sync.receivedData.value !== null" class="panel">
      <h2>3. Últimos dados recebidos</h2>
      <pre>{{ JSON.stringify(sync.receivedData.value, null, 2) }}</pre>
    </section>
  </main>
</template>

<style scoped>
.sync-page { max-width:760px; margin:0 auto; padding:20px 16px 48px; color:#172033; font-family:system-ui,sans-serif; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:20px; }
h1 { margin:4px 0; font-size:1.65rem; }
h2 { margin:0 0 8px; font-size:1.15rem; }
h3 { font-size:1rem; margin:16px 0 8px; }
p { line-height:1.5; }
.eyebrow,.muted,.hint { color:#64748b; font-size:.9rem; }
.eyebrow { text-transform:uppercase; letter-spacing:.06em; font-weight:700; font-size:.72rem; }
.status { background:#f1f5f9; border-radius:999px; padding:6px 10px; font-size:.8rem; }
.status.online { background:#dcfce7; color:#166534; }
.panel { border:1px solid #e2e8f0; border-radius:16px; padding:16px; margin:14px 0; background:white; }
button { border:0; border-radius:10px; padding:11px 14px; background:#0284c7; color:white; font-weight:650; cursor:pointer; margin:5px 5px 5px 0; }
button:disabled { opacity:.45; cursor:not-allowed; }
button.secondary { background:#e2e8f0; color:#1e293b; }
textarea { display:block; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:10px; padding:12px; font: .85rem ui-monospace,monospace; margin:10px 0; }
.qr-area,.scanner-area { margin-top:18px; padding-top:12px; border-top:1px solid #e2e8f0; }
.actions { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; }
.auto-controls { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin:12px 0; font-size:.88rem; }
.auto-toggle,.interval-control { display:flex; align-items:center; gap:7px; }
.interval-control select { border:1px solid #cbd5e1; border-radius:8px; padding:7px; background:white; }
.sequence-track { height:6px; border-radius:99px; background:#e2e8f0; overflow:hidden; margin:12px 0; }
.sequence-track div { height:100%; background:#0284c7; transition:width .2s linear; }
.hint { text-align:center; }
.error { color:#b91c1c; background:#fef2f2; padding:10px; border-radius:8px; }
progress { width:100%; display:block; }
pre { overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; background:#f8fafc; border-radius:10px; padding:12px; }
</style>
