import { describe, it, expect } from 'vitest'
import { locaisNecessitandoTroca, candidatosParaLocal, trocaPlanejadaDoLocal, trocaQueResolveComoOrigem } from './trocas'

function linha({ localId = 'L1', numero = 1, edificacao = 'PREDIO A', slot = 'A', tipoExigido, tipoAtual, situacao = 'conforme', motivo = null }) {
  return {
    local: { id: localId, numero, edificacao, planta_tipo_exigido: tipoExigido },
    slot,
    estado: { extintor_tipo: tipoAtual, situacao_conformidade: situacao, motivo_nao_conformidade: motivo }
  }
}

describe('locaisNecessitandoTroca', () => {
  it('tipo divergente sozinho (conforme) vai pro grupo "tipo"', () => {
    const linhas = [linha({ tipoExigido: 'CO²', tipoAtual: 'PQS BC', situacao: 'conforme' })]
    const { capacidade, tipo } = locaisNecessitandoTroca(linhas)
    expect(capacidade).toEqual([])
    expect(tipo).toHaveLength(1)
  })

  it('capacidade insuficiente + tipo divergente vai pro grupo "capacidade", não duplica em "tipo"', () => {
    const linhas = [linha({
      tipoExigido: 'CO²', tipoAtual: 'PQS BC', situacao: 'nao_conforme',
      motivo: 'Capacidade extintora abaixo do exigido pela planta'
    })]
    const { capacidade, tipo } = locaisNecessitandoTroca(linhas)
    expect(capacidade).toHaveLength(1)
    expect(tipo).toEqual([])
  })

  it('capacidade insuficiente sem tipo divergente não entra em nenhum grupo (troca de tipo não ajudaria)', () => {
    const linhas = [linha({
      tipoExigido: 'CO²', tipoAtual: 'CO²', situacao: 'nao_conforme',
      motivo: 'Capacidade extintora abaixo do exigido pela planta'
    })]
    const { capacidade, tipo } = locaisNecessitandoTroca(linhas)
    expect(capacidade).toEqual([])
    expect(tipo).toEqual([])
  })

  it('não conforme por outro motivo (sinalização) com tipo divergente vai pro grupo "tipo"', () => {
    const linhas = [linha({
      tipoExigido: 'CO²', tipoAtual: 'PQS BC', situacao: 'nao_conforme',
      motivo: 'Sinalização não conforme'
    })]
    const { capacidade, tipo } = locaisNecessitandoTroca(linhas)
    expect(capacidade).toEqual([])
    expect(tipo).toHaveLength(1)
  })
})

describe('candidatosParaLocal', () => {
  it('encontra troca recíproca de campo: A precisa do que B tem, e B precisa do que A tem', () => {
    const necessitando = linha({ localId: 'L51', numero: 51, edificacao: 'ELOS', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const doador = linha({ localId: 'L55', numero: 55, edificacao: 'ELOS', tipoExigido: 'PQS ABC', tipoAtual: 'PQS BC' })
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando, doador], estoqueSCI: [], estoqueRESERVA: [], trocasPlanejadas: []
    })
    expect(candidatos).toHaveLength(1)
    expect(candidatos[0]).toMatchObject({ tipo: 'local', local: { id: 'L55' }, mesmaEdificacao: true })
  })

  it('não sugere troca não-recíproca (B tem o tipo certo mas não precisa do que A tem)', () => {
    const necessitando = linha({ localId: 'L51', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const doador = linha({ localId: 'L55', tipoExigido: 'CO²', tipoAtual: 'PQS BC' })
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando, doador], estoqueSCI: [], estoqueRESERVA: [], trocasPlanejadas: []
    })
    expect(candidatos).toEqual([])
  })

  it('prioriza recíproca da mesma edificação antes de outra edificação', () => {
    const necessitando = linha({ localId: 'L51', edificacao: 'ELOS', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const doadorOutraEdif = linha({ localId: 'L60', edificacao: 'SCI', tipoExigido: 'PQS ABC', tipoAtual: 'PQS BC' })
    const doadorMesmaEdif = linha({ localId: 'L55', edificacao: 'ELOS', tipoExigido: 'PQS ABC', tipoAtual: 'PQS BC' })
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando, doadorOutraEdif, doadorMesmaEdif], estoqueSCI: [], estoqueRESERVA: [], trocasPlanejadas: []
    })
    expect(candidatos).toHaveLength(2)
    expect(candidatos[0].local.id).toBe('L55')
    expect(candidatos[1].local.id).toBe('L60')
  })

  it('inclui estoque SCI e RESERVA do tipo certo, SCI antes de RESERVA', () => {
    const necessitando = linha({ tipoExigido: 'CO²', tipoAtual: 'PQS BC' })
    const estoqueSCI = [{ id: 'E1', tipo: 'CO²', kg: 6, categoria: 'SCI', quantidade: 2 }]
    const estoqueRESERVA = [{ id: 'E2', tipo: 'CO²', kg: 6, categoria: 'RESERVA', quantidade: 1 }]
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando], estoqueSCI, estoqueRESERVA, trocasPlanejadas: []
    })
    expect(candidatos.map(c => c.tipo)).toEqual(['estoque_sci', 'estoque_reserva'])
  })

  it('ignora estoque de tipo diferente ou com quantidade zero', () => {
    const necessitando = linha({ tipoExigido: 'CO²', tipoAtual: 'PQS BC' })
    const estoqueSCI = [
      { id: 'E1', tipo: 'PQS ABC', kg: 6, categoria: 'SCI', quantidade: 5 },
      { id: 'E2', tipo: 'CO²', kg: 6, categoria: 'SCI', quantidade: 0 }
    ]
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando], estoqueSCI, estoqueRESERVA: [], trocasPlanejadas: []
    })
    expect(candidatos).toEqual([])
  })

  it('exclui origem (local ou estoque) já reivindicada por outro plano', () => {
    const necessitando = linha({ localId: 'L51', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const doador = linha({ localId: 'L55', tipoExigido: 'PQS ABC', tipoAtual: 'PQS BC' })
    const estoqueSCI = [{ id: 'E1', tipo: 'PQS BC', kg: 6, categoria: 'SCI', quantidade: 1 }]
    const trocasPlanejadas = [
      { local_id: 'L99', slot: 'A', origem_tipo: 'local', origem_local_id: 'L55', origem_slot: 'A', origem_estoque_id: null },
      { local_id: 'L98', slot: 'A', origem_tipo: 'estoque_sci', origem_local_id: null, origem_slot: null, origem_estoque_id: 'E1' }
    ]
    const candidatos = candidatosParaLocal({
      necessitando, linhas: [necessitando, doador], estoqueSCI, estoqueRESERVA: [], trocasPlanejadas
    })
    expect(candidatos).toEqual([])
  })

  it('exclui quem já é destino de uma troca recíproca (tipo atual dele já foi prometido pro parceiro)', () => {
    // L49 precisa de PQS ABC (tem PQS BC) e já tem um plano definido: L49 (destino) <- L51 (origem).
    // L82 também precisa de PQS BC (mesmo tipo que L49 tem hoje) — mas L49 não pode
    // ser oferecido pra L82, porque o PQS BC de L49 já está prometido pra L51.
    const l49 = linha({ localId: 'L49', edificacao: 'ELOS', tipoExigido: 'PQS ABC', tipoAtual: 'PQS BC' })
    const l51 = linha({ localId: 'L51', edificacao: 'ELOS', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const l82 = linha({ localId: 'L82', edificacao: 'SCI', tipoExigido: 'PQS BC', tipoAtual: 'PQS ABC' })
    const trocasPlanejadas = [
      { local_id: 'L49', slot: 'A', origem_tipo: 'local', origem_local_id: 'L51', origem_slot: 'A', origem_estoque_id: null }
    ]
    const candidatosParaL82 = candidatosParaLocal({
      necessitando: l82, linhas: [l49, l51, l82], estoqueSCI: [], estoqueRESERVA: [], trocasPlanejadas
    })
    expect(candidatosParaL82.find(c => c.tipo === 'local' && c.local.id === 'L49')).toBeUndefined()

    // controle: sem o plano definido, L49 apareceria normalmente pra L82
    const candidatosSemPlano = candidatosParaLocal({
      necessitando: l82, linhas: [l49, l51, l82], estoqueSCI: [], estoqueRESERVA: [], trocasPlanejadas: []
    })
    expect(candidatosSemPlano.find(c => c.tipo === 'local' && c.local.id === 'L49')).toBeDefined()
  })
})

describe('trocaPlanejadaDoLocal', () => {
  it('encontra o plano do local certo', () => {
    const trocas = [{ local_id: 'L51', slot: 'A', id: 'T1' }, { local_id: 'L52', slot: 'A', id: 'T2' }]
    const local = { id: 'L51' }
    expect(trocaPlanejadaDoLocal(trocas, local, 'A')?.id).toBe('T1')
  })

  it('retorna null quando não há plano', () => {
    expect(trocaPlanejadaDoLocal([], { id: 'L51' }, 'A')).toBeNull()
  })
})

describe('trocaQueResolveComoOrigem', () => {
  it('encontra a troca onde este local é origem recíproca de outro destino', () => {
    const trocas = [
      { local_id: 'L49', slot: 'A', origem_tipo: 'local', origem_local_id: 'L51', origem_slot: 'A' }
    ]
    const resultado = trocaQueResolveComoOrigem(trocas, { id: 'L51' }, 'A')
    expect(resultado?.local_id).toBe('L49')
  })

  it('não confunde com o local sendo destino (não origem) de um plano', () => {
    const trocas = [
      { local_id: 'L49', slot: 'A', origem_tipo: 'local', origem_local_id: 'L51', origem_slot: 'A' }
    ]
    expect(trocaQueResolveComoOrigem(trocas, { id: 'L49' }, 'A')).toBeNull()
  })

  it('ignora origem de estoque (não é recíproca, não resolve nada do outro lado)', () => {
    const trocas = [
      { local_id: 'L49', slot: 'A', origem_tipo: 'estoque_sci', origem_local_id: null, origem_slot: null, origem_estoque_id: 'E1' }
    ]
    expect(trocaQueResolveComoOrigem(trocas, { id: 'E1' }, 'A')).toBeNull()
  })

  it('retorna null quando não há nenhum plano usando este local como origem', () => {
    expect(trocaQueResolveComoOrigem([], { id: 'L51' }, 'A')).toBeNull()
  })
})
