import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { fetchEstoqueDeposito, fetchTiposExtintor, ajustarEstoqueDeposito, upsertItemDeposito, excluirItemDeposito, salvarRegistroAdmin } from '../lib/queries'
import { unidadeDoTipo } from '../lib/formato'
import { useToast } from '../components/Toast'

// Formulário "Adicionar item" é revelado em etapas: grupo -> categoria (só em
// Extintores) -> operacional (só em SCI) -> tipo/kg. Cada campo começa vazio
// pra nada aparecer antes do usuário escolher a etapa anterior.
const FORM_VAZIO = { grupo: '', categoria: '', operacional: null, tipo: '', kg: '', nome: '' }

export default function Deposito() {
  const showToast = useToast()
  const navigate = useNavigate()
  const [estoque, setEstoque] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)

  // Gerenciar: enquanto ativo, +/- e exclusão só mexem no rascunho local
  // (draft) — nada vai pro banco até "Salvar alterações". Isso também
  // resolve a lentidão do +/- (sem round-trip a cada clique).
  const [gerenciando, setGerenciando] = useState(false)
  const [draft, setDraft] = useState(null)
  const [salvandoTudo, setSalvandoTudo] = useState(false)

  const [abaAtiva, setAbaAtiva] = useState('extintores')

  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [modalTipoAberto, setModalTipoAberto] = useState(false)
  const [novoTipo, setNovoTipo] = useState({ tipo: '', kg: '', unidade: 'kg' })
  const [salvandoTipo, setSalvandoTipo] = useState(false)

  // Modal próprio (não o confirm() nativo do navegador) pra avisar de
  // alterações não salvas — guarda o que fazer se o usuário confirmar a saída.
  const [confirmSaida, setConfirmSaida] = useState(null)

  const carregar = useCallback(async () => {
    const [estoqueData, tiposData] = await Promise.all([fetchEstoqueDeposito(), fetchTiposExtintor()])
    setEstoque(estoqueData)
    setTipos(tiposData)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const sujo = gerenciando && draft != null && (
    draft.some(d => d._novo) ||
    draft.some(d => {
      const original = estoque.find(o => o.id === d.id)
      return original && original.quantidade !== d.quantidade
    }) ||
    estoque.some(o => !draft.some(d => d.id === o.id))
  )

  // Avisa antes de fechar/atualizar a aba com alterações não salvas.
  useEffect(() => {
    function handler(e) {
      if (!sujo) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sujo])

  // Avisa antes de navegar pra outra tela do app com alterações não salvas —
  // modal próprio (não o dialog do navegador) com o "diz:" e a cara do site.
  useEffect(() => {
    if (!sujo) return
    function handleClickCapture(e) {
      const anchor = e.target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || anchor.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setConfirmSaida({ onConfirmar: () => { setGerenciando(false); setDraft(null); navigate(href) } })
    }
    document.addEventListener('click', handleClickCapture, true)
    return () => document.removeEventListener('click', handleClickCapture, true)
  }, [sujo, navigate])

  function handleToggleGerenciar() {
    if (gerenciando) {
      if (sujo) {
        setConfirmSaida({ onConfirmar: () => { setGerenciando(false); setDraft(null); setFormAberto(false) } })
        return
      }
      setGerenciando(false)
      setDraft(null)
      setFormAberto(false)
    } else {
      setDraft(estoque.map(i => ({ ...i })))
      setGerenciando(true)
    }
  }

  function handleAdicionarLocal() {
    const categoria = form.categoria

    if (categoria === 'OUTRO') {
      const nome = form.nome.trim()
      if (!nome) return
      const existe = draft.find(d => d.categoria === 'OUTRO' && d.tipo.toLowerCase() === nome.toLowerCase())
      if (existe) {
        showToast('Este item já está na lista.', 'aviso')
      } else {
        setDraft(d => [...d, {
          id: `novo-${Date.now()}-${Math.random()}`,
          tipo: nome, kg: 0, categoria: 'OUTRO', operacional: true, quantidade: 0, _novo: true
        }])
      }
    } else {
      if (!form.tipo || !form.kg) return
      const operacional = categoria === 'RESERVA' ? true : form.operacional
      const kgNum = parseFloat(form.kg)
      const existe = draft.find(d => d.tipo === form.tipo && d.kg === kgNum && d.categoria === categoria && d.operacional === operacional)
      if (existe) {
        showToast('Este item já está na lista.', 'aviso')
      } else {
        setDraft(d => [...d, {
          id: `novo-${Date.now()}-${Math.random()}`,
          tipo: form.tipo, kg: kgNum, categoria, operacional, quantidade: 0, _novo: true
        }])
      }
    }

    setForm(FORM_VAZIO)
    setFormAberto(false)
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
      const tiposData = await fetchTiposExtintor()
      setTipos(tiposData)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvandoTipo(false)
    }
  }

  // Ajusta (ou cria, se a linha ainda não existir no rascunho — caso de uma
  // linha visível no Gerenciar com 0 unidades dos dois lados) a quantidade
  // de um item específico por tipo+kg+categoria+operacional.
  function handleAjustarTabela(tipo, kg, categoria, operacional, delta) {
    setDraft(d => {
      const existente = d.find(i => i.tipo === tipo && i.kg === kg && i.categoria === categoria && i.operacional === operacional)
      if (existente) {
        return d.map(i => i.id === existente.id ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i)
      }
      return [...d, {
        id: `novo-${Date.now()}-${Math.random()}`,
        tipo, kg, categoria, operacional, quantidade: Math.max(0, delta), _novo: true
      }]
    })
  }

  // Remove a linha inteira (os dois lados oper./não oper., quando existirem)
  // de um tipo+kg dentro de uma categoria.
  function handleExcluirTabela(tipo, kg, categoria) {
    setDraft(d => d.filter(i => !(i.tipo === tipo && i.kg === kg && i.categoria === categoria)))
  }

  async function handleSalvar() {
    setSalvandoTudo(true)
    try {
      let filaAtiva = false

      for (const item of draft.filter(d => d._novo)) {
        const r1 = await upsertItemDeposito({ tipo: item.tipo, kg: item.kg, categoria: item.categoria, operacional: item.operacional })
        if (r1.queued) filaAtiva = true
        if (item.quantidade > 0) {
          const r2 = await ajustarEstoqueDeposito({ tipo: item.tipo, kg: item.kg, categoria: item.categoria, operacional: item.operacional, delta: item.quantidade })
          if (r2.queued) filaAtiva = true
        }
      }

      for (const item of draft.filter(d => !d._novo)) {
        const original = estoque.find(o => o.id === item.id)
        const delta = item.quantidade - (original?.quantidade ?? 0)
        if (delta !== 0) {
          const r = await ajustarEstoqueDeposito({ tipo: item.tipo, kg: item.kg, categoria: item.categoria, operacional: item.operacional, delta })
          if (r.queued) filaAtiva = true
        }
      }

      const idsRestantes = new Set(draft.filter(d => !d._novo).map(d => d.id))
      for (const original of estoque) {
        if (!idsRestantes.has(original.id)) {
          const r = await excluirItemDeposito(original.id)
          if (r.queued) filaAtiva = true
        }
      }

      showToast(
        filaAtiva ? 'Sem conexão — alterações serão enviadas automaticamente ao reconectar.' : 'Alterações salvas.',
        filaAtiva ? 'aviso' : 'sucesso'
      )
      setGerenciando(false)
      setDraft(null)
      setFormAberto(false)
      await carregar()
    } catch (e) {
      alert('Erro ao salvar alterações: ' + e.message)
    } finally {
      setSalvandoTudo(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const itensExibidos = gerenciando ? draft : estoque
  const sciOk   = itensExibidos.filter(e => e.categoria === 'SCI' && e.operacional === true)
  const sciNok  = itensExibidos.filter(e => e.categoria === 'SCI' && e.operacional === false)
  const reserva = itensExibidos.filter(e => e.categoria === 'RESERVA')
  const outros  = itensExibidos.filter(e => e.categoria === 'OUTRO')

  return (
    <div className="p-4 space-y-4">

      {/* Gerenciar / Salvar alterações */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleGerenciar}
          className={`flex-1 text-sm font-semibold rounded-xl px-4 py-2.5 border transition-colors ${
            gerenciando
              ? 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
              : 'border-sci-red text-sci-red bg-red-50 hover:bg-red-100'
          }`}
        >
          {gerenciando ? 'Cancelar' : 'Gerenciar'}
        </button>
        {gerenciando && (
          <button
            onClick={handleSalvar}
            disabled={!sujo || salvandoTudo}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {salvandoTudo ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>

      {/* Abas: Extintores / Outros */}
      <div className="flex gap-2">
        {[{ valor: 'extintores', label: 'Extintores' }, { valor: 'outros', label: 'Outros' }].map(a => (
          <button
            key={a.valor}
            onClick={() => setAbaAtiva(a.valor)}
            className={`btn-option flex-1 text-sm font-semibold ${abaAtiva === a.valor ? 'selected' : ''}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Adicionar item — só dentro de Gerenciar */}
      {gerenciando && (
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
              {/* Etapa 1: Extintores ou Outros */}
              <div className="flex gap-2">
                {[{ valor: 'EXTINTORES', label: 'Extintores' }, { valor: 'OUTRO', label: 'Outros' }].map(g => (
                  <button
                    key={g.valor}
                    onClick={() => setForm(f => ({ ...FORM_VAZIO, grupo: g.valor, categoria: g.valor === 'OUTRO' ? 'OUTRO' : '' }))}
                    className={`btn-option flex-1 text-sm font-semibold ${form.grupo === g.valor ? 'selected' : ''}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Etapa 2: SCI ou RESERVA — só depois de escolher Extintores */}
              {form.grupo === 'EXTINTORES' && (
                <div className="flex gap-2">
                  {[{ valor: 'SCI', label: 'SCI' }, { valor: 'RESERVA', label: 'RESERVA' }].map(c => (
                    <button
                      key={c.valor}
                      onClick={() => setForm(f => ({ ...f, categoria: c.valor, operacional: null, tipo: '', kg: '' }))}
                      className={`btn-option flex-1 text-sm font-semibold ${form.categoria === c.valor ? 'selected' : ''}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Etapa 3: Operacional/Não oper. — só depois de escolher SCI */}
              {form.categoria === 'SCI' && (
                <div className="flex gap-2">
                  {[{ valor: true, label: 'Operacional' }, { valor: false, label: 'Não operacional' }].map(op => (
                    <button
                      key={String(op.valor)}
                      onClick={() => setForm(f => ({ ...f, operacional: op.valor, tipo: '', kg: '' }))}
                      className={`btn-option flex-1 text-sm ${form.operacional === op.valor ? 'selected' : ''}`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              )}

              {form.categoria === 'OUTRO' && (
                /* Nome livre — sem tipo/kg da tabela de extintores */
                <div>
                  <label className="text-xs text-slate-400">Nome do item</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="ex: Placa de sinalização"
                    autoFocus
                    className="w-full mt-1"
                  />
                </div>
              )}

              {/* Etapa 4: Tipo/kg — só depois de RESERVA, ou de SCI+operacional escolhidos */}
              {(form.categoria === 'RESERVA' || (form.categoria === 'SCI' && form.operacional !== null)) && (
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
              )}

              <button
                onClick={handleAdicionarLocal}
                disabled={form.categoria === 'OUTRO' ? !form.nome.trim() : (!form.tipo || !form.kg)}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          )}
        </div>
      )}

      {abaAtiva === 'extintores' ? (
        <>
          {/* SCI — tabela Oper. / Não oper. / Total */}
          <TabelaEstoque
            titulo="SCI"
            indicador={<span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
            linhas={agruparOperNaoOper(sciOk, sciNok)}
            tiposExtintor={tipos}
            vazio="Nenhum extintor SCI no depósito."
            gerenciando={gerenciando}
            categoria="SCI"
            onAjustar={handleAjustarTabela}
            onExcluir={handleExcluirTabela}
          />

          {/* RESERVA — tabela simples (sempre operacional) */}
          <TabelaSimples
            titulo={<><span className="text-blue-600">RESERVA</span> — empresa</>}
            indicador={<span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />}
            linhas={agruparSimples(reserva)}
            tiposExtintor={tipos}
            vazio="Nenhum extintor RESERVA no depósito."
            gerenciando={gerenciando}
            categoria="RESERVA"
            onAjustar={handleAjustarTabela}
            onExcluir={handleExcluirTabela}
          />
        </>
      ) : (
        <TabelaSimples
          titulo="Outros itens"
          indicador={<span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />}
          linhas={agruparSimples(outros)}
          tiposExtintor={tipos}
          vazio="Nenhum item cadastrado."
          gerenciando={gerenciando}
          categoria="OUTRO"
          onAjustar={handleAjustarTabela}
          onExcluir={handleExcluirTabela}
          comKg={false}
        />
      )}

      {/* Modal — novo tipo de extintor (portal: escapa do space-y-4 da
          página, que senão empurraria o overlay com margin-top) */}
      {modalTipoAberto && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !salvandoTipo && setModalTipoAberto(false)}>
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
        </div>,
        document.body
      )}

      {/* Modal — confirmação de saída sem salvar (próprio do app, não o
          confirm() do navegador). Também via portal, pelo mesmo motivo. */}
      {confirmSaida && createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmSaida(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-sci-text">Sair sem salvar?</p>
            <p className="text-sm text-slate-500">Você tem alterações não salvas no Depósito. Elas serão perdidas se sair agora.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSaida(null)} className="btn-secondary flex-1">
                Continuar editando
              </button>
              <button
                onClick={() => { const onConfirmar = confirmSaida.onConfirmar; setConfirmSaida(null); onConfirmar() }}
                className="btn-primary flex-1"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Junta itens operacionais e não operacionais por TIPO+capacidade, somando
// as quantidades de cada lado — base das linhas da TabelaEstoque (SCI).
function agruparOperNaoOper(itensOper, itensNaoOper) {
  const porChave = new Map()
  function acumular(itens, campo) {
    itens.forEach(item => {
      const chave = `${item.tipo}|${item.kg}`
      if (!porChave.has(chave)) porChave.set(chave, { tipo: item.tipo, kg: item.kg, oper: 0, naoOper: 0 })
      porChave.get(chave)[campo] += item.quantidade
    })
  }
  acumular(itensOper, 'oper')
  acumular(itensNaoOper, 'naoOper')
  return [...porChave.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.kg - b.kg)
}

// Agrupa por TIPO+capacidade somando a quantidade — base das linhas da
// TabelaSimples (RESERVA e Outros, que não têm distinção oper./não oper.).
function agruparSimples(itens) {
  const porChave = new Map()
  itens.forEach(item => {
    const chave = `${item.tipo}|${item.kg}`
    if (!porChave.has(chave)) porChave.set(chave, { tipo: item.tipo, kg: item.kg, qtd: 0 })
    porChave.get(chave).qtd += item.quantidade
  })
  return [...porChave.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.kg - b.kg)
}

// Par de setas − valor + usado nas colunas editáveis das tabelas, só no
// modo Gerenciar.
function Stepper({ valor, cor, onDelta }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      <button
        onClick={() => onDelta(-1)}
        disabled={valor === 0}
        className="w-5 h-5 rounded border border-slate-200 text-slate-500 text-xs leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
      >−</button>
      <span className={`w-5 text-center text-sm font-semibold ${valor === 0 ? 'text-slate-300' : cor}`}>{valor}</span>
      <button
        onClick={() => onDelta(1)}
        className="w-5 h-5 rounded border border-slate-200 text-slate-500 text-xs leading-none flex items-center justify-center hover:bg-slate-50"
      >+</button>
    </div>
  )
}

function TabelaEstoque({ titulo, indicador, linhas, tiposExtintor, vazio, gerenciando, categoria, onAjustar, onExcluir }) {
  const total = linhas.reduce((acc, l) => ({ oper: acc.oper + l.oper, naoOper: acc.naoOper + l.naoOper }), { oper: 0, naoOper: 0 })
  const linhasVisiveis = gerenciando ? linhas : linhas.filter(l => l.oper > 0 || l.naoOper > 0)
  const colunas = gerenciando
    ? 'grid grid-cols-[1fr,4.5rem,4.5rem,2.5rem,1.25rem] gap-1 items-center'
    : 'grid grid-cols-[1fr,3.5rem,3.5rem,3.5rem] gap-1 items-center'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
        {indicador}{titulo}
      </p>
      {linhasVisiveis.length === 0 ? (
        <div className="card text-center py-4 text-slate-400 text-sm">{vazio}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`${colunas} px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide`}>
            <span>Tipo</span>
            <span className="text-center">Oper.</span>
            <span className="text-center">Não op.</span>
            <span className="text-center">Total</span>
            {gerenciando && <span />}
          </div>
          <div className="divide-y divide-slate-100">
            {linhasVisiveis.map(l => (
              <div key={`${l.tipo}-${l.kg}`} className={`${colunas} px-4 py-2.5`}>
                <span className="text-sm text-slate-600 truncate">{l.tipo} {l.kg}{unidadeDoTipo(l.tipo, tiposExtintor)}</span>
                {gerenciando ? (
                  <Stepper valor={l.oper} cor="text-green-700" onDelta={delta => onAjustar(l.tipo, l.kg, categoria, true, delta)} />
                ) : (
                  <span className={`text-center text-sm font-semibold ${l.oper === 0 ? 'text-slate-300' : 'text-green-700'}`}>{l.oper}</span>
                )}
                {gerenciando ? (
                  <Stepper valor={l.naoOper} cor="text-amber-700" onDelta={delta => onAjustar(l.tipo, l.kg, categoria, false, delta)} />
                ) : (
                  <span className={`text-center text-sm font-semibold ${l.naoOper === 0 ? 'text-slate-300' : 'text-amber-700'}`}>{l.naoOper}</span>
                )}
                <span className="text-center text-sm font-bold text-sci-text">{l.oper + l.naoOper}</span>
                {gerenciando && (
                  <button onClick={() => onExcluir(l.tipo, l.kg, categoria)} className="text-slate-300 hover:text-red-500 text-xs transition-colors">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className={`${colunas} px-4 py-2.5 bg-slate-50 border-t border-slate-200`}>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
            <span className="text-center text-sm font-bold text-green-700">{total.oper}</span>
            <span className="text-center text-sm font-bold text-amber-700">{total.naoOper}</span>
            <span className="text-center text-sm font-bold text-sci-text">{total.oper + total.naoOper}</span>
            {gerenciando && <span />}
          </div>
        </div>
      )}
    </div>
  )
}

// TIPO(+kg) | QTD — usada pra RESERVA (sempre operacional) e Outros (sem kg,
// nome livre).
function TabelaSimples({ titulo, indicador, linhas, tiposExtintor, vazio, gerenciando, categoria, onAjustar, onExcluir, comKg = true }) {
  const total = linhas.reduce((s, l) => s + l.qtd, 0)
  const linhasVisiveis = gerenciando ? linhas : linhas.filter(l => l.qtd > 0)
  const colunas = gerenciando
    ? 'grid grid-cols-[1fr,4.5rem,1.25rem] gap-1 items-center'
    : 'grid grid-cols-[1fr,3.5rem] gap-1 items-center'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
        {indicador}{titulo}
      </p>
      {linhasVisiveis.length === 0 ? (
        <div className="card text-center py-4 text-slate-400 text-sm">{vazio}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`${colunas} px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide`}>
            <span>{comKg ? 'Tipo' : 'Nome do item'}</span>
            <span className="text-center">Qtd.</span>
            {gerenciando && <span />}
          </div>
          <div className="divide-y divide-slate-100">
            {linhasVisiveis.map(l => (
              <div key={`${l.tipo}-${l.kg}`} className={`${colunas} px-4 py-2.5`}>
                <span className="text-sm text-slate-600 truncate">{l.tipo}{comKg ? ` ${l.kg}${unidadeDoTipo(l.tipo, tiposExtintor)}` : ''}</span>
                {gerenciando ? (
                  <Stepper valor={l.qtd} cor="text-sci-text" onDelta={delta => onAjustar(l.tipo, l.kg, categoria, true, delta)} />
                ) : (
                  <span className={`text-center text-sm font-bold ${l.qtd === 0 ? 'text-slate-300' : 'text-sci-text'}`}>{l.qtd}</span>
                )}
                {gerenciando && (
                  <button onClick={() => onExcluir(l.tipo, l.kg, categoria)} className="text-slate-300 hover:text-red-500 text-xs transition-colors">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className={`${colunas} px-4 py-2.5 bg-slate-50 border-t border-slate-200`}>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
            <span className="text-center text-sm font-bold text-sci-text">{total}</span>
            {gerenciando && <span />}
          </div>
        </div>
      )}
    </div>
  )
}
