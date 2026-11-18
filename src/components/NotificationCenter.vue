
<script setup>
import { notificationState, handleConfirm, handlePrompt } from '../application/NotificationService.js';
</script>

<template>
  <div class="notification-wrapper">

    <!-- TOAST -->
    <Transition name="toast">
      <div
        v-if="notificationState.toast.visible"
        class="toast"
        :class="notificationState.toast.type"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="toast-icon">
          {{
            notificationState.toast.type === 'success' ? '✅' :
            notificationState.toast.type === 'error' ? '❌' : 'ℹ️'
          }}
        </div>

        <div class="toast-content">
          <span class="toast-title">
            {{
              notificationState.toast.type === 'success' ? 'Sucesso' :
              notificationState.toast.type === 'error' ? 'Atenção' : 'Informação'
            }}
          </span>

          <p class="toast-message">
            {{ notificationState.toast.message }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- MODAL DE CONFIRMAÇÃO -->
    <Transition name="modal">
      <div
        v-if="notificationState.confirm.visible"
        class="modal-overlay"
        @click.self="handleConfirm(false)"
      >
        <div
          class="modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div class="modal-header">
            <div class="modal-icon confirm-icon">
              ❓
            </div>

            <div class="modal-heading">
              <h3 id="confirm-title" class="modal-title">
                {{ notificationState.confirm.title }}
              </h3>

              <p class="modal-subtitle">
                Confirme sua decisão para continuar.
              </p>
            </div>
          </div>

          <div class="modal-body">
            <p class="modal-text">
              {{ notificationState.confirm.message }}
            </p>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-outline"
              @click="handleConfirm(false)"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="btn btn-danger"
              @click="handleConfirm(true)"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- MODAL DE PROMPT -->
    <Transition name="modal">
      <div
        v-if="notificationState.prompt.visible"
        class="modal-overlay"
        @click.self="handlePrompt(false)"
      >
        <div
          class="modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-title"
        >
          <div class="modal-header">
            <div class="modal-icon prompt-icon">
              ✏️
            </div>

            <div class="modal-heading">
              <h3 id="prompt-title" class="modal-title">
                {{ notificationState.prompt.title }}
              </h3>

              <p class="modal-subtitle">
                Preencha as informações solicitadas.
              </p>
            </div>
          </div>

          <div class="modal-body">
            <p class="modal-text">
              {{ notificationState.prompt.message }}
            </p>

            <textarea
              v-model="notificationState.prompt.value"
              class="form-input"
              rows="4"
              :placeholder="notificationState.prompt.placeholder"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-outline"
              @click="handlePrompt(false)"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="btn btn-primary"
              @click="handlePrompt(true, notificationState.prompt.value)"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>

/* =========================================================
   CONTAINER PRINCIPAL
========================================================= */

.notification-wrapper {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  isolation: isolate;
}


/* =========================================================
   TOAST - CONTAINER
========================================================= */

.toast {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);

  display: flex;
  align-items: flex-start;
  gap: 14px;

  width: max-content;
  max-width: min(600px, calc(100vw - 32px));

  padding: 16px 20px;

  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;

  color: #ffffff;

  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.18),
    0 3px 8px rgba(0, 0, 0, 0.10);

  box-sizing: border-box;

  pointer-events: auto;

  overflow: hidden;
}


/* =========================================================
   CORES DOS TOASTS
========================================================= */

.toast.success {
  background: var(--color-success, #15803d);
}

.toast.error {
  background: var(--color-danger, #dc2626);
}

.toast.info {
  background: var(--color-primary, #2563eb);
}


/* =========================================================
   ÍCONE DO TOAST
========================================================= */

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  flex: 0 0 38px;
  width: 38px;
  height: 38px;

  border-radius: 12px;

  background: rgba(255, 255, 255, 0.18);

  font-size: 20px;
  line-height: 1;

  margin-top: 1px;
}


/* =========================================================
   CONTEÚDO DO TOAST
========================================================= */

.toast-content {
  display: flex;
  flex-direction: column;
  flex: 1;

  min-width: 0;
  max-width: 100%;

  gap: 5px;
}

.toast-title {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.3px;

  color: rgba(255, 255, 255, 0.95);
}

.toast-message {
  margin: 0;

  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.55;

  color: #ffffff;

  /* Preserva quebras de linha e permite quebra automática */
  white-space: pre-wrap;

  /* Evita que palavras ou identificadores longos estourem a caixa */
  overflow-wrap: anywhere;
  word-break: normal;

  /* Permite crescimento vertical */
  min-width: 0;
  max-width: 100%;
}


/* =========================================================
   MODAL - OVERLAY
========================================================= */

.modal-overlay {
  position: fixed;
  inset: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  background: rgba(15, 23, 42, 0.65);

  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);

  pointer-events: auto;

  overflow-y: auto;
  overscroll-behavior: contain;

  box-sizing: border-box;
}


/* =========================================================
   MODAL - CAIXA
========================================================= */

.modal-box {
  position: relative;

  display: flex;
  flex-direction: column;

  width: 100%;
  max-width: 440px;

  max-height: calc(100% - 20px);

  padding: 26px;

  background: var(--color-surface, #ffffff);

  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;

  box-shadow:
    0 25px 60px rgba(0, 0, 0, 0.20),
    0 5px 15px rgba(0, 0, 0, 0.08);

  box-sizing: border-box;

  overflow-y: auto;
}


/* =========================================================
   CABEÇALHO DOS MODAIS
========================================================= */

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;

  margin-bottom: 22px;
}

.modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  flex: 0 0 46px;
  width: 46px;
  height: 46px;

  border-radius: 14px;

  font-size: 22px;
}

.confirm-icon {
  background: rgba(245, 158, 11, 0.13);
}

.prompt-icon {
  background: rgba(37, 99, 235, 0.12);
}

.modal-heading {
  flex: 1;
  min-width: 0;
}

.modal-title {
  margin: 0;

  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.4;

  color: var(--color-text, #1e293b);

  overflow-wrap: anywhere;
}

.modal-subtitle {
  margin: 5px 0 0;

  font-size: 0.82rem;
  line-height: 1.4;

  color: var(--color-muted, #64748b);
}


/* =========================================================
   CORPO DOS MODAIS
========================================================= */

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;

  min-width: 0;
}

.modal-text {
  margin: 0;

  font-size: 0.95rem;
  line-height: 1.65;

  color: var(--color-muted, #64748b);

  white-space: pre-wrap;
  overflow-wrap: anywhere;
}


/* =========================================================
   TEXTAREA DO PROMPT
========================================================= */

.form-input {
  display: block;

  width: 100%;
  min-width: 0;
  min-height: 110px;
  max-height: 250px;

  padding: 13px 15px;

  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: 12px;

  background: var(--color-background, #ffffff);
  color: var(--color-text, #1e293b);

  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;

  resize: vertical;

  box-sizing: border-box;

  outline: none;

  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.form-input:focus {
  border-color: var(--color-primary, #2563eb);

  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.12);
}

.form-input::placeholder {
  color: var(--color-muted, #94a3b8);
}


/* =========================================================
   BOTÕES DOS MODAIS
========================================================= */

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  margin-top: 26px;
}

.modal-actions .btn {
  flex: 1;

  min-height: 44px;

  padding: 10px 16px;

  border: 1px solid transparent;
  border-radius: 10px;

  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;

  cursor: pointer;

  transition:
    transform 0.15s ease,
    filter 0.15s ease,
    background 0.15s ease;
}

.modal-actions .btn:hover {
  filter: brightness(0.95);
}

.modal-actions .btn:active {
  transform: scale(0.97);
}

.modal-actions .btn:focus-visible {
  outline: 3px solid var(--color-primary, #2563eb);
  outline-offset: 3px;
}

.btn-outline {
  background: transparent;

  border-color: var(--color-border, #cbd5e1) !important;

  color: var(--color-text, #334155);
}

.btn-danger {
  background: var(--color-danger, #dc2626);
  color: #ffffff;
}

.btn-primary {
  background: var(--color-primary, #2563eb);
  color: #ffffff;
}


/* =========================================================
   ANIMAÇÕES - TOAST
========================================================= */

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    top 0.25s ease,
    transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  top: 0;
  transform: translate(-50%, -15px);
}


/* =========================================================
   ANIMAÇÕES - MODAL
========================================================= */

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  opacity: 0;
  transform: scale(0.96) translateY(10px);
}


/* =========================================================
   RESPONSIVIDADE - TABLETS E CELULARES
========================================================= */

@media (max-width: 600px) {

  .toast {
    top: max(12px, env(safe-area-inset-top));

    width: calc(100% - 24px);
    max-width: 480px;

    padding: 14px 15px;

    gap: 11px;

    border-radius: 14px;
  }

  .toast-icon {
    flex-basis: 34px;
    width: 34px;
    height: 34px;

    font-size: 18px;
  }

  .toast-title {
    font-size: 0.82rem;
  }

  .toast-message {
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .modal-overlay {
    padding: 14px;
  }

  .modal-box {
    padding: 21px;
    border-radius: 17px;
  }

  .modal-title {
    font-size: 1.05rem;
  }

  .modal-text {
    font-size: 0.9rem;
  }

}


/* =========================================================
   RESPONSIVIDADE - CELULARES PEQUENOS
========================================================= */

@media (max-width: 360px) {

  .toast {
    width: calc(100% - 20px);
    padding: 12px;
    gap: 9px;
  }

  .toast-icon {
    flex-basis: 30px;
    width: 30px;
    height: 30px;

    font-size: 16px;
  }

  .toast-message {
    font-size: 0.84rem;
  }

  .modal-actions {
    flex-direction: column-reverse;
    gap: 9px;
  }

  .modal-actions .btn {
    width: 100%;
  }

}


/* =========================================================
   ACESSIBILIDADE - REDUÇÃO DE MOVIMENTO
========================================================= */

@media (prefers-reduced-motion: reduce) {

  .toast-enter-active,
  .toast-leave-active,
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal-box,
  .modal-leave-active .modal-box {
    transition: none;
  }

}

</style>
