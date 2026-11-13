<!-- src/views/Colaboradores.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';
import { showToast, showConfirm } from '../application/NotificationService.js';

const colaboradores = ref([]);
const valoresHora = ref([]);
const mostrarFormulario = ref(false);
const editandoId = ref(null);

const form = ref({
  nome: '',
  cpf: '',
  dataAdmissao: '',
  valorHora: '',
  situacao: 'ativo',
  vigenciaInicio: ''
});

onMounted(carregarDados);

async function carregarDados() {
  const todosColaboradores = await getAllItems('colaboradores');
  const todosValores = await getAllItems('valoresHora');
  
  valoresHora.value = todosValores;

  colaboradores.value = todosColaboradores.map(colab => {
    const valoresColab = todosValores
      .filter(v => v.colaboradorId === colab.id)
      .sort((a, b) => new Date(b.vigenciaInicio) - new Date(a.vigenciaInicio));
    
    const valorAtual = valoresColab.length > 0 ? valoresColab[0].valorCentavos : 0;
    
    return { ...colab, valorAtualCentavos: valorAtual };
  }).sort((a, b) => {
    // Ordena: Ativos primeiro, depois Inativos. Dentro do grupo, ordem alfabética.
    if (a.situacao !== b.situacao) {
      return a.situacao === 'ativo' ? -1 : 1;
    }
    return a.nome.localeCompare(b.nome);
  });
}

function abrirNovo() {
  editandoId.value = null;
  const hoje = new Date().toISOString().split('T')[0];
  form.value = { 
    nome: '', 
    cpf: '', 
    dataAdmissao: hoje, 
    valorHora: '', 
    situacao: 'ativo',
    vigenciaInicio: hoje 
  };
  mostrarFormulario.value = true;
}

function abrirEdicao(colab) {
  editandoId.value = colab.id;
  const hoje = new Date().toISOString().split('T')[0];
  form.value = {
    nome: colab.nome,
    cpf: colab.cpf || '',
    dataAdmissao: colab.dataAdmissao,
    valorHora: (colab.valorAtualCentavos / 100).toFixed(2).replace('.', ','),
    situacao: colab.situacao,
    vigenciaInicio: hoje
  };
  mostrarFormulario.value = true;
}

async function alternarStatus(colab) {
  const novoStatus = colab.situacao === 'ativo' ? 'inativo' : 'ativo';
  const msg = novoStatus === 'inativo' 
    ? `Desativar ${colab.nome}? Ele não aparecerá mais no registro de ponto, mas o histórico será mantido.`
    : `Reativar ${colab.nome}?`;
    
    const confirmou = await showConfirm('Alterar Status', msg);
  if (!confirmou) return;

  try {
    // Remove a propriedade virtual antes de salvar
    const colabParaSalvar = { ...colab, situacao: novoStatus };
    delete colabParaSalvar.valorAtualCentavos;
    
    await putItem('colaboradores', JSON.parse(JSON.stringify(colabParaSalvar)));
    await carregarDados();
    showToast('Status alterado com sucesso!', 'success');
  } catch (e) {
    showToast('Erro ao alterar status.', 'error');
  }
}

async function salvarColaborador() {
  const dados = form.value;

  if (!dados.nome || !dados.valorHora) {
    showToast('Nome e Valor da Hora são obrigatórios.', 'info');
    return;
  }

  const valorLimpo = String(dados.valorHora).replace(',', '.');
  const novoValorCentavos = Math.round(parseFloat(valorLimpo) * 100);

  if (isNaN(novoValorCentavos)) {
    showToast('Valor da hora inválido.', 'info');
    return;
  }

  const hojeStr = new Date().toISOString().split('T')[0];
  const dataAdmissao = dados.dataAdmissao ? dados.dataAdmissao : hojeStr;

  try {
    if (editandoId.value) {
      // --- EDIÇÃO ---
      const colabOriginal = colaboradores.value.find(c => c.id === editandoId.value);
      
      const colabAtualizado = {
        ...colabOriginal,
        nome: dados.nome,
        cpf: dados.cpf,
        dataAdmissao: dataAdmissao,
        situacao: dados.situacao
      };
      delete colabAtualizado.valorAtualCentavos; 

      await putItem('colaboradores', JSON.parse(JSON.stringify(colabAtualizado)));

      // Verifica se o valor da hora realmente mudou
      if (colabOriginal.valorAtualCentavos !== novoValorCentavos) {
        
        // 1. Fecha a vigência de TODOS os valores antigos
        const valoresAntigos = valoresHora.value.filter(v => v.colaboradorId === editandoId.value);
        
        for (const vAntigo of valoresAntigos) {
          if (vAntigo.vigenciaFim === null) {
            const dataNova = new Date(`${dados.vigenciaInicio}T12:00:00`);
            dataNova.setDate(dataNova.getDate() - 1);
            
            const dataFimStr = dataNova.toISOString().split('T')[0];
            const ontemISO = `${dataFimStr}T23:59:59.000Z`;

            await putItem('valoresHora', JSON.parse(JSON.stringify({
              ...vAntigo,
              vigenciaFim: ontemISO
            })));
          }
        }

        // 2. Cria o novo valor
        await addItem('valoresHora', {
          id: uuidv4(),
          colaboradorId: editandoId.value,
          valorCentavos: novoValorCentavos,
          vigenciaInicio: `${dados.vigenciaInicio}T00:00:00.000Z`,
          vigenciaFim: null
        });
      }      
    } else {
      // --- CRIAÇÃO ---
      const idColab = uuidv4();
      const novoColab = {
        id: idColab,
        nome: dados.nome,
        cpf: dados.cpf,
        dataAdmissao: dataAdmissao,
        situacao: 'ativo',
        criadoEm: new Date().toISOString()
      };

      const novoValorHora = {
        id: uuidv4(),
        colaboradorId: idColab,
        valorCentavos: novoValorCentavos,
        vigenciaInicio: new Date(`${dataAdmissao}T00:00:00`).toISOString(),
        vigenciaFim: null
      };

      await addItem('colaboradores', novoColab);
      await addItem('valoresHora', novoValorHora);
    }
    
    mostrarFormulario.value = false;
    await carregarDados(); 
    showToast('Colaborador salvo com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Erro ao salvar: ' + e.message, 'error');
  }
}

function formatarReal(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
</script>

<template>

  <header class="app-header" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
    <div>
      <h1>Equipe</h1>
      <p>Gestão de Colaboradores</p>
    </div>
    <button @click="abrirNovo" class="btn btn-primary" style="padding: 8px 16px; border-radius: 20px; font-size: 0.85rem;" v-if="!mostrarFormulario">
      + Novo
    </button>
  </header>
  
  <div class="page-container">
    
    <!-- Formulário de Cadastro/Edição -->
    <div v-if="mostrarFormulario" class="card form-card">
      <h2 class="section-title">{{ editandoId ? 'Editar Colaborador' : 'Novo Colaborador' }}</h2>
      
      <div class="form-group">
        <label class="form-label">Nome Completo *</label>
        <input v-model="form.nome" type="text" class="form-input" placeholder="Ex: João da Silva" />
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CPF (Opcional)</label>
          <input v-model="form.cpf" type="text" class="form-input" placeholder="000.000.000-00" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Data de Admissão</label>
          <input v-model="form.dataAdmissao" type="date" class="form-input" />
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Valor da Hora (R$) *</label>
          <input v-model="form.valorHora" type="text" class="form-input" placeholder="Ex: 15,50" />
        </div>

        <div class="form-group" v-if="editandoId">
          <label class="form-label" style="color: var(--color-primary);">Vigência do Novo Valor *</label>
          <input v-model="form.vigenciaInicio" type="date" class="form-input" />
        </div>
      </div>
      
      <div class="hint-box" v-if="editandoId && form.valorHora !== (colaboradores.find(c => c.id === editandoId)?.valorAtualCentavos / 100).toFixed(2).replace('.', ',')">
        ⚠️ O valor anterior será mantido para os dias antes da data de vigência escolhida.
      </div>

      <div class="form-group" v-if="editandoId" style="margin-top: 16px;">
        <label class="form-label">Situação</label>
        <select v-model="form.situacao" class="form-select">
          <option value="ativo">Ativo (Acessa o ponto)</option>
          <option value="inativo">Inativo (Desligado)</option>
        </select>
      </div>

      <div class="form-actions">
        <button @click="mostrarFormulario = false" class="btn btn-outline">Cancelar</button>
        <button @click="salvarColaborador" class="btn btn-primary">Salvar</button>
      </div>
    </div>

    <!-- Lista de Colaboradores -->
    <div class="lista" v-if="!mostrarFormulario">
      <div v-if="colaboradores.length === 0" class="empty-state">
        Nenhum colaborador cadastrado ainda.
      </div>

      <div 
        v-for="colab in colaboradores" 
        :key="colab.id" 
        class="team-card" 
        :class="{ 'inativo': colab.situacao === 'inativo' }"
      >
        <div class="team-info">
          <div class="name-row">
            <h3>{{ colab.nome }}</h3>
            <span v-if="colab.situacao === 'inativo'" class="badge badge-inativo">Inativo</span>
          </div>
          <p class="sub-text">Valor/Hora: <strong>R$ {{ formatarReal(colab.valorAtualCentavos) }}</strong></p>
        </div>
        
        <div class="team-actions">
          <button @click="abrirEdicao(colab)" class="btn-icon" title="Editar">✏️</button>
          <button @click="alternarStatus(colab)" class="btn-icon" :title="colab.situacao === 'ativo' ? 'Desativar' : 'Reativar'">
            {{ colab.situacao === 'ativo' ? '🚫' : '✅' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Cabeçalho Flexível */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

/* Formulário em Grid (2 colunas em telas maiores) */
.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 500px) {
  .form-row { grid-template-columns: 1fr 1fr; }
}

.form-card {
  border-top: 4px solid var(--color-primary);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.form-actions .btn { flex: 1; }

.hint-box {
  background: var(--color-warning-light);
  color: #92400e;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  margin-top: 12px;
  border-left: 4px solid var(--color-warning);
}

/* Cards de Colaborador */
.lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.team-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border-left: 5px solid var(--color-success); /* Borda verde para ativo */
  transition: transform 0.2s;
}
.team-card:active { transform: scale(0.99); }

.team-card.inativo {
  border-left-color: #cbd5e1;
  background: #f8fafc;
  opacity: 0.7;
}

.team-info { flex: 1; }
.name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.team-info h3 { margin: 0; font-size: 1.1rem; color: var(--color-text); font-weight: 700; }
.sub-text { margin: 0; font-size: 0.85rem; color: var(--color-muted); }
.sub-text strong { color: var(--color-text); }

.badge-inativo {
  background: var(--color-danger-light);
  color: #991b1b;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
}

.team-actions {
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