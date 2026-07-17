import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchLocaisComReserva, fetchLocaisComVencimento, fetchTiposExtintor, fetchEstoqueDeposito, fetchOrdensPendentes, registrarEnvioEstoque, registrarRecebimentoMassa } from '../lib/queries'
import { unidadeDoTipo } from '../lib/formato'
import IconeExtintor from '../components/IconeExtintor'
import ModalLocal from '../components/ModalLocal'
import { useToast } from '../components/Toast'

const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA']
const STORAGE_KEY = 'sci_responsavel'

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatarValidade(val, nivel) {
  if (!val) return null
  if (nivel === 3) return `N3: ${val.slice(0, 4)}`
  // val is YYYY-MM-01
  const [ano, mes] = val.split('-')
  return `N2: ${mes}/${ano.slice(2)}`
}

function CardComoUsar({ descricao, texto, aberto, onToggle }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs text-amber-900 leading-relaxed">{descricao}</p>
      </div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-left border-t border-amber-100"
      >
        <span className="text-xs font-semibold text-amber-700">Como usar?</span>
        <span className="text-amber-500 text-sm">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <p className="px-4 pb-3 text-xs text-amber-800 leading-relaxed border-t border-amber-100 pt-2">
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
  const [loading, setLoading] = useState(true)
  const [formEstoque, setFormEstoque] = useState({ tipo: '', kg: '', nivel: '', quantidade: 1, equipe: '' })
  const [enviandoEstoque, setEnviandoEstoque] = useState(false)
  const [estoquePainel, setEstoquePainel] = useState(false)
  const [selecionados, setSelecionados] = useState(new Set())
  const [expandidos, setExpandidos] = useState(new Set())
  const [equipe, setEquipe] = useState('')
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
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function toggleSelecionado(id) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGrupo(chave, ids) {
    const todosSel = ids.every(id => selecionados.has(id))
    setSelecionados(prev => {
      const next = new Set(prev)
      if (todosSel) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  function toggleExpandido(chave) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  async function handleRecebimento() {
    if (!responsavel) return alert('Informe seu nome de BA na aba Inspeção antes de continuar.')
    if (!equipe) return alert('Selecione a equipe.')
    if (selecionados.size === 0) return alert('Selecione ao menos um extintor.')
    setRegistrando(true)
    try {
      const ordensSelecionadas = ordens.filter(o => selecionados.has(o.id))
      const resultado = await registrarRecebimentoMassa({ ordens: ordensSelecionadas, responsavel, equipe })
      setSelecionados(new Set())
      setEquipe('')
      showToast(
        resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Recebimento registrado com sucesso.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await carregar()
    } catch (e) {
      alert('Erro ao registrar: ' + e.message)
    } finally {
      setRegistrando(false)
    }
  }

  const grupos = ordens.reduce((acc, o) => {
    const chave = `${o.extintor_saiu_tipo} ${o.extintor_saiu_kg}${unidadeDoTipo(o.extintor_saiu_tipo, tiposExtintor)}`
    if (!acc[chave]) acc[chave] = []
    acc[chave].push(o)
    return acc
  }, {})

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const algumSelecionado = selecionados.size > 0

  const ABAS = [
    { id: 'recebimento', label: 'Em manutenção', badge: ordens.length },
    { id: 'envio', label: 'Envio', badge: vencimentos.length },
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
          descricao="Organize o envio de extintores para manutenção. Liste os pontos com validade vencendo no ano vigente e saiba exatamente quais substitutos separar antes de ir a campo."
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
            <>
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
                    Exigência da planta — {selecionadosEnvioList.length} ponto{selecionadosEnvioList.length > 1 ? 's' : ''} selecionado{selecionadosEnvioList.length > 1 ? 's' : ''}:
                  </p>
                  {Object.entries(resumoEnvio).map(([chave, qtd]) => (
                    <div key={chave} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">{chave}</span>
                      <span className="text-sm font-bold text-blue-900">× {qtd}</span>
                    </div>
                  ))}
                </div>
              )}

              {vencFiltrados.map(local => {
                const sel = selecionadosEnvio.has(local.id)
                const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')
                // Highest priority vencimento for display (N3 > N2)
                const venc = local.vencimentos?.sort((a, b) => b.nivel - a.nivel)[0]
                return (
                  <div
                    key={local.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex transition-all ${sel ? 'border-sci-red ring-1 ring-red-100' : 'border-slate-200'}`}
                  >
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

                    <button
                      onClick={() => { setLocalAberto(local); setEnvioPreAberto(true) }}
                      className="flex items-center pr-4 pl-2 text-sci-red text-xs font-semibold shrink-0"
                    >
                      Registrar envio →
                    </button>
                  </div>
                )
              })}
            </>
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

          {estoquePainel && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              {/* Tipo/kg */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Tipo / kg</p>
                <div className="flex flex-wrap gap-2">
                  {tiposExtintor.map(t => {
                    const sel = formEstoque.tipo === t.tipo && String(formEstoque.kg) === String(t.kg)
                    return (
                      <button
                        key={t.id}
                        onClick={() => setFormEstoque(f => ({ ...f, tipo: t.tipo, kg: t.kg }))}
                        className={`btn-option text-xs ${sel ? 'selected' : ''}`}
                      >
                        {t.tipo} {t.kg}{t.unidade || 'kg'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nível */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Nível de manutenção</p>
                <div className="flex gap-2">
                  {['2', '3'].map(n => (
                    <button
                      key={n}
                      onClick={() => setFormEstoque(f => ({ ...f, nivel: n }))}
                      className={`btn-option flex-1 text-sm ${formEstoque.nivel === n ? 'selected' : ''}`}
                    >
                      Nível {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantidade */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Quantidade</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFormEstoque(f => ({ ...f, quantidade: Math.max(1, f.quantidade - 1) }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 text-lg flex items-center justify-center hover:bg-slate-50"
                  >−</button>
                  <span className="text-lg font-bold text-sci-text w-8 text-center">{formEstoque.quantidade}</span>
                  <button
                    onClick={() => setFormEstoque(f => ({ ...f, quantidade: f.quantidade + 1 }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 text-lg flex items-center justify-center hover:bg-slate-50"
                  >+</button>
                </div>
              </div>

              {/* Equipe */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Equipe</p>
                <div className="grid grid-cols-4 gap-2">
                  {EQUIPES.map(eq => (
                    <button
                      key={eq}
                      onClick={() => setFormEstoque(f => ({ ...f, equipe: eq }))}
                      className={`btn-option text-sm font-semibold ${formEstoque.equipe === eq ? 'selected' : ''}`}
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={!formEstoque.tipo || !formEstoque.nivel || !formEstoque.equipe || enviandoEstoque || !responsavel}
                onClick={async () => {
                  if (!responsavel) return alert('Informe seu nome antes de registrar.')
                  setEnviandoEstoque(true)
                  try {
                    const resultado = await registrarEnvioEstoque({
                      tipo: formEstoque.tipo,
                      kg: formEstoque.kg,
                      nivel: parseInt(formEstoque.nivel),
                      quantidade: formEstoque.quantidade,
                      responsavel,
                      equipe: formEstoque.equipe
                    })
                    setFormEstoque({ tipo: '', kg: '', nivel: '', quantidade: 1, equipe: '' })
                    setEstoquePainel(false)
                    showToast(
                      resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Envio para o depósito registrado com sucesso.',
                      resultado.queued ? 'aviso' : 'sucesso'
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
                {enviandoEstoque ? 'Registrando...' : `Registrar envio${formEstoque.quantidade > 1 ? ` (${formEstoque.quantidade} unidades)` : ''}`}
              </button>
            </div>
          )}
        </div>
      </section>}

      {/* ── Aba Recebimento ── */}
      {abaAtiva === 'recebimento' && <section className="space-y-3">

        <CardComoUsar
          descricao="Registre o retorno de extintores que voltaram da manutenção, removendo da lista de pendências."
          aberto={comoUsarReceb}
          onToggle={() => setComoUsarReceb(v => !v)}
          texto="Selecione os extintores que retornaram. Após marcar todos, informe a equipe responsável pelo recebimento e confirme — o status de 'Em manutenção' será removido, e o extintor será removido da lista de pendências."
        />

        {ordens.length === 0 && (
          <div className="card text-center py-6 text-slate-400 text-sm">
            Nenhum extintor em manutenção.
          </div>
        )}

        {Object.entries(grupos).map(([chave, itens]) => {
          const aberto = expandidos.has(chave)
          const ids = itens.map(o => o.id)
          const todosSel = ids.every(id => selecionados.has(id))
          const algumSel = ids.some(id => selecionados.has(id))

          return (
            <div key={chave} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">

              <button
                onClick={() => toggleExpandido(chave)}
                className="w-full flex items-stretch gap-3 p-4 text-left hover:bg-slate-50 transition-colors min-h-[72px]"
              >
                <div className="bg-sci-red flex items-center justify-center px-2 rounded-lg shrink-0">
                  <IconeExtintor size={18} color="#ffffff" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-bold text-sci-text shrink-0">{chave}</span>
                  <div className="self-stretch w-px bg-slate-200 shrink-0" />
                  <span className="text-2xl font-bold text-sci-text leading-none shrink-0">{itens.length}</span>
                  <span className="text-sm text-slate-500 leading-tight">unidade{itens.length > 1 ? 's' : ''} em manutenção</span>
                </div>
                {algumSel && (
                  <span className="text-xs font-medium text-white bg-slate-700 px-2 py-0.5 rounded-full shrink-0">
                    {ids.filter(id => selecionados.has(id)).length} sel.
                  </span>
                )}
                <span className="text-slate-400 text-sm shrink-0 self-center">{aberto ? '▲' : '▼'}</span>
              </button>

              {aberto && (
                <div className="border-t border-slate-100">
                  <button
                    onClick={() => toggleGrupo(chave, ids)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      todosSel ? 'border-slate-800 bg-slate-800' : algumSel ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white'
                    }`}>
                      {todosSel && <div className="w-2 h-2 rounded-full bg-white" />}
                      {algumSel && !todosSel && <div className="w-2 h-0.5 bg-slate-400" />}
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {todosSel ? 'Desmarcar todos' : 'Selecionar todos'}
                    </span>
                  </button>

                  {itens.map(o => {
                    const sel = selecionados.has(o.id)
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggleSelecionado(o.id)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${
                          sel ? 'bg-slate-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          sel ? 'border-white bg-white' : 'border-slate-300 bg-white'
                        }`}>
                          {sel && <div className="w-2 h-2 rounded-full bg-slate-800" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight ${sel ? 'text-white' : 'text-sci-text'}`}>
                            {o.locais ? (
                              <>
                                <span className={`font-bold mr-1 ${sel ? 'text-slate-300' : 'text-sci-red'}`}>
                                  {String(o.locais.numero).padStart(2, '0')}
                                </span>
                                {o.locais.edificacao}
                                {o.locais.descricao && (
                                  <span className={`font-normal ml-1 ${sel ? 'text-slate-300' : 'text-slate-500'}`}>
                                    · {o.locais.descricao}
                                  </span>
                                )}
                                {o.slot === 'B' && (
                                  <span className={`ml-1 text-xs ${sel ? 'text-slate-400' : 'text-slate-400'}`}>Slot B</span>
                                )}
                              </>
                            ) : (
                              <span className={sel ? 'text-slate-300' : 'text-slate-500'}>Estoque / Depósito</span>
                            )}
                          </p>
                          <p className={`text-xs mt-0.5 ${sel ? 'text-slate-300' : 'text-slate-500'}`}>
                            Nível {o.nivel_manutencao} · Saída {formatarData(o.data_saida)} · {o.responsavel_saida}
                          </p>
                          {o.locais && (
                            <p className={`text-xs mt-0.5 ${sel ? 'text-slate-400' : 'text-slate-400'}`}>
                              Substituto: {o.substituto_tipo} {o.substituto_kg}{unidadeDoTipo(o.substituto_tipo, tiposExtintor)}
                              {o.substituto_reserva
                                ? <span className="text-blue-400 font-medium"> · RESERVA</span>
                                : ' · Estoque SCI'
                              }
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {algumSelecionado && (
          <div className="card space-y-3 border-slate-300">
            <p className="text-sm font-semibold text-sci-text">
              Registrar recebimento — {selecionados.size} extintor{selecionados.size > 1 ? 'es' : ''}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {EQUIPES.map(eq => (
                <button
                  key={eq}
                  onClick={() => setEquipe(eq)}
                  className={`btn-option text-sm font-semibold ${equipe === eq ? 'selected' : ''}`}
                >
                  {eq}
                </button>
              ))}
            </div>
            <button
              onClick={handleRecebimento}
              disabled={registrando || !equipe}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {registrando ? 'Registrando...' : 'Confirmar recebimento'}
            </button>
          </div>
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
    </div>
  )
}
