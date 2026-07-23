import { tipoDivergente, separarMotivos } from './conformidade'

// Separa quem precisa de troca de Tipo em duas prioridades: primeiro quem
// tem não conformidade real de capacidade (mais grave — a troca também
// resolve a não conformidade), depois quem só tem o alerta de tipo
// divergente (sem outro problema). Um mesmo local nunca entra nas duas —
// fica só na de maior prioridade.
export function locaisNecessitandoTroca(linhas) {
  const capacidade = linhas.filter(l =>
    l.estado.situacao_conformidade === 'nao_conforme' &&
    separarMotivos(l.estado.motivo_nao_conformidade).capExt &&
    tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido)
  )
  const capacidadeKeys = new Set(capacidade.map(l => `${l.local.id}:${l.slot}`))

  const tipo = linhas.filter(l =>
    tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido) &&
    !capacidadeKeys.has(`${l.local.id}:${l.slot}`)
  )

  return { capacidade, tipo }
}

function chaveOrigemLocal(localId, slot) {
  return `local:${localId}:${slot}`
}

function chaveOrigemEstoque(estoqueId) {
  return `estoque:${estoqueId}`
}

// Mesma chave de origem usada internamente em candidatosParaLocal, exposta
// pra quem (fora deste módulo) precisa comparar candidatos entre listas
// diferentes — ex: origensRecomendadasParaCapacidade, abaixo.
export function chaveCandidato(c) {
  return c.tipo === 'local' ? chaveOrigemLocal(c.local.id, c.slot) : chaveOrigemEstoque(c.estoque.id)
}

// Todas as opções disponíveis pra suprir um local que precisa de troca —
// não escolhe uma só, mostra tudo que ainda não foi reivindicado por outro
// plano. A primeira da lista é a recomendada (segue a hierarquia: recíproca
// mesma edificação → recíproca outra edificação → estoque SCI → RESERVA).
export function candidatosParaLocal({ necessitando, linhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas }) {
  const origensReivindicadas = new Set(
    trocasPlanejadas.map(t =>
      t.origem_tipo === 'local'
        ? chaveOrigemLocal(t.origem_local_id, t.origem_slot)
        : chaveOrigemEstoque(t.origem_estoque_id)
    )
  )

  // Quem já é destino de uma troca recíproca de campo também está
  // "comprometido" do outro lado — o tipo atual dele vai embora pro parceiro
  // daquele plano, então não pode ser oferecido como origem pra mais ninguém.
  const destinosReciprocosComprometidos = new Set(
    trocasPlanejadas
      .filter(t => t.origem_tipo === 'local')
      .map(t => chaveOrigemLocal(t.local_id, t.slot))
  )

  const tipoNecessario = necessitando.local.planta_tipo_exigido
  const tipoAtualNecessitando = necessitando.estado.extintor_tipo

  const reciprocas = linhas
    .filter(l => l.local.id !== necessitando.local.id)
    .filter(l => !origensReivindicadas.has(chaveOrigemLocal(l.local.id, l.slot)))
    .filter(l => !destinosReciprocosComprometidos.has(chaveOrigemLocal(l.local.id, l.slot)))
    .filter(l => l.estado.extintor_tipo === tipoNecessario)
    .filter(l => l.local.planta_tipo_exigido === tipoAtualNecessitando)
    .map(l => ({
      tipo: 'local',
      mesmaEdificacao: l.local.edificacao === necessitando.local.edificacao,
      local: l.local,
      slot: l.slot,
      tipoOferecido: l.estado.extintor_tipo
    }))
  const reciprocasMesma = reciprocas.filter(r => r.mesmaEdificacao)
  const reciprocasOutras = reciprocas.filter(r => !r.mesmaEdificacao)

  const filtraEstoque = lista => lista
    .filter(e => e.tipo === tipoNecessario && e.quantidade > 0)
    .filter(e => !origensReivindicadas.has(chaveOrigemEstoque(e.id)))

  const sci = filtraEstoque(estoqueSCI).map(e => ({ tipo: 'estoque_sci', estoque: e }))
  const reserva = filtraEstoque(estoqueRESERVA).map(e => ({ tipo: 'estoque_reserva', estoque: e }))

  return [...reciprocasMesma, ...reciprocasOutras, ...sci, ...reserva]
}

// Encontra o plano já definido pra este local, se houver (ele como destino).
export function trocaPlanejadaDoLocal(trocasPlanejadas, local, slot) {
  return trocasPlanejadas.find(t => t.local_id === local.id && t.slot === slot) || null
}

// Uma troca recíproca de campo resolve os dois lados na mesma ação: quem dá
// também recebe o que precisava. Por isso, se este local já está sendo usado
// como origem de um plano recíproca de OUTRO destino, a necessidade dele já
// está coberta por aquele mesmo plano — não deve aparecer com sugestões
// próprias (evita definir a mesma troca física duas vezes, uma de cada lado).
export function trocaQueResolveComoOrigem(trocasPlanejadas, local, slot) {
  return trocasPlanejadas.find(t =>
    t.origem_tipo === 'local' && t.origem_local_id === local.id && t.origem_slot === slot
  ) || null
}

// Mapeia cada candidato que é a RECOMENDAÇÃO (índice 0) de alguma não
// conformidade real de Capacidade extintora pros locais que dependem dele
// — usado pra impedir que esse mesmo candidato seja oferecido como
// recomendado também pra um simples alerta de Tipo divergente (que não é
// não conformidade de verdade) em outro lugar da interface. Duas
// necessidades de Capacidade que empatem no mesmo candidato ficam as duas
// no array — entre Capacidade e Capacidade não há proteção, só entre
// Capacidade e Tipo divergente puro.
export function origensRecomendadasParaCapacidade({ necessitandoCapacidade, linhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas }) {
  const mapa = new Map()
  for (const necessitando of necessitandoCapacidade) {
    const [recomendado] = candidatosParaLocal({ necessitando, linhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas })
    if (!recomendado) continue
    const chave = chaveCandidato(recomendado)
    if (!mapa.has(chave)) mapa.set(chave, [])
    mapa.get(chave).push({ local: necessitando.local, slot: necessitando.slot })
  }
  return mapa
}
