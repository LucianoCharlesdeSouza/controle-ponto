import { calcularValorPago } from './Money.js';

/**
 * Apura o dia de um colaborador.
 * @param {Array} marcacoes - Lista de marcações do dia ordenadas por dataHora
 * @param {Number} valorHoraCentavos - Valor da hora vigente na data
 */
export function apurarDia(marcacoes, valorHoraCentavos) {
  if (!marcacoes || marcacoes.length === 0) {
    return { minutosTrabalhados: 0, valorCentavos: 0, periodos: [], inconsistencias: [] };
  }

  // Ordena por data/hora (segurança)
  const marcs = [...marcacoes].sort((a, b) => new Date(a.dataHoraLocal) - new Date(b.dataHoraLocal));

  let periodosTrabalhados = [];
  let inconsistencias = [];
  let minutosTrabalhados = 0;
  
  let inicioPeriodoAtual = null;

  for (let i = 0; i < marcs.length; i++) {
    const marcacao = marcs[i];

    if (marcacao.natureza === 'trabalho') {
      if (inicioPeriodoAtual) {
        // Duas marcações de trabalho seguidas
        inconsistencias.push(`Marcação dupla de trabalho às ${marcacao.dataHoraLocal}`);
      } else {
        inicioPeriodoAtual = new Date(marcacao.dataHoraLocal);
      }
    } else if (marcacao.natureza === 'pausa') {
      if (!inicioPeriodoAtual) {
        // Pausa sem ter iniciado trabalho
        inconsistencias.push(`Pausa sem trabalho anterior às ${marcacao.dataHoraLocal}`);
      } else {
        const fimPeriodo = new Date(marcacao.dataHoraLocal);
        const diffMs = fimPeriodo - inicioPeriodoAtual;
        
        if (diffMs < 0) {
          inconsistencias.push(`Horário de saída anterior ao de entrada às ${marcacao.dataHoraLocal}`);
        } else {
          const minutos = Math.floor(diffMs / 60000); // Converte ms para minutos
          minutosTrabalhados += minutos;
          periodosTrabalhados.push({
            inicio: inicioPeriodoAtual.toISOString(),
            fim: fimPeriodo.toISOString(),
            minutos: minutos
          });
        }
        inicioPeriodoAtual = null;
      }
    }
  }

  // Verifica se ficou um período aberto no fim do dia
  if (inicioPeriodoAtual) {
    inconsistencias.push(`Período em aberto (sem pausa/saída final) iniciado às ${inicioPeriodoAtual.toISOString()}`);
  }

  // Cálculo do valor
  const valorCentavos = calcularValorPago(minutosTrabalhados, valorHoraCentavos);

  return {
    minutosTrabalhados,
    valorCentavos,
    periodos: periodosTrabalhados,
    inconsistencias
  };
}