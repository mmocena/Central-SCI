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
export function calcularConformidade({ capExtAtual, capExtExigida, tipoAtual, tipoExigido, capExtOk, operacional }) {
  if (operacional === false) return 'nao_conforme'

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
