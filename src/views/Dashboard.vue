<!-- src/views/Dashboard.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllItems } from '../infrastructure/database.js';
import { ultimoBackup, ultimoRestore } from '../infrastructure/backup-service.js';
import { apurarDia } from '../domain/ApuracaoJornada.js';

const colaboradores = ref([]);
const marcacoes = ref([]);
const valoresHora = ref([]);
const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

// Dados de Backup
const avisoBackup = ref(false);
const diasSemBackup = ref(0);

onMounted(async () => {
  const todosColab = await getAllItems('colaboradores');
  colaboradores.value = todosColab.filter(c => c.situacao === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));
  
  marcacoes.value = await getAllItems('marcacoes');
  valoresHora.value = await getAllItems('valoresHora');

  await verificarStatusBackup();
});

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
        status = 'encerrado';
      }

      const valorHora = valoresHora.value.find(v => v.colaboradorId === colab.id)?.valorCentavos || 0;
      const apuracao = apurarDia(marcsHoje, valorHora);
      minutosHoje = apuracao.minutosTrabalhados;
    }

    return { ...colab, status, ultimaHora, minutosHoje };
  });
});

const resumo = computed(() => {
  const trabalhando = statusEquipe.value.filter(c => c.status === 'trabalhando').length;
  const encerrado = statusEquipe.value.filter(c => c.status === 'encerrado').length;
  const naoBateu = statusEquipe.value.filter(c => c.status === 'nao_bateu').length;
  return { trabalhando, encerrado, naoBateu };
});

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
    <header class="app-header">
    <h1>Painel do Dia</h1>
    <p>{{ dataAtual }}</p>
  </header>
  <div class="page-container">
    <!-- <header>
      <h1 class="page-title">Painel do Dia</h1>
      <p class="page-subtitle">{{ dataAtual }}</p>
    </header> -->

    <!-- Aviso de Backup -->
    <div v-if="avisoBackup" class="backup-alert no-print">
      <div class="alert-icon">⚠️</div>
      <div class="alert-content">
        <strong>Atenção com seus dados!</strong>
        <p v-if="diasSemBackup === 'nunca'">Você ainda não fez nenhum backup.</p>
        <p v-else>Já se passaram <strong>{{ diasSemBackup }} dias</strong> desde o último backup.</p>
      </div>
      <router-link to="/configuracoes" class="btn btn-danger" style="padding: 8px 16px; font-size: 0.85rem; white-space: nowrap;">Fazer Backup</router-link>
    </div>

    <!-- Resumo Rápido (Cards mais largos e textos curtos) -->
    <div class="summary-grid">
      <div class="summary-card border-green">
        <span class="number">{{ resumo.trabalhando }}</span>
        <span class="label">Trabalhando</span>
      </div>
      <div class="summary-card border-red">
        <span class="number">{{ resumo.encerrado }}</span>
        <span class="label">Encerraram</span>
      </div>
      <div class="summary-card border-gray">
        <span class="number">{{ resumo.naoBateu }}</span>
        <span class="label">Ausentes</span>
      </div>
    </div>

    <!-- Lista de Colaboradores -->
    <h2 class="section-title">Status da Equipe</h2>
    
    <div v-if="statusEquipe.length === 0" class="empty-state">
      Nenhum colaborador ativo cadastrado.
    </div>

    <div class="team-list">
      <div v-for="colab in statusEquipe" :key="colab.id" class="team-card" :class="colab.status">
        <div class="team-info">
          <h3>{{ colab.nome }}</h3>
          <p v-if="colab.status === 'nao_bateu'" class="sub-text">Nenhum ponto registrado.</p>
          <p v-else class="sub-text">Última: <strong>{{ colab.ultimaHora }}</strong></p>
        </div>
        
        <div class="team-status">
          <span class="time">{{ formatarMinutos(colab.minutosHoje) }}</span>
          <span class="badge" :class="colab.status">
            {{ colab.status === 'trabalhando' ? 'Ativo' : 
               colab.status === 'encerrado' ? 'Saída' : 'Ausente' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Aviso de Backup Moderno */
.backup-alert {
  background-color: #fff1f2;
  border: 1px solid #fecdd3;
  border-left: 6px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.alert-icon { font-size: 1.8rem; }
.alert-content { flex: 1; }
.alert-content strong { color: #9f1239; display: block; font-size: 1rem; }
.alert-content p { color: #be123c; font-size: 0.85rem; margin-top: 2px; }

/* Grid de Resumo */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 32px;
}
.summary-card {
  background: white;
  padding: 16px 8px;
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-top: 5px solid #cbd5e1;
}
.summary-card.border-green { border-top-color: var(--color-success); }
.summary-card.border-red { border-top-color: var(--color-danger); }
.summary-card.border-gray { border-top-color: #94a3b8; }

.number { font-size: 2.2rem; font-weight: 800; line-height: 1; margin-bottom: 6px; color: var(--color-text); }
.label { font-size: 0.7rem; color: var(--color-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

/* Lista de Equipe */
.team-list {
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
  border-left: 6px solid #cbd5e1;
  transition: transform 0.2s;
}
.team-card:active { transform: scale(0.99); }
.team-card.trabalhando { border-left-color: var(--color-success); }
.team-card.encerrado { border-left-color: var(--color-danger); }

.team-info h3 { margin: 0 0 4px 0; font-size: 1.1rem; color: var(--color-text); font-weight: 700; }
.sub-text { margin: 0; font-size: 0.85rem; color: var(--color-muted); }

.team-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.time { font-weight: 800; font-size: 1.2rem; color: var(--color-primary); }
.badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge.trabalhando { background-color: var(--color-success-light); color: #065f46; }
.badge.encerrado { background-color: var(--color-danger-light); color: #991b1b; }
.badge.nao_bateu { background-color: #f1f5f9; color: #475569; }

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: white;
  border-radius: var(--radius-lg);
  color: var(--color-muted);
  font-size: 0.95rem;
}
</style>