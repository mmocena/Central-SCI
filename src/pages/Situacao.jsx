import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchTiposExtintor } from '../lib/queries'
import { tipoDivergente } from '../lib/conformidade'
import TabelaSituacao from '../components/TabelaSituacao'

export default function Situacao() {
  const [locais, setLocais] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroSit, setFiltroSit] = useState('todos')
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [tiposExtintor, setTiposExtintor] = useState([])

  useEffect(() => {
    carregar()
    fetchTiposExtintor().then(setTiposExtintor).catch(console.error)
    const channel = supabase
      .channel('situacao-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  function carregar() {
    fetchLocaisComEstado().then(data => { setLocais(data); setLoading(false) })
  }

  // Flatten: uma linha por slot
  const linhas = locais.flatMap(local => {
    const slots = local.local_estado_atual || []
    const temDois = local.tem_slot_a && local.tem_slot_b
    return ['A', 'B']
      .filter(slot => slot === 'A' ? local.tem_slot_a : local.tem_slot_b)
      .map(slot => {
        const estado = slots.find(s => s.slot === slot) || {}
        const descSlot = local[`descricao_slot_${slot.toLowerCase()}`]
        return { local, slot, temDois, descSlot, estado }
      })
  })

  const linhasFiltradas = filtroSit === 'todos'
    ? linhas
    : filtroSit === 'sem_inspecao'
      ? linhas.filter(l => !l.estado.data_ultima_inspecao)
      : filtroSit === 'alerta'
        ? linhas.filter(l => tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido))
        : linhas.filter(l => l.estado.situacao_conformidade === filtroSit)

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const contadores = {
    conforme: linhas.filter(l => l.estado.situacao_conformidade === 'conforme').length,
    alerta: linhas.filter(l => tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido)).length,
    nao_conforme: linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme').length,
    sem_inspecao: linhas.filter(l => !l.estado.data_ultima_inspecao).length,
  }

  const filtroAtivo = filtroSit !== 'todos'

  return (
    <div>

      {/* Barra de contagem + filtro */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">
          {filtroAtivo ? `${linhasFiltradas.length} de ${linhas.length}` : `${linhas.length}`} extintores
        </p>
        <button
          onClick={() => setFiltroAberto(true)}
          className="flex items-center gap-1.5 btn-option py-1.5 px-3 text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtros
          {filtroAtivo && (
            <span className="bg-sci-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">1</span>
          )}
        </button>
      </div>

      <TabelaSituacao linhas={linhasFiltradas} tiposExtintor={tiposExtintor} />

      {/* Bottom sheet de filtros */}
      {filtroAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setFiltroAberto(false)}>
          <div className="w-full bg-white rounded-t-3xl border-t border-sci-border shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sci-text">Filtros</p>
              <div className="flex items-center gap-3">
                {filtroAtivo && (
                  <button onClick={() => setFiltroSit('todos')} className="text-xs text-sci-red font-medium">Limpar</button>
                )}
                <button onClick={() => setFiltroAberto(false)} className="text-sci-muted text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Situação</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'todos',        label: `Todos (${linhas.length})` },
                  { id: 'nao_conforme', label: `Não Conforme (${contadores.nao_conforme})` },
                  { id: 'alerta',       label: `Alerta (${contadores.alerta})` },
                  { id: 'conforme',     label: `Conforme (${contadores.conforme})` },
                  { id: 'sem_inspecao', label: `Sem inspeção (${contadores.sem_inspecao})` },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroSit(f.id)}
                    className={`btn-option text-xs py-1 px-2.5 ${filtroSit === f.id ? 'selected' : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setFiltroAberto(false)} className="btn-primary w-full">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}
