// Muitos registros (estado atual, ordens, histórico) guardam só o nome do
// tipo + o número da capacidade, sem a unidade — a unidade mora no catálogo
// tipos_extintor. Esse helper resolve a unidade certa (kg ou L) por nome.
export function unidadeDoTipo(tipo, tiposExtintor) {
  return tiposExtintor?.find(t => t.tipo === tipo)?.unidade || 'kg'
}

export function formatCapacidade(tipo, valor, tiposExtintor) {
  if (valor === null || valor === undefined || valor === '') return null
  return `${valor}${unidadeDoTipo(tipo, tiposExtintor)}`
}
