<!-- src/views/AjustesPonto.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems, putItem, addItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';
import { showToast, showConfirm, showPrompt } from '../application/NotificationService.js';


const colaboradores = ref([]);
const motivos = ref([]);
const colaboradorSelecionadoId = ref('');
const marcacoes = ref([]);

// Formulário de Edição/Inclusão
const editando = ref(false);
const marcacaoAtual = ref(null);
const justificativa = ref('');

onMounted(async () => {
  const todosColab = await getAllItems('colaboradores');
  colaboradores.value = todosColab.sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === 'ativo' ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });
  
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

  return Object.keys(dias)
    .sort((a, b) => new Date(b) - new Date(a)) // Mais recentes primeiro
    .map(dia => ({
      data: dia,
      items: dias[dia].sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal))
    }));
});

function formatarDataExibicao(dataStr) {
  return dataStr.split('-').reverse().join('/');
}

function formatarHora(isoStr) {
  return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function abrirEdicao(marcacao) {
  if (marcacao.anulada) return; // Bloqueia a edição se estiver anulada
  
  marcacaoAtual.value = JSON.parse(JSON.stringify(marcacao));
  justificativa.value = '';
  editando.value = true;
}

// Adicione esta nova função para reativar:
async function reativarMarcacao(marcacao) {
  const confirmou = await showConfirm(
    'Reativar Marcação',
    `Deseja reativar a marcação das ${formatarHora(marcacao.dataHoraLocal)}?`
  );
  if (!confirmou) {
    return;
  }

  const justificativaReativacao = await showPrompt(
    'Reativar Marcação',
    'Por favor, informe o motivo da reativação (obrigatório):',
    'Digite o motivo da reativação...'
  );
  if (!justificativaReativacao || !justificativaReativacao.trim()) {
    showToast('A reativação foi cancelada. A justificativa é obrigatória.', 'info');
    return;
  }

  try {
    // Registra na auditoria
    await addItem('ajustes', {
      id: uuidv4(),
      marcacaoId: marcacao.id,
      valorOriginal: JSON.parse(JSON.stringify(marcacao)),
      valorCorrigido: { ...marcacao, anulada: false },
      justificativa: justificativaReativacao,
      tipo: 'reativacao',
      criadoEm: new Date().toISOString()
    });

    // Atualiza no banco
    const marcacaoReativada = { ...marcacao, anulada: false };
    await putItem('marcacoes', JSON.parse(JSON.stringify(marcacaoReativada)));

    marcacoes.value = await getAllItems('marcacoes');
    showToast('Marcação reativada com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Erro ao reativar marcação: ', 'error');
  }
}

function abrirNovaMarcacao(dia) {
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

function atualizarNatureza() {
  const motivo = motivos.value.find(m => m.id === marcacaoAtual.value.motivoId);
  if (motivo) {
    marcacaoAtual.value.natureza = motivo.natureza;
  }
}

async function salvarAjuste() {
  if (!justificativa.value.trim()) {
    showToast('A justificativa é obrigatória para ajustes.', 'info');
    return;
  }

  try {
    const cloneProfundo = (obj) => JSON.parse(JSON.stringify(obj));

    if (marcacaoAtual.value.isNova) {
      const nova = cloneProfundo(marcacaoAtual.value);
      delete nova.isNova;
      await addItem('marcacoes', nova);
    } else {
      const original = marcacoes.value.find(m => m.id === marcacaoAtual.value.id);
      
      const originalPuro = cloneProfundo(original);
      const corrigidoPuro = cloneProfundo(marcacaoAtual.value);
      delete corrigidoPuro.isNova;

      const novoAjuste = {
        id: uuidv4(),
        marcacaoId: originalPuro.id,
        valorOriginal: originalPuro,
        valorCorrigido: corrigidoPuro,
        justificativa: justificativa.value,
        criadoEm: new Date().toISOString()
      };

      await addItem('ajustes', cloneProfundo(novoAjuste));
      await putItem('marcacoes', corrigidoPuro);
    }

    marcacoes.value = await getAllItems('marcacoes');
    editando.value = false;
    showToast('Ajuste salvo com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Erro ao salvar ajuste: ', 'error');
  }
}

async function anularMarcacao(marcacao) {
  const confirmou = await showConfirm(
    'Anular Marcação',
    `Deseja realmente excluir a marcação das ${formatarHora(marcacao.dataHoraLocal)}?`
  );
  if (!confirmou) {
    return;
  }


  const justificativaAnulacao = await showPrompt(
    'Anular Marcação',
    'Por favor, informe o motivo da exclusão (obrigatório):',
    'Digite o motivo da exclusão...'
  );
  
  if (!justificativaAnulacao || !justificativaAnulacao.trim()) {
    showToast('A exclusão foi cancelada. A justificativa é obrigatória.', 'info');
    return;
  }

  try {
    await addItem('ajustes', {
      id: uuidv4(),
      marcacaoId: marcacao.id,
      valorOriginal: JSON.parse(JSON.stringify(marcacao)),
      valorCorrigido: null,
      justificativa: justificativaAnulacao,
      tipo: 'exclusao',
      criadoEm: new Date().toISOString()
    });

    const marcacaoAnulada = { ...marcacao, anulada: true };
    await putItem('marcacoes', JSON.parse(JSON.stringify(marcacaoAnulada)));

    marcacoes.value = await getAllItems('marcacoes');
    showToast('Marcação anulada com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Erro ao anular marcação: ', 'error');
  }
}
</script>

<template>

  <header class="app-header">
    <h1>Tratamento de Ponto</h1>
    <p>Corrija erros, adicione marcações ou audite</p>
  </header>

  <div class="page-container">

    <!-- Filtro de Colaborador -->
    <div class="card filter-card no-print" v-if="!editando">
      <label class="form-label">Selecione o colaborador</label>
      <select v-model="colaboradorSelecionadoId" class="form-select">
        <option v-for="c in colaboradores" :key="c.id" :value="c.id">
          {{ c.nome }} {{ c.situacao === 'inativo' ? '(Inativo)' : '' }}
        </option>
      </select>
    </div>

    <!-- Lista de Dias -->
    <div v-if="!editando" class="lista-dias">
      <div v-if="diasTrabalhados.length === 0" class="empty-state">
        Nenhuma marcação encontrada para este colaborador.
      </div>

      <div v-for="dia in diasTrabalhados" :key="dia.data" class="card dia-card">
        <div class="dia-header">
          <h3>{{ formatarDataExibicao(dia.data) }}</h3>
          <button @click="abrirNovaMarcacao(dia.data)" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
            + Adicionar
          </button>
        </div>
        
        <div class="marcacoes-list">
          <div 
            v-for="marc in dia.items" 
            :key="marc.id" 
            class="marcacao-item" 
            :class="{ 'anulada': marc.anulada }"
          >
            <!-- Área de clique para editar (desabilitada se anulada) -->
            <div 
              @click="abrirEdicao(marc)" 
              class="marcacao-content"
              :style="{ cursor: marc.anulada ? 'not-allowed' : 'pointer' }"
            >
              <span class="hora">{{ formatarHora(marc.dataHoraLocal) }}</span>
              <span class="motivo">{{ motivos.find(m => m.id === marc.motivoId)?.nome || '?' }}</span>
              <span class="badge-tipo" :class="marc.natureza">{{ marc.natureza === 'trabalho' ? 'Trabalho' : 'Pausa' }}</span>
            </div>
            
            <!-- Botão de Ação: Lixeira (Anular) ou Check (Reativar) -->
            <button 
              v-if="!marc.anulada"
              @click.stop="anularMarcacao(marc)" 
              class="btn-action-icon btn-trash" 
              title="Excluir (Anular) Marcação"
            >
              🗑️
            </button>
            <button 
              v-else
              @click.stop="reativarMarcacao(marc)" 
              class="btn-action-icon btn-reativar" 
              title="Reativar Marcação"
            >
              ♻️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Formulário de Edição/Inclusão (Focado) -->
    <div v-if="editando" class="card form-card">
      <div class="form-header">
        <h2>{{ marcacaoAtual.isNova ? 'Adicionar Marcação' : 'Editar Marcação' }}</h2>
        <button @click="editando = false" class="btn-close">✕</button>
      </div>
      
      <div class="form-group">
        <label class="form-label">Data e Hora</label>
        <input type="datetime-local" v-model="marcacaoAtual.dataHoraLocal" step="1" class="form-input" />
      </div>

      <div class="form-group">
        <label class="form-label">Motivo</label>
        <select v-model="marcacaoAtual.motivoId" @change="atualizarNatureza" class="form-select">
          <option v-for="m in motivos" :key="m.id" :value="m.id">
            {{ m.nome }} ({{ m.natureza }})
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Justificativa (Obrigatória)</label>
        <textarea v-model="justificativa" rows="3" class="form-input" placeholder="Ex: Colaborador esqueceu de bater o ponto..."></textarea>
        <small class="hint">Este texto ficará salvo no histórico de auditoria.</small>
      </div>

      <div class="form-actions">
        <button @click="editando = false" class="btn btn-outline">Cancelar</button>
        <button @click="salvarAjuste" class="btn btn-primary">Salvar</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Filtro */
.filter-card {
  padding: 16px;
  margin-bottom: 24px;
  border-top: 4px solid var(--color-primary);
}

/* Lista de Dias */
.lista-dias {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dia-card {
  padding: 0; /* O padding será feito nos itens internos */
  overflow: hidden;
}

.dia-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.dia-header h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-text);
}

.marcacoes-list {
  display: flex;
  flex-direction: column;
}

.marcacao-item {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-right: 8px;
  transition: background 0.2s;
}
.marcacao-item:last-child { border-bottom: none; }
.marcacao-item:hover { background: #f8fafc; }

.marcacao-content {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  gap: 12px;
}

.hora {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--color-text);
  min-width: 50px;
}

.motivo {
  flex: 1;
  font-size: 0.95rem;
  color: var(--color-muted);
  font-weight: 500;
}

.badge-tipo {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-tipo.trabalho { background: var(--color-success-light); color: #065f46; }
.badge-tipo.pausa { background: var(--color-warning-light); color: #92400e; }

/* Estilos para item anulado */
.marcacao-item.anulada { opacity: 0.6; background: #fff1f2; }
.marcacao-item.anulada .hora, 
.marcacao-item.anulada .motivo { text-decoration: line-through; color: #9f1239; }
.marcacao-item.anulada .badge-tipo { display: none; }
/* Garantir que a área de conteúdo não mude de cor no hover se estiver anulada */
.marcacao-item.anulada .marcacao-content:hover {
  background: transparent;
}

.btn-action-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s;
  opacity: 0.5;
}

.btn-trash {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  opacity: 0.4;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-trash:hover { 
  opacity: 1; 
  background: #fee2e2; 
}

.btn-reativar {
  opacity: 0.8;
}
.btn-reativar:hover { 
  opacity: 1; 
  background: #dcfce7; 
}

/* Formulário de Edição */
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

.hint { display: block; font-size: 0.8rem; color: var(--color-muted); margin-top: 6px; }

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.form-actions .btn { flex: 1; }

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: var(--radius-lg);
  color: var(--color-muted);
}
</style>