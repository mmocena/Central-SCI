// Conformidade de uma mangueira individual (setor Hidrantes/Mangueiras) —
// mesmo espírito de src/lib/conformidade.js, mas mais simples: só duas
// causas possíveis de não conformidade (integridade e validade do teste
// hidrostático), sem categorias múltiplas como capacidade/sinalização dos
// extintores.

export function validadeHidrostaticaVencida(validadeTesteHidrostatico) {
  if (!validadeTesteHidrostatico) return false
  return new Date(validadeTesteHidrostatico) < new Date()
}

export function calcularConformidadeMangueira({ integridadeOk, validadeTesteHidrostatico }) {
  if (integridadeOk === false) return 'nao_conforme'
  if (validadeHidrostaticaVencida(validadeTesteHidrostatico)) return 'nao_conforme'
  return 'conforme'
}

// Texto automático de Observações — mesmo padrão de textoObservacaoAutomatica
// em conformidade.js, junta os fatores de integridade selecionados (incl.
// "Outros") com o alerta de validade vencida, se houver.
export function textoObservacaoAutomaticaMangueira({ integridadeOk, fatoresIntegridade = [], validadeTesteHidrostatico }) {
  const partes = []
  if (integridadeOk === false) {
    partes.push(fatoresIntegridade.length ? fatoresIntegridade.join(', ') : 'Mangueira não íntegra')
  }
  if (validadeHidrostaticaVencida(validadeTesteHidrostatico)) {
    partes.push('Teste hidrostático vencido')
  }
  return partes.length ? partes.join('. ') + '.' : ''
}
