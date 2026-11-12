<!-- src/views/Colaboradores.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems, addItem, putItem } from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

const colaboradores = ref([]);
const valoresHora = ref([]);
const mostrarFormulario = ref(false);
const editandoId = ref(null); // Se tiver ID, é edição. Se null, é criação.

const form = ref({
  nome: '',
  cpf: '',
  dataAdmissao: '',
  valorHora: '',
  situacao: 'ativo',
  vigenciaInicio: '' // <--- NOVO CAMPO
});

onMounted(carregarDados);

async function carregarDados() {
  // Puxa os dados brutos do IndexedDB
  const todosColaboradores = await getAllItems('colaboradores');
  const todosValores = await getAllItems('valoresHora');
  
  valoresHora.value = todosValores;

  colaboradores.value = todosColaboradores.map(colab => {
    // Filtra os valores desse colaborador e ordena pelo mais recente (vigenciaInicio)
    const valoresColab = todosValores
      .filter(v => v.colaboradorId === colab.id)
      .sort((a, b) => new Date(b.vigenciaInicio) - new Date(a.vigenciaInicio));
    
    // Pega o valor do topo da lista (o mais recente)
    const valorAtual = valoresColab.length > 0 ? valoresColab[0].valorCentavos : 0;
    
    return { ...colab, valorAtualCentavos: valorAtual };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
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
    vigenciaInicio: hoje // Inicia com a data de hoje
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
    vigenciaInicio: hoje // Por padrão, sugere a data de hoje para o novo valor
  };
  mostrarFormulario.value = true;
}

async function alternarStatus(colab) {
  const novoStatus = colab.situacao === 'ativo' ? 'inativo' : 'ativo';
  const msg = novoStatus === 'inativo' 
    ? `Desativar ${colab.nome}? Ele não aparecerá mais no registro de ponto, mas o histórico será mantido.`
    : `Reativar ${colab.nome}?`;
    
  if (!confirm(msg)) return;

  try {
    await putItem('colaboradores', { ...colab, situacao: novoStatus });
    await carregarDados();
  } catch (e) {
    alert('Erro ao alterar status: ' + e);
  }
}


async function salvarColaborador() {
  const dados = form.value;

  if (!dados.nome || !dados.valorHora) {
    alert('Nome e Valor da Hora são obrigatórios.');
    return;
  }

  const valorLimpo = String(dados.valorHora).replace(',', '.');
  const novoValorCentavos = Math.round(parseFloat(valorLimpo) * 100);

  if (isNaN(novoValorCentavos)) {
    alert('Valor da hora inválido.');
    return;
  }

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemISO = ontem.toISOString();

  // Se a data de admissão estiver vazia, usa hoje
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
        
        // 1. Fecha a vigência de TODOS os valores antigos deste colaborador
        const valoresAntigos = valoresHora.value.filter(v => v.colaboradorId === editandoId.value);
        
        for (const vAntigo of valoresAntigos) {
          if (vAntigo.vigenciaFim === null) {
            // Pega a data de início da nova vigência escolhida no formulário
            // Ex: "2026-11-12" -> Date no meio-dia para evitar fuso
            const dataNova = new Date(`${dados.vigenciaInicio}T12:00:00`);
            
            // Subtrai 1 dia para o valor antigo terminar no dia anterior
            dataNova.setDate(dataNova.getDate() - 1);
            
            // Formata para YYYY-MM-DD e salva as 23:59:59
            const dataFimStr = dataNova.toISOString().split('T')[0];
            const ontemISO = `${dataFimStr}T23:59:59.000Z`;

            await putItem('valoresHora', JSON.parse(JSON.stringify({
              ...vAntigo,
              vigenciaFim: ontemISO
            })));
          }
        }

        // 2. Cria o novo valor com a data escolhida no formulário
        await addItem('valoresHora', {
          id: uuidv4(),
          colaboradorId: editandoId.value,
          valorCentavos: novoValorCentavos,
          // Salva no formato ISO: YYYY-MM-DD T00:00:00
          vigenciaInicio: `${dados.vigenciaInicio}T00:00:00.000Z`,
          vigenciaFim: null
        });
      }      
      // if (colabOriginal.valorAtualCentavos !== novoValorCentavos) {
        
      //   // 1. Fecha a vigência de TODOS os valores antigos deste colaborador
      //   const valoresAntigos = valoresHora.value.filter(v => v.colaboradorId === editandoId.value);
        
      //   for (const vAntigo of valoresAntigos) {
      //     if (vAntigo.vigenciaFim === null) {
      //       // Fecha o valor antigo no dia ANTERIOR à nova vigência
      //       const dataAnterior = new Date(`${dados.vigenciaInicio}T12:00:00`);
      //       dataAnterior.setDate(dataAnterior.getDate() - 1);
            
      //       await putItem('valoresHora', JSON.parse(JSON.stringify({
      //         ...vAntigo,
      //         vigenciaFim: dataAnterior.toISOString() // Fim da vigência um dia antes do novo começar
      //       })));
      //     }
      //   }

      //   // 2. Cria o novo valor com a data escolhida no formulário
      //   await addItem('valoresHora', {
      //     id: uuidv4(),
      //     colaboradorId: editandoId.value,
      //     valorCentavos: novoValorCentavos,
      //     // Salva no formato ISO: YYYY-MM-DD T00:00:00
      //     vigenciaInicio: new Date(`${dados.vigenciaInicio}T00:00:00`).toISOString(),
      //     vigenciaFim: null
      //   });
      // }
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

    alert('Colaborador salvo com sucesso!');
    mostrarFormulario.value = false;
    
    await carregarDados(); 
    
  } catch (e) {
    console.error(e);
    alert('Erro ao salvar: ' + e.message);
  }
}

// async function salvarColaborador() {
//   const dados = form.value;

//   if (!dados.nome || !dados.valorHora) {
//     alert('Nome e Valor da Hora são obrigatórios.');
//     return;
//   }

//   const valorLimpo = String(dados.valorHora).replace(',', '.');
//   const novoValorCentavos = Math.round(parseFloat(valorLimpo) * 100);

//   if (isNaN(novoValorCentavos)) {
//     alert('Valor da hora inválido.');
//     return;
//   }

//   const agora = new Date();
//   const agoraISO = agora.toISOString(); // Salva data e hora exata (Ex: 2026-11-11T14:30:00.000Z)
  
//   const ontem = new Date(agora);
//   ontem.setDate(ontem.getDate() - 1);
//   const ontemISO = ontem.toISOString();

//   const dataInicioVigencia = dados.dataAdmissao ? dados.dataAdmissao : agoraISO.slice(0, 10);

//   try {
//     if (editandoId.value) {
//       // --- EDIÇÃO ---
//       const colabOriginal = colaboradores.value.find(c => c.id === editandoId.value);
      
//       const colabAtualizado = {
//         ...colabOriginal,
//         nome: dados.nome,
//         cpf: dados.cpf,
//         dataAdmissao: dataInicioVigencia,
//         situacao: dados.situacao
//       };
//       delete colabAtualizado.valorAtualCentavos; 

//       await putItem('colaboradores', JSON.parse(JSON.stringify(colabAtualizado)));

//       // Verifica se o valor da hora realmente mudou
//       if (colabOriginal.valorAtualCentavos !== novoValorCentavos) {
//         // 1. Fecha a vigência de TODOS os valores antigos deste colaborador
//         // (garantindo que não fique nenhum "aberto" e causando conflito)
//         const valoresAntigos = valoresHora.value.filter(v => v.colaboradorId === editandoId.value);
        
//         for (const vAntigo of valoresAntigos) {
//           if (vAntigo.vigenciaFim === null) {
//             await putItem('valoresHora', JSON.parse(JSON.stringify({
//               ...vAntigo,
//               vigenciaFim: ontemISO // Fim da vigência com hora exata
//             })));
//           }
//         }

//                 // Pega a data de amanhã para iniciar o novo salário
//         const amanha = new Date(agora);
//         amanha.setDate(amanha.getDate() + 1);
//         const amanhaISO = amanha.toISOString();

//         // 2. Cria o novo valor com vigência a partir de AGORA
//         await addItem('valoresHora', {
//           id: uuidv4(),
//           colaboradorId: editandoId.value,
//           valorCentavos: novoValorCentavos,
//           // vigenciaInicio: agoraISO, // Usa a hora exata!
//           vigenciaInicio: amanhaISO, // <--- O salário novo só vale de amanhã em diante!
//           vigenciaFim: null
//         });
//       }
//     } else {
//       // --- CRIAÇÃO ---
//       const idColab = uuidv4();
//       const novoColab = {
//         id: idColab,
//         nome: dados.nome,
//         cpf: dados.cpf,
//         dataAdmissao: dataInicioVigencia,
//         situacao: 'ativo',
//         criadoEm: agoraISO
//       };

//       const novoValorHora = {
//         id: uuidv4(),
//         colaboradorId: idColab,
//         valorCentavos: novoValorCentavos,
//         vigenciaInicio: agoraISO, // Usa a hora exata!
//         vigenciaFim: null
//       };

//       await addItem('colaboradores', novoColab);
//       await addItem('valoresHora', novoValorHora);
//     }

//     alert('Colaborador salvo com sucesso!');
//     mostrarFormulario.value = false;
    
//     await carregarDados(); 
    
//   } catch (e) {
//     console.error(e);
//     alert('Erro ao salvar: ' + e.message);
//   }
// }
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>Equipe</h1>
      <button @click="abrirNovo" class="btn-primary" v-if="!mostrarFormulario">+ Novo</button>
    </header>

    <!-- Formulário -->
    <div v-if="mostrarFormulario" class="card form-card">
      <h2>{{ editandoId ? 'Editar Colaborador' : 'Novo Colaborador' }}</h2>
      
      <div class="form-group">
        <label>Nome Completo *</label>
        <input v-model="form.nome" type="text" placeholder="Ex: João da Silva" />
      </div>
      
      <div class="form-group">
        <label>CPF (Opcional)</label>
        <input v-model="form.cpf" type="text" placeholder="000.000.000-00" />
      </div>
      
      <div class="form-group">
        <label>Data de Admissão</label>
        <input v-model="form.dataAdmissao" type="date" />
      </div>
      
      <div class="form-group">
        <label>Valor da Hora (R$) *</label>
        <input v-model="form.valorHora" type="text" placeholder="Ex: 15,50" />
        <!-- <small v-if="editandoId" class="hint">Alterar este valor criará uma nova vigência a partir de hoje.</small> -->
        <!-- NOVO CAMPO DE VIGÊNCIA -->
        <div v-if="editandoId" style="margin-top: 12px;">
          <label style="color: var(--color-primary, #2563eb);">A partir de qual data este valor vale? *</label>
          <input v-model="form.vigenciaInicio" type="date" />
          <small class="hint">O valor anterior será mantido para os dias antes desta data.</small>
        </div>      
      </div>

      <div class="form-group" v-if="editandoId">
        <label>Situação</label>
        <select v-model="form.situacao">
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo (Desligado)</option>
        </select>
      </div>

      <div class="actions">
        <button @click="mostrarFormulario = false" class="btn-cancel">Cancelar</button>
        <button @click="salvarColaborador" class="btn-success">Salvar</button>
      </div>
    </div>

    <!-- Lista -->
    <div class="lista" v-if="!mostrarFormulario">
      <div v-for="colab in colaboradores" :key="colab.id" class="card item-colab" :class="{ 'inativo': colab.situacao === 'inativo' }">
        <div class="info">
          <h3>{{ colab.nome }}</h3>
          <p>Valor/Hora: R$ {{ (colab.valorAtualCentavos / 100).toFixed(2).replace('.', ',') }}</p>
        </div>
        
        <div class="actions-colab">
          <span class="badge" :class="colab.situacao">{{ colab.situacao }}</span>
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
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header h1 { font-size: 1.5rem; margin: 0; }
.btn-primary { background: var(--color-primary, #2563eb); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
.card { background: var(--color-surface, #fff); padding: 16px; border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; }
.form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.hint { display: block; font-size: 0.8rem; color: var(--color-warning, #d97706); margin-top: 4px; }
.actions { display: flex; gap: 10px; margin-top: 16px; }
.btn-cancel { flex: 1; padding: 12px; border: 1px solid #ccc; background: #fff; border-radius: 8px; font-weight: bold; cursor: pointer; }
.btn-success { flex: 1; background: var(--color-success, #16a34a); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; }
.item-colab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; transition: opacity 0.2s; }
.item-colab.inativo { opacity: 0.6; background: #f8fafc; }
.info h3 { margin: 0 0 4px 0; font-size: 1.1rem; }
.info p { margin: 0; color: var(--color-muted, #64748b); font-size: 0.9rem; }
.actions-colab { display: flex; align-items: center; gap: 8px; }
.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
.badge.ativo { background: #dcfce7; color: #166534; }
.badge.inativo { background: #fee2e2; color: #991b1b; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: #e2e8f0; }
</style>