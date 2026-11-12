<!-- src/views/Home.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems, addItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

// Estado
const motivos = ref([]);
const colaboradores = ref([]);
const colaboradorSelecionadoId = ref('');
const marcacoesHoje = ref([]);

const registrando = ref(false);

// Carregar dados
onMounted(async () => {
  // Busca todos e filtra apenas os ativos, ordenando pela ordem
  const todosMotivos = await getAllItems('motivos');
  motivos.value = todosMotivos
    .filter(m => m.ativo !== false) // Se por acaso algum for undefined (antigo), considera ativo
    .sort((a, b) => a.ordem - b.ordem);
    
  colaboradores.value = (await getAllItems('colaboradores')).filter(c => c.situacao === 'ativo');
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
  
  await carregarMarcacoesHoje();
});

// Formatar data para exibição
const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

// Filtrar marcações do colaborador logado
const minhasMarcacoesHoje = computed(() => {
  return marcacoesHoje.value
    .filter(m => m.colaboradorId === colaboradorSelecionadoId.value)
    .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));
});

async function carregarMarcacoesHoje() {
  const todas = await getAllItems('marcacoes');
  
  // Pega a data local do dispositivo no formato YYYY-MM-DD
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const hojeStr = `${ano}-${mes}-${dia}`; 
  
  // Filtra usando a data local correta
  marcacoesHoje.value = todas.filter(m => m.dataHoraLocal.startsWith(hojeStr));
}

async function registrarPonto(motivo) {
  if (!colaboradorSelecionadoId.value) {
    alert('Selecione um colaborador primeiro.');
    return;
  }

    // TRAVA DE SEGURANÇA CONTRA DUPLO CLIQUE
  if (registrando.value) return; 
  registrando.value = true;

  const agora = new Date();
  // Ajuste de fuso horário para garantir hora local exata
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
    // Feedback tátil se disponível
    if (navigator.vibrate) navigator.vibrate(50);
  } catch (e) {
    alert('Erro ao registrar ponto: ' + e);
  }finally {
    // Libera a trava após 2 segundos
    setTimeout(() => { registrando.value = false; }, 2000); 
  }
}
</script>

<template>
  <div class="ponto-container">
    <header class="header">
      <h1>Registrar Ponto</h1>
      <p class="date">{{ dataAtual }}</p>
    </header>


    <main class="main-content">
      <!-- Seleção de Colaborador -->
      <div class="card">
        <label for="colaborador" class="label">Colaborador:</label>
        <select id="colaborador" v-model="colaboradorSelecionadoId" class="input-select">
          <option v-for="colab in colaboradores" :key="colab.id" :value="colab.id">
            {{ colab.nome }}
          </option>
        </select>
      </div>

      <!-- Botões de Ação -->
      <div class="actions-grid">
        <button 
          v-for="motivo in motivos" 
          :key="motivo.id"
          @click="registrarPonto(motivo)"
          class="btn-ponto"
          :class="motivo.natureza === 'trabalho' ? 'btn-entrada' : 'btn-pausa'"
          :disabled="registrando"
        >
          {{ motivo.nome }}
        </button>
      </div>

      <!-- Histórico do Dia -->
      <div class="card historico">
        <h2>Histórico de Hoje</h2>
        <ul v-if="minhasMarcacoesHoje.length > 0">
          <li v-for="marc in minhasMarcacoesHoje" :key="marc.id">
            <span class="hora">{{ new Date(marc.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</span>
            <span class="motivo">{{ motivos.find(m => m.id === marc.motivoId)?.nome || 'Motivo removido' }}</span>
          </li>
        </ul>
        <p v-else class="empty-state">Nenhuma marcação registrada hoje.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.ponto-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.header h1 {
  color: var(--color-primary, #2563eb);
  margin: 0;
}
.date {
  color: var(--color-muted, #64748b);
  font-size: 1.1rem;
  text-transform: capitalize;
}
.card {
  background: var(--color-surface, #fff);
  padding: 16px;
  border-radius: var(--radius-md, 10px);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08));
  margin-bottom: 24px;
}
.label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}
.input-select {
  width: 100%;
  padding: 12px;
  font-size: 1.1rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid #ccc;
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.btn-ponto {
  padding: 20px 10px;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  border-radius: var(--radius-md, 10px);
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08));
  color: white;
}
.btn-ponto:active {
  transform: scale(0.95);
}
.btn-entrada {
  background-color: var(--color-success, #16a34a);
}
.btn-pausa {
  background-color: var(--color-warning, #d97706);
}
.historico h2 {
  font-size: 1.2rem;
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}
.historico ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.historico li {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 1.1rem;
}
.hora {
  font-weight: bold;
  color: var(--color-primary, #2563eb);
}
.empty-state {
  text-align: center;
  color: var(--color-muted, #64748b);
  padding: 16px;
}

.btn-ponto:disabled { opacity: 0.5; cursor: not-allowed; }

</style>