import { describe, it, expect } from 'vitest'
import { candidatosParaCci, trocasPlanejadasParaCci } from './trocasMangueira'

const TIPO_4 = 'tipo-4'

function cci({ id, situacao }) {
  return { id, situacao }
}

function mangueira({ id, identificacao, tipoMangueiraId = TIPO_4, localizacaoTipo, cciId = null }) {
  return { id, identificacao, tipo_mangueira_id: tipoMangueiraId, localizacao_tipo: localizacaoTipo, cci_id: cciId }
}

describe('candidatosParaCci', () => {
  it('depósito vem antes de CCI RT com sobra', () => {
    const todosCcis = [cci({ id: 'linha', situacao: 'LINHA' }), cci({ id: 'rt', situacao: 'RT' })]
    const todasMangueiras = [
      mangueira({ id: 'm-dep', identificacao: 'H1', localizacaoTipo: 'DEPOSITO' }),
      mangueira({ id: 'm-rt-1', identificacao: 'H2', localizacaoTipo: 'CCI', cciId: 'rt' })
    ]
    const dotacaoPorCci = { rt: [{ tipo_mangueira_id: TIPO_4, quantidade_exigida: 0 }] }

    const candidatos = candidatosParaCci({ cciDestinoId: 'linha', tipoMangueiraId: TIPO_4, todosCcis, todasMangueiras, dotacaoPorCci, trocasPlanejadas: [] })

    expect(candidatos).toHaveLength(2)
    expect(candidatos[0]).toMatchObject({ tipo: 'deposito', mangueira: { id: 'm-dep' } })
    expect(candidatos[1]).toMatchObject({ tipo: 'cci_rt', mangueira: { id: 'm-rt-1' } })
  })

  it('nunca oferece CCI em LINHA como origem', () => {
    const todosCcis = [cci({ id: 'linha-destino', situacao: 'LINHA' }), cci({ id: 'linha-outro', situacao: 'LINHA' })]
    const todasMangueiras = [mangueira({ id: 'm1', identificacao: 'H1', localizacaoTipo: 'CCI', cciId: 'linha-outro' })]
    const dotacaoPorCci = {}

    const candidatos = candidatosParaCci({ cciDestinoId: 'linha-destino', tipoMangueiraId: TIPO_4, todosCcis, todasMangueiras, dotacaoPorCci, trocasPlanejadas: [] })

    expect(candidatos).toEqual([])
  })

  it('CCI RT sem sobra (dotação cobre tudo que tem) não aparece', () => {
    const todosCcis = [cci({ id: 'linha', situacao: 'LINHA' }), cci({ id: 'rt', situacao: 'RT' })]
    const todasMangueiras = [mangueira({ id: 'm1', identificacao: 'H1', localizacaoTipo: 'CCI', cciId: 'rt' })]
    const dotacaoPorCci = { rt: [{ tipo_mangueira_id: TIPO_4, quantidade_exigida: 1 }] }

    const candidatos = candidatosParaCci({ cciDestinoId: 'linha', tipoMangueiraId: TIPO_4, todosCcis, todasMangueiras, dotacaoPorCci, trocasPlanejadas: [] })

    expect(candidatos).toEqual([])
  })

  it('mangueira já reivindicada por outro plano some da lista', () => {
    const todosCcis = [cci({ id: 'linha', situacao: 'LINHA' })]
    const todasMangueiras = [mangueira({ id: 'm-dep', identificacao: 'H1', localizacaoTipo: 'DEPOSITO' })]
    const trocasPlanejadas = [{ id: 'plano-1', cci_destino_id: 'outro-cci', mangueira_id: 'm-dep' }]

    const candidatos = candidatosParaCci({ cciDestinoId: 'linha', tipoMangueiraId: TIPO_4, todosCcis, todasMangueiras, dotacaoPorCci: {}, trocasPlanejadas })

    expect(candidatos).toEqual([])
  })

  it('respeita tipo de mangueira — não mistura tipos diferentes', () => {
    const todosCcis = [cci({ id: 'linha', situacao: 'LINHA' })]
    const todasMangueiras = [mangueira({ id: 'm-dep', identificacao: 'H1', tipoMangueiraId: 'tipo-2', localizacaoTipo: 'DEPOSITO' })]

    const candidatos = candidatosParaCci({ cciDestinoId: 'linha', tipoMangueiraId: TIPO_4, todosCcis, todasMangueiras, dotacaoPorCci: {}, trocasPlanejadas: [] })

    expect(candidatos).toEqual([])
  })
})

describe('trocasPlanejadasParaCci', () => {
  it('filtra só os planos com este CCI como destino', () => {
    const trocasPlanejadas = [
      { id: 'p1', cci_destino_id: 'cci-a' },
      { id: 'p2', cci_destino_id: 'cci-b' }
    ]
    expect(trocasPlanejadasParaCci(trocasPlanejadas, 'cci-a')).toEqual([{ id: 'p1', cci_destino_id: 'cci-a' }])
  })
})
