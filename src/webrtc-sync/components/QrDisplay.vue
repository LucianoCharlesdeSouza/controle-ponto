<script setup>
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  value: { type: String, required: true },
  size: { type: Number, default: 280 },
});

const imageUrl = ref('');
const renderError = ref('');

watch(
  () => [props.value, props.size],
  async ([value, size]) => {
    imageUrl.value = '';
    renderError.value = '';
    if (!value) return;

    try {
      imageUrl.value = await QRCode.toDataURL(value, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#FFFFFF' },
      });
    } catch (error) {
      renderError.value = error instanceof Error ? error.message : 'Não foi possível gerar o QR Code.';
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="qr-display">
    <img v-if="imageUrl" :src="imageUrl" alt="QR Code de pareamento" />
    <p v-else-if="renderError">{{ renderError }}</p>
    <p v-else-if="value">Gerando QR Code...</p>
    <p v-else>Nenhum QR Code disponível.</p>
  </div>
</template>

<style scoped>
.qr-display { display:flex; justify-content:center; align-items:center; min-height:220px; }
.qr-display img { width:min(100%, 320px); height:auto; border-radius:12px; background:white; padding:8px; }
.qr-display p { color:#64748b; }
</style>
