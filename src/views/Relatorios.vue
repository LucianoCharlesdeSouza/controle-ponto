<!-- src/views/Relatorios.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { getAllItems } from '../infrastructure/database.js';
import { apurarDia } from '../domain/ApuracaoJornada.js';
import { formatarCentavosParaReal } from '../domain/Money.js';
import AssinaturaCanvas from '../components/AssinaturaCanvas.vue';

const colaboradores = ref([]);
const motivos = ref([]);
const marcacoes = ref([]);
const valoresHora = ref([]);
const ajustes = ref([]);

const tipoRelatorio = ref('mensal'); // 'mensal', 'anual', 'ajustes'
const colaboradorSelecionadoId = ref('');
const mesSelecionado = ref(new Date().toISOString().slice(0, 7));
const anoSelecionado = ref(new Date().getFullYear());

const relatorioGerado = ref(null);
const diaExpandido = ref(null);
const diaInconsistente = ref(null);

const assinaturaColaborador = ref('');
const assinaturaResponsavel = ref('');

onMounted(async () => {
  colaboradores.value = (await getAllItems('colaboradores')).sort((a, b) => a.nome.localeCompare(b.nome));
  motivos.value = await getAllItems('motivos');
  marcacoes.value = await getAllItems('marcacoes');
  valoresHora.value = await getAllItems('valoresHora');
  ajustes.value = await getAllItems('ajustes');
  
  if (colaboradores.value.length > 0) {
    colaboradorSelecionadoId.value = colaboradores.value[0].id;
  }
});

function getValorHoraVigente(colabId, dataStr) {
  const valores = valoresHora.value
    .filter(v => v.colaboradorId === colabId)
    .sort((a, b) => new Date(b.vigenciaInicio).getTime() - new Date(a.vigenciaInicio).getTime());
    
  const dataAlvo = new Date(`${dataStr}T12:00:00`).getTime();
  
  const valor = valores.find(v => {
    const inicioStr = v.vigenciaInicio.split('T')[0];
    const inicio = new Date(`${inicioStr}T00:00:00`).getTime();
    
    let fim = Infinity;
    if (v.vigenciaFim) {
      const fimStr = v.vigenciaFim.split('T')[0];
      fim = new Date(`${fimStr}T23:59:59`).getTime();
    }
    
    return dataAlvo >= inicio && dataAlvo <= fim;
  });
  
  return valor ? valor.valorCentavos : 0;
}

function formatarHora(isoStr) {
  return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function gerarRelatorio() {
  if (tipoRelatorio.value === 'mensal') gerarRelatorioMensal();
  else if (tipoRelatorio.value === 'anual') gerarRelatorioAnual();
  else gerarRelatorioAjustes();
}

function gerarRelatorioMensal() {
  if (!colaboradorSelecionadoId.value) return;

  assinaturaColaborador.value = '';
  assinaturaResponsavel.value = '';

  const marcacoesColab = marcacoes.value.filter(m => m.colaboradorId === colaboradorSelecionadoId.value);
  
  const porDia = {};
  marcacoesColab.forEach(m => {
    const dia = m.dataHoraLocal.split('T')[0];
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(m);
  });

  const diasDoMes = Object.keys(porDia)
    .filter(dia => dia.startsWith(mesSelecionado.value))
    .sort();

  let totalMinutos = 0;
  let totalCentavos = 0;
  const diasApurados = [];

  diasDoMes.forEach(dia => {
    const valorHora = getValorHoraVigente(colaboradorSelecionadoId.value, dia);
    
    const marcsValidas = porDia[dia].filter(m => !m.anulada);
    const marcsAnuladas = porDia[dia].filter(m => m.anulada);
    
    const resultado = apurarDia(marcsValidas, valorHora);
    
    totalMinutos += resultado.minutosTrabalhados;
    totalCentavos += resultado.valorCentavos;
    
    const horariosStr = marcsValidas
      .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal))
      .map(m => {
        const motivoObj = motivos.value.find(mot => mot.id === m.motivoId);
        return { 
          hora: formatarHora(m.dataHoraLocal), 
          motivo: motivoObj?.nome || '?',
          natureza: motivoObj?.natureza || 'trabalho'
        };
      });

    diasApurados.push({
      data: dia,
      horarios: horariosStr,
      anuladas: marcsAnuladas,
      minutos: resultado.minutosTrabalhados,
      valorCentavos: resultado.valorCentavos,
      inconsistencias: resultado.inconsistencias
    });
  });

  const nomeColab = colaboradores.value.find(c => c.id === colaboradorSelecionadoId.value)?.nome;

  relatorioGerado.value = {
    tipo: 'mensal',
    nomeColab,
    periodo: mesSelecionado.value.split('-').reverse().join('/'),
    dias: diasApurados,
    totalMinutos,
    totalCentavos,
    totalHorasStr: `${Math.floor(totalMinutos / 60)}h ${String(totalMinutos % 60).padStart(2, '0')}m`
  };
}

function gerarRelatorioAnual() {
  const dadosConsolidados = colaboradores.value.map(colab => {
    const marcacoesColab = marcacoes.value.filter(m => 
      m.colaboradorId === colab.id && m.dataHoraLocal.startsWith(anoSelecionado.value.toString())
    );
    
    const porMes = {};
    marcacoesColab.forEach(m => {
      const mes = m.dataHoraLocal.slice(0, 7);
      if (!porMes[mes]) porMes[mes] = [];
      porMes[mes].push(m);
    });

    let totalMin = 0;
    let totalCent = 0;
    const meses = [];

    Object.keys(porMes).sort().forEach(mes => {
      const marcsValidas = porMes[mes].filter(m => !m.anulada);
      const valorHora = getValorHoraVigente(colab.id, `${mes}-15`);
      
      let minMes = 0;
      let centMes = 0;
      const porDia = {};
      
      marcsValidas.forEach(m => {
        const dia = m.dataHoraLocal.split('T')[0];
        if (!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(m);
      });

      Object.keys(porDia).forEach(dia => {
        const res = apurarDia(porDia[dia], valorHora);
        minMes += res.minutosTrabalhados;
        centMes += res.valorCentavos;
      });

      totalMin += minMes;
      totalCent += centMes;
      
      if (minMes > 0) {
        meses.push({ mes, minutos: minMes, centavos: centMes });
      }
    });

    return {
      id: colab.id,
      nome: colab.nome,
      minutos: totalMin,
      centavos: totalCent,
      horasStr: `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, '0')}m`,
      meses
    };
  });

  relatorioGerado.value = {
    tipo: 'anual',
    periodo: anoSelecionado.value.toString(),
    dadosConsolidados
  };
}

function gerarRelatorioAjustes() {
  const ajustesPeriodo = ajustes.value
    .filter(a => a.criadoEm.startsWith(mesSelecionado.value))
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  const detalhados = ajustesPeriodo.map(a => {
    const marcacaoOriginal = a.valorOriginal;
    const colab = colaboradores.value.find(c => c.id === marcacaoOriginal?.colaboradorId);
    const motivo = motivos.value.find(m => m.id === marcacaoOriginal?.motivoId);

    return {
      ...a,
      nomeColab: colab?.nome || 'Desconhecido',
      nomeMotivo: motivo?.nome || '?',
      horaOriginal: a.valorOriginal ? formatarHora(a.valorOriginal.dataHoraLocal) : '-',
      horaCorrigida: a.valorCorrigido ? formatarHora(a.valorCorrigido.dataHoraLocal) : 'Excluído',
      dataMarcacao: a.valorOriginal ? a.valorOriginal.dataHoraLocal.split('T')[0] : '-'
    };
  });

  relatorioGerado.value = {
    tipo: 'ajustes',
    periodo: mesSelecionado.value.split('-').reverse().join('/'),
    ajustes: detalhados
  };
}

function imprimir() {
  window.print();
}

function toggleDia(data) {
  diaExpandido.value = diaExpandido.value === data ? null : data;
}
</script>

<template>

  <header class="no-print app-header">
    <h1>Relatórios</h1>
    <p>Espelhos de ponto, auditoria e pagamentos</p>
  </header>  

  <div class="page-container">

    <!-- Filtros -->
    <div class="card filter-card no-print">
      <div class="tabs-container">
        <button :class="{ active: tipoRelatorio === 'mensal' }" @click="tipoRelatorio = 'mensal'">Mensal</button>
        <button :class="{ active: tipoRelatorio === 'anual' }" @click="tipoRelatorio = 'anual'">Anual</button>
        <button :class="{ active: tipoRelatorio === 'ajustes' }" @click="tipoRelatorio = 'ajustes'">Ajustes</button>
      </div>

      <div v-if="tipoRelatorio !== 'anual'" class="form-group">
        <label class="form-label">Colaborador</label>
        <select v-model="colaboradorSelecionadoId" class="form-select">
          <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">{{ tipoRelatorio === 'anual' ? 'Ano' : 'Mês de Referência' }}</label>
        <input v-if="tipoRelatorio !== 'anual'" type="month" v-model="mesSelecionado" class="form-input" />
        <input v-else type="number" v-model="anoSelecionado" min="2020" max="2100" class="form-input" />
      </div>

      <button @click="gerarRelatorio" class="btn btn-primary btn-block">Gerar Relatório</button>
    </div>

    <!-- Resultado -->
    <div v-if="relatorioGerado" class="resultado">
      
      <!-- Barra de Ações -->
      <div class="no-print action-bar">
        <button @click="imprimir" class="btn btn-outline" style="padding: 8px 16px;">
          🖨️ Imprimir / PDF
        </button>
      </div>

      <!-- Cabeçalho Impressão -->
      <div class="print-header">
        <h2>Ponto & Folha - {{ relatorioGerado.tipo === 'mensal' ? 'Espelho de Ponto' : relatorioGerado.tipo === 'anual' ? 'Resumo Anual' : 'Relatório de Ajustes' }}</h2>
        <p>Período: {{ relatorioGerado.periodo }}</p>
        <p v-if="relatorioGerado.tipo === 'mensal'">Colaborador: <strong>{{ relatorioGerado.nomeColab }}</strong></p>
      </div>

      <!-- ABA MENSAL -->
      <div v-if="relatorioGerado.tipo === 'mensal'">
        <!-- Card de Resumo -->
        <div class="resumo-card">
          <div class="resumo-item">
            <span class="label">Total de Horas</span>
            <strong class="value">{{ relatorioGerado.totalHorasStr }}</strong>
          </div>
          <div class="resumo-divider"></div>
          <div class="resumo-item">
            <span class="label">Total a Pagar</span>
            <strong class="value money">{{ formatarCentavosParaReal(relatorioGerado.totalCentavos) }}</strong>
          </div>
        </div>

        <div class="card table-card">
          <table class="tabela no-print">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horas</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="dia in relatorioGerado.dias" :key="dia.data">
                <tr @click="toggleDia(dia.data)" style="cursor: pointer;" :class="{ 'linha-ativa': diaExpandido === dia.data }">
                  <td class="font-bold">
                    {{ dia.data.split('-').reverse().join('/') }}
                    <span v-if="dia.anuladas.length > 0" title="Possui marcações excluídas" class="asterisco">*</span>
                  </td>
                  <td>{{ Math.floor(dia.minutos / 60) }}h {{ String(dia.minutos % 60).padStart(2, '0') }}m</td>
                  <td>{{ formatarCentavosParaReal(dia.valorCentavos) }}</td>
                  <td class="text-right">
                    <span v-if="dia.inconsistencias.length > 0" class="alerta" title="Inconsistências" @click.stop="diaInconsistente = dia">⚠️</span>
                    <span class="expand-icon">{{ diaExpandido === dia.data ? '▲' : '▼' }}</span>
                  </td>
                </tr>
                <tr v-if="diaExpandido === dia.data" class="detalhe-row">
                  <td colspan="4">
                    <div class="detalhe-pontos">
                      <div v-for="(h, idx) in dia.horarios" :key="idx" class="ponto-badge" :class="h.natureza">
                        <strong>{{ h.hora }}</strong> {{ h.motivo }}
                      </div>
                      <div v-for="(a, idx) in dia.anuladas" :key="'anulada-'+idx" class="ponto-badge anulada">
                        <del>{{ formatarHora(a.dataHoraLocal) }}</del> (Anulado)
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <!-- TABELA DE IMPRESSÃO -->
          <table class="tabela print-only">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horas</th>
                <th>Valor</th>
                <th>Detalhes dos Pontos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dia in relatorioGerado.dias" :key="'print-'+dia.data">
                <td>{{ dia.data.split('-').reverse().join('/') }}</td>
                <td>{{ Math.floor(dia.minutos / 60) }}h {{ String(dia.minutos % 60).padStart(2, '0') }}m</td>
                <td>{{ formatarCentavosParaReal(dia.valorCentavos) }}</td>
                <td>
                  <div class="detalhe-pontos">
                    <span v-for="(h, idx) in dia.horarios" :key="idx" class="ponto-badge">
                      {{ h.hora }} - {{ h.motivo }}
                    </span>
                    <span v-for="(a, idx) in dia.anuladas" :key="'anulada-'+idx" class="ponto-badge anulada">
                      <del>{{ formatarHora(a.dataHoraLocal) }}</del> (Anulado)
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Área de Assinaturas -->
        <div class="assinaturas no-print">
          <AssinaturaCanvas v-model="assinaturaColaborador" label="Assinatura do Colaborador" />
          <AssinaturaCanvas v-model="assinaturaResponsavel" label="Assinatura do Responsável" />
        </div>

        <!-- Área de impressão (Assinaturas) -->
        <div class="assinaturas-impressao print-only">
          <div class="bloco-assinatura">
            <div class="imagem-assinatura">
              <img v-if="assinaturaColaborador" :src="assinaturaColaborador" alt="Assinatura do Colaborador" />
            </div>
            <div class="traco"></div>
            <span>Assinatura do Colaborador</span>
          </div>
          
          <div class="bloco-assinatura">
            <div class="imagem-assinatura">
              <img v-if="assinaturaResponsavel" :src="assinaturaResponsavel" alt="Assinatura do Responsável" />
            </div>
            <div class="traco"></div>
            <span>Assinatura do Responsável</span>
          </div>
        </div>
      </div>

      <!-- ABA ANUAL -->
      <div v-if="relatorioGerado.tipo === 'anual'">
        <div class="card table-card">
          <table class="tabela">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Horas</th>
                <th class="text-right">Total a Pagar</th>
                <th class="no-print"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="colab in relatorioGerado.dadosConsolidados" :key="colab.id">
                <tr @click="toggleDia(colab.id)" style="cursor: pointer;" :class="{ 'linha-ativa': diaExpandido === colab.id }">
                  <td class="font-bold">{{ colab.nome }}</td>
                  <td>{{ colab.horasStr }}</td>
                  <td class="text-right valor-tabela">{{ formatarCentavosParaReal(colab.centavos) }}</td>
                  <td class="no-print text-right expand-icon">
                    {{ diaExpandido === colab.id ? '▲' : '▼' }}
                  </td>
                </tr>
                <tr v-if="diaExpandido === colab.id" class="detalhe-row no-print">
                  <td colspan="4">
                    <div class="detalhe-meses">
                      <div v-for="m in colab.meses" :key="m.mes" class="mes-badge">
                        <span class="mes-label">{{ m.mes.split('-').reverse().join('/') }}</span>
                        <strong class="mes-horas">{{ Math.floor(m.minutos / 60) }}h {{ String(m.minutos % 60).padStart(2, '0') }}m</strong>
                        <span class="mes-val">{{ formatarCentavosParaReal(m.centavos) }}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ABA AJUSTES -->
      <div v-if="relatorioGerado.tipo === 'ajustes'">
        <div class="card table-card">
          <div v-if="relatorioGerado.ajustes.length === 0" class="empty-state">
            Nenhum ajuste registrado neste mês.
          </div>
          <table class="tabela" v-else>
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>Alteração</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="aj in relatorioGerado.ajustes" :key="aj.id">
                <td class="text-muted text-small">{{ new Date(aj.criadoEm).toLocaleDateString('pt-BR') }}</td>
                <td class="font-bold">{{ aj.nomeColab }}<br><small class="text-muted">{{ aj.dataMarcacao.split('-').reverse().join('/') }}</small></td>
                <td>
                  <div class="alteracao-box">
                    <del class="text-muted text-small">{{ aj.horaOriginal }}</del>
                    <span class="arrow">→</span>
                    <strong v-if="aj.horaCorrigida !== 'Excluído'" class="text-success">{{ aj.horaCorrigida }}</strong>
                    <span v-else class="text-danger font-bold text-small">Excluído</span>
                  </div>
                </td>
                <td class="text-small">{{ aj.justificativa }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal Inconsistências -->
    <div v-if="diaInconsistente" class="modal-overlay no-print" @click.self="diaInconsistente = null">
      <div class="modal-content">
        <h3>Inconsistências em {{ diaInconsistente.data.split('-').reverse().join('/') }}</h3>
        <ul class="modal-list">
          <li v-for="(erro, index) in diaInconsistente.inconsistencias" :key="index">{{ erro }}</li>
        </ul>
        <button @click="diaInconsistente = null" class="btn btn-primary btn-block" style="margin-top: 16px;">Entendi</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Filtros e Tabs */
.filter-card {
  border-top: 4px solid var(--color-primary);
  margin-bottom: 24px;
}

.tabs-container {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}
.tabs-container button {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.tabs-container button.active {
  background: white;
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* Ações */
.action-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

/* Resumo (Card Azul) */
.resumo-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-primary);
  color: white;
  padding: 24px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: 16px;
}
.resumo-item {
  display: flex;
  flex-direction: column;
}
.resumo-item .label {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.resumo-item .value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}
.resumo-item .money { color: #fcd34d; }
.resumo-divider {
  width: 1px;
  height: 40px;
  background: rgba(255,255,255,0.2);
}

/* Tabelas */
.table-card {
  padding: 0;
  overflow: hidden;
}
.tabela {
  width: 100%;
  border-collapse: collapse;
}
.tabela th {
  text-align: left;
  padding: 14px 16px;
  background: #f8fafc;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
}
.tabela td {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.95rem;
  color: var(--color-text);
  vertical-align: middle;
}
.tabela tr:last-child td { border-bottom: none; }

.linha-ativa { background: var(--color-primary-light); }
.detalhe-row { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
.detalhe-row td { padding: 16px; }

/* Detalhes e Badges */
.asterisco { color: var(--color-danger); font-weight: bold; }
.alerta { color: var(--color-warning); font-size: 1.2rem; margin-right: 8px; cursor: pointer; }
.expand-icon { color: #94a3b8; font-size: 0.8rem; }

.detalhe-pontos { display: flex; flex-wrap: wrap; gap: 8px; }
.ponto-badge {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}
.ponto-badge.trabalho { border-left: 3px solid var(--color-success); }
.ponto-badge.pausa { border-left: 3px solid var(--color-warning); }
.ponto-badge.anulada { border-color: var(--color-danger); background: var(--color-danger-light); color: #991b1b; text-decoration: line-through; }

.detalhe-meses { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.mes-badge { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: var(--radius-sm); display: flex; flex-direction: column; }
.mes-label { font-size: 0.75rem; font-weight: 700; color: var(--color-muted); margin-bottom: 4px; }
.mes-horas { font-size: 0.95rem; color: var(--color-text); }
.mes-val { font-size: 0.85rem; font-weight: 700; color: var(--color-success); margin-top: 4px; }

/* Ajustes */
.alteracao-box { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
.arrow { color: #94a3b8; }
.text-success { color: var(--color-success); font-weight: 800; }
.text-danger { color: var(--color-danger); }
.text-muted { color: var(--color-muted); }
.text-small { font-size: 0.8rem; }
.font-bold { font-weight: 700; }
.text-right { text-align: right; }
.valor-tabela { font-weight: 800; color: var(--color-success); }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 16px; }
.modal-content { background: white; padding: 24px; border-radius: var(--radius-lg); max-width: 400px; width: 100%; box-shadow: var(--shadow-lg); }
.modal-content h3 { margin-top: 0; color: var(--color-warning); font-size: 1.2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
.modal-list { padding-left: 20px; margin-bottom: 0; line-height: 1.6; color: var(--color-text); font-size: 0.9rem; }

.empty-state { text-align: center; color: var(--color-muted); padding: 40px; font-weight: 500; }

/* Assinaturas */
.assinaturas {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 24px;
  margin-bottom: 24px;
}
.assinaturas-impressao { display: none; }
.print-only { display: none; }
.print-header { display: none; }

/* --- REGRAS DE IMPRESSÃO (MANTIDAS E AJUSTADAS) --- */
@media print {
  .no-print, .bottom-nav, .no-print * { display: none !important; }
  
  .print-only { display: table !important; }
  
  .container { padding: 0; max-width: 100%; }
  .card { box-shadow: none; border: 1px solid #ccc; break-inside: avoid; margin-bottom: 0; border-radius: 0; }
  
  /* Resumo em preto e branco na impressão */
  .resumo-card { background: #eee !important; color: #000 !important; border: 1px solid #ccc; box-shadow: none; border-radius: 0; }
  .resumo-item .money { color: #000 !important; }
  .resumo-divider { background: #ccc; }

  .print-header { display: block; margin-bottom: 20px; text-align: center; }
  .print-header h2 { font-size: 1.3rem; margin-bottom: 8px; }
  
  .tabela { font-size: 0.85rem; }
  .tabela th { background: #eee; border: 1px solid #ccc; padding: 6px 4px; }
  .tabela td { padding: 6px 4px; border: 1px solid #ccc; }
  
  .detalhe-pontos { display: flex; flex-wrap: wrap; gap: 4px; }
  .ponto-badge { display: inline-block; border: 1px solid #ccc; padding: 2px 4px; margin: 2px; border-radius: 2px; font-size: 0.75rem; }

  /* Assinaturas Impressão */
  .assinaturas-impressao {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: space-between;
    gap: 30px;
    margin-top: 50px;
    break-inside: avoid;
  }
  
  .bloco-assinatura {
    flex: 1;
    width: 50%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .imagem-assinatura {
    height: 60px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    margin-bottom: 4px;
  }
  
  .imagem-assinatura img {
    max-height: 100%;
    max-width: 100%;
    object-fit: contain;
  }
  
  .bloco-assinatura .traco {
    border-top: 1px solid #333;
    width: 100%;
    margin-bottom: 4px;
  }
  
  .bloco-assinatura span {
    font-size: 0.85rem;
    color: #333;
  }  
}
</style>