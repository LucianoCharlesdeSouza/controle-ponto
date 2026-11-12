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
const diaExpandido = ref(null); // Para o acordeão do espelho de ponto
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

// Busca o valor/hora vigente na data
function getValorHoraVigente(colabId, dataStr) {
  const valores = valoresHora.value
    .filter(v => v.colaboradorId === colabId)
    .sort((a, b) => new Date(b.vigenciaInicio) - new Date(a.vigenciaInicio));
    
  const dataAlvo = new Date(`${dataStr}T23:59:59`).getTime();
  
  const valor = valores.find(v => {
    const inicio = new Date(v.vigenciaInicio).getTime();
    const fim = v.vigenciaFim ? new Date(v.vigenciaFim).getTime() : Infinity;
    return dataAlvo >= inicio && dataAlvo <= fim;
  });
  
  return valor ? valor.valorCentavos : 0;
}

// Formata horário local
function formatarHora(isoStr) {
  return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// --- GERAÇÃO DE RELATÓRIOS ---

function gerarRelatorio() {
  if (tipoRelatorio.value === 'mensal') gerarRelatorioMensal();
  else if (tipoRelatorio.value === 'anual') gerarRelatorioAnual();
  else gerarRelatorioAjustes();
}

function gerarRelatorioMensal() {
  if (!colaboradorSelecionadoId.value) return;

    // Limpa assinaturas anteriores
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
    
    // Separa as marcações válidas das anuladas para o cálculo
    const marcsValidas = porDia[dia].filter(m => !m.anulada);
    const marcsAnuladas = porDia[dia].filter(m => m.anulada);
    
    const resultado = apurarDia(marcsValidas, valorHora);
    
    totalMinutos += resultado.minutosTrabalhados;
    totalCentavos += resultado.valorCentavos;
    
    // Formata os horários para o espelho de ponto
    const horariosStr = marcsValidas
      .sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal))
      .map(m => {
        const motivo = motivos.value.find(mot => mot.id === m.motivoId)?.nome || '?';
        return { hora: formatarHora(m.dataHoraLocal), motivo, original: false };
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
      const mes = m.dataHoraLocal.slice(0, 7); // YYYY-MM
      if (!porMes[mes]) porMes[mes] = [];
      porMes[mes].push(m);
    });

    let totalMin = 0;
    let totalCent = 0;
    const meses = [];

    Object.keys(porMes).sort().forEach(mes => {
      const marcsValidas = porMes[mes].filter(m => !m.anulada);
      // Pega o valor hora do dia 15 do mês como referência para o cálculo do mês inteiro
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
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)); // Mais recentes primeiro

  const detalhados = ajustesPeriodo.map(a => {
    // Tenta achar a marcação original para pegar o nome do colaborador e o motivo
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
  <div class="container">
    <header class="header no-print">
      <h1>Relatórios</h1>
    </header>

    <!-- Filtros -->
    <div class="card filtros no-print">
      <div class="tabs">
        <button :class="{ active: tipoRelatorio === 'mensal' }" @click="tipoRelatorio = 'mensal'">Espelho Mensal</button>
        <button :class="{ active: tipoRelatorio === 'anual' }" @click="tipoRelatorio = 'anual'">Anual</button>
        <button :class="{ active: tipoRelatorio === 'ajustes' }" @click="tipoRelatorio = 'ajustes'">Ajustes</button>
      </div>

      <div v-if="tipoRelatorio !== 'anual'" class="form-group">
        <label>Colaborador</label>
        <select v-model="colaboradorSelecionadoId">
          <option v-for="c in colaboradores" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </div>

      <div class="form-group">
        <label>{{ tipoRelatorio === 'anual' ? 'Ano' : 'Mês' }}</label>
        <input v-if="tipoRelatorio !== 'anual'" type="month" v-model="mesSelecionado" />
        <input v-else type="number" v-model="anoSelecionado" min="2020" max="2100" />
      </div>

      <button @click="gerarRelatorio" class="btn-primary">Gerar Relatório</button>
    </div>

    <!-- Resultado -->
    <div v-if="relatorioGerado" class="resultado">
      <div class="no-print" style="text-align: right; margin-bottom: 10px;">
        <button @click="imprimir" class="btn-secondary">🖨️ Imprimir / PDF</button>
      </div>

      <!-- Cabeçalho Impressão -->
      <div class="print-header">
        <h2>Ponto & Folha - {{ relatorioGerado.tipo === 'mensal' ? 'Espelho de Ponto' : relatorioGerado.tipo === 'anual' ? 'Resumo Anual' : 'Relatório de Ajustes' }}</h2>
        <p>Período: {{ relatorioGerado.periodo }}</p>
        <p v-if="relatorioGerado.tipo === 'mensal'">Colaborador: <strong>{{ relatorioGerado.nomeColab }}</strong></p>
      </div>

      <!-- ABA MENSAL -->
      <div v-if="relatorioGerado.tipo === 'mensal'">
        <div class="card resumo">
          <div class="resumo-item">
            <span>Total de Horas</span>
            <strong>{{ relatorioGerado.totalHorasStr }}</strong>
          </div>
          <div class="resumo-item">
            <span>Total a Pagar</span>
            <strong class="valor">{{ formatarCentavosParaReal(relatorioGerado.totalCentavos) }}</strong>
          </div>
        </div>

        <div class="card">
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
                  <td>
                    {{ dia.data.split('-').reverse().join('/') }}
                    <span v-if="dia.anuladas.length > 0" title="Possui marcações excluídas" style="color: #dc2626; font-size: 0.8rem;">*</span>
                  </td>
                  <td>{{ Math.floor(dia.minutos / 60) }}h {{ String(dia.minutos % 60).padStart(2, '0') }}m</td>
                  <td>{{ formatarCentavosParaReal(dia.valorCentavos) }}</td>
                  <td style="text-align: right; color: #64748b;">
                    <span v-if="dia.inconsistencias.length > 0" class="alerta" title="Inconsistências" @click.stop="diaInconsistente = dia">⚠️</span>
                    {{ diaExpandido === dia.data ? '▲' : '▼' }}
                  </td>
                </tr>
                <tr v-if="diaExpandido === dia.data" class="detalhe-row">
                  <td colspan="4">
                    <div class="detalhe-pontos">
                      <div v-for="(h, idx) in dia.horarios" :key="idx" class="ponto-badge" :class="motivos.find(m => m.nome === h.motivo)?.natureza">
                        <strong>{{ h.hora }}</strong> - {{ h.motivo }}
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

          <!-- TABELA DE IMPRESSÃO (Sempre Completa e Visível no Papel) -->
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

        <!-- <div class="assinaturas">
          <div class="linha-assinatura"><div class="traco"></div><span>Assinatura do Colaborador</span></div>
          <div class="linha-assinatura"><div class="traco"></div><span>Assinatura do Responsável</span></div>
        </div> -->
        <!-- Área de Assinaturas -->
        <div class="assinaturas">
          <!-- Área para desenhar (visível na tela) -->
          <AssinaturaCanvas v-model="assinaturaColaborador" label="Assinatura do Colaborador" />
          <AssinaturaCanvas v-model="assinaturaResponsavel" label="Assinatura do Responsável" />
        </div>

        <!-- Área de impressão (exibe as imagens desenhadas) -->
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
        <div class="card">
          <table class="tabela">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Total de Horas</th>
                <th>Total a Pagar (Ano)</th>
                <th class="no-print"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="colab in relatorioGerado.dadosConsolidados" :key="colab.id">
                <tr @click="toggleDia(colab.id)" style="cursor: pointer;" :class="{ 'linha-ativa': diaExpandido === colab.id }">
                  <td><strong>{{ colab.nome }}</strong></td>
                  <td>{{ colab.horasStr }}</td>
                  <td class="valor-tabela">{{ formatarCentavosParaReal(colab.centavos) }}</td>
                  <td class="no-print" style="text-align: right; color: #64748b;">
                    {{ diaExpandido === colab.id ? '▲' : '▼' }}
                  </td>
                </tr>
                <tr v-if="diaExpandido === colab.id" class="detalhe-row no-print">
                  <td colspan="4">
                    <div class="detalhe-meses">
                      <div v-for="m in colab.meses" :key="m.mes" class="mes-badge">
                        <span>{{ m.mes.split('-').reverse().join('/') }}</span>
                        <strong>{{ Math.floor(m.minutos / 60) }}h {{ String(m.minutos % 60).padStart(2, '0') }}m</strong>
                        <span class="val">{{ formatarCentavosParaReal(m.centavos) }}</span>
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
        <div class="card">
          <p v-if="relatorioGerado.ajustes.length === 0" class="empty-state">Nenhum ajuste registrado neste mês.</p>
          <table class="tabela" v-else>
            <thead>
              <tr>
                <th>Data Ajuste</th>
                <th>Colaborador</th>
                <th>Original</th>
                <th>Corrigido</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="aj in relatorioGerado.ajustes" :key="aj.id">
                <td>{{ new Date(aj.criadoEm).toLocaleDateString('pt-BR') }}</td>
                <td>{{ aj.nomeColab }}<br><small>{{ aj.dataMarcacao.split('-').reverse().join('/') }}</small></td>
                <td><del>{{ aj.horaOriginal }}</del><br><small>{{ aj.nomeMotivo }}</small></td>
                <td>
                  <strong v-if="aj.horaCorrigida !== 'Excluído'">{{ aj.horaCorrigida }}</strong>
                  <span v-else style="color: #dc2626; font-weight: bold;">Excluído</span>
                </td>
                <td><small>{{ aj.justificativa }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal Inconsistências -->
    <div v-if="diaInconsistente" class="modal-overlay no-print" @click.self="diaInconsistente = null">
      <div class="modal-content">
        <h3>Detalhes do Dia {{ diaInconsistente.data.split('-').reverse().join('/') }}</h3>
        <ul>
          <li v-for="(erro, index) in diaInconsistente.inconsistencias" :key="index">{{ erro }}</li>
        </ul>
        <button @click="diaInconsistente = null" class="btn-primary" style="margin-top: 16px;">Entendi</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.container { padding: 16px; max-width: 800px; margin: 0 auto; }
.header h1 { font-size: 1.5rem; margin-bottom: 20px; text-align: center; }
.card { background: var(--color-surface, #fff); padding: 16px; border-radius: var(--radius-md, 10px); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.08)); margin-bottom: 16px; }
.tabs { display: flex; gap: 10px; margin-bottom: 16px; }
.tabs button { flex: 1; padding: 10px; border: 1px solid #ccc; background: #f8fafc; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
.tabs button.active { background: var(--color-primary, #2563eb); color: white; border-color: var(--color-primary, #2563eb); }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 0.9rem; font-weight: bold; margin-bottom: 4px; }
.form-group select, .form-group input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.btn-primary { background: var(--color-primary, #2563eb); color: white; border: none; padding: 12px; width: 100%; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; }
.btn-secondary { background: var(--color-text, #1e293b); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.resumo { display: flex; justify-content: space-between; background: var(--color-primary, #2563eb); color: white; }
.resumo-item { display: flex; flex-direction: column; }
.resumo-item span { font-size: 0.9rem; opacity: 0.9; }
.resumo-item strong { font-size: 1.5rem; }
.resumo-item .valor { color: #fcd34d; }
.tabela { width: 100%; border-collapse: collapse; }
.tabela th { text-align: left; padding: 8px; border-bottom: 2px solid #eee; color: var(--color-muted, #64748b); font-size: 0.85rem; }
.tabela td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; vertical-align: top; }
.linha-ativa { background: #f8fafc; }
.detalhe-row { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }

.linha-ativa + .detalhe-row {
  display: table-row;
}
.detalhe-row td { padding: 12px 8px; border-bottom: 2px solid #e2e8f0; }
.alerta { color: var(--color-warning, #d97706); font-size: 1.2rem; }
.valor-tabela { font-weight: bold; color: var(--color-success, #16a34a); }
.empty-state { text-align: center; color: var(--color-muted, #64748b); padding: 20px; }

/* Detalhes Ponto */
.detalhe-pontos { display: flex; flex-wrap: wrap; gap: 8px; }
.ponto-badge { background: white; border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; }
.ponto-badge.trabalho { border-color: #16a34a; color: #166534; }
.ponto-badge.pausa { border-color: #d97706; color: #92400e; }
.ponto-badge.anulada { border-color: #dc2626; color: #991b1b; background: #fee2e2; opacity: 0.7; }

/* Detalhes Mês */
.detalhe-meses { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.mes-badge { background: white; border: 1px solid #ccc; padding: 8px; border-radius: 4px; display: flex; flex-direction: column; font-size: 0.85rem; }
.mes-badge .val { color: var(--color-success, #16a34a); font-weight: bold; margin-top: 4px; }

/* Assinaturas e Impressão */
.print-header { display: none; margin-bottom: 20px; text-align: center; }
.linha-assinatura { flex: 1; text-align: center; font-size: 0.9rem; color: #555; }
.linha-assinatura .traco { border-top: 1px solid #333; margin-bottom: 5px; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 16px; }
.modal-content { background: white; padding: 24px; border-radius: 10px; max-width: 400px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
.modal-content h3 { margin-top: 0; color: var(--color-warning, #d97706); border-bottom: 1px solid #eee; padding-bottom: 8px; }
.modal-content ul { padding-left: 20px; margin-bottom: 0; line-height: 1.5; }

/* .assinaturas { display: none; margin-top: 50px; gap: 40px; } */
.assinaturas {
  display: flex;
  gap: 20px;
  margin-top: 24px;
  margin-bottom: 24px;
}

/* Ocultar a área de impressão na tela */
.assinaturas-impressao {
  display: none;
}

/* Ocultar tabela de impressão na tela */
.print-only {
  display: none;
}

/* --- REGRAS DE IMPRESSÃO --- */
@media print {
  .no-print, .bottom-nav, .no-print * {
    display: none !important;
  }
  
  .print-only {
    display: table !important;
  }
  
  .container { padding: 0; max-width: 100%; }
  .card { box-shadow: none; border: 1px solid #ccc; break-inside: avoid; margin-bottom: 0; }
  .resumo { background: #eee !important; color: #000 !important; }
  .resumo-item .valor { color: #000 !important; }
  .print-header { display: block; }
  /* .assinaturas { display: flex; } */
  .page-content { padding-bottom: 0; }
  
  .tabela { font-size: 0.85rem; }
  .tabela th, .tabela td { padding: 6px 4px; border: 1px solid #ccc; }
  
  .detalhe-pontos { display: flex; flex-wrap: wrap; gap: 4px; }
  .ponto-badge { display: inline-block; border: 1px solid #ccc; padding: 2px 4px; margin: 2px; border-radius: 2px; font-size: 0.75rem; }


  /* Exibe a área de impressão e esconde a de desenho */
  .assinaturas-impressao {
    display: flex !important;
    flex-direction: row !important; /* Força ficar em linha */
    flex-wrap: nowrap !important;  /* Impede que quebre para a linha de baixo */
    justify-content: space-between;
    gap: 30px;
    margin-top: 50px;
    break-inside: avoid;
  }
  
  .bloco-assinatura {
    flex: 1; /* Cada um ocupa exatamente 50% do espaço */
    width: 50%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .imagem-assinatura {
    height: 60px; /* Altura fixa para a assinatura na impressão */
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