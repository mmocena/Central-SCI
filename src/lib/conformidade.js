function parseCapExt(str) {
  if (!str) return null
  const result = { A: 0, B: 0, C: false }
  const parts = str.toUpperCase().split(':')
  for (const part of parts) {
    const matchA = part.match(/^(\d+)-?A$/)
    const matchB = part.match(/^(\d+)-?B$/)
    const matchC = part.match(/^C$/)
    if (matchA) result.A = parseInt(matchA[1])
    else if (matchB) result.B = parseInt(matchB[1])
    else if (matchC) result.C = true
  }
  return result
}

function atende(atual, exigida) {
  if (!atual || !exigida) return false
  if (exigida.A > 0 && atual.A < exigida.A) return false
  if (exigida.B > 0 && atual.B < exigida.B) return false
  if (exigida.C && !atual.C) return false
  return true
}

// capExtOk: boolean override para locais com 2 slots (avaliação conjunta)
// operacional: false → sempre não conforme
// sinalizacaoOk: false → sempre não conforme
export function calcularConformidade({ capExtAtual, capExtExigida, tipoAtual, tipoExigido, capExtOk, operacional, sinalizacaoOk }) {
  if (operacional === false) return 'nao_conforme'
  if (sinalizacaoOk === false) return 'nao_conforme'

  const tipoErrado = tipoAtual && tipoExigido && tipoAtual.trim() !== tipoExigido.trim()

  // Caminho dual-slot: usa boolean capExtOk
  if (capExtOk !== undefined && capExtOk !== null) {
    if (!capExtOk) return 'nao_conforme'
    return tipoErrado ? 'alerta' : 'conforme'
  }

  // Sem exigência de cap.ext: verifica só o tipo
  const parsedExigida = parseCapExt(capExtExigida)
  if (!parsedExigida) return tipoErrado ? 'alerta' : 'conforme'

  // Caminho single-slot: compara strings
  const parsedAtual = parseCapExt(capExtAtual)
  if (!parsedAtual || !atende(parsedAtual, parsedExigida)) return 'nao_conforme'
  return tipoErrado ? 'alerta' : 'conforme'
}

// Lista os motivos por trás da conformidade calculada — usada tanto para o
// resumo "Não Conformidade" quanto para o texto automático de Observações.
// Cobre o caminho de capExtOk booleano (usado pelo formulário de inspeção padrão).
export function motivosNaoConformidade({ operacional, fatoresSelecionados = [], sinalizacaoOk, capExtOk, tipoAtual, tipoExigido }) {
  const motivos = []

  if (operacional === false) {
    motivos.push(fatoresSelecionados.length ? fatoresSelecionados.join(', ') : 'Extintor não operacional')
  }
  if (sinalizacaoOk === false) motivos.push('Sinalização não conforme')
  if (capExtOk === false) motivos.push('Capacidade extintora abaixo do exigido pela planta')

  const tipoErrado = tipoAtual && tipoExigido && tipoAtual.trim() !== tipoExigido.trim()
  if (tipoErrado) motivos.push(`Tipo divergente da planta (atual: ${tipoAtual}, exigido: ${tipoExigido})`)

  return motivos
}

// Texto fixo gerado a partir dos motivos — presente nas Observações sempre que
// houver alerta ou não conformidade, para que a repetição do mesmo problema em
// inspeções sucessivas fique visível. Quando conforme, não gera texto nenhum.
export function textoObservacaoAutomatica(motivos) {
  return motivos.length ? motivos.join('. ') + '.' : ''
}
