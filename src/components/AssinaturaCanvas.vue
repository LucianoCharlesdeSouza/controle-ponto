<!-- src/components/AssinaturaCanvas.vue -->
<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  label: { type: String, default: 'Assinatura' },
  modelValue: { type: String, default: '' } // Recebe a imagem salva (se houver)
});

const emit = defineEmits(['update:modelValue']);

const canvasRef = ref(null);
let ctx = null;
let isDrawing = false;

onMounted(() => {
  const canvas = canvasRef.value;
  ctx = canvas.getContext('2d');
  
  // Ajusta a resolução do canvas para telas de celular (HiDPI)
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  ctx.scale(ratio, ratio);
  
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1e293b';

  // Se já veio uma assinatura salva, desenha ela no canvas
  if (props.modelValue) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
    img.src = props.modelValue;
  }
});

// Observa se o valor for limpo de fora
watch(() => props.modelValue, (newVal) => {
  if (!newVal) limpar();
});

function getPos(e) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  
  // Suporta tanto Mouse quanto Touch (dedo)
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function iniciar(e) {
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function desenhar(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function finalizar(e) {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
  salvarImagem();
}

function limpar() {
  const canvas = canvasRef.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  emit('update:modelValue', '');
}

function salvarImagem() {
  const canvas = canvasRef.value;
  // Converte o desenho para uma imagem PNG em Base64
  const dataUrl = canvas.toDataURL('image/png');
  emit('update:modelValue', dataUrl);
}
</script>

<template>
  <div class="assinatura-container no-print">
    <div class="header-assinatura">
      <label>{{ label }}</label>
      <button @click="limpar" class="btn-limpar">Limpar</button>
    </div>
    <canvas
      ref="canvasRef"
      class="canvas-assinatura"
      @mousedown="iniciar"
      @mousemove="desenhar"
      @mouseup="finalizar"
      @mouseleave="finalizar"
      @touchstart="iniciar"
      @touchmove="desenhar"
      @touchend="finalizar"
    ></canvas>
    <div class="linha-guia"></div>
  </div>
</template>

<style scoped>
.assinatura-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 16px;
}
.header-assinatura {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.header-assinatura label {
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--color-muted, #64748b);
}
.btn-limpar {
  background: none;
  border: none;
  color: var(--color-danger, #dc2626);
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: bold;
}
.canvas-assinatura {
  width: 100%;
  height: 120px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  touch-action: none; /* Impede a rolagem da tela enquanto desenha no celular */
  cursor: crosshair;
}
.linha-guia {
  border-bottom: 1px solid #333;
  margin-top: 4px;
  width: 100%;
}
</style>