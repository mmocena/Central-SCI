import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado, fetchTiposExtintor, fetchEstoqueDeposito, fetchTrocasPlanejadas, definirTrocaPlanejada, cancelarTrocaPlanejada } from '../lib/queries'
import { separarMotivos, tipoDivergente, textoTipoDivergente } from '../lib/conformidade'
import { locaisNecessitandoTroca, candidatosParaLocal, trocaPlanejadaDoLocal, trocaQueResolveComoOrigem } from '../lib/trocas'
import ModalDetalhesLocal from '../components/ModalDetalhesLocal'
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

function labelCandidatoTopo(c) {
  if (c.tipo !== 'local') return null
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
        {String(c.local.numero).padStart(2, '0')}
      </span>
      <span className="text-[11px] text-slate-600"><strong className="font-semibold">{c.local.edificacao}</strong> -</span>
    </span>
  )
}

function labelCandidatoResto(c) {
  if (c.tipo === 'local') {
    return <>tem {c.tipoOferecido} no lugar de {c.local.planta_tipo_exigido}.</>
  }
  if (c.tipo === 'estoque_reserva') {
    return <>Estoque <span className="text-blue-600 font-medium">RESERVA</span> — {c.estoque.tipo} {c.estoque.kg}kg</>
  }
  return <>Estoque SCI — {c.estoque.tipo} {c.estoque.kg}kg</>
}

function labelTrocaEscolhida(troca) {
  if (troca.origem_tipo === 'local') {
    const l = troca.origem_local
    return l ? `Local #${String(l.numero).padStart(2, '0')} — ${l.edificacao}` : 'Local removido'
  }
  const e = troca.origem_estoque
  if (troca.origem_tipo === 'estoque_reserva') {
    return <>Estoque <span className="text-blue-600 font-medium">RESERVA</span>{e ? ` — ${e.tipo} ${e.kg}kg` : ''}</>
  }
  return e ? `Estoque SCI — ${e.tipo} ${e.kg}kg` : 'Estoque SCI'
}

function ModalInfoTrocas({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sci-text">Sugestões de troca</p>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Quando um extintor tem o <strong>Tipo</strong> errado (ex: PQS BC no lugar de PQS ABC), às vezes dá pra
          resolver com os extintores já disponíveis só trocando com outro local que tenha o tipo certo sobrando, ou
          usando uma unidade disponível no Depósito.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          O sistema sugere de onde esse tipo poderia vir, em ordem de prioridade: primeiro uma <strong>troca recíproca</strong> com
          outro local (que também precisa do que você tem — os dois se resolvem juntos), depois estoque <strong>SCI</strong>, depois
          estoque <strong className="text-blue-600">RESERVA (empresa)</strong>, se houver. A primeira opção listada é a recomendada.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          A sugestão considera só o <strong>Tipo</strong> — sempre confira se a capacidade extintora do candidato também atende
          antes de trocar de verdade.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          Clicar em <strong>Definir</strong> só marca um plano (visível pra todo mundo, em qualquer aparelho) — não troca nada
          sozinho. Depois de fazer a troca física em campo, é preciso registrar uma nova inspeção nos locais envolvidos pra
          atualizar o sistema; o plano some automaticamente quando isso acontece. Pra desistir antes disso, use <strong>Desfazer</strong>.
        </p>
      </div>
    </div>,
    document.body
  )
}

// Sugestões de troca de Tipo pra sanar a necessidade de um local — só
// aparece pra quem está em `necessitando` (capacidade insuficiente por
// tipo errado, ou alerta de tipo divergente puro). É só sugestão: definir
// uma opção só marca um plano, não executa a troca sozinho — depois de
// trocar fisicamente, é preciso registrar uma inspeção nova pra valer.
function SugestoesTroca({ linha, todasLinhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas, responsavel, processando, onDefinir, onCancelar }) {
  const [infoAberto, setInfoAberto] = useState(false)
  const trocaAtual = trocaPlanejadaDoLocal(trocasPlanejadas, linha.local, linha.slot)

  if (trocaAtual) {
    const desfazendo = processando === trocaAtual.id
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-600">
          Troca definida: <strong className="text-slate-700">{labelTrocaEscolhida(trocaAtual)}</strong>
        </span>
        <button
          onClick={() => onCancelar(trocaAtual.id)}
          disabled={desfazendo}
          className="text-xs text-sci-red font-medium shrink-0 disabled:opacity-40"
        >
          {desfazendo ? 'Desfazendo...' : 'Desfazer'}
        </button>
      </div>
    )
  }

  // Troca recíproca resolve os dois lados de uma vez — se este local já é a
  // origem do plano de outro destino, a necessidade dele já está coberta ali.
  // Não mostra nada aqui (nem sugestões, nem aviso) — evita definir a mesma
  // troca 2x sem poluir a tela; desfazer continua disponível pelo card do
  // outro local (o destino).
  const trocaComoOrigem = trocaQueResolveComoOrigem(trocasPlanejadas, linha.local, linha.slot)
  if (trocaComoOrigem) return null

  const candidatos = candidatosParaLocal({ necessitando: linha, linhas: todasLinhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas })

  if (candidatos.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-slate-400 italic">Sem opção de troca disponível no momento.</p>
    )
  }

  const definindo = processando === `${linha.local.id}:${linha.slot}`

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-1">
        <p className="text-[11px] text-slate-400">Sugestões de troca — verifique se a capacidade atende:</p>
        <button
          onClick={() => setInfoAberto(true)}
          aria-label="O que são sugestões de troca?"
          className="shrink-0 w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold flex items-center justify-center hover:border-slate-400 hover:text-slate-500"
        >
          i
        </button>
      </div>
      {candidatos.map((c, i) => (
        <button
          key={c.tipo === 'local' ? `local-${c.local.id}-${c.slot}` : `estoque-${c.estoque.id}`}
          onClick={() => onDefinir(linha, c, responsavel)}
          disabled={definindo}
          className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-left hover:border-slate-300 transition-colors disabled:opacity-40"
        >
          <span className="min-w-0">
            {(i === 0 || c.tipo === 'local') && (
              <p className="flex items-center gap-1.5 flex-wrap">
                {labelCandidatoTopo(c)}
                {i === 0 && <span className="text-[10px] font-bold text-green-600">RECOMENDADO</span>}
              </p>
            )}
            <p className="text-xs text-slate-600">{labelCandidatoResto(c)}</p>
          </span>
          <span className="text-xs font-medium text-sci-red shrink-0">{definindo ? 'Definindo...' : 'Definir'}</span>
        </button>
      ))}
      {infoAberto && <ModalInfoTrocas onClose={() => setInfoAberto(false)} />}
    </div>
  )
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

  // Tipo divergente é um alerta independente da conformidade — aparece aqui
  // sempre que o tipo atual diverge do exigido pela planta, esteja o
  // extintor conforme ou não conforme por outro motivo.
  const linhasTipoDivergente = linhas.filter(l => tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido))

  const linhasVencidoN2 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias < 0
  })
  const linhasVencidoN3 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel3)
    return dias !== null && dias < 0
  })

  // Quem tem chance real de ser resolvido por uma troca de Tipo — capacidade
  // primeiro (mais grave), tipo divergente puro depois. Um local nunca cai
  // nos dois ao mesmo tempo.
  const { capacidade: necessitandoCapacidade, tipo: necessitandoTipo } = locaisNecessitandoTroca(linhas)
  const necessitandoCapacidadeKeys = new Set(necessitandoCapacidade.map(l => `${l.local.id}:${l.slot}`))
  const necessitandoTipoKeys = new Set(necessitandoTipo.map(l => `${l.local.id}:${l.slot}`))

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
      <Bloco
        titulo="Tipo divergente da planta (Alerta)"
        cor="ambar"
        linhas={linhasTipoDivergente}
        onSelecionar={setDetalheAberto}
        detalheExtra={({ local, estado }) => textoTipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido)}
        necessitandoKeys={necessitandoTipoKeys}
        {...trocaProps}
      />

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
