import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  fetchLocaisComEstado, fetchInicioPeriodoInspecao, fetchTiposExtintor, fetchOrdensPendentes,
  fetchEstoqueDeposito, fetchTrocasPlanejadas, definirTrocaPlanejada, cancelarTrocaPlanejada
} from '../lib/queries'
import { tipoDivergente, textoTipoDivergente } from '../lib/conformidade'
import { locaisNecessitandoTroca, origensRecomendadasParaCapacidade } from '../lib/trocas'
import { unidadeDoTipo } from '../lib/formato'
import { corTipo } from '../lib/coresTipo'
import ModalDetalhesLocal from '../components/ModalDetalhesLocal'
import ModalListaExtintores from '../components/ModalListaExtintores'
import ModalAlertaTipoDivergente from '../components/ModalAlertaTipoDivergente'
import ModalLocal from '../components/ModalLocal'
import TabelaSituacao from '../components/TabelaSituacao'
import { useToast } from '../components/Toast'

const STORAGE_KEY = 'sci_responsavel'

// rotulo (ex: "Ver") é só a indicação visual de que o card inteiro é
// clicável — texto puro, sem pill/borda, na cor do próprio indicador.
function Stat({ label, valor, cls = 'text-sci-text', rotulo, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex flex-col items-start gap-0.5 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-left ${onClick ? 'active:scale-[0.98] transition-transform' : ''}`}
    >
      <div className="w-full flex items-start justify-between gap-2">
        <p className={`text-2xl font-bold leading-none ${cls}`}>{valor}</p>
        {rotulo && <span className={`shrink-0 text-xs font-medium ${cls}`}>{rotulo}</span>}
      </div>
      <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
    </Tag>
  )
}

// Card maior que reúne todos os alertas (tipo divergente + validades
// vencendo em breve) em grupos — cada grupo abre sua própria lista.
function CardAlertas({ grupos, onVerGrupo }) {
  const totalUnico = new Set(
    grupos.flatMap(g => g.linhas).map(l => `${l.local.id}-${l.slot}`)
  ).size

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold leading-none text-amber-600">{totalUnico}</p>
        <p className="text-[11px] text-slate-500 leading-tight">Alertas</p>
      </div>
      <div className="divide-y divide-slate-100">
        {grupos.map(g => (
          <button
            key={g.titulo}
            onClick={() => onVerGrupo(g)}
            className="w-full flex items-center justify-between py-2.5 text-left active:opacity-70 transition-opacity"
          >
            <span className="text-sm text-slate-600">{g.titulo}</span>
            <span className="flex items-baseline gap-2.5">
              <span className={`text-sm font-bold ${g.linhas.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                {g.linhas.length}
              </span>
              <span className="text-xs text-slate-300">Ver</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function diasAte(dateStr) {
  if (!dateStr) return null
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
}

function formatValidadeN2(val) {
  if (!val) return ''
  const [y, m] = val.split('-')
  return `${m}/${y}`
}

function CardVistoria({ total, vistoriados, naoVistoriados, onVerTotal, onVerVistoriados, onVerNaoVistoriados }) {
  const pct = total > 0 ? Math.round((vistoriados / total) * 100) : 0
  return (
    <div className="w-full lg:flex-1 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
      <button onClick={onVerTotal} className="w-full flex items-center justify-between text-left active:opacity-70 transition-opacity">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold leading-none text-sci-text">{total}</p>
          <p className="text-[11px] text-slate-500 leading-tight">Total de extintores</p>
        </div>
        <p className="text-xl font-bold leading-none text-green-600">{pct}%</p>
      </button>

      {/* Cada segmento arredonda dos dois lados; o espacinho entre eles
          deixa vazar o cinza bem clarinho do fundo (bg-slate-100). */}
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

// Só em telas lg+: anel de conformidade (situação atual, não período) —
// verde/vermelho sempre, cinza (não vistoriados) só enquanto nem todos os
// extintores tiverem sido vistoriados ao menos uma vez nesse período.
// Arco de 180° (formato "(" deitado, tipo velocímetro) em vez do anel
// fechado — largura dobrada, mesma altura do anel anterior.
// vertical: arco "de pé" tipo ")" (usado no mobile, pra ocupar menos
// largura) em vez do arco deitado "⌢" tipo velocímetro (desktop, lg+).
function AnelConformidade({ conforme, naoConforme, naoVistoriados, onVerConforme, onVerNaoConforme, onVerNaoVistoriados, vertical = false }) {
  const total = conforme + naoConforme + naoVistoriados
  const raio = 82
  const circunferencia = 2 * Math.PI * raio
  // Mais de 180° pra ficar mais "oval": as duas pontas curvam pra dentro,
  // ficando mais perto uma da outra, em vez de pararem exatamente na
  // linha do centro (180° exatos = pontas nos "cantos").
  const anguloArco = 190
  const circunferenciaVisivel = circunferencia * (anguloArco / 360)
  const pctConforme = total > 0 ? Math.round((conforme / total) * 100) : 0

  // Deitado: viewBox 200x125, centro (100,100), abre pra cima (efetivo
  // centrado em 270°). De pé: viewBox 128x200, centro (28,100), abre pra
  // direita (efetivo centrado em 0°/360°) — mesma matemática do arco, só
  // o centro/viewBox/rotação mudam. As dimensões extras (altura no
  // deitado, largura no de pé) dão espaço pras pontas que agora avançam
  // um pouco além da linha reta do meio.
  const cx = vertical ? 28 : 100
  const cy = 100
  const rotacao = (vertical ? 0 : -90) - anguloArco / 2

  const segmentos = [
    { valor: conforme, cor: '#22c55e' },
    { valor: naoConforme, cor: '#dc2626' },
    ...(naoVistoriados > 0 ? [{ valor: naoVistoriados, cor: '#cbd5e1' }] : []),
  ]
  // Cada segmento arredonda dos dois lados (strokeLinecap="round"); um
  // vãozinho entre eles (subtraído do fim de cada um, exceto o último)
  // deixa vazar o cinza bem clarinho da trilha de fundo — igual ao de
  // barras (gap-0.5 + rounded-full nos dois lados).
  const espessura = 12
  // strokeLinecap="round" faz cada ponta do traço abaular pra fora em
  // espessura/2 — o vão precisa ser maior que espessura (as duas pontas
  // arredondadas somadas) pra elas não se encontrarem/sobreporem. O "+ 4"
  // vira o vão VISÍVEL de fato — convertido pra bater com os mesmos ~2px
  // reais do gap-0.5 do de barras, considerando a escala local->físico de
  // cada orientação (unidades do viewBox nem sempre é 1:1 com pixel).
  const escalaLocal = vertical ? 82 / 128 : 162 / 200
  const vaoVisivelPx = 2
  const vaoArco = espessura + vaoVisivelPx / escalaLocal
  const segmentosComValor = segmentos.filter(s => s.valor > 0)
  let acumulado = 0
  const arcos = segmentosComValor.map((s, i) => {
    const tamanhoTotal = total > 0 ? (s.valor / total) * circunferenciaVisivel : 0
    const ehUltimo = i === segmentosComValor.length - 1
    const dash = Math.max(0, tamanhoTotal - (ehUltimo ? 0 : vaoArco))
    const arco = { ...s, dash, offset: acumulado }
    acumulado += tamanhoTotal
    return arco
  })

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center gap-5">
      <div className={`relative shrink-0 ${vertical ? 'w-[82px] h-[128px]' : 'w-[162px] pb-2'}`}>
        <svg viewBox={vertical ? '0 0 128 200' : '0 0 200 125'} className={vertical ? 'w-[82px] h-[128px]' : 'w-[162px] h-[93px]'}>
          {/* rotate no <g>, pivotado no centro real do círculo (cx,cy) —
              rotacionar o <svg> inteiro giraria em torno do centro do
              viewport, que não coincide com o centro do arco */}
          <g transform={`rotate(${rotacao} ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={raio} fill="none" stroke="#f1f5f9" strokeWidth={espessura} strokeLinecap="round" strokeDasharray={`${circunferenciaVisivel} ${circunferencia}`} />
            {arcos.map((a, i) => a.valor > 0 && (
              <circle
                key={i}
                cx={cx} cy={cy} r={raio}
                fill="none"
                stroke={a.cor}
                strokeWidth={espessura}
                strokeLinecap="round"
                strokeDasharray={`${a.dash} ${circunferencia - a.dash}`}
                strokeDashoffset={-a.offset}
              />
            ))}
          </g>
        </svg>
        <div className={vertical ? 'absolute inset-0 flex flex-col items-start justify-center pl-1' : 'absolute inset-0 flex flex-col items-center justify-end pb-4'}>
          <p className="text-lg font-bold leading-none text-sci-text">{pctConforme}%</p>
          <p className="text-[10px] text-slate-400 leading-tight">conforme</p>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2 text-xs pt-2">
        <button onClick={onVerConforme} className="w-full flex items-center justify-between text-left active:opacity-70 transition-opacity">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Conforme
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <strong className="text-sci-text w-4 text-right">{conforme}</strong>
            <span className="w-px h-3 bg-slate-200" />
            <span className="w-16 text-green-600/70 font-medium">Ver lista</span>
          </span>
        </button>
        <button onClick={onVerNaoConforme} className="w-full flex items-center justify-between text-left active:opacity-70 transition-opacity">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-sci-red shrink-0" />
            Não conforme
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <strong className="text-sci-text w-4 text-right">{naoConforme}</strong>
            <span className="w-px h-3 bg-slate-200" />
            <span className="w-16 text-sci-red/70 font-medium">Gerenciar</span>
          </span>
        </button>
        {naoVistoriados > 0 && (
          <button onClick={onVerNaoVistoriados} className="w-full flex items-center justify-between text-left active:opacity-70 transition-opacity">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              Não vistoriados
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <strong className="text-slate-500 w-4 text-right">{naoVistoriados}</strong>
              <span className="w-px h-3 bg-slate-200" />
              <span className="w-16 text-slate-500/70 font-medium">Ver lista</span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [locais, setLocais] = useState([])
  const [inicioPeriodo, setInicioPeriodo] = useState(null)
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [ordensPendentes, setOrdensPendentes] = useState([])
  const [estoque, setEstoque] = useState([])
  const [trocasPlanejadas, setTrocasPlanejadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalheAberto, setDetalheAberto] = useState(null)
  const [listaAberta, setListaAberta] = useState(null)
  const [substituindoLocal, setSubstituindoLocal] = useState(null)
  const [tipoDivergenteAberto, setTipoDivergenteAberto] = useState(false)
  const [manutencaoAberta, setManutencaoAberta] = useState(false)
  // chave (localId:slot) ou id de troca em andamento — desabilita e mostra
  // feedback imediato no botão clicado, sem esperar o round-trip completo.
  const [processando, setProcessando] = useState(null)

  const responsavel = localStorage.getItem(STORAGE_KEY) || ''

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('dashboard-estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_manutencao' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas_planejadas' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_deposito' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregar() {
    try {
      const [locaisData, periodo, tiposData, ordensData, estoqueData, trocasData] = await Promise.all([
        fetchLocaisComEstado(),
        fetchInicioPeriodoInspecao(),
        fetchTiposExtintor(),
        fetchOrdensPendentes(),
        fetchEstoqueDeposito(),
        fetchTrocasPlanejadas()
      ])
      setLocais(locaisData)
      setInicioPeriodo(periodo)
      setTiposExtintor(tiposData)
      setOrdensPendentes(ordensData)
      setEstoque(estoqueData)
      setTrocasPlanejadas(trocasData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Definir/desfazer só muda trocas_planejadas — recarregar tudo de novo a
  // cada clique é desperdício e deixa a resposta visual lenta.
  async function recarregarTrocas() {
    try {
      setTrocasPlanejadas(await fetchTrocasPlanejadas())
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDefinirTroca(linha, candidato, responsavelAtual) {
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

  async function handleCancelarTroca(id) {
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

  // Uma linha por slot, igual à página Situação (mesmo formato de linha,
  // reaproveitado por TabelaSituacao)
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

  const linhasVistoriadas = linhas.filter(l =>
    l.estado.data_ultima_inspecao && (!inicioPeriodo || l.estado.data_ultima_inspecao >= inicioPeriodo)
  )
  const linhasNaoVistoriadas = linhas.filter(l => !linhasVistoriadas.includes(l))
  // Situação atual (não período) — usada no anel de conformidade, que mostra
  // "nunca vistoriado" e não "não vistoriado nesse período".
  const linhasSemInspecao = linhas.filter(l => !l.estado.data_ultima_inspecao)
  const linhasConforme = linhas.filter(l => l.estado.situacao_conformidade === 'conforme')
  const linhasNaoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme')
  const linhasReserva = linhas.filter(l => l.estado.reserva_empresa)

  const linhasTipoDivergente = linhas.filter(l => tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido))

  const estoqueSCI = estoque.filter(e => e.categoria === 'SCI' && e.operacional)
  const estoqueRESERVA = estoque.filter(e => e.categoria === 'RESERVA' && e.operacional)

  // Quem tem chance real de ser resolvido por uma troca de Tipo — usado
  // pelas sugestões de troca dentro do modal de "Tipo divergente da planta".
  const { capacidade: necessitandoCapacidade, tipo: necessitandoTipo } = locaisNecessitandoTroca(linhas)
  const necessitandoTipoKeys = new Set(necessitandoTipo.map(l => `${l.local.id}:${l.slot}`))

  // Candidatos que já são A recomendação de alguma não conformidade real de
  // Capacidade extintora — pra não deixar as sugestões de Tipo divergente
  // (só alerta, não é não conformidade) "roubarem" a opção certa de quem
  // precisa de verdade.
  const origensReservadas = origensRecomendadasParaCapacidade({
    necessitandoCapacidade, linhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas
  })

  // "Vencendo em breve": N2 nos próximos 90 dias (mesmo limiar usado nas
  // tabelas de Situação/Histórico) e N3 dentro do ano vigente.
  const anoAtual = String(new Date().getFullYear())
  const linhasVencendoN2 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias >= 0 && dias < 90
  })
  const linhasVencendoN3 = linhas.filter(l => l.estado.validade_nivel3 && l.estado.validade_nivel3.startsWith(anoAtual))

  const gruposAlertas = [
    {
      titulo: 'Tipo divergente da planta',
      linhas: linhasTipoDivergente,
      detalhe: ({ local, estado }) => textoTipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido)
    },
    {
      titulo: 'Validade N2 — próximos 90 dias',
      linhas: linhasVencendoN2,
      detalhe: ({ estado }) => `Vence em ${formatValidadeN2(estado.validade_nivel2)}`
    },
    {
      titulo: 'Validade N3 — este ano',
      linhas: linhasVencendoN3,
      detalhe: ({ estado }) => `Vence em ${estado.validade_nivel3?.split('-')[0] || ''}`
    },
  ]

  const total = linhas.length
  const vistoriados = linhasVistoriadas.length
  const naoVistoriados = linhasNaoVistoriadas.length

  function abrirLista(titulo, linhasFiltradas, cor, detalhe) {
    setListaAberta({ titulo, linhas: linhasFiltradas, cor, detalhe })
  }

  return (
    <div className="p-4 space-y-5">

      {/* Linha 1 (lg+: lado a lado, mesma altura) — Extintores em campo | Conformidade */}
      <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5">
        {/* 1. Extintores em campo */}
        <div className="space-y-3 lg:flex lg:flex-col">
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

        {/* 2. Conformidade — arco de pé no mobile (ganha largura), deitado a partir de lg */}
        <div className="space-y-3 lg:flex lg:flex-col">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Conformidade</p>
          <div className="lg:hidden">
            <AnelConformidade
              vertical
              conforme={linhasConforme.length}
              naoConforme={linhasNaoConforme.length}
              naoVistoriados={linhasSemInspecao.length}
              onVerConforme={() => abrirLista('Conforme', linhasConforme, 'verde')}
              onVerNaoConforme={() => navigate('/nao-conformidades')}
              onVerNaoVistoriados={() => abrirLista('Sem inspeção', linhasSemInspecao)}
            />
          </div>
          <div className="hidden lg:flex lg:flex-1">
            <AnelConformidade
              conforme={linhasConforme.length}
              naoConforme={linhasNaoConforme.length}
              naoVistoriados={linhasSemInspecao.length}
              onVerConforme={() => abrirLista('Conforme', linhasConforme, 'verde')}
              onVerNaoConforme={() => navigate('/nao-conformidades')}
              onVerNaoVistoriados={() => abrirLista('Sem inspeção', linhasSemInspecao)}
            />
          </div>
        </div>
      </div>

      {/* 3. Alertas */}
      <div className="space-y-3">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Alertas</p>
        <CardAlertas
          grupos={gruposAlertas}
          onVerGrupo={g => g.titulo === 'Tipo divergente da planta'
            ? setTipoDivergenteAberto(true)
            : abrirLista(g.titulo, g.linhas, 'ambar', g.detalhe)}
        />
      </div>

      {/* 4. Outros indicadores */}
      <div className="space-y-3">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Outros indicadores</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Em manutenção"
            valor={ordensPendentes.length}
            cls="text-slate-500"
            rotulo="Ver"
            onClick={() => setManutencaoAberta(true)}
          />
          <Stat label="RESERVA em campo" valor={linhasReserva.length} cls="text-blue-600" rotulo="Ver" onClick={() => abrirLista('RESERVA em campo', linhasReserva, 'azul')} />
        </div>
      </div>

      {/* 5. Situação */}
      <div className="space-y-3">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Situação</p>
        <TabelaSituacao linhas={linhas} tiposExtintor={tiposExtintor} />
      </div>

      {listaAberta && (
        <ModalListaExtintores
          titulo={listaAberta.titulo}
          linhas={listaAberta.linhas}
          grupos={listaAberta.grupos}
          cor={listaAberta.cor}
          detalhe={listaAberta.detalhe}
          onClose={() => setListaAberta(null)}
          onSelecionar={item => setDetalheAberto(item)}
          onSubstituir={listaAberta.titulo === 'RESERVA em campo'
            ? item => { setListaAberta(null); setSubstituindoLocal(item) }
            : undefined}
        />
      )}

      {tipoDivergenteAberto && (
        <ModalAlertaTipoDivergente
          linhas={linhasTipoDivergente}
          necessitandoKeys={necessitandoTipoKeys}
          todasLinhas={linhas}
          estoqueSCI={estoqueSCI}
          estoqueRESERVA={estoqueRESERVA}
          trocasPlanejadas={trocasPlanejadas}
          origensReservadas={origensReservadas}
          responsavel={responsavel}
          processando={processando}
          onDefinir={handleDefinirTroca}
          onCancelar={handleCancelarTroca}
          onClose={() => setTipoDivergenteAberto(false)}
          onSelecionarLocal={item => setDetalheAberto(item)}
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

      {substituindoLocal && (
        <ModalLocal
          local={substituindoLocal.local}
          responsavel={responsavel}
          substituicaoAtiva
          onClose={() => setSubstituindoLocal(null)}
          onAtualizar={carregar}
        />
      )}

      {manutencaoAberta && (
        <ModalEmManutencao
          ordensPendentes={ordensPendentes}
          tiposExtintor={tiposExtintor}
          onClose={() => setManutencaoAberta(false)}
          onGerenciar={() => { setManutencaoAberta(false); navigate('/manutencoes', { state: { aba: 'recebimento' } }) }}
        />
      )}
    </div>
  )
}

// Quantidades por tipo/kg em manutenção — abre a partir do card "Em
// manutenção" do Dashboard; "Gerenciar" leva pra aba Receber de
// Manutenções, onde de fato dá pra confirmar o recebimento.
function ModalEmManutencao({ ordensPendentes, tiposExtintor, onClose, onGerenciar }) {
  const grupos = ordensPendentes.reduce((acc, o) => {
    const chave = `${o.extintor_saiu_tipo}|${o.extintor_saiu_kg}`
    if (!acc[chave]) acc[chave] = { tipo: o.extintor_saiu_tipo, kg: o.extintor_saiu_kg, qtd: 0 }
    acc[chave].qtd += 1
    return acc
  }, {})

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sci-text">Em manutenção</p>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
        </div>

        <div className="space-y-1.5">
          {Object.values(grupos).map(grupo => {
            const cor = corTipo(grupo.tipo)
            return (
              <div
                key={`${grupo.tipo}|${grupo.kg}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cor.bg} ${cor.border}`}
              >
                <span className={`text-sm font-medium ${cor.text}`}>{grupo.tipo} {grupo.kg}{unidadeDoTipo(grupo.tipo, tiposExtintor)}</span>
                <span className={`text-sm font-bold ${cor.text}`}>{grupo.qtd}</span>
              </div>
            )
          })}
        </div>

        <button onClick={onGerenciar} className="btn-primary w-full">
          Gerenciar
        </button>
      </div>
    </div>,
    document.body
  )
}
