<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { Html5QrcodeScanner } from 'html5-qrcode';

const emit = defineEmits(['scan', 'error']);
const props = defineProps({
  elementId: { type: String, default: 'webrtc-qr-reader' },
});

const active = ref(false);
let scanner = null;
let lastValue = '';
let lastAt = 0;

function start() {
  if (active.value) return;
  active.value = true;
  scanner = new Html5QrcodeScanner(props.elementId, {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    showTorchButtonIfSupported: true,
  }, false);

  scanner.render((decodedText) => {
    const now = Date.now();
    if (decodedText === lastValue && now - lastAt < 1500) return;
    lastValue = decodedText;
    lastAt = now;
    emit('scan', decodedText);
  }, (scanError) => {
    // Erros de leitura por frame são normais; não poluir a interface.
  });
}

async function stop() {
  if (!scanner) {
    active.value = false;
    return;
  }
  try {
    await scanner.clear();
  } catch (error) {
    emit('error', error);
  } finally {
    scanner = null;
    active.value = false;
  }
}

onBeforeUnmount(stop);
defineExpose({ start, stop });
</script>

<template>
  <div class="scanner-shell">
    <div :id="elementId"></div>
    <button v-if="!active" type="button" class="secondary" @click="start">Ativar câmera</button>
    <button v-else type="button" class="secondary" @click="stop">Parar câmera</button>
  </div>
</template>

<style scoped>
.scanner-shell { width:100%; }
.scanner-shell :deep(#reader), .scanner-shell :deep(video) { max-width:100%; border-radius:12px; }
.scanner-shell :deep(button) { margin:6px; }
</style>
