<!-- src/components/NotificationCenter.vue -->
<script setup>
import { notificationState, handleConfirm, handlePrompt } from '../application/NotificationService.js';
</script>

<template>
  <div class="notification-wrapper">
    
    <!-- TOAST -->
    <Transition name="slide-down">
      <div v-if="notificationState.toast.visible" class="toast" :class="notificationState.toast.type">
        <span class="icon">
          {{ notificationState.toast.type === 'success' ? '✅' : 
             notificationState.toast.type === 'error' ? '❌' : 'ℹ️' }}
        </span>
        <span class="message">{{ notificationState.toast.message }}</span>
      </div>
    </Transition>

    <!-- MODAL DE CONFIRMAÇÃO -->
    <div v-if="notificationState.confirm.visible" class="modal-overlay" @click.self="handleConfirm(false)">
      <div class="modal-box">
        <h3 class="modal-title">{{ notificationState.confirm.title }}</h3>
        <p class="modal-text">{{ notificationState.confirm.message }}</p>
        <div class="modal-actions">
          <button @click="handleConfirm(false)" class="btn btn-outline">Cancelar</button>
          <button @click="handleConfirm(true)" class="btn btn-danger">Confirmar</button>
        </div>
      </div>
    </div>

    <!-- MODAL DE PROMPT -->
    <div v-if="notificationState.prompt.visible" class="modal-overlay" @click.self="handlePrompt(false)">
      <div class="modal-box">
        <h3 class="modal-title">{{ notificationState.prompt.title }}</h3>
        <p class="modal-text">{{ notificationState.prompt.message }}</p>
        
        <textarea 
          v-model="notificationState.prompt.value" 
          class="form-input" 
          rows="3" 
          :placeholder="notificationState.prompt.placeholder"
          style="margin-bottom: 24px;"
        ></textarea>

        <div class="modal-actions">
          <button @click="handlePrompt(false)" class="btn btn-outline">Cancelar</button>
          <button @click="handlePrompt(true, notificationState.prompt.value)" class="btn btn-primary">Salvar</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.notification-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Permite clicar no app por baixo */
  z-index: 9999;
}

/* TOAST */
.toast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: var(--radius-full);
  background: var(--color-text);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast.success { background: var(--color-success); }
.toast.error { background: var(--color-danger); }
.toast.info { background: var(--color-primary); }

/* MODAL */
.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  padding: 20px;
}

.modal-box {
  background: var(--color-surface);
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
  animation: popIn 0.2s ease-out;
}

.modal-title {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  color: var(--color-text);
  font-weight: 800;
}

.modal-text {
  color: var(--color-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}
.modal-actions .btn {
  flex: 1;
}

/* Animações */
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from,
.slide-down-leave-to { transform: translate(-50%, -20px); opacity: 0; }

@keyframes popIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>