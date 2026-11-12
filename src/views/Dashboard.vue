<!-- src/views/Dashboard.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems } from '../infrastructure/database.js';
import { ultimoBackup, ultimoRestore } from '../infrastructure/backup-service.js';
import { apurarDia } from '../domain/ApuracaoJornada.js';
import { formatarCentavosParaReal } from '../domain/Money.js';

const colaboradores = ref([]);
const motivos = ref([]);
const marcacoes = ref([]);
const valoresHora = ref([]);
const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

// Dados de Backup (mantidos da Home)
const avisoBackup = ref(false);
const diasSemBackup = ref(0);

onMounted(async () => {
  const todosColab = await getAllItems('colaboradores');
  colaboradores.value = todosColab.filter(c => c.situacao === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));
  
  motivos.value = await getAllItems('motivos');
  marcacoes.value = await getAllItems('marcacoes');
  valoresHora.value = await getAllItems('valoresHora');

  await verificarStatusBackup();
});

// Lógica de Status do Dia
const hojeStr = new Date().toISOString().split('T')[0];

const statusEquipe = computed(() => {
  return colaboradores.value.map(colab => {
    // Pega as marcações de hoje deste colaborador
    const marcsHoje = marcacoes.value
      .filter(m => m.colaboradorId === colab.id && m.dataHoraLocal.startsWith(hojeStr))
      .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));

    let status = 'nao_bateu';
    let ultimaHora = '';
    let minutosHoje = 0;

    if (marcsHoje.length > 0) {
      const ultimaMarcacao = marcsHoje[marcsHoje.length - 1];
      ultimaHora = new Date(ultimaMarcacao.dataHoraLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      if (ultimaMarcacao.natureza === 'trabalho') {
        status = 'trabalhando';
      } else {
        status = 'encerrado'; // Bateu pausa ou saída final
      }

      // Calcula o total de minutos que ele já tem hoje
      const valorHora = valoresHora.value.find(v => v.colaboradorId === colab.id)?.valorCentavos || 0;
      const apuracao = apurarDia(marcsHoje, valorHora);
      minutosHoje = apuracao.minutosTrabalhados;
    }

    return {
      ...colab,
      status,
      ultimaHora,
      minutosHoje
    };
  });
});

const resumo = computed(() => {
  const trabalhando = statusEquipe.value.filter(c => c.status === 'trabalhando').length;
  const encerrado = statusEquipe.value.filter(c => c.status === 'encerrado').length;
  const naoBateu = statusEquipe.value.filter(c => c.status === 'nao_bateu').length;
  return { trabalhando, encerrado, naoBateu };
});

// Verificação de Backup
async function verificarStatusBackup() {
  const dataUltimoBackup = await ultimoBackup();
  const dataUltimoRestore = await ultimoRestore();
  let dataMaisRecente = null;
  
  if (dataUltimoBackup && dataUltimoRestore) {
    dataMaisRecente = new Date(dataUltimoBackup) > new Date(dataUltimoRestore) ? dataUltimoBackup : dataUltimoRestore;
  } else if (dataUltimoBackup) {
    dataMaisRecente = dataUltimoBackup;
  } else if (dataUltimoRestore) {
    dataMaisRecente = dataUltimoRestore;
  }

  if (!dataMaisRecente) {
    avisoBackup.value = true;
    diasSemBackup.value = 'nunca';
    return;
  }

  const diffDays = Math.floor(Math.abs(new Date() - new Date(dataMaisRecente)) / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 5) {
    avisoBackup.value = true;
    diasSemBackup.value = diffDays;
  }
}

function formatarMinutos(min) {
  if (min === 0) return '0h 00m';
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>Painel do Dia</h1>
      <p class="date">{{ dataAtual }}</p>
    </header>

    <!-- Aviso de Backup -->
    <div v-if="avisoBackup" class="backup-warning no-print">
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <div>
          <strong>Atenção com seus dados!</strong>
          <p v-if="diasSemBackup === 'nunca'">Você ainda não fez nenhum backup.</p>
          <p v-else>Já se passaram <strong>{{ diasSemBackup }} dias</strong> desde o último backup.</p>
        </div>
      </div>
      <router-link to="/configuracoes" class="btn-backup">Fazer Backup</router-link>
    </div>

    <!-- Resumo Rápido -->
    <div class="resumo-grid">
      <div class="resumo-card trabalhando">
        <span class="numero">{{ resumo.trabalhando }}</span>
        <span class="label">Trabalhando agora</span>
      </div>
      <div class="resumo-card encerrado">
        <span class="numero">{{ resumo.encerrado }}</span>
        <span class="label">Encerraram hoje</span>
      </div>
      <div class="resumo-card pendente">
        <span class="numero">{{ resumo.naoBateu }}</span>
        <span class="label">Sem marcação</span>
      </div>
    </div>

    <!-- Lista de Colaboradores -->
    <h2 class="section-title">Status da Equipe</h2>
    <div class="lista-equipe">
      <div v-for="colab in statusEquipe" :key="colab.id" class="card equipe-card">
        <div class="equipe-info">
          <h3>{{ colab.nome }}</h3>
          <p v-if="colab.status === 'nao_bateu'" class="sub-texto">Nenhum ponto registrado.</p>
          <p v-else class="sub-texto">Última marcação: {{ colab.ultimaHora }}</p>
        </div>
        
        <div class="equipe-status">
          <span class="tempo-trabalhado">{{ formatarMinutos(colab.minutosHoje) }}</span>
          <span class="badge" :class="colab.status">
            {{ colab.status === 'trabalhando' ? '🟢 Trabalhando' : 
               colab.status === 'encerrado' ? '🔴 Encerrado' : '⚪ Ausente' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 24px; }
.header h1 { color: var(--color-primary, #2563eb); margin: 0; font-size: 1.5rem; }
.date { color: var(--color-muted, #64748b); font-size: 1rem; text-transform: capitalize; margin-top: 4px; }

/* Aviso Backup */
.backup-warning { background-color: #fef2f2; border: 1px solid #f87171; border-left: 6px solid #dc2626; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.warning-content { display: flex; align-items: flex-start; gap: 8px; }
.warning-icon { font-size: 1.2rem; }
.warning-content strong { color: #991b1b; font-size: 1rem; }
.warning-content p { margin: 2px 0 0 0; color: #7f1d1d; font-size: 0.85rem; }
.btn-backup { background-color: #dc2626; color: white; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.85rem; white-space: nowrap; }

/* Resumo */
.resumo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.resumo-card { background: white; padding: 16px; border-radius: 10px; text-align: center; box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); display: flex; flex-direction: column; border-top: 4px solid #ccc; }
.resumo-card.trabalhando { border-top-color: #16a34a; }
.resumo-card.encerrado { border-top-color: #dc2626; }
.resumo-card.pendente { border-top-color: #64748b; }
.numero { font-size: 2rem; font-weight: bold; line-height: 1; }
.label { font-size: 0.8rem; color: var(--color-muted, #64748b); font-weight: bold; margin-top: 4px; }

/* Lista Equipe */
.section-title { font-size: 1.2rem; margin-bottom: 12px; color: var(--color-text, #1e293b); }
.lista-equipe { display: flex; flex-direction: column; gap: 10px; }
.equipe-card { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px; border-radius: 10px; box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); border-left: 4px solid transparent; }
.equipe-card:has(.badge.trabalhando) { border-left-color: #16a34a; }
.equipe-card:has(.badge.encerrado) { border-left-color: #dc2626; }

.equipe-info h3 { margin: 0; font-size: 1.1rem; }
.sub-texto { margin: 4px 0 0 0; font-size: 0.85rem; color: var(--color-muted, #64748b); }
.equipe-status { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.tempo-trabalhado { font-weight: bold; font-size: 1.1rem; color: var(--color-primary, #2563eb); }
.badge { font-size: 0.75rem; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
.badge.trabalhando { background: #dcfce7; color: #166534; }
.badge.encerrado { background: #fee2e2; color: #991b1b; }
.badge.nao_bateu { background: #f1f5f9; color: #64748b; }
</style>