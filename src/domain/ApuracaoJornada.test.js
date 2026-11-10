import { describe, it, expect } from 'vitest';
import { apurarDia } from './ApuracaoJornada.js';

describe('Apuracao de Jornada', () => {
  const valorHora = 1500; // R$ 15,00

  it('deve calcular o exemplo exato do projeto (2h + 3h45 + 3h + 3h20 = 725 min)', () => {
    // 2h + 3h45 + 3h + 3h20 = 725 minutos
    const marcacoes = [
      { dataHoraLocal: '2026-11-10T05:00:00', natureza: 'trabalho' },
      { dataHoraLocal: '2026-11-10T07:00:00', natureza: 'pausa' },
      { dataHoraLocal: '2026-11-10T07:15:00', natureza: 'trabalho' },
      { dataHoraLocal: '2026-11-10T11:00:00', natureza: 'pausa' },
      { dataHoraLocal: '2026-11-10T12:00:00', natureza: 'trabalho' },
      { dataHoraLocal: '2026-11-10T15:00:00', natureza: 'pausa' },
      { dataHoraLocal: '2026-11-10T15:10:00', natureza: 'trabalho' },
      { dataHoraLocal: '2026-11-10T18:30:00', natureza: 'pausa' }
    ];

    const resultado = apurarDia(marcacoes, valorHora);
    
    expect(resultado.minutosTrabalhados).toBe(725);
    // 725 min * 1500 centavos / 60 = 18.125 centavos (R$ 181,25)
    expect(resultado.valorCentavos).toBe(18125);
    expect(resultado.inconsistencias.length).toBe(0);
    expect(resultado.periodos.length).toBe(4);
  });

  it('deve pagar proporcional aos minutos (7h42 = 462 min)', () => {
    const marcacoes = [
      { dataHoraLocal: '2026-11-10T08:00:00', natureza: 'trabalho' },
      { dataHoraLocal: '2026-11-10T15:42:00', natureza: 'pausa' } // 7h42 sem pausas
    ];
    const resultado = apurarDia(marcacoes, valorHora);
    expect(resultado.minutosTrabalhados).toBe(462);
    expect(resultado.valorCentavos).toBe(11550); // R$ 115,50
  });

  it('deve identificar inconsistências (pausa sem entrada)', () => {
    const marcacoes = [
      { dataHoraLocal: '2026-11-10T12:00:00', natureza: 'pausa' }
    ];
    const resultado = apurarDia(marcacoes, valorHora);
    expect(resultado.inconsistencias.length).toBe(1);
    expect(resultado.minutosTrabalhados).toBe(0);
  });

  it('deve identificar período aberto no fim do dia', () => {
    const marcacoes = [
      { dataHoraLocal: '2026-11-10T08:00:00', natureza: 'trabalho' }
    ];
    const resultado = apurarDia(marcacoes, valorHora);
    expect(resultado.inconsistencias[0]).toContain('Período em aberto');
  });
});