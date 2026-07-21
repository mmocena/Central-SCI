import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchTiposExtintor, fetchEstoqueDeposito, fetchTrocasPlanejadas, definirTrocaPlanejada, cancelarTrocaPlanejada } from '../lib/queries'
import { separarMotivos, tipoDivergente } from '../lib/conformidade'
import { locaisNecessitandoTroca, trocaQueResolveComoOrigem } from '../lib/trocas'
import ModalDetalhesLocal from '../components/ModalDetalhesLocal'
import { SugestoesTroca } from '../components/SugestoesTroca'
import { useToast } from '../components/Toast'

const STORAGE_KEY = 'sci_responsavel'

function diasAte(dateStr) {
  if (!dateStr) return null
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
}

function formatValidadeN2(val) {
  if (!val) return ''
  const [y, m] = val.split('-')
  return `${m}/${y}`
}

function Bloco({ titulo, cor, linhas, onSelecionar, detalheExtra, linhaExtra, necessitandoKeys, ...trocaProps }) {
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
          {linhas.map(linha => {
            const { local, slot, estado } = linha
            const mostraSugestao = necessitandoKeys?.has(`${local.id}:${slot}`) &&
              !trocaQueResolveComoOrigem(trocaProps.trocasPlanejadas, local, slot)
            return (
              <div key={`${local.id}-${slot}`} className={`rounded-2xl border ${c.border} bg-white shadow-sm overflow-hidden`}>
                <button
                  onClick={() => onSelecionar({ local, slot, estado })}
                  className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${c.text} ${c.bg}`}>
                    {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {detalheExtra ? detalheExtra({ local, slot, estado }) : (estado.motivo_nao_conformidade || 'Motivo não informado')}
                    </p>
                    {linhaExtra && linhaExtra({ local, slot, estado }) && (
                      <p className="text-xs text-sci-red truncate">{linhaExtra({ local, slot, estado })}</p>
                    )}
                  </div>
                </button>
                {mostraSugestao && (
                  <div className="px-3 pb-3">
                    <SugestoesTroca linha={linha} {...trocaProps} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function NaoConformidades() {
  const showToast = useToast()
  const [locais, setLocais] = useState([])
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [estoque, setEstoque] = useState([])
  const [trocasPlanejadas, setTrocasPlanejadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalheAberto, setDetalheAberto] = useState(null)
  // chave (localId:slot) ou id de troca em andamento — desabilita e mostra
  // feedback imediato no botão clicado, sem esperar o round-trip completo.
  const [processando, setProcessando] = useState(null)

  const responsavel = localStorage.getItem(STORAGE_KEY) || ''

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('nao-conformidades-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas_planejadas' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_deposito' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregar() {
    try {
      const [locaisData, tiposData, estoqueData, trocasData] = await Promise.all([
        fetchLocaisComEstado(),
        fetchTiposExtintor(),
        fetchEstoqueDeposito(),
        fetchTrocasPlanejadas()
      ])
      setLocais(locaisData)
      setTiposExtintor(tiposData)
      setEstoque(estoqueData)
      setTrocasPlanejadas(trocasData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Definir/desfazer só muda trocas_planejadas — recarregar locais/tipos/
  // estoque de novo a cada clique é desperdício e deixa o clique com uma
  // resposta visual lenta. Só a fatia que realmente mudou é recarregada.
  async function recarregarTrocas() {
    try {
      setTrocasPlanejadas(await fetchTrocasPlanejadas())
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDefinir(linha, candidato, responsavelAtual) {
    if (!responsavelAtual) {
      showToast('Informe seu nome na aba Inspeção antes de definir uma troca.', 'erro')
      return
    }
    const chave = `${linha.local.id}:${linha.slot}`
    setProcessando(chave)
    try {
      const resultado = await definirTrocaPlanejada({
        localId: linha.local.id,
        slot: linha.slot,
        origemTipo: candidato.tipo,
        origemLocalId: candidato.tipo === 'local' ? candidato.local.id : null,
        origemSlot: candidato.tipo === 'local' ? candidato.slot : null,
        origemEstoqueId: candidato.tipo !== 'local' ? candidato.estoque.id : null,
        responsavel: responsavelAtual
      })
      showToast(
        resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Troca definida.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await recarregarTrocas()
    } catch (e) {
      showToast('Erro ao definir troca — talvez essa opção já tenha sido escolhida por outro local. ' + e.message, 'erro')
      await recarregarTrocas()
    } finally {
      setProcessando(null)
    }
  }

  async function handleCancelar(id) {
    setProcessando(id)
    try {
      const resultado = await cancelarTrocaPlanejada(id)
      showToast(
        resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Troca desfeita.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await recarregarTrocas()
    } catch (e) {
      showToast('Erro ao desfazer troca: ' + e.message, 'erro')
    } finally {
      setProcessando(null)
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

  const linhasVencidoN2 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias < 0
  })
  const linhasVencidoN3 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel3)
    return dias !== null && dias < 0
  })

  // Quem tem chance real de ser resolvido por uma troca de Tipo (capacidade
  // insuficiente por tipo errado) — a necessidade por tipo divergente puro
  // vive só no modal do alerta na página inicial agora.
  const { capacidade: necessitandoCapacidade } = locaisNecessitandoTroca(linhas)
  const necessitandoCapacidadeKeys = new Set(necessitandoCapacidade.map(l => `${l.local.id}:${l.slot}`))

  const estoqueSCI = estoque.filter(e => e.categoria === 'SCI' && e.operacional)
  const estoqueRESERVA = estoque.filter(e => e.categoria === 'RESERVA' && e.operacional)

  const trocaProps = {
    todasLinhas: linhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas, responsavel, processando,
    onDefinir: handleDefinir, onCancelar: handleCancelar
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-bold text-sci-text">Não Conformidades</h2>
        <p className="text-xs text-slate-400 mt-0.5">Extintores agrupados por tipo de problema.</p>
      </div>

      <Bloco
        titulo="Capacidade extintora"
        cor="vermelho"
        linhas={linhasCapExt}
        onSelecionar={setDetalheAberto}
        necessitandoKeys={necessitandoCapacidadeKeys}
        linhaExtra={({ local, estado }) =>
          tipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido)
            ? `Possui ${estado.extintor_tipo} ao invés de ${local.planta_tipo_exigido}`
            : ''
        }
        {...trocaProps}
      />
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
