import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchTiposExtintor } from '../lib/queries'
import { separarMotivos } from '../lib/conformidade'
import ModalDetalhesLocal from '../components/ModalDetalhesLocal'

function diasAte(dateStr) {
  if (!dateStr) return null
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
}

function formatValidadeN2(val) {
  if (!val) return ''
  const [y, m] = val.split('-')
  return `${m}/${y}`
}

function Bloco({ titulo, cor, linhas, onSelecionar, detalheExtra }) {
  const CORES = {
    vermelho: { text: 'text-sci-red', bg: 'bg-red-50', border: 'border-red-200' },
    ambar:    { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  }
  const c = CORES[cor] || CORES.vermelho

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">{titulo}</p>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${c.text} ${c.bg}`}>{linhas.length}</span>
      </div>

      {linhas.length === 0 ? (
        <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-400 text-center">
          Nenhum extintor nesta categoria.
        </div>
      ) : (
        <div className="space-y-2">
          {linhas.map(({ local, slot, estado }) => (
            <button
              key={`${local.id}-${slot}`}
              onClick={() => onSelecionar({ local, slot, estado })}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${c.border} bg-white shadow-sm text-left active:scale-[0.98] transition-transform`}
            >
              <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${c.text} ${c.bg}`}>
                {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
                <p className="text-xs text-slate-400 truncate">
                  {detalheExtra ? detalheExtra({ local, slot, estado }) : (estado.motivo_nao_conformidade || 'Motivo não informado')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NaoConformidades() {
  const [locais, setLocais] = useState([])
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalheAberto, setDetalheAberto] = useState(null)

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('nao-conformidades-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregar() {
    try {
      const [locaisData, tiposData] = await Promise.all([
        fetchLocaisComEstado(),
        fetchTiposExtintor()
      ])
      setLocais(locaisData)
      setTiposExtintor(tiposData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const linhas = locais.flatMap(local => {
    const slots = local.local_estado_atual || []
    return ['A', 'B']
      .filter(slot => slot === 'A' ? local.tem_slot_a : local.tem_slot_b)
      .map(slot => ({ local, slot, estado: slots.find(s => s.slot === slot) || {} }))
  })

  const linhasNaoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme')

  const linhasCapExt = linhasNaoConforme.filter(l => separarMotivos(l.estado.motivo_nao_conformidade).capExt)
  const linhasSinalizacao = linhasNaoConforme.filter(l => separarMotivos(l.estado.motivo_nao_conformidade).sinalizacao)
  const linhasOperacional = linhasNaoConforme.filter(l => separarMotivos(l.estado.motivo_nao_conformidade).operacional)

  // "Tipo divergente" é o alerta de tipo errado COM capacidade extintora
  // atendida — se a capacidade também estiver abaixo do exigido, o problema
  // já é mais grave e pertence só ao bloco de Capacidade extintora. Cobre
  // tanto a situação "alerta" pura quanto um "não conforme" por outro motivo
  // (ex: sinalização) que tenha o tipo divergente junto, desde que a
  // capacidade em si esteja ok.
  const linhasTipoDivergente = linhas.filter(l => {
    if (l.estado.situacao_conformidade === 'alerta') return true
    if (l.estado.situacao_conformidade !== 'nao_conforme') return false
    const m = separarMotivos(l.estado.motivo_nao_conformidade)
    return m.tipoDivergente && !m.capExt
  })

  const linhasVencidoN2 = linhas.filter(l => {
    if (l.estado.em_manutencao) return false
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias < 0
  })
  const linhasVencidoN3 = linhas.filter(l => {
    if (l.estado.em_manutencao) return false
    const dias = diasAte(l.estado.validade_nivel3)
    return dias !== null && dias < 0
  })

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-bold text-sci-text">Não Conformidades</h2>
        <p className="text-xs text-slate-400 mt-0.5">Extintores agrupados por tipo de problema.</p>
      </div>

      <Bloco titulo="Capacidade extintora" cor="vermelho" linhas={linhasCapExt} onSelecionar={setDetalheAberto} />
      <Bloco titulo="Não operacionais (exceto validade)" cor="vermelho" linhas={linhasOperacional} onSelecionar={setDetalheAberto} />
      <Bloco
        titulo="Validade Nível 2 vencida"
        cor="vermelho"
        linhas={linhasVencidoN2}
        onSelecionar={setDetalheAberto}
        detalheExtra={({ estado }) => `Venceu em ${formatValidadeN2(estado.validade_nivel2)}`}
      />
      <Bloco
        titulo="Validade Nível 3 vencida"
        cor="vermelho"
        linhas={linhasVencidoN3}
        onSelecionar={setDetalheAberto}
        detalheExtra={({ estado }) => `Venceu em ${estado.validade_nivel3?.split('-')[0] || ''}`}
      />
      <Bloco titulo="Sinalização" cor="vermelho" linhas={linhasSinalizacao} onSelecionar={setDetalheAberto} />
      <Bloco titulo="Tipo divergente da planta" cor="ambar" linhas={linhasTipoDivergente} onSelecionar={setDetalheAberto} />

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
