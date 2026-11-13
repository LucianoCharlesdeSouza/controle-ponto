<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';
import { showToast, showConfirm } from '../application/NotificationService.js';


const motivos = ref([]);
const mostrarFormulario = ref(false);
const editandoId = ref(null);

const form = ref({
  nome: '',
  natureza: 'trabalho',
  ordem: 1
});

onMounted(carregarMotivos);

async function carregarMotivos() {
  const todos = await getAllItems('motivos');
  motivos.value = todos.sort((a, b) => a.ordem - b.ordem);
}

function abrirNovo() {
  editandoId.value = null;
  const proximaOrdem = motivos.value.length > 0 ? Math.max(...motivos.value.map(m => m.ordem)) + 1 : 1;
  form.value = { nome: '', natureza: 'trabalho', ordem: proximaOrdem };
  mostrarFormulario.value = true;
}

function abrirEdicao(motivo) {
  editandoId.value = motivo.id;
  form.value = {
    nome: motivo.nome,
    natureza: motivo.natureza,
    ordem: motivo.ordem
  };
  mostrarFormulario.value = true;
}

async function salvarMotivo() {
  if (!form.value.nome.trim()) {
    showToast('O nome do motivo é obrigatório.', 'info');
    return;
  }

  const motivoDados = {
    id: editandoId.value || uuidv4(),
    nome: form.value.nome.trim(),
    natureza: form.value.natureza,
    ordem: Number(form.value.ordem),
    ativo: true
  };

  try {
    if (editandoId.value) {
      const original = motivos.value.find(m => m.id === editandoId.value);
      motivoDados.ativo = original.ativo;
      await putItem('motivos', JSON.parse(JSON.stringify(motivoDados)));
    } else {
      await addItem('motivos', JSON.parse(JSON.stringify(motivoDados)));
    }

    showToast('Motivo salvo com sucesso!', 'success');
    mostrarFormulario.value = false;
    await carregarMotivos();
  } catch (e) {
    showToast('Erro ao salvar motivo: ', 'error');
  }
}

async function alternarStatus(motivo) {
  const novoStatus = !motivo.ativo;
  const msg = novoStatus === false 
    ? `Desativar "${motivo.nome}"? Ele não aparecerá mais na tela de ponto.`
    : `Reativar "${motivo.nome}"?`;

  const confirmou = await showConfirm('Alterar Status', msg);
  if (!confirmou) return;

  try {
    await putItem('motivos', JSON.parse(JSON.stringify({ ...motivo, ativo: novoStatus })));
    await carregarMotivos();
    showToast('Status alterado com sucesso!', 'success');
  } catch (e) {
    showToast('Erro ao alterar status.', 'error');
  }
}
</script>

<template>

  <header class="app-header" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
    <div class="header-left">
      <router-link to="/configuracoes" class="btn-back" title="Voltar para Configurações">
        ←
      </router-link>
      <div>
        <h1 class="page-title" style="text-align: left; margin-bottom: 0; font-size: 1.3rem;">Motivos</h1>
        <p class="page-subtitle" style="text-align: left; margin-bottom: 0;">Botões da tela de ponto</p>
      </div>
    </div>
    <button @click="abrirNovo" class="btn btn-primary" v-if="!mostrarFormulario">
      + Novo
    </button>
  </header>  

  <div class="page-container">
    
    <div v-if="mostrarFormulario" class="card form-card">
      <div class="form-header">
        <h2>{{ editandoId ? 'Editar Motivo' : 'Novo Motivo' }}</h2>
        <button @click="mostrarFormulario = false" class="btn-close">✕</button>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nome do Botão *</label>
        <input v-model="form.nome" type="text" class="form-input" placeholder="Ex: Pausa Café" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Natureza *</label>
          <select v-model="form.natureza" class="form-select">
            <option value="trabalho">⏱️ Trabalho (Inicia)</option>
            <option value="pausa">☕ Pausa (Encerra)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Ordem de Exibição</label>
          <input v-model="form.ordem" type="number" min="1" class="form-input" />
        </div>
      </div>
      
      <div class="hint-box">
        💡 A ordem define a posição do botão na tela de ponto. Números menores aparecem primeiro.
      </div>

      <div class="form-actions">
        <button @click="mostrarFormulario = false" class="btn btn-outline">Cancelar</button>
        <button @click="salvarMotivo" class="btn btn-primary">Salvar Motivo</button>
      </div>
    </div>

    <div class="lista" v-if="!mostrarFormulario">
      <div v-if="motivos.length === 0" class="empty-state">
        Nenhum motivo cadastrado. Clique em "+ Novo" para criar.
      </div>

      <div 
        v-for="motivo in motivos" 
        :key="motivo.id" 
        class="motivo-card" 
        :class="{ 'inativo': !motivo.ativo }"
      >
        <div class="motivo-info">
          <div class="motivo-title-row">
            <span class="ordem-badge">{{ motivo.ordem }}</span>
            <h3>{{ motivo.nome }}</h3>
          </div>
          <span class="badge-natureza" :class="motivo.natureza">
            {{ motivo.natureza === 'trabalho' ? '⏱️ Trabalho' : '☕ Pausa' }}
          </span>
        </div>
        
        <div class="motivo-actions">
          <button @click="abrirEdicao(motivo)" class="btn-icon" title="Editar">✏️</button>
          <button @click="alternarStatus(motivo)" class="btn-icon" :title="motivo.ativo ? 'Desativar' : 'Reativar'">
            {{ motivo.ativo ? '🚫' : '✅' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: white;
  color: var(--color-text);
  text-decoration: none;
  font-size: 1.2rem;
  font-weight: bold;
  box-shadow: var(--shadow-sm);
  border: 1px solid #e2e8f0;
  transition: background 0.2s;
}
.btn-back:hover { background: #f1f5f9; }

.form-card {
  border-top: 4px solid var(--color-primary);
}
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.form-header h2 { margin: 0; font-size: 1.3rem; color: var(--color-text); }
.btn-close {
  background: #f1f5f9;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-muted);
}

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
@media (max-width: 500px) {
  .form-row { grid-template-columns: 1fr; }
}

.hint-box {
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  margin-top: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.form-actions .btn { flex: 1; }

.lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.motivo-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 16px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s;
}
.motivo-card:active { transform: scale(0.99); }

.motivo-card.inativo {
  background: #f8fafc;
  opacity: 0.6;
}

.motivo-info { flex: 1; }
.motivo-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.motivo-title-row h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text);
  font-weight: 700;
}

.ordem-badge {
  background: #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 800;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.badge-natureza {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-natureza.trabalho { background: var(--color-success-light); color: #065f46; }
.badge-natureza.pausa { background: var(--color-warning-light); color: #92400e; }

.motivo-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: #f1f5f9;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.btn-icon:hover { background: #e2e8f0; }

.empty-state {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: var(--radius-lg);
  color: var(--color-muted);
}
</style>