<!-- src/views/AjustesPonto.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems, putItem, addItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

const colaboradores = ref([]);
const motivos = ref([]);
const colaboradorSelecionadoId = ref('');
const marcacoes = ref([]);

// Formulário de Edição/Inclusão
const editando = ref(false);
const marcacaoAtual = ref(null);
const justificativa = ref('');

onMounted(async () => {
  colaboradores.value = await getAllItems('colaboradores');
  motivos.value = (await getAllItems('motivos')).sort((a, b) => a.ordem - b.ordem);
  marcacoes.value = await getAllItems('marcacoes');
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
});

// Agrupa as marcações por dia para o colaborador selecionado
const diasTrabalhados = computed(() => {
  const filtradas = marcacoes.value.filter(m => m.colaboradorId === colaboradorSelecionadoId.value);
  const dias = {};
  
  filtradas.forEach(m => {
    const dia = m.dataHoraLocal.split('T')[0];
    if (!dias[dia]) dias[dia] = [];
    dias[dia].push(m);
  });

  // Retorna um array de objetos { data, marcacoesDoDia }
  return Object.keys(dias)
    .sort((a, b) => new Date(b) - new Date(a)) // Mais recentes primeiro
    .map(dia => ({
      data: dia,
      items: dias[dia].sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal))
    }));
});

function abrirEdicao(marcacao) {
  // Copia os dados para não alterar na tela antes de salvar
  marcacaoAtual.value = JSON.parse(JSON.stringify(marcacao));
  justificativa.value = '';
  editando.value = true;
}

function abrirNovaMarcacao(dia) {
  // Cria uma marcação em branco para o dia selecionado (ex: 12:00)
  marcacaoAtual.value = {
    id: uuidv4(),
    colaboradorId: colaboradorSelecionadoId.value,
    dataHoraLocal: `${dia}T12:00:00`,
    motivoId: motivos.value[0]?.id || '',
    natureza: motivos.value[0]?.natureza || 'trabalho',
    origem: 'ajuste',
    inconsistente: false,
    isNova: true
  };
  justificativa.value = '';
  editando.value = true;
}

// Atualiza a natureza quando o motivo muda
function atualizarNatureza() {
  const motivo = motivos.value.find(m => m.id === marcacaoAtual.value.motivoId);
  if (motivo) {
    marcacaoAtual.value.natureza = motivo.natureza;
  }
}

async function salvarAjuste() {
  if (!justificativa.value.trim()) {
    alert('A justificativa é obrigatória para ajustes.');
    return;
  }

  try {
    // Função auxiliar para remover a reatividade do Vue antes de salvar no IndexedDB
    const cloneProfundo = (obj) => JSON.parse(JSON.stringify(obj));

    if (marcacaoAtual.value.isNova) {
      // Nova marcação
      const nova = cloneProfundo(marcacaoAtual.value);
      delete nova.isNova; // Remove a flag temporária
      await addItem('marcacoes', nova);
    } else {
      // Edição de marcação existente
      const original = marcacoes.value.find(m => m.id === marcacaoAtual.value.id);
      
      // Prepara os objetos puros para salvar
      const originalPuro = cloneProfundo(original);
      const corrigidoPuro = cloneProfundo(marcacaoAtual.value);
      delete corrigidoPuro.isNova;

      // Salva o histórico de auditoria (AQUI ESTAVA O ERRO)
      const novoAjuste = {
        id: uuidv4(),
        marcacaoId: originalPuro.id,
        valorOriginal: originalPuro,
        valorCorrigido: corrigidoPuro,
        justificativa: justificativa.value,
        criadoEm: new Date().toISOString()
      };

      await addItem('ajustes', cloneProfundo(novoAjuste));

      // Atualiza a marcação real
      await putItem('marcacoes', corrigidoPuro);
    }

    // Recarrega os dados
    marcacoes.value = await getAllItems('marcacoes');
    editando.value = false;
    alert('Ajuste salvo com sucesso!');
  } catch (e) {
    console.error(e);
    alert('Erro ao salvar ajuste: ' + e.message);
  }
}

async function anularMarcacao(marcacao) {
  if (!confirm(`Deseja realmente excluir a marcação das ${new Date(marcacao.dataHoraLocal).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}?`)) {
    return;
  }

  const justificativa = prompt('Por favor, informe o motivo da exclusão (obrigatório):');
  if (!justificativa || !justificativa.trim()) {
    alert('A exclusão foi cancelada. A justificativa é obrigatória.');
    return;
  }

  try {
    // Cria o registro de auditoria da exclusão
    await addItem('ajustes', {
      id: uuidv4(),
      marcacaoId: marcacao.id,
      valorOriginal: JSON.parse(JSON.stringify(marcacao)),
      valorCorrigido: null,
      justificativa: justificativa,
      tipo: 'exclusao',
      criadoEm: new Date().toISOString()
    });

    // Marca como anulada no banco
    const marcacaoAnulada = { ...marcacao, anulada: true };
    await putItem('marcacoes', JSON.parse(JSON.stringify(marcacaoAnulada)));

    marcacoes.value = await getAllItems('marcacoes');
    alert('Marcação anulada com sucesso!');
  } catch (e) {
    console.error(e);
    alert('Erro ao anular marcação: ' + e.message);
  }
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>Tratamento de Ponto</h1>
    </header>

    <div class="card filtros">
      <label>Colaborador</label>
      <select v-model="colaboradorSelecionadoId" @change="editando = false">
        <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
    </div>

    <!-- Lista de Dias -->
    <div v-if="!editando" class="lista-dias">
      <div v-for="dia in diasTrabalhados" :key="dia.data" class="card dia-card">
        <div class="dia-header">
          <h3>{{ dia.data.split('-').reverse().join('/') }}</h3>
          <button @click="abrirNovaMarcacao(dia.data)" class="btn-small">+ Adicionar</button>
        </div>
        
        <div class="marcacoes-list">
          <div 
            v-for="marc in dia.items" 
            :key="marc.id" 
            class="marcacao-item" 
            :class="{ 'anulada': marc.anulada }"
          >
            <div @click="abrirEdicao(marc)" class="marcacao-click-area" style="flex: 1; display: flex; cursor: pointer;">
              <span class="hora">{{ new Date(marc.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</span>
              <span class="motivo">{{ motivos.find(m => m.id === marc.motivoId)?.nome }}</span>
              <span class="edit-icon">✏️</span>
            </div>
            <button @click.stop="anularMarcacao(marc)" class="btn-trash" title="Excluir (Anular) Marcação">🗑️</button>
          </div>
        </div>
      </div>
      
      <p v-if="diasTrabalhados.length === 0" class="empty">Nenhuma marcação encontrada.</p>
    </div>

    <!-- Formulário de Edição -->
    <div v-if="editando" class="card form-edit">
      <h2>{{ marcacaoAtual.isNova ? 'Adicionar Marcação' : 'Editar Marcação' }}</h2>
      
      <div class="form-group">
        <label>Data e Hora</label>
        <input type="datetime-local" v-model="marcacaoAtual.dataHoraLocal" step="1" />
      </div>

      <div class="form-group">
        <label>Motivo</label>
        <select v-model="marcacaoAtual.motivoId" @change="atualizarNatureza">
          <option v-for="m in motivos" :key="m.id" :value="m.id">{{ m.nome }} ({{ m.natureza }})</option>
        </select>
      </div>

      <div class="form-group">
        <label>Justificativa (Obrigatória)</label>
        <textarea v-model="justificativa" rows="3" placeholder="Ex: Colaborador esqueceu de bater o ponto..."></textarea>
      </div>

      <div class="actions">
        <button @click="editando = false" class="btn-cancel">Cancelar</button>
        <button @click="salvarAjuste" class="btn-save">Salvar Ajuste</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header h1 { font-size: 1.5rem; margin-bottom: 20px; text-align: center; }
.card { background: var(--color-surface, #fff); padding: 16px; border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); margin-bottom: 16px; }
.filtros label { display: block; font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; }
.filtros select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.dia-card { padding: 12px; }
.dia-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px; }
.dia-header h3 { margin: 0; font-size: 1.1rem; }
.btn-small { background: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; }
.marcacao-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px dashed #f1f5f9; cursor: pointer; }
.marcacao-item:hover { background: #f8fafc; }
.hora { font-weight: bold; color: var(--color-primary, #2563eb); width: 60px; }
.motivo { flex: 1; }
.edit-icon { font-size: 1.2rem; opacity: 0.5; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; font-family: inherit; }
.actions { display: flex; gap: 10px; }
.btn-cancel { flex: 1; padding: 12px; border: 1px solid #ccc; background: #fff; border-radius: 8px; font-weight: bold; cursor: pointer; }
.btn-save { flex: 1; padding: 12px; border: none; background: var(--color-primary, #2563eb); color: white; border-radius: 8px; font-weight: bold; cursor: pointer; }
.empty { text-align: center; color: var(--color-muted, #64748b); }

.marcacao-item { display: flex; align-items: center; border-bottom: 1px dashed #f1f5f9; }
.marcacao-item:hover { background: #f8fafc; }
.marcacao-item.anulada { opacity: 0.5; }
.marcacao-item.anulada .hora, .marcacao-item.anulada .motivo { text-decoration: line-through; color: #999; }
.btn-trash { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 8px; opacity: 0.5; }
.btn-trash:hover { opacity: 1; background: #fee2e2; border-radius: 4px; }
</style>