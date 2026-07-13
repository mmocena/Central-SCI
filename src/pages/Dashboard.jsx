import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchLocaisComVencimento, fetchInicioPeriodoInspecao, fetchTiposExtintor } from '../lib/queries'
import ModalDetalhesLocal from '../components/ModalDetalhesLocal'
import ModalListaExtintores from '../components/ModalListaExtintores'

function Stat({ label, valor, cls = 'text-sci-text', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex flex-col items-start gap-0.5 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-left ${onClick ? 'active:scale-[0.98] transition-transform' : ''}`}
    >
      <p className={`text-2xl font-bold leading-none ${cls}`}>{valor}</p>
      <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
    </Tag>
  )
}

function CardVistoria({ total, vistoriados, naoVistoriados, onVerTotal, onVerVistoriados, onVerNaoVistoriados }) {
  const pct = total > 0 ? Math.round((vistoriados / total) * 100) : 0
  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
      <button onClick={onVerTotal} className="w-full flex items-end justify-between text-left active:opacity-70 transition-opacity">
        <div>
          <p className="text-2xl font-bold leading-none text-sci-text">{total}</p>
          <p className="text-[11px] text-slate-500 leading-tight mt-1">Total de extintores</p>
        </div>
        <p className="text-xl font-bold leading-none text-green-600">{pct}%</p>
      </button>

      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
        {vistoriados > 0 && (
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${(vistoriados / total) * 100}%` }} />
        )}
        {naoVistoriados > 0 && (
          <div className="h-full bg-slate-300 rounded-full" style={{ width: `${(naoVistoriados / total) * 100}%` }} />
        )}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <button onClick={onVerVistoriados} className="flex items-center gap-1.5 text-slate-600 active:opacity-70 transition-opacity">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          Vistoriados <strong className="text-sci-text">{vistoriados}</strong>
        </button>
        <button onClick={onVerNaoVistoriados} className="flex items-center gap-1.5 text-slate-600 active:opacity-70 transition-opacity">
          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
          Sem inspeção <strong className="text-sci-text">{naoVistoriados}</strong>
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [locais, setLocais] = useState([])
  const [vencimentos, setVencimentos] = useState([])
  const [inicioPeriodo, setInicioPeriodo] = useState(null)
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalheAberto, setDetalheAberto] = useState(null)
  const [listaAberta, setListaAberta] = useState(null)

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('dashboard-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregar() {
    try {
      const [locaisData, vencData, periodo, tiposData] = await Promise.all([
        fetchLocaisComEstado(),
        fetchLocaisComVencimento(),
        fetchInicioPeriodoInspecao(),
        fetchTiposExtintor()
      ])
      setLocais(locaisData)
      setVencimentos(vencData)
      setInicioPeriodo(periodo)
      setTiposExtintor(tiposData)
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

  const linhasVistoriadas = linhas.filter(l =>
    l.estado.data_ultima_inspecao && (!inicioPeriodo || l.estado.data_ultima_inspecao >= inicioPeriodo)
  )
  const linhasNaoVistoriadas = linhas.filter(l => !linhasVistoriadas.includes(l))
  const linhasConforme = linhas.filter(l => l.estado.situacao_conformidade === 'conforme')
  const linhasAlerta = linhas.filter(l => l.estado.situacao_conformidade === 'alerta')
  const linhasNaoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme')
  const linhasReserva = linhas.filter(l => l.estado.reserva_empresa)
  const emManutencao = linhas.filter(l => l.estado.em_manutencao).length

  // Vencimentos vêm num formato próprio (local + array de vencimentos) — mapeia
  // pra linha correspondente já carregada, reaproveitando o estado completo.
  const linhasVencendo = vencimentos.flatMap(v =>
    v.vencimentos.map(venc => linhas.find(l => l.local.id === v.id && l.slot === venc.slot)).filter(Boolean)
  )

  const total = linhas.length
  const vistoriados = linhasVistoriadas.length
  const naoVistoriados = linhasNaoVistoriadas.length

  const naoConformidades = linhas
    .filter(l => l.estado.situacao_conformidade === 'alerta' || l.estado.situacao_conformidade === 'nao_conforme')
    .sort((a, b) => (a.estado.situacao_conformidade === 'nao_conforme' ? -1 : 1))

  function abrirLista(titulo, linhasFiltradas, cor) {
    setListaAberta({ titulo, linhas: linhasFiltradas, cor })
  }

  return (
    <div className="p-4 space-y-5">

      {/* Extintores */}
      <div className="space-y-3">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Extintores em campo</p>
        <CardVistoria
          total={total}
          vistoriados={vistoriados}
          naoVistoriados={naoVistoriados}
          onVerTotal={() => abrirLista('Extintores em campo', linhas)}
          onVerVistoriados={() => abrirLista('Vistoriados', linhasVistoriadas)}
          onVerNaoVistoriados={() => abrirLista('Sem inspeção', linhasNaoVistoriadas)}
        />
      </div>

      {/* Conformidade */}
      <div className="space-y-3">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Conformidade</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Conforme" valor={linhasConforme.length} cls="text-green-600" onClick={() => abrirLista('Conforme', linhasConforme, 'verde')} />
          <Stat label="Alerta" valor={linhasAlerta.length} cls="text-amber-600" onClick={() => abrirLista('Alerta', linhasAlerta, 'ambar')} />
          <Stat label="Não conforme" valor={linhasNaoConforme.length} cls="text-sci-red" onClick={() => abrirLista('Não conforme', linhasNaoConforme, 'vermelho')} />
        </div>
        <Stat
          label="Vencendo este ano"
          valor={linhasVencendo.length}
          cls={linhasVencendo.length > 0 ? 'text-amber-600' : 'text-sci-text'}
          onClick={() => abrirLista('Vencendo este ano', linhasVencendo, 'ambar')}
        />
      </div>

      {/* Outros indicadores */}
      <div>
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider mb-2">Outros indicadores</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Em manutenção"
            valor={emManutencao}
            cls="text-slate-500"
            onClick={() => navigate('/manutencoes', { state: { aba: 'recebimento' } })}
          />
          <Stat label="RESERVA em campo" valor={linhasReserva.length} cls="text-blue-600" onClick={() => abrirLista('RESERVA em campo', linhasReserva, 'azul')} />
        </div>
      </div>

      {/* Não conformidades atuais */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Não conformidades atuais</p>
          {naoConformidades.length > 0 && (
            <button onClick={() => abrirLista('Não conformidades', naoConformidades)} className="text-xs text-sci-red font-medium">Ver todas</button>
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
                onClick={() => setDetalheAberto({ local, slot, estado })}
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
                  {estado.observacoes && (
                    <p className="text-xs text-slate-400 italic truncate">"{estado.observacoes}"</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {listaAberta && (
        <ModalListaExtintores
          titulo={listaAberta.titulo}
          linhas={listaAberta.linhas}
          cor={listaAberta.cor}
          onClose={() => setListaAberta(null)}
          onSelecionar={item => setDetalheAberto(item)}
        />
      )}

      {detalheAberto && (
        <ModalDetalhesLocal
          local={detalheAberto.local}
          slot={detalheAberto.slot}
          estado={detalheAberto.estado}
          tiposExtintor={tiposExtintor}
          onClose={() => setDetalheAberto(null)}
        />
      )}
    </div>
  )
}
