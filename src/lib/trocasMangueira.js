// Sugestão de realocação de mangueira pra um CCI em linha (setor
// Hidrantes/Mangueiras) — mesmo espírito de trocas.js (só sugestão, nunca
// executa nada sozinho), mas sem reciprocidade: aqui é sempre unilateral,
// "pega essa mangueira específica e leva pro CCI que precisa". Prioridade:
// Depósito (sobressalente, não tira de ninguém) antes de CCI em RT com
// sobra (mangueiras além da própria dotação exigida). Nunca oferece um
// CCI em LINHA como origem.

function chaveOrigemMangueira(mangueiraId) {
  return `mangueira:${mangueiraId}`
}

// Todos os planos já definidos que têm este CCI como destino.
export function trocasPlanejadasParaCci(trocasPlanejadas, cciId) {
  return trocasPlanejadas.filter(t => t.cci_destino_id === cciId)
}

// Candidatos disponíveis pra suprir um CCI/tipo de mangueira — a primeira
// da lista é a recomendada (Depósito sempre antes de CCI RT com sobra).
export function candidatosParaCci({ cciDestinoId, tipoMangueiraId, todosCcis, todasMangueiras, dotacaoPorCci, trocasPlanejadas }) {
  const origensReivindicadas = new Set(trocasPlanejadas.map(t => chaveOrigemMangueira(t.mangueira_id)))

  const mangueirasDoTipo = todasMangueiras.filter(m => m.tipo_mangueira_id === tipoMangueiraId)

  const deposito = mangueirasDoTipo
    .filter(m => m.localizacao_tipo === 'DEPOSITO')
    .filter(m => !origensReivindicadas.has(chaveOrigemMangueira(m.id)))
    .map(m => ({ tipo: 'deposito', mangueira: m }))

  const ccisRt = todosCcis.filter(c => c.situacao === 'RT' && c.id !== cciDestinoId)

  const cciRtCandidatos = ccisRt.flatMap(cci => {
    const presentesNoCci = mangueirasDoTipo.filter(m => m.cci_id === cci.id)
    const dotacaoRow = (dotacaoPorCci[cci.id] || []).find(d => d.tipo_mangueira_id === tipoMangueiraId)
    const exigida = dotacaoRow ? dotacaoRow.quantidade_exigida : 0
    const sobra = presentesNoCci.length - exigida
    if (sobra <= 0) return []

    return presentesNoCci
      .filter(m => !origensReivindicadas.has(chaveOrigemMangueira(m.id)))
      .sort((a, b) => a.identificacao.localeCompare(b.identificacao))
      .slice(0, sobra)
      .map(m => ({ tipo: 'cci_rt', mangueira: m, cciOrigem: cci }))
  })

  return [...deposito, ...cciRtCandidatos]
}
