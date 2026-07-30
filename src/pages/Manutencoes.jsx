import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { fetchLocaisComReserva, fetchLocaisComVencimento, fetchTiposExtintor, fetchEstoqueDeposito, fetchOrdensPendentes, registrarEnvioEstoque, registrarRecebimentoMassa } from '../lib/queries'
import { unidadeDoTipo } from '../lib/formato'
import { corTipo } from '../lib/coresTipo'
import ModalLocal from '../components/ModalLocal'
import { useToast } from '../components/Toast'

const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA']
const STORAGE_KEY = 'sci_responsavel'

function formatarValidade(val, nivel) {
  if (!val) return null
  if (nivel === 3) return `N3: ${val.slice(0, 4)}`
  // val is YYYY-MM-01
  const [ano, mes] = val.split('-')
  return `N2: ${mes}/${ano.slice(2)}`
}

function CardComoUsar({ descricao, texto, aberto, onToggle }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs text-red-900 leading-relaxed">{descricao}</p>
      </div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-left border-t border-red-100"
      >
        <span className="text-xs font-semibold text-sci-red">Como usar?</span>
        <span className="text-red-400 text-sm">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <p className="px-4 pb-3 text-xs text-red-800 leading-relaxed border-t border-red-100 pt-2">
          {texto}
        </p>
      )}
    </div>
  )
}

export default function Manutencoes() {
  const showToast = useToast()
  const location = useLocation()
  const [ordens, setOrdens] = useState([])
  const [reservas, setReservas] = useState([])
  const [vencimentos, setVencimentos] = useState([])
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [estoqueReserva, setEstoqueReserva] = useState([])
  const [estoqueSCI, setEstoqueSCI] = useState([])
  const [loading, setLoading] = useState(true)
  // Quantidade a enviar por item (chave "tipo|kg"), pra montar um envio com
  // vários tipos diferentes de uma vez — cada linha da tabela tem sua
  // própria seta +/-.
  const [qtdEnvio, setQtdEnvio] = useState({})
  const [equipeEnvioEstoque, setEquipeEnvioEstoque] = useState('')
  const [enviandoEstoque, setEnviandoEstoque] = useState(false)
  const [estoquePainel, setEstoquePainel] = useState(false)
  const [pontosPainel, setPontosPainel] = useState(false)
  // Receber: um grupo (tipo|kg) expandido por vez, com a quantidade a
  // receber escolhida ali mesmo — sem selecionar item por item.
  const [expandidoChave, setExpandidoChave] = useState(null)
  const [qtdReceber, setQtdReceber] = useState({})
  const [modalReceber, setModalReceber] = useState(null)
  const [nomeModal, setNomeModal] = useState('')
  const [equipeModal, setEquipeModal] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [localAberto, setLocalAberto] = useState(null)
  const [envioPreAberto, setEnvioPreAberto] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState(location.state?.aba || 'recebimento')
  const [filtroEdif, setFiltroEdif] = useState('')
  const [filtroEdifEnvio, setFiltroEdifEnvio] = useState('')
  const [selecionadosReserva, setSelecionadosReserva] = useState(new Set())
  const [selecionadosEnvio, setSelecionadosEnvio] = useState(new Set())
  const [comoUsarEnvio, setComoUsarEnvio] = useState(false)
  const [comoUsarReceb, setComoUsarReceb] = useState(false)
  const [comoUsarSubst, setComoUsarSubst] = useState(false)

  const responsavel = localStorage.getItem(STORAGE_KEY) || ''

  const carregar = useCallback(async () => {
    const [ords, reservasData, vencData, tiposData, estoqueData] = await Promise.all([
      fetchOrdensPendentes(),
      fetchLocaisComReserva(),
      fetchLocaisComVencimento(),
      fetchTiposExtintor(),
      fetchEstoqueDeposito()
    ])
    setOrdens(ords || [])
    setReservas(reservasData)
    setVencimentos(vencData)
    setTiposExtintor(tiposData)
    setEstoqueReserva((estoqueData || []).filter(e => e.categoria === 'RESERVA'))
    // Total por tipo/kg (operacional + não operacional somados) — pra Envio
    // do Estoque, que manda pra manutenção tanto quem tá prestes a vencer
    // (operacional) quanto quem já tá quebrado (não operacional).
    const totaisSCIporTipoKg = (estoqueData || [])
      .filter(e => e.categoria === 'SCI')
      .reduce((acc, e) => {
        const chave = `${e.tipo}|${e.kg}`
        if (!acc[chave]) acc[chave] = { tipo: e.tipo, kg: e.kg, quantidade: 0 }
        acc[chave].quantidade += e.quantidade
        return acc
      }, {})
    setEstoqueSCI(Object.values(totaisSCIporTipoKg).filter(e => e.quantidade > 0))
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirModalReceber(grupo, chave) {
    const qtd = qtdReceber[chave] || 0
    if (qtd === 0) return
    setModalReceber({ chave, tipo: grupo.tipo, kg: grupo.kg, qtd, itens: grupo.itens })
    setEquipeModal('')
    setNomeModal('')
  }

  async function confirmarRecebimento() {
    const nomeFinal = responsavel || nomeModal.trim()
    if (!nomeFinal || !equipeModal || !modalReceber) return
    setRegistrando(true)
    try {
      if (!responsavel) localStorage.setItem(STORAGE_KEY, nomeFinal)
      const ordenadas = [...modalReceber.itens].sort((a, b) => new Date(a.data_saida) - new Date(b.data_saida))
      const escolhidas = ordenadas.slice(0, modalReceber.qtd)
      const resultado = await registrarRecebimentoMassa({ ordens: escolhidas, responsavel: nomeFinal, equipe: equipeModal })
      setQtdReceber(q => ({ ...q, [modalReceber.chave]: 0 }))
      setExpandidoChave(null)
      setModalReceber(null)
      showToast(
        resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Recebimento registrado com sucesso.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await carregar()
    } catch (e) {
      showToast('Erro ao registrar: ' + e.message, 'erro')
    } finally {
      setRegistrando(false)
    }
  }

  const grupos = ordens.reduce((acc, o) => {
    const chave = `${o.extintor_saiu_tipo}|${o.extintor_saiu_kg}`
    if (!acc[chave]) acc[chave] = { tipo: o.extintor_saiu_tipo, kg: o.extintor_saiu_kg, itens: [] }
    acc[chave].itens.push(o)
    return acc
  }, {})

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const ABAS = [
    { id: 'recebimento', label: 'Receber', badge: ordens.length },
    { id: 'envio', label: 'Enviar', badge: vencimentos.length },
    { id: 'substituicao', label: 'Substituir RESERVAS', badge: reservas.length },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Abas */}
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        {ABAS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setAbaAtiva(tab.id)}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1 ${
              abaAtiva === tab.id
                ? 'border-sci-red text-sci-red'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                abaAtiva === tab.id ? 'bg-red-50 text-sci-red' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

      {/* ── Aba Envio ── */}
      {abaAtiva === 'envio' && <section className="space-y-3">

        <CardComoUsar
          descricao="Organize o envio de extintores para manutenção. Marque os pontos que deseja enviar para manutenção e saiba exatamente quais substitutos separar antes de ir a campo."
          aberto={comoUsarEnvio}
          onToggle={() => setComoUsarEnvio(v => !v)}
          texto="Marque os pontos que pretende atender nesta saída. O sistema agrupa automaticamente por tipo e capacidade exigidos na planta. Clique em 'Registrar envio' em cada ponto para registrar o extintor que saiu e o substituto que ficou no local."
        />

        {vencimentos.length === 0 ? (
          <div className="card text-center py-6 text-slate-400 text-sm">
            Nenhum extintor com validade vencendo no ano vigente.
          </div>
        ) : (() => {
          const edificacoesEnvio = [...new Set(vencimentos.map(l => l.edificacao).filter(Boolean))].sort()
          const vencFiltrados = filtroEdifEnvio ? vencimentos.filter(l => l.edificacao === filtroEdifEnvio) : vencimentos

          function toggleEnvio(id) {
            setSelecionadosEnvio(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })
          }

          const selecionadosEnvioList = vencFiltrados.filter(l => selecionadosEnvio.has(l.id))
          const resumoEnvio = selecionadosEnvioList.reduce((acc, l) => {
            const chave = [l.planta_tipo_exigido, l.planta_cap_ext_exigida].filter(Boolean).join(' ') || 'Sem exigência'
            const qtd = l.vencimentos?.length || 1
            acc[chave] = (acc[chave] || 0) + qtd
            return acc
          }, {})

          return (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setPontosPainel(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-sci-text">Pontos com validade vencida ou vencendo</p>
                  <p className="text-xs text-slate-400">
                    {vencimentos.length} ponto{vencimentos.length > 1 ? 's' : ''}
                    {selecionadosEnvio.size > 0 ? ` · ${selecionadosEnvio.size} selecionado${selecionadosEnvio.size > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <span className="text-slate-400 text-sm">{pontosPainel ? '▲' : '▼'}</span>
              </button>

              {pontosPainel && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  {edificacoesEnvio.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setFiltroEdifEnvio('')}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${!filtroEdifEnvio ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'}`}
                      >
                        Todas
                      </button>
                      {edificacoesEnvio.map(e => (
                        <button
                          key={e}
                          onClick={() => setFiltroEdifEnvio(e === filtroEdifEnvio ? '' : e)}
                          className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${filtroEdifEnvio === e ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}

                  {selecionadosEnvioList.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-blue-700">
                        Separar antes de ir a campo (SCI ou RESERVA) — {selecionadosEnvioList.length} ponto{selecionadosEnvioList.length > 1 ? 's' : ''} selecionado{selecionadosEnvioList.length > 1 ? 's' : ''}:
                      </p>
                      {Object.entries(resumoEnvio).map(([chave, qtd]) => (
                        <div key={chave} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">{chave}</span>
                          <span className="text-sm font-bold text-blue-900">× {qtd}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    {vencFiltrados.map(local => {
                      const sel = selecionadosEnvio.has(local.id)
                      const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')
                      // Highest priority vencimento for display (N3 > N2)
                      const venc = local.vencimentos?.sort((a, b) => b.nivel - a.nivel)[0]
                      return (
                        <div
                          key={local.id}
                          className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${sel ? 'border-sci-red ring-1 ring-red-100' : 'border-slate-200'}`}
                        >
                          <div className="flex">
                            <button
                              onClick={() => toggleEnvio(local.id)}
                              className="flex items-center justify-center px-3 shrink-0"
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${sel ? 'bg-sci-red border-sci-red' : 'border-slate-300 bg-white'}`}>
                                {sel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                            </button>

                            <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0 self-stretch">
                              <span className="text-white font-bold text-base leading-none">{String(local.numero).padStart(2, '0')}</span>
                            </div>

                            <div className="flex-1 min-w-0 p-3 space-y-0.5">
                              <p className="text-sm font-medium text-sci-text">{local.edificacao}</p>
                              {local.descricao && <p className="text-xs text-slate-400">{local.descricao}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                {plantaLabel && (
                                  <span className="text-xs text-slate-500">Planta: <span className="font-semibold text-slate-700">{plantaLabel}</span></span>
                                )}
                                {venc && (
                                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    {formatarValidade(venc.validade, venc.nivel)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => { setLocalAberto(local); setEnvioPreAberto(true) }}
                            className="w-full flex items-center justify-center py-2.5 text-sci-red text-xs font-semibold border-t border-slate-100 bg-red-50/50"
                          >
                            Registrar envio →
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Envio do Estoque */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setEstoquePainel(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-sci-text">Envio do Estoque / Depósito</p>
              <p className="text-xs text-slate-400">Extintor fora de ponto de instalação</p>
            </div>
            <span className="text-slate-400 text-sm">{estoquePainel ? '▲' : '▼'}</span>
          </button>

          {estoquePainel && (() => {
            // Só SCI — RESERVA é da empresa que faz a manutenção, não são
            // extintores nossos pra mandar consertar. Quantidade é o total
            // (operacional + não operacional somados) de cada tipo/kg.
            const itens = Object.entries(qtdEnvio).filter(([, qtd]) => qtd > 0)
            const totalGeral = itens.reduce((s, [, qtd]) => s + qtd, 0)

            const setQtd = (chave, max, valor) => {
              const v = Math.max(0, Math.min(max, valor))
              setQtdEnvio(q => ({ ...q, [chave]: v }))
            }

            return (
              <div className="border-t border-slate-100 p-4 space-y-4">
                {/* Tabela Tipo / Disponível / Qtd a enviar — mesmo visual do TabelaEstoque do Depósito */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Tipo / kg (SCI)</p>
                  {estoqueSCI.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhum item em estoque.</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-[1fr,4.5rem,6rem] gap-1 items-center px-3 py-2 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                        <span>Tipo</span>
                        <span className="text-center">Disponível</span>
                        <span className="text-center">Qtd a enviar</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {estoqueSCI.map(e => {
                          const chave = `${e.tipo}|${e.kg}`
                          const qtd = qtdEnvio[chave] || 0
                          return (
                            <div key={chave} className="grid grid-cols-[1fr,4.5rem,6rem] gap-1 items-center px-3 py-2">
                              <span className="text-sm text-sci-text">{e.tipo} {e.kg}{unidadeDoTipo(e.tipo, tiposExtintor)}</span>
                              <span className="text-sm text-center text-slate-500">{e.quantidade}</span>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setQtd(chave, e.quantidade, qtd - 1)}
                                  disabled={qtd === 0}
                                  className="w-6 h-6 rounded border border-slate-200 text-slate-500 text-sm leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
                                >−</button>
                                <span className={`w-5 text-center text-sm font-semibold ${qtd === 0 ? 'text-slate-300' : 'text-sci-text'}`}>{qtd}</span>
                                <button
                                  onClick={() => setQtd(chave, e.quantidade, qtd + 1)}
                                  disabled={qtd >= e.quantidade}
                                  className="w-6 h-6 rounded border border-slate-200 text-slate-500 text-sm leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
                                >+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo do que será enviado */}
                {itens.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-700">Será enviado:</p>
                    {itens.map(([chave, qtd]) => {
                      const [tipo, kg] = chave.split('|')
                      return (
                        <div key={chave} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">{tipo} {kg}{unidadeDoTipo(tipo, tiposExtintor)}</span>
                          <span className="text-sm font-bold text-blue-900">× {qtd}</span>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between border-t border-blue-200 pt-1.5">
                      <span className="text-xs font-semibold text-blue-700">Total geral</span>
                      <span className="text-sm font-bold text-blue-900">{totalGeral}</span>
                    </div>
                  </div>
                )}

                {/* Equipe */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Equipe</p>
                  <div className="grid grid-cols-4 gap-2">
                    {EQUIPES.map(eq => (
                      <button
                        key={eq}
                        onClick={() => setEquipeEnvioEstoque(eq)}
                        className={`btn-option text-sm font-semibold ${equipeEnvioEstoque === eq ? 'selected' : ''}`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled={itens.length === 0 || !equipeEnvioEstoque || enviandoEstoque || !responsavel}
                  onClick={async () => {
                    if (!responsavel) return alert('Informe seu nome antes de registrar.')
                    setEnviandoEstoque(true)
                    try {
                      let algumEnfileirado = false
                      for (const [chave, qtd] of itens) {
                        const [tipo, kg] = chave.split('|')
                        const resultado = await registrarEnvioEstoque({
                          tipo,
                          kg,
                          quantidade: qtd,
                          categoria: 'SCI',
                          responsavel,
                          equipe: equipeEnvioEstoque
                        })
                        if (resultado.queued) algumEnfileirado = true
                      }
                      setQtdEnvio({})
                      setEquipeEnvioEstoque('')
                      setEstoquePainel(false)
                      showToast(
                        algumEnfileirado ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Envio para o depósito registrado com sucesso.',
                        algumEnfileirado ? 'aviso' : 'sucesso'
                      )
                      await carregar()
                    } catch (e) {
                      alert('Erro: ' + e.message)
                    } finally {
                      setEnviandoEstoque(false)
                    }
                  }}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enviandoEstoque ? 'Registrando...' : `Registrar envio${totalGeral > 1 ? ` (${totalGeral} unidades)` : ''}`}
                </button>
              </div>
            )
          })()}
        </div>
      </section>}

      {/* ── Aba Receber ── */}
      {abaAtiva === 'recebimento' && <section className="space-y-3">

        <CardComoUsar
          descricao="Registre o retorno de extintores que voltaram da manutenção, removendo da lista de pendências."
          aberto={comoUsarReceb}
          onToggle={() => setComoUsarReceb(v => !v)}
          texto="Abra o tipo/capacidade que retornou, escolha a quantidade recebida e confirme — as ordens mais antigas daquele tipo são as marcadas como recebidas. Se o nome ainda não foi preenchido na aba Inspeção, ele é pedido no momento da confirmação."
        />

        {ordens.length === 0 ? (
          <div className="card text-center py-6 text-slate-400 text-sm">
            Nenhum extintor em manutenção.
          </div>
        ) : (
          <>
            <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider px-1">Em manutenção</p>

            <div className="space-y-2">
              {Object.entries(grupos).map(([chave, grupo]) => {
                const aberto = expandidoChave === chave
                const max = grupo.itens.length
                const qtd = qtdReceber[chave] || 0
                const cor = corTipo(grupo.tipo)
                return (
                  <div key={chave} className={`rounded-2xl border overflow-hidden shadow-sm ${cor.bg} ${cor.border}`}>
                    <button
                      onClick={() => setExpandidoChave(aberto ? null : chave)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors"
                    >
                      <span className="text-sm">
                        <span className={`font-bold ${cor.text}`}>{max}</span>{' '}
                        <span className={`font-semibold ${cor.text}`}>{grupo.tipo} {grupo.kg}{unidadeDoTipo(grupo.tipo, tiposExtintor)}</span>
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`${cor.text} shrink-0 transition-transform opacity-60 ${aberto ? 'rotate-90' : ''}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>

                    {aberto && (
                      <div className="border-t border-black/5 p-4 flex items-center gap-3 bg-white/50">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setQtdReceber(q => ({ ...q, [chave]: Math.max(0, (q[chave] || 0) - 1) }))}
                            disabled={qtd === 0}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 text-sm leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
                          >−</button>
                          <span className={`w-7 text-center text-sm font-semibold ${qtd === 0 ? 'text-slate-300' : 'text-sci-text'}`}>{qtd}</span>
                          <button
                            onClick={() => setQtdReceber(q => ({ ...q, [chave]: Math.min(max, (q[chave] || 0) + 1) }))}
                            disabled={qtd >= max}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 text-sm leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
                          >+</button>
                        </div>
                        <button
                          onClick={() => abrirModalReceber(grupo, chave)}
                          disabled={qtd === 0}
                          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Receber
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>}

      {/* ── Aba Substituir RESERVAS ── */}
      {abaAtiva === 'substituicao' && <section className="space-y-3">

        <CardComoUsar
          descricao={<>Substitua extintores <span className="text-blue-600 font-semibold">RESERVA</span> por um da <span className="font-semibold text-slate-800">SCI</span> nos pontos onde o extintor original foi enviado para manutenção e um extintor da empresa ficou como substituto temporário.</>}
          aberto={comoUsarSubst}
          onToggle={() => setComoUsarSubst(v => !v)}
          texto={<>Marque os pontos que pretende atender nesta saída. O sistema agrupa automaticamente por tipo e capacidade exigidos na planta para você saber o que separar antes de ir a campo. Clique em 'Substituir' para registrar o extintor da SCI que irá substituir o <span className="text-blue-600 font-semibold">RESERVA</span>.</>}
        />

        {reservas.length === 0 ? (
          <div className="card text-center py-6 text-slate-400 text-sm">
            Nenhum <span className="text-blue-600 font-semibold">RESERVA</span> pendente de substituição.
          </div>
        ) : (() => {
          const edificacoes = [...new Set(reservas.map(l => l.edificacao).filter(Boolean))].sort()
          const reservasFiltradas = filtroEdif ? reservas.filter(l => l.edificacao === filtroEdif) : reservas

          function toggleReserva(id) {
            setSelecionadosReserva(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })
          }

          const selecionadosList = reservasFiltradas.filter(l => selecionadosReserva.has(l.id))
          const resumoPlanta = selecionadosList.reduce((acc, l) => {
            const chave = [l.planta_tipo_exigido, l.planta_cap_ext_exigida].filter(Boolean).join(' ') || 'Sem exigência'
            acc[chave] = (acc[chave] || 0) + (l.local_estado_atual?.filter(s => s.reserva_empresa).length || 1)
            return acc
          }, {})

          return (
            <>
              {edificacoes.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFiltroEdif('')}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${!filtroEdif ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Todas
                  </button>
                  {edificacoes.map(e => (
                    <button
                      key={e}
                      onClick={() => setFiltroEdif(e === filtroEdif ? '' : e)}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${filtroEdif === e ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              {selecionadosList.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-700">Exigência da planta — {selecionadosList.length} ponto{selecionadosList.length > 1 ? 's' : ''} selecionado{selecionadosList.length > 1 ? 's' : ''}:</p>
                  {Object.entries(resumoPlanta).map(([chave, qtd]) => (
                    <div key={chave} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">{chave}</span>
                      <span className="text-sm font-bold text-blue-900">× {qtd}</span>
                    </div>
                  ))}
                </div>
              )}

              {reservasFiltradas.map(local => {
                const sel = selecionadosReserva.has(local.id)
                const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')
                return (
                  <div
                    key={local.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex transition-all ${sel ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}
                  >
                    <button
                      onClick={() => toggleReserva(local.id)}
                      className="flex items-center justify-center px-3 shrink-0"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${sel ? 'bg-sci-red border-sci-red' : 'border-slate-300 bg-white'}`}>
                        {sel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>

                    <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0 self-stretch">
                      <span className="text-white font-bold text-base leading-none">{String(local.numero).padStart(2, '0')}</span>
                    </div>

                    <div className="flex-1 min-w-0 p-3 space-y-0.5">
                      <p className="text-sm font-medium text-sci-text">{local.edificacao}</p>
                      {local.descricao && <p className="text-xs text-slate-400">{local.descricao}</p>}
                      {plantaLabel && (
                        <p className="text-xs text-slate-500">Planta: <span className="font-semibold text-slate-700">{plantaLabel}</span></p>
                      )}
                    </div>

                    <button
                      onClick={() => { setLocalAberto(local); setEnvioPreAberto(false) }}
                      className="flex items-center pr-4 pl-2 text-sci-red text-xs font-semibold shrink-0"
                    >
                      Substituir →
                    </button>
                  </div>
                )
              })}
            </>
          )
        })()}

        {/* RESERVA em depósito — controle de devolução */}
        {estoqueReserva.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              <span className="text-blue-600">RESERVA</span> no depósito
            </p>
            {estoqueReserva.map(item => (
              <div key={item.id} className="bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800">{item.tipo} {item.kg}{unidadeDoTipo(item.tipo, tiposExtintor)}</p>
                  <p className="text-xs text-blue-500">{item.quantidade} unidade{item.quantidade !== 1 ? 's' : ''} no depósito</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>}

      </div>

      {localAberto && (
        <ModalLocal
          local={localAberto}
          responsavel={responsavel}
          onClose={() => { setLocalAberto(null); setEnvioPreAberto(false) }}
          onAtualizar={carregar}
          substituicaoAtiva={abaAtiva === 'substituicao'}
          envioPreAberto={envioPreAberto}
        />
      )}

      {modalReceber && createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !registrando && setModalReceber(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-sci-text">Confirmar recebimento</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {modalReceber.qtd} × {modalReceber.tipo} {modalReceber.kg}{unidadeDoTipo(modalReceber.tipo, tiposExtintor)}
              </p>
            </div>

            {!responsavel && (
              <div>
                <label className="text-xs text-slate-400">Nome</label>
                <input
                  type="text"
                  value={nomeModal}
                  onChange={e => setNomeModal(e.target.value)}
                  placeholder="Seu nome"
                  autoFocus
                  className="w-full mt-1"
                />
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 mb-1.5">Equipe</p>
              <div className="grid grid-cols-4 gap-2">
                {EQUIPES.map(eq => (
                  <button
                    key={eq}
                    onClick={() => setEquipeModal(eq)}
                    className={`btn-option text-sm font-semibold ${equipeModal === eq ? 'selected' : ''}`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={confirmarRecebimento}
              disabled={registrando || !equipeModal || (!responsavel && !nomeModal.trim())}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {registrando ? 'Registrando...' : 'Confirmar recebimento'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
