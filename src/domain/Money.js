export function calcularValorPago(minutosTrabalhados, valorHoraCentavos) {
  // Regra: valor = (minutos / 60) * valorHora
  // Multiplicamos primeiro para evitar dízimas periódicas e depois arredondamos
  return Math.round((minutosTrabalhados * valorHoraCentavos) / 60);
}

export function formatarCentavosParaReal(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(centavos / 100);
}