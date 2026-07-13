import { useEffect, useState, useCallback } from 'react'
import { fetchEstoqueDeposito, fetchTiposExtintor, ajustarEstoqueDeposito, upsertItemDeposito, excluirItemDeposito, salvarRegistroAdmin } from '../lib/queries'
import { unidadeDoTipo } from '../lib/formato'
import { useToast } from '../components/Toast'

export default function Deposito() {
  const showToast = useToast()
  const [estoque, setEstoque] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState({ tipo: '', kg: '', categoria: 'SCI', operacional: true })
  const [salvando, setSalvando] = useState(false)
  const [modalTipoAberto, setModalTipoAberto] = useState(false)
  const [novoTipo, setNovoTipo] = useState({ tipo: '', kg: '', unidade: 'kg' })
  const [salvandoTipo, setSalvandoTipo] = useState(false)

  const carregar = useCallback(async () => {
    const [estoqueData, tiposData] = await Promise.all([fetchEstoqueDeposito(), fetchTiposExtintor()])
    setEstoque(estoqueData)
    setTipos(tiposData)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleAdicionar() {
    if (!form.tipo || !form.kg) return
    setSalvando(true)
    try {
      const resultado = await upsertItemDeposito({
        tipo: form.tipo,
        kg: form.kg,
        categoria: form.categoria,
        operacional: form.categoria === 'RESERVA' ? true : form.operacional
      })
      setForm({ tipo: '', kg: '', categoria: 'SCI', operacional: true })
      setFormAberto(false)
      showToast(
        resultado.queued ? 'Sem conexão — será adicionado automaticamente ao reconectar.' : 'Item adicionado ao depósito.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await carregar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function handleAdicionarTipo() {
    if (!novoTipo.tipo.trim() || !novoTipo.kg) return
    setSalvandoTipo(true)
    try {
      const resultado = await salvarRegistroAdmin({
        tabela: 'tipos_extintor',
        payload: { tipo: novoTipo.tipo.trim(), kg: parseFloat(novoTipo.kg), unidade: novoTipo.unidade }
      })
      showToast(
        resultado.queued ? 'Sem conexão — será adicionado automaticamente ao reconectar.' : 'Tipo adicionado.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      setForm(f => ({ ...f, tipo: novoTipo.tipo.trim(), kg: String(novoTipo.kg) }))
      setNovoTipo({ tipo: '', kg: '', unidade: 'kg' })
      setModalTipoAberto(false)
      await carregar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvandoTipo(false)
    }
  }

  async function handleAjustar(item, delta) {
    try {
      const resultado = await ajustarEstoqueDeposito({ tipo: item.tipo, kg: item.kg, categoria: item.categoria, operacional: item.operacional, delta })
      if (resultado.queued) showToast('Sem conexão — será aplicado automaticamente ao reconectar.', 'aviso')
      await carregar()
    } catch (e) {
      alert('Erro ao ajustar: ' + e.message)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este item do depósito?')) return
    try {
      const resultado = await excluirItemDeposito(id)
      showToast(
        resultado.queued ? 'Sem conexão — será removido automaticamente ao reconectar.' : 'Item removido do depósito.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await carregar()
    } catch (e) {
      alert('Erro ao remover: ' + e.message)
    }
  }

  const sciOk   = estoque.filter(e => e.categoria === 'SCI' && e.operacional === true)
  const sciNok  = estoque.filter(e => e.categoria === 'SCI' && e.operacional === false)
  const reserva = estoque.filter(e => e.categoria === 'RESERVA')

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="p-4 space-y-4">

      {/* Adicionar item */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setFormAberto(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <span className="text-sm font-semibold text-sci-text">+ Adicionar item ao depósito</span>
          <span className="text-slate-400 text-sm">{formAberto ? '▲' : '▼'}</span>
        </button>

        {formAberto && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            {/* Categoria */}
            <div className="flex gap-2">
              {[{ valor: 'SCI', label: 'SCI' }, { valor: 'RESERVA', label: 'RESERVA' }].map(c => (
                <button
                  key={c.valor}
                  onClick={() => setForm(f => ({ ...f, categoria: c.valor }))}
                  className={`btn-option flex-1 text-sm font-semibold ${form.categoria === c.valor ? 'selected' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Operacional — só para SCI */}
            {form.categoria === 'SCI' && (
              <div className="flex gap-2">
                {[{ valor: true, label: 'Operacional' }, { valor: false, label: 'Não operacional' }].map(op => (
                  <button
                    key={String(op.valor)}
                    onClick={() => setForm(f => ({ ...f, operacional: op.valor }))}
                    className={`btn-option flex-1 text-sm ${form.operacional === op.valor ? 'selected' : ''}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tipo / kg */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-1.5">
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value, kg: '' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Tipo</option>
                  {[...new Set(tipos.map(t => t.tipo))].sort().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setModalTipoAberto(true)}
                  className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 text-slate-500 text-lg flex items-center justify-center hover:bg-slate-50"
                  aria-label="Adicionar novo tipo"
                >+</button>
              </div>
              <select
                value={form.kg}
                onChange={e => setForm(f => ({ ...f, kg: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Capacidade</option>
                {[...new Set(tipos.filter(t => !form.tipo || t.tipo === form.tipo).map(t => t.kg))].sort((a, b) => a - b).map(kg => (
                  <option key={kg} value={kg}>{kg}{unidadeDoTipo(form.tipo, tipos)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAdicionar}
              disabled={!form.tipo || !form.kg || salvando}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        )}
      </div>

      {/* SCI — Operacional */}
      <Secao
        titulo="SCI — Operacional"
        corTitulo="text-green-700"
        indicador={<span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
        itens={sciOk}
        onAjustar={handleAjustar}
        onExcluir={handleExcluir}
        tiposExtintor={tipos}
        vazio="Nenhum extintor SCI operacional no depósito."
      />

      {/* SCI — Não operacional */}
      <Secao
        titulo="SCI — Não operacional"
        corTitulo="text-amber-700"
        indicador={<span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
        itens={sciNok}
        onAjustar={handleAjustar}
        onExcluir={handleExcluir}
        tiposExtintor={tipos}
        vazio="Nenhum extintor SCI não operacional no depósito."
      />

      {/* RESERVA */}
      <Secao
        titulo={<><span className="text-blue-600">RESERVA</span> — empresa</>}
        corTitulo="text-blue-700"
        indicador={<span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />}
        itens={reserva}
        onAjustar={handleAjustar}
        onExcluir={handleExcluir}
        tiposExtintor={tipos}
        vazio="Nenhum extintor RESERVA no depósito."
      />

      {/* Modal — novo tipo de extintor */}
      {modalTipoAberto && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4" onClick={() => !salvandoTipo && setModalTipoAberto(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sci-text">Novo tipo de extintor</p>
              <button onClick={() => setModalTipoAberto(false)} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
            </div>

            <div>
              <label className="text-xs text-slate-400">Tipo</label>
              <input
                type="text"
                value={novoTipo.tipo}
                onChange={e => setNovoTipo(f => ({ ...f, tipo: e.target.value }))}
                placeholder="ex: CO²"
                autoFocus
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Capacidade</label>
              <input
                type="number"
                value={novoTipo.kg}
                onChange={e => setNovoTipo(f => ({ ...f, kg: e.target.value }))}
                placeholder="ex: 6"
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Unidade</label>
              <div className="flex gap-2 mt-1">
                {['kg', 'L'].map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setNovoTipo(f => ({ ...f, unidade: u }))}
                    className={`btn-option flex-1 text-sm ${novoTipo.unidade === u ? 'selected' : ''}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAdicionarTipo}
              disabled={!novoTipo.tipo.trim() || !novoTipo.kg || salvandoTipo}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvandoTipo ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Secao({ titulo, indicador, itens, onAjustar, onExcluir, vazio, tiposExtintor }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
        {indicador}{titulo}
      </p>
      {itens.length === 0 ? (
        <div className="card text-center py-4 text-slate-400 text-sm">{vazio}</div>
      ) : itens.map(item => (
        <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sci-text">{item.tipo} {item.kg}{unidadeDoTipo(item.tipo, tiposExtintor)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onAjustar(item, -1)}
              disabled={item.quantidade === 0}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 text-lg flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
            >−</button>
            <span className={`text-lg font-bold w-8 text-center ${item.quantidade === 0 ? 'text-slate-300' : 'text-sci-text'}`}>
              {item.quantidade}
            </span>
            <button
              onClick={() => onAjustar(item, 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 text-lg flex items-center justify-center hover:bg-slate-50"
            >+</button>
          </div>

          <button
            onClick={() => onExcluir(item.id)}
            className="text-xs text-slate-300 hover:text-red-500 transition-colors shrink-0 ml-1"
          >✕</button>
        </div>
      ))}
    </div>
  )
}
