// Cor por tipo de extintor (tipo normalizado para lowercase) — compartilhada
// entre LocalCard (badge de tipo) e a tabela do Depósito (fundo da linha).
const COR_TIPO = {
  'co²':     { text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  'pqs bc':  { text: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  'pqs abc': { text: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  'água':    { text: 'text-fuchsia-700', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
}

export function corTipo(tipo) {
  if (!tipo) return null
  return COR_TIPO[tipo.toLowerCase()] ?? { text: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' }
}
