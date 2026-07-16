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

// validade_nivel2 vem como 'YYYY-MM' (input mês) ou já persistida como
// 'YYYY-MM-DD' (banco); validade_nivel3 vem como 'YYYY' (ano) ou 'YYYY-MM-DD'
// (banco, sempre 1º de dezembro). Aceita os dois formatos pelo tamanho da
// string, pra funcionar tanto no momento da inspeção quanto lendo o estado já salvo.
export function n2Vencida(validadeNivel2) {
  if (!validadeNivel2) return false
  const data = validadeNivel2.length === 7 ? `${validadeNivel2}-01` : validadeNivel2
  return new Date(data) < new Date()
}

export function n3Vencida(validadeNivel3) {
  if (!validadeNivel3) return false
  const data = validadeNivel3.length === 4 ? `${validadeNivel3}-12-01` : validadeNivel3
  return new Date(data) < new Date()
}

// Tipo divergente da planta é um alerta independente da conformidade —
// não entra em situacao_conformidade nem em motivo_nao_conformidade.
// É recalculado direto dos campos (sem persistir nada extra) sempre que
// precisa ser exibido, ex: badge "Alerta" na coluna Status.
export function tipoDivergente(tipoAtual, tipoExigido) {
  return Boolean(tipoAtual && tipoExigido && tipoAtual.trim() !== tipoExigido.trim())
}

// capExtOk: boolean override para locais com 2 slots (avaliação conjunta)
// operacional: false → sempre não conforme
// sinalizacaoOk: false → sempre não conforme
// validadeNivel2/3 vencida → sempre não conforme (independe de operacional/sinalização/cap.ext)
// Só existem 2 situações possíveis: 'conforme' ou 'nao_conforme'. Tipo
// divergente sozinho NÃO torna o extintor não conforme — vira só o alerta
// acima, separado, verificado por quem for exibir.
export function calcularConformidade({ capExtAtual, capExtExigida, capExtOk, operacional, sinalizacaoOk, validadeNivel2, validadeNivel3 }) {
  if (n2Vencida(validadeNivel2)) return 'nao_conforme'
  if (n3Vencida(validadeNivel3)) return 'nao_conforme'
  if (operacional === false) return 'nao_conforme'
  if (sinalizacaoOk === false) return 'nao_conforme'

  // Caminho dual-slot: usa boolean capExtOk
  if (capExtOk !== undefined && capExtOk !== null) {
    return capExtOk ? 'conforme' : 'nao_conforme'
  }

  // Sem exigência de cap.ext: nada mais a checar
  const parsedExigida = parseCapExt(capExtExigida)
  if (!parsedExigida) return 'conforme'

  // Caminho single-slot: compara strings
  const parsedAtual = parseCapExt(capExtAtual)
  if (!parsedAtual || !atende(parsedAtual, parsedExigida)) return 'nao_conforme'
  return 'conforme'
}

// Textos fixos usados em motivo_nao_conformidade — exportados para que quem
// precisar categorizar um motivo já salvo (ex: tela de Não Conformidades)
// reconheça o mesmo texto gerado aqui, em vez de duplicar a string alhures.
export const MOTIVO_SINALIZACAO = 'Sinalização não conforme'
export const MOTIVO_CAP_EXT = 'Capacidade extintora abaixo do exigido pela planta'
export const MOTIVO_VALIDADE_N2 = 'Validade Nível 2 vencida'
export const MOTIVO_VALIDADE_N3 = 'Validade Nível 3 vencida'
const REGEX_TIPO_DIVERGENTE = /Tipo divergente da planta \([^)]*\)\.?/

// Lista os motivos por trás da conformidade calculada — usada tanto para o
// resumo "Não Conformidade" quanto para o texto automático de Observações.
// Cobre o caminho de capExtOk booleano (usado pelo formulário de inspeção padrão).
// Não inclui tipo divergente: esse é um alerta à parte (ver tipoDivergente/
// textoTipoDivergente) que só aparece em Observações, nunca em Não Conformidade
// — se já houver uma não conformidade real (ex: capacidade), o motivo dela já
// aparece aqui; o tipo divergente por si só não é motivo de não conformidade.
export function motivosNaoConformidade({ operacional, fatoresSelecionados = [], sinalizacaoOk, capExtOk, validadeNivel2, validadeNivel3 }) {
  const motivos = []

  if (n2Vencida(validadeNivel2)) motivos.push(MOTIVO_VALIDADE_N2)
  if (n3Vencida(validadeNivel3)) motivos.push(MOTIVO_VALIDADE_N3)
  if (operacional === false) {
    motivos.push(fatoresSelecionados.length ? fatoresSelecionados.join(', ') : 'Extintor não operacional')
  }
  if (sinalizacaoOk === false) motivos.push(MOTIVO_SINALIZACAO)
  if (capExtOk === false) motivos.push(MOTIVO_CAP_EXT)

  return motivos
}

// Texto fixo gerado a partir dos motivos — presente nas Observações sempre que
// houver não conformidade, para que a repetição do mesmo problema em
// inspeções sucessivas fique visível. Quando conforme, não gera texto nenhum.
export function textoObservacaoAutomatica(motivos) {
  return motivos.length ? motivos.join('. ') + '.' : ''
}

// Texto do alerta de tipo divergente — só para Observações, nunca para
// motivo_nao_conformidade (ver comentário de motivosNaoConformidade).
export function textoTipoDivergente(tipoAtual, tipoExigido) {
  return tipoDivergente(tipoAtual, tipoExigido)
    ? `Tipo divergente da planta (atual: ${tipoAtual}, exigido: ${tipoExigido}).`
    : ''
}

// Reconhece, a partir do texto salvo em motivo_nao_conformidade, quais das
// categorias fixas (cap.ext / sinalização / tipo divergente / validade) estão
// presentes. O que sobra depois de remover essas quatro é considerado motivo
// operacional (fator de não operacionalidade, texto livre configurado pelo admin).
export function separarMotivos(motivo) {
  if (!motivo) return { capExt: false, sinalizacao: false, tipoDivergente: false, validadeN2: false, validadeN3: false, operacional: false }

  const capExt = motivo.includes(MOTIVO_CAP_EXT)
  const sinalizacao = motivo.includes(MOTIVO_SINALIZACAO)
  const tipoDivergenteNoTexto = REGEX_TIPO_DIVERGENTE.test(motivo)
  const validadeN2 = motivo.includes(MOTIVO_VALIDADE_N2)
  const validadeN3 = motivo.includes(MOTIVO_VALIDADE_N3)

  const resto = motivo
    .replaceAll(MOTIVO_CAP_EXT, '')
    .replaceAll(MOTIVO_SINALIZACAO, '')
    .replaceAll(MOTIVO_VALIDADE_N2, '')
    .replaceAll(MOTIVO_VALIDADE_N3, '')
    .replace(REGEX_TIPO_DIVERGENTE, '')
    .replace(/[,\s.]+/g, '')

  return { capExt, sinalizacao, tipoDivergente: tipoDivergenteNoTexto, validadeN2, validadeN3, operacional: resto.length > 0 }
}
