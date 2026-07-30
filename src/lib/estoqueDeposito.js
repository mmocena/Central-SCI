// Funções puras de agrupamento do Depósito/Estoque — compartilhadas entre
// Extintores (src/pages/Deposito.jsx) e Mangueiras
// (src/pages/mangueiras/DepositoMangueiras.jsx).

// Um item só aparece no Depósito de um setor se for "dele" ou se tiver sido
// marcado como compartilhado (visível nos dois).
export function visivelNoSetor(item, setor) {
  return item.setor === setor || item.compartilhado
}

// Junta itens operacionais e não operacionais por TIPO+capacidade, somando
// as quantidades de cada lado — base das linhas da TabelaEstoque (SCI).
// setor/compartilhado vêm do lado operacional (ou não operacional, se só
// esse existir) — na prática os dois lados de um mesmo tipo+kg são sempre
// criados no mesmo setor.
export function agruparOperNaoOper(itensOper, itensNaoOper) {
  const porChave = new Map()
  function acumular(itens, campo) {
    itens.forEach(item => {
      const chave = `${item.tipo}|${item.kg}`
      if (!porChave.has(chave)) {
        porChave.set(chave, { tipo: item.tipo, kg: item.kg, oper: 0, naoOper: 0, setor: item.setor, compartilhado: item.compartilhado })
      }
      const linha = porChave.get(chave)
      linha[campo] += item.quantidade
      if (campo === 'oper') { linha.setor = item.setor; linha.compartilhado = item.compartilhado }
    })
  }
  acumular(itensNaoOper, 'naoOper')
  acumular(itensOper, 'oper')
  return [...porChave.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.kg - b.kg)
}

// Agrupa por TIPO+capacidade somando a quantidade — base das linhas da
// TabelaSimples (RESERVA e Outros, que não têm distinção oper./não oper.).
export function agruparSimples(itens) {
  const porChave = new Map()
  itens.forEach(item => {
    const chave = `${item.tipo}|${item.kg}`
    if (!porChave.has(chave)) porChave.set(chave, { tipo: item.tipo, kg: item.kg, qtd: 0, setor: item.setor, compartilhado: item.compartilhado })
    porChave.get(chave).qtd += item.quantidade
  })
  return [...porChave.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.kg - b.kg)
}
