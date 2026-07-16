import { describe, it, expect } from 'vitest'
import { calcularConformidade, motivosNaoConformidade, textoObservacaoAutomatica, separarMotivos, n2Vencida, n3Vencida } from './conformidade'

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

  describe('validade vencida', () => {
    it('N2 vencido é sempre não conforme, mesmo com tudo mais ok', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        tipoAtual: 'CO²', tipoExigido: 'CO²',
        validadeNivel2: '2020-01'
      })).toBe('nao_conforme')
    })

    it('N3 vencido é sempre não conforme, mesmo com tudo mais ok', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        tipoAtual: 'CO²', tipoExigido: 'CO²',
        validadeNivel3: '2020'
      })).toBe('nao_conforme')
    })

    it('N2/N3 no futuro não afeta conformidade', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        tipoAtual: 'CO²', tipoExigido: 'CO²',
        validadeNivel2: '2099-01', validadeNivel3: '2099'
      })).toBe('conforme')
    })
  })
})

describe('n2Vencida / n3Vencida', () => {
  it('sem validade informada não é vencida', () => {
    expect(n2Vencida(null)).toBe(false)
    expect(n2Vencida('')).toBe(false)
    expect(n3Vencida(null)).toBe(false)
    expect(n3Vencida('')).toBe(false)
  })

  it('n2Vencida aceita formato de input (YYYY-MM) e formato salvo (YYYY-MM-DD)', () => {
    expect(n2Vencida('2020-01')).toBe(true)
    expect(n2Vencida('2020-01-01')).toBe(true)
    expect(n2Vencida('2099-01')).toBe(false)
    expect(n2Vencida('2099-01-01')).toBe(false)
  })

  it('n3Vencida aceita formato de input (YYYY) e formato salvo (YYYY-12-01)', () => {
    expect(n3Vencida('2020')).toBe(true)
    expect(n3Vencida('2020-12-01')).toBe(true)
    expect(n3Vencida('2099')).toBe(false)
    expect(n3Vencida('2099-12-01')).toBe(false)
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

  it('validade N2 vencida gera motivo próprio, antes dos demais', () => {
    expect(motivosNaoConformidade({ operacional: true, sinalizacaoOk: true, validadeNivel2: '2020-01' }))
      .toEqual(['Validade Nível 2 vencida'])
  })

  it('validade N3 vencida gera motivo próprio', () => {
    expect(motivosNaoConformidade({ operacional: true, sinalizacaoOk: true, validadeNivel3: '2020' }))
      .toEqual(['Validade Nível 3 vencida'])
  })

  it('N2 e N3 vencidos juntos com outro problema geram todos os motivos', () => {
    expect(motivosNaoConformidade({
      operacional: false, fatoresSelecionados: [],
      validadeNivel2: '2020-01', validadeNivel3: '2020'
    })).toEqual(['Validade Nível 2 vencida', 'Validade Nível 3 vencida', 'Extintor não operacional'])
  })
})

describe('separarMotivos', () => {
  const VAZIO = { capExt: false, sinalizacao: false, tipoDivergente: false, validadeN2: false, validadeN3: false, operacional: false }

  it('motivo vazio/nulo não marca nenhuma categoria', () => {
    expect(separarMotivos(null)).toEqual(VAZIO)
    expect(separarMotivos('')).toEqual(VAZIO)
  })

  it('reconhece capacidade extintora isolada', () => {
    expect(separarMotivos('Capacidade extintora abaixo do exigido pela planta'))
      .toEqual({ ...VAZIO, capExt: true })
  })

  it('reconhece sinalização isolada', () => {
    expect(separarMotivos('Sinalização não conforme'))
      .toEqual({ ...VAZIO, sinalizacao: true })
  })

  it('reconhece tipo divergente isolado, sem marcar operacional', () => {
    expect(separarMotivos('Tipo divergente da planta (atual: PQS ABC, exigido: CO²)'))
      .toEqual({ ...VAZIO, tipoDivergente: true })
  })

  it('reconhece validade N2/N3 vencida isoladas, sem marcar operacional', () => {
    expect(separarMotivos('Validade Nível 2 vencida')).toEqual({ ...VAZIO, validadeN2: true })
    expect(separarMotivos('Validade Nível 3 vencida')).toEqual({ ...VAZIO, validadeN3: true })
  })

  it('fatores de não operacionalidade (texto livre) marcam operacional', () => {
    expect(separarMotivos('Lacre violado, Manômetro zerado'))
      .toEqual({ ...VAZIO, operacional: true })
  })

  it('combina várias categorias no mesmo motivo', () => {
    const motivo = 'Validade Nível 2 vencida, Lacre violado, Manômetro zerado, Sinalização não conforme, Capacidade extintora abaixo do exigido pela planta'
    expect(separarMotivos(motivo)).toEqual({ ...VAZIO, capExt: true, sinalizacao: true, validadeN2: true, operacional: true })
  })

  it('cap.ext + tipo divergente juntos não marca operacional (regressão do bug de regex global)', () => {
    const motivo = 'Capacidade extintora abaixo do exigido pela planta, Tipo divergente da planta (atual: PQS ABC, exigido: CO²)'
    expect(separarMotivos(motivo)).toEqual({ ...VAZIO, capExt: true, tipoDivergente: true })
    // chamar duas vezes seguidas garante que o regex sem flag "g" não guarda lastIndex entre chamadas
    expect(separarMotivos(motivo).tipoDivergente).toBe(true)
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
