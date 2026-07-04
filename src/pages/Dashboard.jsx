import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchLocaisComVencimento } from '../lib/queries'

function Stat({ label, valor, cls = 'text-sci-text', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-left ${onClick ? 'active:scale-[0.98] transition-transform' : ''}`}
    >
      <p className={`text-2xl font-bold leading-none ${cls}`}>{valor}</p>
      <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
    </Tag>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [locais, setLocais] = useState([])
  const [vencimentos, setVencimentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('dashboard-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregar() {
    try {
      const [locaisData, vencData] = await Promise.all([
        fetchLocaisComEstado(),
        fetchLocaisComVencimento()
      ])
      setLocais(locaisData)
      setVencimentos(vencData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  // Uma linha por slot, igual à página Situação
  const linhas = locais.flatMap(local => {
    const slots = local.local_estado_atual || []
    return ['A', 'B']
      .filter(slot => slot === 'A' ? local.tem_slot_a : local.tem_slot_b)
      .map(slot => ({ local, slot, estado: slots.find(s => s.slot === slot) || {} }))
  })

  const total = linhas.length
  const vistoriados = linhas.filter(l => l.estado.data_ultima_inspecao).length
  const naoVistoriados = total - vistoriados
  const conforme = linhas.filter(l => l.estado.situacao_conformidade === 'conforme').length
  const alerta = linhas.filter(l => l.estado.situacao_conformidade === 'alerta').length
  const naoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme').length
  const emManutencao = linhas.filter(l => l.estado.em_manutencao).length
  const reserva = linhas.filter(l => l.estado.reserva_empresa).length

  const naoConformidades = linhas
    .filter(l => l.estado.situacao_conformidade === 'alerta' || l.estado.situacao_conformidade === 'nao_conforme')
    .sort((a, b) => (a.estado.situacao_conformidade === 'nao_conforme' ? -1 : 1))

  return (
    <div className="p-4 space-y-5">

      {/* Extintores */}
      <div>
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider mb-2">Extintores</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total de extintores" valor={total} onClick={() => navigate('/situacao')} />
          <Stat label="Vistoriados" valor={vistoriados} cls="text-green-600" onClick={() => navigate('/situacao')} />
          <Stat label="Sem inspeção" valor={naoVistoriados} cls={naoVistoriados > 0 ? 'text-amber-600' : 'text-sci-text'} onClick={() => navigate('/situacao')} />
          <Stat label="Em manutenção" valor={emManutencao} cls="text-slate-500" onClick={() => navigate('/manutencoes')} />
        </div>
      </div>

      {/* Conformidade */}
      <div>
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider mb-2">Conformidade</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Conforme" valor={conforme} cls="text-green-600" onClick={() => navigate('/situacao')} />
          <Stat label="Alerta" valor={alerta} cls="text-amber-600" onClick={() => navigate('/situacao')} />
          <Stat label="Não conforme" valor={naoConforme} cls="text-sci-red" onClick={() => navigate('/situacao')} />
        </div>
      </div>

      {/* Outros indicadores */}
      <div>
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider mb-2">Outros indicadores</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="RESERVA em campo" valor={reserva} cls="text-blue-600" onClick={() => navigate('/manutencoes')} />
          <Stat label="Vencendo este ano" valor={vencimentos.length} cls={vencimentos.length > 0 ? 'text-amber-600' : 'text-sci-text'} onClick={() => navigate('/situacao')} />
        </div>
      </div>

      {/* Não conformidades atuais */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Não conformidades atuais</p>
          {naoConformidades.length > 0 && (
            <button onClick={() => navigate('/situacao')} className="text-xs text-sci-red font-medium">Ver todas</button>
          )}
        </div>

        {naoConformidades.length === 0 ? (
          <div className="p-4 rounded-2xl border border-green-200 bg-green-50 text-sm text-green-700 text-center">
            Nenhuma não conformidade registrada.
          </div>
        ) : (
          <div className="space-y-2">
            {naoConformidades.slice(0, 6).map(({ local, slot, estado }) => (
              <button
                key={`${local.id}-${slot}`}
                onClick={() => navigate('/situacao')}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border bg-white shadow-sm text-left active:scale-[0.98] transition-transform"
                style={{ borderColor: estado.situacao_conformidade === 'nao_conforme' ? '#fecaca' : '#fde68a' }}
              >
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                  estado.situacao_conformidade === 'nao_conforme'
                    ? 'text-sci-red bg-red-50'
                    : 'text-amber-700 bg-amber-50'
                }`}>
                  {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
                  <p className="text-xs text-slate-400 truncate">{estado.motivo_nao_conformidade || 'Motivo não informado'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
