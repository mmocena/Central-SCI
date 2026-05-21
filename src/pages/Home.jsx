import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLocaisComEstado } from '../lib/queries'
import LocalCard from '../components/LocalCard'
import ModalLocal from '../components/ModalLocal'

const STORAGE_KEY = 'sci_responsavel'

export default function Home() {
  const [nome, setNome] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [nomeSalvo, setNomeSalvo] = useState(() => !!localStorage.getItem(STORAGE_KEY))
  const [locais, setLocais] = useState([])
  const [loading, setLoading] = useState(true)
  const [localSelecionado, setLocalSelecionado] = useState(null)
  const [filtros, setFiltros] = useState({ edificacao: '', situacao: '', status: '' })
  const [destacarNome, setDestacarNome] = useState(false)
  const [filtrosAberto, setFiltrosAberto] = useState(false)

  useEffect(() => {
    carregarLocais()
    const channel = supabase
      .channel('estado-locais')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_estado_atual' }, carregarLocais)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregarLocais() {
    try {
      const data = await fetchLocaisComEstado()
      setLocais(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function salvarNome() {
    if (!nome.trim()) return
    localStorage.setItem(STORAGE_KEY, nome.trim())
    setNomeSalvo(true)
  }

  const edificacoes = useMemo(() => {
    const set = new Set(locais.map(l => l.edificacao))
    return [...set].sort()
  }, [locais])

  const locaisFiltrados = useMemo(() => {
    return locais.filter(local => {
      if (filtros.edificacao && local.edificacao !== filtros.edificacao) return false
      const slots = local.local_estado_atual || []
      if (filtros.situacao) {
        if (!slots.some(s => s.situacao_conformidade === filtros.situacao)) return false
      }
      if (filtros.status === 'manutencao' && !slots.some(s => s.em_manutencao)) return false
      if (filtros.status === 'reserva' && !slots.some(s => s.reserva_empresa)) return false
      return true
    })
  }, [locais, filtros])

  function toggleFiltro(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: f[campo] === valor ? '' : valor }))
  }

  function limparFiltros() {
    setFiltros({ edificacao: '', situacao: '', status: '' })
  }

  const filtrosAtivos = Object.values(filtros).filter(Boolean).length

  const progressoMes = useMemo(() => {
    const agora = new Date()
    const mes = agora.getMonth()
    const ano = agora.getFullYear()
    const total = locais.length
    const vistoriados = locais.filter(local => {
      const slots = local.local_estado_atual || []
      return slots.some(s => {
        if (!s.data_ultima_inspecao) return false
        const d = new Date(s.data_ultima_inspecao)
        return d.getMonth() === mes && d.getFullYear() === ano
      })
    }).length
    const pct = total > 0 ? Math.round((vistoriados / total) * 100) : 0
    return { total, vistoriados, pct }
  }, [locais])

  return (
    <div className="p-4 space-y-4">

      {/* Campo de nome */}
      <div className={`card transition-all duration-300 ${destacarNome ? 'ring-2 ring-sci-red border-sci-red' : ''}`}>
        {nomeSalvo ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-sci-muted">Responsável</p>
              <p className="font-semibold text-sci-text">{nome}</p>
            </div>
            <button onClick={() => setNomeSalvo(false)} className="text-xs text-sci-muted underline">
              Trocar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Seu nome de BA
            </label>
            {destacarNome && (
              <p className="text-xs text-sci-red font-medium">Preencha seu nome para continuar.</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarNome()}
                placeholder="Digite seu nome completo"
                className="flex-1"
              />
              <button onClick={salvarNome} className="btn-primary px-5 py-2 shrink-0">
                Ok
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progresso do mês */}
      {locais.length > 0 && (
        <div className="card py-3 px-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Inspeções do mês</span>
            <span className="text-sci-muted">
              <span className="font-bold text-sci-text">{progressoMes.vistoriados}</span>
              /{progressoMes.total}
              <span className="text-slate-400 ml-1">({progressoMes.pct}%)</span>
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressoMes.pct}%`,
                backgroundColor: progressoMes.pct === 100 ? '#16a34a' : progressoMes.pct >= 50 ? '#f59e0b' : '#dc2626'
              }}
            />
          </div>
        </div>
      )}

      {/* Barra da lista com botão de filtro */}
      {locais.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">
            {filtrosAtivos > 0
              ? `${locaisFiltrados.length} de ${locais.length} locais`
              : `${locais.length} locais`}
          </p>
          <button
            onClick={() => setFiltrosAberto(true)}
            className="flex items-center gap-1.5 btn-option py-1.5 px-3 text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filtros
            {filtrosAtivos > 0 && (
              <span className="bg-sci-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {filtrosAtivos}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {loading && (
          <div className="card text-center py-10 text-slate-400 text-sm">Carregando...</div>
        )}

        {!loading && locais.length === 0 && (
          <div className="card text-center py-10 text-slate-400 text-sm">
            Nenhum local cadastrado.
            <br />
            <span className="text-xs">Acesse Admin para cadastrar os locais.</span>
          </div>
        )}

        {!loading && locais.length > 0 && locaisFiltrados.length === 0 && (
          <div className="card text-center py-8 text-slate-400 text-sm">
            Nenhum local com esses filtros.
          </div>
        )}

        {locaisFiltrados.map(local => (
          <LocalCard
            key={local.id}
            local={local}
            onClick={() => {
              if (!nomeSalvo) {
                setDestacarNome(true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setTimeout(() => setDestacarNome(false), 2000)
                return
              }
              setLocalSelecionado(local)
            }}
          />
        ))}
      </div>

      {/* Modal de filtros */}
      {filtrosAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setFiltrosAberto(false)}>
          <div
            className="w-full bg-white rounded-t-3xl border-t border-sci-border shadow-xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sci-text">Filtros</p>
              <div className="flex items-center gap-3">
                {filtrosAtivos > 0 && (
                  <button onClick={limparFiltros} className="text-xs text-sci-red font-medium">
                    Limpar tudo
                  </button>
                )}
                <button onClick={() => setFiltrosAberto(false)} className="text-sci-muted text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Edificação</p>
              <div className="flex flex-wrap gap-1.5">
                {edificacoes.map(ed => (
                  <button
                    key={ed}
                    onClick={() => toggleFiltro('edificacao', ed)}
                    className={`btn-option text-xs py-1 px-2.5 ${filtros.edificacao === ed ? 'selected' : ''}`}
                  >
                    {ed}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Situação</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { valor: 'conforme',     label: 'Conforme' },
                  { valor: 'alerta',       label: 'Alerta' },
                  { valor: 'nao_conforme', label: 'Não Conforme' }
                ].map(s => (
                  <button
                    key={s.valor}
                    onClick={() => toggleFiltro('situacao', s.valor)}
                    className={`btn-option text-xs py-1 px-2.5 ${filtros.situacao === s.valor ? 'selected' : ''}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Status</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => toggleFiltro('status', 'manutencao')}
                  className={`btn-option text-xs py-1 px-2.5 ${filtros.status === 'manutencao' ? 'selected' : ''}`}
                >
                  Em Manutenção
                </button>
                <button
                  onClick={() => toggleFiltro('status', 'reserva')}
                  className={`btn-option text-xs py-1 px-2.5 ${filtros.status === 'reserva' ? 'selected' : ''}`}
                >
                  RESERVA
                </button>
              </div>
            </div>

            <button onClick={() => setFiltrosAberto(false)} className="btn-primary w-full">
              Aplicar
            </button>
          </div>
        </div>
      )}

      {localSelecionado && (
        <ModalLocal
          local={localSelecionado}
          responsavel={nome}
          onClose={() => setLocalSelecionado(null)}
          onAtualizar={carregarLocais}
        />
      )}
    </div>
  )
}
