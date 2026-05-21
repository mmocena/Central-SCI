import IconeExtintor from './IconeExtintor'

const SITUACAO = {
  conforme:     { cor: 'text-green-600', bg: 'bg-green-50 border-green-200',  label: 'Conforme' },
  alerta:       { cor: 'text-amber-600', bg: 'bg-amber-50 border-amber-200',  label: 'Alerta' },
  nao_conforme: { cor: 'text-red-600',   bg: 'bg-red-50 border-red-200',      label: 'Não Conforme' }
}

// Cor por tipo de extintor (tipo normalizado para lowercase)
const COR_TIPO = {
  'co²':     { text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  'pqs bc':  { text: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  'pqs abc': { text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  'água':    { text: 'text-fuchsia-700', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
}

function corTipo(tipo) {
  if (!tipo) return null
  return COR_TIPO[tipo.toLowerCase()] ?? { text: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' }
}

function formatarData(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function LocalCard({ local, onClick }) {
  const slots = local.local_estado_atual || []
  const temDoisSlots = local.tem_slot_a && local.tem_slot_b
  const temManutencao = slots.some(s => s.em_manutencao)
  const temReserva = slots.some(s => s.reserva_empresa)

  const ultimaInsp = slots.reduce((acc, s) => {
    if (!s.data_ultima_inspecao) return acc
    if (!acc || s.data_ultima_inspecao > acc.data) {
      return { data: s.data_ultima_inspecao, responsavel: s.responsavel_ultima_inspecao }
    }
    return acc
  }, null)

  const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')
  const plantaCor = corTipo(local.planta_tipo_exigido)

  return (
    <button
      onClick={onClick}
      className="w-full text-left active:scale-[0.99] transition-transform hover:shadow-md bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex"
    >
      {/* Coluna esquerda — badge vermelho altura total */}
      <div className="bg-sci-red flex items-center justify-center gap-1 px-3 shrink-0">
        <IconeExtintor size={22} color="#ffffff" />
        <span className="text-white font-bold text-lg leading-none">{String(local.numero).padStart(2, '0')}</span>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">

        {/* Planta + edificação + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {plantaLabel && plantaCor && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${plantaCor.text} ${plantaCor.bg} ${plantaCor.border}`}>
              {plantaLabel}
            </span>
          )}
          <span className="text-xs text-sci-muted font-medium">{local.edificacao}</span>
          {temManutencao && (
            <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded-full font-medium">
              Manutenção
            </span>
          )}
          {temReserva && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
              RESERVA
            </span>
          )}
        </div>

        {/* Descrição */}
        {local.descricao && (
          <p className="text-sm text-slate-700 leading-snug">{local.descricao}</p>
        )}

        {/* Slots */}
        {slots.length > 0 && (
          <div className="flex flex-col gap-1">
            {['A', 'B'].map(slot => {
              const estado = slots.find(s => s.slot === slot)
              const temSlot = slot === 'A' ? local.tem_slot_a : local.tem_slot_b
              if (!temSlot) return null
              const sitSlot = estado?.situacao_conformidade ? SITUACAO[estado.situacao_conformidade] : null
              const tipoCor = corTipo(estado?.extintor_tipo)
              return (
                <div key={slot} className="flex items-center gap-1 flex-wrap text-xs text-slate-500">
                  {temDoisSlots && (
                    <span className="font-bold text-slate-400">
                      {slot}{local[`descricao_slot_${slot.toLowerCase()}`] ? ` (${local[`descricao_slot_${slot.toLowerCase()}`]})` : ''}:
                    </span>
                  )}
                  {estado?.extintor_tipo ? (
                    <span className={`font-medium px-1.5 py-0.5 rounded border ${tipoCor.text} ${tipoCor.bg} ${tipoCor.border}`}>
                      {estado.extintor_tipo} {estado.extintor_kg}kg
                    </span>
                  ) : null}
                  {sitSlot && (
                    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${sitSlot.bg} ${sitSlot.cor}`}>
                      {sitSlot.label}
                    </span>
                  )}
                  {estado?.motivo_nao_conformidade && (
                    <span className="text-[10px] text-red-500">{estado.motivo_nao_conformidade}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Última inspeção */}
        {ultimaInsp && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <span className="text-green-500">✓</span>
            {formatarData(ultimaInsp.data)} — {ultimaInsp.responsavel}
          </p>
        )}
      </div>
    </button>
  )
}
