// src/application/NotificationService.js
import { reactive } from 'vue';

export const notificationState = reactive({
  toast: {
    visible: false,
    message: '',
    type: 'success', // 'success', 'error', 'info'
    timeout: null
  },
  confirm: {
    visible: false,
    title: '',
    message: '',
    resolve: null
  },
  prompt: {
    visible: false,
    title: '',
    message: '',
    placeholder: '',
    value: '',
    resolve: null
  }  
});

// --- FUNÇÕES DO TOAST (Avisos rápidos) ---
export function showToast(message, type = 'success', autoHide = true) {
  if (notificationState.toast.timeout) clearTimeout(notificationState.toast.timeout);
  
  notificationState.toast.message = message;
  notificationState.toast.type = type;
  notificationState.toast.visible = true;
  
  if (autoHide) {
    notificationState.toast.timeout = setTimeout(() => {
      notificationState.toast.visible = false;
    }, 3000);
  }
}

// --- FUNÇÃO DE CONFIRMAÇÃO (Substitui o confirm()) ---
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    notificationState.confirm.title = title;
    notificationState.confirm.message = message;
    notificationState.confirm.visible = true;
    notificationState.confirm.resolve = resolve;
  });
}

export function handleConfirm(response) {
  if (notificationState.confirm.resolve) {
    notificationState.confirm.resolve(response);
  }
  notificationState.confirm.visible = false;
}

export function showPrompt(title, message, placeholder = 'Digite aqui...') {
  return new Promise((resolve) => {
    notificationState.prompt.title = title;
    notificationState.prompt.message = message;
    notificationState.prompt.placeholder = placeholder;
    notificationState.prompt.value = ''; // Limpa o campo
    notificationState.prompt.visible = true;
    notificationState.prompt.resolve = resolve;
  });
}

export function handlePrompt(submit, value) {
  if (notificationState.prompt.resolve) {
    // Se o usuário clicou em Salvar (submit = true), devolve o texto. Se cancelou, devolve null.
    notificationState.prompt.resolve(submit ? value : null);
  }
  notificationState.prompt.visible = false;
}