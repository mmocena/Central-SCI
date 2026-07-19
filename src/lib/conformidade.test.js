import { describe, it, expect } from 'vitest'
import { calcularConformidade, motivosNaoConformidade, textoObservacaoAutomatica, separarMotivos, fatoresOperacionaisDoMotivo, n2Vencida, n3Vencida, tipoDivergente, textoTipoDivergente } from './conformidade'

describe('calcularConformidade', () => {
  it('só existem duas situações possíveis: conforme e nao_conforme', () => {
    expect(calcularConformidade({ operacional: true, sinalizacaoOk: true, capExtOk: true })).toBe('conforme')
    expect(calcularConformidade({ operacional: false, sinalizacaoOk: true, capExtOk: true })).toBe('nao_conforme')
  })

  it('não operacional é sempre não conforme, mesmo com tudo mais ok', () => {
    expect(calcularConformidade({
      operacional: false,
      sinalizacaoOk: true,
      capExtOk: true
    })).toBe('nao_conforme')
  })

  it('sinalização não conforme é sempre não conforme, mesmo com tudo mais ok', () => {
    expect(calcularConformidade({
      operacional: true,
      sinalizacaoOk: false,
      capExtOk: true
    })).toBe('nao_conforme')
  })

  it('não operacional tem prioridade sobre sinalização ok e capacidade ok', () => {
    expect(calcularConformidade({ operacional: false, sinalizacaoOk: true, capExtOk: true })).toBe('nao_conforme')
  })

  describe('caminho dual-slot (capExtOk booleano)', () => {
    it('capExtOk false é não conforme', () => {
      expect(calcularConformidade({ operacional: true, sinalizacaoOk: true, capExtOk: false })).toBe('nao_conforme')
    })

    it('capExtOk true é conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true
      })).toBe('conforme')
    })

    it('capExtOk true com tipo divergente continua conforme (tipo divergente não é não conformidade)', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true
      })).toBe('conforme')
    })
  })

  describe('caminho single-slot (string de capacidade extintora)', () => {
    it('sem exigência de capacidade na planta é conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true
      })).toBe('conforme')
    })

    it('capacidade atual abaixo da exigida é não conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '10-B:C', capExtExigida: '20-B:C'
      })).toBe('nao_conforme')
    })

    it('capacidade atual igual ou superior à exigida é conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B:C', capExtExigida: '20-B:C'
      })).toBe('conforme')
    })

    it('capacidade ok mas tipo divergente continua conforme (tipo divergente não é não conformidade)', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B:C', capExtExigida: '20-B:C'
      })).toBe('conforme')
    })

    it('classe C exigida e ausente no atual é não conforme', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true,
        capExtAtual: '20-B', capExtExigida: '20-B:C'
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
        validadeNivel2: '2020-01'
      })).toBe('nao_conforme')
    })

    it('N3 vencido é sempre não conforme, mesmo com tudo mais ok', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        validadeNivel3: '2020'
      })).toBe('nao_conforme')
    })

    it('N2/N3 no futuro não afeta conformidade', () => {
      expect(calcularConformidade({
        operacional: true, sinalizacaoOk: true, capExtOk: true,
        validadeNivel2: '2099-01', validadeNivel3: '2099'
      })).toBe('conforme')
    })
  })
})

describe('tipoDivergente / textoTipoDivergente', () => {
  it('tipos iguais não é divergente', () => {
    expect(tipoDivergente('CO²', 'CO²')).toBe(false)
    expect(textoTipoDivergente('CO²', 'CO²')).toBe('')
  })

  it('tipos diferentes é divergente, com texto formatado', () => {
    expect(tipoDivergente('PQS ABC', 'CO²')).toBe(true)
    expect(textoTipoDivergente('PQS ABC', 'CO²')).toBe('Tipo divergente da planta (atual: PQS ABC, exigido: CO²).')
  })

  it('sem tipo exigido na planta não é divergente', () => {
    expect(tipoDivergente('CO²', undefined)).toBe(false)
    expect(textoTipoDivergente('CO²', undefined)).toBe('')
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

  it('acumula motivos de sinalização e capacidade juntos', () => {
    const motivos = motivosNaoConformidade({
      operacional: true,
      sinalizacaoOk: false,
      capExtOk: false
    })
    expect(motivos).toEqual([
      'Sinalização não conforme',
      'Capacidade extintora abaixo do exigido pela planta'
    ])
  })

  it('tipo divergente nunca aparece em motivosNaoConformidade (só em Observações via textoTipoDivergente)', () => {
    const motivos = motivosNaoConformidade({
      operacional: true, sinalizacaoOk: true, capExtOk: true
    })
    expect(motivos).toEqual([])
  })

  it('sem nenhum problema retorna lista vazia', () => {
    expect(motivosNaoConformidade({
      operacional: true, sinalizacaoOk: true, capExtOk: true
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

describe('fatoresOperacionaisDoMotivo', () => {
  it('motivo vazio/nulo não retorna fatores', () => {
    expect(fatoresOperacionaisDoMotivo(null)).toEqual([])
    expect(fatoresOperacionaisDoMotivo('')).toEqual([])
  })

  it('separa um único fator', () => {
    expect(fatoresOperacionaisDoMotivo('Etiqueta de inspeção ausente ou ilegível'))
      .toEqual(['Etiqueta de inspeção ausente ou ilegível'])
  })

  it('separa múltiplos fatores por vírgula', () => {
    expect(fatoresOperacionaisDoMotivo('Lacre violado, Manômetro zerado'))
      .toEqual(['Lacre violado', 'Manômetro zerado'])
  })

  it('remove as categorias fixas e mantém só os fatores de texto livre', () => {
    const motivo = 'Validade Nível 2 vencida, Lacre violado, Manômetro zerado, Sinalização não conforme'
    expect(fatoresOperacionaisDoMotivo(motivo)).toEqual(['Lacre violado', 'Manômetro zerado'])
  })

  it('motivo só com categorias fixas não retorna fatores', () => {
    expect(fatoresOperacionaisDoMotivo('Sinalização não conforme')).toEqual([])
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
