import { describe, it, expect } from 'vitest'
import { calcularConformidade, motivosNaoConformidade, textoObservacaoAutomatica } from './conformidade'

describe('calcularConformidade', () => {
  it('não operacional é sempre não conforme, mesmo com tudo mais ok', () => {
    expect(calcularConformidade({
      operacional: false,
      sinalizacaoOk: true,
      capExtOk: true,
      tipoAtual: 'CO²',
      tipoExigido: 'CO²'
    })).toBe('nao_conforme')
  })

  it('sinalização não conforme é sempre não conforme, mesmo com tudo mais ok', () => {
    expect(calcularConformidade({
      operacional: true,
      sinalizacaoOk: false,
      capExtOk: true,
      tipoAtual: 'CO²',
      tipoExigido: 'CO²'
    })).toBe('nao_conforme')
  })

  it('não operacional tem prioridade sobre sinalização ok e capacidade ok', () => {
    expect(calcularConformidade({ operacional: false, sinalizacaoOk: true, capExtOk: true })).toBe('nao_conforme')
  })

  describe('caminho dual-slot (capExtOk booleano)', () => {
    it('capExtOk false é não conforme', () => {
      expect(calcularConformidade({ operacional: true, sinalizacaoOk: true, capExtOk: false })).toBe('nao_conforme')
    })

    it('capExtOk true e tipo igual é conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        tipoAtual: 'CO²', tipoExigido: 'CO²'
      })).toBe('conforme')
    })

    it('capExtOk true e tipo divergente é alerta', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        tipoAtual: 'PQS ABC', tipoExigido: 'CO²'
      })).toBe('alerta')
    })
  })

  describe('caminho single-slot (string de capacidade extintora)', () => {
    it('sem exigência de capacidade na planta, só compara tipo', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        tipoAtual: 'CO²', tipoExigido: 'CO²'
      })).toBe('conforme')
    })

    it('capacidade atual abaixo da exigida é não conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '10-B:C', capExtExigida: '20-B:C',
        tipoAtual: 'CO²', tipoExigido: 'CO²'
      })).toBe('nao_conforme')
    })

    it('capacidade atual igual ou superior à exigida é conforme (tipo igual)', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B:C', capExtExigida: '20-B:C',
        tipoAtual: 'CO²', tipoExigido: 'CO²'
      })).toBe('conforme')
    })

    it('capacidade ok mas tipo divergente é alerta', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B:C', capExtExigida: '20-B:C',
        tipoAtual: 'PQS ABC', tipoExigido: 'CO²'
      })).toBe('alerta')
    })

    it('classe C exigida e ausente no atual é não conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B', capExtExigida: '20-B:C',
        tipoAtual: 'CO²', tipoExigido: 'CO²'
      })).toBe('nao_conforme')
    })

    it('sem capacidade atual informada mas exigência existe é não conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '', capExtExigida: '20-B:C'
      })).toBe('nao_conforme')
    })
  })
})

describe('motivosNaoConformidade', () => {
  it('não operacional sem fatores selecionados usa texto genérico', () => {
    expect(motivosNaoConformidade({ operacional: false, fatoresSelecionados: [] }))
      .toEqual(['Extintor não operacional'])
  })

  it('não operacional com fatores selecionados lista os fatores', () => {
    expect(motivosNaoConformidade({ operacional: false, fatoresSelecionados: ['Lacre violado', 'Manômetro zerado'] }))
      .toEqual(['Lacre violado, Manômetro zerado'])
  })

  it('acumula motivos de sinalização, capacidade e tipo divergente juntos', () => {
    const motivos = motivosNaoConformidade({
      operacional: true,
      sinalizacaoOk: false,
      capExtOk: false,
      tipoAtual: 'PQS ABC',
      tipoExigido: 'CO²'
    })
    expect(motivos).toEqual([
      'Sinalização não conforme',
      'Capacidade extintora abaixo do exigido pela planta',
      'Tipo divergente da planta (atual: PQS ABC, exigido: CO²)'
    ])
  })

  it('sem nenhum problema retorna lista vazia', () => {
    expect(motivosNaoConformidade({
      operacional: true, sinalizacaoOk: true, capExtOk: true,
      tipoAtual: 'CO²', tipoExigido: 'CO²'
    })).toEqual([])
  })
})

describe('textoObservacaoAutomatica', () => {
  it('lista vazia gera texto vazio (conforme não precisa de texto)', () => {
    expect(textoObservacaoAutomatica([])).toBe('')
  })

  it('um motivo vira frase terminada em ponto', () => {
    expect(textoObservacaoAutomatica(['Sinalização não conforme'])).toBe('Sinalização não conforme.')
  })

  it('múltiplos motivos são unidos com ". "', () => {
    expect(textoObservacaoAutomatica(['Motivo um', 'Motivo dois'])).toBe('Motivo um. Motivo dois.')
  })
})
