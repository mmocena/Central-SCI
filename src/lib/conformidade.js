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
// Categoria curta (ver comentário de motivosNaoConformidade) — o detalhe
// (fatores selecionados) fica só nas Observações, nunca aqui.
export const MOTIVO_SINALIZACAO = 'Sinalização'
export const MOTIVO_OPERACIONAL = 'Extintor não operacional'
export const MOTIVO_CAP_EXT = 'Capacidade extintora abaixo do exigido pela planta'
export const MOTIVO_VALIDADE_N2 = 'Validade Nível 2 vencida'
export const MOTIVO_VALIDADE_N3 = 'Validade Nível 3 vencida'
// Texto antigo de sinalização (antes da categoria virar só "Sinalização"),
// mantido só pra limpar corretamente o resíduo de motivo_nao_conformidade
// de inspeções registradas antes dessa mudança — ver separarMotivos.
const MOTIVO_SINALIZACAO_ANTIGO = 'Sinalização não conforme'
const REGEX_TIPO_DIVERGENTE = /Tipo divergente da planta \([^)]*\)\.?/

// Lista os motivos por trás da conformidade calculada — usada tanto para o
// resumo "Não Conformidade" quanto para o texto automático de Observações.
// Cobre o caminho de capExtOk booleano (usado pelo formulário de inspeção padrão).
// Não inclui tipo divergente: esse é um alerta à parte (ver tipoDivergente/
// textoTipoDivergente) que só aparece em Observações, nunca em Não Conformidade
// — se já houver uma não conformidade real (ex: capacidade), o motivo dela já
// aparece aqui; o tipo divergente por si só não é motivo de não conformidade.
// Sempre categorias fixas e curtas — o detalhe (fatores selecionados de
// operacionalidade/sinalização) não entra aqui, só em Observações (ver
// textoDetalhesFatores).
export function motivosNaoConformidade({ operacional, sinalizacaoOk, capExtOk, validadeNivel2, validadeNivel3 }) {
  const motivos = []

  if (n2Vencida(validadeNivel2)) motivos.push(MOTIVO_VALIDADE_N2)
  if (n3Vencida(validadeNivel3)) motivos.push(MOTIVO_VALIDADE_N3)
  if (operacional === false) motivos.push(MOTIVO_OPERACIONAL)
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

// Detalhe dos fatores selecionados (operacionais + sinalização, incl. texto
// livre de "Outros") — só entra em Observações, nunca em motivo_nao_conformidade
// (essa é a categoria curta; o detalhe fica separado, ver contexto acima).
export function textoDetalhesFatores({ fatoresOperacionais = [], fatoresSinalizacao = [] }) {
  const todos = [...fatoresOperacionais, ...fatoresSinalizacao]
  return todos.length ? todos.join(', ') + '.' : ''
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
// presentes. "operacional" reconhece tanto o texto fixo atual
// ("Extintor não operacional") quanto, por compatibilidade com inspeções
// registradas antes dessa categoria virar fixa, qualquer texto residual que
// sobre depois de remover as demais categorias (era o fator de não
// operacionalidade escrito por extenso).
export function separarMotivos(motivo) {
  if (!motivo) return { capExt: false, sinalizacao: false, tipoDivergente: false, validadeN2: false, validadeN3: false, operacional: false }

  const capExt = motivo.includes(MOTIVO_CAP_EXT)
  const sinalizacao = motivo.includes(MOTIVO_SINALIZACAO)
  const tipoDivergenteNoTexto = REGEX_TIPO_DIVERGENTE.test(motivo)
  const validadeN2 = motivo.includes(MOTIVO_VALIDADE_N2)
  const validadeN3 = motivo.includes(MOTIVO_VALIDADE_N3)
  const operacionalFixo = motivo.includes(MOTIVO_OPERACIONAL)

  const resto = motivo
    .replaceAll(MOTIVO_OPERACIONAL, '')
    .replaceAll(MOTIVO_CAP_EXT, '')
    .replaceAll(MOTIVO_SINALIZACAO_ANTIGO, '')
    .replaceAll(MOTIVO_SINALIZACAO, '')
    .replaceAll(MOTIVO_VALIDADE_N2, '')
    .replaceAll(MOTIVO_VALIDADE_N3, '')
    .replace(REGEX_TIPO_DIVERGENTE, '')
    .replace(/[,\s.]+/g, '')

  return { capExt, sinalizacao, tipoDivergente: tipoDivergenteNoTexto, validadeN2, validadeN3, operacional: operacionalFixo || resto.length > 0 }
}

// Igual ao "resto" calculado em separarMotivos, mas preservando a pontuação
// pra poder separar por vírgula e reconhecer cada fator de não
// operacionalidade individualmente — só serve pra inspeções antigas, cujo
// texto do fator estava escrito direto em motivo_nao_conformidade (hoje o
// detalhe vem estruturado em local_estado_atual.fatores_operacionais).
export function fatoresOperacionaisDoMotivo(motivo) {
  if (!motivo || motivo.includes(MOTIVO_OPERACIONAL)) return []
  const resto = motivo
    .replaceAll(MOTIVO_CAP_EXT, '')
    .replaceAll(MOTIVO_SINALIZACAO_ANTIGO, '')
    .replaceAll(MOTIVO_SINALIZACAO, '')
    .replaceAll(MOTIVO_VALIDADE_N2, '')
    .replaceAll(MOTIVO_VALIDADE_N3, '')
    .replace(REGEX_TIPO_DIVERGENTE, '')
  return resto.split(',').map(s => s.trim()).filter(Boolean)
}
