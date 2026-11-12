<!-- src/views/Motivos.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

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
    alert('O nome do motivo é obrigatório.');
    return;
  }

  const motivoDados = {
    id: editandoId.value || uuidv4(),
    nome: form.value.nome.trim(),
    natureza: form.value.natureza,
    ordem: Number(form.value.ordem),
    ativo: true // Todo novo motivo começa ativo
  };

  try {
    if (editandoId.value) {
      // Preserva o status 'ativo' caso estivesse editando
      const original = motivos.value.find(m => m.id === editandoId.value);
      motivoDados.ativo = original.ativo;
      await putItem('motivos', JSON.parse(JSON.stringify(motivoDados)));
    } else {
      await addItem('motivos', JSON.parse(JSON.stringify(motivoDados)));
    }

    alert('Motivo salvo com sucesso!');
    mostrarFormulario.value = false;
    await carregarMotivos();
  } catch (e) {
    alert('Erro ao salvar motivo: ' + e.message);
  }
}

async function alternarStatus(motivo) {
  const novoStatus = !motivo.ativo;
  const msg = novoStatus === false 
    ? `Desativar "${motivo.nome}"? Ele não aparecerá mais na tela de ponto.`
    : `Reativar "${motivo.nome}"?`;

  if (!confirm(msg)) return;

  try {
    await putItem('motivos', JSON.parse(JSON.stringify({ ...motivo, ativo: novoStatus })));
    await carregarMotivos();
  } catch (e) {
    alert('Erro ao alterar status: ' + e);
  }
}
</script>

<template>
  <div class="container">
    <header class="header">
      <router-link to="/configuracoes" class="btn-back">← Voltar</router-link>
      <h1>Motivos de Ponto</h1>
      <button @click="abrirNovo" class="btn-primary" v-if="!mostrarFormulario">+ Novo</button>
    </header>

    <!-- Formulário -->
    <div v-if="mostrarFormulario" class="card form-card">
      <h2>{{ editandoId ? 'Editar Motivo' : 'Novo Motivo' }}</h2>
      
      <div class="form-group">
        <label>Nome do Botão *</label>
        <input v-model="form.nome" type="text" placeholder="Ex: Pausa Café" />
      </div>

      <div class="form-group">
        <label>Natureza *</label>
        <select v-model="form.natureza">
          <option value="trabalho">Trabalho (Inicia período)</option>
          <option value="pausa">Pausa (Encerra período)</option>
        </select>
        <small class="hint">A natureza diz ao sistema se este botão faz o tempo começar a contar ou parar.</small>
      </div>

      <div class="form-group">
        <label>Ordem de exibição</label>
        <input v-model="form.ordem" type="number" min="1" />
        <small class="hint">Números menores aparecem primeiro na tela de ponto.</small>
      </div>

      <div class="actions">
        <button @click="mostrarFormulario = false" class="btn-cancel">Cancelar</button>
        <button @click="salvarMotivo" class="btn-success">Salvar</button>
      </div>
    </div>

    <!-- Lista -->
    <div class="lista" v-if="!mostrarFormulario">
      <div v-for="motivo in motivos" :key="motivo.id" class="card item-motivo" :class="{ 'inativo': !motivo.ativo }">
        <div class="info">
          <h3>
            <span class="ordem-badge">{{ motivo.ordem }}</span>
            {{ motivo.nome }}
          </h3>
          <span class="natureza" :class="motivo.natureza">
            {{ motivo.natureza === 'trabalho' ? '⏱️ Trabalho' : '☕ Pausa' }}
          </span>
        </div>
        
        <div class="actions-colab">
          <span class="badge" :class="motivo.ativo ? 'ativo' : 'inativo'">{{ motivo.ativo ? 'ativo' : 'inativo' }}</span>
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
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header h1 { font-size: 1.2rem; margin: 0; flex: 1; text-align: center; }
.btn-back { text-decoration: none; color: var(--color-primary, #2563eb); font-weight: bold; font-size: 0.9rem; }
.btn-primary { background: var(--color-primary, #2563eb); color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.9rem; }
.card { background: var(--color-surface, #fff); padding: 16px; border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; }
.form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.hint { display: block; font-size: 0.8rem; color: var(--color-muted, #64748b); margin-top: 4px; }
.actions { display: flex; gap: 10px; margin-top: 16px; }
.btn-cancel { flex: 1; padding: 12px; border: 1px solid #ccc; background: #fff; border-radius: 8px; font-weight: bold; cursor: pointer; }
.btn-success { flex: 1; background: var(--color-success, #16a34a); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; }
.item-motivo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; transition: opacity 0.2s; }
.item-motivo.inativo { opacity: 0.5; background: #f8fafc; }
.info h3 { margin: 0 0 4px 0; font-size: 1rem; display: flex; align-items: center; gap: 8px; }
.ordem-badge { background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; }
.natureza { font-size: 0.8rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
.natureza.trabalho { background: #dcfce7; color: #166534; }
.natureza.pausa { background: #fef3c7; color: #92400e; }
.actions-colab { display: flex; align-items: center; gap: 8px; }
.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
.badge.ativo { background: #dcfce7; color: #166534; }
.badge.inativo { background: #fee2e2; color: #991b1b; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: #e2e8f0; }
</style>