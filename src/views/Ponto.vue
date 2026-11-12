<!-- src/views/Ponto.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems, addItem } from '../infrastructure/database.js';
import { apurarDia } from '../domain/ApuracaoJornada.js';
import { v4 as uuidv4 } from 'uuid';

// Estado
const motivos = ref([]);
const colaboradores = ref([]);
const colaboradorSelecionadoId = ref('');
const marcacoesHoje = ref([]);
const valoresHora = ref([]);
const registrando = ref(false);

// Carregar dados
onMounted(async () => {
  const todosMotivos = await getAllItems('motivos');
  motivos.value = todosMotivos
    .filter(m => m.ativo !== false)
    .sort((a, b) => a.ordem - b.ordem);
    
  colaboradores.value = (await getAllItems('colaboradores'))
    .filter(c => c.situacao === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome));
  
  valoresHora.value = await getAllItems('valoresHora');

  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
  
  await carregarMarcacoesHoje();
});

const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

// Filtra marcações do colaborador selecionado
const minhasMarcacoesHoje = computed(() => {
  return marcacoesHoje.value
    .filter(m => m.colaboradorId === colaboradorSelecionadoId.value)
    .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));
});

// Calcula as horas trabalhadas hoje para o colaborador selecionado
const resumoHoje = computed(() => {
  if (!colaboradorSelecionadoId.value) return { minutos: 0, horasStr: '0h 00m' };
  
  const marcs = minhasMarcacoesHoje.value;
  const valorHora = valoresHora.value.find(v => v.colaboradorId === colaboradorSelecionadoId.value)?.valorCentavos || 0;
  
  const apuracao = apurarDia(marcs, valorHora);
  const min = apuracao.minutosTrabalhados;
  
  return {
    minutos: min,
    horasStr: `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
  };
});

const colaboradorAtualNome = computed(() => {
  return colaboradores.value.find(c => c.id === colaboradorSelecionadoId.value)?.nome || 'Nenhum';
});

async function carregarMarcacoesHoje() {
  const todas = await getAllItems('marcacoes');
  
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const hojeStr = `${ano}-${mes}-${dia}`; 
  
  marcacoesHoje.value = todas.filter(m => m.dataHoraLocal.startsWith(hojeStr));
}

async function registrarPonto(motivo) {
  if (!colaboradorSelecionadoId.value) return;
  if (registrando.value) return; 
  
  registrando.value = true;

  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  const dataHoraLocal = new Date(agora.getTime() - offset).toISOString().slice(0, 19);

  const novaMarcacao = {
    id: uuidv4(),
    colaboradorId: colaboradorSelecionadoId.value,
    dataHoraLocal: dataHoraLocal,
    motivoId: motivo.id,
    natureza: motivo.natureza,
    origem: 'colaborador',
    inconsistente: false,
    criadoEm: new Date().toISOString()
  };

  try {
    await addItem('marcacoes', novaMarcacao);
    await carregarMarcacoesHoje();
    if (navigator.vibrate) navigator.vibrate(50);
  } catch (e) {
    alert('Erro ao registrar ponto: ' + e);
  } finally {
    setTimeout(() => { registrando.value = false; }, 2000); 
  }
}
</script>

<template>
  <div class="page-container">
    <header>
      <h1 class="page-title">Registrar Ponto</h1>
      <p class="page-subtitle">{{ dataAtual }}</p>
    </header>

    <!-- Seletor de Colaborador (Scroll Horizontal) -->
    <div class="colaborador-selector no-print">
      <button 
        v-for="colab in colaboradores" 
        :key="colab.id"
        @click="colaboradorSelecionadoId = colab.id"
        class="colab-pill"
        :class="{ active: colaboradorSelecionadoId === colab.id }"
      >
        {{ colab.nome.split(' ')[0] }} <!-- Mostra só o primeiro nome para não quebrar -->
      </button>
    </div>

    <!-- Painel de Status Atual -->
    <div class="status-panel card">
      <div class="status-header">
        <span class="status-name">{{ colaboradorAtualNome }}</span>
        <span class="status-time">{{ resumoHoje.horasStr }}</span>
      </div>
      <p class="status-label">Total trabalhado hoje</p>
    </div>

    <!-- Botões de Ação (Gigantes) -->
    <div class="actions-grid">
      <button 
        v-for="motivo in motivos" 
        :key="motivo.id"
        @click="registrarPonto(motivo)"
        class="btn-action"
        :class="motivo.natureza === 'trabalho' ? 'btn-entrada' : 'btn-pausa'"
        :disabled="registrando"
      >
        <!-- Ícone dinâmico baseado na natureza -->
        <span class="action-icon">{{ motivo.natureza === 'trabalho' ? '▶️' : '⏸️' }}</span>
        <span class="action-text">{{ motivo.nome }}</span>
      </button>
    </div>

    <!-- Histórico do Dia -->
    <div class="card">
      <h2 class="section-title">Histórico de Hoje</h2>
      <ul v-if="minhasMarcacoesHoje.length > 0" class="history-list">
        <li v-for="marc in minhasMarcacoesHoje" :key="marc.id">
          <div class="history-time">{{ new Date(marc.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</div>
          <div class="history-motivo" :class="marc.natureza">{{ motivos.find(m => m.id === marc.motivoId)?.nome || 'Removido' }}</div>
        </li>
      </ul>
      <p v-else class="empty-state">Nenhuma marcação registrada hoje.</p>
    </div>
  </div>
</template>

<style scoped>
/* Seletor de Colaborador */
.colaborador-selector {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 16px;
  margin-bottom: 8px;
  -webkit-overflow-scrolling: touch; /* Scroll suave no iOS */
}
.colaborador-selector::-webkit-scrollbar { display: none; } /* Esconde a barra de rolagem */

.colab-pill {
  background: white;
  border: 2px solid #e2e8f0;
  padding: 10px 20px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.colab-pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
}

/* Painel de Status */
.status-panel {
  background: var(--color-primary);
  color: white;
  text-align: center;
  padding: 24px;
  border: none;
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
}
.status-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.status-name {
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0.9;
}
.status-time {
  font-size: 2rem;
  font-weight: 800;
}
.status-label {
  font-size: 0.85rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Botões de Ação Gigantes */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2 colunas no celular */
  gap: 16px;
  margin-bottom: 32px;
}
@media (min-width: 600px) {
  .actions-grid { grid-template-columns: repeat(3, 1fr); } /* 3 colunas no PC */
}

.btn-action {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px 12px;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: var(--shadow-sm);
}
.btn-action:active { transform: scale(0.95); }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

.action-icon { font-size: 2rem; margin-bottom: 8px; }
.action-text { text-align: center; line-height: 1.2; }

.btn-entrada { background: var(--color-success); }
.btn-pausa { background: var(--color-warning); }

/* Histórico */
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}
.history-list li:last-child { border-bottom: none; }

.history-time {
  font-weight: 800;
  font-size: 1.2rem;
  color: var(--color-text);
}
.history-motivo {
  font-size: 0.9rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: var(--radius-full);
}
.history-motivo.trabalho { background: var(--color-success-light); color: #065f46; }
.history-motivo.pausa { background: var(--color-warning-light); color: #92400e; }

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--color-muted);
}
</style>